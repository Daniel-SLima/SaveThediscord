import { useEffect, useRef, useState } from 'react';
import { createRoomId, isValidRoomId } from '../shared/room-id';
import type { Participant, ServerMessage } from '../shared/protocol';
import { ChatPanel, type ChatLine } from './components/ChatPanel';
import { AudienceStatus } from './components/AudienceStatus';
import { CopyLinkButton } from './components/CopyLinkButton';
import { Lobby } from './components/Lobby';
import { LocalPreview } from './components/LocalPreview';
import { ShareControls } from './components/ShareControls';
import { StreamTile } from './components/StreamTile';
import { RoomClient } from './lib/room-client';
import { removeRemoteStream } from './lib/room-state';
import { beginScreenShare } from './lib/share-session';
import { PeerMesh, startCapture } from './lib/webrtc';

function hashRoomId(): string | undefined {
  const id = window.location.hash.match(/^#\/room\/([^/]+)$/)?.[1];
  return id && isValidRoomId(id) ? id : undefined;
}

export default function App() {
  const [roomId, setRoomId] = useState(hashRoomId);
  const [name, setName] = useState<string>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [selfId, setSelfId] = useState<string>();
  const [activeSharerId, setActiveSharerId] = useState<string>();
  const [error, setError] = useState<string>();
  const [disconnected, setDisconnected] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const client = useRef<RoomClient | undefined>(undefined);
  const mesh = useRef<PeerMesh | undefined>(undefined);
  const shareSession = useRef(0);
  const localStreamRef = useRef<MediaStream>();
  const selfIdRef = useRef<string>();
  const participantsRef = useRef<Participant[]>([]);
  if (!client.current) client.current = new RoomClient();
  if (!mesh.current) {
    mesh.current = new PeerMesh((to, data) => client.current?.send({ type: 'signal', to, data }));
    mesh.current.onRemoteStream = (id, stream) => setRemoteStreams((current) => new Map(current).set(id, stream));
    mesh.current.onConnectionError = () => setError('A conexão direta falhou. Esta rede pode bloquear WebRTC; tente outra rede ou navegador.');
  }
  useEffect(() => {
    const updateRoute = () => setRoomId(hashRoomId());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  useEffect(() => {
    if (!roomId || !name) return;
    const roomClient = client.current!;
    shareSession.current += 1;
    setSelfId(undefined);
    const unsubscribe = roomClient.onMessage((message) => handleMessage(message));
    const unsubscribeClose = roomClient.onClose(() => {
      shareSession.current += 1;
      mesh.current?.stopShare();
      selfIdRef.current = undefined;
      setSelfId(undefined);
      localStreamRef.current = undefined;
      setLocalStream(undefined);
      setDisconnected(true);
      setError('A conexão com a sala foi encerrada.');
    });
    roomClient.connect(roomId, name).then(() => setDisconnected(false)).catch((cause: unknown) => { setDisconnected(true); setError(cause instanceof Error ? cause.message : 'A conexão foi interrompida.'); });
    return () => { unsubscribe(); unsubscribeClose(); roomClient.close(); };
  }, [roomId, name, connectionAttempt]);

  const handleMessage = (message: ServerMessage) => {
    if (message.type === 'snapshot') { selfIdRef.current = message.selfId; setSelfId(message.selfId); participantsRef.current = message.participants; setParticipants(message.participants); setActiveSharerId(message.sharerIds[0]); return; }
    if (message.type === 'participant-joined') {
      participantsRef.current = [...participantsRef.current, message.participant];
      setParticipants(participantsRef.current);
      if (localStreamRef.current) void mesh.current?.addViewer(message.participant.id);
      return;
    }
    if (message.type === 'participant-left') {
      participantsRef.current = participantsRef.current.filter((participant) => participant.id !== message.participantId);
      setParticipants(participantsRef.current);
      setActiveSharerId((current) => current === message.participantId ? undefined : current);
      mesh.current?.closePeer(message.participantId);
      setRemoteStreams((current) => removeRemoteStream(current, message.participantId));
      return;
    }
    if (message.type === 'share-stopped') {
      setActiveSharerId((current) => current === message.participantId ? undefined : current);
      mesh.current?.closePeer(message.participantId);
      setRemoteStreams((current) => removeRemoteStream(current, message.participantId));
      if (message.participantId === selfIdRef.current) { localStreamRef.current = undefined; setLocalStream(undefined); }
      return;
    }
    if (message.type === 'share-started') { setActiveSharerId(message.participantId); return; }
    if (message.type === 'chat') { setMessages((current) => [...current, { id: `${Date.now()}-${current.length}`, author: message.from.name, text: message.text }]); return; }
    if (message.type === 'signal') { void mesh.current?.handleSignal(message.from, message.data).catch(() => setError('Não foi possível estabelecer a conexão direta de mídia. Verifique permissões e rede.')); return; }
    if (message.type === 'error') setError(message.message);
    if (message.type === 'room-ended') setError('Esta sala foi encerrada.');
  };
  const create = (nickname: string) => {
    const id = createRoomId();
    setName(nickname);
    window.location.hash = `/room/${id}`;
    setRoomId(id);
  };
  const join = (id: string, nickname: string) => setName(nickname);
  const setCurrentLocalStream = (stream: MediaStream | undefined) => { localStreamRef.current = stream; setLocalStream(stream); };
  const startShare = async () => {
    setError(undefined);
    const session = shareSession.current;
    try {
      const stream = await beginScreenShare({
        selfId,
        isCurrent: () => shareSession.current === session,
        capture: () => startCapture('motion'),
        setLocalStream: setCurrentLocalStream,
        requestStartShare: () => client.current?.startShare() ?? Promise.reject(new Error('A conexão com a sala foi encerrada.')),
        sendStopShare: () => client.current?.send({ type: 'stop-share' }),
        startMesh: (capturedStream) => mesh.current!.startShare(capturedStream, participantsRef.current.filter((participant) => participant.id !== selfIdRef.current).map((participant) => participant.id)),
        stopMesh: () => mesh.current?.stopShare(),
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopShare());
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Permissão de compartilhamento cancelada ou negada.' : cause instanceof Error ? cause.message : 'Não foi possível capturar sua tela.');
    }
  };
  const stopShare = () => { mesh.current?.stopShare(); setCurrentLocalStream(undefined); client.current?.send({ type: 'stop-share' }); };

  if (!roomId) return <Lobby onCreate={create} onJoin={join} />;
  if (!name) return <Lobby roomId={roomId} onCreate={create} onJoin={join} />;
  const activeSharer = participants.find((participant) => participant.id === activeSharerId);
  const blockedBy = !localStream && activeSharerId !== selfId ? activeSharer?.name : undefined;
  return <main className="room"><header><div><p className="eyebrow">SALA TEMPORÁRIA</p><h1>Compartilhe sua tela</h1><p>{participants.length} {participants.length === 1 ? 'pessoa na sala' : 'pessoas na sala'}</p></div><CopyLinkButton url={window.location.href} onError={setError} /></header>{error && <p className="error" role="alert">{error}</p>}{disconnected && <button onClick={() => { setError(undefined); setDisconnected(false); setConnectionAttempt((value) => value + 1); }}>Reconectar</button>}<div className="room-layout"><section className="stage"><ShareControls sharing={Boolean(localStream)} disabled={!selfId || disconnected} blockedBy={blockedBy} onStart={startShare} onStop={stopShare} />{localStream && <><AudienceStatus totalParticipants={participants.length} /><LocalPreview stream={localStream} /></>}{remoteStreams.size ? [...remoteStreams.entries()].map(([id, stream]) => <StreamTile key={id} stream={stream} name={participants.find((participant) => participant.id === id)?.name ?? 'Convidado'} />) : !localStream && <div className="empty-stream">Aguardando alguém compartilhar uma tela.</div>}</section><ChatPanel messages={messages} onSend={(text) => client.current?.send({ type: 'chat', text })} /></div></main>;
}

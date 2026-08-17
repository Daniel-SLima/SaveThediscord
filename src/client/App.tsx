import { useEffect, useRef, useState } from 'react';
import { createRoomId, isValidRoomId } from '../shared/room-id';
import type { Participant, ServerMessage } from '../shared/protocol';
import { ChatPanel, type ChatLine } from './components/ChatPanel';
import { Lobby } from './components/Lobby';
import { ShareControls } from './components/ShareControls';
import { StreamTile } from './components/StreamTile';
import { RoomClient } from './lib/room-client';
import { removeRemoteStream } from './lib/room-state';
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
  const [error, setError] = useState<string>();
  const [disconnected, setDisconnected] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const client = useRef<RoomClient | undefined>(undefined);
  const mesh = useRef<PeerMesh | undefined>(undefined);
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
    const unsubscribe = roomClient.onMessage((message) => handleMessage(message));
    const unsubscribeClose = roomClient.onClose(() => { setDisconnected(true); setError('A conexão com a sala foi encerrada.'); });
    roomClient.connect(roomId, name).then(() => setDisconnected(false)).catch((cause: unknown) => { setDisconnected(true); setError(cause instanceof Error ? cause.message : 'A conexão foi interrompida.'); });
    return () => { unsubscribe(); unsubscribeClose(); roomClient.close(); };
  }, [roomId, name, connectionAttempt]);

  const handleMessage = (message: ServerMessage) => {
    if (message.type === 'snapshot') { setSelfId(message.selfId); setParticipants(message.participants); return; }
    if (message.type === 'participant-joined') {
      setParticipants((current) => [...current, message.participant]);
      if (localStream) void mesh.current?.addViewer(message.participant.id);
      return;
    }
    if (message.type === 'participant-left') {
      setParticipants((current) => current.filter((participant) => participant.id !== message.participantId));
      mesh.current?.closePeer(message.participantId);
      setRemoteStreams((current) => removeRemoteStream(current, message.participantId));
      return;
    }
    if (message.type === 'share-stopped') {
      mesh.current?.closePeer(message.participantId);
      setRemoteStreams((current) => removeRemoteStream(current, message.participantId));
      if (message.participantId === selfId) setLocalStream(undefined);
      return;
    }
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
  const startShare = async () => {
    setError(undefined);
    try {
      const stream = await startCapture('motion');
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopShare());
      setLocalStream(stream);
      client.current?.send({ type: 'start-share' });
      if (!selfId) throw new Error('Aguardando a identificação da sala antes de compartilhar.');
      await mesh.current?.startShare(stream, participants.filter((participant) => participant.id !== selfId).map((participant) => participant.id));
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Permissão de compartilhamento cancelada ou negada.' : cause instanceof Error ? cause.message : 'Não foi possível capturar sua tela.');
    }
  };
  const stopShare = () => { mesh.current?.stopShare(); setLocalStream(undefined); client.current?.send({ type: 'stop-share' }); };

  if (!roomId) return <Lobby onCreate={create} onJoin={join} />;
  if (!name) return <Lobby roomId={roomId} onCreate={create} onJoin={join} />;
  return <main className="room"><header><div><p className="eyebrow">SALA TEMPORÁRIA</p><h1>Compartilhe sua tela</h1><p>{participants.length} {participants.length === 1 ? 'pessoa na sala' : 'pessoas na sala'}</p></div><button onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => setError('Não foi possível copiar o link.'))}>Copiar link</button></header>{error && <p className="error" role="alert">{error}</p>}{disconnected && <button onClick={() => { setError(undefined); setDisconnected(false); setConnectionAttempt((value) => value + 1); }}>Reconectar</button>}<div className="room-layout"><section className="stage"><ShareControls sharing={Boolean(localStream)} onStart={startShare} onStop={stopShare} />{localStream && <p className="local-note">Você está compartilhando. Os convidados recebem seu vídeo diretamente.</p>}{remoteStreams.size ? [...remoteStreams.entries()].map(([id, stream]) => <StreamTile key={id} stream={stream} name={participants.find((participant) => participant.id === id)?.name ?? 'Convidado'} />) : <div className="empty-stream">Aguardando alguém compartilhar uma tela.</div>}</section><ChatPanel messages={messages} onSend={(text) => client.current?.send({ type: 'chat', text })} /></div></main>;
}

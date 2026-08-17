import type { SignalData } from '../../shared/protocol';

export type CaptureProfile = 'motion' | 'detail';

export async function startCapture(profile: CaptureProfile = 'motion'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Este navegador não oferece compartilhamento de tela.');
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60, max: 60 },
    },
    audio: true,
  });
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = profile;
  return stream;
}

export class PeerMesh {
  private readonly peers = new Map<string, RTCPeerConnection>();
  private stream?: MediaStream;
  onRemoteStream?: (participantId: string, stream: MediaStream) => void;
  onConnectionError?: (participantId: string) => void;

  constructor(private readonly sendSignal: (to: string, data: SignalData) => void) {}

  async startShare(stream: MediaStream, viewerIds: string[]): Promise<void> {
    this.stream = stream;
    await Promise.all(viewerIds.map((id) => this.addViewer(id)));
  }

  async addViewer(viewerId: string): Promise<void> {
    if (!this.stream || this.peers.has(viewerId)) return;
    const peer = this.createPeer(viewerId);
    this.stream.getTracks().forEach((track) => peer.addTrack(track, this.stream!));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.sendSignal(viewerId, { type: offer.type, sdp: offer.sdp ?? '' });
  }

  async handleSignal(from: string, data: SignalData): Promise<void> {
    const type = data.type;
    if (type === 'offer') {
      const peer = this.peers.get(from) ?? this.createPeer(from);
      await peer.setRemoteDescription(data as unknown as RTCSessionDescriptionInit);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.sendSignal(from, { type: answer.type, sdp: answer.sdp ?? '' });
      return;
    }
    const peer = this.peers.get(from);
    if (!peer) return;
    if (type === 'answer') await peer.setRemoteDescription(data as unknown as RTCSessionDescriptionInit);
    if (type === 'candidate' && data.candidate) await peer.addIceCandidate(data.candidate as RTCIceCandidateInit);
  }

  closePeer(participantId: string): void {
    this.peers.get(participantId)?.close();
    this.peers.delete(participantId);
  }

  stopShare(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
  }

  private createPeer(participantId: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate) this.sendSignal(participantId, { type: 'candidate', candidate: event.candidate.toJSON() });
    });
    peer.addEventListener('track', (event) => {
      const stream = event.streams[0];
      if (stream) this.onRemoteStream?.(participantId, stream);
    });
    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'failed') this.onConnectionError?.(participantId);
    });
    this.peers.set(participantId, peer);
    return peer;
  }
}

import { describe, expect, it, vi } from 'vitest';
import { PeerMesh, startCapture } from '../src/client/lib/webrtc';

describe('screen capture', () => {
  it('requests screen video and optional display audio at 1080p60', async () => {
    const stream = { getVideoTracks: () => [{ contentHint: '' }] } as unknown as MediaStream;
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    await startCapture('motion');

    expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({
      video: expect.objectContaining({ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } }),
      audio: true,
    }));
  });
});

describe('PeerMesh', () => {
  it('sends an offer directly to each viewer when sharing starts', async () => {
    const sendSignal = vi.fn();
    const peer = Object.assign(new EventTarget(), {
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    }) as unknown as RTCPeerConnection;
    vi.stubGlobal('RTCPeerConnection', vi.fn(() => peer));
    const stream = { getTracks: () => [{ kind: 'video' }] } as unknown as MediaStream;
    const mesh = new PeerMesh(sendSignal);

    await mesh.startShare(stream, ['viewer-1']);

    expect(sendSignal).toHaveBeenCalledWith('viewer-1', { type: 'offer', sdp: 'offer-sdp' });
  });

  it('reports a failed direct peer connection', async () => {
    const peer = Object.assign(new EventTarget(), {
      connectionState: 'failed', close: vi.fn(), addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
    }) as unknown as RTCPeerConnection;
    vi.stubGlobal('RTCPeerConnection', vi.fn(() => peer));
    const failed = vi.fn();
    const mesh = new PeerMesh(vi.fn());
    mesh.onConnectionError = failed;

    await mesh.startShare({ getTracks: () => [{ kind: 'video' }] } as unknown as MediaStream, ['viewer-1']);
    peer.dispatchEvent(new Event('connectionstatechange'));

    expect(failed).toHaveBeenCalledWith('viewer-1');
  });
});

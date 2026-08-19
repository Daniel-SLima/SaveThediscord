import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../src/client/App';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly sent: string[] = [];
  constructor(_url: string) { super(); FakeWebSocket.instances.push(this); }
  send(message: string) { this.sent.push(message); }
  close() { this.dispatchEvent(new Event('close')); }
  open() { this.dispatchEvent(new Event('open')); }
  message(payload: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) })); }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  window.location.hash = '#/room/AbCdEfGhIjKlMnOpQrStUA';
});

it('connects a viewer who joins after screen sharing has started', async () => {
  const track = { contentHint: '', addEventListener: vi.fn(), stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getVideoTracks: () => [track], getAudioTracks: () => [], getTracks: () => [track] } as unknown as MediaStream;
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(() => ({ getParameters: () => ({ encodings: [{}] }), setParameters: vi.fn().mockResolvedValue(undefined) })),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  });
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('RTCPeerConnection', vi.fn(() => peer));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(stream) } });
  render(<App />);

  fireEvent.change(screen.getByLabelText(/apelido/i), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar na sala/i }));
  const socket = await waitFor(() => {
    const value = FakeWebSocket.instances[0];
    expect(value).toBeDefined();
    return value!;
  });
  await act(async () => {
    socket.open();
    socket.message({ type: 'snapshot', selfId: 'host', participants: [{ id: 'host', name: 'Ana' }], locked: false, sharerIds: [] });
  });
  await waitFor(() => expect(screen.getByRole('button', { name: /compartilhar tela/i })).toBeEnabled());

  fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));
  await waitFor(() => expect(socket.sent).toContain(JSON.stringify({ type: 'start-share' })));
  await act(async () => { socket.message({ type: 'share-started', participantId: 'host' }); });
  await screen.findByLabelText('Sua prévia');

  await act(async () => { socket.message({ type: 'participant-joined', participant: { id: 'viewer', name: 'Bia' } }); });
  await waitFor(() => expect(RTCPeerConnection).toHaveBeenCalledOnce());
});

it('includes a viewer who joins while the broadcaster is choosing a screen', async () => {
  const track = { contentHint: '', addEventListener: vi.fn(), stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getVideoTracks: () => [track], getAudioTracks: () => [], getTracks: () => [track] } as unknown as MediaStream;
  let resolveCapture: (stream: MediaStream) => void = () => undefined;
  const capture = new Promise<MediaStream>((resolve) => { resolveCapture = resolve; });
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(() => ({ getParameters: () => ({ encodings: [{}] }), setParameters: vi.fn().mockResolvedValue(undefined) })),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  });
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('RTCPeerConnection', vi.fn(() => peer));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockReturnValue(capture) } });
  render(<App />);

  fireEvent.change(screen.getByLabelText(/apelido/i), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar na sala/i }));
  const socket = await waitFor(() => FakeWebSocket.instances[0]!);
  await act(async () => { socket.open(); socket.message({ type: 'snapshot', selfId: 'host', participants: [{ id: 'host', name: 'Ana' }], locked: false, sharerIds: [] }); });
  await waitFor(() => expect(screen.getByRole('button', { name: /compartilhar tela/i })).toBeEnabled());

  fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));
  await waitFor(() => expect(socket.sent).toContain(JSON.stringify({ type: 'start-share' })));
  await act(async () => { socket.message({ type: 'share-started', participantId: 'host' }); socket.message({ type: 'participant-joined', participant: { id: 'viewer', name: 'Bia' } }); });
  await act(async () => { resolveCapture(stream); });

  await waitFor(() => expect(RTCPeerConnection).toHaveBeenCalledOnce());
});

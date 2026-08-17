import { describe, expect, it, vi } from 'vitest';
import { RoomClient } from '../src/client/lib/room-client';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly sent: string[] = [];
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(message: string) { this.sent.push(message); }
  close() { this.dispatchEvent(new Event('close')); }
  open() { this.dispatchEvent(new Event('open')); }
  message(payload: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

describe('RoomClient', () => {
  it('joins the hash room and forwards parsed realtime messages', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new RoomClient({ origin: 'https://example.test' });
    const received: string[] = [];
    client.onMessage((message) => received.push(message.type));

    const connecting = client.connect('AbCdEfGhIjKlMnOpQrStUv', 'Ana');
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.open();
    await connecting;
    socket.message({ type: 'snapshot', selfId: 'ana', participants: [], locked: false, sharerIds: [] });

    expect(socket.url).toBe('wss://example.test/api/rooms/AbCdEfGhIjKlMnOpQrStUv/ws');
    expect(socket.sent).toEqual([JSON.stringify({ type: 'join', name: 'Ana' })]);
    expect(received).toEqual(['snapshot']);
  });

  it('notifies the UI when the room WebSocket closes', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new RoomClient({ origin: 'https://example.test' });
    const closed = vi.fn();
    client.onClose(closed);
    const connecting = client.connect('AbCdEfGhIjKlMnOpQrStUv', 'Ana');
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.open();
    await connecting;
    socket.close();

    expect(closed).toHaveBeenCalledOnce();
  });

  it('waits for the server share acknowledgement and clears identity on close', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new RoomClient({ origin: 'https://example.test' });
    const connecting = client.connect('AbCdEfGhIjKlMnOpQrStUv', 'Ana');
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.open();
    await connecting;
    socket.message({ type: 'snapshot', selfId: 'ana', participants: [], locked: false, sharerIds: [] });

    const accepted = client.startShare();
    expect(socket.sent).toContain(JSON.stringify({ type: 'start-share' }));
    socket.message({ type: 'share-started', participantId: 'ana' });
    await expect(accepted).resolves.toBeUndefined();

    const pending = client.startShare();
    socket.close();
    expect(client.selfId).toBeUndefined();
    await expect(pending).rejects.toThrow(/encerrada/i);
  });
});

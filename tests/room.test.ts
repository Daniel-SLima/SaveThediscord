import { beforeAll, describe, expect, it, vi } from 'vitest';
import worker from '../src/worker/index';

type SentMessage = Record<string, unknown>;

class FakeSocket {
  readonly sent: string[] = [];
  private attachment: unknown;

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {}

  serializeAttachment(attachment: unknown): void {
    this.attachment = attachment;
  }

  deserializeAttachment(): unknown {
    return this.attachment;
  }
}

class FakeRoomContext {
  readonly sockets: FakeSocket[] = [];

  acceptWebSocket(socket: FakeSocket): void {
    this.sockets.push(socket);
  }

  getWebSockets(): FakeSocket[] {
    return this.sockets;
  }

  getTags(): string[] {
    return [];
  }
}

let Room: typeof import('../src/worker/room').Room;

beforeAll(async () => {
  ({ Room } = await import('../src/worker/room'));
});

async function createRoomHarness() {
  const context = new FakeRoomContext();
  let room = new Room(context as never, {} as Env);
  const participants = new Map<string, FakeSocket>();

  return {
    async join(id: string, name = id): Promise<SentMessage[]> {
      const socket = new FakeSocket();
      socket.serializeAttachment({ id, name: '', isCreator: false, isSharing: false, locked: false, ended: false });
      context.sockets.push(socket);
      participants.set(id, socket);
      await room.webSocketMessage(socket as never, JSON.stringify({ type: 'join', name }));
      return readMessages(socket);
    },
    async send(id: string, message: Record<string, unknown>): Promise<SentMessage[]> {
      const socket = participants.get(id);
      if (!socket) throw new Error(`Unknown participant ${id}`);
      const before = socket.sent.length;
      await room.webSocketMessage(socket as never, JSON.stringify(message));
      return socket.sent.slice(before).map(parseMessage);
    },
    async close(id: string): Promise<void> {
      const socket = participants.get(id);
      if (!socket) throw new Error(`Unknown participant ${id}`);
      await room.webSocketClose(socket as never, 1000, 'left', true);
    },
    messages(id: string): SentMessage[] {
      const socket = participants.get(id);
      if (!socket) throw new Error(`Unknown participant ${id}`);
      return readMessages(socket);
    },
    clearMessages(): void {
      for (const socket of participants.values()) socket.sent.length = 0;
    },
    rehydrate(): void {
      room = new Room(context as never, {} as Env);
    },
  };
}

function parseMessage(message: string): SentMessage {
  return JSON.parse(message) as SentMessage;
}

function readMessages(socket: FakeSocket): SentMessage[] {
  return socket.sent.map(parseMessage);
}

describe('Room', () => {
  it('rejects the eleventh joined participant', async () => {
    const room = await createRoomHarness();
    await Promise.all(Array.from({ length: 10 }, (_, index) => room.join(`p${index}`)));

    await expect(room.join('overflow')).resolves.toContainEqual(expect.objectContaining({ type: 'error', code: 'room-full' }));
  });

  it('allows exactly two active shares', async () => {
    const room = await createRoomHarness();
    await room.join('a');
    await room.join('b');
    await room.join('c');
    room.clearMessages();

    await room.send('a', { type: 'start-share' });
    await room.send('b', { type: 'start-share' });

    await expect(room.send('c', { type: 'start-share' })).resolves.toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'share-limit',
    }));
  });

  it('allows only the creator to lock or end the room', async () => {
    const room = await createRoomHarness();
    await room.join('creator', 'Ana');
    await room.join('guest', 'Bia');
    room.clearMessages();

    await expect(room.send('guest', { type: 'lock-room' })).resolves.toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'creator-only',
    }));
    await room.send('creator', { type: 'lock-room' });
    expect(room.messages('guest')).toContainEqual({ type: 'snapshot', participants: [
      { id: 'creator', name: 'Ana' },
      { id: 'guest', name: 'Bia' },
    ], locked: true, sharerIds: [] });

    await room.send('creator', { type: 'end-room' });
    expect(room.messages('guest')).toContainEqual({ type: 'room-ended' });
  });

  it('broadcasts chat and relays signals only to the requested participant', async () => {
    const room = await createRoomHarness();
    await room.join('a', 'Ana');
    await room.join('b', 'Bia');
    await room.join('c', 'Caio');
    room.clearMessages();

    await room.send('a', { type: 'chat', text: 'Olá!' });
    expect(room.messages('b')).toContainEqual({ type: 'chat', from: { id: 'a', name: 'Ana' }, text: 'Olá!' });
    expect(room.messages('c')).toContainEqual({ type: 'chat', from: { id: 'a', name: 'Ana' }, text: 'Olá!' });

    room.clearMessages();
    await room.send('a', { type: 'signal', to: 'b', data: { sdp: 'offer' } });
    expect(room.messages('b')).toEqual([{ type: 'signal', from: 'a', data: { sdp: 'offer' } }]);
    expect(room.messages('c')).toEqual([]);
  });

  it('announces a departure and stops that participant share on close', async () => {
    const room = await createRoomHarness();
    await room.join('a', 'Ana');
    await room.join('b', 'Bia');
    room.clearMessages();
    await room.send('a', { type: 'start-share' });
    room.clearMessages();

    await room.close('a');

    expect(room.messages('b')).toEqual([
      { type: 'share-stopped', participantId: 'a' },
      { type: 'participant-left', participantId: 'a' },
    ]);
  });

  it('keeps a locked room locked after Durable Object hibernation', async () => {
    const room = await createRoomHarness();
    await room.join('creator');
    await room.send('creator', { type: 'lock-room' });
    room.rehydrate();

    await expect(room.join('guest')).resolves.toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'room-locked',
    }));
  });

  it('ends the room so members cannot act and later joins are rejected', async () => {
    const room = await createRoomHarness();
    await room.join('creator');
    await room.join('guest');
    room.clearMessages();

    await room.send('creator', { type: 'end-room' });
    expect(room.messages('guest')).toEqual([{ type: 'room-ended' }]);
    await expect(room.send('guest', { type: 'chat', text: 'still here?' })).resolves.toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'room-ended',
    }));
    await expect(room.join('late')).resolves.toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'room-ended',
    }));
  });

  it('includes every active sharer in a late joiner snapshot', async () => {
    const room = await createRoomHarness();
    await room.join('a');
    await room.join('b');
    await room.send('a', { type: 'start-share' });
    await room.send('b', { type: 'start-share' });

    await expect(room.join('late')).resolves.toContainEqual({
      type: 'snapshot',
      participants: [
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
        { id: 'late', name: 'late' },
      ],
      locked: false,
      sharerIds: ['a', 'b'],
    });
  });
});

describe('room WebSocket route', () => {
  const roomId = `${'a'.repeat(21)}A`;

  it('rejects invalid routes, methods, and missing upgrade headers', async () => {
    const env = { ROOM: {} } as Env;

    expect((await worker.fetch(new Request(`https://example.test/api/rooms/${roomId}/ws`), env)).status).toBe(400);
    expect((await worker.fetch(new Request(`https://example.test/api/rooms/${roomId}/ws`, { method: 'POST', headers: { Upgrade: 'websocket' } }), env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://example.test/api/rooms/not-valid/ws', { headers: { Upgrade: 'websocket' } }), env)).status).toBe(404);
  });

  it('forwards a valid WebSocket upgrade to the room Durable Object', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const idFromName = vi.fn(() => 'room-object-id');
    const env = { ROOM: { idFromName, get: vi.fn(() => ({ fetch })) } } as unknown as Env;
    const request = new Request(`https://example.test/api/rooms/${roomId}/ws`, { headers: { Upgrade: 'websocket' } });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(idFromName).toHaveBeenCalledWith(roomId);
    expect(fetch).toHaveBeenCalledWith(request);
  });
});

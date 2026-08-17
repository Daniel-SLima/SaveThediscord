import type { ClientMessage, ServerMessage } from '../../shared/protocol';

type Listener = (message: ServerMessage) => void;

export class RoomClient {
  private socket?: WebSocket;
  private readonly listeners = new Set<Listener>();
  private readonly origin: string;

  constructor(options: { origin?: string } = {}) {
    this.origin = options.origin ?? window.location.origin;
  }

  connect(roomId: string, name: string): Promise<void> {
    this.close();
    const url = new URL(`/api/rooms/${roomId}/ws`, this.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url.toString());
      this.socket = socket;
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'join', name }));
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => reject(new Error('Não foi possível conectar à sala.')),{ once: true });
      socket.addEventListener('message', (event) => this.receive(event.data));
    });
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: ClientMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private receive(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const message = JSON.parse(raw) as ServerMessage;
      if (message && typeof message.type === 'string') this.listeners.forEach((listener) => listener(message));
    } catch {
      // Ignore malformed network data; server validation remains authoritative.
    }
  }
}

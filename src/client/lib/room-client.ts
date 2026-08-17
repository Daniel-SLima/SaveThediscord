import type { ClientMessage, ServerMessage } from '../../shared/protocol';

type Listener = (message: ServerMessage) => void;

export class RoomClient {
  private socket?: WebSocket;
  selfId?: string;
  private readonly listeners = new Set<Listener>();
  private readonly closeListeners = new Set<() => void>();
  private readonly origin: string;
  private pendingStartShare?: { resolve(): void; reject(error: Error): void };

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
      socket.addEventListener('close', () => this.handleClose(socket));
    });
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  send(message: ClientMessage): void {
    this.sendInternal(message);
  }

  startShare(): Promise<void> {
    if (this.pendingStartShare) return Promise.reject(new Error('O compartilhamento já está aguardando confirmação.'));
    if (!this.selfId) return Promise.reject(new Error('A identificação da sala ainda não chegou.'));
    return new Promise((resolve, reject) => {
      this.pendingStartShare = { resolve, reject };
      if (!this.sendInternal({ type: 'start-share' })) {
        this.rejectPendingStartShare(new Error('A conexão com a sala foi encerrada.'));
      }
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.selfId = undefined;
  }

  private receive(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const message = JSON.parse(raw) as ServerMessage;
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'snapshot') this.selfId = message.selfId;
      if (message.type === 'share-started' && message.participantId === this.selfId) this.resolvePendingStartShare();
      if (message.type === 'error') this.rejectPendingStartShare(new Error(message.message));
      this.listeners.forEach((listener) => listener(message));
    } catch {
      // Ignore malformed network data; server validation remains authoritative.
    }
  }

  private sendInternal(message: ClientMessage): boolean {
    if (!this.socket || (typeof this.socket.readyState === 'number' && this.socket.readyState !== WebSocket.OPEN)) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      this.handleClose(this.socket);
      return false;
    }
  }

  private resolvePendingStartShare(): void {
    const pending = this.pendingStartShare;
    this.pendingStartShare = undefined;
    pending?.resolve();
  }

  private rejectPendingStartShare(error: Error): void {
    const pending = this.pendingStartShare;
    this.pendingStartShare = undefined;
    pending?.reject(error);
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = undefined;
    this.selfId = undefined;
    this.rejectPendingStartShare(new Error('A conexão com a sala foi encerrada.'));
    this.closeListeners.forEach((listener) => listener());
  }
}

import { isValidRoomId } from '../shared/room-id';
import { parseClientMessage, type ClientMessage, type Participant, type ServerMessage } from '../shared/protocol';

const MAX_PARTICIPANTS = 10;
const MAX_SHARERS = 2;

class DurableObjectBase<Environment> {
  protected ctx: DurableObjectState;
  protected env: Environment;

  constructor(ctx: DurableObjectState, env: Environment) {
    this.ctx = ctx;
    this.env = env;
  }
}

const RuntimeDurableObject = (globalThis as unknown as { DurableObject?: typeof DurableObjectBase }).DurableObject
  ?? DurableObjectBase;

interface SocketAttachment {
  id: string;
  name: string;
  isCreator: boolean;
  isSharing: boolean;
  locked: boolean;
  ended: boolean;
}

interface ConnectedParticipant extends Participant, SocketAttachment {
  socket: WebSocket;
}

function isSocketAttachment(value: unknown): value is SocketAttachment {
  if (typeof value !== 'object' || value === null) return false;

  const attachment = value as Record<string, unknown>;
  return typeof attachment.id === 'string'
    && typeof attachment.name === 'string'
    && typeof attachment.isCreator === 'boolean'
    && typeof attachment.isSharing === 'boolean'
    && typeof attachment.locked === 'boolean'
    && typeof attachment.ended === 'boolean';
}

export class Room extends RuntimeDurableObject<Env> {
  private readonly participants = new Map<string, ConnectedParticipant>();
  private locked = false;
  private ended = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    for (const socket of ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (!isSocketAttachment(attachment)) continue;
      this.participants.set(attachment.id, { ...attachment, socket });
      this.locked ||= attachment.locked;
      this.ended ||= attachment.ended;
    }
  }

  fetch(request: Request): Response {
    const url = new URL(request.url);
    const roomId = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/)?.[1];

    if (request.method !== 'GET' || !roomId || !isValidRoomId(roomId)) {
      return new Response('Not found', { status: 404 });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const participantId = crypto.randomUUID();

    this.ctx.acceptWebSocket(server, [participantId, '', 'false']);
    server.serializeAttachment({
      id: participantId,
      name: '',
      isCreator: false,
      isSharing: false,
      locked: this.locked,
      ended: this.ended,
    } satisfies SocketAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') {
      this.sendError(socket, 'invalid-message', 'Message must be text.');
      return;
    }

    const parsed = parseClientMessage(message);
    if (!parsed) {
      this.sendError(socket, 'invalid-message', 'Invalid message.');
      return;
    }

    if (parsed.type === 'join') {
      this.join(socket, parsed.name);
      return;
    }

    const sender = this.participantFor(socket);
    if (!sender) {
      this.sendError(socket, 'invalid-message', 'Join the room before sending messages.');
      return;
    }

    if (this.ended) {
      this.sendError(socket, 'room-ended', 'This room has ended.');
      return;
    }

    this.handleMessage(sender, parsed);
  }

  webSocketClose(socket: WebSocket): void {
    this.removeParticipant(socket);
  }

  webSocketError(socket: WebSocket): void {
    this.removeParticipant(socket);
  }

  private join(socket: WebSocket, name: string): void {
    if (this.participantFor(socket)) return;

    if (this.ended) {
      this.sendError(socket, 'room-ended', 'This room has ended.');
      return;
    }

    if (this.locked) {
      this.sendError(socket, 'room-locked', 'This room is locked.');
      return;
    }

    if (this.participants.size >= MAX_PARTICIPANTS) {
      this.sendError(socket, 'room-full', 'This room is full.');
      return;
    }

    const id = this.socketId(socket);
    const participant: ConnectedParticipant = {
      id,
      name,
      isCreator: this.participants.size === 0,
      isSharing: false,
      locked: this.locked,
      ended: this.ended,
      socket,
    };
    this.participants.set(id, participant);
    this.saveAttachment(participant);
    this.send(socket, this.snapshot(id));
    this.broadcast({ type: 'participant-joined', participant: this.toParticipant(participant) }, socket);
  }

  private handleMessage(sender: ConnectedParticipant, message: Exclude<ClientMessage, { type: 'join' }>): void {
    if (message.type === 'chat') {
      this.broadcast({ type: 'chat', from: this.toParticipant(sender), text: message.text });
      return;
    }

    if (message.type === 'signal') {
      const target = this.participants.get(message.to);
      if (!target) return;
      const isOffer = message.data.type === 'offer';
      if ((isOffer && !sender.isSharing) || (!isOffer && !sender.isSharing && !target.isSharing)) {
        this.sendError(sender.socket, 'unauthorized-signal', 'Only an active screen share can establish media signaling.');
        return;
      }
      this.send(target.socket, { type: 'signal', from: sender.id, data: message.data });
      return;
    }

    if (message.type === 'start-share') {
      if (sender.isSharing) return;
      if (this.activeSharers().length >= MAX_SHARERS) {
        this.sendError(sender.socket, 'share-limit', 'Only two participants can share at once.');
        return;
      }
      sender.isSharing = true;
      this.saveAttachment(sender);
      this.broadcast({ type: 'share-started', participantId: sender.id });
      return;
    }

    if (message.type === 'stop-share') {
      this.stopShare(sender);
      return;
    }

    if (!sender.isCreator) {
      this.sendError(sender.socket, 'creator-only', 'Only the room creator can do that.');
      return;
    }

    if (message.type === 'lock-room') {
      this.locked = true;
      this.saveAllAttachments();
      this.broadcastSnapshots();
      return;
    }

    this.ended = true;
    this.saveAllAttachments();
    this.broadcast({ type: 'room-ended' });
  }

  private removeParticipant(socket: WebSocket): void {
    const participant = this.participantFor(socket);
    if (!participant) return;

    this.participants.delete(participant.id);
    this.stopShare(participant);
    this.broadcast({ type: 'participant-left', participantId: participant.id });
  }

  private stopShare(participant: ConnectedParticipant): void {
    if (!participant.isSharing) return;
    participant.isSharing = false;
    this.saveAttachment(participant);
    this.broadcast({ type: 'share-stopped', participantId: participant.id });
  }

  private participantFor(socket: WebSocket): ConnectedParticipant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.socket === socket) return participant;
    }
    return undefined;
  }

  private socketId(socket: WebSocket): string {
    const attachment = socket.deserializeAttachment();
    return isSocketAttachment(attachment) && attachment.id ? attachment.id : crypto.randomUUID();
  }

  private activeSharers(): ConnectedParticipant[] {
    return [...this.participants.values()].filter((participant) => participant.isSharing);
  }

  private snapshot(selfId: string): ServerMessage {
    return {
      type: 'snapshot',
      selfId,
      participants: [...this.participants.values()].map((participant) => this.toParticipant(participant)),
      locked: this.locked,
      sharerIds: this.activeSharers().map((participant) => participant.id),
    };
  }

  private broadcastSnapshots(): void {
    for (const participant of this.participants.values()) this.send(participant.socket, this.snapshot(participant.id));
  }

  private toParticipant(participant: ConnectedParticipant): Participant {
    return { id: participant.id, name: participant.name };
  }

  private saveAttachment(participant: ConnectedParticipant): void {
    participant.socket.serializeAttachment({
      id: participant.id,
      name: participant.name,
      isCreator: participant.isCreator,
      isSharing: participant.isSharing,
      locked: this.locked,
      ended: this.ended,
    } satisfies SocketAttachment);
  }

  private saveAllAttachments(): void {
    for (const participant of this.participants.values()) this.saveAttachment(participant);
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private sendError(socket: WebSocket, code: NonNullable<Extract<ServerMessage, { type: 'error' }>['code']>, message: string): void {
    this.send(socket, { type: 'error', code, message });
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    for (const participant of this.participants.values()) {
      if (participant.socket !== except) this.send(participant.socket, message);
    }
  }
}

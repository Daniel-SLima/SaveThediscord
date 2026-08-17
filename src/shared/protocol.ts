export type SignalData =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'candidate'; candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string } };

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'chat'; text: string }
  | { type: 'signal'; to: string; data: SignalData }
  | { type: 'start-share' }
  | { type: 'stop-share' }
  | { type: 'lock-room' }
  | { type: 'end-room' };

export interface Participant {
  id: string;
  name: string;
}

export type ServerMessage =
  | { type: 'snapshot'; selfId: string; participants: Participant[]; locked: boolean; sharerIds: string[] }
  | { type: 'participant-joined'; participant: Participant }
  | { type: 'participant-left'; participantId: string }
  | { type: 'chat'; from: Participant; text: string }
  | { type: 'signal'; from: string; data: SignalData }
  | { type: 'share-started'; participantId: string }
  | { type: 'share-stopped'; participantId: string }
  | { type: 'error'; message: string; code?: 'room-full' | 'share-limit' | 'creator-only' | 'room-locked' | 'room-ended' | 'invalid-message' | 'unauthorized-signal' }
  | { type: 'room-ended' };

const hasOnlyType = (value: Record<string, unknown>, type: ClientMessage['type']) => value.type === type;

function getTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= maxLength ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSignalData(value: unknown): SignalData | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if ((value.type === 'offer' || value.type === 'answer') && typeof value.sdp === 'string' && value.sdp.length > 0 && value.sdp.length <= 100_000) return { type: value.type, sdp: value.sdp };
  if (value.type !== 'candidate' || !isRecord(value.candidate) || typeof value.candidate.candidate !== 'string' || value.candidate.candidate.length > 4_000) return null;
  const candidate: SignalData = { type: 'candidate', candidate: { candidate: value.candidate.candidate } };
  if (typeof value.candidate.sdpMid === 'string' || value.candidate.sdpMid === null) candidate.candidate.sdpMid = value.candidate.sdpMid;
  if (typeof value.candidate.sdpMLineIndex === 'number' || value.candidate.sdpMLineIndex === null) candidate.candidate.sdpMLineIndex = value.candidate.sdpMLineIndex;
  if (typeof value.candidate.usernameFragment === 'string') candidate.candidate.usernameFragment = value.candidate.usernameFragment;
  return candidate;
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value) || typeof value.type !== 'string') return null;

  if (hasOnlyType(value, 'join')) {
    const name = getTrimmedString(value.name, 32);
    return name ? { type: 'join', name } : null;
  }

  if (hasOnlyType(value, 'chat')) {
    const text = getTrimmedString(value.text, 500);
    return text ? { type: 'chat', text } : null;
  }

  if (hasOnlyType(value, 'signal')) {
    const to = getTrimmedString(value.to, 128);
    const data = parseSignalData(value.data);
    return to && data ? { type: 'signal', to, data } : null;
  }

  if (hasOnlyType(value, 'start-share')) return { type: 'start-share' };
  if (hasOnlyType(value, 'stop-share')) return { type: 'stop-share' };
  if (hasOnlyType(value, 'lock-room')) return { type: 'lock-room' };
  if (hasOnlyType(value, 'end-room')) return { type: 'end-room' };

  return null;
}

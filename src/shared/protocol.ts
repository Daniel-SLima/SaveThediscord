export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'chat'; text: string }
  | { type: 'signal'; to: string; data: Record<string, unknown> }
  | { type: 'start-share' }
  | { type: 'stop-share' }
  | { type: 'lock-room' }
  | { type: 'end-room' };

export interface Participant {
  id: string;
  name: string;
}

export type ServerMessage =
  | { type: 'snapshot'; participants: Participant[]; locked: boolean; sharerId: string | null }
  | { type: 'participant-joined'; participant: Participant }
  | { type: 'participant-left'; participantId: string }
  | { type: 'chat'; from: Participant; text: string }
  | { type: 'signal'; from: string; data: Record<string, unknown> }
  | { type: 'share-started'; participantId: string }
  | { type: 'share-stopped'; participantId: string }
  | { type: 'error'; message: string }
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
    return to && isRecord(value.data) ? { type: 'signal', to, data: value.data } : null;
  }

  if (hasOnlyType(value, 'start-share')) return { type: 'start-share' };
  if (hasOnlyType(value, 'stop-share')) return { type: 'stop-share' };
  if (hasOnlyType(value, 'lock-room')) return { type: 'lock-room' };
  if (hasOnlyType(value, 'end-room')) return { type: 'end-room' };

  return null;
}

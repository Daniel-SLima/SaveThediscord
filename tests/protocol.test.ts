import { describe, expect, it } from 'vitest';
import { parseClientMessage } from '../src/shared/protocol';

describe('parseClientMessage', () => {
  it('accepts a valid join message', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', name: 'Ana' }))).toEqual({
      type: 'join',
      name: 'Ana',
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseClientMessage('{bad json}')).toBeNull();
  });

  it('rejects unknown message types and non-object JSON', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'dance' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify(['join']))).toBeNull();
  });

  it('accepts each explicit client message shape', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'chat', text: 'Oi!' }))).toEqual({
      type: 'chat',
      text: 'Oi!',
    });
    expect(parseClientMessage(JSON.stringify({ type: 'signal', to: 'peer-1', data: { sdp: 'offer' } }))).toEqual({
      type: 'signal',
      to: 'peer-1',
      data: { sdp: 'offer' },
    });
    expect(parseClientMessage(JSON.stringify({ type: 'start-share' }))).toEqual({ type: 'start-share' });
    expect(parseClientMessage(JSON.stringify({ type: 'stop-share' }))).toEqual({ type: 'stop-share' });
    expect(parseClientMessage(JSON.stringify({ type: 'lock-room' }))).toEqual({ type: 'lock-room' });
    expect(parseClientMessage(JSON.stringify({ type: 'end-room' }))).toEqual({ type: 'end-room' });
  });

  it('rejects invalid names, chat text, and signal targets', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', name: ' ' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'join', name: 'a'.repeat(33) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'chat', text: '' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'chat', text: 'a'.repeat(501) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'signal', data: {} }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'signal', to: '', data: {} }))).toBeNull();
  });
});

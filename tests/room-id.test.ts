import { expect, it } from 'vitest';
import { createRoomId, isValidRoomId } from '../src/shared/room-id';

it('creates a valid URL-safe 128-bit room identifier', () => {
  const roomId = createRoomId();

  expect(isValidRoomId(roomId)).toBe(true);
  expect(roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
});

it('rejects malformed room identifiers', () => {
  expect(isValidRoomId('not a room id')).toBe(false);
  expect(isValidRoomId('a'.repeat(21))).toBe(false);
  expect(isValidRoomId('a'.repeat(23))).toBe(false);
  expect(isValidRoomId('a'.repeat(22) + '=')).toBe(false);
});

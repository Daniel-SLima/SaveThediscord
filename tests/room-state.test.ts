import { expect, it } from 'vitest';
import { removeRemoteStream } from '../src/client/lib/room-state';

it('removes only the stopped sharer stream from the remote stream map', () => {
  const ana = {} as MediaStream;
  const bia = {} as MediaStream;
  const remaining = removeRemoteStream(new Map([['ana', ana], ['bia', bia]]), 'ana');

  expect(remaining).toEqual(new Map([['bia', bia]]));
});

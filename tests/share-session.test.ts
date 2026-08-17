import { expect, it, vi } from 'vitest';
import { beginScreenShare } from '../src/client/lib/share-session';

it('does not open the display picker before the room identifies the participant', async () => {
  const capture = vi.fn();
  await expect(beginScreenShare({
    selfId: undefined,
    capture,
    setLocalStream: vi.fn(),
    send: vi.fn(),
    startMesh: vi.fn(),
    stopMesh: vi.fn(),
  })).rejects.toThrow(/identificação da sala/i);
  expect(capture).not.toHaveBeenCalled();
});

it('rolls back tracks, local state, and room share state when peer setup fails', async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const setLocalStream = vi.fn();
  const send = vi.fn();
  const stopMesh = vi.fn();

  await expect(beginScreenShare({
    selfId: 'ana',
    capture: vi.fn().mockResolvedValue(stream),
    setLocalStream,
    send,
    startMesh: vi.fn().mockRejectedValue(new Error('peer failed')),
    stopMesh,
  })).rejects.toThrow('peer failed');

  expect(track.stop).toHaveBeenCalledOnce();
  expect(stopMesh).toHaveBeenCalledOnce();
  expect(setLocalStream).toHaveBeenLastCalledWith(undefined);
  expect(send).toHaveBeenCalledWith({ type: 'start-share' });
  expect(send).toHaveBeenCalledWith({ type: 'stop-share' });
});

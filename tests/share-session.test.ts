import { expect, it, vi } from 'vitest';
import { beginScreenShare } from '../src/client/lib/share-session';

it('does not open the display picker before the room identifies the participant', async () => {
  const capture = vi.fn();
  await expect(beginScreenShare({
    selfId: undefined,
    capture,
    setLocalStream: vi.fn(),
    requestStartShare: vi.fn(),
    sendStopShare: vi.fn(),
    startMesh: vi.fn(),
    stopMesh: vi.fn(),
  })).rejects.toThrow(/identificação da sala/i);
  expect(capture).not.toHaveBeenCalled();
});

it('rolls back tracks, local state, and room share state when peer setup fails', async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const setLocalStream = vi.fn();
  const requestStartShare = vi.fn().mockResolvedValue(undefined);
  const sendStopShare = vi.fn();
  const stopMesh = vi.fn();

  await expect(beginScreenShare({
    selfId: 'ana',
    capture: vi.fn().mockResolvedValue(stream),
    setLocalStream,
    requestStartShare,
    sendStopShare,
    startMesh: vi.fn().mockRejectedValue(new Error('peer failed')),
    stopMesh,
  })).rejects.toThrow('peer failed');

  expect(track.stop).toHaveBeenCalledOnce();
  expect(stopMesh).toHaveBeenCalledOnce();
  expect(setLocalStream).toHaveBeenLastCalledWith(undefined);
  expect(requestStartShare).toHaveBeenCalledOnce();
  expect(sendStopShare).toHaveBeenCalledOnce();
});

it('waits for server share acceptance before opening the display picker', async () => {
  let acceptShare: () => void = () => undefined;
  const requestStartShare = vi.fn(() => new Promise<void>((resolve) => { acceptShare = resolve; }));
  const capture = vi.fn().mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
  const sharing = beginScreenShare({
    selfId: 'ana', capture, requestStartShare, sendStopShare: vi.fn(),
    setLocalStream: vi.fn(), startMesh: vi.fn().mockResolvedValue(undefined), stopMesh: vi.fn(),
  });

  await Promise.resolve();
  expect(capture).not.toHaveBeenCalled();
  acceptShare();
  await sharing;
  expect(capture).toHaveBeenCalledOnce();
});

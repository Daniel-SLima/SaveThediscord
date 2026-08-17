import { expect, it, vi } from 'vitest';
import { beginScreenShare } from '../src/client/lib/share-session';

it('does not open the display picker before the room identifies the participant', async () => {
  const capture = vi.fn();
  await expect(beginScreenShare({
    selfId: undefined,
    isCurrent: () => true,
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
    isCurrent: () => true,
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
    selfId: 'ana', isCurrent: () => true, capture, requestStartShare, sendStopShare: vi.fn(),
    setLocalStream: vi.fn(), startMesh: vi.fn().mockResolvedValue(undefined), stopMesh: vi.fn(),
  });

  await Promise.resolve();
  expect(capture).not.toHaveBeenCalled();
  acceptShare();
  await sharing;
  expect(capture).toHaveBeenCalledOnce();
});

it('cancels a stale share session after the display picker resolves', async () => {
  let resolveCapture: (stream: MediaStream) => void = () => undefined;
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const capture = vi.fn(() => new Promise<MediaStream>((resolve) => { resolveCapture = resolve; }));
  let current = true;
  const setLocalStream = vi.fn();
  const startMesh = vi.fn();
  const sharing = beginScreenShare({
    selfId: 'ana', capture, isCurrent: () => current,
    requestStartShare: vi.fn().mockResolvedValue(undefined), sendStopShare: vi.fn(),
    setLocalStream, startMesh, stopMesh: vi.fn(),
  });

  await Promise.resolve();
  current = false;
  resolveCapture({ getTracks: () => [track] } as unknown as MediaStream);

  await expect(sharing).rejects.toThrow(/cancelado/i);
  expect(track.stop).toHaveBeenCalledOnce();
  expect(setLocalStream).not.toHaveBeenCalledWith(expect.anything());
  expect(startMesh).not.toHaveBeenCalled();
});

it('cancels and rolls back when the session goes stale during peer setup', async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  let current = true;
  const setLocalStream = vi.fn();
  const stopMesh = vi.fn();
  const sharing = beginScreenShare({
    selfId: 'ana', capture: vi.fn().mockResolvedValue({ getTracks: () => [track] } as unknown as MediaStream),
    isCurrent: () => current, requestStartShare: vi.fn().mockResolvedValue(undefined), sendStopShare: vi.fn(),
    setLocalStream, stopMesh,
    startMesh: vi.fn().mockImplementation(async () => { current = false; }),
  });

  await expect(sharing).rejects.toThrow(/cancelado/i);
  expect(track.stop).toHaveBeenCalledOnce();
  expect(stopMesh).toHaveBeenCalledOnce();
  expect(setLocalStream).toHaveBeenLastCalledWith(undefined);
});

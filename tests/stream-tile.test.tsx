import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StreamTile } from '../src/client/components/StreamTile';

it('lets each viewer mute and set their own stream volume', () => {
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);
  const video = screen.getByLabelText(/transmissão de Ana/i) as HTMLVideoElement;
  fireEvent.change(screen.getByRole('slider', { name: /volume de Ana/i }), { target: { value: '35' } });
  fireEvent.click(screen.getByRole('button', { name: /silenciar Ana/i }));
  expect(video.volume).toBeCloseTo(0.35);
  expect(video.muted).toBe(true);
});

it('uses an immersive fullscreen mode and displays a loading state while the live stream stalls', async () => {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' })); await Promise.resolve(); });
  expect(await screen.findByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument();
  expect(requestFullscreen).toHaveBeenCalledOnce();

  const video = screen.getByLabelText(/transmissão de Ana/i);
  fireEvent.waiting(video);
  expect(screen.getByRole('status')).toHaveTextContent('Conexão instável — aguardando o vídeo ao vivo');
  fireEvent.playing(video);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('hides fullscreen controls after a short period without interaction', async () => {
  vi.useFakeTimers();
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' })); await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });

  expect(screen.getByRole('button', { name: 'Sair da tela cheia' }).parentElement).toHaveClass('hidden');
  vi.useRealTimers();
});

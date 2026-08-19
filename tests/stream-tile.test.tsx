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
  expect(screen.getByRole('status')).toHaveTextContent('Reconectando vídeo…');
  fireEvent.playing(video);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('uses icon-only fullscreen and audio controls with accessible labels', () => {
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);
  const fullscreen = screen.getByRole('button', { name: 'Tela cheia' });
  const audio = screen.getByRole('button', { name: 'Silenciar Ana' });

  expect(fullscreen).toHaveAttribute('title', 'Tela cheia');
  expect(audio).toHaveAttribute('title', 'Silenciar');
  expect(fullscreen).toHaveTextContent('');
  expect(audio).toHaveTextContent('');
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

it('falls back to cinema mode when the browser rejects native fullscreen', async () => {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: vi.fn().mockRejectedValue(new Error('blocked')) });
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);

  fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));

  expect(await screen.findByText('Modo cinema ativado')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument();
});

it('leaves cinema mode when Escape is pressed', async () => {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: vi.fn().mockRejectedValue(new Error('blocked')) });
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);

  fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
  await screen.findByText('Modo cinema ativado');
  fireEvent.keyDown(document, { key: 'Escape' });

  expect(screen.queryByText('Modo cinema ativado')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeInTheDocument();
});

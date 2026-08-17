import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { StreamTile } from '../src/client/components/StreamTile';

it('lets each viewer mute and set their own stream volume', () => {
  render(<StreamTile stream={{} as MediaStream} name="Ana" />);
  const video = screen.getByLabelText(/transmissão de Ana/i) as HTMLVideoElement;
  fireEvent.change(screen.getByRole('slider', { name: /volume de Ana/i }), { target: { value: '35' } });
  fireEvent.click(screen.getByRole('button', { name: /silenciar Ana/i }));
  expect(video.volume).toBeCloseTo(0.35);
  expect(video.muted).toBe(true);
});

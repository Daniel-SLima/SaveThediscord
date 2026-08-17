import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShareControls } from '../src/client/components/ShareControls';

it('warns about full system audio and starts sharing only after a click', () => {
  const onStart = vi.fn();
  render(<ShareControls onStart={onStart} sharing={false} />);
  expect(screen.getByText(/áudio de todo o sistema.*Discord/i)).toBeVisible();
  expect(screen.getByText(/áudio de uma aba.*mais seguro/i)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));
  expect(onStart).toHaveBeenCalledOnce();
});

it('disables sharing until the room connection identifies the participant', () => {
  const onStart = vi.fn();
  render(<ShareControls onStart={onStart} sharing={false} disabled />);
  const button = screen.getByRole('button', { name: /compartilhar tela/i });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onStart).not.toHaveBeenCalled();
});

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Lobby } from '../src/client/components/Lobby';

it('creates a room using the ephemeral nickname', () => {
  const onCreate = vi.fn();
  render(<Lobby onCreate={onCreate} onJoin={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/apelido/i), { target: { value: ' Ana ' } });
  fireEvent.click(screen.getByRole('button', { name: /criar sala/i }));
  expect(onCreate).toHaveBeenCalledWith('Ana');
});

it('joins the room in the current URL hash', () => {
  const onJoin = vi.fn();
  render(<Lobby roomId="AbCdEfGhIjKlMnOpQrStUv" onCreate={vi.fn()} onJoin={onJoin} />);
  fireEvent.change(screen.getByLabelText(/apelido/i), { target: { value: 'Beto' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
  expect(onJoin).toHaveBeenCalledWith('AbCdEfGhIjKlMnOpQrStUv', 'Beto');
});

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChatPanel } from '../src/client/components/ChatPanel';

it('sends a trimmed non-empty ephemeral chat message', () => {
  const onSend = vi.fn();
  render(<ChatPanel messages={[]} onSend={onSend} />);
  fireEvent.change(screen.getByLabelText(/mensagem/i), { target: { value: ' oi ' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
  expect(onSend).toHaveBeenCalledWith('oi');
});

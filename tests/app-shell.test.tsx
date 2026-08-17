import { fireEvent, render, screen } from '@testing-library/react';
import App from '../src/client/App';

it('renders the start screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /compartilhe sua tela/i })).toBeVisible();
});

it('creates a random hash room after choosing a nickname', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/apelido/i), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: /criar sala/i }));
  expect(window.location.hash).toMatch(/^#\/room\/[A-Za-z0-9_-]{22}$/);
});

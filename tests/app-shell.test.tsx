import { render, screen } from '@testing-library/react';
import App from '../src/client/App';

it('renders the start screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /compartilhe sua tela/i })).toBeVisible();
});

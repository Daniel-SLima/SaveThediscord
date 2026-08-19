import { render, screen } from '@testing-library/react';
import { AudienceStatus } from '../src/client/components/AudienceStatus';

it('reports when no guest is connected', () => {
  render(<AudienceStatus totalParticipants={1} />);
  expect(screen.getByText(/nenhum convidado conectado/i)).toBeVisible();
});

it('reports the number of connected guests', () => {
  render(<AudienceStatus totalParticipants={3} />);
  expect(screen.getByText(/2 convidados assistindo/i)).toBeVisible();
});

import { fireEvent, render, screen } from '@testing-library/react';
import { CopyLinkButton } from '../src/client/components/CopyLinkButton';

it('confirms after copying the room link', async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  render(<CopyLinkButton url="https://example.test/#/room/abc" onError={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /copiar link/i }));
  expect(await screen.findByRole('button', { name: /link copiado/i })).toBeVisible();
});

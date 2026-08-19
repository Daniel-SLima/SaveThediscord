import { render, screen } from '@testing-library/react';
import { LocalPreview } from '../src/client/components/LocalPreview';

function makeStream(audioTracks: number): MediaStream {
  return { getAudioTracks: () => Array.from({ length: audioTracks }) } as unknown as MediaStream;
}

it('shows a muted local preview and confirms when audio is included', () => {
  render(<LocalPreview stream={makeStream(1)} />);
  expect(screen.getByLabelText(/sua prévia/i)).toHaveProperty('muted', true);
  expect(screen.getByText(/vídeo e áudio sendo enviados/i)).toBeVisible();
});

it('warns the broadcaster when the captured stream has no audio track', () => {
  render(<LocalPreview stream={makeStream(0)} />);
  expect(screen.getByText(/vídeo sendo enviado — sem áudio detectado/i)).toBeVisible();
});

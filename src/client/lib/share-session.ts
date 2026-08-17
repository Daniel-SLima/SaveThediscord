import type { ClientMessage } from '../../shared/protocol';

interface ShareSessionOptions {
  selfId: string | undefined;
  capture(): Promise<MediaStream>;
  setLocalStream(stream: MediaStream | undefined): void;
  send(message: Extract<ClientMessage, { type: 'start-share' | 'stop-share' }>): void;
  startMesh(stream: MediaStream): Promise<void>;
  stopMesh(): void;
}

export async function beginScreenShare(options: ShareSessionOptions): Promise<MediaStream> {
  if (!options.selfId) throw new Error('Aguardando a identificação da sala antes de compartilhar.');
  const stream = await options.capture();
  let announced = false;
  try {
    options.setLocalStream(stream);
    options.send({ type: 'start-share' });
    announced = true;
    await options.startMesh(stream);
    return stream;
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    options.stopMesh();
    options.setLocalStream(undefined);
    if (announced) options.send({ type: 'stop-share' });
    throw error;
  }
}

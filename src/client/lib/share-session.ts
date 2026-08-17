interface ShareSessionOptions {
  selfId: string | undefined;
  isCurrent(): boolean;
  capture(): Promise<MediaStream>;
  setLocalStream(stream: MediaStream | undefined): void;
  requestStartShare(): Promise<void>;
  sendStopShare(): void;
  startMesh(stream: MediaStream): Promise<void>;
  stopMesh(): void;
}

export async function beginScreenShare(options: ShareSessionOptions): Promise<MediaStream> {
  if (!options.selfId) throw new Error('Aguardando a identificação da sala antes de compartilhar.');
  if (!options.isCurrent()) throw new Error('Compartilhamento cancelado porque a conexão mudou.');
  let accepted = false;
  let stream: MediaStream | undefined;
  try {
    await options.requestStartShare();
    accepted = true;
    if (!options.isCurrent()) throw new Error('Compartilhamento cancelado porque a conexão mudou.');
    stream = await options.capture();
    if (!options.isCurrent()) throw new Error('Compartilhamento cancelado porque a conexão mudou.');
    options.setLocalStream(stream);
    await options.startMesh(stream);
    if (!options.isCurrent()) throw new Error('Compartilhamento cancelado porque a conexão mudou.');
    return stream;
  } catch (error) {
    if (accepted) {
      stream?.getTracks().forEach((track) => track.stop());
      options.stopMesh();
      options.setLocalStream(undefined);
      options.sendStopShare();
    }
    throw error;
  }
}

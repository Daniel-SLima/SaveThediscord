interface ShareSessionOptions {
  selfId: string | undefined;
  capture(): Promise<MediaStream>;
  setLocalStream(stream: MediaStream | undefined): void;
  requestStartShare(): Promise<void>;
  sendStopShare(): void;
  startMesh(stream: MediaStream): Promise<void>;
  stopMesh(): void;
}

export async function beginScreenShare(options: ShareSessionOptions): Promise<MediaStream> {
  if (!options.selfId) throw new Error('Aguardando a identificação da sala antes de compartilhar.');
  let accepted = false;
  let stream: MediaStream | undefined;
  try {
    await options.requestStartShare();
    accepted = true;
    stream = await options.capture();
    options.setLocalStream(stream);
    await options.startMesh(stream);
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

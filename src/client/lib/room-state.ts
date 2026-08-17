export function removeRemoteStream(streams: Map<string, MediaStream>, participantId: string): Map<string, MediaStream> {
  const next = new Map(streams);
  next.delete(participantId);
  return next;
}

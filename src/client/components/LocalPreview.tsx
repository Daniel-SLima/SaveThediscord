import { useEffect, useRef } from 'react';

export function LocalPreview({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement>(null);
  const hasAudio = stream.getAudioTracks().length > 0;
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  return <article className="stream-tile local-preview">
    <video ref={video} aria-label="Sua prévia" autoPlay muted playsInline />
    <div className="stream-toolbar"><span>Você (prévia)</span><strong className={hasAudio ? 'stream-status ready' : 'stream-status warning'}>{hasAudio ? 'Vídeo e áudio sendo enviados' : 'Vídeo sendo enviado — sem áudio detectado'}</strong></div>
  </article>;
}

import { useEffect, useRef, useState } from 'react';

export function StreamTile({ stream, name }: { stream: MediaStream; name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (video.current) { video.current.volume = volume / 100; video.current.muted = muted; } }, [volume, muted]);
  const fullscreen = () => video.current?.closest<HTMLElement>('.stream-tile')?.requestFullscreen?.().catch(() => undefined);
  return <article className="stream-tile"><video ref={video} aria-label={`Transmissão de ${name}`} autoPlay playsInline /><div className="stream-toolbar"><span>{name}</span><button onClick={fullscreen}>Tela cheia</button><button aria-label={`Silenciar ${name}`} onClick={() => setMuted((value) => !value)}>{muted ? 'Ativar som' : 'Silenciar'}</button><label>Volume de {name}<input aria-label={`Volume de ${name}`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div></article>;
}

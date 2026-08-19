import { useEffect, useRef, useState } from 'react';

export function StreamTile({ stream, name }: { stream: MediaStream; name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const tile = useRef<HTMLElement>(null);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (video.current) { video.current.volume = volume / 100; video.current.muted = muted; } }, [volume, muted]);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === tile.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  useEffect(() => {
    if (!isFullscreen) return;
    const timer = window.setTimeout(() => setControlsVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, isFullscreen]);
  const showControls = () => { if (isFullscreen) setControlsVisible(true); };
  const fullscreen = async () => {
    try {
      if (isFullscreen || document.fullscreenElement === tile.current) {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      } else {
        await tile.current?.requestFullscreen?.();
        setIsFullscreen(true);
        setControlsVisible(true);
      }
    } catch { setIsFullscreen(false); }
  };
  return <article ref={tile} className={`stream-tile${isFullscreen ? ' fullscreen-active' : ''}`} onMouseMove={showControls} onFocusCapture={showControls}>
    <video ref={video} aria-label={`Transmissão de ${name}`} autoPlay playsInline onWaiting={() => setIsBuffering(true)} onStalled={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
    {isBuffering && <p className="stream-loading" role="status">Conexão instável — aguardando o vídeo ao vivo</p>}
    <div className={`stream-toolbar${isFullscreen && !controlsVisible ? ' hidden' : ''}`}><span>{name}</span><button onClick={fullscreen}>{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button><button aria-label={`Silenciar ${name}`} onClick={() => setMuted((value) => !value)}>{muted ? 'Ativar som' : 'Silenciar'}</button><label>Volume de {name}<input aria-label={`Volume de ${name}`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
  </article>;
}

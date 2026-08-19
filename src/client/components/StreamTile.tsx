import { useEffect, useRef, useState } from 'react';

type PresentationMode = 'normal' | 'native' | 'cinema';

export function StreamTile({ stream, name }: { stream: MediaStream; name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const tile = useRef<HTMLElement>(null);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [presentation, setPresentation] = useState<PresentationMode>('normal');
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (video.current) { video.current.volume = volume / 100; video.current.muted = muted; } }, [volume, muted]);
  useEffect(() => {
    const syncFullscreen = () => setPresentation((current) => document.fullscreenElement === tile.current ? 'native' : current === 'native' ? 'normal' : current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  useEffect(() => {
    if (presentation !== 'cinema') return;
    const leaveCinema = (event: KeyboardEvent) => { if (event.key === 'Escape') setPresentation('normal'); };
    document.addEventListener('keydown', leaveCinema);
    return () => document.removeEventListener('keydown', leaveCinema);
  }, [presentation]);
  useEffect(() => {
    if (presentation === 'normal') return;
    const timer = window.setTimeout(() => setControlsVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, presentation]);
  const showControls = () => { if (presentation !== 'normal') setControlsVisible(true); };
  const fullscreen = async () => {
    if (presentation === 'cinema') { setPresentation('normal'); return; }
    try {
      if (document.fullscreenElement === tile.current) {
        await document.exitFullscreen?.();
      } else {
        await tile.current?.requestFullscreen?.();
        setPresentation(document.fullscreenElement === tile.current ? 'native' : 'cinema');
        setControlsVisible(true);
      }
    } catch { setPresentation('cinema'); setControlsVisible(true); }
  };
  const immersive = presentation !== 'normal';
  return <article ref={tile} className={`stream-tile${immersive ? ' fullscreen-active' : ''}${presentation === 'cinema' ? ' cinema-mode' : ''}`} onMouseMove={showControls} onFocusCapture={showControls}>
    <video ref={video} aria-label={`Transmissão de ${name}`} autoPlay playsInline onWaiting={() => setIsBuffering(true)} onStalled={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
    {presentation === 'cinema' && <p className="cinema-notice">Modo cinema ativado</p>}
    {isBuffering && <p className="stream-loading" role="status">Conexão instável — aguardando o vídeo ao vivo</p>}
    <div className={`stream-toolbar${immersive && !controlsVisible ? ' hidden' : ''}`}><span>{name}</span><button onClick={fullscreen}>{immersive ? 'Sair da tela cheia' : 'Tela cheia'}</button><button aria-label={`Silenciar ${name}`} onClick={() => setMuted((value) => !value)}>{muted ? 'Ativar som' : 'Silenciar'}</button><label>Volume de {name}<input aria-label={`Volume de ${name}`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
  </article>;
}

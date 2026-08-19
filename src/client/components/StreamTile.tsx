import { useEffect, useRef, useState } from 'react';

type PresentationMode = 'normal' | 'native' | 'cinema';

function FullscreenIcon({ exit }: { exit: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d={exit ? 'M8 3v5H3m13-5v5h5M8 21v-5H3m18 0h-5v5' : 'M8 3H3v5m18-5h-5v5M3 16h5v5m8 0v-5h5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 10v4h4l5 4V6l-5 4H4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />{muted ? <path d="m17 9 4 4m0-4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>;
}

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
    {isBuffering && <p className="stream-loading" role="status">Reconectando vídeo…</p>}
    <div className={`stream-toolbar${immersive && !controlsVisible ? ' hidden' : ''}`}><span>{name}</span><button className="icon-button" onClick={fullscreen} aria-label={immersive ? 'Sair da tela cheia' : 'Tela cheia'} title={immersive ? 'Sair da tela cheia' : 'Tela cheia'}><FullscreenIcon exit={immersive} /></button><button className="icon-button" aria-label={muted ? `Ativar som de ${name}` : `Silenciar ${name}`} title={muted ? 'Ativar som' : 'Silenciar'} aria-pressed={muted} onClick={() => setMuted((value) => !value)}><VolumeIcon muted={muted} /></button><label className="volume-control"><VolumeIcon muted={muted} /><span className="sr-only">Volume de {name}</span><input aria-label={`Volume de ${name}`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
  </article>;
}

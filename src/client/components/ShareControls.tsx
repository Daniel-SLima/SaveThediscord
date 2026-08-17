export function ShareControls({ sharing, onStart, onStop }: { sharing: boolean; onStart(): void; onStop?(): void }) {
  return <section className="share-controls" aria-label="Controles de compartilhamento"><button onClick={sharing ? onStop : onStart}>{sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}</button>{!sharing && <p><strong>Atenção:</strong> o áudio de todo o sistema pode incluir o Discord. O áudio de uma aba é mais seguro; escolha-o no seletor do navegador quando disponível.</p>}</section>;
}

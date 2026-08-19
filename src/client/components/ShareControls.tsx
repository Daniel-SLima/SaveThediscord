export function ShareControls({ sharing, disabled = false, blockedBy, onStart, onStop }: { sharing: boolean; disabled?: boolean; blockedBy?: string; onStart(): void; onStop?(): void }) {
  const blocked = Boolean(blockedBy) && !sharing;
  return <section className="share-controls" aria-label="Controles de compartilhamento"><button disabled={disabled || blocked} onClick={sharing ? onStop : onStart}>{sharing ? 'Parar compartilhamento' : blockedBy ? `${blockedBy} está compartilhando` : 'Compartilhar tela'}</button>{blocked ? <p>Aguarde {blockedBy} parar o compartilhamento para transmitir.</p> : !sharing && <p><strong>Atenção:</strong> o áudio de todo o sistema pode incluir o Discord. O áudio de uma aba é mais seguro; escolha-o no seletor do navegador quando disponível.</p>}</section>;
}

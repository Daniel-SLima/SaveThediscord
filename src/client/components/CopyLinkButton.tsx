import { useState } from 'react';

export function CopyLinkButton({ url, onError }: { url: string; onError(message: string): void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      onError('Não foi possível copiar o link.');
    }
  };
  return <button onClick={() => void copy()}>{copied ? 'Link copiado ✓' : 'Copiar link'}</button>;
}

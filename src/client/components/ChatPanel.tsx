import { FormEvent, useState } from 'react';

export interface ChatLine { id: string; author: string; text: string; }

export function ChatPanel({ messages, onSend }: { messages: ChatLine[]; onSend(text: string): void }) {
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText('');
  };
  return <aside className="chat-panel"><h2>Chat</h2><div className="messages">{messages.map((message) => <p key={message.id}><strong>{message.author}</strong> {message.text}</p>)}</div><form onSubmit={submit}><label htmlFor="chat-message">Mensagem</label><input id="chat-message" value={text} maxLength={500} onChange={(event) => setText(event.target.value)} /><button>Enviar</button></form></aside>;
}

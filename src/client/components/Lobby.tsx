import { FormEvent, useState } from 'react';

export function Lobby({ roomId, onCreate, onJoin }: { roomId?: string; onCreate(name: string): void; onJoin(roomId: string, name: string): void }) {
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    roomId ? onJoin(roomId, cleanName) : onCreate(cleanName);
  };
  return <main className="lobby"><section className="card"><p className="eyebrow">SAVE THE DISCORD</p><h1>Compartilhe sua tela</h1><p>Uma sala privada, temporária e direta entre amigos.</p><form onSubmit={submit}><label htmlFor="nickname">Apelido</label><input id="nickname" value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Como quer aparecer?" autoFocus required /><button type="submit">{roomId ? 'Entrar na sala' : 'Criar sala'}</button></form>{roomId && <p className="room-code">Você está entrando em uma sala por link.</p>}</section></main>;
}

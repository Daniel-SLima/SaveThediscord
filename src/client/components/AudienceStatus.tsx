export function AudienceStatus({ totalParticipants }: { totalParticipants: number }) {
  const guests = Math.max(0, totalParticipants - 1);
  if (guests === 0) return <p className="audience-status">Nenhum convidado conectado.</p>;
  return <p className="audience-status">{guests} {guests === 1 ? 'convidado assistindo.' : 'convidados assistindo.'}</p>;
}

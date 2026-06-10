// eslint-disable-next-line no-unused-vars
export default function NucleoDetailPage({ nucleo, user, userTransactions, onBack }) {
  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={onBack}>← Indietro</button>
      <h2>{nucleo.name} — in costruzione</h2>
    </div>
  );
}

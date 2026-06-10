import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './NucleoDetailPage.css';

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

function StoricoModal({ nucleo, user, userTransactions, nucleoTransactions, onClose }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const sharedIds = new Set(nucleoTransactions.map((t) => t.originalTxId));
  const available = userTransactions.filter((t) => t.type !== 'transfer' && !sharedIds.has(t.id));

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAdd = async () => {
    if (!selected.length) return;
    setSaving(true);
    setSaveError('');
    try {
      for (const txId of selected) {
        const tx = userTransactions.find((t) => t.id === txId);
        if (!tx) continue;
        await addDoc(collection(db, 'nuclei', nucleo.id, 'transactions'), {
          originalTxId: tx.id,
          ownerUid: user.uid,
          ownerName: user.displayName,
          amount: tx.amount,
          category: tx.category,
          description: tx.description || '',
          date: tx.date,
          type: tx.type,
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch {
      setSaveError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="storico-overlay" onClick={onClose}>
      <div className="storico-modal" onClick={(e) => e.stopPropagation()}>
        <div className="storico-modal-header">
          <span>Aggiungi dal tuo storico</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="storico-modal-body">
          {available.length === 0 && (
            <p className="storico-empty">Tutte le tue transazioni sono già condivise in questo nucleo.</p>
          )}
          {available.map((tx) => (
            <div
              key={tx.id}
              className={`storico-item ${selected.includes(tx.id) ? 'selected' : ''}`}
              onClick={() => toggle(tx.id)}
            >
              <div className={`tx-dot ${tx.type}`} />
              <div className="storico-info">
                <span className="s-cat">{tx.category}</span>
                <span className="s-meta">
                  {tx.description ? `${tx.description} · ` : ''}{fmtDate(tx.date)}
                </span>
              </div>
              <span className={`s-amt ${tx.type}`}>
                {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
              </span>
              <div className={`s-check ${selected.includes(tx.id) ? 'checked' : ''}`}>✓</div>
            </div>
          ))}
        </div>
        {saveError && <p className="storico-error">{saveError}</p>}
        {selected.length > 0 && (
          <div className="storico-modal-footer">
            <button onClick={handleAdd} disabled={saving}>
              {saving
                ? 'Aggiunta in corso...'
                : `Aggiungi ${selected.length} transazion${selected.length === 1 ? 'e' : 'i'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NucleoDetailPage({ nucleo, user, userTransactions, onBack }) {
  const [nucleoTx, setNucleoTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStorico, setShowStorico] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'nuclei', nucleo.id, 'transactions'), orderBy('date', 'desc')),
      (snap) => {
        setNucleoTx(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, [nucleo.id]);

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${nucleo.inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: `Unisciti a "${nucleo.name}"`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copiato negli appunti!'));
    }
  };

  const handleDeleteTx = async (txId) => {
    if (!confirm('Rimuovere questa transazione dal nucleo?')) return;
    try {
      await deleteDoc(doc(db, 'nuclei', nucleo.id, 'transactions', txId));
    } catch {
      alert('Errore durante la rimozione. Riprova.');
    }
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const memberSummary = {};
  nucleoTx
    .filter((t) => t.type === 'expense' && t.date && t.date.startsWith(currentMonth))
    .forEach((t) => {
      memberSummary[t.ownerName] = (memberSummary[t.ownerName] || 0) + t.amount;
    });

  return (
    <div className="nucleo-detail">
      <button className="btn-back-nucleo" onClick={onBack}>← I tuoi nuclei</button>

      <div className="nucleo-detail-header">
        <h2>👥 {nucleo.name}</h2>
        <button className="btn-share-nucleo" onClick={handleShare}>⬆ Condividi</button>
      </div>

      {Object.keys(memberSummary).length > 0 && (
        <div className="member-summary-card">
          <div className="member-summary-title">Uscite questo mese</div>
          {Object.entries(memberSummary)
            .sort(([, a], [, b]) => b - a)
            .map(([name, total]) => (
              <div key={name} className="member-summary-row">
                <span className="member-name">{name}</span>
                <span className="member-total">−{fmt(total)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="nucleo-tx-header">
        <span className="nucleo-tx-title">Transazioni condivise</span>
        <button className="btn-add-storico" onClick={() => setShowStorico(true)}>
          + Storico
        </button>
      </div>

      {loading && <p className="nd-empty">Caricamento...</p>}
      {!loading && nucleoTx.length === 0 && (
        <p className="nd-empty">
          Nessuna transazione condivisa. Spunta un nucleo nel form di inserimento, oppure aggiungi dal tuo storico.
        </p>
      )}

      <ul className="nucleo-tx-list">
        {nucleoTx.map((tx) => (
          <li key={tx.id} className="nucleo-tx-item">
            <div className={`tx-dot ${tx.type}`} />
            <div className="nucleo-tx-info">
              <span className="tx-category">{tx.category}</span>
              {tx.description && <span className="tx-desc">{tx.description}</span>}
              <span className="tx-owner">{tx.ownerName} · {fmtDate(tx.date)}</span>
            </div>
            <span className={`tx-amount ${tx.type}`}>
              {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
            </span>
            {tx.ownerUid === user.uid && (
              <button className="tx-delete" onClick={() => handleDeleteTx(tx.id)} title="Rimuovi dal nucleo">×</button>
            )}
          </li>
        ))}
      </ul>

      {showStorico && (
        <StoricoModal
          nucleo={nucleo}
          user={user}
          userTransactions={userTransactions}
          nucleoTransactions={nucleoTx}
          onClose={() => setShowStorico(false)}
        />
      )}
    </div>
  );
}

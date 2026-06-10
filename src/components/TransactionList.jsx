import { useState } from 'react';
import { deleteDoc, doc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { exportCsv } from '../utils/exportCsv';
import './TransactionList.css';

const INITIAL_LIMIT = 5;

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

export default function TransactionList({ transactions, loading, nuclei = [] }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questa transazione' + (nuclei.length > 0 ? ' e tutte le copie condivise nei nuclei?' : '?'))) return;
    setDeletingId(id);
    try {
      // Delete from nuclei first (so a failure leaves the personal record intact = retryable)
      const snaps = await Promise.all(
        nuclei.map((n) =>
          getDocs(
            query(
              collection(db, 'nuclei', n.id, 'transactions'),
              where('originalTxId', '==', id),
              where('ownerUid', '==', user.uid)
            )
          )
        )
      );
      const refs = snaps.flatMap((s) => s.docs.map((docSnap) => docSnap.ref));
      await Promise.all(refs.map((ref) => deleteDoc(ref)));
      // Only delete personal record after all copies are removed
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
    } catch (err) {
      console.error('Errore eliminazione:', err);
      alert('Errore durante l\'eliminazione. Riprova.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="list-card"><p className="empty">Caricamento...</p></div>;
  if (!transactions.length) return <div className="list-card"><p className="empty">Nessuna transazione.</p></div>;

  const total = transactions.reduce((s, t) => {
    if (t.type === 'transfer') return s;
    return s + (t.type === 'expense' ? -t.amount : t.amount);
  }, 0);
  const visible = expanded ? transactions : transactions.slice(0, INITIAL_LIMIT);
  const hasMore = transactions.length > INITIAL_LIMIT;

  return (
    <div className="list-card">
      <div className="list-header">
        <h2>Transazioni</h2>
        <button className="btn-export-csv" onClick={() => exportCsv(transactions)} title="Esporta CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13M7 11l5 5 5-5"/>
            <path d="M5 21h14"/>
          </svg>
          CSV
        </button>
      </div>
      <ul className="tx-list">
        {visible.map((tx) => (
          <li key={tx.id} className="tx-item">
            <div className={`tx-dot ${tx.type}`} />
            <div className="tx-info">
              <span className="tx-category">{tx.category}</span>
              {tx.type === 'transfer'
                ? <span className="tx-desc">↔ {tx.fromWalletName} → {tx.walletName}</span>
                : tx.description && <span className="tx-desc">{tx.description}</span>
              }
            </div>
            <span className="tx-date">{fmtDate(tx.date)}</span>
            <span className={`tx-amount ${tx.type}`}>
              {tx.type === 'transfer' ? '↔' : tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount)}
            </span>
            <button className="tx-delete" onClick={() => handleDelete(tx.id)} disabled={deletingId === tx.id} title="Elimina">×</button>
          </li>
        ))}
      </ul>
      <div className="tx-footer">
        <span>Totale</span>
        <span className={total >= 0 ? 'income' : 'expense'}>{total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}</span>
      </div>
      {hasMore && (
        <button className="btn-show-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Visualizza meno' : `Visualizza altro (${transactions.length - INITIAL_LIMIT})`}
        </button>
      )}
    </div>
  );
}

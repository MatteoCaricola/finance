import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './TransactionList.css';

const INITIAL_LIMIT = 5;

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

export default function TransactionList({ transactions, loading }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questa transazione?')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
  };

  if (loading) return <div className="list-card"><p className="empty">Caricamento...</p></div>;
  if (!transactions.length) return <div className="list-card"><p className="empty">Nessuna transazione.</p></div>;

  const total = transactions.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
  const visible = expanded ? transactions : transactions.slice(0, INITIAL_LIMIT);
  const hasMore = transactions.length > INITIAL_LIMIT;

  return (
    <div className="list-card">
      <h2>Transazioni</h2>
      <ul className="tx-list">
        {visible.map((tx) => (
          <li key={tx.id} className="tx-item">
            <div className={`tx-dot ${tx.type}`} />
            <div className="tx-info">
              <span className="tx-category">{tx.category}</span>
              {tx.description && <span className="tx-desc">{tx.description}</span>}
            </div>
            <span className="tx-date">{fmtDate(tx.date)}</span>
            <span className={`tx-amount ${tx.type}`}>
              {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount)}
            </span>
            <button className="tx-delete" onClick={() => handleDelete(tx.id)} title="Elimina">×</button>
          </li>
        ))}
      </ul>
      <div className="tx-footer">
        <span>Totale</span>
        <span className={total >= 0 ? 'income' : 'expense'}>{total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}</span>
      </div>
      {hasMore && !expanded && (
        <button className="btn-show-more" onClick={() => setExpanded(true)}>
          Visualizza altro ({transactions.length - INITIAL_LIMIT})
        </button>
      )}
    </div>
  );
}

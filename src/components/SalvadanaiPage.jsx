import { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './SalvadanaiPage.css';

const EMOJIS = ['🏦','💵','📱','💳','🐷','🏠','✈️','🎓','🛒','💼'];

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

export default function SalvadanaiPage({ wallets, transactions }) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏦');
  const [newInitial, setNewInitial] = useState('');
  const [expanded, setExpanded] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'wallets'), {
      name: newName.trim(),
      emoji: newEmoji,
      initialBalance: newInitial !== '' ? parseFloat(newInitial) : 0,
      createdAt: serverTimestamp(),
    });
    setNewName('');
    setNewEmoji('🏦');
    setNewInitial('');
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo salvadanaio? Le transazioni associate resteranno nei movimenti.')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'wallets', id));
  };

  const walletTransactions = (wId) => {
    const inflows  = transactions.filter((t) => t.walletId === wId).map((t) => ({ ...t, _dir: 'in' }));
    const outflows = transactions.filter((t) => t.fromWalletId === wId).map((t) => ({ ...t, _dir: 'out' }));
    return [...inflows, ...outflows].sort((a, b) => b.date.localeCompare(a.date));
  };

  const walletBalance = (wallet) => {
    const initial  = wallet.initialBalance ?? 0;
    const inflows  = transactions.filter((t) => t.walletId === wallet.id).reduce((s, t) => s + t.amount, 0);
    const outflows = transactions.filter((t) => t.fromWalletId === wallet.id).reduce((s, t) => s + t.amount, 0);
    return initial + inflows - outflows;
  };

  return (
    <div className="salvadanai-page">
      <div className="salvadanai-header">
        <h1>Salvadanai</h1>
        <button className="btn-new" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Annulla' : '+ Nuovo'}
        </button>
      </div>

      {creating && (
        <form className="create-form" onSubmit={handleCreate}>
          <div className="emoji-picker">
            {EMOJIS.map((e) => (
              <button
                key={e} type="button"
                className={`emoji-btn ${newEmoji === e ? 'active' : ''}`}
                onClick={() => setNewEmoji(e)}
              >{e}</button>
            ))}
          </div>
          <div className="create-row">
            <input
              type="text"
              placeholder="Nome (es. Contanti, Satispay...)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Saldo iniziale €"
              value={newInitial}
              onChange={(e) => setNewInitial(e.target.value)}
              className="input-initial"
            />
            <button type="submit" className="btn-save-wallet">Crea</button>
          </div>
        </form>
      )}

      {wallets.length === 0 && !creating && (
        <p className="empty-wallets">Nessun salvadanaio ancora. Creane uno!</p>
      )}

      <div className="wallets-list">
        {wallets.map((w) => {
          const balance = walletBalance(w);
          const txs = walletTransactions(w.id);
          const isOpen = expanded === w.id;

          return (
            <div key={w.id} className="wallet-card">
              <div className="wallet-header" onClick={() => setExpanded(isOpen ? null : w.id)}>
                <div className="wallet-info">
                  <span className="wallet-emoji">{w.emoji}</span>
                  <div>
                    <span className="wallet-name">{w.name}</span>
                    <span className="wallet-count">{txs.length} movimenti</span>
                  </div>
                </div>
                <div className="wallet-right">
                  <span className="wallet-balance">{fmt(balance)}</span>
                  <span className="wallet-arrow">{isOpen ? '▲' : '▼'}</span>
                  <button
                    className="wallet-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                    title="Elimina"
                  >×</button>
                </div>
              </div>

              {isOpen && (
                <div className="wallet-transactions">
                  {txs.length === 0
                    ? <p className="empty-tx">Nessun movimento.</p>
                    : txs.map((tx) => {
                      const isOut = tx._dir === 'out';
                      const counterpart = isOut ? tx.walletName : tx.fromWalletName;
                      return (
                        <div key={tx.id + tx._dir} className="wallet-tx">
                          <div className="wallet-tx-info">
                            <span className="wallet-tx-cat">{tx.category}</span>
                            {counterpart && (
                              <span className="wallet-tx-desc">
                                {isOut ? `→ ${counterpart}` : `← ${counterpart}`}
                              </span>
                            )}
                            {!counterpart && tx.description && (
                              <span className="wallet-tx-desc">{tx.description}</span>
                            )}
                          </div>
                          <span className="wallet-tx-date">{fmtDate(tx.date)}</span>
                          <span className={`wallet-tx-amount ${isOut ? 'out' : ''}`}>
                            {isOut ? '−' : '+'}{fmt(tx.amount)}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

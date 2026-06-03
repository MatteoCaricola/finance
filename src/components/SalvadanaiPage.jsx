import { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './SalvadanaiPage.css';

const EMOJIS = ['🏦','💵','📱','💳','🐷','🏠','✈️','🎓','🛒','💼'];

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

function GoalBar({ balance, goal }) {
  if (!goal || goal <= 0) return null;
  const pct = Math.min((balance / goal) * 100, 100);
  const reached = balance >= goal;
  const color = reached ? '#10b981' : pct >= 80 ? '#f59e0b' : '#6366f1';
  return (
    <div className="goal-bar-wrapper">
      <div className="goal-bar-track">
        <div className="goal-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="goal-bar-labels">
        <span style={{ color }}>{reached ? '🎉 Obiettivo raggiunto!' : `${Math.round(pct)}% di ${fmt(goal)}`}</span>
        <span className="goal-remaining">{!reached && `Mancano ${fmt(goal - balance)}`}</span>
      </div>
    </div>
  );
}

export default function SalvadanaiPage({ wallets, transactions }) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏦');
  const [newInitial, setNewInitial] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalInput, setGoalInput] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'wallets'), {
      name: newName.trim(),
      emoji: newEmoji,
      initialBalance: newInitial !== '' ? parseFloat(newInitial) : 0,
      goal: newGoal !== '' ? parseFloat(newGoal) : null,
      createdAt: serverTimestamp(),
    });
    setNewName(''); setNewEmoji('🏦'); setNewInitial(''); setNewGoal('');
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo salvadanaio? Le transazioni associate resteranno nei movimenti.')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'wallets', id));
  };

  const startEditGoal = (w) => {
    setEditingGoal(w.id);
    setGoalInput(w.goal ?? '');
  };

  const saveGoal = async (id) => {
    await updateDoc(doc(db, 'users', user.uid, 'wallets', id), {
      goal: goalInput !== '' ? parseFloat(goalInput) : null,
    });
    setEditingGoal(null);
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
              <button key={e} type="button"
                className={`emoji-btn ${newEmoji === e ? 'active' : ''}`}
                onClick={() => setNewEmoji(e)}
              >{e}</button>
            ))}
          </div>
          <div className="create-row">
            <input type="text" placeholder="Nome (es. Contanti, Satispay...)"
              value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
            <input type="number" min="0" step="0.01" placeholder="Saldo iniziale €"
              value={newInitial} onChange={(e) => setNewInitial(e.target.value)} className="input-initial" />
            <input type="number" min="0" step="0.01" placeholder="Obiettivo € (opz.)"
              value={newGoal} onChange={(e) => setNewGoal(e.target.value)} className="input-initial" />
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
                  <button className="btn-goal-edit" title="Imposta obiettivo"
                    onClick={(e) => { e.stopPropagation(); startEditGoal(w); }}>🎯</button>
                  <span className="wallet-arrow">{isOpen ? '▲' : '▼'}</span>
                  <button className="wallet-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }} title="Elimina">×</button>
                </div>
              </div>

              {editingGoal === w.id && (
                <div className="goal-edit-row" onClick={(e) => e.stopPropagation()}>
                  <label>Obiettivo (€)</label>
                  <input type="number" min="0" step="0.01" placeholder="es. 1500"
                    value={goalInput} onChange={(e) => setGoalInput(e.target.value)} autoFocus />
                  <button className="btn-save-wallet" onClick={() => saveGoal(w.id)}>Salva</button>
                  <button className="btn-cancel" onClick={() => setEditingGoal(null)}>Annulla</button>
                </div>
              )}

              <GoalBar balance={balance} goal={w.goal} />

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
                            {counterpart && <span className="wallet-tx-desc">{isOut ? `→ ${counterpart}` : `← ${counterpart}`}</span>}
                            {!counterpart && tx.description && <span className="wallet-tx-desc">{tx.description}</span>}
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

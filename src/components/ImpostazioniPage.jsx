import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getPushStatus, subscribeAndSave, unsubscribeAndRemove } from '../utils/pushNotifications';
import './ImpostazioniPage.css';

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const fmtAmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const DAYS_OF_WEEK = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const freqLabel = (r) => {
  if (r.frequency === 'daily') return 'ogni giorno';
  if (r.frequency === 'weekly') return `ogni ${DAYS_OF_WEEK[r.dayOfWeek] ?? ''}`;
  return `giorno ${r.dayOfMonth} del mese`;
};

export default function ImpostazioniPage({ categoriesIncome, categoriesExpense, budgets, onBudgetsChange, recurring = [], onDeleteRecurring, transactions = [] }) {
  const { user } = useAuth();
  const [newIncome, setNewIncome] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [saving, setSaving] = useState(false);

  const [newBudgetCat, setNewBudgetCat] = useState('');
  const [newBudgetAmt, setNewBudgetAmt] = useState('');
  const [pushStatus, setPushStatus] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getPushStatus().then(setPushStatus);
  }, []);

  const saveCategories = async (income, expense) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), { income, expense });
    } finally {
      setSaving(false);
    }
  };

  const saveBudgets = async (updated) => {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'budgets'), updated);
    onBudgetsChange?.(updated);
  };

  const addCategory = async (type) => {
    const value = type === 'income' ? newIncome.trim() : newExpense.trim();
    if (!value) return;
    if (type === 'income') {
      if (categoriesIncome.includes(value)) return;
      await saveCategories([...categoriesIncome, value], categoriesExpense);
      setNewIncome('');
    } else {
      if (categoriesExpense.includes(value)) return;
      await saveCategories(categoriesIncome, [...categoriesExpense, value]);
      setNewExpense('');
    }
  };

  const removeCategory = (type, cat) => {
    if (type === 'income') saveCategories(categoriesIncome.filter((c) => c !== cat), categoriesExpense);
    else saveCategories(categoriesIncome, categoriesExpense.filter((c) => c !== cat));
  };

  const handleKey = (e, type) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(type); }
  };

  const addBudget = () => {
    if (!newBudgetCat || !newBudgetAmt) return;
    const updated = { ...budgets, [newBudgetCat]: parseFloat(newBudgetAmt) };
    saveBudgets(updated);
    setNewBudgetCat('');
    setNewBudgetAmt('');
  };

  const removeBudget = (cat) => {
    const updated = { ...budgets };
    delete updated[cat];
    saveBudgets(updated);
  };

  const categoriesWithoutBudget = categoriesExpense.filter((c) => !(c in budgets));
  const budgetEntries = Object.entries(budgets).filter(([, v]) => v > 0);

  return (
    <div className="impostazioni-page">
      <h2>Impostazioni</h2>

      <div className="cat-grid">
        <div className="cat-panel">
          <div className="cat-panel-header income">
            <span className="cat-panel-dot" />
            Categorie Entrate
          </div>
          <div className="cat-list">
            {categoriesIncome.map((cat) => (
              <div key={cat} className="cat-item">
                <span>{cat}</span>
                <button className="cat-remove" onClick={() => removeCategory('income', cat)} disabled={saving} title="Rimuovi">×</button>
              </div>
            ))}
          </div>
          <div className="cat-add-row">
            <input type="text" placeholder="Nuova categoria..." value={newIncome}
              onChange={(e) => setNewIncome(e.target.value)} onKeyDown={(e) => handleKey(e, 'income')} maxLength={30} />
            <button className="btn-add income" onClick={() => addCategory('income')} disabled={saving || !newIncome.trim()}>Aggiungi</button>
          </div>
        </div>

        <div className="cat-panel">
          <div className="cat-panel-header expense">
            <span className="cat-panel-dot" />
            Categorie Uscite
          </div>
          <div className="cat-list">
            {categoriesExpense.map((cat) => (
              <div key={cat} className="cat-item">
                <span>{cat}</span>
                <button className="cat-remove" onClick={() => removeCategory('expense', cat)} disabled={saving} title="Rimuovi">×</button>
              </div>
            ))}
          </div>
          <div className="cat-add-row">
            <input type="text" placeholder="Nuova categoria..." value={newExpense}
              onChange={(e) => setNewExpense(e.target.value)} onKeyDown={(e) => handleKey(e, 'expense')} maxLength={30} />
            <button className="btn-add expense" onClick={() => addCategory('expense')} disabled={saving || !newExpense.trim()}>Aggiungi</button>
          </div>
        </div>
      </div>

      <div className="budget-section">
        <h3>Budget mensile per categoria</h3>

        {budgetEntries.length > 0 && (
          <div className="budget-list">
            {budgetEntries.map(([cat, limit]) => (
              <div key={cat} className="budget-list-item">
                <span className="budget-list-cat">{cat}</span>
                <span className="budget-list-amt">{fmt(limit)} / mese</span>
                <button className="budget-remove" onClick={() => removeBudget(cat)} title="Rimuovi">×</button>
              </div>
            ))}
          </div>
        )}

        {categoriesWithoutBudget.length > 0 && (
          <div className="budget-add-form">
            <select value={newBudgetCat} onChange={(e) => setNewBudgetCat(e.target.value)}>
              <option value="">Seleziona categoria...</option>
              {categoriesWithoutBudget.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="budget-input-wrap">
              <span className="budget-euro">€</span>
              <input
                type="number" min="1" step="1" placeholder="Limite"
                value={newBudgetAmt}
                onChange={(e) => setNewBudgetAmt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addBudget(); }}
              />
            </div>
            <button className="btn-add expense" onClick={addBudget} disabled={!newBudgetCat || !newBudgetAmt}>
              Aggiungi
            </button>
          </div>
        )}

        {budgetEntries.length === 0 && categoriesWithoutBudget.length === 0 && (
          <p className="budget-hint">Tutte le categorie hanno già un budget impostato.</p>
        )}
      </div>

      <div className="budget-section">
        <h3>Notifiche</h3>
        {pushStatus === 'unsupported' && (
          <p className="budget-hint">Le notifiche push non sono supportate da questo browser.</p>
        )}
        {pushStatus === 'denied' && (
          <p className="budget-hint">Le notifiche sono bloccate dal browser. Modificale dalle impostazioni del browser.</p>
        )}
        {(pushStatus === 'enabled' || pushStatus === 'disabled' || pushStatus === 'default') && (
          <div className="push-toggle-row">
            <div className="push-status">
              <span className={`push-dot ${pushStatus === 'enabled' ? 'on' : 'off'}`} />
              <span>{pushStatus === 'enabled' ? 'Notifiche abilitate' : 'Notifiche disabilitate'}</span>
            </div>
            <button
              className={`btn-push-toggle ${pushStatus === 'enabled' ? 'disable' : 'enable'}`}
              disabled={pushLoading}
              onClick={async () => {
                setPushLoading(true);
                try {
                  if (pushStatus === 'enabled') {
                    await unsubscribeAndRemove();
                    setPushStatus('disabled');
                  } else {
                    const permission = Notification.permission === 'granted'
                      ? 'granted'
                      : await Notification.requestPermission();
                    if (permission === 'granted') {
                      await subscribeAndSave(user.uid);
                      setPushStatus('enabled');
                    } else {
                      setPushStatus(permission === 'denied' ? 'denied' : 'default');
                    }
                  }
                } catch (err) {
                  console.warn('Push toggle:', err);
                } finally {
                  setPushLoading(false);
                }
              }}
            >
              {pushLoading ? '...' : pushStatus === 'enabled' ? 'Disabilita' : 'Abilita'}
            </button>
          </div>
        )}
      </div>

      <div className="budget-section">
        <h3>Transazioni ricorrenti</h3>
        {recurring.length === 0 ? (
          <p className="budget-hint">Nessuna transazione ricorrente. Aggiungine una spuntando "Ricorrente ogni mese" nel form.</p>
        ) : (
          <div className="budget-list">
            {recurring.map((r) => (
              <div key={r.id} className="budget-list-item">
                <span className={`tx-dot ${r.type}`} style={{ flexShrink: 0 }} />
                <span className="budget-list-cat">{r.category}{r.description ? ` — ${r.description}` : ''}</span>
                <span className="budget-list-amt">{fmtAmt(r.amount)} · {freqLabel(r)}</span>
                <button className="budget-remove" onClick={() => onDeleteRecurring?.(r.id)} title="Elimina">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

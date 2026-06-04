import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './TransactionForm.css';

function CategoryInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="cat-info-wrap">
      <button type="button" className="cat-info-btn" onClick={() => setOpen((v) => !v)} aria-label="Info categorie">i</button>
      {open && (
        <span className="cat-info-popup">
          Puoi creare e modificare le tue categorie dalla sezione <strong>Impostazioni</strong>.
          <button type="button" className="cat-info-close" onClick={() => setOpen(false)}>×</button>
        </span>
      )}
    </span>
  );
}

function WalletInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="cat-info-wrap">
      <button type="button" className="cat-info-btn" onClick={() => setOpen((v) => !v)} aria-label="Info salvadanaio">i</button>
      {open && (
        <span className="cat-info-popup">
          Seleziona da quale salvadanaio prelevare i soldi. Se lasci vuoto, il movimento verrà registrato sui <strong>fondi generali</strong>.
          <button type="button" className="cat-info-close" onClick={() => setOpen(false)}>×</button>
        </span>
      )}
    </span>
  );
}

const today = () => new Date().toISOString().split('T')[0];
const todayDayOfWeek = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };
const todayDayOfMonth = () => new Date().getDate();

const DAYS_OF_WEEK = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function TransactionForm({ onAdded, wallets = [], categoriesIncome = [], categoriesExpense = [] }) {
  const { user } = useAuth();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [isMovement, setIsMovement] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [fromWalletId, setFromWalletId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');
  const [recurringDayOfWeek, setRecurringDayOfWeek] = useState(todayDayOfWeek);
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(todayDayOfMonth);

  const categories = type === 'income' ? categoriesIncome : categoriesExpense;
  const isTransfer = isMovement && walletId && fromWalletId;

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory('');
    if (newType !== 'expense') { setIsMovement(false); setWalletId(''); setFromWalletId(''); }
  };

  const handleMovementToggle = (e) => {
    setIsMovement(e.target.checked);
    if (e.target.checked) { setIsRecurring(false); }
    else { setWalletId(''); setFromWalletId(''); }
  };

  const handleRecurringToggle = (e) => {
    setIsRecurring(e.target.checked);
    if (e.target.checked) { setIsMovement(false); setWalletId(''); setFromWalletId(''); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category || !date) return;
    if (isMovement && !walletId) return;
    if (isTransfer && fromWalletId === walletId) return;
    setLoading(true);
    try {
      const data = {
        type: isTransfer ? 'transfer' : type,
        amount: parseFloat(amount),
        category,
        description,
        date,
        createdAt: serverTimestamp(),
      };
      if (isMovement && walletId) {
        const toWallet = wallets.find((w) => w.id === walletId);
        data.walletId = walletId;
        data.walletName = toWallet?.name ?? '';
      }
      if (fromWalletId) {
        const fromWallet = wallets.find((w) => w.id === fromWalletId);
        data.fromWalletId = fromWalletId;
        data.fromWalletName = fromWallet?.name ?? '';
      }
      await addDoc(collection(db, 'users', user.uid, 'transactions'), data);

      if (isRecurring) {
        await addDoc(collection(db, 'users', user.uid, 'recurring'), {
          type,
          amount: parseFloat(amount),
          category,
          description,
          frequency: recurringFrequency,
          dayOfWeek: recurringFrequency === 'weekly' ? recurringDayOfWeek : null,
          dayOfMonth: recurringFrequency === 'monthly' ? recurringDayOfMonth : null,
          lastAddedDate: recurringFrequency !== 'monthly' ? date : null,
          lastAddedMonth: recurringFrequency === 'monthly' ? date.slice(0, 7) : null,
          createdAt: serverTimestamp(),
        });
      }

      setAmount('');
      setDescription('');
      setCategory('');
      setDate(today());
      setIsMovement(false);
      setWalletId('');
      setFromWalletId('');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setRecurringDayOfWeek(todayDayOfWeek());
      setRecurringDayOfMonth(todayDayOfMonth());
      onAdded?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-card">
      <h2>Nuova transazione</h2>
      <form onSubmit={handleSubmit}>
        <div className="type-toggle">
          <button
            type="button"
            className={type === 'expense' ? 'active expense' : ''}
            onClick={() => handleTypeChange('expense')}
          >
            Uscita
          </button>
          <button
            type="button"
            className={type === 'income' ? 'active income' : ''}
            onClick={() => handleTypeChange('income')}
          >
            Entrata
          </button>
        </div>

        {!isMovement && (
          <div className="recurring-section">
            <label className="checkbox-label">
              <input type="checkbox" checked={isRecurring} onChange={handleRecurringToggle} />
              Ricorrente
            </label>

            {isRecurring && (
              <div className="recurring-options">
                <div className="cadenza-row">
                  <span className="cadenza-label">Cadenza</span>
                  <select
                    className="cadenza-select"
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value)}
                  >
                    <option value="daily">Ogni giorno</option>
                    <option value="weekly">Ogni settimana</option>
                    <option value="monthly">Ogni mese</option>
                  </select>
                </div>

                {recurringFrequency === 'weekly' && (
                  <div className="cadenza-row">
                    <span className="cadenza-label">Giorno</span>
                    <select
                      className="cadenza-select"
                      value={recurringDayOfWeek}
                      onChange={(e) => setRecurringDayOfWeek(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK.slice(1).map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {recurringFrequency === 'monthly' && (
                  <div className="day-picker-wrap">
                    <span className="cadenza-label">Giorno del mese</span>
                    <div className="day-picker">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`day-btn${recurringDayOfMonth === d ? ' active' : ''}`}
                          onClick={() => setRecurringDayOfMonth(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Importo (€)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Categoria <CategoryInfo /></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Seleziona...</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Note (opzionale)</label>
          <input
            type="text"
            placeholder="Descrizione..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {type === 'expense' && wallets.length > 0 && (
          <div className="movement-row">
            <div className="form-group wallet-select-group">
              <label>Da salvadanaio <WalletInfo /></label>
              <select value={fromWalletId} onChange={(e) => setFromWalletId(e.target.value)}>
                <option value="">— Fondi generali —</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>
                ))}
              </select>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isMovement}
                onChange={handleMovementToggle}
              />
              Sposta in un salvadanaio
            </label>

            {isMovement && (
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required={isMovement}
              >
                <option value="">Seleziona destinazione...</option>
                {wallets.filter((w) => w.id !== fromWalletId).map((w) => (
                  <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>
                ))}
              </select>
            )}

            {isTransfer && (
              <p className="transfer-hint">
                ↔ Trasferimento tra salvadanai — non verrà conteggiato nelle spese
              </p>
            )}
          </div>
        )}

        <button type="submit" className={`btn-submit ${isTransfer ? 'transfer' : type}`} disabled={loading}>
          {loading ? 'Salvataggio...' : isTransfer ? '↔ Trasferisci' : '+ Aggiungi'}
        </button>
      </form>
    </div>
  );
}

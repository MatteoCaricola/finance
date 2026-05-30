import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './TransactionForm.css';

const CATEGORIES_INCOME = ['Stipendio', 'Freelance', 'Regalo', 'Investimenti', 'Altro'];
const CATEGORIES_EXPENSE = ['Cibo', 'Trasporti', 'Casa', 'Abbigliamento', 'Svago', 'Salute', 'Sport', 'Abbonamenti', 'Risparmio', 'Lavoro', 'Altro'];

const today = () => new Date().toISOString().split('T')[0];

export default function TransactionForm({ onAdded, wallets = [] }) {
  const { user } = useAuth();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [isMovement, setIsMovement] = useState(false);
  const [walletId, setWalletId] = useState('');

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory('');
    if (newType !== 'expense') { setIsMovement(false); setWalletId(''); }
  };

  const handleMovementToggle = (e) => {
    setIsMovement(e.target.checked);
    if (!e.target.checked) setWalletId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category || !date) return;
    if (isMovement && !walletId) return;
    setLoading(true);
    try {
      const data = {
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
        createdAt: serverTimestamp(),
      };
      if (isMovement && walletId) {
        const wallet = wallets.find((w) => w.id === walletId);
        data.walletId = walletId;
        data.walletName = wallet?.name ?? '';
      }
      await addDoc(collection(db, 'users', user.uid, 'transactions'), data);
      setAmount('');
      setDescription('');
      setCategory('');
      setDate(today());
      setIsMovement(false);
      setWalletId('');
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
          <label>Categoria</label>
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
                <option value="">Seleziona salvadanaio...</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <button type="submit" className={`btn-submit ${type}`} disabled={loading}>
          {loading ? 'Salvataggio...' : '+ Aggiungi'}
        </button>
      </form>
    </div>
  );
}

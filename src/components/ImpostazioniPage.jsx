import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './ImpostazioniPage.css';

export default function ImpostazioniPage({ categoriesIncome, categoriesExpense }) {
  const { user } = useAuth();
  const [newIncome, setNewIncome] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (income, expense) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), { income, expense });
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (type) => {
    const value = type === 'income' ? newIncome.trim() : newExpense.trim();
    if (!value) return;
    if (type === 'income') {
      if (categoriesIncome.includes(value)) return;
      await save([...categoriesIncome, value], categoriesExpense);
      setNewIncome('');
    } else {
      if (categoriesExpense.includes(value)) return;
      await save(categoriesIncome, [...categoriesExpense, value]);
      setNewExpense('');
    }
  };

  const removeCategory = (type, cat) => {
    if (type === 'income') save(categoriesIncome.filter((c) => c !== cat), categoriesExpense);
    else save(categoriesIncome, categoriesExpense.filter((c) => c !== cat));
  };

  const handleKey = (e, type) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(type); }
  };

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
                <button
                  className="cat-remove"
                  onClick={() => removeCategory('income', cat)}
                  disabled={saving}
                  title="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="cat-add-row">
            <input
              type="text"
              placeholder="Nuova categoria..."
              value={newIncome}
              onChange={(e) => setNewIncome(e.target.value)}
              onKeyDown={(e) => handleKey(e, 'income')}
              maxLength={30}
            />
            <button
              className="btn-add income"
              onClick={() => addCategory('income')}
              disabled={saving || !newIncome.trim()}
            >
              Aggiungi
            </button>
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
                <button
                  className="cat-remove"
                  onClick={() => removeCategory('expense', cat)}
                  disabled={saving}
                  title="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="cat-add-row">
            <input
              type="text"
              placeholder="Nuova categoria..."
              value={newExpense}
              onChange={(e) => setNewExpense(e.target.value)}
              onKeyDown={(e) => handleKey(e, 'expense')}
              maxLength={30}
            />
            <button
              className="btn-add expense"
              onClick={() => addCategory('expense')}
              disabled={saving || !newExpense.trim()}
            >
              Aggiungi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

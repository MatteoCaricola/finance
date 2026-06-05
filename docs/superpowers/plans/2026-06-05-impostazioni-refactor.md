# Impostazioni Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorare ImpostazioniPage in 4 accordion espandibili, aggiungendo drag-and-drop per le categorie, warning modale per le categorie orfane, e form inline di modifica per le ricorrenti.

**Architecture:** Tutto il lavoro è confinato a `ImpostazioniPage.jsx` e `ImpostazioniPage.css`, più un'aggiunta di prop in `Dashboard.jsx`. Nessun nuovo componente file-separato — la pagina è già coesa. Lo stato accordion è locale (`useState([])`). DnD via @dnd-kit con `SortablePill` come componente interno al file.

**Tech Stack:** React 18, @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities, Firebase Firestore, CSS vanilla

---

> **Nota:** questo progetto non ha un test runner. La verifica è manuale: `npm run dev` + ispezione visiva nel browser.

---

### Task 1: Installa @dnd-kit

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Installa i pacchetti**

```bash
cd "c:/Users/aabou/OneDrive/Desktop/Matteo/Personale/Prorgetti/finance"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Output atteso: `added 3 packages` o simile, nessun errore.

- [ ] **Step 2: Verifica package.json**

Apri `package.json` e controlla che nelle `dependencies` ci siano:
```json
"@dnd-kit/core": "^...",
"@dnd-kit/sortable": "^...",
"@dnd-kit/utilities": "^..."
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: aggiungi @dnd-kit per drag-and-drop categorie"
```

---

### Task 2: Passa prop `transactions` a ImpostazioniPage

**Files:**
- Modify: `src/components/Dashboard.jsx` riga 293-302
- Modify: `src/components/ImpostazioniPage.jsx` riga 18 (firma props)

- [ ] **Step 1: Aggiungi prop in Dashboard.jsx**

Trova il blocco `page === 'impostazioni'` (righe 293-302) e aggiungi `transactions={transactions}`:

```jsx
{page === 'impostazioni' && (
  <ImpostazioniPage
    categoriesIncome={categoriesIncome}
    categoriesExpense={categoriesExpense}
    budgets={budgets}
    onBudgetsChange={setBudgets}
    recurring={recurring}
    onDeleteRecurring={handleDeleteRecurring}
    transactions={transactions}
  />
)}
```

- [ ] **Step 2: Aggiungi transactions alla firma in ImpostazioniPage.jsx**

Cambia la riga di destructuring delle props da:
```jsx
export default function ImpostazioniPage({ categoriesIncome, categoriesExpense, budgets, onBudgetsChange, recurring = [], onDeleteRecurring }) {
```
a:
```jsx
export default function ImpostazioniPage({ categoriesIncome, categoriesExpense, budgets, onBudgetsChange, recurring = [], onDeleteRecurring, transactions = [] }) {
```

- [ ] **Step 3: Avvia dev server e verifica che non ci siano errori**

```bash
npm run dev
```

Vai su Impostazioni nell'app. Deve funzionare esattamente come prima.

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.jsx src/components/ImpostazioniPage.jsx
git commit -m "feat: passa prop transactions a ImpostazioniPage"
```

---

### Task 3: Riscrivi ImpostazioniPage.jsx

**Files:**
- Modify: `src/components/ImpostazioniPage.jsx` — riscrittura completa

- [ ] **Step 1: Sostituisci tutto il contenuto del file**

```jsx
import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getPushStatus, subscribeAndSave, unsubscribeAndRemove } from '../utils/pushNotifications';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ImpostazioniPage.css';

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const DAYS_OF_WEEK = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const freqLabel = (r) => {
  if (r.frequency === 'daily') return 'ogni giorno';
  if (r.frequency === 'weekly') return `ogni ${DAYS_OF_WEEK[r.dayOfWeek] ?? ''}`;
  return `giorno ${r.dayOfMonth} del mese`;
};

function SortablePill({ id, type, onRemove, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`cat-pill ${type}`}
    >
      <span className="drag-handle" {...attributes} {...listeners} title="Trascina per riordinare">⠿</span>
      <span>{id}</span>
      <button className="cat-remove" onClick={() => onRemove(id)} disabled={disabled} title="Rimuovi">×</button>
    </div>
  );
}

export default function ImpostazioniPage({
  categoriesIncome,
  categoriesExpense,
  budgets,
  onBudgetsChange,
  recurring = [],
  onDeleteRecurring,
  transactions = [],
}) {
  const { user } = useAuth();

  // Accordion
  const [open, setOpen] = useState([]);
  const toggle = (id) => setOpen((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
  const isOpen = (id) => open.includes(id);

  // Categorie
  const [newIncome, setNewIncome] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, cat, count }

  // Budget
  const [newBudgetCat, setNewBudgetCat] = useState('');
  const [newBudgetAmt, setNewBudgetAmt] = useState('');

  // Push
  const [pushStatus, setPushStatus] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);

  // Ricorrenti edit
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [editRec, setEditRec] = useState({});

  // DnD sensors (PointerSensor per desktop, TouchSensor per mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => { getPushStatus().then(setPushStatus); }, []);

  // --- Categorie ---
  const saveCategories = async (income, expense) => {
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
      await saveCategories([...categoriesIncome, value], categoriesExpense);
      setNewIncome('');
    } else {
      if (categoriesExpense.includes(value)) return;
      await saveCategories(categoriesIncome, [...categoriesExpense, value]);
      setNewExpense('');
    }
  };

  const removeCategory = (type, cat) => {
    const count = transactions.filter((t) => t.category === cat).length;
    if (count > 0) {
      setConfirmDelete({ type, cat, count });
    } else {
      doRemoveCategory(type, cat);
    }
  };

  const doRemoveCategory = (type, cat) => {
    if (type === 'income') saveCategories(categoriesIncome.filter((c) => c !== cat), categoriesExpense);
    else saveCategories(categoriesIncome, categoriesExpense.filter((c) => c !== cat));
  };

  const handleDragEndIncome = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = categoriesIncome.indexOf(active.id);
    const newIndex = categoriesIncome.indexOf(over.id);
    saveCategories(arrayMove(categoriesIncome, oldIndex, newIndex), categoriesExpense);
  };

  const handleDragEndExpense = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = categoriesExpense.indexOf(active.id);
    const newIndex = categoriesExpense.indexOf(over.id);
    saveCategories(categoriesIncome, arrayMove(categoriesExpense, oldIndex, newIndex));
  };

  // --- Budget ---
  const saveBudgets = async (updated) => {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'budgets'), updated);
    onBudgetsChange?.(updated);
  };

  const addBudget = () => {
    if (!newBudgetCat || !newBudgetAmt) return;
    saveBudgets({ ...budgets, [newBudgetCat]: parseFloat(newBudgetAmt) });
    setNewBudgetCat('');
    setNewBudgetAmt('');
  };

  const removeBudget = (cat) => {
    const updated = { ...budgets };
    delete updated[cat];
    saveBudgets(updated);
  };

  // --- Ricorrenti edit ---
  const startEditRecurring = (r) => {
    setEditingRecurring(r.id);
    setEditRec({
      amount: r.amount,
      category: r.category,
      description: r.description || '',
      frequency: r.frequency ?? 'monthly',
      dayOfMonth: r.dayOfMonth ?? 1,
      dayOfWeek: r.dayOfWeek ?? 1,
    });
  };

  const saveEditRecurring = async (id) => {
    await updateDoc(doc(db, 'users', user.uid, 'recurring', id), {
      amount: parseFloat(editRec.amount),
      category: editRec.category,
      description: editRec.description,
      frequency: editRec.frequency,
      ...(editRec.frequency === 'monthly' ? { dayOfMonth: parseInt(editRec.dayOfMonth) } : {}),
      ...(editRec.frequency === 'weekly' ? { dayOfWeek: parseInt(editRec.dayOfWeek) } : {}),
    });
    setEditingRecurring(null);
  };

  // --- Computed ---
  const categoriesWithoutBudget = categoriesExpense.filter((c) => !(c in budgets));
  const budgetEntries = Object.entries(budgets).filter(([, v]) => v > 0);
  const totalCategories = categoriesIncome.length + categoriesExpense.length;

  return (
    <div className="impostazioni-page">
      <h2>Impostazioni</h2>

      {/* ACCORDION: CATEGORIE */}
      <div className="settings-accordion">
        <button className="acc-header" onClick={() => toggle('categorie')}>
          <span className="acc-icon">🏷</span>
          <span className="acc-title">Categorie</span>
          {!isOpen('categorie') && <span className="acc-badge">· {totalCategories}</span>}
          <span className="acc-arrow">{isOpen('categorie') ? '▲' : '▼'}</span>
        </button>
        {isOpen('categorie') && (
          <div className="acc-body">
            <div className="acc-sublabel income">Entrate</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndIncome}>
              <SortableContext items={categoriesIncome} strategy={horizontalListSortingStrategy}>
                <div className="cat-pills">
                  {categoriesIncome.map((cat) => (
                    <SortablePill key={cat} id={cat} type="income" onRemove={(c) => removeCategory('income', c)} disabled={saving} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="cat-add-row">
              <input type="text" placeholder="Nuova categoria entrata..." value={newIncome}
                onChange={(e) => setNewIncome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory('income')} maxLength={30} />
              <button className="btn-add income" onClick={() => addCategory('income')} disabled={saving || !newIncome.trim()}>Aggiungi</button>
            </div>

            <div className="acc-sublabel expense" style={{ marginTop: '16px' }}>Uscite</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndExpense}>
              <SortableContext items={categoriesExpense} strategy={horizontalListSortingStrategy}>
                <div className="cat-pills">
                  {categoriesExpense.map((cat) => (
                    <SortablePill key={cat} id={cat} type="expense" onRemove={(c) => removeCategory('expense', c)} disabled={saving} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="cat-add-row">
              <input type="text" placeholder="Nuova categoria uscita..." value={newExpense}
                onChange={(e) => setNewExpense(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory('expense')} maxLength={30} />
              <button className="btn-add expense" onClick={() => addCategory('expense')} disabled={saving || !newExpense.trim()}>Aggiungi</button>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION: BUDGET */}
      <div className="settings-accordion">
        <button className="acc-header" onClick={() => toggle('budget')}>
          <span className="acc-icon">📊</span>
          <span className="acc-title">Budget mensile</span>
          {!isOpen('budget') && budgetEntries.length > 0 && <span className="acc-badge">· {budgetEntries.length}</span>}
          <span className="acc-arrow">{isOpen('budget') ? '▲' : '▼'}</span>
        </button>
        {isOpen('budget') && (
          <div className="acc-body">
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
                  <input type="number" min="1" step="1" placeholder="Limite"
                    value={newBudgetAmt}
                    onChange={(e) => setNewBudgetAmt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addBudget(); }} />
                </div>
                <button className="btn-add expense" onClick={addBudget} disabled={!newBudgetCat || !newBudgetAmt}>Aggiungi</button>
              </div>
            )}
            {budgetEntries.length === 0 && categoriesWithoutBudget.length === 0 && (
              <p className="budget-hint">Tutte le categorie hanno già un budget impostato.</p>
            )}
          </div>
        )}
      </div>

      {/* ACCORDION: NOTIFICHE */}
      <div className="settings-accordion">
        <button className="acc-header" onClick={() => toggle('notifiche')}>
          <span className="acc-icon">🔔</span>
          <span className="acc-title">Notifiche</span>
          <span className="acc-arrow">{isOpen('notifiche') ? '▲' : '▼'}</span>
        </button>
        {isOpen('notifiche') && (
          <div className="acc-body">
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
        )}
      </div>

      {/* ACCORDION: RICORRENTI */}
      <div className="settings-accordion">
        <button className="acc-header" onClick={() => toggle('ricorrenti')}>
          <span className="acc-icon">🔁</span>
          <span className="acc-title">Ricorrenti</span>
          {!isOpen('ricorrenti') && recurring.length > 0 && <span className="acc-badge">· {recurring.length}</span>}
          <span className="acc-arrow">{isOpen('ricorrenti') ? '▲' : '▼'}</span>
        </button>
        {isOpen('ricorrenti') && (
          <div className="acc-body">
            {recurring.length === 0 ? (
              <p className="budget-hint">Nessuna transazione ricorrente. Aggiungine una spuntando "Ricorrente" nel form.</p>
            ) : (
              <div className="budget-list">
                {recurring.map((r) => (
                  <div key={r.id}>
                    <div className="budget-list-item">
                      <span className={`tx-dot ${r.type}`} style={{ flexShrink: 0 }} />
                      <span className="budget-list-cat">{r.category}{r.description ? ` — ${r.description}` : ''}</span>
                      <span className="budget-list-amt">{fmt(r.amount)} · {freqLabel(r)}</span>
                      <button
                        className="rec-edit-btn"
                        onClick={() => editingRecurring === r.id ? setEditingRecurring(null) : startEditRecurring(r)}
                        title="Modifica"
                      >✏️</button>
                      <button className="budget-remove" onClick={() => onDeleteRecurring?.(r.id)} title="Elimina">×</button>
                    </div>
                    {editingRecurring === r.id && (
                      <div className="rec-edit-form">
                        <div className="rec-edit-row">
                          <label>Importo (€)</label>
                          <input type="number" min="0.01" step="0.01"
                            value={editRec.amount}
                            onChange={(e) => setEditRec((p) => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <div className="rec-edit-row">
                          <label>Categoria</label>
                          <select value={editRec.category}
                            onChange={(e) => setEditRec((p) => ({ ...p, category: e.target.value }))}>
                            {(r.type === 'income' ? categoriesIncome : categoriesExpense).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rec-edit-row">
                          <label>Descrizione</label>
                          <input type="text" maxLength={50}
                            value={editRec.description}
                            onChange={(e) => setEditRec((p) => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="rec-edit-row">
                          <label>Frequenza</label>
                          <select value={editRec.frequency}
                            onChange={(e) => setEditRec((p) => ({ ...p, frequency: e.target.value }))}>
                            <option value="daily">Giornaliera</option>
                            <option value="weekly">Settimanale</option>
                            <option value="monthly">Mensile</option>
                          </select>
                        </div>
                        {editRec.frequency === 'monthly' && (
                          <div className="rec-edit-row">
                            <label>Giorno del mese</label>
                            <input type="number" min="1" max="31"
                              value={editRec.dayOfMonth}
                              onChange={(e) => setEditRec((p) => ({ ...p, dayOfMonth: e.target.value }))} />
                          </div>
                        )}
                        {editRec.frequency === 'weekly' && (
                          <div className="rec-edit-row">
                            <label>Giorno della settimana</label>
                            <select value={editRec.dayOfWeek}
                              onChange={(e) => setEditRec((p) => ({ ...p, dayOfWeek: e.target.value }))}>
                              {DAYS_OF_WEEK.slice(1).map((d, i) => (
                                <option key={i + 1} value={i + 1}>{d}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="rec-edit-actions">
                          <button className="btn-cancel-rec" onClick={() => setEditingRecurring(null)}>Annulla</button>
                          <button className="btn-save-rec" onClick={() => saveEditRecurring(r.id)}>Salva</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CONFERMA ELIMINAZIONE CATEGORIA ORFANA */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Eliminare "{confirmDelete.cat}"?</h3>
            <p>
              Ci sono <strong>{confirmDelete.count}</strong> transazion{confirmDelete.count === 1 ? 'e' : 'i'} che{' '}
              us{confirmDelete.count === 1 ? 'a' : 'ano'} questa categoria.
              Eliminandola, quelle transazioni manterranno l'etichetta <strong>"{confirmDelete.cat}"</strong> ma
              non sarà più selezionabile per le nuove transazioni.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel-rec" onClick={() => setConfirmDelete(null)}>Annulla</button>
              <button className="btn-delete-confirm" onClick={() => { doRemoveCategory(confirmDelete.type, confirmDelete.cat); setConfirmDelete(null); }}>
                Elimina comunque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Avvia dev server e verifica che non ci siano errori di compilazione**

```bash
npm run dev
```

Vai su Impostazioni. Deve mostrare 4 accordion chiusi con badge conteggio. Verifica che ogni accordion si apra/chiuda. Se ci sono errori di import, controlla che `@dnd-kit` sia installato correttamente (Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/components/ImpostazioniPage.jsx
git commit -m "feat: refactor ImpostazioniPage con accordion, DnD, edit ricorrenti, warning orfane"
```

---

### Task 4: Riscrivi ImpostazioniPage.css

**Files:**
- Modify: `src/components/ImpostazioniPage.css` — riscrittura completa

- [ ] **Step 1: Sostituisci tutto il contenuto del file CSS**

```css
.impostazioni-page {
  padding-bottom: 32px;
}

.impostazioni-page h2 {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 20px;
}

/* ---- Accordion ---- */

.settings-accordion {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
  background: #fff;
}

.acc-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #fff;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  transition: background 0.15s;
}

.acc-header:hover { background: #f9fafb; }

.acc-icon { font-size: 16px; }
.acc-title { flex: 1; }
.acc-badge { font-size: 12px; color: #9ca3af; font-weight: 400; }
.acc-arrow { font-size: 11px; color: #9ca3af; }

.acc-body {
  padding: 16px;
  background: #fafafa;
  border-top: 1px solid #f3f4f6;
}

.acc-sublabel {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.acc-sublabel.income  { color: #065f46; }
.acc-sublabel.expense { color: #991b1b; }

/* ---- Category pills (drag & drop) ---- */

.cat-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  min-height: 32px;
}

.cat-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 20px;
  padding: 4px 8px 4px 4px;
  font-size: 13px;
  border: 1px solid;
  user-select: none;
  touch-action: none;
}

.cat-pill.income  { background: #f0fdf4; border-color: #a7f3d0; color: #065f46; }
.cat-pill.expense { background: #fef2f2; border-color: #fecaca; color: #991b1b; }

.drag-handle {
  cursor: grab;
  color: #9ca3af;
  font-size: 15px;
  line-height: 1;
  padding: 0 3px;
}

.drag-handle:active { cursor: grabbing; }

.cat-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0 1px;
  opacity: 0.45;
  color: inherit;
  transition: opacity 0.15s;
}

.cat-remove:hover:not(:disabled) { opacity: 1; }
.cat-remove:disabled { cursor: default; }

/* ---- Add category row ---- */

.cat-add-row {
  display: flex;
  gap: 8px;
}

.cat-add-row input {
  flex: 1;
  padding: 7px 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  outline: none;
}

.cat-add-row input:focus { border-color: #6366f1; }

.btn-add {
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.btn-add:disabled { opacity: 0.45; cursor: default; }
.btn-add.income  { background: #d1fae5; color: #065f46; }
.btn-add.expense { background: #fee2e2; color: #991b1b; }
.btn-add.income:hover:not(:disabled)  { background: #a7f3d0; }
.btn-add.expense:hover:not(:disabled) { background: #fecaca; }

/* ---- Budget ---- */

.budget-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.budget-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
}

.budget-list-cat  { flex: 1; font-size: 14px; color: #374151; font-weight: 500; }
.budget-list-amt  { font-size: 13px; color: #6b7280; }

.budget-remove {
  background: none;
  border: none;
  font-size: 18px;
  color: #d1d5db;
  cursor: pointer;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.15s;
}

.budget-remove:hover { color: #ef4444; }

.budget-add-form {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.budget-add-form select {
  flex: 1;
  min-width: 160px;
  padding: 8px 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: #fff;
  outline: none;
}

.budget-add-form select:focus { border-color: #6366f1; }

.budget-input-wrap {
  display: flex;
  align-items: center;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  width: 110px;
  background: #fff;
}

.budget-euro {
  padding: 0 7px;
  font-size: 13px;
  color: #9ca3af;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  line-height: 36px;
}

.budget-input-wrap input {
  width: 100%;
  padding: 8px;
  border: none;
  font-size: 14px;
  color: #111827;
  outline: none;
}

.budget-hint { font-size: 13px; color: #9ca3af; margin: 0; }

/* ---- Push notifications ---- */

.push-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.push-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
}

.push-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.push-dot.on  { background: #10b981; }
.push-dot.off { background: #d1d5db; }

.btn-push-toggle {
  padding: 7px 16px;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-push-toggle.enable  { background: #6366f1; color: #fff; }
.btn-push-toggle.disable { background: #f3f4f6; color: #6b7280; }
.btn-push-toggle:disabled { opacity: 0.6; cursor: not-allowed; }

/* ---- Recurring dot ---- */

.tx-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tx-dot.income   { background: #10b981; }
.tx-dot.expense  { background: #ef4444; }
.tx-dot.transfer { background: #6366f1; }

/* ---- Recurring edit button ---- */

.rec-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.rec-edit-btn:hover { opacity: 1; }

/* ---- Recurring inline edit form ---- */

.rec-edit-form {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  margin: 4px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rec-edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rec-edit-row label {
  font-size: 12px;
  color: #6b7280;
  min-width: 140px;
  flex-shrink: 0;
}

.rec-edit-row input,
.rec-edit-row select {
  flex: 1;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  outline: none;
}

.rec-edit-row input:focus,
.rec-edit-row select:focus { border-color: #6366f1; }

.rec-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.btn-save-rec {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel-rec {
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 7px;
  padding: 7px 18px;
  font-size: 13px;
  cursor: pointer;
}

/* ---- Modal conferma eliminazione ---- */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
}

.modal h3 {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 10px;
}

.modal p {
  font-size: 14px;
  color: #374151;
  line-height: 1.55;
  margin: 0 0 20px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-delete-confirm {
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* ---- Responsive ---- */

@media (max-width: 600px) {
  .rec-edit-row { flex-direction: column; align-items: flex-start; }
  .rec-edit-row label { min-width: unset; }
  .rec-edit-row input,
  .rec-edit-row select { width: 100%; }
  .budget-add-form { flex-direction: column; align-items: stretch; }
  .budget-input-wrap { width: 100%; }
}
```

- [ ] **Step 2: Verifica visiva nel browser**

Con il dev server attivo verifica:
- 4 accordion chiusi, badge conteggio visibili
- Ogni accordion si apre/chiude correttamente
- **Categorie:** le chip sono colorate (verde entrate, rosso uscite), il drag handle ⠿ appare, trascinando si riordina, il × elimina, aggiungi funziona
- **Budget:** lista e form di aggiunta funzionano
- **Notifiche:** toggle push funziona
- **Ricorrenti:** ✏️ apre il form inline precompilato, salva e chiude, × elimina
- **Warning modale:** prova a eliminare una categoria usata da almeno una transazione → deve uscire la modale con il conteggio corretto
- Layout responsive su schermo stretto (DevTools mobile)

- [ ] **Step 3: Commit**

```bash
git add src/components/ImpostazioniPage.css
git commit -m "style: nuovi stili accordion, DnD, edit ricorrenti, modal conferma"
```

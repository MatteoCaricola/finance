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
  const [savingRec, setSavingRec] = useState(false);

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
    if (saving || !over || active.id === over.id) return;
    const oldIndex = categoriesIncome.indexOf(active.id);
    const newIndex = categoriesIncome.indexOf(over.id);
    saveCategories(arrayMove(categoriesIncome, oldIndex, newIndex), categoriesExpense);
  };

  const handleDragEndExpense = ({ active, over }) => {
    if (saving || !over || active.id === over.id) return;
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
    setSavingRec(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'recurring', id), {
        amount: parseFloat(editRec.amount),
        category: editRec.category,
        description: editRec.description,
        frequency: editRec.frequency,
        ...(editRec.frequency === 'monthly' ? { dayOfMonth: parseInt(editRec.dayOfMonth, 10) } : {}),
        ...(editRec.frequency === 'weekly' ? { dayOfWeek: parseInt(editRec.dayOfWeek, 10) } : {}),
        lastAddedDate: null,
        lastAddedMonth: null,
      });
      setEditingRecurring(null);
    } finally {
      setSavingRec(false);
    }
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
                          <button className="btn-save-rec" onClick={() => saveEditRecurring(r.id)} disabled={savingRec}>
                            {savingRec ? '...' : 'Salva'}
                          </button>
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

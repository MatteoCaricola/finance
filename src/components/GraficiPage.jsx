import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import './GraficiPage.css';

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function buildMonthlyData(transactions) {
  const map = {};
  transactions.forEach((t) => {
    const [y, m] = t.date.split('-');
    const key = `${y}-${m}`;
    if (!map[key]) map[key] = { label: `${MONTHS_SHORT[Number(m) - 1]} ${y}`, entrate: 0, uscite: 0 };
    if (t.type === 'income')  map[key].entrate += t.amount;
    if (t.type === 'expense') map[key].uscite  += t.amount;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);
}

function buildCategoryData(transactions) {
  const map = {};
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
}

export default function GraficiPage({ transactions, wallets = [] }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);

  const [fundFilter, setFundFilter] = useState('all');

  const [accordionOpen, setAccordionOpen] = useState(false);
  const [filterMonth, setFilterMonth]       = useState('');
  const [filterYear, setFilterYear]         = useState('');
  const [filterType, setFilterType]         = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch]     = useState('');

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid, 'data', 'notes')).then((snap) => {
      if (snap.exists()) setNotes(snap.data().content || '');
    });
  }, [user.uid]);

  const handleNotesChange = (e) => { setNotes(e.target.value); setSaved(false); };
  const saveNotes = async () => {
    await setDoc(doc(db, 'users', user.uid, 'data', 'notes'), { content: notes });
    setSaved(true);
  };

  const years = [...new Set(transactions.map((t) => t.date.split('-')[0]))].sort().reverse();
  const availableCategories = [...new Set(
    transactions.filter((t) => filterType === '' || t.type === filterType).map((t) => t.category)
  )].sort();

  const handleTypeChange = (val) => { setFilterType(val); setFilterCategory(''); };

  const filtersActive = filterMonth !== '' || filterYear !== '' || filterType !== '' || filterCategory !== '' || filterSearch !== '';

  const filtered = filtersActive
    ? transactions.filter((tx) => {
        const [y, m] = tx.date.split('-').map(Number);
        const searchOk = filterSearch === '' ||
          (tx.description || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
          tx.category.toLowerCase().includes(filterSearch.toLowerCase());
        return (filterMonth    === '' || m - 1 === Number(filterMonth))
            && (filterYear     === '' || y === Number(filterYear))
            && (filterType     === '' || tx.type === filterType)
            && (filterCategory === '' || tx.category === filterCategory)
            && searchOk;
      })
    : transactions;

  const clearFilters = () => { setFilterMonth(''); setFilterYear(''); setFilterType(''); setFilterCategory(''); setFilterSearch(''); };

  const activeBadges = [
    filterMonth !== '' && MONTHS[Number(filterMonth)],
    filterYear,
    filterType === 'income' && 'Entrate',
    filterType === 'expense' && 'Uscite',
    filterCategory,
    filterSearch && `"${filterSearch}"`,
  ].filter(Boolean);

  const fundFiltered = (() => {
    if (fundFilter === 'all')     return filtered.filter((t) => t.type !== 'transfer');
    if (fundFilter === 'general') return filtered.filter((t) => !t.walletId && !t.fromWalletId && t.type !== 'transfer');
    // specific wallet: remap inflows as income, outflows as expense
    return filtered
      .filter((t) => t.walletId === fundFilter || t.fromWalletId === fundFilter)
      .map((t) => ({ ...t, type: t.walletId === fundFilter ? 'income' : 'expense' }));
  })();

  const selectedWallet = wallets.find((w) => w.id === fundFilter);

  const monthlyData  = buildMonthlyData(fundFiltered);
  const categoryData = buildCategoryData(fundFiltered);

  return (
    <div className="grafici-page">
      <div className="fund-selector">
        <span className="fund-selector-label">Fondo:</span>
        <div className="fund-tabs">
          <button
            className={fundFilter === 'all' ? 'active' : ''}
            onClick={() => setFundFilter('all')}
          >
            Tutti
          </button>
          <button
            className={fundFilter === 'general' ? 'active' : ''}
            onClick={() => setFundFilter('general')}
          >
            Generale
          </button>
          {wallets.map((w) => (
            <button
              key={w.id}
              className={fundFilter === w.id ? 'active' : ''}
              onClick={() => setFundFilter(w.id)}
            >
              {w.emoji} {w.name}
            </button>
          ))}
        </div>
      </div>

      <div className="accordion">
        <button
          className={`accordion-trigger ${accordionOpen ? 'open' : ''}`}
          onClick={() => setAccordionOpen((v) => !v)}
        >
          <span>
            Filtri
            {filtersActive && activeBadges.map((b) => (
              <span key={b} className="filter-badge">{b}</span>
            ))}
          </span>
          <span className="accordion-arrow">{accordionOpen ? '▲' : '▼'}</span>
        </button>
        {accordionOpen && (
          <div className="accordion-body">
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="">Tutti i mesi</option>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="">Tutti gli anni</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterType} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="">Tutte le transazioni</option>
              <option value="income">Entrate</option>
              <option value="expense">Uscite</option>
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Tutte le categorie</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              className="filter-search"
              placeholder="Cerca nelle note..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
            {filtersActive && (
              <button className="btn-clear" onClick={clearFilters}>Rimuovi filtri</button>
            )}
          </div>
        )}
      </div>

      {selectedWallet && (selectedWallet.initialBalance ?? 0) > 0 && (
        <div className="initial-balance-bar">
          <span className="initial-balance-label">Saldo iniziale</span>
          <span className="initial-balance-value">{fmt(selectedWallet.initialBalance)}</span>
        </div>
      )}

      <div className="grafici-grid">
        <div className="chart-card">
          <h2>
            {selectedWallet
              ? `${selectedWallet.emoji} ${selectedWallet.name} — ultimi 6 mesi`
              : 'Entrate vs Uscite (ultimi 6 mesi)'}
          </h2>
          {monthlyData.length === 0
            ? <p className="chart-empty">Nessun dato disponibile.</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} barGap={4}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="entrate" name="Entrate" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="uscite"  name="Uscite"  fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        <div className="chart-card">
          <h2>Uscite per categoria</h2>
          {categoryData.length === 0
            ? <p className="chart-empty">Nessun dato disponibile.</p>
            : (
              <div className="pie-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="pie-legend">
                  {categoryData.map((d, i) => (
                    <li key={d.name}>
                      <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="pie-label">{d.name}</span>
                      <span className="pie-value">{fmt(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        </div>
      </div>

      <div className="notes-card">
        <div className="notes-header">
          <h2>Appunti</h2>
          <button className={`btn-save ${saved ? 'saved' : ''}`} onClick={saveNotes} disabled={saved}>
            {saved ? 'Salvato' : 'Salva'}
          </button>
        </div>
        <textarea
          className="notes-area"
          placeholder="Scrivi qui i tuoi appunti..."
          value={notes}
          onChange={handleNotesChange}
        />
      </div>
    </div>
  );
}

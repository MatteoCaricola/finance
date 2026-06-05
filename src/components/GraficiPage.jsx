import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine,
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

function buildBalanceData(transactions) {
  const map = {};
  transactions
    .filter((t) => t.type === 'income' || t.type === 'expense')
    .forEach((t) => {
      const [y, m] = t.date.split('-');
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = { label: `${MONTHS_SHORT[Number(m) - 1]} ${y}`, net: 0 };
      map[key].net += t.type === 'income' ? t.amount : -t.amount;
    });
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  let cumulative = 0;
  return sorted.map(([, v]) => {
    cumulative += v.net;
    return { label: v.label, saldo: Math.round(cumulative * 100) / 100 };
  });
}

function buildCategoryData(transactions) {
  const map = {};
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
}

function buildPeriodData(transactions, fromYM, toYM) {
  const filtered = transactions.filter((t) => {
    const ym = t.date.slice(0, 7);
    return ym >= fromYM && ym <= toYM && t.type !== 'transfer';
  });
  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const byCategory = {};
  filtered.filter((t) => t.type === 'expense').forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });
  return { income, expense, byCategory };
}

function buildComparisonBarData(dataA, dataB) {
  const allCats = new Set([...Object.keys(dataA.byCategory), ...Object.keys(dataB.byCategory)]);
  return Array.from(allCats)
    .map((cat) => ({
      name: cat,
      A: Math.round((dataA.byCategory[cat] || 0) * 100) / 100,
      B: Math.round((dataB.byCategory[cat] || 0) * 100) / 100,
    }))
    .sort((a, b) => (b.A + b.B) - (a.A + a.B))
    .slice(0, 8);
}

function buildPiePeriodData(byCategory) {
  return Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

function periodLabel(fromYear, fromMonth, toYear, toMonth) {
  const from = `${MONTHS_SHORT[Number(fromMonth) - 1]} ${fromYear}`;
  const to = `${MONTHS_SHORT[Number(toMonth) - 1]} ${toYear}`;
  return from === to ? from : `${from} – ${to}`;
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

  // Confronto periodi
  const now = new Date();
  const curYear = String(now.getFullYear());
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear = String(prevDate.getFullYear());
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');

  const [periodA, setPeriodA] = useState({
    fromYear: prevYear, fromMonth: prevMonth, toYear: prevYear, toMonth: prevMonth,
  });
  const [periodB, setPeriodB] = useState({
    fromYear: curYear, fromMonth: curMonth, toYear: curYear, toMonth: curMonth,
  });
  const [confrontoChart, setConfrontoChart] = useState('bar');

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
  const balanceData  = buildBalanceData(fundFiltered);

  // Confronto — validazione e dati
  const confrontoAValid = !!(periodA.fromYear && periodA.fromMonth && periodA.toYear && periodA.toMonth
    && `${periodA.fromYear}-${periodA.fromMonth}` <= `${periodA.toYear}-${periodA.toMonth}`);
  const confrontoBValid = !!(periodB.fromYear && periodB.fromMonth && periodB.toYear && periodB.toMonth
    && `${periodB.fromYear}-${periodB.fromMonth}` <= `${periodB.toYear}-${periodB.toMonth}`);

  const dataA = confrontoAValid
    ? buildPeriodData(transactions, `${periodA.fromYear}-${periodA.fromMonth}`, `${periodA.toYear}-${periodA.toMonth}`)
    : { income: 0, expense: 0, byCategory: {} };
  const dataB = confrontoBValid
    ? buildPeriodData(transactions, `${periodB.fromYear}-${periodB.fromMonth}`, `${periodB.toYear}-${periodB.toMonth}`)
    : { income: 0, expense: 0, byCategory: {} };

  const labelA = confrontoAValid ? periodLabel(periodA.fromYear, periodA.fromMonth, periodA.toYear, periodA.toMonth) : '—';
  const labelB = confrontoBValid ? periodLabel(periodB.fromYear, periodB.fromMonth, periodB.toYear, periodB.toMonth) : '—';

  const deltaExpense = dataB.expense - dataA.expense;
  const deltaExpensePct = dataA.expense > 0 ? Math.round((deltaExpense / dataA.expense) * 100) : 0;
  const deltaIncome = dataB.income - dataA.income;
  const deltaIncomePct = dataA.income > 0 ? Math.round((deltaIncome / dataA.income) * 100) : 0;

  const barData = (confrontoAValid && confrontoBValid) ? buildComparisonBarData(dataA, dataB) : [];
  const pieDataA = confrontoAValid ? buildPiePeriodData(dataA.byCategory) : [];
  const pieDataB = confrontoBValid ? buildPiePeriodData(dataB.byCategory) : [];

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

      <div className="chart-card chart-card-full">
        <h2>Andamento saldo (ultimi 12 mesi)</h2>
        {balanceData.length === 0
          ? <p className="chart-empty">Nessun dato disponibile.</p>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <ReferenceLine y={0} stroke="#e5e7eb" />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6366f1' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )
        }
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

      <div className="chart-card chart-card-full">
        <h2>Confronto periodi</h2>

        <div className="confronto-selectors">
          <div className="confronto-period-row">
            <span className="confronto-label a">A</span>
            <span className="confronto-from-label">Da</span>
            <select value={periodA.fromMonth} onChange={(e) => setPeriodA((p) => ({ ...p, fromMonth: e.target.value }))}>
              <option value="">Mese</option>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <select value={periodA.fromYear} onChange={(e) => setPeriodA((p) => ({ ...p, fromYear: e.target.value }))}>
              <option value="">Anno</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="confronto-to-label">a</span>
            <select value={periodA.toMonth} onChange={(e) => setPeriodA((p) => ({ ...p, toMonth: e.target.value }))}>
              <option value="">Mese</option>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <select value={periodA.toYear} onChange={(e) => setPeriodA((p) => ({ ...p, toYear: e.target.value }))}>
              <option value="">Anno</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="confronto-vs">VS</div>

          <div className="confronto-period-row">
            <span className="confronto-label b">B</span>
            <span className="confronto-from-label">Da</span>
            <select value={periodB.fromMonth} onChange={(e) => setPeriodB((p) => ({ ...p, fromMonth: e.target.value }))}>
              <option value="">Mese</option>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <select value={periodB.fromYear} onChange={(e) => setPeriodB((p) => ({ ...p, fromYear: e.target.value }))}>
              <option value="">Anno</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="confronto-to-label">a</span>
            <select value={periodB.toMonth} onChange={(e) => setPeriodB((p) => ({ ...p, toMonth: e.target.value }))}>
              <option value="">Mese</option>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <select value={periodB.toYear} onChange={(e) => setPeriodB((p) => ({ ...p, toYear: e.target.value }))}>
              <option value="">Anno</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {confrontoAValid && confrontoBValid ? (
          <>
            <div className="confronto-cards">
              <div className="confronto-card a">
                <div className="cc-label a">{labelA}</div>
                <div className="cc-row"><span>Entrate</span><strong className="cc-income">{fmt(dataA.income)}</strong></div>
                <div className="cc-row"><span>Uscite</span><strong className="cc-expense">{fmt(dataA.expense)}</strong></div>
                <div className="cc-row cc-balance">
                  <span>Saldo</span>
                  <strong style={{ color: dataA.income - dataA.expense >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(dataA.income - dataA.expense)}
                  </strong>
                </div>
              </div>
              <div className="confronto-card b">
                <div className="cc-label b">{labelB}</div>
                <div className="cc-row"><span>Entrate</span><strong className="cc-income">{fmt(dataB.income)}</strong></div>
                <div className="cc-row"><span>Uscite</span><strong className="cc-expense">{fmt(dataB.expense)}</strong></div>
                <div className="cc-row cc-balance">
                  <span>Saldo</span>
                  <strong style={{ color: dataB.income - dataB.expense >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(dataB.income - dataB.expense)}
                  </strong>
                </div>
              </div>
            </div>

            {(dataA.expense > 0 || dataB.expense > 0) && (
              <div className="confronto-delta">
                <span>Uscite:</span>
                <span className={deltaExpense >= 0 ? 'delta-up' : 'delta-down'}>
                  {deltaExpense >= 0 ? '+' : ''}{fmt(deltaExpense)}
                  {dataA.expense > 0 && ` (${deltaExpense >= 0 ? '+' : ''}${deltaExpensePct}%)`}
                </span>
                <span className="confronto-delta-sep">·</span>
                <span>Entrate:</span>
                <span className={deltaIncome >= 0 ? 'delta-down' : 'delta-up'}>
                  {deltaIncome >= 0 ? '+' : ''}{fmt(deltaIncome)}
                  {dataA.income > 0 && ` (${deltaIncome >= 0 ? '+' : ''}${deltaIncomePct}%)`}
                </span>
              </div>
            )}

            {(barData.length > 0 || pieDataA.length > 0) && (
              <>
                <div className="confronto-chart-toggle">
                  <button
                    className={`ctoggle-btn ${confrontoChart === 'bar' ? 'active' : ''}`}
                    onClick={() => setConfrontoChart('bar')}
                    title="Barre raggruppate"
                  >▦</button>
                  <button
                    className={`ctoggle-btn ${confrontoChart === 'pie' ? 'active' : ''}`}
                    onClick={() => setConfrontoChart('pie')}
                    title="Torte affiancate"
                  >◉</button>
                </div>

                {confrontoChart === 'bar' && (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} barGap={4}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="A" name={labelA} fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="B" name={labelB} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {confrontoChart === 'pie' && (
                  <div className="confronto-pies">
                    <div className="confronto-pie-wrap">
                      <div className="confronto-pie-title a">{labelA}</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieDataA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                            {pieDataA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmt(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <ul className="pie-legend">
                        {pieDataA.map((d, i) => (
                          <li key={d.name}>
                            <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="pie-label">{d.name}</span>
                            <span className="pie-value">{fmt(d.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="confronto-pie-wrap">
                      <div className="confronto-pie-title b">{labelB}</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieDataB} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                            {pieDataB.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmt(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <ul className="pie-legend">
                        {pieDataB.map((d, i) => (
                          <li key={d.name}>
                            <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="pie-label">{d.name}</span>
                            <span className="pie-value">{fmt(d.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}

            {barData.length === 0 && pieDataA.length === 0 && (
              <p className="chart-empty">Nessuna spesa nei periodi selezionati.</p>
            )}
          </>
        ) : (
          <p className="chart-empty">Seleziona entrambi i periodi per visualizzare il confronto.</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import GraficiPage from './GraficiPage';
import SalvadanaiPage from './SalvadanaiPage';
import ImpostazioniPage from './ImpostazioniPage';
import NotificationBell from './NotificationBell';
import InstallButton from './InstallButton';
import './Dashboard.css';

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DEFAULT_INCOME  = ['Stipendio', 'Freelance', 'Regalo', 'Investimenti', 'Altro'];
const DEFAULT_EXPENSE = ['Cibo', 'Trasporti', 'Casa', 'Abbigliamento', 'Svago', 'Salute', 'Sport', 'Abbonamenti', 'Risparmio', 'Lavoro', 'Altro'];
const NAV = [
  { id: 'movimenti',    label: 'Movimenti',    icon: '↕' },
  { id: 'salvadanai',   label: 'Salvadanai',   icon: '🐷' },
  { id: 'grafici',      label: 'Grafici',       icon: '📊' },
  { id: 'impostazioni', label: 'Impostazioni',  icon: '⚙️' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesIncome, setCategoriesIncome] = useState(DEFAULT_INCOME);
  const [categoriesExpense, setCategoriesExpense] = useState(DEFAULT_EXPENSE);
  const [page, setPage] = useState('movimenti');

  const [accordionOpen, setAccordionOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc')),
      (snap) => { setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
    const unsub2 = onSnapshot(
      query(collection(db, 'users', user.uid, 'wallets'), orderBy('createdAt')),
      (snap) => setWallets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'categories'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.income?.length)  setCategoriesIncome(data.income);
          if (data.expense?.length) setCategoriesExpense(data.expense);
        }
      }
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user.uid]);

  const years = [...new Set(transactions.map((t) => t.date.split('-')[0]))].sort().reverse();

  const availableCategories = [...new Set(
    transactions
      .filter((t) => filterType === '' || t.type === filterType)
      .map((t) => t.category)
  )].sort();

  const handleTypeChange = (val) => { setFilterType(val); setFilterCategory(''); };

  const filtersActive = filterMonth !== '' || filterYear !== '' || filterType !== '' || filterCategory !== '' || filterSearch !== '';

  const displayed = filtersActive
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

  const totalIncome  = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalIncome - totalExpense;


  const clearFilters = () => { setFilterMonth(''); setFilterYear(''); setFilterType(''); setFilterCategory(''); setFilterSearch(''); };

  const activeBadges = [
    filterMonth !== '' && MONTHS[Number(filterMonth)],
    filterYear,
    filterType === 'income' && 'Entrate',
    filterType === 'expense' && 'Uscite',
    filterCategory,
    filterSearch && `"${filterSearch}"`,
  ].filter(Boolean);

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-title">
          <span className="dash-logo">💰</span>
          <span>Finance Tracker</span>
        </div>
        <div className="dash-user">
          <InstallButton />
          <NotificationBell />
          <img src={user.photoURL} alt="" className="avatar" />
          <button className="btn-logout" onClick={logout}>Esci</button>
          <button className="btn-burger" onClick={() => setBurgerOpen((v) => !v)} aria-label="Menu">
            <span className={`burger-icon ${burgerOpen ? 'open' : ''}`} />
          </button>
        </div>
      </header>

      <nav className={`mobile-nav ${burgerOpen ? 'open' : ''}`}>
        <ul>
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                className={page === item.id ? 'active' : ''}
                onClick={() => { setPage(item.id); setBurgerOpen(false); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="dash-body">
        <Sidebar active={page} onChange={setPage} />

        <main className="dash-content">
          {page === 'movimenti' && (
            <>
              <div className="summary-grid">
                <div className="summary-card balance">
                  <span className="summary-label">Saldo totale</span>
                  <span className="summary-value">{fmt(totalBalance)}</span>
                </div>
                <div className="summary-card income">
                  <span className="summary-label">Entrate totali</span>
                  <span className="summary-value">{fmt(totalIncome)}</span>
                </div>
                <div className="summary-card expense">
                  <span className="summary-label">Uscite totali</span>
                  <span className="summary-value">{fmt(totalExpense)}</span>
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

              <div className="dash-grid">
                <TransactionForm wallets={wallets} categoriesIncome={categoriesIncome} categoriesExpense={categoriesExpense} />
                <TransactionList transactions={displayed} loading={loading} />
              </div>
            </>
          )}

          {page === 'salvadanai' && (
            <SalvadanaiPage wallets={wallets} transactions={transactions} />
          )}

          {page === 'grafici' && (
            <GraficiPage transactions={transactions} wallets={wallets} />
          )}

          {page === 'impostazioni' && (
            <ImpostazioniPage categoriesIncome={categoriesIncome} categoriesExpense={categoriesExpense} />
          )}

          <footer className="dash-footer">v{__APP_VERSION__}</footer>
        </main>
      </div>
    </div>
  );
}

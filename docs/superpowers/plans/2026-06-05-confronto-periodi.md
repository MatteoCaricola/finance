# Confronto Periodi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una sezione "Confronto periodi" in fondo a GraficiPage che permette di confrontare entrate/uscite/categorie tra due range di mesi selezionabili liberamente.

**Architecture:** Tutto il codice vive in `GraficiPage.jsx` e `GraficiPage.css` — nessun nuovo file. Quattro pure functions di data-building vengono aggiunte prima del componente. Lo stato Confronto è locale al componente. I grafici usano Recharts già importato (BarChart, PieChart già presenti).

**Tech Stack:** React 18, Recharts 3, CSS vanilla. Zero nuove dipendenze.

---

> **Nota:** nessun test runner nel progetto. Verifica manuale via `npm run dev`.

---

### Task 1: Aggiungi le funzioni helper di data-building

**Files:**
- Modify: `src/components/GraficiPage.jsx` — inserisci 4 funzioni pure dopo `buildCategoryData` (riga 54), prima di `export default function GraficiPage`

- [ ] **Step 1: Inserisci le 4 funzioni dopo la riga 54 (`}` di chiusura di `buildCategoryData`)**

Aggiungi questo blocco tra la fine di `buildCategoryData` e l'inizio di `export default function GraficiPage`:

```js
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
```

- [ ] **Step 2: Avvia dev server e verifica che non ci siano errori di compilazione**

```bash
npm run dev
```

Nessun errore atteso. Le funzioni sono pure e non toccano il resto del componente.

- [ ] **Step 3: Commit**

```bash
git add src/components/GraficiPage.jsx
git commit -m "feat: aggiungi helper buildPeriodData, buildComparisonBarData, buildPiePeriodData, periodLabel"
```

---

### Task 2: Aggiungi stato Confronto e sezione JSX

**Files:**
- Modify: `src/components/GraficiPage.jsx` — stato dopo riga 68, computed dopo riga 129, JSX prima della riga 309 (`</div>` finale)

- [ ] **Step 1: Aggiungi lo stato Confronto dopo le righe di stato esistenti (dopo riga 68, prima di `useEffect`)**

Inserisci dopo `const [filterSearch, setFilterSearch] = useState('');`:

```js
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
```

- [ ] **Step 2: Aggiungi i valori computati del Confronto dopo `balanceData` (dopo riga 129)**

Inserisci dopo `const balanceData = buildBalanceData(fundFiltered);`:

```js
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
```

- [ ] **Step 3: Aggiungi il JSX della sezione Confronto prima della chiusura `</div>` del componente (prima della riga 309)**

Inserisci dopo `</div>` della notes-card e prima del `</div>` che chiude `grafici-page`:

```jsx
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
```

- [ ] **Step 4: Verifica compilazione**

```bash
npm run dev
```

Naviga su Grafici. In fondo alla pagina deve apparire la nuova card "Confronto periodi" con i selettori precompilati con il mese precedente (A) e il mese corrente (B). Se ci sono dati, vedi subito le card sommario e il grafico a barre.

- [ ] **Step 5: Commit**

```bash
git add src/components/GraficiPage.jsx
git commit -m "feat: aggiungi sezione Confronto periodi in GraficiPage"
```

---

### Task 3: Aggiungi CSS per la sezione Confronto

**Files:**
- Modify: `src/components/GraficiPage.css` — aggiungi in fondo al file

- [ ] **Step 1: Aggiungi in fondo a `src/components/GraficiPage.css`**

```css
/* ---- Confronto periodi ---- */

.confronto-selectors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.confronto-period-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.confronto-label {
  font-size: 12px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.confronto-label.a { background: #ede9fe; color: #6d28d9; }
.confronto-label.b { background: #fef3c7; color: #b45309; }

.confronto-from-label,
.confronto-to-label {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

.confronto-period-row select {
  padding: 6px 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.confronto-period-row select:focus { border-color: #6366f1; }

.confronto-vs {
  font-size: 12px;
  font-weight: 700;
  color: #9ca3af;
  text-align: center;
  letter-spacing: 1px;
  padding: 2px 0;
}

/* Summary cards */

.confronto-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.confronto-card {
  border-radius: 10px;
  padding: 14px 16px;
  border: 2px solid;
}

.confronto-card.a { border-color: #6366f1; background: #f5f3ff; }
.confronto-card.b { border-color: #f59e0b; background: #fffbeb; }

.cc-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.cc-label.a { color: #6d28d9; }
.cc-label.b { color: #b45309; }

.cc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #374151;
  padding: 3px 0;
}

.cc-balance {
  border-top: 1px solid #e5e7eb;
  margin-top: 4px;
  padding-top: 6px;
}

.cc-income { color: #10b981; }
.cc-expense { color: #ef4444; }

/* Delta row */

.confronto-delta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  background: #f9fafb;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #374151;
  margin-bottom: 12px;
}

.confronto-delta-sep { color: #d1d5db; }

.delta-up   { color: #ef4444; font-weight: 600; }
.delta-down { color: #10b981; font-weight: 600; }

/* Chart toggle */

.confronto-chart-toggle {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.ctoggle-btn {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: #6b7280;
}

.ctoggle-btn:hover { border-color: #6366f1; color: #6366f1; }
.ctoggle-btn.active { border-color: #6366f1; background: #f5f3ff; color: #6366f1; }

/* Pie charts side by side */

.confronto-pies {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}

.confronto-pie-wrap {
  display: flex;
  flex-direction: column;
}

.confronto-pie-title {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.confronto-pie-title.a { color: #6d28d9; }
.confronto-pie-title.b { color: #b45309; }

/* Responsive */

@media (max-width: 600px) {
  .confronto-cards  { grid-template-columns: 1fr; }
  .confronto-pies   { grid-template-columns: 1fr; }
  .confronto-delta  { flex-direction: column; align-items: flex-start; gap: 4px; }
}
```

- [ ] **Step 2: Verifica visiva nel browser**

Con dev server attivo, naviga su Grafici e scorri fino a "Confronto periodi". Verifica:
- Card sommario A (sfondo viola tenue) e B (sfondo giallo tenue) affiancate
- Riga delta con colori (rosso = aumento uscite, verde = calo)
- Icone toggle ▦ / ◉ in alto a destra del grafico
- Cliccando ◉ appare il layout torte affiancate
- Su mobile le card si impilano verticalmente

- [ ] **Step 3: Commit**

```bash
git add src/components/GraficiPage.css
git commit -m "style: CSS sezione Confronto periodi"
```

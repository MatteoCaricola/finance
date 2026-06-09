# Report CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un pulsante "Esporta CSV" in TransactionList che scarica le transazioni attualmente visualizzate (già filtrate da Dashboard) in formato CSV compatibile con Excel/Sheets.

**Architecture:** Funzione pura `buildCsv(transactions)` in `src/utils/exportCsv.js` che converte un array di transazioni in stringa CSV con BOM UTF-8. Il pulsante in `TransactionList.jsx` chiama questa funzione e triggera il download via Blob + `<a>` element temporaneo. Nessuna dipendenza nuova.

**Tech Stack:** React 18, Vite 5, zero nuove dipendenze

---

## File Structure

| File | Azione | Responsabilità |
|---|---|---|
| `src/utils/exportCsv.js` | Create | Funzione `exportCsv(transactions)` — genera CSV e triggera download |
| `src/components/TransactionList.jsx` | Modify | Aggiunge pulsante "Esporta CSV" con click handler |
| `src/components/TransactionList.css` | Modify | Stile pulsante `.btn-export-csv` |

---

### Task 1: Utility exportCsv + pulsante + CSS

**Files:**
- Create: `src/utils/exportCsv.js`
- Modify: `src/components/TransactionList.jsx`
- Modify: `src/components/TransactionList.css`

#### Fase 1 — Crea `src/utils/exportCsv.js`

- [ ] **Step 1: Crea il file utility**

Colonne CSV: `Data,Tipo,Importo,Categoria,Descrizione,Da (wallet),A (wallet)`

Regole:
- `Tipo`: `income` → `Entrata`, `expense` → `Uscita`, `transfer` → `Trasferimento`
- `Importo`: numero con punto decimale (non virgola), senza simbolo €
- `Da (wallet)` e `A (wallet)`: valorizzati solo per i transfer (`fromWalletName` / `walletName`)
- Ogni campo stringa: racchiuso tra doppie virgolette, le doppie virgolette interne raddoppiate (`""`)
- BOM UTF-8 (`﻿`) come primo carattere per compatibilità Excel
- Separatore: `,`
- Fine riga: `\n`

```js
const TYPE_LABEL = { income: 'Entrata', expense: 'Uscita', transfer: 'Trasferimento' };

function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportCsv(transactions) {
  const header = ['Data', 'Tipo', 'Importo', 'Categoria', 'Descrizione', 'Da (wallet)', 'A (wallet)'];

  const rows = transactions.map((t) => [
    t.date,
    TYPE_LABEL[t.type] ?? t.type,
    t.amount,
    t.category ?? '',
    t.description ?? '',
    t.type === 'transfer' ? (t.fromWalletName ?? '') : '',
    t.type === 'transfer' ? (t.walletName ?? '') : '',
  ].map(escapeCsvField).join(','));

  const csv = '﻿' + [header.map(escapeCsvField).join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transazioni_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### Fase 2 — Modifica `src/components/TransactionList.jsx`

- [ ] **Step 2: Importa `exportCsv` e aggiungi il pulsante**

Aggiungi import in cima al file (dopo gli import esistenti):

```js
import { exportCsv } from '../utils/exportCsv';
```

Modifica il JSX: wrappa `<h2>` in un div `.list-header` e affianca il pulsante export. Mostra il pulsante solo se ci sono transazioni (`transactions.length > 0`).

Sostituisci:
```jsx
return (
  <div className="list-card">
    <h2>Transazioni</h2>
```

Con:
```jsx
return (
  <div className="list-card">
    <div className="list-header">
      <h2>Transazioni</h2>
      <button className="btn-export-csv" onClick={() => exportCsv(transactions)} title="Esporta CSV">
        ⬇ CSV
      </button>
    </div>
```

**Attenzione:** il guard `if (!transactions.length)` che restituisce il messaggio "Nessuna transazione" viene prima di questo blocco — lascialo dove sta. Il pulsante appare solo quando ci sono transazioni da esportare, il che è corretto.

#### Fase 3 — Stile in `TransactionList.css`

- [ ] **Step 3: Aggiungi CSS per `.list-header` e `.btn-export-csv`**

Appendi in fondo a `src/components/TransactionList.css`:

```css
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.list-header h2 {
  margin: 0;
}

.btn-export-csv {
  font-size: 0.75rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--border, #e5e7eb);
  background: transparent;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-export-csv:hover {
  background: var(--accent, #6366f1);
  color: #fff;
  border-color: var(--accent, #6366f1);
}
```

#### Fase 4 — Commit

- [ ] **Step 4: Commit**

```bash
git add src/utils/exportCsv.js src/components/TransactionList.jsx src/components/TransactionList.css
git commit -m "feat: aggiungi export CSV transazioni filtrate"
```

---

## Comportamento atteso

- Cliccando "⬇ CSV" nell'header della lista transazioni si scarica un file `transazioni_YYYY-MM-DD.csv`
- Il CSV contiene le transazioni **attualmente visibili** (già filtrate da Dashboard, non tutte)
- Aprendolo in Excel o Google Sheets le colonne sono leggibili grazie al BOM UTF-8
- Caratteri accentati e virgolette nelle descrizioni sono gestiti correttamente
- Il pulsante non appare se non ci sono transazioni (l'early return gestisce questo caso)

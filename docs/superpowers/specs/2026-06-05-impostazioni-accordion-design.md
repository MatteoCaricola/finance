# Impostazioni — Refactor Accordion

**Data:** 2026-06-05  
**Stato:** Approvato

## Problema

La pagina `ImpostazioniPage.jsx` presenta tutti i pannelli (categorie entrate, categorie uscite, budget, notifiche, ricorrenti) piatti sulla stessa pagina senza gerarchia visiva, creando confusione nell'utente.

## Soluzione

Raggruppare il contenuto in 4 sezioni accordion espandibili/collassabili.

## Struttura delle sezioni

| Ordine | Icon | Titolo | Contenuto |
|--------|------|--------|-----------|
| 1 | 🏷 | Categorie | Due subsection: Entrate (chip verdi + input aggiungi) e Uscite (chip rosse + input aggiungi) |
| 2 | 📊 | Budget mensile | Lista budget esistenti con rimozione + form aggiungi nuovo |
| 3 | 🔔 | Notifiche | Toggle abilita/disabilita notifiche push |
| 4 | 🔁 | Ricorrenti | Lista transazioni ricorrenti con pulsante elimina |

## Comportamento

- **Stato iniziale:** tutti gli accordion chiusi al mount
- **Multi-open:** ogni sezione si apre/chiude indipendentemente — aprire una sezione non chiude le altre
- **Badge conteggio:** sugli accordion chiusi viene mostrato un conteggio grigio in header (es. "Categorie · 12", "Budget · 3") per dare visibilità al contenuto senza aprire
- **Transizione:** espansione/collasso con CSS transition smooth

## Implementazione tecnica

**File coinvolti:**
- `src/components/ImpostazioniPage.jsx` — refactor layout
- `src/components/ImpostazioniPage.css` — nuovi stili accordion

**Stato accordion:**
```js
const [open, setOpen] = useState([]);
const toggle = (id) => setOpen(prev =>
  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
);
const isOpen = (id) => open.includes(id);
```

**Struttura JSX per ogni accordion:**
```jsx
<div className={`settings-accordion ${isOpen('categorie') ? 'open' : ''}`}>
  <button className="acc-header" onClick={() => toggle('categorie')}>
    <span className="acc-icon">🏷</span>
    <span className="acc-title">Categorie</span>
    {!isOpen('categorie') && <span className="acc-badge">· {totalCategories}</span>}
    <span className="acc-arrow">{isOpen('categorie') ? '▲' : '▼'}</span>
  </button>
  {isOpen('categorie') && (
    <div className="acc-body">
      {/* contenuto */}
    </div>
  )}
</div>
```

**CSS chiave:**
- `.settings-accordion` — border-top separatore tra sezioni
- `.acc-header` — flex row, padding, hover background
- `.acc-body` — background `#fafafa`, padding, border-top sottile
- `.acc-badge` — font-size piccolo, colore grigio

**Nessuna dipendenza nuova.** Solo refactor di JSX e CSS esistenti.

## Scope

Questo refactor riguarda **solo layout e UX**. Non sono in scope:
- Fix categorie orfane (eliminazione categoria non aggiorna transazioni esistenti)
- Edit transazioni ricorrenti (attualmente solo delete)
- Reordering categorie

Questi rimangono come problemi tecnici noti da valutare in un secondo momento.

# Impostazioni — Refactor Accordion + Fix UX

**Data:** 2026-06-05  
**Stato:** Approvato

## Problema

La pagina `ImpostazioniPage.jsx` presenta tutti i pannelli (categorie entrate, categorie uscite, budget, notifiche, ricorrenti) piatti sulla stessa pagina senza gerarchia visiva, creando confusione nell'utente. Sono presenti anche tre problemi UX/tecnici secondari risolti in questo stesso refactor.

## Soluzione

Quattro interventi in un unico rilascio:

1. **Accordion layout** — le sezioni vengono raggruppate in accordion espandibili
2. **Warning categorie orfane** — modale di conferma prima di eliminare una categoria usata da transazioni esistenti
3. **Edit ricorrenti** — form di modifica inline per le transazioni ricorrenti
4. **Drag and drop categorie** — riordinamento tramite drag via @dnd-kit

---

## 1. Accordion layout

### Struttura delle sezioni

| Ordine | Icon | Titolo | Contenuto |
|--------|------|--------|-----------|
| 1 | 🏷 | Categorie | Due subsection: Entrate (chip verdi + input aggiungi + drag) e Uscite (chip rosse + input aggiungi + drag) |
| 2 | 📊 | Budget mensile | Lista budget esistenti con rimozione + form aggiungi nuovo |
| 3 | 🔔 | Notifiche | Toggle abilita/disabilita notifiche push |
| 4 | 🔁 | Ricorrenti | Lista transazioni ricorrenti con pulsanti edit e delete |

### Comportamento

- **Stato iniziale:** tutti gli accordion chiusi al mount
- **Multi-open:** ogni sezione si apre/chiude indipendentemente
- **Badge conteggio:** sugli accordion chiusi viene mostrato un conteggio grigio (es. "Categorie · 12", "Budget · 3")
- **Transizione:** espansione/collasso con CSS transition smooth

### Stato accordion

```js
const [open, setOpen] = useState([]);
const toggle = (id) => setOpen(prev =>
  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
);
const isOpen = (id) => open.includes(id);
```

---

## 2. Warning categorie orfane

### Comportamento

Prima di eliminare una categoria, controllare quante transazioni la usano cercando nell'array `transactions` passato come prop (o richiesto da Firestore).

- Se **0 transazioni** → elimina direttamente, nessun modale
- Se **≥ 1 transazione** → mostra modale di conferma:

> **Eliminare "Cibo"?**  
> Ci sono 14 transazioni che usano questa categoria. Eliminandola, quelle transazioni manterranno l'etichetta "Cibo" ma non sarà più selezionabile per le nuove transazioni.  
> [Annulla] [Elimina comunque]

### Comportamento post-eliminazione

Le transazioni esistenti **mantengono il valore originale della categoria** — non vengono migrate. La categoria viene solo rimossa dalla lista in Firestore (`settings/categories`). Le transazioni con quella categoria restano leggibili e filtrabili.

### Prop aggiuntiva necessaria

`ImpostazioniPage` deve ricevere `transactions` come prop da `Dashboard` per contare le occorrenze. Questa prop è già disponibile in Dashboard.

---

## 3. Edit ricorrenti inline

### Comportamento

Nella sezione Ricorrenti, ogni item ha due pulsanti: ✏️ (edit) e × (delete).

Cliccando ✏️, l'item si espande mostrando un form inline precompilato con i valori attuali (stesso pattern di `SalvadanaiPage` per l'edit dell'obiettivo). I campi editabili:
- Importo
- Categoria
- Descrizione
- Frequenza (giornaliera / settimanale / mensile)
- Giorno della settimana o giorno del mese (condizionale sulla frequenza)

Salvataggio tramite `updateDoc` sulla collection `users/{uid}/recurring/{id}`.

### Stato locale

```js
const [editingRecurring, setEditingRecurring] = useState(null); // id della ricorrente in modifica
const [editFields, setEditFields] = useState({});
```

---

## 4. Drag and drop categorie

### Libreria

`@dnd-kit` — moderna, leggera (~25KB gzipped), accessibile, funziona su mobile via touch.

Pacchetti da installare:
```
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Comportamento

Le chip di categoria (entrate e uscite) sono trascinabili per riordinarle. L'ordine viene salvato su Firestore al rilascio (`onDragEnd`).

Poiché le categorie sono semplici stringhe in un array, l'ordine è definito dall'indice dell'array stesso. `arrayMove` di `@dnd-kit/sortable` viene usato per ricalcolare l'array e `setDoc` per salvarlo.

### Struttura

```jsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';

// Ogni chip è un componente SortableCategoryPill({ id, label, onRemove })
// DndContext wrappa la lista, onDragEnd chiama arrayMove + saveCategories
```

---

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/ImpostazioniPage.jsx` | Refactor completo del layout + logica edit ricorrenti + logica warning orfane |
| `src/components/ImpostazioniPage.css` | Nuovi stili: accordion, chip drag handle, form edit ricorrenti |
| `src/components/Dashboard.jsx` | Passa `transactions` come prop a `ImpostazioniPage` |
| `package.json` | Aggiunta `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

---

## Fuori scope

- Migrazione automatica delle transazioni orfane a "Altro"
- Reordering dei budget
- Reordering delle ricorrenti

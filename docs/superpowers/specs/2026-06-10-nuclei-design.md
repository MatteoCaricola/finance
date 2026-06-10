# Nuclei — Design Spec

## Obiettivo

Aggiungere la possibilità di creare gruppi condivisi ("nuclei") tra utenti dell'app. Ogni utente mantiene i propri dati privati invariati, ma può scegliere quali transazioni condividere con i membri del nucleo. Il nucleo ha una pagina dedicata con lista transazioni, riepilogo per membro, e i dati del nucleo sono visualizzabili anche nella sezione Grafici.

---

## Architettura

### Struttura Firestore

La struttura `users/{uid}/` esistente resta **completamente invariata**.

Si aggiunge una nuova collezione parallela:

```
nuclei/{nid}/
  name          string       es. "Casa mia", "Coinquilini 2024"
  createdBy     uid
  members       uid[]        tutti i membri incluso il creatore
  inviteCode    string       codice univoco casuale per il link di invito
  createdAt     timestamp

nuclei/{nid}/transactions/{txId}/
  originalTxId  string       punta a users/{uid}/transactions/{txId}
  ownerUid      string       uid di chi ha condiviso la transazione
  ownerName     string       nome visualizzato (da user.displayName)
  amount        number
  category      string
  description   string
  date          string       YYYY-MM-DD
  type          string       income | expense | transfer
  createdAt     timestamp
```

### Security Rules Firestore

- `nuclei/{nid}` — leggibile e scrivibile solo se `request.auth.uid` è in `members[]`
- `nuclei/{nid}/transactions/{txId}` — leggibile da tutti i membri; scrivibile e cancellabile solo se `ownerUid == request.auth.uid`

### Strategia copia + sync (Approccio C)

Quando una transazione viene condivisa, i suoi dati vengono **copiati** in `nuclei/{nid}/transactions/` con campo `originalTxId` che punta all'originale.

**Sync su eliminazione:** quando l'utente elimina una transazione originale (da `TransactionList.jsx`), il codice cerca in tutti i nuclei dell'utente le copie con `originalTxId == txId` e `ownerUid == uid` e le rimuove automaticamente.

> Nota: l'app attuale non ha funzione di modifica transazione (solo eliminazione), quindi il sync su modifica non è necessario in questa versione.

---

## Navigazione

Nuova voce **👥 Nuclei** aggiunta alla sidebar e al menu mobile, tra Grafici e Impostazioni.

```
NAV = [
  { id: 'movimenti',    label: 'Movimenti',    icon: '↕'  },
  { id: 'salvadanai',   label: 'Salvadanai',   icon: '🐷' },
  { id: 'grafici',      label: 'Grafici',       icon: '📊' },
  { id: 'nuclei',       label: 'Nuclei',        icon: '👥' },
  { id: 'impostazioni', label: 'Impostazioni',  icon: '⚙️' },
]
```

---

## Pagine e Componenti

### `NucleiPage.jsx`

Lista dei nuclei di cui l'utente fa parte. Ogni nucleo mostra nome, numero di membri e numero di transazioni condivise. Pulsante "+ Nuovo" in alto a destra apre un form inline per inserire il nome del nucleo.

Alla creazione:
1. Genera un `inviteCode` casuale (8 caratteri alfanumerici)
2. Scrive il documento `nuclei/{nid}` con `members: [uid]`, `createdBy: uid`, `inviteCode`
3. Naviga al dettaglio del nucleo appena creato

### `NucleoDetailPage.jsx`

Pagina interna al nucleo. Struttura:

- **Header** — nome nucleo, pulsante "← I tuoi nuclei", pulsante "⬆ Condividi" che chiama `navigator.share({ url, title })` con fallback copia link
- **Riepilogo mese** — card con totale uscite per ciascun membro del mese corrente
- **Lista transazioni condivise** — ordinata per data decrescente, ogni riga mostra: dot colorato per tipo, categoria, nome del membro che l'ha condivisa, data, importo. Solo il proprietario (`ownerUid == uid`) vede il pulsante elimina sulla sua transazione.
- **Pulsante "Aggiungi dal mio storico"** — apre un pannello/modal con le transazioni personali dell'utente non ancora condivise in questo nucleo. L'utente seleziona quelle da aggiungere e conferma.

### `JoinFlow` (in `Dashboard.jsx`)

Al mount, `Dashboard` controlla se l'URL contiene il parametro `?join={inviteCode}`.

Se presente:
1. Cerca in Firestore il nucleo con `inviteCode` corrispondente
2. Se trovato e l'utente non è già membro: aggiunge l'uid a `members[]`
3. Mostra un popup modale: "🎉 Sei entrato in '{nome nucleo}'! Ora puoi vedere e condividere transazioni con i membri del nucleo." con pulsante "Vai al nucleo →" che naviga a `page: 'nuclei'` e rimuove il param dall'URL
4. Se l'utente era già membro: mostra "Sei già membro di questo nucleo" con stesso pulsante
5. Se il codice non esiste: mostra errore "Link non valido o scaduto"

---

## Condivisione Transazioni

### Checkbox nel form (`TransactionForm.jsx`)

In fondo al form di inserimento, se l'utente fa parte di almeno un nucleo, appare una sezione **accordion** collassata con label "Condividi nel nucleo".

Espandendo, mostra una checkbox per ciascun nucleo di cui l'utente è membro:
- `☐ Aggiungi a 🏠 Casa mia`
- `☐ Aggiungi a 🎉 Coinquilini 2024`

Al submit, per ogni nucleo spuntato: scrive una copia della transazione in `nuclei/{nid}/transactions/` con `originalTxId`, `ownerUid`, `ownerName`.

### Aggiungi dallo storico (`NucleoDetailPage.jsx`)

Pulsante nell'header della lista transazioni del nucleo. Apre un pannello con le transazioni personali dell'utente (da `users/{uid}/transactions/`) **filtrate** per escludere quelle già condivise in questo nucleo (confronto per `originalTxId`). L'utente seleziona quelle da aggiungere e clicca "Aggiungi N transazioni selezionate".

### Sync su eliminazione (`TransactionList.jsx`)

L'eliminazione di una transazione avviene in `TransactionList.jsx` via `handleDelete`. Dopo aver eliminato il documento originale, il codice interroga tutti i nuclei dell'utente per trovare copie con `originalTxId == id` e `ownerUid == uid` e le elimina.

---

## Integrazione Grafici (`GraficiPage.jsx`)

Nella riga dei chip "Visualizza dati di", dopo un separatore visivo, viene aggiunto un chip per ciascun nucleo di cui l'utente fa parte:

```
[ Tutti i fondi ] [ Generale ] [ 🐷 Casa ] | [ 👥 Casa mia ]
```

Quando un chip nucleo è selezionato:
- I grafici usano le transazioni di `nuclei/{nid}/transactions/` invece di quelle personali
- Appare un filtro aggiuntivo "Filtra per membro" con chip: `[ Tutti ] [ Matteo ] [ Giulia ]`
- I grafici esistenti (entrate/uscite, torta categorie, andamento saldo, confronto periodi) funzionano senza modifiche perché accettano qualsiasi array di transazioni

---

## Decomposizione implementativa

Questa feature verrà implementata in 4 blocchi sequenziali, ognuno con la sua implementation plan:

| Blocco | Contenuto |
|--------|-----------|
| **1 — Foundation** | Struttura Firestore, security rules, subscription nuclei in Dashboard, join flow |
| **2 — Pagine Nuclei** | NucleiPage + NucleoDetailPage + navigazione sidebar |
| **3 — Condivisione** | Accordion in TransactionForm + pannello "storico" + sync modifica/eliminazione |
| **4 — Grafici** | Chip nucleo + filtro per membro in GraficiPage |

Ogni blocco è deployabile e testabile indipendentemente prima di procedere al successivo.

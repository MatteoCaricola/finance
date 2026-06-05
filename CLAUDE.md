# Finance Tracker — Contesto per Claude

## Stack
- **Frontend:** React 18 + Vite 5
- **Backend/DB:** Firebase 12 (Firestore + Google Auth)
- **Grafici:** Recharts 3
- **Deploy:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- **PWA:** `vite-plugin-pwa` + Workbox; notifiche push Web Push API nativa (non Firebase Messaging)
- **Versione attuale:** 1.0.4

## Variabili d'ambiente
Credenziali Firebase in `.env` locale (non nel repo) e GitHub Secrets per il deploy.
Vite richiede prefisso `VITE_` per esporre al browser. La VAPID key è hardcoded in `sw.js` per compatibilità GitHub Pages.

## Struttura Firestore
```
users/{uid}/transactions/{txId}   — transazioni (income/expense/transfer)
users/{uid}/wallets/{walletId}    — salvadanai
users/{uid}/recurring/{recId}     — transazioni ricorrenti
users/{uid}/settings/categories   — { income: [...], expense: [...] }
users/{uid}/settings/budgets      — { [categoria]: limite€ }
users/{uid}/data/notes            — { content: string }
```

## Struttura src/
```
firebase.js                    — init Firebase
contexts/AuthContext.jsx       — Google Auth state
components/
  Login.jsx                    — pagina login
  Dashboard.jsx                — layout principale, routing tra pagine, tutte le subscription Firestore
  Sidebar.jsx                  — nav desktop
  TransactionForm.jsx          — form aggiunta transazione (+ ricorrenti)
  TransactionList.jsx          — lista transazioni con eliminazione
  BudgetPanel.jsx              — barre budget mese corrente
  SalvadanaiPage.jsx           — salvadanai con obiettivi e movimenti
  GraficiPage.jsx              — 3 chart + note testuali
  ImpostazioniPage.jsx         — categorie, budget, notifiche push, ricorrenti
  NotificationBell.jsx         — campanellina notifiche
  NotificationPrompt.jsx       — banner primo consenso notifiche
  InstallButton.jsx            — pulsante installa PWA
hooks/usePushNotifications.js
utils/pushNotifications.js
sw.js                          — service worker (Workbox + push handler)
changelog.js
```

## Feature attive
- Transazioni entrate/uscite/trasferimento tra salvadanai
- Filtri (mese, anno, tipo, categoria, ricerca testo)
- Budget mensile per categoria con barre di avanzamento
- Salvadanai con saldo iniziale, obiettivo, e storico movimenti
- Transazioni ricorrenti (giornaliere/settimanali/mensili) — inserite automaticamente al login
- Grafici: entrate vs uscite ultimi 6 mesi, torta uscite per categoria, andamento saldo 12 mesi
- Filtri grafici + selezione fondo (tutti / generale / singolo salvadanaio)
- Appunti liberi nella sezione grafici
- Notifiche push Web Push (attivabili da impostazioni)
- PWA installabile

## Problemi tecnici noti
- **Dashboard.jsx è un god component** (310 righe): gestisce tutte le subscription Firestore, tutto lo stato applicativo, il routing e la logica ricorrenti. Da tenere a mente quando si aggiungono feature grosse — potrebbe valere un refactor in contesti futuri.
- **Logica filtri duplicata** tra `Dashboard.jsx` e `GraficiPage.jsx` (stesso accordion, stessa logica di filtraggio).
- **Categorie orfane**: eliminare una categoria non aggiorna le transazioni che la usano già.
- **Ricorrenti editabili**: nel form si possono solo eliminare e ricreare, non modificare.

---

## TODO list — analisi e priorità

### 1. Report CSV — PRIORITÀ ALTA, effort basso
Export delle transazioni filtrate in formato CSV. Zero dipendenze nuove, tutto client-side.
Utile per: tasse, analisi in Excel/Sheets, backup.
**Da fare subito.**

### 2. Confrontare spese mesi/anni/categorie — PRIORITÀ ALTA, effort medio
Aggiungere viste di confronto nella pagina Grafici:
- Anno corrente vs anno precedente (stesso mese)
- Confronto categorie su più mesi
- I dati ci sono già, serve solo nuova UI di selezione e nuovi dataset per Recharts.

### 3. IA auto-categorizzazione — PRIORITÀ MEDIA, effort medio
L'unica IA che vale la pena: scrivi una descrizione ("Esselunga cassa 3") e l'app suggerisce la categoria.
Richiede chiamata API (Claude o OpenAI) al submit del form. Piccolo costo per request.
**Da scopare bene il design prima di implementare.**

### 4. Sistemare impostazioni — PRIORITÀ MEDIA, effort basso/medio
Il problema principale è **visivo/UX**: tutti i pannelli (categorie entrate, categorie uscite, budget, notifiche, ricorrenti) sono "scaricati" nella stessa pagina senza gerarchia visiva, dà senso di confusione.
**Obiettivo:** raggruppare in sottosezioni chiare con separazione visiva (accordion, tab, o card con header ben distinto).
Problemi tecnici secondari (da valutare in scope):
- Categorie eliminabili anche se usate da transazioni esistenti
- Ricorrenti: solo delete, no edit

### 5. Nuclei famiglia / Condivisione conti / Condivisione salvadanai — PRIORITÀ BASSA, effort altissimo
Richiede re-architettura completa del data model Firestore (tutto è sotto `users/{uid}/`),
sistema di inviti, security rules, permessi per membro.
**Da non toccare finché le altre feature non sono consolidate.**

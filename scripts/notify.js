import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8')
);

const { PUSH } = await import('./pushMessage.js');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const messaging = getMessaging();

// Legge tutti i token FCM salvati
const snapshot = await db.collection('fcmTokens').get();
const tokens = snapshot.docs.map((d) => d.id).filter(Boolean);

if (tokens.length === 0) {
  console.log('Nessun token trovato. Nessuna notifica inviata.');
  process.exit(0);
}

console.log(`Invio notifica a ${tokens.length} dispositivo/i...`);
console.log(`Titolo: ${PUSH.title}`);
console.log(`Testo:  ${PUSH.body}`);

// Invia in batch (FCM accetta max 500 token per volta)
const BATCH = 500;
for (let i = 0; i < tokens.length; i += BATCH) {
  const batch = tokens.slice(i, i + BATCH);
  const response = await messaging.sendEachForMulticast({
    tokens: batch,
    notification: {
      title: PUSH.title,
      body: PUSH.body,
    },
    webpush: {
      notification: {
        icon: 'https://matteocaricola.github.io/finance/favicon.svg',
        badge: 'https://matteocaricola.github.io/finance/favicon.svg',
        requireInteraction: false,
      },
      fcmOptions: {
        link: 'https://matteocaricola.github.io/finance/',
      },
    },
  });

  console.log(`Batch ${Math.floor(i / BATCH) + 1}: ${response.successCount} ok, ${response.failureCount} falliti`);

  // Rimuove token non validi da Firestore
  const toDelete = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && (
      r.error?.code === 'messaging/invalid-registration-token' ||
      r.error?.code === 'messaging/registration-token-not-registered'
    )) {
      toDelete.push(batch[idx]);
    }
  });

  for (const token of toDelete) {
    await db.collection('fcmTokens').doc(token).delete();
    console.log(`Token rimosso (non valido): ${token.slice(0, 20)}...`);
  }
}

console.log('Notifica inviata con successo.');

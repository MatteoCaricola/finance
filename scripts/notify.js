import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
const { publicKey, privateKey } = JSON.parse(readFileSync(join(__dirname, 'vapidKeys.json'), 'utf8'));
const { PUSH } = await import('./pushMessage.js');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

webpush.setVapidDetails('mailto:matteo050903@gmail.com', publicKey, privateKey);

const snapshot = await db.collection('pushSubscriptions').get();

if (snapshot.empty) {
  console.log('Nessuna subscription trovata. Nessuna notifica inviata.');
  process.exit(0);
}

console.log(`Invio a ${snapshot.size} dispositivo/i...`);
console.log(`Titolo: ${PUSH.title}`);
console.log(`Testo:  ${PUSH.body}`);

const payload = JSON.stringify({ title: PUSH.title, body: PUSH.body, url: 'https://matteocaricola.github.io/finance/' });

for (const docSnap of snapshot.docs) {
  const { endpoint, keys } = docSnap.data();
  try {
    await webpush.sendNotification({ endpoint, keys }, payload);
    console.log(`✓ Inviata: ${endpoint.slice(-30)}`);
  } catch (err) {
    console.warn(`✗ Fallita (${err.statusCode}): ${endpoint.slice(-30)}`);
    if (err.statusCode === 410 || err.statusCode === 404) {
      await docSnap.ref.delete();
      console.log('  → Subscription rimossa (scaduta)');
    }
  }
}

console.log('Fatto.');

import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const PUBLIC_VAPID_KEY = 'BD9PD5DretSnu9QmJXjd0PCkc75q0x11B_KTpOHVn8STy9s77F3hVRNryrCC7E9J_dk-BDopj5IsKYbZbAgJqY4';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeAndSave(uid) {
  const swReg = await navigator.serviceWorker.ready;
  const existing = await swReg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();
  const subscription = await swReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
  });
  const sub = subscription.toJSON();
  const id = btoa(sub.endpoint).slice(-20);
  await setDoc(doc(db, 'pushSubscriptions', id), {
    uid,
    endpoint: sub.endpoint,
    keys: sub.keys,
    createdAt: serverTimestamp(),
  });
}

export async function unsubscribeAndRemove() {
  const swReg = await navigator.serviceWorker.ready;
  const subscription = await swReg.pushManager.getSubscription();
  if (!subscription) return;
  const sub = subscription.toJSON();
  const id = btoa(sub.endpoint).slice(-20);
  await subscription.unsubscribe();
  try { await deleteDoc(doc(db, 'pushSubscriptions', id)); } catch { /* già rimosso */ }
}

export async function getPushStatus() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
    return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  const swReg = await navigator.serviceWorker.ready;
  const sub = await swReg.pushManager.getSubscription();
  return sub ? 'enabled' : 'disabled';
}

import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './NotificationPrompt.css';

const PUBLIC_VAPID_KEY = 'BD9PD5DretSnu9QmJXjd0PCkc75q0x11B_KTpOHVn8STy9s77F3hVRNryrCC7E9J_dk-BDopj5IsKYbZbAgJqY4';
const DISMISSED_KEY = 'finance_notif_dismissed';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeAndSave(uid) {
  const swReg = await navigator.serviceWorker.register(
    import.meta.env.BASE_URL + 'firebase-messaging-sw.js'
  );
  await navigator.serviceWorker.ready;

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

export default function NotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    if (Notification.permission === 'granted') {
      subscribeAndSave(user.uid).catch((err) => console.warn('Push sub:', err));
      return;
    }

    if (Notification.permission === 'denied') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') await subscribeAndSave(user.uid);
    } catch (err) {
      console.warn('Errore notifiche:', err);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="notif-prompt">
      <span className="notif-prompt-icon">🔔</span>
      <span className="notif-prompt-text">Vuoi ricevere notifiche quando l'app si aggiorna?</span>
      <button className="notif-prompt-btn" onClick={handleEnable} disabled={loading}>
        {loading ? '...' : 'Abilita'}
      </button>
      <button className="notif-prompt-close" onClick={handleDismiss}>×</button>
    </div>
  );
}

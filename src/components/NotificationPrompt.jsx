import { useState, useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '../firebase';
import './NotificationPrompt.css';

const VAPID_KEY = 'BHTfQK65hRYZf_cwX5y-YVAi-ksYocuz5AJ1uMBekiByzNm-DJ4_EOfQZ-lu9efE_OJ8ud_HEOK6cVhu2FPFubU';
const DISMISSED_KEY = 'finance_notif_dismissed';

async function registerAndGetToken(uid) {
  const swReg = await navigator.serviceWorker.register(
    import.meta.env.BASE_URL + 'firebase-messaging-sw.js'
  );
  // Inizializza messaging DOPO la registrazione del SW
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (token) {
    await setDoc(doc(db, 'fcmTokens', token), { uid, createdAt: serverTimestamp() });
  }
  return token;
}

export default function NotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (Notification.permission === 'granted') {
      registerAndGetToken(user.uid).catch((err) =>
        console.warn('Token FCM:', err)
      );
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
      if (permission === 'granted') {
        await registerAndGetToken(user.uid);
      }
    } catch (err) {
      console.warn('Errore attivazione notifiche:', err);
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

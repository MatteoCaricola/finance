import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { messaging, db } from '../firebase';
import './NotificationPrompt.css';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const DISMISSED_KEY = 'finance_notif_dismissed';

export default function NotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !VAPID_KEY) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (token) {
          await setDoc(doc(db, 'fcmTokens', token), {
            uid: user.uid,
            createdAt: serverTimestamp(),
          });
        }
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

import { useState, useEffect } from 'react';
import { subscribeAndSave } from '../utils/pushNotifications';
import './NotificationPrompt.css';

const DISMISSED_KEY = 'finance_notif_dismissed';

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

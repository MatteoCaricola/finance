import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { messaging, db } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function usePushNotifications(user) {
  useEffect(() => {
    if (!user || !VAPID_KEY) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    const register = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js'),
        });

        if (token) {
          await setDoc(doc(db, 'fcmTokens', token), {
            uid: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Push notification setup failed:', err);
      }
    };

    register();
  }, [user]);
}

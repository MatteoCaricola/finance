import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCR-ueePHA67APCT5crMqrDuRg3bMpZ-ug',
  authDomain: 'finance-tracker-ea4d3.firebaseapp.com',
  projectId: 'finance-tracker-ea4d3',
  storageBucket: 'finance-tracker-ea4d3.firebasestorage.app',
  messagingSenderId: '166359680547',
  appId: '1:166359680547:web:c551e1466bea8e9f549396',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export { app };

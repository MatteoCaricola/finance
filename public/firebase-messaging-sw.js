importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCR-ueePHA67APCT5crMqrDuRg3bMpZ-ug',
  authDomain: 'finance-tracker-ea4d3.firebaseapp.com',
  projectId: 'finance-tracker-ea4d3',
  storageBucket: 'finance-tracker-ea4d3.firebasestorage.app',
  messagingSenderId: '166359680547',
  appId: '1:166359680547:web:c551e1466bea8e9f549396',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'Finance Tracker', {
    body: body ?? '',
    icon: '/finance/favicon.svg',
    badge: '/finance/favicon.svg',
  });
});

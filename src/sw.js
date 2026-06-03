import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Finance Tracker', {
      body: data.body ?? '',
      icon: '/finance/favicon.svg',
      badge: '/finance/favicon.svg',
      data: { url: data.url ?? '/finance/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/finance/'));
});

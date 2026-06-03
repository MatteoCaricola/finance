self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'Finance Tracker';
  const options = {
    body: data.body ?? '',
    icon: '/finance/favicon.svg',
    badge: '/finance/favicon.svg',
    data: { url: data.url ?? '/finance/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/finance/'));
});

// Killswitch — uninstalls any previously-registered service worker
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const regs = await self.registration.unregister();
      const clientList = await self.clients.matchAll({ type: 'window' });
      clientList.forEach(c => c.navigate(c.url));
    })()
  );
});
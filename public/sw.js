// Killswitch — overrides any vite-plugin-pwa service worker
// previously registered at /sw.js by the old app.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every cache (Workbox precache, runtime caches, etc.)
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // Take control of any open pages
    await self.clients.claim();

    // Unregister this worker — next visit hits the network normally
    await self.registration.unregister();

    // Force-reload every open tab so they get the new app immediately
    const clientList = await self.clients.matchAll({ type: 'window' });
    clientList.forEach(c => c.navigate(c.url));
  })());
});

// Pass-through fetch: never cache anything from now on
self.addEventListener('fetch', () => { /* no-op, let network handle it */ });
// MacroScan Service Worker — cache-first for app shell, network-only for external APIs
const CACHE = 'macroscan-v1.1';
const SHELL = ['./index.html', './site.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL.filter(() => true)).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Never intercept external requests (APIs, fonts, ZXing CDN)
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Never intercept non-GET
  if (event.request.method !== 'GET') return;
  // Never cache user-data.json — always fetch fresh
  if (event.request.url.includes('user-data.json')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

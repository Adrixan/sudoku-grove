/* Service worker for the Sudoku game. Scope: this folder only. Generated from src/sw-template.js at build time. */
const PREFIX = 'sudoku-grove-';
const CACHE = PREFIX + '__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((a) => new Request(new URL(a, self.registration.scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Only delete this game's old caches: other games on the same origin keep theirs.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    // Network first for pages so updates arrive; the cached page (or the game) when offline.
    const key = url.pathname.endsWith('/') ? new URL('./', self.registration.scope).href : url.href.split('#')[0].split('?')[0];
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(key, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(key)
            .then((r) => r || caches.match(new URL('./', self.registration.scope)))
            .then((r) => r || Response.error()),
        ),
    );
    return;
  }
  // Hashed assets never change: cache first.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

// Service worker: keeps the game files on the device, so the game works offline.
// Online: always load the newest files from the network (then save a copy).
// Offline: use the saved copy.
// Change VERSION when you change a game file.
const VERSION = 'cryptdive-v32';
const FILES = [
  './',
  './index.html',
  './privacy.html',
  './style.css',
  './game.js',
  './auth.js',
  './firebase-config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's short-term cache, so we never save an old file.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin !== location.origin) {
    // Keep the Firebase code files (fixed version) for offline start.
    // All other outside requests (login, database) go to the network as normal.
    if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
      e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })));
    }
    return;
  }

  // Game files: network first (newest version), saved copy when offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })
      .then((hit) => hit || caches.match('./index.html')))
  );
});

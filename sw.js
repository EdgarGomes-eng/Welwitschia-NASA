// sw.js — Service Worker 100% Offline-First para Welwitschia Lunar
// Estratégia: Network-First com Cache Fallback (Garante atualizações na rede e operação offline completa)
const CACHE_NAME = 'welwitschia-lunar-vr-v15';
const ASSETS = [
  './',
  './index.html',
  './three.min.js',
  './shaders.js?v=15',
  './lunar-exterior.js?v=15',
  './vr-base.js?v=15',
  './mission.js?v=15',
  './main.js?v=15',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estratégia Network-First com Cache Fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(e.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});

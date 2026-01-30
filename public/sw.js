// Transpiled simple service worker for browsers
const CACHE_NAME = 'nexsq-static-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/favicon.ico',
  '/manifest.webmanifest'
];
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(ASSETS_TO_CACHE); })
  );
});
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { if (key !== CACHE_NAME) return caches.delete(key); return Promise.resolve(); }));
    })
  );
});
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) { return cached || fetch(event.request); })
  );
});

const CACHE_NAME = 'bite-book-v1';

const APP_SHELL = [
  'index.html',
  'entry.html',
  'entry-when.html',
  'entry-where.html',
  'entry-who.html',
  'entry-made.html',
  'entry-why.html',
  'entry-ingredients.html',
  'entry-loved.html',
  'entry-photos.html',
  'entry-view.html',
  'entries.html',
  'stats.html',
  'ranking.html',
  'css/style.css',
  'js/partials.js',
  'js/storage.js',
  'js/labels.js',
  'js/main.js',
  'js/entry.js',
  'js/entry-when.js',
  'js/entry-where.js',
  'js/entry-who.js',
  'js/entry-made.js',
  'js/entry-why.js',
  'js/entry-ingredients.js',
  'js/entry-loved.js',
  'js/entry-photos.js',
  'js/entry-view.js',
  'js/entries-list.js',
  'js/stats.js',
  'js/ranking.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

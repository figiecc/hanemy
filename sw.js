const CACHE_NAME = "hanemy-beta-v0-6-4-cleanup-mobile";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=064",
  "./style.css?v=064",
  "./app.js?v=064",
  "./share.js?v=064",
  "./manifest.json?v=064",
  "./icon-192.png?v=064",
  "./icon-512.png?v=064",
  "./favicon.png?v=064"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request))
  );
});

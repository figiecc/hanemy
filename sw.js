const CACHE_NAME = "hanemy-beta-v0-8-1-overage-savings";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=081",
  "./style.css?v=081",
  "./app.js?v=081",
  "./share.js?v=081",
  "./manifest.json?v=081",
  "./icon-192.png?v=081",
  "./icon-512.png?v=081",
  "./favicon.png?v=081"
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

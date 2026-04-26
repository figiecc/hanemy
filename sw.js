const CACHE_NAME = "hanemy-beta-v0-7-5-final-consistency";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=075",
  "./style.css?v=075",
  "./app.js?v=075",
  "./share.js?v=075",
  "./manifest.json?v=075",
  "./icon-192.png?v=075",
  "./icon-512.png?v=075",
  "./favicon.png?v=075"
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

const CACHE_NAME = "hanemy-beta-v0-9-public-beta";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=090",
  "./style.css?v=090",
  "./app.js?v=090",
  "./share.js?v=090",
  "./manifest.json?v=090",
  "./icon-192.png?v=090",
  "./icon-512.png?v=090",
  "./favicon.png?v=090"
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

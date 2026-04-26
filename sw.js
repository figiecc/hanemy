const CACHE_NAME = "hanemy-beta-v0-9-1-public-beta-logo";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=091",
  "./style.css?v=091",
  "./app.js?v=091",
  "./share.js?v=091",
  "./manifest.json?v=091",
  "./icon-192.png?v=091",
  "./icon-512.png?v=091",
  "./favicon.png?v=091"
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

const CACHE_NAME = "hanemy-beta-v1-0-4-plus-step2-notify-fix";
const FILES_TO_CACHE = [
  "./",
  "./index.html?v=104e",
  "./style.css?v=104e",
  "./app.js?v=104e",
  "./share.js?v=104e",
  "./manifest.json?v=104e",
  "./icon-192.png?v=104e",
  "./icon-512.png?v=104e",
  "./favicon.png?v=104e",
  "./logo-horizontal.png?v=104e"
  "./notif-bell.svg"
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

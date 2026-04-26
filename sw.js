const CACHE_NAME = "hanemy-compact-clean-mobile-v2-4";

const FILES_TO_CACHE = [
  "./",
  "./index.html?v=062",
  "./style.css?v=062",
  "./app.js?v=062",
  "./share.js?v=062",
  "./quickinput.js?v=062",
  "./budgetadjust.js?v=062",
  "./setupadjust.js?v=062",
  "./manifest.json?v=062",
  "./icon-192.png?v=062",
  "./icon-512.png?v=062",
  "./favicon.png?v=062"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});

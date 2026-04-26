const CACHE_NAME = "hanemy-beta-v0-5-1-ui-refine";
const FILES_TO_CACHE = ["./","./index.html","./style.css","./app.js","./share.js","./manifest.json","./icon-192.png","./icon-512.png","./favicon.png"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))); });
self.addEventListener("fetch", (event) => { event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); });

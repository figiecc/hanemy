const CACHE_NAME = "hanemy-assets-v0294-cache-install";
const ASSET_URLS = [
  "./manifest.json",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/logo.png",
  "./assets/logo-horizontal-transparent.png",
  "./assets/logo-icon-transparent.png",
  "./assets/mascot-transparent.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_URLS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    } catch (error) {}

    try {
      await self.clients.claim();
    } catch (error) {}
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not cache the app shell. Always try network for HTML.
  if (request.mode === "navigate" || request.destination === "document" || url.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        new Response(
          "<!doctype html><meta charset='utf-8'><title>Hanemy</title><p>通信できません。オンラインで再度開いてください。</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
      )
    );
    return;
  }

  const isAsset = ASSET_URLS.some((asset) => {
    const assetUrl = new URL(asset, self.location.href);
    return assetUrl.pathname === url.pathname;
  });

  if (isAsset) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

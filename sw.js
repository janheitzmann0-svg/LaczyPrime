/* Service worker — LaczyPrime
 *
 * Strategy: network-first with cache fallback.
 *   • Online  → always fetch fresh, update cache transparently.
 *               Updates ship immediately on next page load.
 *   • Offline → serve from cache.
 *
 * Bump CACHE_VERSION on each meaningful release; old caches are
 * evicted on activate.
 */

const CACHE_VERSION = "laczyprime-v1-20260515";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./notation.js",
  "./reference-data.js",
  "./uvalue.js",
  "./persistence.js",
  "./uvalue-app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use addAll with no-store fetches so we get fresh shell on first install.
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "no-store" })
            .then((resp) => {
              if (resp.ok) return cache.put(url, resp);
            })
            .catch(() => { /* ignore one-off failures */ })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET, same-origin
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});

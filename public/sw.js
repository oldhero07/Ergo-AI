const CACHE_NAME = "ergo-ai-cache-v2";

// Paths containing these substrings will use a Cache-First strategy.
const CACHE_FIRST_PATHS = [
  "/wasm/",
  "/models/",
  "storage.googleapis.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = request.url;

  // Only intercept standard HTTP/HTTPS GET requests to prevent caching issues with extensions, POSTs, etc.
  if (!url.startsWith("http") || request.method !== "GET") return;

  const isCacheFirst = CACHE_FIRST_PATHS.some((path) => url.includes(path));

  if (isCacheFirst) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((hit) => {
          if (hit) return hit;
          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            // If offline and not cached, propagate the network error gracefully
            throw err;
          });
        });
      })
    );
  } else {
    // Stale-While-Revalidate for other assets (HTML, JS, CSS, fonts, etc.)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((hit) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network request failed (offline) - return cached asset if available
            return hit;
          });
          return hit || fetchPromise;
        });
      })
    );
  }
});

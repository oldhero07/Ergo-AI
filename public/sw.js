// Self-destructing service worker. The app no longer uses one (inference moved
// server-side, so there are no 71 MB model/wasm assets to cache), but existing
// visitors still have the old caching SW ("ergo-ai-cache-v9") registered and
// its caches ("ergo-models-v2" etc.) stored. This replacement installs over
// it, deletes EVERY cache on the origin, unregisters itself, and reloads open
// tabs so they fetch fresh from the network. Keep it deployed for a release or
// two, then the registration call can be removed entirely.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        await caches.delete(key);
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) {
        client.navigate(client.url);
      }
    })(),
  );
});

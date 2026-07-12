// Self-destructing service worker. The app no longer uses one (inference moved
// server-side, so there are no 71 MB model/wasm assets to cache), but visitors
// from before the migration may still have the old caching SW ("ergo-ai-cache-v9")
// registered at this same URL. The app no longer registers any service worker;
// this file stays deployed because browsers re-fetch a registered SW's script
// on navigation, so returning stale visitors auto-update to this self-destructor,
// which deletes the old "ergo-*" caches and unregisters. Safe to delete this
// file once the pre-migration visitor population has cycled out.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete only OUR caches ("ergo-*"): CacheStorage is origin-scoped and
      // the github.io deployment shares its origin with other project pages -
      // an unqualified wipe would destroy their caches too.
      for (const key of await caches.keys()) {
        if (key.startsWith("ergo-")) await caches.delete(key);
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) {
        client.navigate(client.url);
      }
    })(),
  );
});

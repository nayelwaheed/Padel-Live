const CACHE = "padel-live-v2.8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=2.7",
  "./config.js?v=2.7",
  "./data.js?v=2.7",
  "./app.js?v=2.7",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A single optional asset failure should never prevent the service worker
    // from installing and therefore block notifications.
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return (await caches.match(event.request)) || (await caches.match("./index.html"));
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification?.data?.url || "./";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows => {
    for (const client of windows) if ("focus" in client) return client.focus();
    if (clients.openWindow) return clients.openWindow(target);
  }));
});

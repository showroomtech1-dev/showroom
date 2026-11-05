const CACHE_NAME = "showroompro-pwa-v4";
const API_CACHE = "showroompro-api-v1";
// GET endpoints cached for offline selling (paths match whatever host the API runs on).
const OFFLINE_API = [
  /^\/api\/v1\/auth\/me$/,
  /^\/api\/v1\/settings\/?$/,
  /^\/api\/v1\/branches\/?$/,
  /^\/api\/v1\/inventory\/levels$/,
  /^\/api\/v1\/products\/pos-search$/,
  /^\/api\/v1\/products\/barcode\/[^/]+$/,
  /^\/api\/v1\/customers\/?$/,
  /^\/api\/v1\/accounts\/options$/,
];
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // Signing out wipes cached business data so the next person on this device doesn't see it.
  if (event.data && event.data.type === "CLEAR_API_CACHE") {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Read-only data the POS needs to keep working offline: network first, last copy when offline.
  if (OFFLINE_API.some((re) => re.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request.url, clone));
          }
          return response;
        })
        .catch(async () => (await caches.match(request.url, { cacheName: API_CACHE })) || Response.error())
    );
    return;
  }

  // The deployed-version marker must always come from the network, or open tabs can never see an update.
  if (url.pathname === "/version.json") return;

  // Never cache other API calls, Vite dev module requests, or external OAuth scripts
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/@") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // SPA navigation requests: Network first, fall back to cached /index.html when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        })
    );
    return;
  }

  // Static assets (/assets/*, /icons/*, manifest): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || networkFetch;
    })
  );
});

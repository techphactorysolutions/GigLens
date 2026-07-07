const CACHE_VERSION = "v34-platform-detection-audit-fix";
const CACHE_NAME = "driveledger-v34-platform-detection-audit-fix";
const OFFLINE_FALLBACK = "./index.html";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
}

async function deleteOldCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith("driveledger-") && key !== CACHE_NAME)
    .map((key) => caches.delete(key)));
}

async function cachePutSafe(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cachePutSafe(request, response);
    return response;
  } catch (error) {
    return (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match(OFFLINE_FALLBACK))
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then(async (response) => {
      await cachePutSafe(request, response);
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheCoreAssets());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Leave cross-origin requests, including the Tesseract CDN, to the browser.
  if (!isSameOrigin(request)) return;

  // Documents use network-first so hosted releases update quickly, with the
  // cached shell as the offline fallback.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Core static assets use stale-while-revalidate for fast launches and safe
  // background refreshes without a heavy build system.
  event.respondWith(staleWhileRevalidate(request));
});

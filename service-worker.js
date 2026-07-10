const CACHE_VERSION = "v38-giglens-icon-ocr-repair";
const CACHE_NAME = "giglens-v38-giglens-icon-ocr-repair";
const OFFLINE_FALLBACK = "./index.html";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/giglens-icon-180.png",
  "./icons/giglens-icon-180-v401.png",
  "./icons/giglens-icon-192-v401.png",
  "./icons/giglens-icon-512-v401.png",
  "./icons/giglens-icon-1024-v401.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./404.js"
];

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
}

async function deleteOldCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => (key.startsWith("giglens-") || key.startsWith("driveledger-")) && key !== CACHE_NAME)
    .map((key) => caches.delete(key)));
}

async function cachePutSafe(request, response) {
  if (!response || !response.ok || !["basic", "default"].includes(response.type)) return;
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

  // Cache only known browser asset classes. Same-origin API-like or arbitrary
  // URLs are deliberately left to the network and never persisted by the PWA.
  const cacheableDestinations = new Set(["style", "script", "image", "font", "manifest"]);
  if (cacheableDestinations.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

const CACHE_VERSION = "v46-safari-reliability";
const CACHE_PREFIX = `giglens-${encodeURIComponent(self.registration.scope)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_FALLBACK = "./index.html";
const CORE_ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.json",
  "./icons/giglens-icon-180.png", "./icons/giglens-icon-192.png",
  "./icons/giglens-icon-512.png", "./icons/giglens-icon-1024.png",
  "./apple-touch-icon.png", "./favicon.png", "./404.js"
];
const coreURLs = new Set(CORE_ASSETS.map((path) => new URL(path, self.registration.scope).href));

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  // Installation fails atomically if any required shell asset cannot be fetched.
  await cache.addAll(CORE_ASSETS.map((path) => new Request(new URL(path, self.registration.scope), { cache: "reload" })));
}

async function deleteOldCaches() {
  const keys = await caches.keys();
  // Only this scope's caches belong to this app; other GitHub Pages apps are isolated.
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
}

async function releaseAsset(request, navigation) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(navigation ? OFFLINE_FALLBACK : request, { ignoreSearch: true });
    if (cached) return cached;
  } catch { /* Storage can be unavailable in restricted browsing sessions. */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) return response; // A successful response must survive quota failures.
    return navigation ? (await cache?.match(OFFLINE_FALLBACK)) || response : response;
  } catch {
    return (navigation && await cache?.match(OFFLINE_FALLBACK)) || Response.error();
  } finally { clearTimeout(timer); }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheCoreAssets());
  // Updates wait. Never replace an open app while a delivery is being edited.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "APPLY_UPDATE") return;
  event.waitUntil((async () => {
    const clients = (await self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .filter((client) => client.url.startsWith(self.registration.scope));
    if (clients.length > 1) {
      event.source?.postMessage({ type: "UPDATE_BLOCKED" });
      return;
    }
    if (event.source && clients.some((client) => client.id === event.source.id)) await self.skipWaiting();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Leave cross-origin requests, including the Tesseract CDN, to the browser.
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const navigation = request.mode === "navigate" || request.destination === "document";
  url.search = "";
  url.hash = "";
  // The complete cached release stays together until the next worker activates.
  // Unknown paths and API requests are never cached.
  if (navigation || coreURLs.has(url.href)) event.respondWith(releaseAsset(request, navigation));
});

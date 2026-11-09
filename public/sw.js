// SW_VERSION is stamped per build by scripts/prerender-seo-pages.mjs (it
// rewrites this exact line in dist/sw.js), so every deploy purges the old
// precache/runtime caches on activate. The value here is only the dev default.
const SW_VERSION = "dev";
const CACHE_NAME = `astroyou-${SW_VERSION}`;
const RUNTIME_CACHE = `astroyou-runtime-${SW_VERSION}`;
// Vite's build output (/assets/<name>-<hash>.<ext>, top level only) is
// content-hashed and immutable, so it lives in an unversioned cache that
// survives deploys (a changed file has a new name). public/assets/ also holds
// UNhashed images in subfolders; those stay network-first.
const ASSET_CACHE = "astroyou-assets";
const MAX_RUNTIME_ENTRIES = 60;
const MAX_ASSET_ENTRIES = 120;

// Never cache these — auth handshakes carry one-time tokens, and API responses
// are user-specific and must always hit the network.
function isNonCacheablePath(pathname) {
  return (
    pathname.startsWith("/__/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.netlify/")
  );
}
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/forecast",
  "/free-kundali",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => ![CACHE_NAME, RUNTIME_CACHE, ASSET_CACHE].includes(k),
            )
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Pass auth/API requests straight to the network — never cache them.
  if (isNonCacheablePath(requestUrl.pathname)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "/"));
    return;
  }

  if (isHashedBuildAsset(requestUrl.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

self.addEventListener("push", (event) => {
  const data = readPushPayload(event);
  const notification = data.notification || data.webpush?.notification || {};
  const extra = data.data || {};
  const title = notification.title || data.title || extra.title || "AstroYou";
  const url = extra.url || data.url || "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: notification.body || data.body || extra.body || "",
      icon: notification.icon || "/icon-192.png",
      badge: notification.badge || "/icon-192.png",
      tag: notification.tag || extra.triggerType || "astroyou-brain",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(openOrFocus(url));
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await putBounded(
        RUNTIME_CACHE,
        request,
        response.clone(),
        MAX_RUNTIME_ENTRIES,
      );
    }
    return response;
  } catch (_error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

function isHashedBuildAsset(pathname) {
  return /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|svg|webp|avif)$/.test(
    pathname,
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    await putBounded(ASSET_CACHE, request, response.clone(), MAX_ASSET_ENTRIES);
  }
  return response;
}

// Insert, then evict the oldest entries (Cache keys keep insertion order) so
// the runtime caches cannot grow without bound.
async function putBounded(cacheName, request, response, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    const keys = await cache.keys();
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch (_error) {
    // Quota or storage errors must never break the response.
  }
}

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (_error) {
    return { body: event.data.text() };
  }
}

async function openOrFocus(url) {
  const targetUrl = new URL(url, self.location.origin).href;
  const windows = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const existing = windows.find(
    (client) => client.url === targetUrl || client.url.startsWith(targetUrl),
  );
  if (existing) return existing.focus();
  return clients.openWindow(targetUrl);
}

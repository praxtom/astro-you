const CACHE_NAME = 'astroyou-v2';
const RUNTIME_CACHE = 'astroyou-runtime-v2';
const PRECACHE_URLS = [
    '/',
    '/dashboard',
    '/forecast',
    '/free-kundali',
    '/manifest.json',
    '/favicon.svg',
    '/icon-192.png',
    '/icon-512.png',
    '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(k => ![CACHE_NAME, RUNTIME_CACHE].includes(k))
                .map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event.request, '/'));
        return;
    }

    event.respondWith(networkFirst(event.request));
});

self.addEventListener('push', (event) => {
    const data = readPushPayload(event);
    const notification = data.notification || data.webpush?.notification || {};
    const extra = data.data || {};
    const title = notification.title || data.title || extra.title || 'AstroYou';
    const url = extra.url || data.url || '/dashboard';

    event.waitUntil(
        self.registration.showNotification(title, {
            body: notification.body || data.body || extra.body || '',
            icon: notification.icon || '/icon-192.png',
            badge: notification.badge || '/icon-192.png',
            tag: notification.tag || extra.triggerType || 'astroyou-brain',
            data: { url },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/dashboard';
    event.waitUntil(openOrFocus(url));
});

async function networkFirst(request, fallbackUrl) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (fallbackUrl) return caches.match(fallbackUrl);
        return new Response('', { status: 503, statusText: 'Offline' });
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
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url === targetUrl || client.url.startsWith(targetUrl));
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
}

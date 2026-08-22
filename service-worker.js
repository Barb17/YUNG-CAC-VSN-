const CACHE_NAME = 'yngcac-cache-v1';

const PRECACHE_URLS = [
    './index.html',
    './manifest.json',
    './icons/icon-192x192.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return networkResponse;
                })
                .catch(() =>
                    caches.match(request).then(cached => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(request).then(cachedResponse => {
                const fetchPromise = fetch(request)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        )
    );
});

self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
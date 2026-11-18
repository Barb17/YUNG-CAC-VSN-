const CACHE_NAME = 'yngcac-cache-v2';

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

    const url = new URL(request.url);

    // Ignora domini esterni (API GitHub, stream Mux, CDN)
    if (url.origin !== self.location.origin) return;

    // Ignora richieste Range e file multimediali pesanti (audio/video) e pannello admin
    if (
        request.headers.has('range') ||
        /\.(mp3|mp4|wav|ogg|webm|m3u8|ts)$/i.test(url.pathname) ||
        url.pathname.endsWith('/admin.html')
    ) {
        return;
    }

    // Strategia Network-First con chiave canonica per data.json (sempre aggiornato dopo pubblicazione da admin.html)
    if (url.pathname.endsWith('/data.json')) {
        const canonicalDataReq = new Request(url.origin + url.pathname);
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(canonicalDataReq, clone));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(canonicalDataReq))
        );
        return;
    }

    // Strategia Network-First per la navigazione HTML
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return networkResponse;
                })
                .catch(() =>
                    caches.match(request).then(cached => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // Strategia Stale-While-Revalidate per asset leggeri (icone, copertine, manifest)
    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(request).then(cachedResponse => {
                const fetchPromise = fetch(request)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
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

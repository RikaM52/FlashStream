const CACHE_NAME = 'flashstream-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/discover',
  '/watchlist',
  '/leaving-soon',
  '/coming-soon',
  '/community',
  '/settings',
  '/about',
  '/privacy',
  '/terms',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isHtml = request.headers.get('Accept')?.includes('text/html');
  const isSameOrigin = url.host === self.location.host;

  // For HTML navigation – serve from cache first (avoids any network redirect)
  if (isSameOrigin && isHtml) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        // Fallback to network if not cached (should not happen after install)
        return fetch(request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // For static assets – cache first
  if (isSameOrigin && /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // For everything else – network first (API, images, etc.)
  event.respondWith(fetch(request));
});
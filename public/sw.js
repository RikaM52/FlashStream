/* ============================================================
   FLASHSTREAM SERVICE WORKER – MINIMAL, ROBUST
   ============================================================ */

const CACHE_NAME = 'flashstream-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/discover.html',
  '/movie-detail.html',
  '/watchlist.html',
  '/leaving-soon.html',
  '/coming-soon.html',
  '/community.html',
  '/settings.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install – cache all static assets (fail if any fails)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch – network first for HTML, cache first for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isHtml = request.headers.get('Accept')?.includes('text/html');
  const isSameOrigin = url.host === self.location.host;

  // For HTML pages (navigation) – try network, fallback to cache
  if (isSameOrigin && isHtml) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
        .then(response => response || caches.match('/index.html') || caches.match('/offline.html'))
    );
    return;
  }

  // For static assets (css, js, images, fonts) – cache first
  if (isSameOrigin && /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // For everything else (API, external images, etc.) – network only
  event.respondWith(fetch(request));
});
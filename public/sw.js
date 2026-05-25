const CACHE_NAME = 'flashstream-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
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
  '/terms.html'
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

  if (isSameOrigin && isHtml) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
        .then(response => response || caches.match('/index.html'))
    );
    return;
  }

  if (isSameOrigin && /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  event.respondWith(fetch(request));
});

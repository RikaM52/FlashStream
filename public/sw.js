/* ============================================================
   FLASHSTREAM SERVICE WORKER CORE v4
   Updated: Complete Brand Rebuild & Edge Routing Integration
   Contains: Cache Strategies, Data-Saver Optimization,
             Background Sync, and Multi-Option Offline Fallbacks
   ============================================================ */

const CACHE_VERSION = 'fs-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Updated asset list – all critical pages and resources
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
  '/blog/index.html',
  '/insights.html',
  '/data/leaving-soon.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const STATIC_TTL = 30 * 24 * 3600;      // 30 days
const API_TTL    = 5 * 60;              // 5 minutes
const IMAGE_TTL  = 7 * 24 * 3600;       // 7 days
const TMDB_IMAGE_HOST = 'image.tmdb.org';

/* ── LIFECYCLE INSTALLATION ─────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install phase skipped for some assets:', err))
  );
});

/* ── LIFECYCLE ACTIVATION – CLEAN OLD CACHES ────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k)))
      ),
      cleanExpiredCache(IMAGE_CACHE, IMAGE_TTL),
      cleanExpiredCache(API_CACHE, API_TTL * 12),
      self.clients.claim()
    ])
  );
});

/* ── FETCH INTERCEPTION & ROUTING ───────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // TMDB images – apply data‑saver compression
  if (url.host === TMDB_IMAGE_HOST) {
    event.respondWith(handleImage(request, url));
    return;
  }

  // API calls – network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPI(request));
    return;
  }

  // Static assets (CSS, JS, fonts, images, etc.) – cache first
  if (url.host === self.location.host && isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, STATIC_TTL));
    return;
  }

  // HTML navigation – try network, fallback to cached index or offline page
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Everything else – stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

/* ── CACHE STRATEGIES ───────────────────────────────────────────────────── */
async function cacheFirst(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const age = getCacheAge(cached);
    if (age < ttl) return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const stamped = stampResponse(response.clone());
      cache.put(request, await stamped);
    }
    return response;
  } catch {
    if (cached) return cached;
    return offlineResponse(request);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      const stamped = stampResponse(response.clone());
      stamped.then(r => cache.put(request, r)).catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || networkPromise || offlineResponse(request);
}

/* ── DATA‑SAVER IMAGE OPTIMIZATION ──────────────────────────────────────── */
async function handleImage(request, url) {
  const isDataSaver = await getClientDataSaverSetting();
  let finalRequest = request;
  if (isDataSaver) {
    const path = url.pathname;
    // Force maximum width to 342px for data‑saver mode
    const rewrite = path.replace(/\/w\d+\//, '/w342/').replace(/\/w\d+h\d+\//, '/w342/');
    if (rewrite !== path) {
      const newUrl = `${url.origin}${rewrite}`;
      finalRequest = new Request(newUrl, { headers: request.headers });
    }
  }
  try {
    return await cacheFirst(finalRequest, IMAGE_CACHE, IMAGE_TTL);
  } catch (err) {
    console.warn('[SW] Image fetch failed, returning blank placeholder:', url.href);
    return new Response(null, { status: 200, headers: { 'Content-Type': 'image/png' } });
  }
}

/* ── API HANDLER – NETWORK FIRST WITH CACHE FALLBACK ────────────────────── */
async function handleAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      const stamped = stampResponse(response.clone());
      cache.put(request, await stamped);
    }
    return response;
  } catch {
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...Object.fromEntries(cached.headers),
          'X-SW-Cached': '1',
          'X-SW-Offline': '1'
        }
      });
    }
    return new Response(JSON.stringify({ error: 'offline', cached: false, message: 'Platform data matrix unavailable offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ── NAVIGATION FALLBACK (OFFLINE SUPPORT) ──────────────────────────────── */
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match('/index.html') || await cache.match('/');
    if (cached) return cached;
    return cache.match('/offline.html') || new Response('Offline Mode Active', { status: 503 });
  }
}

/* ── BACKGROUND SYNC FOR WATCHLIST CHANGES ───────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'watchlist-sync') {
    event.waitUntil(replayWatchlistSync());
  }
});

async function replayWatchlistSync() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('sync-queue', 'readwrite');
    const store = tx.objectStore('sync-queue');
    const items = await promisifyRequest(store.getAll());

    for (const item of items) {
      try {
        const res = await fetch('/api/watchlist-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: item.body
        });
        if (res.ok) {
          await promisifyRequest(store.delete(item.id));
        }
      } catch (e) {}
    }
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', tag: 'watchlist-sync' }));
  } catch (err) {
    console.warn('[SW] Background sync replay failed:', err);
  }
}

/* ── UTILITIES: TIMESTAMPING, CACHE AGE, OFFLINE RESPONSES ──────────────── */
async function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('X-SW-Cached-At', String(Date.now()));
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

function getCacheAge(response) {
  const cachedAt = response.headers.get('X-SW-Cached-At');
  if (!cachedAt) return Infinity;
  return (Date.now() - parseInt(cachedAt, 10)) / 1000;
}

async function offlineResponse(request) {
  if (request.headers.get('Accept')?.includes('text/html')) {
    const cache = await caches.open(STATIC_CACHE);
    return cache.match('/offline.html') || new Response('Offline', { status: 503 });
  }
  if (request.headers.get('Accept')?.includes('application/json') || new URL(request.url).pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'offline', cached: false }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('Network disconnected', { status: 503 });
}

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico|json)$/.test(pathname);
}

async function getClientDataSaverSetting() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (!clients.length) return false;
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), 200);
      const mc = new MessageChannel();
      mc.port1.onmessage = e => {
        clearTimeout(timeout);
        resolve(e.data?.dataSaver === true);
      };
      clients[0].postMessage({ type: 'GET_DATASAVER' }, [mc.port2]);
    });
  } catch (e) {
    return false;
  }
}

async function cleanExpiredCache(cacheName, ttlSeconds) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    await Promise.all(keys.map(async req => {
      const res = await cache.match(req);
      if (!res) return;
      const age = getCacheAge(res);
      if (age > ttlSeconds) cache.delete(req);
    }));
  } catch (e) {}
}

/* ── INDEXEDDB FOR BACKGROUND SYNC QUEUE ────────────────────────────────── */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fs-sync', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function addToSyncQueue(body) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('sync-queue', 'readwrite');
    const store = tx.objectStore('sync-queue');
    await promisifyRequest(store.add({ body, timestamp: Date.now() }));
    await self.registration.sync.register('watchlist-sync');
  } catch (e) {}
}

/* ── MESSAGE HANDLER (SKIP_WAITING, CLEAR_CACHE, QUEUE_SYNC) ────────────── */
self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
  if (type === 'QUEUE_SYNC' && data) {
    event.waitUntil(addToSyncQueue(data));
  }
});
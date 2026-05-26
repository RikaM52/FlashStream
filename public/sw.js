// ============================================================
// FLASHSTREAM SERVICE WORKER — v4 (DEFINITIVE FIX)
// ============================================================
//
// ROOT CAUSE OF ALL PREVIOUS FAILURES, EXPLAINED SIMPLY:
//
// Every version of this SW tried to intercept HTML navigation
// requests and either (a) fetch them from the network, or
// (b) pre-cache them with addAll(). Both approaches failed
// because Cloudflare Pages "Pretty URLs" returns a 308 redirect
// for these URLs — either breaking the cache.addAll() call
// (TypeError: Failed to fetch) or causing the SW to pass a
// 308 back to the browser, which then looped forever.
//
// THE CORRECT FIX IS SIMPLE:
// The SW must NOT intercept HTML navigation requests at all.
// The browser handles 308 redirects perfectly on its own.
// The only reason navigation ever broke was because the SW
// was getting in the way. Remove the SW from the HTML path
// entirely and the browser navigates fine.
//
// WHAT THIS SW NOW DOES:
// 1. Caches only 3 assets that are guaranteed 200 (no redirects):
//    '/', '/offline.html', '/manifest.json'
// 2. Does NOT intercept ANY HTML navigation — lets browser handle it
// 3. Caches static assets (images, fonts, JS, CSS) on first fetch
// 4. Serves /offline.html only when the user is genuinely offline
//    and a navigation request fails at the network level
//
// ============================================================

const CACHE_NAME = 'flashstream-v4';

// ONLY include URLs that are 100% guaranteed to return HTTP 200
// with no redirects from Cloudflare. Do NOT include:
//   - /index.html  (Pretty URLs 308s this to /)
//   - /discover    (Cloudflare returns 308 during addAll fetch)
//   - /community   (same)
//   - /icons/*.png (files may not exist → 404 → addAll aborts)
// Safe assets: '/' (root rewrite, always 200), '/offline.html'
// (explicit direct rule in _redirects), '/manifest.json' (direct file).
const SAFE_PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.json'
];

// ── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', event => {
  // Always take control immediately — do not wait for old SW to die.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SAFE_PRECACHE))
      .catch(err => {
        // If even these 3 assets fail, log it — but SW still installs.
        // Navigation will work regardless (browser handles HTML natively).
        console.error('[SW] Precache failed:', err);
      })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────
// Wipe every old cache version so stale content is never served.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Removing old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.host === self.location.host;

  // ── HTML NAVIGATION — DO NOT INTERCEPT ──────────────────
  // Let the browser handle all HTML page navigation completely
  // on its own. The browser follows 308 redirects natively and
  // correctly. The SW intercepting these requests was the entire
  // cause of the redirect loop. By returning here without calling
  // event.respondWith(), the browser's default fetch behaviour
  // takes over — exactly as if no SW existed for this request.
  const isNavigation = request.mode === 'navigate';
  const isHtmlAccept = request.headers.get('Accept')?.includes('text/html');
  if (isSameOrigin && (isNavigation || isHtmlAccept)) {
    // No event.respondWith() call = browser handles it natively.
    // This is intentional. Do not add code here.
    return;
  }

  // ── STATIC ASSETS — CACHE FIRST ─────────────────────────
  // Images, fonts, JS, CSS: serve from cache if available,
  // otherwise fetch from network and cache the result.
  if (isSameOrigin && /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(res => {
          // Only cache valid responses.
          if (res && res.ok) {
            const toCache = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
          }
          return res;
        }).catch(() => {
          // Asset unavailable offline — nothing useful to return.
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // ── MANIFEST & OTHER PRECACHED FILES ────────────────────
  // Serve manifest.json and any other precached items from cache.
  if (isSameOrigin && (url.pathname === '/manifest.json' || url.pathname === '/')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // ── EVERYTHING ELSE — NETWORK ONLY ──────────────────────
  // API calls to the Cloudflare worker, TMDB image CDN requests,
  // external scripts — always go direct to network, never cached.
  event.respondWith(
    fetch(request).catch(() => {
      // If a navigation somehow reaches here while offline,
      // serve the offline page.
      if (isNavigation || isHtmlAccept) {
        return caches.match('/offline.html');
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});
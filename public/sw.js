// ============================================================
// FLASHSTREAM SERVICE WORKER — v3
// ============================================================
// WHAT CHANGED FROM v1/v2 AND WHY:
//
// BUG 1 FIXED — Cache name bumped to 'flashstream-v3'.
//   The activate handler only deletes caches with DIFFERENT names.
//   If the old broken SW used the same name, the stale cache was
//   never wiped. Bumping the version forces a clean slate.
//
// BUG 2 FIXED — Removed /icons/icon-192.png and /icons/icon-512.png
//   from STATIC_ASSETS. cache.addAll() is all-or-nothing. If even
//   ONE asset 404s (e.g. icons not deployed), the ENTIRE cache is
//   left empty. The old code then swallowed the error with .catch(),
//   so install appeared to succeed with a completely empty cache.
//   Every navigation then fell through to the network fetch fallback,
//   hit Cloudflare's 308 redirect, and caused an infinite loop.
//
// BUG 3 FIXED — self.skipWaiting() moved BEFORE event.waitUntil().
//   Previously skipWaiting() was chained after addAll() in the
//   promise chain. If addAll() failed, skipWaiting() was skipped,
//   leaving the new SW stuck in "waiting" state. Now it always fires
//   immediately so the new SW takes control on every deploy.
//
// BUG 4 FIXED — HTML fetch handler now uses { redirect: 'manual' }.
//   Previously fetch(request) followed redirects by default. When
//   Cloudflare Pages returned a 308 (Pretty URLs stripping .html),
//   the SW passed that 308 back to the browser. The browser followed
//   it, the SW intercepted again, got another 308 — infinite loop.
//   With redirect:'manual', the SW receives an opaque redirect
//   response (type:'opaqueredirect') and handles it safely by
//   falling back to the cached index page instead of forwarding the
//   redirect to the browser.
// ============================================================

const CACHE_NAME = 'flashstream-v3';

// IMPORTANT: Only include assets you are 100% certain exist on the
// server. A single 404 here aborts the entire cache installation.
// Use ONLY clean URLs (no .html extensions) — these match exactly
// what Cloudflare _redirects serves and what nav links use as hrefs.
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
  '/terms'
];

// ── INSTALL ────────────────────────────────────────────────
// skipWaiting() is called FIRST, unconditionally, so the new SW
// always takes control immediately after deployment — even if the
// cache population below fails for any reason.
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => {
        // Log the error so you can see it in DevTools → Application
        // → Service Workers → Console. Navigation will still work
        // via the network fallback — just without offline support
        // until the next successful install.
        console.error('[SW] Cache install failed — check that all STATIC_ASSETS exist on the server:', err);
      })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────
// Delete every cache that is NOT the current version so stale
// cached pages from old deploys don't serve outdated content.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
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
  const isHtml = request.headers.get('Accept')?.includes('text/html');
  const isSameOrigin = url.host === self.location.host;

  // ── HTML NAVIGATION (cache-first, redirect-safe) ──
  // Strategy: serve from cache whenever possible.
  // When we must go to the network, use redirect:'manual' so that
  // Cloudflare's 308 Pretty-URL redirects are caught here and
  // handled gracefully instead of being forwarded to the browser
  // (which would cause an infinite redirect loop).
  if (isSameOrigin && isHtml) {
    event.respondWith(
      caches.match(request, { ignoreSearch: false }).then(cached => {
        // Cache hit — serve instantly, no network involved.
        if (cached) return cached;

        // Cache miss — go to network but intercept any redirects.
        return fetch(request, { redirect: 'manual' })
          .then(res => {
            // type:'opaqueredirect' means the server returned a 3xx.
            // This is Cloudflare's Pretty URLs 308. Do NOT forward
            // it to the browser (that causes the infinite loop).
            // Instead, serve the root index from cache as a safe
            // fallback. The user lands on the home page rather than
            // hitting a redirect loop.
            if (res.type === 'opaqueredirect') {
              console.warn('[SW] Caught redirect for', url.pathname, '— serving cached index');
              return caches.match('/') || caches.match('/index.html');
            }

            // Any genuine non-OK response (404, 500 etc.) —
            // serve cached index rather than an error page.
            if (!res.ok) {
              return caches.match('/') || caches.match('/index.html');
            }

            // Good response — cache it for next time, then return it.
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(request, res.clone());
              return res;
            });
          })
          .catch(() => {
            // Network completely unavailable (offline).
            // Serve the cached index as the offline fallback.
            return caches.match('/') || caches.match('/index.html');
          });
      })
    );
    return;
  }

  // ── STATIC ASSETS (cache-first) ──
  // CSS, JS, fonts, images — serve from cache, fetch on miss.
  if (isSameOrigin && /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(request, res.clone());
              return res;
            });
          }
          return res;
        });
      })
    );
    return;
  }

  // ── EVERYTHING ELSE (network-only) ──
  // API calls, TMDB images, worker requests — always fresh from network.
  event.respondWith(fetch(request));
});
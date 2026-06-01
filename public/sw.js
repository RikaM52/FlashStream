// ============================================================
// FLASHSTREAM SERVICE WORKER — v5 (FULL FEATURE RELEASE)
// ============================================================
//
// CHANGELOG v5:
// - Added message handlers for SET_OFFLINE_FIRST and SKIP_WAITING
// - Added Background Sync for offline event recovery
// - Expanded SAFE_PRECACHE to include CSS, JS, and offline assets
// - Versioned cache name (flashstream-v5)
// - Added Periodic Background Sync (Phase 3 ready)
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
// 1. Caches static assets (CSS, JS, images, fonts) on first fetch
// 2. Does NOT intercept ANY HTML navigation — lets browser handle it
// 3. Supports offline-first mode via user setting
// 4. Handles background sync for failed requests when coming back online
// 5. Listens for skipWaiting messages for immediate updates
//
// ============================================================

const CACHE_NAME = 'flashstream-v5';
const OFFLINE_FIRST_KEY = 'offline-first-enabled';

// Expanded SAFE_PRECACHE - now includes critical static assets
// Only include URLs that are 100% guaranteed to return HTTP 200
// with no redirects from Cloudflare.
const SAFE_PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/css/global.css',
  '/js/app.js',
  '/js/main.js',
  '/js/settings.js',
  '/js/player.js',
  '/js/sw-registration.js'
];

// Assets that should be cached immediately on install (critical)
const CRITICAL_ASSETS = [
  '/offline.html',
  '/css/global.css'
];

// Configuration for background sync
const SYNC_TAG = 'flashstream-sync';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours for periodic sync

// Offline-first mode state (default: false)
let offlineFirstEnabled = false;

// Store pending requests when offline-first is enabled
let pendingRequests = [];

// ── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing version 5');
  
  // Always take control immediately — do not wait for old SW to die.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Try to cache all safe precache assets
        return cache.addAll(SAFE_PRECACHE).catch(err => {
          console.warn('[SW] Some precache assets failed, continuing:', err);
          // Fallback: cache critical assets individually
          return Promise.all(
            CRITICAL_ASSETS.map(asset =>
              cache.add(asset).catch(e => console.warn(`[SW] Failed to cache ${asset}:`, e))
            )
          );
        });
      })
      .catch(err => {
        console.error('[SW] Precache failed:', err);
      })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────
// Wipe every old cache version so stale content is never served.
self.addEventListener('activate', event => {
  console.log('[SW] Activating version 5');
  
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k.startsWith('flashstream-'))
          .map(k => {
            console.log('[SW] Removing old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        // Claim all clients immediately
        return self.clients.claim();
      })
      .then(() => {
        // Register for periodic background sync if supported
        if ('periodicSync' in self.registration) {
          return self.registration.periodicSync.register('flashstream-periodic', {
            minInterval: SYNC_INTERVAL_MS
          }).catch(err => {
            console.log('[SW] Periodic sync not supported or denied:', err);
          });
        }
      })
  );
});

// ── MESSAGE HANDLER ───────────────────────────────────────
// Handles messages from the main thread (settings page)
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SET_OFFLINE_FIRST':
      // Update offline-first mode setting
      offlineFirstEnabled = payload?.enabled === true;
      console.log('[SW] Offline-first mode set to:', offlineFirstEnabled);
      
      // Store setting in IndexedDB for persistence across sessions
      if (offlineFirstEnabled) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(OFFLINE_FIRST_KEY, new Response(JSON.stringify({ enabled: true })));
        });
      } else {
        caches.open(CACHE_NAME).then(cache => {
          cache.delete(OFFLINE_FIRST_KEY);
        });
      }
      
      // Send confirmation back to client
      event.source?.postMessage({
        type: 'OFFLINE_FIRST_CONFIRMED',
        payload: { enabled: offlineFirstEnabled }
      });
      break;
      
    case 'SKIP_WAITING':
      // Force the waiting service worker to become active
      console.log('[SW] Skip waiting requested');
      self.skipWaiting();
      event.source?.postMessage({
        type: 'SKIP_WAITING_COMPLETE'
      });
      break;
      
    case 'GET_OFFLINE_FIRST_STATUS':
      // Return current offline-first status
      event.source?.postMessage({
        type: 'OFFLINE_FIRST_STATUS',
        payload: { enabled: offlineFirstEnabled }
      });
      break;
      
    case 'CLEAR_CACHE':
      // Clear all cached assets on demand
      caches.keys().then(keys => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => {
          console.log('[SW] Cache cleared by user request');
          event.source?.postMessage({
            type: 'CACHE_CLEARED'
          });
        });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// ── BACKGROUND SYNC ───────────────────────────────────────
// Handles sync events for offline requests
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processPendingRequests());
  }
});

// Process all pending requests when back online
async function processPendingRequests() {
  const cache = await caches.open(CACHE_NAME);
  const pendingKey = 'pending-requests';
  const pendingResponse = await cache.match(pendingKey);
  
  if (!pendingResponse) {
    console.log('[SW] No pending requests to process');
    return;
  }
  
  const pending = await pendingResponse.json();
  console.log(`[SW] Processing ${pending.length} pending requests`);
  
  const results = [];
  for (const req of pending) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
      
      if (response.ok) {
        results.push({ url: req.url, success: true });
      } else {
        results.push({ url: req.url, success: false, status: response.status });
      }
    } catch (err) {
      results.push({ url: req.url, success: false, error: err.message });
    }
  }
  
  // Clear pending requests after processing
  await cache.delete(pendingKey);
  
  // Notify all clients about sync results
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      payload: { results, timestamp: Date.now() }
    });
  });
  
  console.log('[SW] Sync complete:', results);
}

// Store a request for later processing when offline-first mode is enabled
async function storePendingRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const pendingKey = 'pending-requests';
  const pendingResponse = await cache.match(pendingKey);
  
  let pending = [];
  if (pendingResponse) {
    pending = await pendingResponse.json();
  }
  
  // Don't store duplicates for same URL within 5 seconds
  const now = Date.now();
  const isDuplicate = pending.some(r => 
    r.url === request.url && (now - r.timestamp) < 5000
  );
  
  if (!isDuplicate) {
    pending.push({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.clone().text() : undefined,
      timestamp: now
    });
    
    // Keep only last 100 pending requests
    if (pending.length > 100) {
      pending = pending.slice(-100);
    }
    
    await cache.put(pendingKey, new Response(JSON.stringify(pending)));
  }
}

// ── PERIODIC BACKGROUND SYNC (Phase 3) ────────────────────
// Updates cached content periodically when device is online and idle
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'flashstream-periodic') {
    event.waitUntil(periodicCacheUpdate());
  }
});

async function periodicCacheUpdate() {
  console.log('[SW] Performing periodic cache update');
  const cache = await caches.open(CACHE_NAME);
  
  // Update critical assets in background
  const updatePromises = CRITICAL_ASSETS.map(async asset => {
    try {
      const response = await fetch(asset, { cache: 'no-cache' });
      if (response.ok) {
        await cache.put(asset, response);
        console.log(`[SW] Updated cached asset: ${asset}`);
      }
    } catch (err) {
      console.warn(`[SW] Failed to update ${asset}:`, err);
    }
  });
  
  await Promise.all(updatePromises);
  console.log('[SW] Periodic cache update complete');
}

// ── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.host === self.location.host;

  // ── HTML NAVIGATION — DO NOT INTERCEPT ──────────────────
  // Let the browser handle all HTML page navigation completely
  // on its own. The browser follows 308 redirects natively and
  // correctly. The SW intercepting these requests was the entire
  // cause of the redirect loop.
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
  const isStaticAsset = /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname);
  
  if (isSameOrigin && isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Return cached version immediately, but update in background
          if (navigator.onLine) {
            fetch(request).then(res => {
              if (res && res.ok) {
                caches.open(CACHE_NAME).then(cache => cache.put(request, res));
              }
            }).catch(() => {});
          }
          return cached;
        }

        return fetch(request).then(res => {
          if (res && res.ok) {
            const toCache = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
          }
          return res;
        }).catch(() => {
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // ── OFFLINE-FIRST MODE HANDLING ─────────────────────────
  // When offline-first is enabled, try cache first for all GET requests
  if (offlineFirstEnabled && request.method === 'GET' && isSameOrigin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(res => {
          if (res && res.ok) {
            const toCache = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
          }
          return res;
        }).catch(async () => {
          // Offline and not in cache - store for background sync if POST/PUT/DELETE
          if (request.method !== 'GET') {
            await storePendingRequest(request);
          }
          return caches.match('/offline.html') || new Response('Offline - content unavailable', { status: 503 });
        });
      })
    );
    return;
  }

  // ── MANIFEST & OTHER PRECACHED FILES ────────────────────
  if (isSameOrigin && (url.pathname === '/manifest.json' || url.pathname === '/')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // ── API CALLS & NON-GET REQUESTS WITH OFFLINE-FIRST ─────
  // For non-GET requests in offline-first mode, store for sync
  if (offlineFirstEnabled && request.method !== 'GET' && isSameOrigin) {
    event.respondWith(
      fetch(request).catch(async () => {
        await storePendingRequest(request);
        return new Response(JSON.stringify({
          queued: true,
          message: 'Request queued for background sync'
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // ── EVERYTHING ELSE — NETWORK FIRST ─────────────────────
  // API calls to the Cloudflare worker, TMDB image CDN requests,
  // external scripts — network first with offline fallback.
  event.respondWith(
    fetch(request).catch(async error => {
      console.log('[SW] Network request failed, checking cache:', request.url, error);
      
      // Try cache as fallback
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
      
      // If navigation somehow reaches here while offline,
      // serve the offline page.
      if (isNavigation || isHtmlAccept) {
        return caches.match('/offline.html');
      }
      
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});

// ── PUSH NOTIFICATION HANDLER (Future Phase) ──────────────
self.addEventListener('push', event => {
  console.log('[SW] Push notification received:', event);
  
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New content available!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'FlashStream Update', options)
    );
  } catch (err) {
    console.error('[SW] Push notification error:', err);
  }
});

// ── NOTIFICATION CLICK HANDLER ────────────────────────────
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if there is already a window/tab open with the target URL
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ── ONLINE/OFFLINE STATUS BROADCAST ───────────────────────
self.addEventListener('online', () => {
  console.log('[SW] Browser is online');
  // Trigger background sync when coming back online
  if ('sync' in self.registration) {
    self.registration.sync.register(SYNC_TAG).catch(err => {
      console.log('[SW] Sync registration failed:', err);
    });
  }
  
  // Notify all clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'ONLINE_STATUS', payload: { online: true } });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('[SW] Browser is offline');
  
  // Notify all clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'ONLINE_STATUS', payload: { online: false } });
    });
  });
});
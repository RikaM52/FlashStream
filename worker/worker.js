// ============================================================
// FLASHSTREAM WORKER — v2
// Cloudflare Worker + D1 + KV
// ============================================================

// ── CONSTANTS ────────────────────────────────────────────────

const VALID_COUNTRIES = [
  'US','GB','CA','AU','NZ','SG','MY','PH','ID','TH','VN','KR','JP',
  'CN','TW','HK','IN','DE','FR','NL','SE','NO','DK','FI','IT','ES',
  'BR','MX','AR','ZA','NG','KE','EG','AE','SA','IL','TR','PL','CZ',
  'RO','HU','PT','BE','AT','CH','IE','GR','HR','SK','BG','LT','LV',
  'EE','SI','RS','UA','BY','KZ','UZ','GE','AM','AZ','PK','BD','LK',
  'NP','MM','KH','LA','BN','MO','XX'
];

const VALID_LANGUAGES = [
  'ko','zh','ja','th','vi','ms','id','tl','hi','ta','te','bn','ur',
  'en','fr','de','es','pt','it','nl','pl','ru','tr','ar','fa','mi',
  'sv','da','no','fi','cs','sk','ro','hu','el','uk','he','all'
];

const VALID_MEDIA_TYPES  = ['movie','tv','short'];
const VALID_STATUSES     = ['want_to_watch','watching','finished','dropped','rewatch','favorites'];
const VALID_PERSON_TYPES = ['actor','director','writer','studio'];

const RATE_LIMITS = {
  default:      { max: 100,  window: 60  },
  auth:         { max: 10,   window: 60  },
  register:     { max: 5,    window: 300 },
  search:       { max: 60,   window: 60  },
  analytics:    { max: 200,  window: 60  },
  b2b:          { max: 50,   window: 60  },
};

// ── ENTRY POINT ──────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // OPTIONS pre-flight
    if (request.method === 'OPTIONS') return handleCORS(request, env);

    try {
      const response = await route(request, env, ctx);
      return withCORS(response, request, env);
    } catch (err) {
      console.error('Unhandled error:', err);
      return withCORS(jsonError('Internal server error', 500), request, env);
    }
  },

  async scheduled(event, env, ctx) {
    switch (event.cron) {
      case '0 */6 * * *':   await cronRefreshLeavingSoon(env);  break;
      case '0 2 * * *':     await cronCleanup(env);             break;
      case '0 3 * * 1':     await cronAggregateB2B(env);        break;
      case '*/30 * * * *':  await cronWarmCache(env);           break;
    }
  },
};

// ── ROUTER ───────────────────────────────────────────────────

async function route(request, env, ctx) {
  const url      = new URL(request.url);
  const path     = url.pathname;
  const method   = request.method;

  // ── Security gates (order matters) ──
  const secErr = await checkSecurity(request, env, path);
  if (secErr) return secErr;

  // ── Route table ──
  // Auth
  if (path === '/api/auth/register'    && method === 'POST')   return handleRegister(request, env);
  if (path === '/api/auth/login'       && method === 'POST')   return handleLogin(request, env);
  if (path === '/api/auth/logout'      && method === 'POST')   return handleLogout(request, env);
  if (path === '/api/auth/verify'      && method === 'GET')    return handleVerifyEmail(request, env);
  if (path === '/api/auth/google'      && method === 'POST')   return handleOAuthGoogle(request, env);
  if (path === '/api/auth/apple'       && method === 'POST')   return handleOAuthApple(request, env);
  if (path === '/api/auth/forgot'      && method === 'POST')   return handleForgotPassword(request, env);
  if (path === '/api/auth/reset'       && method === 'POST')   return handleResetPassword(request, env);
  if (path === '/api/auth/me'          && method === 'GET')    return handleMe(request, env);

  // Watchlist
  if (path === '/api/watchlist'        && method === 'GET')    return handleWatchlistGet(request, env);
  if (path === '/api/watchlist'        && method === 'POST')   return handleWatchlistAdd(request, env);
  if (path === '/api/watchlist'        && method === 'PATCH')  return handleWatchlistUpdate(request, env);
  if (path === '/api/watchlist'        && method === 'DELETE') return handleWatchlistRemove(request, env);

  // Ratings
  if (path === '/api/ratings'          && method === 'GET')    return handleRatingsGet(request, env);
  if (path === '/api/ratings'          && method === 'POST')   return handleRatingsSet(request, env);

  // Follows
  if (path === '/api/follows'          && method === 'GET')    return handleFollowsGet(request, env);
  if (path === '/api/follows'          && method === 'POST')   return handleFollowsAdd(request, env);
  if (path === '/api/follows'          && method === 'DELETE') return handleFollowsRemove(request, env);

  // Recommendations
  if (path === '/api/recommendations'  && method === 'POST')   return handleRecommend(request, env);

  // Content
  if (path === '/api/leaving-soon'     && method === 'GET')    return handleLeavingSoon(request, env);
  if (path === '/api/upcoming'         && method === 'GET')    return handleUpcoming(request, env);
  if (path === '/api/geo'              && method === 'GET')    return handleGeo(request, env);

  // Community
  if (path === '/api/tags'             && method === 'GET')    return handleTagsGet(request, env);
  if (path === '/api/tags'             && method === 'POST')   return handleTagsSubmit(request, env);
  if (path === '/api/tags/vote'        && method === 'POST')   return handleTagVote(request, env);
  if (path === '/api/sentiment'        && method === 'POST')   return handleSentimentSubmit(request, env);
  if (path === '/api/sentiment'        && method === 'GET')    return handleSentimentGet(request, env);
  if (path === '/api/tropes'           && method === 'GET')    return handleTropesGet(request, env);
  if (path === '/api/activity'         && method === 'GET')    return handleActivityFeed(request, env);
  if (path === '/api/tropes/suggest'   && method === 'POST')   return handleTropeSuggest(request, env);

  // Analytics (soft names — no "track" or "analytics" in URL)
  if (path === '/api/ping'             && method === 'POST')   return handlePing(request, env);
  if (path === '/api/metrics/dwell'    && method === 'POST')   return handleDwell(request, env);
  if (path === '/api/metrics/click'    && method === 'POST')   return handleOutboundClick(request, env);
  if (path === '/api/metrics/trailer'  && method === 'POST')   return handleTrailerPlay(request, env);
  if (path === '/api/metrics/search'   && method === 'POST')   return handleSearchMetric(request, env);
  if (path === '/api/metrics/filter'   && method === 'POST')   return handleFilterAbandon(request, env);
  if (path === '/api/metrics/consent'  && method === 'POST')   return handleConsentLog(request, env);

  // B2B (API key required)
  if (path === '/api/b2b/trends'       && method === 'GET')    return handleB2BTrends(request, env);
  if (path === '/api/b2b/heatmap'      && method === 'GET')    return handleB2BHeatmap(request, env);
  if (path === '/api/b2b/export/csv'   && method === 'GET')    return handleB2BExportCSV(request, env);

  // Admin
  if (path === '/api/admin/leaving-soon' && method === 'POST') return handleAdminLeavingSoon(request, env);
  if (path === '/api/admin/tags'         && method === 'PATCH')return handleAdminTagModerate(request, env);

  // Health
  if (path === '/api/health'           && method === 'GET')    return jsonOK({ status: 'ok', ts: Date.now() });

  // Honeypot catch-all for fake paths
  if (path.startsWith('/api/internal') ||
      path.startsWith('/api/admin/db') ||
      path.startsWith('/api/debug'))   return handleHoneypotTrap(request, env);

  return jsonError('Not found', 404);
}

// ── SECURITY MIDDLEWARE ───────────────────────────────────────

async function checkSecurity(request, env, path) {
  // 1. Client header check (skip B2B — they use API keys instead)
  if (!path.startsWith('/api/b2b') && !path.startsWith('/api/health')) {
    const clientHeader = request.headers.get(env.CLIENT_HEADER_KEY);
    if (clientHeader !== env.CLIENT_HEADER_VALUE) {
      await logHoneypotHit(env, request, path, 'missing_client_header');
      return jsonError('Forbidden', 403);
    }
  }

  // 2. Honeypot TMDB ID check (query param)
  const url = new URL(request.url);
  const tmdbId = url.searchParams.get('id') || url.searchParams.get('tmdb_id');
  if (tmdbId) {
    const honeypots = (env.HONEYPOT_TMDB_IDS || '').split(',');
    if (honeypots.includes(tmdbId)) {
      await logHoneypotHit(env, request, path, 'honeypot_tmdb_id');
      return jsonError('Not found', 404);
    }
  }

  // 3. Rate limiting
  const limitKey  = rateLimitKey(path);
  const limitConf = RATE_LIMITS[limitKey] || RATE_LIMITS.default;
  const ipHash    = await hashIP(request, env);
  const limited   = await checkRateLimit(env, ipHash, limitKey, limitConf);
  if (limited) return jsonError('Too many requests', 429);

  // 4. Banned IP check
  const banned = await env.RATE_LIMITS.get(`ban:${ipHash}`);
  if (banned) return jsonError('Forbidden', 403);

  return null;
}

function rateLimitKey(path) {
  if (path === '/api/auth/register') return 'register';
  if (path.startsWith('/api/auth'))  return 'auth';
  if (path === '/api/ping' || path.startsWith('/api/metrics')) return 'analytics';
  if (path.startsWith('/api/b2b'))   return 'b2b';
  return 'default';
}

async function checkRateLimit(env, ipHash, endpoint, { max, window: win }) {
  const key = `rl:${ipHash}:${endpoint}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    const raw = await env.RATE_LIMITS.get(key);
    if (!raw) {
      await env.RATE_LIMITS.put(key, JSON.stringify({ count: 1, start: now }), { expirationTtl: win });
      return false;
    }
    const data = JSON.parse(raw);
    if (now - data.start > win) {
      await env.RATE_LIMITS.put(key, JSON.stringify({ count: 1, start: now }), { expirationTtl: win });
      return false;
    }
    if (data.count >= max) return true;
    await env.RATE_LIMITS.put(key, JSON.stringify({ count: data.count + 1, start: data.start }), { expirationTtl: win });
    return false;
  } catch {
    return false; // fail open — don't block on KV errors
  }
}

async function logHoneypotHit(env, request, endpoint, reason) {
  try {
    const ipHash = await hashIP(request, env);
    const ua     = request.headers.get('user-agent') || '';
    const hit    = await env.DB.prepare(
      `SELECT id, strike_count FROM honeypot_hits WHERE ip_hash = ?`
    ).bind(ipHash).first();

    if (hit) {
      const newCount = hit.strike_count + 1;
      await env.DB.prepare(
        `UPDATE honeypot_hits SET strike_count = ?, last_hit = unixepoch(), banned = ?
         WHERE ip_hash = ?`
      ).bind(newCount, newCount >= 3 ? 1 : 0, ipHash).run();
      if (newCount >= 3) {
        await env.RATE_LIMITS.put(`ban:${ipHash}`, '1', { expirationTtl: 86400 });
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO honeypot_hits (ip_hash, endpoint, user_agent) VALUES (?, ?, ?)`
      ).bind(ipHash, endpoint + ':' + reason, ua.slice(0, 200)).run();
    }
  } catch { /* non-fatal */ }
}

// ── CORS ─────────────────────────────────────────────────────

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (origin === env.ALLOWED_ORIGIN) return origin;
  if (env.ENVIRONMENT !== 'production' && origin === env.ALLOWED_ORIGIN_DEV) return origin;
  return env.ALLOWED_ORIGIN; // default to prod — blocks cross-origin preflight
}

function corsHeaders(request, env) {
  return {
    'Access-Control-Allow-Origin':      getAllowedOrigin(request, env),
    'Access-Control-Allow-Methods':     'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-FlashStream-Client',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age':           '86400',
    'Vary':                             'Origin',
  };
}

function handleCORS(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function withCORS(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) {
    headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers });
}

// ── JWT ───────────────────────────────────────────────────────

async function signJWT(payload, secret) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify(payload));
  const sig     = await hmacSHA256(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const expected = await hmacSHA256(`${header}.${body}`, secret);
    if (!timingSafeEqual(sig, expected)) return null;
    const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hmacSHA256(data, secret) {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64url(sig);
}

function b64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(unescape(encodeURIComponent(input)));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── PASSWORD HASHING (scrypt via SubtleCrypto PBKDF2 fallback) ──
// Workers don't expose scrypt directly; PBKDF2 is the available standard.

async function hashPassword(password, salt) {
  const enc     = new TextEncoder();
  const keyMat  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits    = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 310000, hash: 'SHA-256' },
    keyMat, 256
  );
  return bufferToHex(bits);
}

async function generateSalt() {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(buf);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// hash format: "pbkdf2$<salt>$<hash>"
async function createPasswordHash(password) {
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);
  return `pbkdf2$${salt}$${hash}`;
}

async function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const attempt = await hashPassword(password, salt);
  return timingSafeEqual(attempt, hash);
}

// ── IP ANONYMIZATION ─────────────────────────────────────────

async function hashIP(request, env) {
  const ip  = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const enc = new TextEncoder();
  // Salt with JWT_SECRET so hash can't be reversed without the secret
  const data = await crypto.subtle.digest('SHA-256', enc.encode(ip + (env.JWT_SECRET || 'fs-ip-salt')));
  return bufferToHex(data).slice(0, 16); // truncate — we don't need full hash
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────────

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = getCookie(request, env.SESSION_COOKIE_NAME);
  const jwt = token || cookieToken;
  if (!jwt) return { user: null, error: jsonError('Unauthorized', 401) };

  const payload = await verifyJWT(jwt, env.JWT_SECRET);
  if (!payload) return { user: null, error: jsonError('Unauthorized', 401) };

  // Check session is still alive in KV
  const sessionKey = `session:${payload.sub}:${payload.jti}`;
  const sessionAlive = await env.SESSIONS.get(sessionKey);
  if (!sessionAlive) return { user: null, error: jsonError('Session expired', 401) };

  return { user: payload, error: null };
}

function getCookie(request, name) {
  const cookieStr = request.headers.get('Cookie') || '';
  for (const part of cookieStr.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function makeSessionCookie(token, maxAge, env) {
  return `${env.SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}

// ── TOKEN HELPERS ─────────────────────────────────────────────

function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return bufferToHex(buf);
}

// ── VALIDATION HELPERS ────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}

function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

// ── RESPONSE HELPERS ──────────────────────────────────────────

function jsonOK(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GEO ───────────────────────────────────────────────────────

async function handleGeo(request, env) {
  const country  = request.headers.get('CF-IPCountry') || 'XX';
  const city     = request.cf?.city || 'Unknown';
  const timezone = request.cf?.timezone || 'UTC';
  return jsonOK({ country, city, timezone });
}

// ── AUTH: REGISTER ────────────────────────────────────────────

async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const email    = sanitize(body.email || '', 254).toLowerCase();
  const password = body.password || '';
  const region   = VALID_COUNTRIES.includes(body.region) ? body.region : 'US';

  if (!isValidEmail(email))    return jsonError('Invalid email');
  if (!isValidPassword(password)) return jsonError('Password must be 8–128 characters');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return jsonError('Email already registered', 409);

  const passwordHash  = await createPasswordHash(password);
  const verifyToken   = randomToken();
  const verifyExpiry  = Math.floor(Date.now() / 1000) + Number(env.VERIFY_TOKEN_EXPIRY || 86400);
  const displayName   = sanitize(body.display_name || email.split('@')[0], 50);

  const result = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, display_name, region) VALUES (?, ?, ?, ?)`
  ).bind(email, passwordHash, displayName, region).run();

  const userId = result.meta.last_row_id;

  await env.DB.prepare(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).bind(userId, verifyToken, verifyExpiry).run();

  // Send verification email (non-blocking)
  sendVerificationEmail(env, email, verifyToken).catch(() => {});

  return jsonOK({ message: 'Registration successful. Check your email to verify your account.' }, 201);
}

// ── AUTH: LOGIN ───────────────────────────────────────────────

async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const email    = sanitize(body.email || '', 254).toLowerCase();
  const password = body.password || '';

  if (!isValidEmail(email)) return jsonError('Invalid credentials', 401);

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, verified, trust_level, display_name, region
     FROM users WHERE email = ?`
  ).bind(email).first();

  // Constant-time: always run verifyPassword even if user not found
  const dummyHash = 'pbkdf2$0000000000000000$0000000000000000';
  const valid = user
    ? await verifyPassword(password, user.password_hash || dummyHash)
    : await verifyPassword(password, dummyHash) && false;

  if (!valid || !user) return jsonError('Invalid credentials', 401);
  if (!user.verified)  return jsonError('Please verify your email first', 403);

  const jti      = randomToken(16);
  const now      = Math.floor(Date.now() / 1000);
  const expiry   = now + Number(env.JWT_EXPIRY_SECONDS || 604800);

  const payload  = {
    sub:    user.id,
    email:  user.email,
    name:   user.display_name,
    role:   user.trust_level,
    region: user.region,
    jti,
    iat:    now,
    exp:    expiry,
  };

  const token = await signJWT(payload, env.JWT_SECRET);

  // Store session in KV
  await env.SESSIONS.put(
    `session:${user.id}:${jti}`,
    JSON.stringify({ userId: user.id, createdAt: now }),
    { expirationTtl: Number(env.JWT_EXPIRY_SECONDS || 604800) }
  );

  await env.DB.prepare(
    `UPDATE users SET last_login = unixepoch() WHERE id = ?`
  ).bind(user.id).run();

  const maxAge = Number(env.JWT_EXPIRY_SECONDS || 604800);
  return jsonOK(
    { token, user: { id: user.id, email: user.email, name: user.display_name, region: user.region, trust_level: user.trust_level } },
    200,
    { 'Set-Cookie': makeSessionCookie(token, maxAge, env) }
  );
}

// ── AUTH: LOGOUT ──────────────────────────────────────────────

async function handleLogout(request, env) {
  const { user } = await requireAuth(request, env);
  if (user) {
    await env.SESSIONS.delete(`session:${user.sub}:${user.jti}`);
  }
  return jsonOK(
    { message: 'Logged out' },
    200,
    { 'Set-Cookie': makeSessionCookie('', 0, env) }
  );
}

// ── AUTH: VERIFY EMAIL ────────────────────────────────────────

async function handleVerifyEmail(request, env) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return jsonError('Missing token');

  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT user_id, expires_at, used FROM email_verification_tokens WHERE token = ?`
  ).bind(token).first();

  if (!row)            return jsonError('Invalid token');
  if (row.used)        return jsonError('Token already used');
  if (row.expires_at < now) return jsonError('Token expired');

  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET verified = 1 WHERE id = ?`).bind(row.user_id),
    env.DB.prepare(`UPDATE email_verification_tokens SET used = 1 WHERE token = ?`).bind(token),
  ]);

  return jsonOK({ message: 'Email verified. You can now log in.' });
}

// ── AUTH: FORGOT PASSWORD ─────────────────────────────────────

async function handleForgotPassword(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }
  const email = sanitize(body.email || '', 254).toLowerCase();
  if (!isValidEmail(email)) return jsonError('Invalid email');

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();

  // Always return success — don't leak whether email exists
  if (user) {
    const token  = randomToken();
    const expiry = Math.floor(Date.now() / 1000) + Number(env.RESET_TOKEN_EXPIRY || 3600);
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
    ).bind(user.id, token, expiry).run();
    sendPasswordResetEmail(env, email, token).catch(() => {});
  }

  return jsonOK({ message: 'If that email is registered, a reset link has been sent.' });
}

// ── AUTH: RESET PASSWORD ──────────────────────────────────────

async function handleResetPassword(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { token, password } = body;
  if (!token || !isValidPassword(password)) return jsonError('Invalid request');

  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?`
  ).bind(token).first();

  if (!row || row.used || row.expires_at < now) return jsonError('Invalid or expired token');

  const newHash = await createPasswordHash(password);
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newHash, row.user_id),
    env.DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?`).bind(token),
  ]);

  return jsonOK({ message: 'Password updated. Please log in.' });
}

// ── AUTH: ME ──────────────────────────────────────────────────

async function handleMe(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const row = await env.DB.prepare(
    `SELECT id, email, display_name, region, trust_level, verified, created_at FROM users WHERE id = ?`
  ).bind(user.sub).first();

  if (!row) return jsonError('User not found', 404);
  return jsonOK({ user: row });
}

// ── AUTH: OAUTH STUBS ─────────────────────────────────────────
// Wire to real provider SDKs when ready; return 501 for now.

async function handleOAuthGoogle(request, env) {
  return jsonError('Google OAuth not yet configured', 501);
}

async function handleOAuthApple(request, env) {
  return jsonError('Apple OAuth not yet configured', 501);
}

// ── WATCHLIST ─────────────────────────────────────────────────

async function handleWatchlistGet(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const url    = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query  = `SELECT * FROM user_watchlist WHERE user_id = ?`;
  const args = [user.sub];

  if (status && VALID_STATUSES.includes(status)) {
    query += ` AND status = ?`;
    args.push(status);
  }

  query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);

  const rows = await env.DB.prepare(query).bind(...args).all();
  return jsonOK({ items: rows.results || [], total: rows.results?.length || 0 });
}

async function handleWatchlistAdd(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, media_type, title, poster_path, status = 'want_to_watch' } = body;
  if (!tmdb_id || !VALID_MEDIA_TYPES.includes(media_type) || !title)
    return jsonError('Missing required fields');
  if (!VALID_STATUSES.includes(status)) return jsonError('Invalid status');

  try {
    await env.DB.prepare(
      `INSERT INTO user_watchlist (user_id, tmdb_id, media_type, title, poster_path, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET status = excluded.status, updated_at = unixepoch()`
    ).bind(user.sub, tmdb_id, media_type, sanitize(title, 200), sanitize(poster_path || '', 300), status).run();
  } catch (e) {
    return jsonError('Failed to add item');
  }

  // Log watchlist add for analytics (non-blocking)
  const country = request.headers.get('CF-IPCountry') || 'XX';
  env.DB.prepare(`INSERT INTO watchlist_adds (tmdb_id, country) VALUES (?, ?)`)
    .bind(tmdb_id, country).run().catch(() => {});

  return jsonOK({ message: 'Added to watchlist' }, 201);
}

async function handleWatchlistUpdate(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, media_type, status, user_rating, notes, episodes_watched } = body;
  if (!tmdb_id || !media_type) return jsonError('Missing tmdb_id or media_type');

  const fields = [];
  const args   = [];

  if (status && VALID_STATUSES.includes(status))       { fields.push('status = ?');            args.push(status); }
  if (user_rating >= 1 && user_rating <= 10)           { fields.push('user_rating = ?');        args.push(user_rating); }
  if (typeof notes === 'string')                        { fields.push('notes = ?');              args.push(sanitize(notes, 500)); }
  if (typeof episodes_watched === 'number')            { fields.push('episodes_watched = ?');   args.push(episodes_watched); }

  if (!fields.length) return jsonError('No fields to update');

  fields.push('updated_at = unixepoch()');
  args.push(user.sub, tmdb_id, media_type);

  await env.DB.prepare(
    `UPDATE user_watchlist SET ${fields.join(', ')} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`
  ).bind(...args).run();

  return jsonOK({ message: 'Updated' });
}

async function handleWatchlistRemove(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const url        = new URL(request.url);
  const tmdb_id    = url.searchParams.get('tmdb_id');
  const media_type = url.searchParams.get('media_type');

  if (!tmdb_id || !media_type) return jsonError('Missing params');

  await env.DB.prepare(
    `DELETE FROM user_watchlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`
  ).bind(user.sub, tmdb_id, media_type).run();

  return jsonOK({ message: 'Removed' });
}

// ── RATINGS ───────────────────────────────────────────────────

async function handleRatingsGet(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const tmdb_id = new URL(request.url).searchParams.get('tmdb_id');
  if (tmdb_id) {
    const row = await env.DB.prepare(
      `SELECT rating FROM user_ratings WHERE user_id = ? AND tmdb_id = ?`
    ).bind(user.sub, tmdb_id).first();
    return jsonOK({ rating: row?.rating || null });
  }

  const rows = await env.DB.prepare(
    `SELECT tmdb_id, media_type, rating FROM user_ratings WHERE user_id = ?`
  ).bind(user.sub).all();
  return jsonOK({ ratings: rows.results || [] });
}

async function handleRatingsSet(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, media_type, rating } = body;
  if (!tmdb_id || !VALID_MEDIA_TYPES.includes(media_type)) return jsonError('Invalid fields');
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return jsonError('Rating must be 1–10');

  await env.DB.prepare(
    `INSERT INTO user_ratings (user_id, tmdb_id, media_type, rating)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, tmdb_id) DO UPDATE SET rating = excluded.rating, updated_at = unixepoch()`
  ).bind(user.sub, tmdb_id, media_type, rating).run();

  return jsonOK({ message: 'Rating saved' });
}

// ── FOLLOWS ───────────────────────────────────────────────────

async function handleFollowsGet(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const rows = await env.DB.prepare(
    `SELECT person_id, person_name, person_type, created_at FROM user_follows WHERE user_id = ?`
  ).bind(user.sub).all();
  return jsonOK({ follows: rows.results || [] });
}

async function handleFollowsAdd(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { person_id, person_name, person_type = 'actor' } = body;
  if (!person_id) return jsonError('Missing person_id');
  if (!VALID_PERSON_TYPES.includes(person_type)) return jsonError('Invalid person_type');

  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_follows (user_id, person_id, person_name, person_type) VALUES (?, ?, ?, ?)`
  ).bind(user.sub, person_id, sanitize(person_name || '', 100), person_type).run();

  return jsonOK({ message: 'Following' }, 201);
}

async function handleFollowsRemove(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  const person_id = new URL(request.url).searchParams.get('person_id');
  if (!person_id) return jsonError('Missing person_id');

  await env.DB.prepare(
    `DELETE FROM user_follows WHERE user_id = ? AND person_id = ?`
  ).bind(user.sub, person_id).run();

  return jsonOK({ message: 'Unfollowed' });
}

// ── RECOMMENDATIONS ───────────────────────────────────────────

async function handleRecommend(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, media_type, title, recommended_to, message } = body;
  if (!tmdb_id || !VALID_MEDIA_TYPES.includes(media_type)) return jsonError('Invalid fields');

  await env.DB.prepare(
    `INSERT INTO user_recommendations (user_id, tmdb_id, media_type, title, recommended_to, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(user.sub, tmdb_id, media_type, sanitize(title || '', 200),
         sanitize(recommended_to || '', 254), sanitize(message || '', 500)).run();

  return jsonOK({ message: 'Recommendation saved' }, 201);
}

// ── LEAVING SOON ──────────────────────────────────────────────

async function handleLeavingSoon(request, env) {
  const url     = new URL(request.url);
  const country = (url.searchParams.get('country') || request.headers.get('CF-IPCountry') || 'US').toUpperCase();
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  const cacheKey = `leaving_soon:${country}`;
  try {
    const cached = await env.LEAVING_SOON_CACHE.get(cacheKey, { type: 'json' });
    if (cached) return jsonOK(cached);
  } catch { /* fall through */ }

  const rows = await env.DB.prepare(
    `SELECT tmdb_id, media_type, title, poster_path, platform, leaving_date, urgency
     FROM leaving_soon
     WHERE country_code = ? AND leaving_date >= date('now')
     ORDER BY leaving_date ASC
     LIMIT ?`
  ).bind(country, limit).all();

  const data = { items: rows.results || [], country, generated_at: Date.now() };
  env.LEAVING_SOON_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 21600 }).catch(() => {});

  return jsonOK(data);
}

// ── UPCOMING / COMING SOON ────────────────────────────────────

async function handleUpcoming(request, env) {
  const url      = new URL(request.url);
  const language = VALID_LANGUAGES.includes(url.searchParams.get('language')) ? url.searchParams.get('language') : 'all';
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const cacheKey = `upcoming:${language}`;

  try {
    const cached = await env.CACHE.get(cacheKey, { type: 'json' });
    if (cached) return jsonOK(cached);
  } catch { /* fall through */ }

  // Stub: return from TMDB when TMDB_API_KEY present, else empty
  if (env.TMDB_API_KEY) {
    try {
      const langParam = language === 'all' ? '' : `&with_original_language=${language}`;
      const tmdbUrl   = `https://api.themoviedb.org/3/discover/tv?api_key=${env.TMDB_API_KEY}&sort_by=first_air_date.asc&first_air_date.gte=${todayISO()}&page=1${langParam}`;
      const res       = await fetch(tmdbUrl);
      const tmdbData  = await res.json();
      const items     = (tmdbData.results || []).slice(0, limit);
      const data      = { items, language, generated_at: Date.now() };
      env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 }).catch(() => {});
      return jsonOK(data);
    } catch { /* fall through to empty */ }
  }

  return jsonOK({ items: [], language, generated_at: Date.now(), note: 'TMDB_API_KEY not configured' });
}

// ── COMMUNITY: TAGS ───────────────────────────────────────────

async function handleTagsGet(request, env) {
  const tmdb_id = new URL(request.url).searchParams.get('tmdb_id');
  if (!tmdb_id) return jsonError('Missing tmdb_id');

  const rows = await env.DB.prepare(
    `SELECT ct.id, ct.tag_name, ct.status, ct.trust_level,
            COALESCE(SUM(tv.vote_value * tv.weight), 0) AS score,
            COUNT(tv.id) AS vote_count
     FROM community_tags ct
     LEFT JOIN tag_votes tv ON tv.tag_id = ct.id
     WHERE ct.tmdb_id = ? AND ct.status IN ('pending','approved')
     GROUP BY ct.id
     ORDER BY score DESC`
  ).bind(tmdb_id).all();

  return jsonOK({ tags: rows.results || [] });
}

async function handleTagsSubmit(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, tag_name } = body;
  if (!tmdb_id || !tag_name) return jsonError('Missing fields');

  const tag = sanitize(tag_name, 60).toLowerCase().replace(/\s+/g, '_');
  if (tag.length < 2) return jsonError('Tag too short');

  // Check for duplicates
  const exists = await env.DB.prepare(
    `SELECT id FROM community_tags WHERE tmdb_id = ? AND tag_name = ?`
  ).bind(tmdb_id, tag).first();
  if (exists) return jsonError('Tag already exists for this title', 409);

  // Auto-approve if trust_level >= 3
  const userRow = await env.DB.prepare('SELECT trust_level FROM users WHERE id = ?').bind(user.sub).first();
  const trust   = userRow?.trust_level || 1;
  const status  = trust >= 3 ? 'approved' : 'pending';

  const result = await env.DB.prepare(
    `INSERT INTO community_tags (tmdb_id, tag_name, user_id, trust_level, status) VALUES (?, ?, ?, ?, ?)`
  ).bind(tmdb_id, tag, user.sub, trust, status).run();

  return jsonOK({ message: 'Tag submitted', status, id: result.meta.last_row_id }, 201);
}

async function handleTagVote(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tag_id, vote } = body;
  if (!tag_id || ![1, -1].includes(vote)) return jsonError('Invalid vote');

  const userRow = await env.DB.prepare('SELECT trust_level FROM users WHERE id = ?').bind(user.sub).first();
  const weight  = Math.min((userRow?.trust_level || 1) / 5 + 0.8, 1.0);

  await env.DB.prepare(
    `INSERT INTO tag_votes (tag_id, user_id, vote_value, weight)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (tag_id, user_id) DO UPDATE SET vote_value = excluded.vote_value, weight = excluded.weight`
  ).bind(tag_id, user.sub, vote, weight).run();

  // Promote or demote tag based on accumulated score
  await updateTagStatus(env, tag_id);

  return jsonOK({ message: 'Vote recorded' });
}

async function updateTagStatus(env, tagId) {
  try {
    const score = await env.DB.prepare(
      `SELECT COALESCE(SUM(vote_value * weight), 0) AS score FROM tag_votes WHERE tag_id = ?`
    ).bind(tagId).first();

    const s = score?.score || 0;
    let newStatus;
    if (s >= 5)      newStatus = 'approved';
    else if (s <= -3) newStatus = 'rejected';
    else              return;

    await env.DB.prepare(
      `UPDATE community_tags SET status = ? WHERE id = ?`
    ).bind(newStatus, tagId).run();

    if (newStatus === 'approved') {
      const tag = await env.DB.prepare(
        `SELECT tmdb_id, tag_name FROM community_tags WHERE id = ?`
      ).bind(tagId).first();
      if (tag) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO verified_tags (tmdb_id, tag_name, vote_score) VALUES (?, ?, ?)`
        ).bind(tag.tmdb_id, tag.tag_name, s).run();
      }
    }
  } catch { /* non-fatal */ }
}

// ── COMMUNITY: SENTIMENT ──────────────────────────────────────

const VALID_SENTIMENTS = ['loved_it','masterpiece','exceeded_expectations','mixed_feelings','boring','dropped'];

async function handleSentimentSubmit(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tmdb_id, sentiment_value, season = 1, episode = 1, episode_rating, episode_attributes } = body;
  if (!tmdb_id || !VALID_SENTIMENTS.includes(sentiment_value)) return jsonError('Invalid fields');

  const country    = request.headers.get('CF-IPCountry') || 'XX';
  const { user }   = await requireAuth(request, env);
  const userId     = user?.sub || null;

  const attrs = Array.isArray(episode_attributes)
    ? JSON.stringify(episode_attributes.map(a => sanitize(a, 50)).slice(0, 10))
    : null;

  await env.DB.prepare(
    `INSERT INTO sentiment_votes
     (tmdb_id, sentiment_value, episode_rating, user_id, season, episode, episode_attributes, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tmdb_id, sentiment_value,
         (Number.isInteger(episode_rating) && episode_rating >= 1 && episode_rating <= 5) ? episode_rating : null,
         userId, season, episode, attrs, country).run();

  return jsonOK({ message: 'Sentiment recorded' });
}

async function handleSentimentGet(request, env) {
  const url     = new URL(request.url);
  const tmdb_id = url.searchParams.get('tmdb_id');
  if (!tmdb_id) return jsonError('Missing tmdb_id');

  const cacheKey = `sentiment:${tmdb_id}`;
  try {
    const cached = await env.CACHE.get(cacheKey, { type: 'json' });
    if (cached) return jsonOK(cached);
  } catch { /* fall through */ }

  const rows = await env.DB.prepare(
    `SELECT sentiment_value, COUNT(*) AS count
     FROM sentiment_votes WHERE tmdb_id = ?
     GROUP BY sentiment_value ORDER BY count DESC`
  ).bind(tmdb_id).all();

  const byRegion = await env.DB.prepare(
    `SELECT country, sentiment_value, COUNT(*) AS count
     FROM sentiment_votes WHERE tmdb_id = ?
     GROUP BY country, sentiment_value ORDER BY count DESC`
  ).bind(tmdb_id).all();

  const data = {
    tmdb_id,
    overall:   rows.results || [],
    by_region: byRegion.results || [],
  };

  env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 }).catch(() => {});
  return jsonOK(data);
}

// ── COMMUNITY: TROPES ─────────────────────────────────────────

async function handleTropesGet(request, env) {
  const url       = new URL(request.url);
  const country   = VALID_COUNTRIES.includes(url.searchParams.get('country')) ? url.searchParams.get('country') : null;
  const cacheKey  = `tropes:${country || 'global'}`;

  try {
    const cached = await env.CACHE.get(cacheKey, { type: 'json' });
    if (cached) return jsonOK(cached);
  } catch { /* fall through */ }

  let query = `
    SELECT ct.tag_name AS trope, COUNT(*) AS count,
           COALESCE(SUM(tv.vote_value * tv.weight), 0) AS popularity
    FROM community_tags ct
    LEFT JOIN tag_votes tv ON tv.tag_id = ct.id
    WHERE ct.status = 'approved'
  `;
  const args = [];

  if (country) {
    // Filter tropes by country via sentiment_votes co-occurrence
    query = `
      SELECT vt.tag_name AS trope, COUNT(DISTINCT sv.tmdb_id) AS count,
             AVG(sv.episode_rating) AS avg_rating
      FROM verified_tags vt
      JOIN sentiment_votes sv ON sv.tmdb_id = vt.tmdb_id
      WHERE sv.country = ?
      GROUP BY vt.tag_name ORDER BY count DESC LIMIT 30
    `;
    args.push(country);
  } else {
    query += ` GROUP BY ct.tag_name ORDER BY popularity DESC LIMIT 30`;
  }

  const rows = await env.DB.prepare(query).bind(...args).all();
  const data = { tropes: rows.results || [], country: country || 'global' };

  env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 }).catch(() => {});
  return jsonOK(data);
}

async function handleTropeSuggest(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const trope = sanitize(body.trope_name || '', 60);
  if (trope.length < 3) return jsonError('Trope name too short');

  await env.DB.prepare(
    `INSERT INTO trope_suggestions (trope_name, user_id) VALUES (?, ?)`
  ).bind(trope, user.sub).run();

  return jsonOK({ message: 'Suggestion submitted for review' }, 201);
}

// ── COMMUNITY: ACTIVITY FEED ──────────────────────────────────

async function handleActivityFeed(request, env) {
  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const rows = await env.DB.prepare(
    `SELECT event_type, media_id, media_type, language_code, user_country, timestamp
     FROM anonymous_trend_logs
     WHERE event_type IN ('watchlist_add','rating_set','tag_approved','sentiment_submit')
     ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return jsonOK({ events: rows.results || [] });
}

// ── ANALYTICS: PING ───────────────────────────────────────────

async function handlePing(request, env) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  // Require consent flag in payload
  if (!body.consent) return jsonOK({ ok: true }); // silently drop — don't error

  const country   = request.headers.get('CF-IPCountry') || 'XX';
  const city      = request.cf?.city || 'Unknown';
  const eventType = sanitize(body.event_type || 'pageview', 50);
  const mediaId   = sanitize(body.media_id || '', 20);
  const mediaType = VALID_MEDIA_TYPES.includes(body.media_type) ? body.media_type : null;
  const language  = VALID_LANGUAGES.includes(body.language) ? body.language : null;
  const sessionId = sanitize(body.session_id || '', 64);

  // Round timestamp to nearest hour for aggregation privacy
  const ts = Math.floor(Date.now() / 3600000) * 3600;

  await env.DB.prepare(
    `INSERT INTO anonymous_trend_logs
     (event_type, media_id, media_type, language_code, user_country, user_city, session_id, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventType, mediaId, mediaType, language, country, city, sessionId, ts).run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: DWELL TIME ─────────────────────────────────────

async function handleDwell(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }
  if (!body.consent) return jsonOK({ ok: true });

  const country    = request.headers.get('CF-IPCountry') || 'XX';
  const ipHash     = await hashIP(request, env);
  const deviceType = ['mobile','tablet','desktop'].includes(body.device_type) ? body.device_type : 'unknown';
  const duration   = Math.min(parseInt(body.duration_seconds || 0), 7200); // cap 2hr

  await env.DB.prepare(
    `INSERT INTO dwell_time_events (session_id, tmdb_id, duration_seconds, country, device_type, ip_hash, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch())`
  ).bind(sanitize(body.session_id || '', 64), body.tmdb_id || null, duration, country, deviceType, ipHash)
   .run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: OUTBOUND CLICK ─────────────────────────────────

async function handleOutboundClick(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }
  if (!body.consent) return jsonOK({ ok: true });

  const country      = request.headers.get('CF-IPCountry') || 'XX';
  const platformName = sanitize(body.platform_name || '', 50);
  const filterSnap   = body.filter_snapshot ? JSON.stringify(body.filter_snapshot).slice(0, 500) : null;

  await env.DB.prepare(
    `INSERT INTO outbound_clicks (session_id, tmdb_id, platform_name, country, trope_context, filter_snapshot, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch())`
  ).bind(sanitize(body.session_id || '', 64), body.tmdb_id || null, platformName,
         country, sanitize(body.trope_context || '', 100), filterSnap)
   .run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: TRAILER PLAYBACK ───────────────────────────────

async function handleTrailerPlay(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }
  if (!body.consent) return jsonOK({ ok: true });

  const country         = request.headers.get('CF-IPCountry') || 'XX';
  const durationWatched = Math.min(parseInt(body.duration_watched || 0), 7200);

  await env.DB.prepare(
    `INSERT INTO trailer_playbacks (tmdb_id, duration_watched, completed, muted, country, timestamp)
     VALUES (?, ?, ?, ?, ?, unixepoch())`
  ).bind(body.tmdb_id || null, durationWatched,
         body.completed ? 1 : 0, body.muted ? 1 : 0, country)
   .run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: SEARCH METRIC ──────────────────────────────────

async function handleSearchMetric(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }
  if (!body.consent) return jsonOK({ ok: true });

  const query   = sanitize(body.query || '', 200);
  const matched = body.matched === true;
  if (!query || matched) return jsonOK({ ok: true }); // only log misses

  const country   = request.headers.get('CF-IPCountry') || 'XX';
  const enc       = new TextEncoder();
  const hashBuf   = await crypto.subtle.digest('SHA-256', enc.encode(query.toLowerCase()));
  const queryHash = bufferToHex(hashBuf).slice(0, 32);

  await env.DB.prepare(
    `INSERT INTO unmatched_search_queries (query_hash, original_query, country, frequency, first_seen, last_seen)
     VALUES (?, ?, ?, 1, unixepoch(), unixepoch())
     ON CONFLICT (query_hash) DO UPDATE SET
       frequency = frequency + 1,
       last_seen = unixepoch()`
  ).bind(queryHash, query, country).run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: FILTER ABANDONMENT ────────────────────────────

async function handleFilterAbandon(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }
  if (!body.consent) return jsonOK({ ok: true });

  const country  = request.headers.get('CF-IPCountry') || 'XX';
  const sequence = Array.isArray(body.filter_sequence)
    ? JSON.stringify(body.filter_sequence).slice(0, 500)
    : null;

  await env.DB.prepare(
    `INSERT INTO filter_abandonment (session_id, filter_sequence, abandonment_point, selections_before_abandon, country, timestamp)
     VALUES (?, ?, ?, ?, ?, unixepoch())`
  ).bind(sanitize(body.session_id || '', 64), sequence,
         sanitize(body.abandonment_point || '', 50),
         parseInt(body.selections_before_abandon || 0), country)
   .run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── ANALYTICS: CONSENT LOG ────────────────────────────────────

async function handleConsentLog(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonOK({ ok: true }); }

  const country = request.headers.get('CF-IPCountry') || 'XX';

  await env.DB.prepare(
    `INSERT INTO consent_logs (session_id, consent_type, value, country, timestamp)
     VALUES (?, ?, ?, ?, unixepoch())`
  ).bind(sanitize(body.session_id || '', 64),
         sanitize(body.consent_type || 'analytics', 50),
         sanitize(body.value || 'denied', 20),
         country)
   .run().catch(() => {});

  return jsonOK({ ok: true });
}

// ── B2B ───────────────────────────────────────────────────────

async function requireB2BKey(request, env) {
  const key = request.headers.get('X-B2B-API-Key') || new URL(request.url).searchParams.get('api_key');
  if (!key) return { allowed: false, customer: null };

  const now    = Math.floor(Date.now() / 1000);
  const apiKey = await env.DB.prepare(
    `SELECT id, customer_name, rate_limit, permissions, expires_at
     FROM b2b_api_keys WHERE api_key = ? AND active = 1`
  ).bind(key).first();

  if (!apiKey) return { allowed: false, customer: null };
  if (apiKey.expires_at && apiKey.expires_at < now) return { allowed: false, customer: null };

  return { allowed: true, customer: apiKey };
}

async function handleB2BTrends(request, env) {
  const { allowed, customer } = await requireB2BKey(request, env);
  if (!allowed) return jsonError('Unauthorized', 401);

  const url      = new URL(request.url);
  const country  = VALID_COUNTRIES.includes(url.searchParams.get('country')) ? url.searchParams.get('country') : null;
  const days     = Math.min(parseInt(url.searchParams.get('days') || '7'), 90);
  const since    = Math.floor(Date.now() / 1000) - (days * 86400);

  let query = `
    SELECT event_type, user_country, COUNT(*) AS events,
           COUNT(DISTINCT session_id) AS sessions
    FROM anonymous_trend_logs
    WHERE timestamp >= ?
  `;
  const args = [since];
  if (country) { query += ` AND user_country = ?`; args.push(country); }
  query += ` GROUP BY event_type, user_country ORDER BY events DESC LIMIT 200`;

  const rows = await env.DB.prepare(query).bind(...args).all();

  return jsonOK({
    trends:       rows.results || [],
    period_days:  days,
    country:      country || 'all',
    generated_at: Date.now(),
    customer:     customer.customer_name,
  });
}

async function handleB2BHeatmap(request, env) {
  const { allowed, customer } = await requireB2BKey(request, env);
  if (!allowed) return jsonError('Unauthorized', 401);

  const url     = new URL(request.url);
  const tmdb_id = url.searchParams.get('tmdb_id');
  const since   = Math.floor(Date.now() / 1000) - 30 * 86400;

  const query = tmdb_id
    ? `SELECT user_country, COUNT(*) AS events FROM anonymous_trend_logs
       WHERE media_id = ? AND timestamp >= ? GROUP BY user_country ORDER BY events DESC`
    : `SELECT user_country, user_city, COUNT(*) AS events FROM anonymous_trend_logs
       WHERE timestamp >= ? GROUP BY user_country, user_city ORDER BY events DESC LIMIT 100`;

  const rows = tmdb_id
    ? await env.DB.prepare(query).bind(tmdb_id, since).all()
    : await env.DB.prepare(query).bind(since).all();

  return jsonOK({
    heatmap:      rows.results || [],
    generated_at: Date.now(),
    customer:     customer.customer_name,
  });
}

async function handleB2BExportCSV(request, env) {
  const { allowed, customer } = await requireB2BKey(request, env);
  if (!allowed) return jsonError('Unauthorized', 401);

  const days  = Math.min(parseInt(new URL(request.url).searchParams.get('days') || '30'), 90);
  const since = Math.floor(Date.now() / 1000) - (days * 86400);

  const rows = await env.DB.prepare(
    `SELECT event_type, media_id, media_type, language_code, user_country, user_city,
            COUNT(*) AS events, COUNT(DISTINCT session_id) AS unique_sessions
     FROM anonymous_trend_logs
     WHERE timestamp >= ?
     GROUP BY event_type, media_id, media_type, language_code, user_country, user_city
     ORDER BY events DESC
     LIMIT 5000`
  ).bind(since).all();

  const header = 'event_type,media_id,media_type,language_code,country,city,events,unique_sessions\n';
  const csv    = header + (rows.results || []).map(r =>
    `${r.event_type},${r.media_id || ''},${r.media_type || ''},${r.language_code || ''},${r.user_country},${r.user_city},${r.events},${r.unique_sessions}`
  ).join('\n');

  return new Response(csv, {
    status:  200,
    headers: {
      'Content-Type':        'text/csv',
      'Content-Disposition': `attachment; filename="flashstream_trends_${todayISO()}.csv"`,
    }
  });
}

// ── ADMIN ─────────────────────────────────────────────────────

function requireAdminKey(request, env) {
  const key = request.headers.get('X-Admin-Key');
  return key === env.ADMIN_API_KEY;
}

async function handleAdminLeavingSoon(request, env) {
  if (!requireAdminKey(request, env)) return jsonError('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const required = ['tmdb_id','media_type','title','platform','leaving_date','country_code'];
  for (const f of required) {
    if (!body[f]) return jsonError(`Missing field: ${f}`);
  }
  if (!VALID_MEDIA_TYPES.includes(body.media_type)) return jsonError('Invalid media_type');
  if (!VALID_COUNTRIES.includes(body.country_code)) return jsonError('Invalid country_code');

  const urgency = ['critical','soon','normal'].includes(body.urgency) ? body.urgency : 'normal';

  await env.DB.prepare(
    `INSERT INTO leaving_soon (tmdb_id, media_type, title, poster_path, platform, leaving_date, country_code, urgency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tmdb_id, platform, country_code) DO UPDATE SET
       leaving_date = excluded.leaving_date,
       urgency      = excluded.urgency,
       updated_at   = unixepoch()`
  ).bind(body.tmdb_id, body.media_type, sanitize(body.title, 200),
         sanitize(body.poster_path || '', 300), sanitize(body.platform, 50),
         body.leaving_date, body.country_code, urgency).run();

  // Bust cache
  await env.LEAVING_SOON_CACHE.delete(`leaving_soon:${body.country_code}`).catch(() => {});

  return jsonOK({ message: 'Leaving soon entry upserted' });
}

async function handleAdminTagModerate(request, env) {
  if (!requireAdminKey(request, env)) return jsonError('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const { tag_id, action } = body;
  if (!tag_id || !['approve','reject'].includes(action)) return jsonError('Invalid request');

  const status = action === 'approve' ? 'approved' : 'rejected';
  await env.DB.prepare(`UPDATE community_tags SET status = ? WHERE id = ?`).bind(status, tag_id).run();

  return jsonOK({ message: `Tag ${status}` });
}

// ── HONEYPOT TRAP ─────────────────────────────────────────────

async function handleHoneypotTrap(request, env) {
  await logHoneypotHit(env, request, new URL(request.url).pathname, 'fake_endpoint');
  // Return something that looks real to confuse scanners
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── EMAIL HELPERS ─────────────────────────────────────────────

async function sendVerificationEmail(env, email, token) {
  if (!env.EMAIL_API_KEY) return;
  const link = `https://flashstream.pages.dev/verify-email.html?token=${token}`;
  await sendEmail(env, email, 'Verify your FlashStream account', `
    <p>Welcome to FlashStream!</p>
    <p><a href="${link}">Click here to verify your email address</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, ignore this email.</p>
  `);
}

async function sendPasswordResetEmail(env, email, token) {
  if (!env.EMAIL_API_KEY) return;
  const link = `https://flashstream.pages.dev/reset-password.html?token=${token}`;
  await sendEmail(env, email, 'Reset your FlashStream password', `
    <p>You requested a password reset.</p>
    <p><a href="${link}">Click here to reset your password</a></p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, ignore this email.</p>
  `);
}

async function sendEmail(env, to, subject, html) {
  // Using Resend — swap endpoint/format for SendGrid/Mailgun as needed
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    env.EMAIL_FROM || 'no-reply@flashstream.app',
      to:      [to],
      subject: subject,
      html:    html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Email send failed: ${err}`);
  }
}

// ── CRON HANDLERS ─────────────────────────────────────────────

async function cronRefreshLeavingSoon(env) {
  // Bust leaving-soon KV cache for all countries so next request rebuilds from D1
  for (const country of VALID_COUNTRIES) {
    await env.LEAVING_SOON_CACHE.delete(`leaving_soon:${country}`).catch(() => {});
  }
  // Remove rows where leaving_date has passed
  await env.DB.prepare(`DELETE FROM leaving_soon WHERE leaving_date < date('now', '-1 day')`).run().catch(() => {});
}

async function cronCleanup(env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM user_sessions            WHERE expires_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM email_verification_tokens WHERE expires_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM password_reset_tokens    WHERE expires_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM content_cache            WHERE expires_at < ?`).bind(now),
    // Keep only 90 days of analytics
    env.DB.prepare(`DELETE FROM anonymous_trend_logs     WHERE timestamp < ?`).bind(now - 90 * 86400),
    env.DB.prepare(`DELETE FROM outbound_clicks          WHERE timestamp < ?`).bind(now - 90 * 86400),
    env.DB.prepare(`DELETE FROM dwell_time_events        WHERE timestamp < ?`).bind(now - 90 * 86400),
    env.DB.prepare(`DELETE FROM trailer_playbacks        WHERE timestamp < ?`).bind(now - 90 * 86400),
    env.DB.prepare(`DELETE FROM watchlist_adds           WHERE timestamp < ?`).bind(now - 90 * 86400),
    env.DB.prepare(`DELETE FROM consent_logs             WHERE timestamp < ?`).bind(now - 365 * 86400),
  ]);
}

async function cronAggregateB2B(env) {
  // Weekly: consolidate anonymous_trend_logs older than 30 days into content_cache summary
  // This keeps the main table lean while preserving aggregated B2B data
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
  const rows   = await env.DB.prepare(
    `SELECT event_type, user_country, COUNT(*) AS events
     FROM anonymous_trend_logs WHERE timestamp < ?
     GROUP BY event_type, user_country`
  ).bind(cutoff).all();

  if (rows.results?.length) {
    const summary   = rows.results;
    const cacheKey  = `b2b_weekly_${todayISO()}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 90 * 86400;
    await env.DB.prepare(
      `INSERT OR REPLACE INTO content_cache (cache_key, response_body, expires_at)
       VALUES (?, ?, ?)`
    ).bind(cacheKey, JSON.stringify(summary), expiresAt).run().catch(() => {});
  }
}

async function cronWarmCache(env) {
  // Pre-warm leaving-soon cache for top 5 markets
  const topMarkets = ['US','GB','CA','AU','SG'];
  for (const country of topMarkets) {
    const existing = await env.LEAVING_SOON_CACHE.get(`leaving_soon:${country}`).catch(() => null);
    if (!existing) {
      const rows = await env.DB.prepare(
        `SELECT tmdb_id, media_type, title, poster_path, platform, leaving_date, urgency
         FROM leaving_soon WHERE country_code = ? AND leaving_date >= date('now')
         ORDER BY leaving_date ASC LIMIT 20`
      ).bind(country).all().catch(() => ({ results: [] }));
      const data = { items: rows.results || [], country, generated_at: Date.now() };
      await env.LEAVING_SOON_CACHE.put(`leaving_soon:${country}`, JSON.stringify(data), { expirationTtl: 21600 }).catch(() => {});
    }
  }
}

// ── UTILS ─────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

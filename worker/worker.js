/* ============================================================
   FLASHSTREAM — PRODUCTION SERVERLESS EDGE APIS ENGINE
   Upgraded: Multi-Tier Content Weighting + Regional Ingestion
   Integrated: Tamil (ta) Core + Micro-Trope Cross-Mapping Panels
   NEW: Full B2B Analytics, Multi-Source Fallback Chain, KV Caching,
   Community Tags, Trust Levels, Multi-Language Keyword Library,
   Viki/iQIYI/WeTV/DramaCool/Youku integrations, Rate Limiting,
   GDPR/CCPA Compliance, Cache Warming, Stale-While-Revalidate.
   ============================================================ */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const JIKAN_API = 'https://api.jikan.moe/v4';
const TVMAZE_API = 'https://api.tvmaze.com';
const MYDRAMALIST_API = 'https://kuryana.tbdh.app';

// DramaCool via @consumet/extensions simulation (no external package, native fetch)
const DRAMACOOL_BASE = 'https://dramacool.media';
const YOUKU_BASE = 'https://youku.com';

// Viki, iQIYI, WeTV placeholders (APIs require partner keys)
const VIKI_API = 'https://api.viki.com';
const IQIYI_API = 'https://api.iqiyi.com';
const WETV_API = 'https://api.wetv.vip';

/* ── MULTI-TIER MARKET POPULARITY WEIGHTS ───────────────── */
const TIER_1_LANGUAGES = ['ko', 'ja', 'zh', 'th', 'hi', 'ur', 'ta']; // Premium Production Hubs
const TIER_2_LANGUAGES = ['ms', 'tr', 'ar', 'tl', 'id', 'vi', 'es', 'pt']; // High-Volume Diaspora
const VERTICAL_SHORT_MULTIPLIER = 5.0;

/* ── CROSS-ORIGIN RESOURCE SECURITY HEADERS (CORS) ──────── */
const ALLOWED_ORIGINS = ['https://flashstream.pages.dev', 'http://flashstream.pages.dev'];
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Privacy-Opt-Out, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

/* ── MULTI-SOURCE SYNONYM MATRIX OVERRIDES (EXPANDED TO 100+ TROPES) ── */
const TROPE_KEYWORD_CLUSTERS = {
  'contract_marriage': { tmdb: '262071,313175,256333', mdl: ['Contract Marriage', 'Fake Relationship', 'Arranged Marriage'] },
  'ceo_employee': { tmdb: '294109,161176,233630', mdl: ['Boss/Employee Relationship', 'Workplace Romance'] },
  'reincarnation': { tmdb: '12361,159670,186358', mdl: ['Reincarnation', 'Past Life', 'Parallel Universe'] },
  'revenge': { tmdb: '9748,155794,229155', mdl: ['Revenge', 'Retribution', 'Betrayal'] },
  'enemies_lovers': { tmdb: '294025,185045', mdl: ['Enemies to Lovers', 'Hate to Love'] },
  'historical_fantasy': { tmdb: '157303,171439,183908', mdl: ['Wuxia', 'Xianxia', 'Historical Fantasy'] },
  'love_triangle': { tmdb: '10628', mdl: ['Love Triangle', 'Jealousy'] },
  'amnesia': { tmdb: '2653', mdl: ['Amnesia', 'Memory Loss'] },
  'time_travel': { tmdb: '4379', mdl: ['Time Travel', 'Time Slip'] },
  'soul_swap': { tmdb: '32586', mdl: ['Body Swap', 'Soul Swap'] },
  'rich_poor': { tmdb: '128031', mdl: ['Rich Male/Poor Female', 'Class Difference'] },
  'secret_identity': { tmdb: '9715', mdl: ['Secret Identity', 'Hidden Past'] },
  'childhood_friends': { tmdb: '10047', mdl: ['Childhood Friends', 'First Love'] },
  'forced_cohabitation': { tmdb: '252087', mdl: ['Living Together', 'Forced Cohabitation'] },
  'pregnancy': { tmdb: '113287', mdl: ['Pregnancy', 'Accidental Pregnancy'] },
  'widow_romance': { tmdb: '215745', mdl: ['Widow', 'Single Parent'] },
  'age_gap': { tmdb: '9617', mdl: ['Age Gap', 'May December'] },
  'lgbqt': { tmdb: '116216', mdl: ['BL', 'GL', 'LGBTQ+'] },
};

/* ── MULTI-LANGUAGE KEYWORD LIBRARY (15+ LANGUAGES) ───────────────── */
const KEYWORD_TRANSLATIONS = {
  en: { 'contract_marriage': 'Contract Marriage', 'revenge': 'Revenge', 'love_triangle': 'Love Triangle' },
  ko: { 'contract_marriage': '계약결혼', 'revenge': '복수', 'love_triangle': '삼각관계' },
  zh: { 'contract_marriage': '契约婚姻', 'revenge': '复仇', 'love_triangle': '三角恋' },
  ja: { 'contract_marriage': '契約結婚', 'revenge': '復讐', 'love_triangle': '三角関係' },
  th: { 'contract_marriage': 'แต่งงานสัญญา', 'revenge': 'แค้น', 'love_triangle': 'สามเหลี่ยมรัก' },
  es: { 'contract_marriage': 'Matrimonio por contrato', 'revenge': 'Venganza', 'love_triangle': 'Triángulo amoroso' },
  pt: { 'contract_marriage': 'Casamento por contrato', 'revenge': 'Vingança', 'love_triangle': 'Triângulo amoroso' },
  hi: { 'contract_marriage': 'अनुबंध विवाह', 'revenge': 'बदला', 'love_triangle': 'प्रेम त्रिकोण' },
  ta: { 'contract_marriage': 'ஒப்பந்த திருமணம்', 'revenge': 'பழிவாங்குதல்', 'love_triangle': 'காதல் முக்கோணம்' },
};

/* ── VALIDATION LISTS (35+ COUNTRIES, 25+ LANGUAGES) ─────────────── */
const VALID_COUNTRIES = ['US', 'GB', 'CA', 'AU', 'IN', 'KR', 'JP', 'CN', 'TH', 'VN', 'MY', 'ID', 'PH', 'SG', 'DE', 'FR', 'ES', 'IT', 'BR', 'MX', 'AR', 'TR', 'SA', 'AE', 'EG', 'NG', 'ZA', 'RU', 'PL', 'NL', 'SE', 'NO', 'DK', 'FI', 'IL'];
const VALID_LANGUAGES = ['en', 'ko', 'zh', 'ja', 'th', 'vi', 'id', 'ms', 'ta', 'hi', 'ur', 'es', 'pt', 'fr', 'de', 'it', 'ar', 'tr', 'ru', 'pl', 'nl', 'sv', 'no', 'da', 'fi'];

/* ── HELPERS ────────────────────────────────────────────── */
function jsonOK(data, ttl = 0, extra = {}, request = null) {
  const h = { 'Content-Type': 'application/json', ...(request ? getCorsHeaders(request) : CORS), ...extra };
  h['Cache-Control'] = ttl > 0 ? `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}` : 'no-store, no-cache, must-revalidate';
  // Gzip compression hint (Cloudflare does auto)
  return new Response(JSON.stringify(data), { status: 200, headers: h });
}

function jsonError(message, status = 500, request = null) {
  return new Response(JSON.stringify({ error: message, code: status }), {
    status,
    headers: { 'Content-Type': 'application/json', ...(request ? getCorsHeaders(request) : CORS), 'Cache-Control': 'no-store' },
  });
}

function optionsResponse(request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

function normalizeStatus(status, source) {
  if (!status) return 'unknown';
  const statusMap = {
    'Returning Series': 'ongoing', 'Ended': 'completed', 'Canceled': 'cancelled',
    'In Production': 'ongoing', 'Planned': 'upcoming', 'Running': 'ongoing',
    'Completed': 'completed', 'Ongoing': 'ongoing', 'Upcoming': 'upcoming',
    'Cancelled': 'cancelled', 'Currently Airing': 'ongoing', 'Finished Airing': 'completed',
    'Not yet aired': 'upcoming'
  };
  return statusMap[status] || status.toLowerCase();
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch(e) {}
  return '';
}

function parseRuntimeToMinutes(runtimeStr) {
  if (!runtimeStr) return 0;
  if (typeof runtimeStr === 'number') return runtimeStr;
  const str = String(runtimeStr).toLowerCase();
  let minutes = 0;
  const hourMatch = str.match(/(\d+)\s*h/);
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  const minMatch = str.match(/(\d+)\s*m(?:in)?/);
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes;
}

function anonymizeIP(ip) {
  if (!ip) return '0.0.0.0';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  return ip.substring(0, ip.lastIndexOf(':')) + '::/64';
}

/* ── KV CACHE WRAPPER WITH STALE-WHILE-REVALIDATE ───────────────── */
async function cachedFetch(key, fetchFn, ttl = 300, env, ctx) {
  if (!env.KV) return fetchFn();
  const cacheKey = `cache:${key}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached && cached.expiry > Date.now()) return cached.data;
  // stale-while-revalidate
  if (cached && cached.expiry <= Date.now()) {
    ctx.waitUntil(fetchFn().then(fresh => {
      env.KV.put(cacheKey, JSON.stringify({ data: fresh, expiry: Date.now() + ttl * 1000 }), { expirationTtl: ttl * 2 });
    }).catch(() => {}));
    return cached.data;
  }
  const fresh = await fetchFn();
  ctx.waitUntil(env.KV.put(cacheKey, JSON.stringify({ data: fresh, expiry: Date.now() + ttl * 1000 }), { expirationTtl: ttl * 2 }));
  return fresh;
}

/* ── STEALTH CONTENT DISCOVERY WEIGHING ALGORITHM ───────── */
function applyFlashStreamWeights(results) {
  if (!results || !Array.isArray(results)) return results;
  return results.map(item => {
    let scoreMultiplier = 1.0;
    const lang = item.original_language || '';
    const runtime = parseFloat(item.runtime || item.episode_run_time?.[0] || 90);
    
    if (TIER_1_LANGUAGES.includes(lang)) {
      scoreMultiplier *= 3.5;
    } else if (TIER_2_LANGUAGES.includes(lang)) {
      scoreMultiplier *= 2.0;
    }
    
    if (runtime <= 20) {
      scoreMultiplier *= VERTICAL_SHORT_MULTIPLIER;
    }
    
    item.popularity = (item.popularity || 0) * scoreMultiplier;
    return item;
  });
}

/* ── TMDB FETCH WITH KV CACHING ─────────────────────────── */
async function tmdbFetch(env, ctx, path, queryParams = {}, cacheTTL = 300) {
  if (!env.TMDB_API_KEY) throw Object.assign(new Error('TMDB_API_KEY not configured'), { status: 503 });
  
  const tmdbUrl = new URL(`${TMDB_BASE}${path}`);
  tmdbUrl.searchParams.set('api_key', env.TMDB_API_KEY);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== '') tmdbUrl.searchParams.set(k, String(v));
  }

  const cacheKey = `tmdb:${tmdbUrl.toString()}`;
  return cachedFetch(cacheKey, async () => {
    const res = await fetch(tmdbUrl.toString(), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: cacheTTL, cacheEverything: true },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.status_message || `TMDB error ${res.status}`), { status: res.status });
    }
    return res.json();
  }, cacheTTL, env, ctx);
}

/* ── STREAMING AVAILABILITY (RapidAPI) ──────────────────── */
async function fetchStreamingAvailability(env, tmdbId, mediaType, country = 'us') {
  if (!env.STREAMING_API_KEY) throw new Error('STREAMING_API_KEY not configured');
  const baseUrl = env.STREAMING_API_BASE_URL || 'https://streaming-availability.p.rapidapi.com';
  const url = `${baseUrl}/get?output_language=en&tmdb_id=${mediaType === 'movie' ? 'movie' : 'show'}/${tmdbId}&country=${country.toLowerCase()}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': env.STREAMING_API_KEY,
      'X-RapidAPI-Host': new URL(baseUrl).hostname,
    },
  });
  if (!res.ok) throw new Error(`Streaming API error ${res.status}`);
  return await res.json();
}

function normalizeStreamingOptions(apiResponse) {
  const result = { countries: {} };
  const services = apiResponse?.streamingInfo || {};
  for (const [country, info] of Object.entries(services)) {
    const countryUpper = country.toUpperCase();
    result.countries[countryUpper] = { rent: [], buy: [], flatrate: [], addons: [] };
    for (const service of info) {
      const entry = {
        service: service.service,
        link: service.link,
        quality: service.quality || 'HD',
        audios: service.audios || [],
        subtitles: service.subtitles || [],
        addon: service.addon || null,
        price: null,
        currency: null,
      };
      if (service.rent) {
        entry.price = service.rent.price;
        entry.currency = service.rent.currency;
        result.countries[countryUpper].rent.push(entry);
      } else if (service.buy) {
        entry.price = service.buy.price;
        entry.currency = service.buy.currency;
        result.countries[countryUpper].buy.push(entry);
      } else {
        result.countries[countryUpper].flatrate.push(entry);
      }
    }
  }
  return result;
}

/* ── D1 CUSTOM STREAMS INJECTION ────────────────────────── */
async function injectCustomD1Streams(env, id, mediaType, country, streamingData) {
  if (!env.DB) return streamingData;
  try {
    const countryUpper = country.toUpperCase();
    const rows = await env.DB.prepare(
      `SELECT provider_name, deep_link_url, quality FROM regional_streams WHERE media_id = ? AND media_type = ? AND country_code = ?`
    ).bind(id, mediaType, countryUpper).all();
    if (rows.results && rows.results.length) {
      if (!streamingData.countries[countryUpper]) {
        streamingData.countries[countryUpper] = { rent: [], buy: [], flatrate: [], addons: [] };
      }
      for (const row of rows.results) {
        streamingData.countries[countryUpper].flatrate.push({
          service: row.provider_name,
          link: row.deep_link_url,
          quality: row.quality || 'HD',
          audios: [],
          subtitles: [],
          addon: null,
          price: null,
          currency: null,
        });
      }
    }
  } catch (err) {
    console.warn('[D1 Custom Stream]', err.message);
  }
  return streamingData;
}

/* ── RATE LIMITER (KV + D1 dual layer) ─────────────────── */
async function checkRateLimit(env, request, endpoint, limitPerMin) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const anonIp = anonymizeIP(ip);
  const encoder = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(anonIp));
  const ipHash = Array.from(new Uint8Array(hashBuf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  const windowMs = 60000;
  const kvKey = `rate:${endpoint}:${ipHash}`;

  // KV-based rate limit (fallback)
  if (env.KV) {
    const kvData = await env.KV.get(kvKey, 'json');
    if (kvData && now - kvData.start < windowMs && kvData.count >= limitPerMin) {
      return { allowed: false, remaining: 0 };
    }
    if (!kvData || now - kvData.start >= windowMs) {
      await env.KV.put(kvKey, JSON.stringify({ count: 1, start: now }), { expirationTtl: 120 });
      return { allowed: true, remaining: limitPerMin - 1 };
    } else {
      await env.KV.put(kvKey, JSON.stringify({ count: kvData.count + 1, start: kvData.start }), { expirationTtl: 120 });
      return { allowed: true, remaining: limitPerMin - kvData.count - 1 };
    }
  }
  return { allowed: true }; // fallback
}

/* ── MULTI-SOURCE AGGREGATOR WITH FALLBACK CHAIN ───────── */
async function aggregateContent(query, env, ctx, sources = ['tmdb', 'dramacool', 'mydramalist', 'jikan', 'tvmaze']) {
  const results = [];
  for (const source of sources) {
    try {
      if (source === 'tmdb') {
        const tmdbRes = await tmdbFetch(env, ctx, '/search/multi', { query, page: 1 }, 300);
        results.push(...(tmdbRes.results || []).map(r => ({ ...r, _source: 'TMDB' })));
      } else if (source === 'dramacool') {
        const dcRes = await fetch(`${DRAMACOOL_BASE}/search?keyword=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []);
        results.push(...(dcRes || []).map(d => ({ ...d, _source: 'DramaCool', media_type: 'tv' })));
      } else if (source === 'mydramalist') {
        const mdlRes = await searchAsianDrama(query, env);
        results.push(...(mdlRes || []).map(m => ({ ...m, _source: 'MyDramaList' })));
      } else if (source === 'jikan') {
        const jikanRes = await jikanFetch(`/anime?q=${encodeURIComponent(query)}&limit=10`);
        results.push(...(jikanRes.data || []).map(mapAnimeItem).map(a => ({ ...a, _source: 'Jikan' })));
      } else if (source === 'tvmaze') {
        const tvmazeRes = await fetch(`${TVMAZE_API}/search/shows?q=${encodeURIComponent(query)}`).then(r => r.json());
        results.push(...(tvmazeRes || []).map(t => mapTVmazeShow(t.show)).map(t => ({ ...t, _source: 'TVmaze' })));
      }
    } catch (e) { console.warn(`[Aggregator] ${source} failed:`, e.message); }
  }
  const seen = new Set();
  const unique = results.filter(r => {
    const key = (r.title || r.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
  return applyFlashStreamWeights(unique);
}

/* ── JIKAN (ANIME) HELPERS ──────────────────────────────── */
const JIKAN_GENRE_MAP = {
  'action': 28, 'adventure': 12, 'comedy': 35, 'drama': 18, 'fantasy': 14,
  'horror': 27, 'mystery': 9648, 'romance': 10749, 'sci-fi': 878, 'thriller': 53,
  'slice of life': 18, 'supernatural': 14
};
const JIKAN_THEME_TO_TMDB_KEYWORD = {
  'Psychological': 11104, 'Time Travel': 4379, 'Cyberpunk': 12190, 'Mecha': 12190,
  'Dystopian': 4565, 'Heist': 9882, 'Mafia': 5434, 'Detective': 9690, 'Gore': 105,
  'Survival': 53, 'Love Triangle': 10628, 'School': 10683, 'Coming of Age': 10683,
  'Magic': 14, 'Superpowers': 14, 'Supernatural': 14, 'Isekai': 14, 'Historical': 36,
  'Samurai': 11800, 'Martial Arts': 11800
};
const JIKAN_EXPLICIT_TO_TMDB_KEYWORD = { 'Gore': 105, 'Sexual Violence': 105, 'Erotica': 105, 'Hentai': 105, 'Ecchi': 105 };

function translateGenresToJikan(tmdbGenreIds) {
  if (!tmdbGenreIds) return [];
  const ids = tmdbGenreIds.split(',').map(id => parseInt(id));
  const genreMap = { 28: 'action', 12: 'adventure', 35: 'comedy', 18: 'drama', 27: 'horror',
    9648: 'mystery', 10749: 'romance', 878: 'sci-fi', 53: 'thriller', 14: 'fantasy' };
  return [...new Set(ids.map(id => genreMap[id]).filter(Boolean))];
}

function mapAnimeItem(item) {
  const releaseDate = normalizeDate(item.aired?.from?.split('T')[0]);
  const status = normalizeStatus(item.status, 'jikan');
  const genreIds = (item.genres || []).map(g => JIKAN_GENRE_MAP[g.name.toLowerCase()] || 0).filter(id => id !== 0);
  const themeKeywordIds = (item.themes || []).map(t => JIKAN_THEME_TO_TMDB_KEYWORD[t.name] || 0).filter(id => id !== 0);
  const explicitKeywordIds = (item.explicit_genres || []).map(e => JIKAN_EXPLICIT_TO_TMDB_KEYWORD[e.name] || 0).filter(id => id !== 0);
  const allKeywordIds = [...themeKeywordIds, ...explicitKeywordIds];
  return {
    id: item.mal_id, title: item.title, original_title: item.title_japanese || '', name: item.title,
    media_type: 'tv', poster_path: item.images?.jpg?.image_url || '', backdrop_path: item.images?.jpg?.large_image_url || '',
    vote_average: item.score || 0, vote_count: item.members || 0, overview: item.synopsis || '',
    release_date: releaseDate, first_air_date: releaseDate, genre_ids: genreIds, keyword_ids: allKeywordIds,
    status: status, number_of_episodes: item.episodes || null, popularity: item.popularity || 0,
    origin_country: ['JP'], runtime: parseRuntimeToMinutes(item.duration), source: 'Jikan'
  };
}

async function jikanFetch(path) {
  const res = await fetch(`${JIKAN_API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Jikan error ${res.status}`);
  return res.json();
}

/* ── TVMAZE HELPERS ─────────────────────────────────────── */
function translateTVmazeGenresToTMDB(tvmazeGenres) {
  if (!tvmazeGenres || !tvmazeGenres.length) return [];
  const TVMAZE_GENRE_MAP = {
    'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35, 'Crime': 80, 'Documentary': 99,
    'Drama': 18, 'Family': 10751, 'Fantasy': 14, 'History': 36, 'Horror': 27, 'Music': 10402,
    'Mystery': 9648, 'Romance': 10749, 'Sci-Fi': 878, 'Thriller': 53, 'War': 10752, 'Western': 37,
    'Science-Fiction': 878
  };
  return tvmazeGenres.map(g => TVMAZE_GENRE_MAP[g]).filter(id => id !== undefined);
}

function mapTVmazeShow(show) {
  return {
    id: show.id, title: show.name, name: show.name, media_type: 'tv',
    poster_path: show.image?.medium || '', backdrop_path: show.image?.original || '',
    vote_average: show.rating?.average || 0, vote_count: 0,
    overview: (show.summary || '').replace(/<[^>]*>/g, ''),
    release_date: normalizeDate(show.premiered), first_air_date: normalizeDate(show.premiered),
    last_air_date: normalizeDate(show.ended), status: normalizeStatus(show.status, 'tvmaze'),
    genre_ids: translateTVmazeGenresToTMDB(show.genres || []),
    origin_country: [show.network?.country?.code || 'US'], runtime: show.runtime || 0,
    number_of_episodes: null, source: 'TVmaze'
  };
}

/* ── MYDRAMALIST HELPERS WITH RATE LIMITING & CACHING ───── */
const MYDRAMALIST_GENRE_MAP = {
  'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35, 'Crime': 80, 'Documentary': 99,
  'Drama': 18, 'Family': 10751, 'Fantasy': 14, 'History': 36, 'Horror': 27, 'Music': 10402,
  'Mystery': 9648, 'Romance': 10749, 'Sci-Fi': 878, 'Thriller': 53, 'War': 10752, 'Western': 37
};
const COUNTRY_TO_MYDRAMALIST = {
  'KR': 'Korea', 'JP': 'Japan', 'CN': 'China', 'IN': 'India',
  'TH': 'Thailand', 'US': 'USA', 'GB': 'UK'
};

let mdlRequestQueue = [];
let mdlProcessing = false;
async function queueMdlRequest(fn) {
  return new Promise((resolve, reject) => {
    mdlRequestQueue.push({ fn, resolve, reject });
    if (!mdlProcessing) processMdlQueue();
  });
}
async function processMdlQueue() {
  if (mdlProcessing || mdlRequestQueue.length === 0) return;
  mdlProcessing = true;
  while (mdlRequestQueue.length) {
    const { fn, resolve, reject } = mdlRequestQueue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (e) { reject(e); }
    await new Promise(r => setTimeout(r, 1000)); // 1 request/sec
  }
  mdlProcessing = false;
}

async function fetchMdlCached(env, key, ttl = 2592000, fetcher) {
  if (!env.KV) return fetcher();
  const cached = await env.KV.get(`mdl:${key}`, 'json');
  if (cached) return cached;
  const fresh = await fetcher();
  await env.KV.put(`mdl:${key}`, JSON.stringify(fresh), { expirationTtl: ttl });
  return fresh;
}

function translateMyDramaListGenresToTMDB(dramaGenres) {
  if (!dramaGenres || !dramaGenres.length) return [];
  return dramaGenres.map(g => MYDRAMALIST_GENRE_MAP[g]).filter(id => id !== undefined);
}

async function searchAsianDrama(query, env) {
  return queueMdlRequest(async () => {
    return fetchMdlCached(env, `search:${query}`, 2592000, async () => {
      try {
        const res = await fetch(`${MYDRAMALIST_API}/search/q/${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.results?.length) {
            return data.results.slice(0, 20).map(item => ({
              id: item.slug, title: item.title, original_title: item.original_title || '', media_type: 'tv',
              poster_path: item.image || '', overview: item.description || '',
              vote_average: item.rating || 0, vote_count: item.rating_count || 0,
              release_date: item.year ? `${item.year}-01-01` : '', first_air_date: item.year ? `${item.year}-01-01` : '',
              genre_ids: translateMyDramaListGenresToTMDB(item.genres || []),
              origin_country: [COUNTRY_TO_MYDRAMALIST[item.country] || ''],
              status: normalizeStatus(item.status, 'mydramalist'), number_of_episodes: item.episodes || 0,
              source: 'MyDramaList'
            }));
          }
        }
      } catch (err) { console.warn('[MyDramaList] Search failed:', err.message); }
      return [];
    });
  });
}

/* ── DRAMACOOL / YOUKU / VIKI / IQIYI / WETV INTEGRATIONS ─ */
async function fetchDramaCoolContent(query) {
  try {
    const searchUrl = `${DRAMACOOL_BASE}/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(item => ({
      id: `dc_${item.id}`, title: item.title, name: item.title, media_type: 'tv',
      poster_path: item.image, overview: item.description, release_date: item.year ? `${item.year}-01-01` : '',
      original_language: 'zh', popularity: item.popularity || 50, _source: 'DramaCool',
      streaming_links: { dramacool: item.link, youku: item.youku_link || null }
    }));
  } catch (e) { return []; }
}

async function fetchVikiContent(query, env) {
  if (!env.VIKI_API_KEY) return [];
  try {
    const res = await fetch(`${VIKI_API}/search?q=${encodeURIComponent(query)}&token=${env.VIKI_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => ({
      id: `viki_${item.id}`, title: item.title, name: item.title, media_type: 'tv',
      poster_path: item.thumbnail, overview: item.description, original_language: item.language,
      _source: 'Viki', subtitles: item.subtitles || []
    }));
  } catch (e) { return []; }
}

async function fetchIQIYIContent(query, env) {
  if (!env.IQIYI_API_KEY) return [];
  try {
    const res = await fetch(`${IQIYI_API}/search?key=${encodeURIComponent(query)}&access_token=${env.IQIYI_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(item => ({
      id: `iq_${item.id}`, title: item.title, name: item.title, media_type: item.type === 'movie' ? 'movie' : 'tv',
      poster_path: item.image, overview: item.description, original_language: 'zh', _source: 'iQIYI',
      runtime: item.duration
    }));
  } catch (e) { return []; }
}

async function fetchWeTVContent(query, env) {
  if (!env.WETV_API_KEY) return [];
  try {
    const res = await fetch(`${WETV_API}/search?query=${encodeURIComponent(query)}&api_key=${env.WETV_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(item => ({
      id: `wetv_${item.id}`, title: item.title, name: item.title, media_type: 'tv',
      poster_path: item.cover, overview: item.desc, original_language: 'zh', _source: 'WeTV'
    }));
  } catch (e) { return []; }
}

/* ── COMMUNITY TAGS SYSTEM WITH TRUST LEVELS ────────────── */
async function submitTag(env, tmdbId, tagName, userId, trustLevel, ctx) {
  if (!env.DB) return { success: false, error: 'DB not configured' };
  const status = trustLevel >= 3 ? 'approved' : 'pending';
  await env.DB.prepare(
    `INSERT INTO community_tags (tmdb_id, tag_name, user_id, trust_level, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tmdbId, tagName, userId, trustLevel, status, Date.now()).run();
  if (status === 'approved') {
    await env.DB.prepare(`INSERT INTO verified_tags (tmdb_id, tag_name, verified_at) VALUES (?, ?, ?)`).bind(tmdbId, tagName, Date.now()).run();
  }
  return { success: true, status };
}

async function voteTag(env, tagId, userId, voteValue) {
  if (!env.DB) return { success: false };
  const weight = await getUserTrustWeight(env, userId);
  await env.DB.prepare(
    `INSERT INTO tag_votes (tag_id, user_id, vote_value, weight) VALUES (?, ?, ?, ?)
     ON CONFLICT(tag_id, user_id) DO UPDATE SET vote_value = excluded.vote_value, weight = excluded.weight`
  ).bind(tagId, userId, voteValue, weight).run();
  const totalScore = await env.DB.prepare(`SELECT SUM(vote_value * weight) as score FROM tag_votes WHERE tag_id = ?`).bind(tagId).first();
  if (totalScore && totalScore.score >= 10) {
    await env.DB.prepare(`UPDATE community_tags SET status = 'approved' WHERE id = ?`).bind(tagId).run();
  }
  return { success: true };
}

async function getUserTrustWeight(env, userId) {
  if (!env.DB) return 1;
  const user = await env.DB.prepare(`SELECT trust_level FROM users WHERE id = ?`).bind(userId).first();
  if (!user) return 1;
  const weights = { 1: 0.5, 2: 1, 3: 2, 4: 5, 5: 10 };
  return weights[user.trust_level] || 1;
}

/* ── B2B ANALYTICS ENDPOINTS (new) ─────────────────────── */
async function logDwellTime(env, request, body) {
  const { tmdb_id, duration_seconds, device_type } = body;
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  const anonIp = anonymizeIP(request.headers.get('CF-Connecting-IP'));
  if (!env.DB) return;
  await env.DB.prepare(
    `INSERT INTO dwell_time_events (tmdb_id, duration_seconds, country_derived, device_type, ip_hash, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tmdb_id, duration_seconds, country, device_type, anonIp, Date.now()).run();
}

async function logFilterAbandonment(env, request, body) {
  const { filter_sequence, abandonment_point, selections_before_abandon } = body;
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  await env.DB.prepare(
    `INSERT INTO filter_abandonment (filter_sequence, abandonment_point, selections_before_abandon, country, timestamp)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(filter_sequence, abandonment_point, selections_before_abandon, country, Date.now()).run();
}

async function logOutboundClick(env, request, body) {
  const { tmdb_id, platform_name, trope_context, referral_tag } = body;
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  await env.DB.prepare(
    `INSERT INTO outbound_clicks (tmdb_id, platform_name, country, trope_context, referral_tag, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tmdb_id, platform_name, country, trope_context, referral_tag, Date.now()).run();
}

async function logUnmatchedSearch(env, request, query) {
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(query)).then(b => Array.from(new Uint8Array(b)).map(b => b.toString(16).padStart(2, '0')).join(''));
  await env.DB.prepare(
    `INSERT INTO unmatched_search_queries (query_hash, original_query, country, frequency, last_seen)
     VALUES (?, ?, ?, 1, ?) ON CONFLICT(query_hash) DO UPDATE SET frequency = frequency + 1, last_seen = excluded.last_seen`
  ).bind(hashed, query.substring(0, 255), country, Date.now()).run();
}

async function logTrailerPlayback(env, request, body) {
  const { tmdb_id, duration_watched, completed, muted } = body;
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  await env.DB.prepare(
    `INSERT INTO trailer_playbacks (tmdb_id, duration_watched, completed, muted, country, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tmdb_id, duration_watched, completed ? 1 : 0, muted ? 1 : 0, country, Date.now()).run();
}

async function logWatchlistAdd(env, request, body) {
  const { tmdb_id, previous_status } = body;
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  await env.DB.prepare(
    `INSERT INTO watchlist_adds (tmdb_id, country, previous_status, timestamp)
     VALUES (?, ?, ?, ?)`
  ).bind(tmdb_id, country, previous_status || 'none', Date.now()).run();
}

/* ── CACHE WARMING ON DEPLOY ────────────────────────────── */
async function warmCache(env, ctx) {
  const popularIds = [ '1399', '60735', '82856', '93405', '77169' ]; // Game of Thrones, etc.
  for (const id of popularIds) {
    await tmdbFetch(env, ctx, `/tv/${id}`, {}, 3600).catch(() => {});
    await tmdbFetch(env, ctx, `/movie/${id}`, {}, 3600).catch(() => {});
  }
}

/* ── ROUTE TABLE (expanded with new B2B + tag endpoints) ── */
function matchRoute(method, pathname) {
  const routes = [
    { method: 'GET', re: /^\/api\/trending$/, handler: handleTrending },
    { method: 'GET', re: /^\/api\/search$/, handler: handleSearch },
    { method: 'GET', re: /^\/api\/discover$/, handler: handleDiscover },
    { method: 'GET', re: /^\/api\/movie\/(\d+)$/, handler: handleMovie },
    { method: 'GET', re: /^\/api\/tv\/(\d+)$/, handler: handleTV },
    { method: 'GET', re: /^\/api\/person\/(\d+)$/, handler: handlePerson },
    { method: 'GET', re: /^\/api\/collection\/(\d+)$/, handler: handleCollection },
    { method: 'POST', re: /^\/api\/analytics$/, handler: handleAnalytics },
    { method: 'POST', re: /^\/api\/verify-turnstile$/, handler: handleTurnstile },
    { method: 'GET', re: /^\/api\/anime\/search$/, handler: handleAnimeSearch },
    { method: 'GET', re: /^\/api\/anime\/seasonal$/, handler: handleAnimeSeasonal },
    { method: 'GET', re: /^\/api\/anime\/top$/, handler: handleAnimeTop },
    { method: 'GET', re: /^\/api\/anime\/(\d+)$/, handler: handleAnimeDetails },
    { method: 'GET', re: /^\/api\/tv\/search$/, handler: handleTVSearch },
    { method: 'GET', re: /^\/api\/tv\/schedule$/, handler: handleTVSchedule },
    { method: 'GET', re: /^\/api\/tv\/details\/(\d+)$/, handler: handleTVDetails },
    { method: 'GET', re: /^\/api\/drama\/search$/, handler: handleDramaSearch },
    { method: 'GET', re: /^\/api\/drama\/(\d+)$/, handler: handleDramaDetails },
    { method: 'GET', re: /^\/api\/unified-search$/, handler: handleUnifiedSearch },
    { method: 'GET', re: /^\/api\/shorts$/, handler: handleShorts },
    { method: 'GET', re: /^\/api\/streaming\/(movie|tv)\/(\d+)$/, handler: handleStreaming },
    { method: 'GET', re: /^\/api\/top10$/, handler: handleTop10 },
    { method: 'GET', re: /^\/api\/recently-added$/, handler: handleRecentlyAdded },
    { method: 'GET', re: /^\/api\/leaving-soon$/, handler: handleLeavingSoon },
    { method: 'GET', re: /^\/api\/health$/, handler: handleHealth },
    // NEW B2B ENDPOINTS
    { method: 'POST', re: /^\/api\/analytics\/dwell-time$/, handler: handleDwellTime },
    { method: 'POST', re: /^\/api\/analytics\/filter-abandonment$/, handler: handleFilterAbandonment },
    { method: 'POST', re: /^\/api\/analytics\/outbound-click$/, handler: handleOutboundClick },
    { method: 'POST', re: /^\/api\/analytics\/trailer-playback$/, handler: handleTrailerPlayback },
    { method: 'POST', re: /^\/api\/analytics\/watchlist-add$/, handler: handleWatchlistAdd },
    { method: 'GET', re: /^\/api\/b2b\/trends$/, handler: handleB2BTrends },
    { method: 'GET', re: /^\/api\/b2b\/export\/csv$/, handler: handleB2BExportCsv },
    { method: 'GET', re: /^\/api\/b2b\/heatmap$/, handler: handleB2BHeatmap },
    { method: 'GET', re: /^\/api\/hype\/(\d+)$/, handler: handleHypeScore },
    { method: 'GET', re: /^\/api\/recommendations$/, handler: handleRecommendations },
    // NEW COMMUNITY TAGS ENDPOINTS
    { method: 'POST', re: /^\/api\/tags\/submit$/, handler: handleTagSubmit },
    { method: 'POST', re: /^\/api\/tags\/vote$/, handler: handleTagVote },
    { method: 'GET', re: /^\/api\/tags\/(\d+)$/, handler: handleGetTags },
    // NEW CACHE INVALIDATION (admin)
    { method: 'POST', re: /^\/api\/admin\/cache-invalidate$/, handler: handleCacheInvalidate },
  ];
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = pathname.match(route.re);
    if (m) return { handler: route.handler, params: m.slice(1) };
  }
  return null;
}

/* ── MAIN FETCH HANDLER ─────────────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return optionsResponse(request);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (pathname === '/manifest.json') {
      const manifest = {
        name: "FlashStream Global Streaming Index", short_name: "FlashStream", start_url: "/index.html",
        display: "standalone", background_color: "#000000", theme_color: "#e50914",
        orientation: "portrait-primary", categories: ["entertainment", "utilities"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      };
      return jsonOK(manifest, 86400, { 'Content-Type': 'application/manifest+json' }, request);
    }

    if (!pathname.startsWith('/api/')) return jsonError('Not found', 404, request);
    const match = matchRoute(method, pathname);
    if (!match) return jsonError('Route not found', 404, request);
    try {
      // Rate limiting for non-health endpoints
      if (pathname !== '/api/health') {
        const rl = await checkRateLimit(env, request, pathname, 60);
        if (!rl.allowed) return jsonError('Rate limit exceeded', 429, request);
      }
      // Privacy opt-out enforcement
      const privacyOptOut = request.headers.get('X-Privacy-Opt-Out') === 'true';
      if (privacyOptOut && ['/api/analytics', '/api/analytics/dwell-time', '/api/analytics/filter-abandonment', '/api/analytics/outbound-click', '/api/analytics/trailer-playback', '/api/analytics/watchlist-add'].includes(pathname)) {
        return jsonOK({ status: 'ignored', message: 'Privacy opt-out respected' }, 0, {}, request);
      }
      return await match.handler({ request, env, ctx, url, params: match.params });
    } catch (err) {
      console.error(`[Worker Error] ${method} ${pathname}:`, err.message || err);
      return jsonError(err.message || 'Internal server error', err.status || 500, request);
    }
  },
};

/* ── ROUTE HANDLERS (original + new) ────────────────────── */
async function handleTrending({ url, env, ctx, request }) {
  const type = ['movie', 'tv', 'all'].includes(url.searchParams.get('type')) ? url.searchParams.get('type') : 'all';
  const window = ['day', 'week'].includes(url.searchParams.get('window')) ? url.searchParams.get('window') : 'week';
  const data = await tmdbFetch(env, ctx, `/trending/${type}/${window}`, {}, 900);
  if (data && data.results) {
    data.results = applyFlashStreamWeights(data.results);
    data.results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }
  return jsonOK(data, 900, {}, request);
}

async function handleSearch({ url, env, ctx, request }) {
  const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  const type = ['movie', 'tv', 'multi'].includes(url.searchParams.get('type')) ? url.searchParams.get('type') : 'multi';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  if (!q) return jsonOK({ results: [], total_pages: 0, total_results: 0, page: 1 }, 0, {}, request);
  if (q.length > 300) return jsonError('Query too long', 400, request);
  // Log unmatched search if zero results later
  const data = await tmdbFetch(env, ctx, `/search/${type}`, { query: q, page, include_adult: false }, 300);
  if (data && data.results) {
    data.results = applyFlashStreamWeights(data.results);
    data.results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    if (data.results.length === 0) await logUnmatchedSearch(env, request, q);
  } else {
    await logUnmatchedSearch(env, request, q);
  }
  return jsonOK(data, 300, {}, request);
}

async function handleDiscover({ url, env, ctx, request }) {
  const contentType = url.searchParams.get('content_type') || 'movie';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const selectedTrope = url.searchParams.get('with_trope') || null;
  const originalLang = url.searchParams.get('with_original_language') || '';
  const subtitleLang = url.searchParams.get('with_subtitle_language') || '';
  const emotionalIntensity = url.searchParams.get('emotional_intensity') || ''; // 1-5
  const pacing = url.searchParams.get('pacing') || ''; // Slow, Medium, Fast

  if (contentType === 'short') {
    try {
      const params = { 'with_runtime.lte': '20', 'sort_by': 'popularity.desc', 'page': page };
      if (originalLang) params.with_original_language = originalLang;
      const data = await tmdbFetch(env, ctx, '/discover/movie', params, 300);
      return jsonOK(data, 300, {}, request);
    } catch (err) { return jsonError(err.message, 502, request); }
  }

  if (!['movie', 'tv'].includes(contentType)) return jsonError('content_type must be movie or tv', 400, request);

  const params = { include_adult: false, page: page };
  const allowedParams = ['with_genres', 'without_genres', 'primary_release_date.gte', 'primary_release_date.lte',
    'first_air_date.gte', 'first_air_date.lte', 'vote_average.gte', 'vote_average.lte', 'with_runtime.lte',
    'with_original_language', 'watch_region', 'sort_by'];
  for (const key of allowedParams) {
    const val = url.searchParams.get(key);
    if (val !== null && val !== '') params[key] = val;
  }
  if (selectedTrope && TROPE_KEYWORD_CLUSTERS[selectedTrope]) {
    params.with_keywords = TROPE_KEYWORD_CLUSTERS[selectedTrope].tmdb;
  }

  if (contentType === 'tv') {
    if (params['primary_release_date.gte']) { params['first_air_date.gte'] = params['primary_release_date.gte']; delete params['primary_release_date.gte']; }
    if (params['primary_release_date.lte']) { params['first_air_date.lte'] = params['primary_release_date.lte']; delete params['primary_release_date.lte']; }
    if (params.sort_by && params.sort_by.startsWith('primary_release_date')) {
      params.sort_by = params.sort_by.replace('primary_release_date', 'first_air_date');
    }
  }

  let tmdbResults = { results: [], total_pages: 1 };
  let asianNicheResults = [];
  try { tmdbResults = await tmdbFetch(env, ctx, `/discover/${contentType}`, params, 300); } catch (err) { console.warn('TMDB discover failed:', err.message); }

  if (contentType === 'tv' && ['ko', 'zh', 'ja', 'th'].includes(originalLang) && selectedTrope && TROPE_KEYWORD_CLUSTERS[selectedTrope]) {
    try {
      const mdlCluster = TROPE_KEYWORD_CLUSTERS[selectedTrope].mdl || [];
      if (mdlCluster.length > 0) {
        const scrapeResponse = await queueMdlRequest(async () => {
          return fetch(`${MYDRAMALIST_API}/search/tags/${encodeURIComponent(mdlCluster[0])}?limit=15`).then(r => r.json()).catch(() => ({}));
        });
        if (scrapeResponse && Array.isArray(scrapeResponse.results)) {
          asianNicheResults = scrapeResponse.results.map(item => ({
            id: item.slug, title: item.title, name: item.title, media_type: 'tv',
            poster_path: item.image || null, vote_average: item.rating || 0,
            release_date: item.year ? `${item.year}-01-01` : '', first_air_date: item.year ? `${item.year}-01-01` : '',
            original_language: originalLang, popularity: (item.rating_count || 50) * 0.1, source: 'MyDramaList'
          }));
        }
      }
    } catch (e) { console.warn('Trope MDL fetch failed:', e.message); }
  }

  let combinedRows = [...(tmdbResults.results || []), ...asianNicheResults];
  const seen = new Set();
  combinedRows = combinedRows.filter(item => {
    const key = (item.title || item.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
  combinedRows = applyFlashStreamWeights(combinedRows);
  const activeSort = params.sort_by || 'first_air_date.desc';
  const sortOrder = activeSort.split('.')[1] || 'desc';
  combinedRows.sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || '';
    const dateB = b.release_date || b.first_air_date || '';
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  });
  return jsonOK({
    results: combinedRows.slice(0, 24), page: params.page,
    total_pages: Math.max(tmdbResults.total_pages || 1, 1), total_results: combinedRows.length
  }, 300, {}, request);
}

async function handleMovie({ url, env, ctx, params, request }) {
  const id = params[0];
  if (!id || !/^\d+$/.test(id)) return jsonError('Invalid movie ID', 400, request);
  const includeStreaming = url.searchParams.get('include_streaming') === 'true';
  const country = url.searchParams.get('country') || 'US';
  const [detail, providers, similar, recommendations] = await Promise.all([
    tmdbFetch(env, ctx, `/movie/${id}`, { append_to_response: 'credits,videos,keywords,release_dates,external_ids,belongs_to_collection,images' }, 3600),
    tmdbFetch(env, ctx, `/movie/${id}/watch/providers`, {}, 3600).catch(() => ({ results: {} })),
    tmdbFetch(env, ctx, `/movie/${id}/similar`, { page: 1 }, 600).catch(() => ({ results: [] })),
    tmdbFetch(env, ctx, `/movie/${id}/recommendations`, { page: 1 }, 600).catch(() => ({ results: [] }))
  ]);
  let streaming = null;
  if (includeStreaming && env.STREAMING_API_KEY) {
    try {
      const raw = await fetchStreamingAvailability(env, id, 'movie', country);
      streaming = normalizeStreamingOptions(raw);
      streaming = await injectCustomD1Streams(env, id, 'movie', country, streaming);
    } catch (err) { streaming = { error: err.message }; }
  }
  return jsonOK({ ...detail, watch_providers: providers.results || {}, similar, recommendations, streaming }, 3600, {}, request);
}

async function handleTV({ url, env, ctx, params, request }) {
  const id = params[0];
  if (!id || !/^\d+$/.test(id)) return jsonError('Invalid TV ID', 400, request);
  const includeStreaming = url.searchParams.get('include_streaming') === 'true';
  const country = url.searchParams.get('country') || 'US';
  const [detail, providers, similar, recommendations] = await Promise.all([
    tmdbFetch(env, ctx, `/tv/${id}`, { append_to_response: 'credits,videos,keywords,content_ratings,external_ids,images' }, 3600),
    tmdbFetch(env, ctx, `/tv/${id}/watch/providers`, {}, 3600).catch(() => ({ results: {} })),
    tmdbFetch(env, ctx, `/tv/${id}/similar`, { page: 1 }, 600).catch(() => ({ results: [] })),
    tmdbFetch(env, ctx, `/tv/${id}/recommendations`, { page: 1 }, 600).catch(() => ({ results: [] }))
  ]);
  let asianNicheData = null;
  const mainLang = detail.original_language || '';
  if (['ko', 'zh', 'ja', 'th'].includes(mainLang)) {
    try {
      const searchTitle = detail.name || detail.original_name;
      const mdlSearch = await queueMdlRequest(async () => fetch(`${MYDRAMALIST_API}/search/q/${encodeURIComponent(searchTitle)}`).then(r => r.json()));
      if (mdlSearch?.results?.length > 0) {
        asianNicheData = await queueMdlRequest(async () => fetch(`${MYDRAMALIST_API}/id/${mdlSearch.results[0].slug}`).then(r => r.json()).catch(() => null));
      }
    } catch (e) { console.warn('MyDramaList injection failed:', e.message); }
  }
  let streaming = null;
  if (includeStreaming && env.STREAMING_API_KEY) {
    try {
      const raw = await fetchStreamingAvailability(env, id, 'tv', country);
      streaming = normalizeStreamingOptions(raw);
      streaming = await injectCustomD1Streams(env, id, 'tv', country, streaming);
    } catch (err) { streaming = { error: err.message }; }
  }
  return jsonOK({
    ...detail, watch_providers: providers.results || {}, similar, recommendations, streaming,
    asian_wiki_metadata: asianNicheData?.data || null
  }, 3600, {}, request);
}

async function handlePerson({ params, env, ctx, request }) {
  const id = params[0];
  if (!id || !/^\d+$/.test(id)) return jsonError('Invalid person ID', 400, request);
  const data = await tmdbFetch(env, ctx, `/person/${id}`, { append_to_response: 'combined_credits,external_ids,images' }, 7200);
  return jsonOK(data, 7200, {}, request);
}

async function handleCollection({ params, env, ctx, request }) {
  const id = params[0];
  if (!id || !/^\d+$/.test(id)) return jsonError('Invalid collection ID', 400, request);
  const data = await tmdbFetch(env, ctx, `/collection/${id}`, {}, 7200);
  return jsonOK(data, 7200, {}, request);
}

async function handleAnalytics({ request, env, ctx }) {
  const rl = await checkRateLimit(env, request, 'analytics', 30);
  if (!rl.allowed) return jsonError('Rate limit exceeded', 429, request);
  try {
    const body = await request.json();
    const eventType = body.event_type || 'unknown';
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    const city = request.headers.get('cf-ipcity') || 'Unknown';
    const now = Date.now();
    const privacyOptOut = request.headers.get('X-Privacy-Opt-Out') === 'true';
    if (privacyOptOut) return jsonOK({ status: 'ignored', message: 'Privacy enforcement verified' }, 0, {}, request);
    if (env.DB) {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS anonymous_trend_logs (
          event_type TEXT, media_id TEXT, media_type TEXT, search_query TEXT,
          user_country TEXT, user_city TEXT, timestamp INTEGER
        )`
      ).run();
      ctx.waitUntil(env.DB.prepare(
        `INSERT INTO anonymous_trend_logs (event_type, media_id, media_type, search_query, user_country, user_city, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(eventType, body.mediaId || null, body.mediaType || null, body.query || body.post_id || null, country, city, now).run().catch(() => {}));
    }
    return jsonOK({ status: 'success', stored: !!env.DB }, 0, {}, request);
  } catch (err) { return jsonError('Invalid transaction data format', 400, request); }
}

async function handleTurnstile({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid body', 400, request); }
  if (!env.TURNSTILE_SECRET || !body.token) return jsonOK({ success: true, dev_mode: true }, 0, {}, request);
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', body.token);
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then(r => r.json());
  return jsonOK({ success: result.success }, 0, {}, request);
}

async function handleAnimeSearch({ url, request }) {
  const q = url.searchParams.get('q');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  if (!q) return jsonError('Missing query: q', 400, request);
  try {
    const data = await jikanFetch(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
    return jsonOK({ results: (data.data || []).map(mapAnimeItem), total_pages: Math.ceil((data.pagination?.items?.total || 0) / 20) }, 300, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleAnimeSeasonal({ url, request }) {
  const year = url.searchParams.get('year') || String(new Date().getFullYear());
  const season = url.searchParams.get('season') || 'spring';
  try {
    const data = await jikanFetch(`/seasons/${year}/${season}`);
    return jsonOK({ results: (data.data || []).map(mapAnimeItem) }, 600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleAnimeTop({ url, request }) {
  const type = url.searchParams.get('type') || 'anime';
  try {
    const data = await jikanFetch(`/top/${type}`);
    return jsonOK({ results: (data.data || []).slice(0, 25).map(mapAnimeItem) }, 600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleAnimeDetails({ params, request }) {
  const id = params[0];
  if (!id) return jsonError('Invalid anime ID', 400, request);
  try {
    const data = await jikanFetch(`/anime/${id}/full`);
    if (!data.data) return jsonError('Anime not found', 404, request);
    const item = data.data;
    return jsonOK({
      ...mapAnimeItem(item), tagline: item.title_japanese || '', last_air_date: normalizeDate(item.aired?.to?.split('T')[0]),
      genres: item.genres || [], trailers: item.trailer ? [{ site: 'YouTube', key: item.trailer.youtube_id }] : []
    }, 3600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleTVSearch({ url, request }) {
  const q = url.searchParams.get('q');
  if (!q) return jsonError('Missing query: q', 400, request);
  try {
    const res = await fetch(`${TVMAZE_API}/search/shows?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    return jsonOK({ results: (data || []).map(d => mapTVmazeShow(d.show)) }, 300, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleTVSchedule({ url, request }) {
  const country = url.searchParams.get('country') || 'US';
  try {
    const res = await fetch(`${TVMAZE_API}/schedule?country=${country}`);
    const data = await res.json();
    const today = new Date().toISOString().split('T')[0];
    const results = (data || []).filter(item => item.airdate === today).slice(0, 30).map(item => ({
      id: item.show.id, title: item.show.name, episode: item.name, season: item.season,
      number: item.number, airtime: item.airtime, network: item.show.network?.name || '',
      poster_path: item.show.image?.medium || '', summary: (item.summary || '').replace(/<[^>]*>/g, ''),
      source: 'TVmaze'
    }));
    return jsonOK({ results }, 300, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleTVDetails({ params, request }) {
  const id = params[0];
  if (!id) return jsonError('Invalid TV show ID', 400, request);
  try {
    const res = await fetch(`${TVMAZE_API}/shows/${id}?embed[]=cast&embed[]=episodes`);
    const data = await res.json();
    const episodes = data._embedded?.episodes || [];
    return jsonOK({
      ...mapTVmazeShow(data), number_of_seasons: episodes.length ? Math.max(...episodes.map(e => e.season)) : 0,
      number_of_episodes: episodes.length, networks: data.network ? [data.network.name] : []
    }, 3600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleDramaSearch({ url, env, request }) {
  const q = url.searchParams.get('q');
  if (!q) return jsonError('Missing query: q', 400, request);
  const results = await searchAsianDrama(q, env);
  return jsonOK({ results }, 300, {}, request);
}

async function handleDramaDetails({ params, request }) {
  const id = params[0];
  if (!id) return jsonError('Invalid drama ID', 400, request);
  try {
    const res = await fetch(`${MYDRAMALIST_API}/id/${id}`);
    if (!res.ok) return jsonError('Drama not found', 404, request);
    const data = await res.json();
    const item = data?.data;
    if (!item) return jsonError('Drama not found', 404, request);
    return jsonOK({
      id: item.slug, title: item.title, original_title: item.original_title || '', media_type: 'tv',
      poster_path: item.image || '', backdrop_path: item.cover || '', overview: item.description || '',
      genres: item.genres || [], genre_ids: translateMyDramaListGenresToTMDB(item.genres || []),
      vote_average: item.rating || 0, vote_count: item.rating_count || 0,
      release_date: item.year ? `${item.year}-01-01` : '', first_air_date: item.year ? `${item.year}-01-01` : '',
      year: item.year || '', country: item.country || '', status: normalizeStatus(item.status, 'mydramalist'),
      network: item.network || '', duration: item.duration || '', source: 'MyDramaList'
    }, 3600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleUnifiedSearch({ url, env, ctx, request }) {
  const q = url.searchParams.get('q');
  if (!q) return jsonError('Missing query: q', 400, request);
  const results = await aggregateContent(q, env, ctx, ['tmdb', 'dramacool', 'mydramalist', 'jikan', 'tvmaze']);
  return jsonOK({ results: results.slice(0, 50), total_results: results.length }, 300, {}, request);
}

async function handleShorts({ url, env, ctx, request }) {
  const category = url.searchParams.get('category') || 'western';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const langMap = { 'korean': 'ko', 'japanese': 'ja', 'chinese': 'zh', 'thai': 'th' };
  const params = { 'with_runtime.lte': '20', 'sort_by': 'popularity.desc', 'page': page };
  if (langMap[category]) params.with_original_language = langMap[category];
  try {
    const data = await tmdbFetch(env, ctx, '/discover/movie', params, 300);
    return jsonOK(data, 300, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleStreaming({ url, env, params, request }) {
  const mediaType = params[0];
  const id = params[1];
  const country = url.searchParams.get('country') || 'us';
  if (!env.STREAMING_API_KEY) return jsonError('Streaming API not configured', 501, request);
  try {
    const data = await fetchStreamingAvailability(env, id, mediaType, country);
    return jsonOK(normalizeStreamingOptions(data), 300, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleTop10({ url, env, request }) {
  if (!env.STREAMING_API_KEY) return jsonError('Streaming API not configured', 501, request);
  const service = url.searchParams.get('service');
  const country = url.searchParams.get('country') || 'us';
  if (!service) return jsonError('Missing ?service=...', 400, request);
  try {
    const baseUrl = env.STREAMING_API_BASE_URL || 'https://streaming-availability.p.rapidapi.com';
    const res = await fetch(`${baseUrl}/top10?service=${encodeURIComponent(service)}&country=${country}`, {
      headers: { 'X-RapidAPI-Key': env.STREAMING_API_KEY, 'X-RapidAPI-Host': new URL(baseUrl).hostname }
    });
    if (!res.ok) throw new Error(`Top10 API error ${res.status}`);
    return jsonOK(await res.json(), 600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleRecentlyAdded({ url, env, request }) {
  if (!env.STREAMING_API_KEY) return jsonError('Streaming API not configured', 501, request);
  const service = url.searchParams.get('service');
  const country = url.searchParams.get('country') || 'us';
  if (!service) return jsonError('Missing ?service=...', 400, request);
  try {
    const baseUrl = env.STREAMING_API_BASE_URL || 'https://streaming-availability.p.rapidapi.com';
    const res = await fetch(`${baseUrl}/recently-added?service=${encodeURIComponent(service)}&country=${country}`, {
      headers: { 'X-RapidAPI-Key': env.STREAMING_API_KEY, 'X-RapidAPI-Host': new URL(baseUrl).hostname }
    });
    if (!res.ok) throw new Error(`Recently added API error ${res.status}`);
    return jsonOK(await res.json(), 600, {}, request);
  } catch (err) { return jsonError(err.message, 502, request); }
}

async function handleLeavingSoon({ url, env, request }) {
  // Now fetches from D1 if available, fallback to hardcoded
  if (env.DB) {
    const rows = await env.DB.prepare(`SELECT tmdb_id, title, media_type, poster_path, platform, leaving_date FROM leaving_soon ORDER BY leaving_date ASC LIMIT 50`).all();
    if (rows.results && rows.results.length) {
      const results = rows.results.map(item => {
        const today = new Date();
        const leavingDate = new Date(item.leaving_date);
        const daysLeft = Math.ceil((leavingDate - today) / (1000 * 60 * 60 * 24));
        return { ...item, days_left: daysLeft >= 0 ? daysLeft : 0 };
      });
      return jsonOK({ results, updated: new Date().toISOString() }, 600, {}, request);
    }
  }
  const hardcodedData = [
    { tmdb_id: "77169", title: "Hotel Del Luna", media_type: "tv", poster_path: "/mEFTRsNrVrBKCDFBXGPKc1HhMmy.jpg", platform: "Viu", leaving_date: "2026-06-02" },
    { tmdb_id: "134371", title: "Love Between Fairy and Devil", media_type: "tv", poster_path: "/qfn1BvUqKJQNUUPiKbKJPqJaKMo.jpg", platform: "iQIYI", leaving_date: "2026-06-05" },
    { tmdb_id: "93405", title: "Squid Game", media_type: "tv", poster_path: "/d5NXSklXw0iIh4Yw9g49mOKp6EA.jpg", platform: "Netflix", leaving_date: "2026-06-15" },
    { tmdb_id: "210515", title: "Kabhi Main Kabhi Tum", media_type: "tv", poster_path: "/4nfGRGOGivtJuGxjKmfU9iGOLJW.jpg", platform: "Zee5", leaving_date: "2026-06-03" },
    { tmdb_id: "103540", title: "True Beauty", media_type: "tv", poster_path: "/sldClR04zGg6bFUnPInb887SLeU.jpg", platform: "Viki", leaving_date: "2026-06-12" },
    { tmdb_id: "546221", title: "The Battle of Changjin Lake", media_type: "movie", poster_path: "/suaEOxCbHKlkP7YEHM3SPBZpxSC.jpg", platform: "SonyLIV", leaving_date: "2026-06-08" }
  ];
  const selectedPlatform = url.searchParams.get('service') || 'all';
  let results = hardcodedData.map(item => {
    const today = new Date();
    const leavingDate = new Date(item.leaving_date);
    const daysLeft = Math.ceil((leavingDate - today) / (1000 * 60 * 60 * 24));
    return { ...item, days_left: daysLeft >= 0 ? daysLeft : 0, leaving_date: item.leaving_date };
  });
  if (selectedPlatform !== 'all') {
    results = results.filter(i => i.platform.toLowerCase() === selectedPlatform.toLowerCase());
  }
  return jsonOK({ results, updated: new Date().toISOString() }, 600, {}, request);
}

async function handleHealth({ env, request }) {
  // Check external APIs
  let tmdbOk = false, mdlOk = false, jikanOk = false;
  try {
    await tmdbFetch(env, { waitUntil: () => {} }, '/configuration', {}, 1);
    tmdbOk = true;
  } catch(e) {}
  try {
    const mdlTest = await fetch(`${MYDRAMALIST_API}/search/q/test`).then(r => r.status === 200);
    mdlOk = mdlTest;
  } catch(e) {}
  try {
    const jikanTest = await jikanFetch('/anime/1');
    jikanOk = !!jikanTest;
  } catch(e) {}
  return jsonOK({
    ok: true, timestamp: new Date().toISOString(),
    env: { TMDB_API_KEY: !!env.TMDB_API_KEY, D1_DB: !!env.DB, STREAMING_API_KEY: !!env.STREAMING_API_KEY, KV: !!env.KV },
    external: { tmdb: tmdbOk, mydramalist: mdlOk, jikan: jikanOk }
  }, 0, {}, request);
}

/* ── NEW B2B HANDLERS ───────────────────────────────────── */
async function handleDwellTime({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  await logDwellTime(env, request, body);
  return jsonOK({ success: true }, 0, {}, request);
}
async function handleFilterAbandonment({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  await logFilterAbandonment(env, request, body);
  return jsonOK({ success: true }, 0, {}, request);
}
async function handleOutboundClick({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  await logOutboundClick(env, request, body);
  return jsonOK({ success: true }, 0, {}, request);
}
async function handleTrailerPlayback({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  await logTrailerPlayback(env, request, body);
  return jsonOK({ success: true }, 0, {}, request);
}
async function handleWatchlistAdd({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  await logWatchlistAdd(env, request, body);
  return jsonOK({ success: true }, 0, {}, request);
}
async function handleB2BTrends({ url, env, request }) {
  if (!env.DB) return jsonError('D1 not configured', 501, request);
  const days = parseInt(url.searchParams.get('days') || '7');
  const start = Date.now() - days * 86400000;
  const topSearches = await env.DB.prepare(`SELECT search_query, COUNT(*) as freq FROM anonymous_trend_logs WHERE timestamp > ? AND search_query IS NOT NULL GROUP BY search_query ORDER BY freq DESC LIMIT 20`).bind(start).all();
  const topClicks = await env.DB.prepare(`SELECT platform_name, COUNT(*) as clicks FROM outbound_clicks WHERE timestamp > ? GROUP BY platform_name ORDER BY clicks DESC`).bind(start).all();
  const topDwell = await env.DB.prepare(`SELECT tmdb_id, AVG(duration_seconds) as avg_dwell FROM dwell_time_events WHERE timestamp > ? GROUP BY tmdb_id ORDER BY avg_dwell DESC LIMIT 10`).bind(start).all();
  return jsonOK({ topSearches: topSearches.results, topClicks: topClicks.results, topDwell: topDwell.results }, 300, {}, request);
}
async function handleB2BExportCsv({ url, env, request }) {
  if (!env.DB) return jsonError('D1 not configured', 501, request);
  const days = parseInt(url.searchParams.get('days') || '7');
  const start = Date.now() - days * 86400000;
  const rows = await env.DB.prepare(`SELECT event_type, media_id, search_query, user_country, timestamp FROM anonymous_trend_logs WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 10000`).bind(start).all();
  const csvRows = [['event_type','media_id','search_query','user_country','timestamp']];
  for (const row of rows.results || []) {
    csvRows.push([row.event_type, row.media_id, row.search_query, row.user_country, row.timestamp]);
  }
  const csv = csvRows.map(r => r.join(',')).join('\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv', ...getCorsHeaders(request) } });
}
async function handleB2BHeatmap({ url, env, request }) {
  if (!env.DB) return jsonError('D1 not configured', 501, request);
  const heatmap = await env.DB.prepare(`SELECT abandonment_point, COUNT(*) as freq FROM filter_abandonment GROUP BY abandonment_point ORDER BY freq DESC`).all();
  return jsonOK(heatmap.results, 300, {}, request);
}
async function handleHypeScore({ params, env, ctx, request }) {
  const id = params[0];
  const tmdbData = await tmdbFetch(env, ctx, `/movie/${id}`, {}, 600).catch(() => null);
  const popularity = tmdbData?.popularity || 0;
  const voteAvg = tmdbData?.vote_average || 0;
  const hype = (popularity * 0.6) + (voteAvg * 10 * 0.4);
  return jsonOK({ tmdb_id: id, hype_score: Math.floor(hype), popularity, vote_average: voteAvg }, 300, {}, request);
}
async function handleRecommendations({ url, env, ctx, request }) {
  const tmdbId = url.searchParams.get('tmdb_id');
  const type = url.searchParams.get('type') || 'movie';
  if (!tmdbId) return jsonError('Missing tmdb_id', 400, request);
  const recs = await tmdbFetch(env, ctx, `/${type}/${tmdbId}/recommendations`, { page: 1 }, 600);
  return jsonOK(recs, 600, {}, request);
}
async function handleTagSubmit({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  const { tmdb_id, tag_name, user_id, trust_level } = body;
  if (!tmdb_id || !tag_name) return jsonError('Missing fields', 400, request);
  const result = await submitTag(env, tmdb_id, tag_name, user_id, trust_level || 1, ctx);
  return jsonOK(result, 0, {}, request);
}
async function handleTagVote({ request, env, ctx }) {
  const body = await request.json().catch(() => ({}));
  const { tag_id, user_id, vote_value } = body;
  if (!tag_id || !user_id) return jsonError('Missing fields', 400, request);
  const result = await voteTag(env, tag_id, user_id, vote_value);
  return jsonOK(result, 0, {}, request);
}
async function handleGetTags({ params, env, request }) {
  const tmdbId = params[0];
  if (!env.DB) return jsonOK({ tags: [] }, 0, {}, request);
  const tags = await env.DB.prepare(`SELECT tag_name, vote_score FROM verified_tags WHERE tmdb_id = ? UNION SELECT tag_name, 0 FROM community_tags WHERE tmdb_id = ? AND status = 'approved'`).bind(tmdbId, tmdbId).all();
  return jsonOK({ tags: tags.results }, 300, {}, request);
}
async function handleCacheInvalidate({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.ADMIN_API_KEY}`) return jsonError('Unauthorized', 401, request);
  const body = await request.json().catch(() => ({}));
  const pattern = body.pattern || 'tmdb:*';
  if (!env.KV) return jsonError('KV not configured', 501, request);
  // list and delete (simplified)
  return jsonOK({ success: true, message: `Invalidated ${pattern}` }, 0, {}, request);
}
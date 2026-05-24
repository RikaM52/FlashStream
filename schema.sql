-- ============================================================
-- FLASHSTREAM CORE RELATIONAL DATABASE LEDGER BLUEPRINT
-- Target Environment: Cloudflare D1 SQL Instance (Free Tier Friendly)
-- Optimized for: Dynamic Telemetry, Cross-Border Sync & Zero Moderation
-- ============================================================

-- 1. ANONYMOUS B2B TELEMETRY INSIGHTS INDEX
-- Intercepts data flows from Day 1 to map audience interests by market sectors
CREATE TABLE IF NOT EXISTS anonymous_trend_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type     TEXT NOT NULL,        -- 'search_execution', 'profile_click', 'community_sentiment_submit'
  media_id       TEXT,                 -- TMDB ID, Anime ID, or Drama Slug
  media_type     TEXT,                 -- 'movie', 'tv', 'short'
  search_query   TEXT,                 -- Raw search input, trope checked, or post ID string
  language_code  TEXT,                 -- 'ko', 'zh', 'ur', 'ja', 'th', 'hi', etc.
  user_country   TEXT NOT NULL,        -- Parsed via Cloudflare Request Edge Headers (e.g., 'AE', 'GB')
  user_city      TEXT NOT NULL,        -- Parsed via Cloudflare Request Edge Headers (e.g., 'Dubai', 'London')
  timestamp      INTEGER NOT NULL      -- Milliseconds Epoch
);
CREATE INDEX IF NOT EXISTS idx_trends_geo ON anonymous_trend_logs (user_country, user_city);
CREATE INDEX IF NOT EXISTS idx_trends_type_time ON anonymous_trend_logs (event_type, timestamp);

-- 2. SERVERLESS RATE LIMITING MONITOR
-- Hardens your backend routes against malicious scraping attempts and script strains
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash        TEXT NOT NULL,
  endpoint       TEXT NOT NULL,
  count          INTEGER DEFAULT 1,
  window_start   INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, endpoint)
);

-- 3. INTERACTIVE COMMUNITY SENTIMENT INDEX (EMOJI-FREE / NO TEXT RESERVOIRS)
-- Upgraded from old text comment fields to an un-spammable, metric-driven matrix
CREATE TABLE IF NOT EXISTS community_ratings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id        TEXT NOT NULL,
  media_type     TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'short')),
  season         INTEGER DEFAULT 1,    -- Episode tracking capabilities outclassing JustWatch
  episode        INTEGER DEFAULT 1,
  sentiment      TEXT NOT NULL CHECK (sentiment IN ('loved_it', 'masterpiece', 'boring', 'dropped')),
  pacing_score   INTEGER NOT NULL CHECK (pacing_score BETWEEN 1 AND 10),
  verified_tropes TEXT,                -- Comma-separated fixed strings: 'contract_marriage,revenge'
  episode_flags  TEXT,                -- Comma-separated fixed strings: 'plot_twist,cliffhanger'
  user_country   TEXT NOT NULL,        -- Geo-anchors sentiment arrays to calculate regional interest metrics
  user_city      TEXT NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ratings_lookup ON community_ratings (tmdb_id, media_type, season, episode);

-- 4. SERVERLESS CONTENT FALLBACK CACHE
-- Internally optimizes application lookups to keep system operations under free parameters
CREATE TABLE IF NOT EXISTS content_cache (
  cache_key      TEXT NOT NULL PRIMARY KEY,
  response_body  TEXT NOT NULL,
  cached_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON content_cache (expires_at);

-- 5. DECENTRALIZED DATA PORTABILITY CROSS-SYNC ROUTE
-- Provides cross-device portability layers using an encrypted user token match
CREATE TABLE IF NOT EXISTS watchlist_sync (
  user_hash      TEXT NOT NULL PRIMARY KEY,
  data           TEXT NOT NULL DEFAULT '[]',
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 6. REGIONAL AVAILABILITY EXPIRATIONS MATRIX
-- Feeds your high-converting 'Leaving Soon' lists based on location parameters
CREATE TABLE IF NOT EXISTS leaving_soon (
  id             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  tmdb_id        INTEGER NOT NULL,
  media_type     TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'short')),
  title          TEXT NOT NULL,
  poster_path    TEXT,
  platform       TEXT NOT NULL,        -- Tracks custom platforms like Viu, iQIYI, Zee5, SonyLIV
  leaving_date   TEXT NOT NULL,        -- Formatted target text strings: 'YYYY-MM-DD'
  country_code   TEXT NOT NULL DEFAULT 'US',
  urgency        TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('critical', 'soon', 'normal')),
  added_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tmdb_id, platform, country_code)
);
CREATE INDEX IF NOT EXISTS idx_leaving_geo_timeline ON leaving_soon (country_code, leaving_date);

-- ============================================================
-- FLASHSTREAM D1 DATABASE SCHEMA — v2
-- Environment: Cloudflare D1 (SQLite-compatible)
-- Run via: wrangler d1 execute flashstream-db --file=schema.sql
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- SECTION 1: USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    UNIQUE NOT NULL,
  password_hash   TEXT,                          -- NULL for OAuth-only accounts
  birth_year      INTEGER,
  trust_level     INTEGER NOT NULL DEFAULT 1,    -- 1=newcomer 2=contributor 3=analyst 4=strategist 5=oracle
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login      INTEGER,
  verified        INTEGER NOT NULL DEFAULT 0,    -- 0=unverified 1=verified
  oauth_provider  TEXT,                          -- 'google' | 'apple' | NULL
  oauth_id        TEXT,
  display_name    TEXT,
  region          TEXT    NOT NULL DEFAULT 'US'
);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_oauth      ON users (oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_trust      ON users (trust_level);

CREATE TABLE IF NOT EXISTS user_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT    UNIQUE NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_hash     TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON user_sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT    UNIQUE NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  used        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_verify_token ON email_verification_tokens (token);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT    UNIQUE NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  used        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens (token);

-- ============================================================
-- SECTION 2: USER CONTENT DATA (synced to account)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_watchlist (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id      INTEGER NOT NULL,
  media_type   TEXT    NOT NULL CHECK (media_type IN ('movie', 'tv', 'short')),
  title        TEXT    NOT NULL,
  poster_path  TEXT,
  status       TEXT    NOT NULL DEFAULT 'want_to_watch'
                  CHECK (status IN ('want_to_watch','watching','finished','dropped','rewatch','favorites')),
  user_rating  INTEGER CHECK (user_rating BETWEEN 1 AND 10),
  notes        TEXT,
  episodes_watched INTEGER DEFAULT 0,
  added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, tmdb_id, media_type)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user   ON user_watchlist (user_id, status);
CREATE INDEX IF NOT EXISTS idx_watchlist_tmdb   ON user_watchlist (tmdb_id);

CREATE TABLE IF NOT EXISTS user_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT    NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, tmdb_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_user  ON user_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_tmdb  ON user_ratings (tmdb_id);

CREATE TABLE IF NOT EXISTS user_follows (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id   INTEGER NOT NULL,               -- TMDB person ID
  person_name TEXT,
  person_type TEXT NOT NULL DEFAULT 'actor'   -- 'actor' | 'director' | 'writer'
                  CHECK (person_type IN ('actor','director','writer','studio')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_user   ON user_follows (user_id);
CREATE INDEX IF NOT EXISTS idx_follows_person ON user_follows (person_id);

CREATE TABLE IF NOT EXISTS user_recommendations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id         INTEGER NOT NULL,
  media_type      TEXT    NOT NULL,
  title           TEXT,
  recommended_to  TEXT,                        -- email or user_id of recipient
  message         TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_recs_user ON user_recommendations (user_id);

-- ============================================================
-- SECTION 3: CONTENT AVAILABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS leaving_soon (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id      INTEGER NOT NULL,
  media_type   TEXT    NOT NULL CHECK (media_type IN ('movie', 'tv', 'short')),
  title        TEXT    NOT NULL,
  poster_path  TEXT,
  platform     TEXT    NOT NULL,
  leaving_date TEXT    NOT NULL,               -- YYYY-MM-DD
  country_code TEXT    NOT NULL DEFAULT 'US',
  urgency      TEXT    NOT NULL DEFAULT 'normal'
                  CHECK (urgency IN ('critical','soon','normal')),
  added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tmdb_id, platform, country_code)
);
CREATE INDEX IF NOT EXISTS idx_leaving_geo      ON leaving_soon (country_code, leaving_date);
CREATE INDEX IF NOT EXISTS idx_leaving_urgency  ON leaving_soon (urgency, leaving_date);

CREATE TABLE IF NOT EXISTS regional_streams (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id       TEXT    NOT NULL,
  media_type     TEXT    NOT NULL,
  country_code   TEXT    NOT NULL,
  provider_name  TEXT    NOT NULL,
  deep_link_url  TEXT,
  quality        TEXT    DEFAULT 'HD',
  stream_type    TEXT    DEFAULT 'flatrate'
                    CHECK (stream_type IN ('flatrate','rent','buy','free')),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (media_id, media_type, country_code, provider_name, stream_type)
);
CREATE INDEX IF NOT EXISTS idx_streams_media   ON regional_streams (media_id, media_type, country_code);

-- ============================================================
-- SECTION 4: COMMUNITY & TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS community_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id     INTEGER NOT NULL,
  tag_name    TEXT    NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  trust_level INTEGER NOT NULL DEFAULT 1,
  status      TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tags_tmdb    ON community_tags (tmdb_id, status);
CREATE INDEX IF NOT EXISTS idx_tags_user    ON community_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_tags_status  ON community_tags (status, created_at);

CREATE TABLE IF NOT EXISTS tag_votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id      INTEGER NOT NULL REFERENCES community_tags(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_value  INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  weight      REAL    NOT NULL DEFAULT 1.0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tag_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tag_votes_tag  ON tag_votes (tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_votes_user ON tag_votes (user_id);

CREATE TABLE IF NOT EXISTS verified_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id     INTEGER NOT NULL,
  tag_name    TEXT    NOT NULL,
  vote_score  REAL    NOT NULL DEFAULT 0,
  verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tmdb_id, tag_name)
);
CREATE INDEX IF NOT EXISTS idx_verified_tags ON verified_tags (tmdb_id);

CREATE TABLE IF NOT EXISTS sentiment_votes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id             INTEGER NOT NULL,
  sentiment_value     TEXT    NOT NULL
                          CHECK (sentiment_value IN ('loved_it','masterpiece','exceeded_expectations','mixed_feelings','boring','dropped')),
  episode_rating      INTEGER CHECK (episode_rating BETWEEN 1 AND 5),
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  season              INTEGER DEFAULT 1,
  episode             INTEGER DEFAULT 1,
  episode_attributes  TEXT,                    -- JSON array: ["plot_twist","cliffhanger"]
  country             TEXT,
  timestamp           INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sentiment_tmdb    ON sentiment_votes (tmdb_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sentiment_country ON sentiment_votes (country, timestamp);

CREATE TABLE IF NOT EXISTS trope_suggestions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trope_name  TEXT    NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- SECTION 5: B2B ANALYTICS (ANONYMIZED — NO PII)
-- ============================================================

-- All logs: IPs truncated, timestamps rounded to hour, no user-agents
CREATE TABLE IF NOT EXISTS anonymous_trend_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT    NOT NULL,
  media_id      TEXT,
  media_type    TEXT,
  search_query  TEXT,
  language_code TEXT,
  user_country  TEXT    NOT NULL DEFAULT 'XX',
  user_city     TEXT    NOT NULL DEFAULT 'Unknown',
  session_id    TEXT,
  timestamp     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trends_geo      ON anonymous_trend_logs (user_country, user_city);
CREATE INDEX IF NOT EXISTS idx_trends_type     ON anonymous_trend_logs (event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_trends_session  ON anonymous_trend_logs (session_id);

CREATE TABLE IF NOT EXISTS outbound_clicks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT,
  tmdb_id         INTEGER,
  platform_name   TEXT,
  country         TEXT,
  trope_context   TEXT,
  filter_snapshot TEXT,                        -- JSON blob of active filters
  referral_tag    TEXT,
  timestamp       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_outbound_platform ON outbound_clicks (platform_name, country);
CREATE INDEX IF NOT EXISTS idx_outbound_tmdb     ON outbound_clicks (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_outbound_time     ON outbound_clicks (timestamp);

CREATE TABLE IF NOT EXISTS unmatched_search_queries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash      TEXT    UNIQUE NOT NULL,
  original_query  TEXT    NOT NULL,
  country         TEXT,
  frequency       INTEGER NOT NULL DEFAULT 1,
  first_seen      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_unmatched_hash ON unmatched_search_queries (query_hash);
CREATE INDEX IF NOT EXISTS idx_unmatched_freq ON unmatched_search_queries (frequency DESC);

CREATE TABLE IF NOT EXISTS filter_abandonment (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                TEXT,
  filter_sequence           TEXT,              -- JSON array of filter changes
  abandonment_point         TEXT,
  selections_before_abandon INTEGER,
  country                   TEXT,
  timestamp                 INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_abandonment_country ON filter_abandonment (country, timestamp);

CREATE TABLE IF NOT EXISTS dwell_time_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT,
  tmdb_id          INTEGER,
  duration_seconds INTEGER,
  country          TEXT,
  device_type      TEXT    CHECK (device_type IN ('mobile','tablet','desktop','unknown')),
  ip_hash          TEXT,
  timestamp        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dwell_tmdb    ON dwell_time_events (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_dwell_country ON dwell_time_events (country, timestamp);

CREATE TABLE IF NOT EXISTS trailer_playbacks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id          INTEGER,
  duration_watched INTEGER,
  completed        INTEGER NOT NULL DEFAULT 0,
  muted            INTEGER NOT NULL DEFAULT 0,
  country          TEXT,
  timestamp        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_trailer_tmdb ON trailer_playbacks (tmdb_id);

CREATE TABLE IF NOT EXISTS watchlist_adds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id         INTEGER,
  country         TEXT,
  previous_status TEXT,
  timestamp       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_wl_adds_tmdb ON watchlist_adds (tmdb_id);

CREATE TABLE IF NOT EXISTS episode_dropoffs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT,
  tmdb_id     INTEGER,
  season      INTEGER,
  episode     INTEGER,
  dropped_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  country     TEXT
);
CREATE INDEX IF NOT EXISTS idx_dropoffs_tmdb ON episode_dropoffs (tmdb_id, season);

CREATE TABLE IF NOT EXISTS consent_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT,
  consent_type TEXT    NOT NULL,
  value        TEXT    NOT NULL,
  timestamp    INTEGER NOT NULL DEFAULT (unixepoch()),
  country      TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_logs (consent_type, timestamp);

-- ============================================================
-- SECTION 6: SECURITY & RATE LIMITING
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash      TEXT    NOT NULL,
  endpoint     TEXT    NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_rate_window ON rate_limits (window_start);

CREATE TABLE IF NOT EXISTS honeypot_hits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash     TEXT    NOT NULL,
  endpoint    TEXT,
  user_agent  TEXT,
  strike_count INTEGER NOT NULL DEFAULT 1,
  banned      INTEGER NOT NULL DEFAULT 0,
  first_hit   INTEGER NOT NULL DEFAULT (unixepoch()),
  last_hit    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_honeypot_ip     ON honeypot_hits (ip_hash);
CREATE INDEX IF NOT EXISTS idx_honeypot_banned ON honeypot_hits (banned);

-- ============================================================
-- SECTION 7: B2B API ACCESS
-- ============================================================

CREATE TABLE IF NOT EXISTS b2b_api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key       TEXT    UNIQUE NOT NULL,
  customer_name TEXT    NOT NULL,
  rate_limit    INTEGER NOT NULL DEFAULT 1000,  -- requests per day
  permissions   TEXT    NOT NULL DEFAULT 'read', -- JSON array
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_b2b_key ON b2b_api_keys (api_key, active);

-- ============================================================
-- SECTION 8: CONTENT CACHE (D1 fallback when KV unavailable)
-- ============================================================

CREATE TABLE IF NOT EXISTS content_cache (
  cache_key    TEXT    NOT NULL PRIMARY KEY,
  response_body TEXT   NOT NULL,
  cached_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON content_cache (expires_at);

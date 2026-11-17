-- league-ify storage on D1 (multi-tenant).
--
-- Applied against the site's existing `dhole-workshop` D1 database, which also
-- holds the shop/admin tables. league-ify owns the four tables below; nothing
-- here touches the rest of the schema.
--
--   npx wrangler d1 execute dhole-workshop --local  --file=migrations/0001_league_ify.sql
--   npx wrangler d1 execute dhole-workshop --remote --file=migrations/0001_league_ify.sql
--
-- WHY MATCHES LIVE IN THEIR OWN TABLE
--
-- A single operator's live database was 673 KB compact, 96% of it the matches
-- array. D1 caps a single stored value and logging one game would rewrite the
-- whole blob, so the adapter splits: the document row holds seasons / goals /
-- settings, and each match is its own row. Callers never see the split.
--
-- MULTI-TENANCY
--
-- Every user gets their own private copy of every document. The adapter prefixes
-- each logical key with "u/<userId>/" (see server/storage/d1Store.ts), so one
-- user's "live" is doc_key 'u/7/live' and never collides with another's.
-- store.ts and the engine keep using the bare logical keys and never learn that
-- tenancy exists. The CHECK below just asserts the prefix is present.

CREATE TABLE IF NOT EXISTS documents (
  doc_key    TEXT PRIMARY KEY,
  body       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Production keys are tenant-scoped: 'u/<id>/live', 'u/<id>/demo',
  -- 'u/<id>/profile', 'u/<id>/meta', 'u/<id>/profiles/<key>'. The bare logical
  -- keys are also permitted so the single-tenant path (the contract test, any
  -- non-tenant use of the adapter) is valid too; the Worker always prefixes.
  CHECK (
    doc_key LIKE 'u/%'
    OR doc_key IN ('live', 'demo', 'profile', 'meta')
    OR doc_key LIKE 'profiles/%'
  ),
  CHECK (length(body) > 0)
);

CREATE TABLE IF NOT EXISTS matches (
  doc_key    TEXT    NOT NULL,
  match_id   TEXT    NOT NULL,
  -- Position in the document's matches array; the engine reads the array in
  -- order, so it has to survive the round trip.
  ord        INTEGER NOT NULL,
  body       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,

  PRIMARY KEY (doc_key, match_id),
  CHECK (length(body) > 0)
);

-- Hydration reads every match for one document, in array order.
CREATE INDEX IF NOT EXISTS idx_matches_doc ON matches (doc_key, ord);

-- ---------------------------------------------------------------------------
-- Accounts
--
-- Email + password, modeled on the site's admin_users / admin_sessions. Password
-- hashes are PBKDF2-SHA256 (server/auth.ts). Sessions are DB rows keyed by an
-- opaque random id, so logout and per-session revocation are real. The user's
-- Riot identity lives here; the Riot API *key* is a shared server secret, never
-- per-user.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lu_users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,            -- stored lowercased
  password_hash   TEXT    NOT NULL,                   -- "pbkdf2-sha256$<it>$<saltB64>$<hashB64>"
  display_name    TEXT    NOT NULL DEFAULT 'player',
  riot_game_name  TEXT,
  riot_tag_line   TEXT,
  riot_platform   TEXT,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until    INTEGER NOT NULL DEFAULT 0,         -- unix seconds; 0 = not locked
  last_login_at   INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lu_sessions (
  id           TEXT    PRIMARY KEY,                   -- 32 random bytes, base64url, opaque
  user_id      INTEGER NOT NULL REFERENCES lu_users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at   INTEGER,                               -- NULL = live. Set on logout.
  ua_hash      TEXT    NOT NULL DEFAULT ''            -- sha256(user-agent) prefix; diagnostics only
);
-- Middleware: SELECT ... WHERE id = ? AND revoked_at IS NULL AND expires_at > ?
CREATE INDEX IF NOT EXISTS idx_lu_sessions_user    ON lu_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_lu_sessions_expires ON lu_sessions (expires_at);

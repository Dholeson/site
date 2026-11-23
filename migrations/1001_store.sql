-- The store's live bench stock: one row per refurbished unit that RefurbOS
-- (the shop's bench app) has pushed here, and one row per unit sold through
-- Stripe Checkout. The contract both sides implement is described in
-- CLAUDE.md ("Live bench stock") and SETUP.md.
--
-- This is the SITE's own migration, written here. It is not vendored.
-- league-ify's build (scripts/build-site.mjs in Dholeson/league-ify) copies its
-- migrations into this folder by name and never clears it, numbered from 0001.
-- The site's own migrations are numbered from 1001 so the two sequences can
-- never collide.
--
-- Apply with `migrations apply`, never `d1 execute --file` (it records what
-- ran, so later migrations apply in order):
--
--   npx wrangler d1 migrations apply dhole-workshop --local
--   npx wrangler d1 migrations apply dhole-workshop --remote
--
-- Timestamps are ISO 8601 UTC strings from Date.prototype.toISOString(), always
-- "YYYY-MM-DDTHH:MM:SS.sssZ", so they compare correctly as text. The CHECKs
-- below hold every row to that shape, because the reservation logic compares
-- reserved_until against "now" as a string: a short GLOB for the shape, then
-- a strftime() round trip for a real date (IS, not =, so a NULL from an
-- unparseable date fails rather than passes).
--
-- D1 refuses LIKE / GLOB patterns over 50 bytes ("pattern too complex"), at
-- the first INSERT, not when the table is created. Keep every pattern here
-- shorter; test/support/d1-sqlite.js enforces the same limit.
--
-- Money is integer cents. typeof() is checked after SQLite's INTEGER affinity
-- has turned a lossless 22900.0 into 22900, so only a real fraction fails.

CREATE TABLE IF NOT EXISTS store_listings (
  -- RefurbOS inventory id lower-cased: RO-0042 -> ro-0042.
  id               TEXT PRIMARY KEY,
  inventory_id     TEXT NOT NULL UNIQUE,
  -- available: on the storefront. reserved: a buyer is in Stripe Checkout
  -- until reserved_until (after that it counts as available again).
  -- sold: paid through Stripe; final. withdrawn: pulled by the bench.
  status           TEXT NOT NULL,
  name             TEXT NOT NULL,
  platform         TEXT NOT NULL,
  category         TEXT NOT NULL,
  condition        TEXT NOT NULL,
  price_cents      INTEGER NOT NULL,
  shipping_class   TEXT NOT NULL,
  blurb            TEXT NOT NULL,
  -- JSON array of strings.
  details          TEXT NOT NULL,
  -- JSON array of "<sha256>.jpg" names, primary first. Bytes live in R2
  -- (binding STORE_IMAGES) at bench/<name>.
  images           TEXT NOT NULL,
  reserved_until   TEXT,
  -- A pending hold token ("hold_...") until Stripe answers, then the Checkout
  -- Session id ("cs_...").
  reserved_session TEXT,
  sold_at          TEXT,
  withdrawn_reason TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,

  CHECK (id GLOB 'ro-[0-9][0-9][0-9][0-9]'
      OR id GLOB 'ro-[0-9][0-9][0-9][0-9][0-9]'
      OR id GLOB 'ro-[0-9][0-9][0-9][0-9][0-9][0-9]'),
  CHECK (inventory_id = upper(id)),
  CHECK (status IN ('available', 'reserved', 'sold', 'withdrawn')),
  CHECK (category IN ('console', 'accessory')),
  CHECK (shipping_class IN ('console', 'small')),
  CHECK (typeof(price_cents) = 'integer' AND price_cents BETWEEN 100 AND 500000),
  CHECK (length(name) BETWEEN 1 AND 120),
  CHECK (length(platform) BETWEEN 1 AND 60),
  CHECK (length(condition) BETWEEN 1 AND 40),
  CHECK (length(blurb) BETWEEN 1 AND 600),
  CHECK (json_valid(details) AND json_type(details) = 'array'
         AND json_array_length(details) <= 12),
  CHECK (json_valid(images) AND json_type(images) = 'array'
         AND json_array_length(images) BETWEEN 1 AND 8),

  -- A reservation exists exactly while the status says reserved.
  CHECK ((status = 'reserved') = (reserved_until IS NOT NULL AND reserved_session IS NOT NULL)),
  CHECK (reserved_session IS NULL OR reserved_session GLOB 'hold_*' OR reserved_session GLOB 'cs_*'),
  -- sold_at is set exactly when sold; a withdrawal always has a reason.
  CHECK ((status = 'sold') = (sold_at IS NOT NULL)),
  CHECK ((status = 'withdrawn') = (withdrawn_reason IS NOT NULL)),
  CHECK (withdrawn_reason IS NULL OR withdrawn_reason IN ('sold_elsewhere', 'pulled')),

  CHECK (reserved_until IS NULL OR (reserved_until GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', reserved_until) IS reserved_until)),
  CHECK (sold_at IS NULL OR (sold_at GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', sold_at) IS sold_at)),
  CHECK (created_at GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  CHECK (updated_at GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at)
);

CREATE INDEX IF NOT EXISTS store_listings_status ON store_listings (status, updated_at);

-- One row per bench unit paid for through Stripe. RefurbOS pages through these
-- with GET /api/bench/sales?after=<sale_id>, so sale_id must only ever grow:
-- AUTOINCREMENT never hands out an id again, even after a delete.
--
-- No foreign key to store_listings on purpose: a sale is recorded whatever
-- happened to the listing meanwhile, because the money has been taken.
CREATE TABLE IF NOT EXISTS store_sales (
  sale_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id           TEXT    NOT NULL,
  inventory_id         TEXT    NOT NULL,
  -- What the buyer paid for this unit (the Checkout line's unit_amount),
  -- excluding shipping and tax.
  amount_cents         INTEGER NOT NULL,
  -- Shipping charged on the whole order, repeated on each of its units.
  order_shipping_cents INTEGER NOT NULL,
  currency             TEXT    NOT NULL,
  stripe_session_id    TEXT    NOT NULL,
  payment_intent       TEXT,
  buyer_name           TEXT,
  buyer_email          TEXT,
  -- JSON object { name, line1, line2, city, state, postal_code, country }.
  ship_to              TEXT,
  sold_at              TEXT    NOT NULL,
  created_at           TEXT    NOT NULL,

  CHECK (listing_id GLOB 'ro-[0-9][0-9][0-9][0-9]'
      OR listing_id GLOB 'ro-[0-9][0-9][0-9][0-9][0-9]'
      OR listing_id GLOB 'ro-[0-9][0-9][0-9][0-9][0-9][0-9]'),
  CHECK (inventory_id = upper(listing_id)),
  CHECK (typeof(amount_cents) = 'integer' AND amount_cents >= 0),
  CHECK (typeof(order_shipping_cents) = 'integer' AND order_shipping_cents >= 0),
  CHECK (currency GLOB '[a-z][a-z][a-z]'),
  CHECK (stripe_session_id GLOB 'cs_?*'),
  CHECK (payment_intent IS NULL OR payment_intent GLOB 'pi_?*'),
  CHECK (ship_to IS NULL OR (json_valid(ship_to) AND json_type(ship_to) = 'object')),
  CHECK (sold_at GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', sold_at) IS sold_at),
  CHECK (created_at GLOB '????-??-??T??:??:??.???Z' AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at)
);

-- A Stripe webhook can be delivered more than once; the second delivery must
-- not record the unit as sold twice.
CREATE UNIQUE INDEX IF NOT EXISTS store_sales_session_listing
  ON store_sales (stripe_session_id, listing_id);

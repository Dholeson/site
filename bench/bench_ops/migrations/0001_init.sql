-- Bench Ops appliance: initial schema.
--
-- Conventions:
--   * Every timestamp is UTC ISO-8601 with milliseconds and a Z suffix
--     (2026-11-22T10:31:00.123Z), written by the app. Fixed width, so string
--     comparison is time comparison -- the gates rely on that.
--   * Money is integer cents. STRICT tables reject a fractional value.
--   * Booleans are INTEGER 0/1 with a CHECK.
--   * Provenance tables (unit_events, listings) are append-only, enforced by
--     triggers below. Units are never deleted.
--
-- The compliance gates live in app code (bench_ops/states.py) AND as CHECK
-- constraints on `units`, so a bug or a hand-typed UPDATE still cannot put a
-- unit in `listable` without the no-preloaded-games attestation.

CREATE TABLE techs (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL
) STRICT;

CREATE TABLE units (
  id                     INTEGER PRIMARY KEY,
  intake_barcode         TEXT UNIQUE,
  received_at            TEXT NOT NULL,

  console_family         TEXT,          -- key from bench_ops/families.py
  model_revision         TEXT,
  serial_no              TEXT,
  mac_address            TEXT,

  firmware_version       TEXT,
  firmware_source        TEXT CHECK (firmware_source IN ('detected', 'entered')),
  firmware_confirmed_by  INTEGER REFERENCES techs(id),
  firmware_confirmed_at  TEXT,

  cosmetic_grade         TEXT CHECK (cosmetic_grade IN ('A', 'B', 'C')),
  cosmetic_notes         TEXT,

  -- Mod record. The appliance only RECORDS a mod a tech did by hand,
  -- following the SOP named in mod_method_ref. It never performs one.
  mod_performed          INTEGER NOT NULL DEFAULT 0 CHECK (mod_performed IN (0, 1)),
  mod_type               TEXT,
  mod_method_ref         TEXT,
  mod_by                 INTEGER REFERENCES techs(id),
  mod_at                 TEXT,
  mod_firmware           TEXT,

  has_writable_storage   INTEGER NOT NULL DEFAULT 0 CHECK (has_writable_storage IN (0, 1)),
  storage_wiped          INTEGER NOT NULL DEFAULT 0 CHECK (storage_wiped IN (0, 1)),
  storage_wipe_method    TEXT,
  storage_wiped_by       INTEGER REFERENCES techs(id),
  storage_wiped_at       TEXT,

  -- The attestation. First-class, required to reach `listable`.
  no_preloaded_games     INTEGER NOT NULL DEFAULT 0 CHECK (no_preloaded_games IN (0, 1)),
  no_preloaded_games_by  INTEGER REFERENCES techs(id),
  no_preloaded_games_at  TEXT,

  status                 TEXT NOT NULL DEFAULT 'received' CHECK (status IN
                           ('received', 'tested', 'refurbished', 'listable', 'listed', 'sold', 'failed')),
  failed_reason          TEXT,
  listing_id             TEXT UNIQUE,   -- the products.js id once exported
  sale_ref               TEXT,
  notes                  TEXT,

  CHECK (mod_performed = 0 OR (mod_type IS NOT NULL AND mod_by IS NOT NULL AND mod_at IS NOT NULL)),
  CHECK (storage_wiped = 0 OR (storage_wipe_method IS NOT NULL AND storage_wiped_by IS NOT NULL AND storage_wiped_at IS NOT NULL)),
  CHECK (no_preloaded_games = 0 OR (no_preloaded_games_by IS NOT NULL AND no_preloaded_games_at IS NOT NULL)),
  CHECK (firmware_confirmed_by IS NULL OR firmware_confirmed_at IS NOT NULL),

  -- Compliance backstops (the app checks these first, with better messages).
  CHECK (status NOT IN ('listable', 'listed', 'sold') OR no_preloaded_games = 1),
  CHECK (status NOT IN ('refurbished', 'listable', 'listed', 'sold') OR has_writable_storage = 0 OR storage_wiped = 1),
  CHECK (status NOT IN ('listed', 'sold') OR listing_id IS NOT NULL),
  CHECK (status <> 'sold' OR sale_ref IS NOT NULL),
  CHECK (status <> 'failed' OR failed_reason IS NOT NULL)
) STRICT;

CREATE INDEX units_status ON units(status);

CREATE TRIGGER units_no_delete BEFORE DELETE ON units
BEGIN
  SELECT RAISE(ABORT, 'units are never deleted; move the unit to failed with a reason');
END;

-- Append-only audit trail: who / what / when for every change to a unit.
CREATE TABLE unit_events (
  id             INTEGER PRIMARY KEY,
  unit_id        INTEGER NOT NULL REFERENCES units(id),
  at             TEXT NOT NULL,
  actor          TEXT NOT NULL,          -- tech name at the time, or system:<component>
  actor_tech_id  INTEGER REFERENCES techs(id),
  kind           TEXT NOT NULL,
  from_status    TEXT,
  to_status      TEXT,
  detail         TEXT NOT NULL DEFAULT '{}'  -- JSON
) STRICT;

CREATE INDEX unit_events_unit ON unit_events(unit_id, id);

CREATE TRIGGER unit_events_no_update BEFORE UPDATE ON unit_events
BEGIN
  SELECT RAISE(ABORT, 'unit_events is append-only');
END;

CREATE TRIGGER unit_events_no_delete BEFORE DELETE ON unit_events
BEGIN
  SELECT RAISE(ABORT, 'unit_events is append-only');
END;

-- Repair / refurb work log. Feeds the listing copy ("recapped, drive serviced").
CREATE TABLE repairs (
  id           INTEGER PRIMARY KEY,
  unit_id      INTEGER NOT NULL REFERENCES units(id),
  kind         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  done_by      INTEGER NOT NULL REFERENCES techs(id),
  done_at      TEXT NOT NULL
) STRICT;

-- QC checklist templates, one per console family. Editable; a run copies the
-- items when it starts, so editing a template never rewrites past results.
CREATE TABLE qc_templates (
  id              INTEGER PRIMARY KEY,
  console_family  TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  updated_at      TEXT NOT NULL
) STRICT;

CREATE TABLE qc_template_items (
  id           INTEGER PRIMARY KEY,
  template_id  INTEGER NOT NULL REFERENCES qc_templates(id),
  position     INTEGER NOT NULL,
  section      TEXT NOT NULL,
  label        TEXT NOT NULL,
  guidance     TEXT NOT NULL DEFAULT '',
  blocking     INTEGER NOT NULL DEFAULT 1 CHECK (blocking IN (0, 1)),
  photo_slot   TEXT CHECK (photo_slot IN ('front', 'back', 'ports', 'serial'))
) STRICT;

CREATE TABLE qc_runs (
  id              INTEGER PRIMARY KEY,
  unit_id         INTEGER NOT NULL REFERENCES units(id),
  template_id     INTEGER REFERENCES qc_templates(id),
  console_family  TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  started_by      INTEGER NOT NULL REFERENCES techs(id),
  completed_at    TEXT,
  completed_by    INTEGER REFERENCES techs(id)
) STRICT;

CREATE INDEX qc_runs_unit ON qc_runs(unit_id, id);

CREATE TABLE qc_results (
  id           INTEGER PRIMARY KEY,
  run_id       INTEGER NOT NULL REFERENCES qc_runs(id),
  position     INTEGER NOT NULL,
  section      TEXT NOT NULL,
  label        TEXT NOT NULL,
  guidance     TEXT NOT NULL,
  blocking     INTEGER NOT NULL CHECK (blocking IN (0, 1)),
  photo_slot   TEXT,
  result       TEXT CHECK (result IN ('pass', 'fail', 'na')),
  note         TEXT,
  recorded_by  INTEGER REFERENCES techs(id),
  recorded_at  TEXT
) STRICT;

CREATE INDEX qc_results_run ON qc_results(run_id, position);

-- Photos, clips and test artifacts. Only allowlisted media types get stored
-- (bench_ops/media.py); never executables, archives or disc images.
CREATE TABLE attachments (
  id             INTEGER PRIMARY KEY,
  unit_id        INTEGER NOT NULL REFERENCES units(id),
  qc_result_id   INTEGER REFERENCES qc_results(id),
  slot           TEXT CHECK (slot IN ('front', 'back', 'ports', 'serial')),
  kind           TEXT NOT NULL CHECK (kind IN ('photo', 'clip', 'artifact')),
  media_type     TEXT NOT NULL,
  stored_name    TEXT NOT NULL UNIQUE,
  original_name  TEXT,
  size_bytes     INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  uploaded_by    INTEGER NOT NULL REFERENCES techs(id),
  uploaded_at    TEXT NOT NULL
) STRICT;

CREATE INDEX attachments_unit ON attachments(unit_id, id);

-- Devices seen on the bench LAN (DHCP sniffer, or the console intake page).
CREATE TABLE devices (
  id                 INTEGER PRIMARY KEY,
  mac                TEXT UNIQUE,
  code               TEXT NOT NULL UNIQUE,   -- short code shown on the intake page
  source             TEXT NOT NULL CHECK (source IN ('dhcp', 'intake-page')),
  first_seen         TEXT NOT NULL,
  last_seen          TEXT NOT NULL,
  ip                 TEXT,
  hostname           TEXT,
  vendor_group       TEXT,                   -- nintendo / sony / microsoft
  vendor_org         TEXT,
  randomized_mac     INTEGER NOT NULL DEFAULT 0 CHECK (randomized_mac IN (0, 1)),
  dhcp_fingerprint   TEXT,                   -- option 55 parameter request list
  dhcp_vendor_class  TEXT,                   -- option 60
  user_agent         TEXT,
  ua_family          TEXT,
  ua_firmware        TEXT,
  family_hint        TEXT,
  unit_id            INTEGER REFERENCES units(id),
  ignored            INTEGER NOT NULL DEFAULT 0 CHECK (ignored IN (0, 1))
) STRICT;

-- DHCP fingerprint -> family, learned when a tech attaches a device to a unit
-- whose family is set. Starts empty: no guessed fingerprints shipped.
CREATE TABLE fingerprint_hints (
  fingerprint        TEXT PRIMARY KEY,
  console_family     TEXT NOT NULL,
  learned_at         TEXT NOT NULL,
  learned_from_unit  INTEGER REFERENCES units(id)
) STRICT;

-- Working copy of a listing before export.
CREATE TABLE listing_drafts (
  unit_id      INTEGER PRIMARY KEY REFERENCES units(id),
  name         TEXT NOT NULL,
  price_cents  INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  condition    TEXT NOT NULL CHECK (condition IN ('refurbished', 'used-good', 'used-fair')),
  blurb        TEXT NOT NULL,
  details      TEXT NOT NULL,                -- one detail per line
  updated_at   TEXT NOT NULL,
  updated_by   INTEGER REFERENCES techs(id)
) STRICT;

-- Exported listings, exactly as handed to the operator. Append-only.
CREATE TABLE listings (
  id            INTEGER PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id),
  product_id    TEXT NOT NULL,
  product_json  TEXT NOT NULL,
  price_cents   INTEGER NOT NULL CHECK (price_cents > 0),
  photo_id      INTEGER NOT NULL REFERENCES attachments(id),
  exported_at   TEXT NOT NULL,
  exported_by   INTEGER NOT NULL REFERENCES techs(id)
) STRICT;

CREATE TRIGGER listings_no_update BEFORE UPDATE ON listings
BEGIN
  SELECT RAISE(ABORT, 'listings is append-only');
END;

CREATE TRIGGER listings_no_delete BEFORE DELETE ON listings
BEGIN
  SELECT RAISE(ABORT, 'listings is append-only');
END;

-- The pixel size of each bench photo, so a product page's link preview can
-- declare og:image:width and og:image:height, and can swap in the generic
-- card (og-site.png, 1200x630) when photo 1 is under 900 px wide, which
-- iMessage won't show as a large image. lib/seo.js productHead makes that
-- choice.
--
-- One row per photo, keyed by its R2 name: "<sha256>.jpg", 64 hex digits and
-- ".jpg", so 68 characters. The bytes behind a name never change, so neither
-- does its size. Rows are written by PUT /api/bench/images/<name>.jpg
-- (lib/jpeg-size.js reads the JPEG's frame header, with EXIF rotation
-- applied), including for a photo RefurbOS re-sends that is already in R2,
-- and backfilled by functions/product.js for photos uploaded before this
-- table existed.
--
-- Nothing in the RefurbOS contract changes: no bench API response carries
-- these sizes. A photo with no row here, or a database without this table,
-- gets the preview it had before: the photo, with no declared size.
--
-- This is the SITE's own migration, written here. It is not vendored. The
-- site's own migrations are numbered from 1001 so they never collide with
-- league-ify's, which its build copies into this folder from 0001.
--
-- Apply with `migrations apply`, never `d1 execute --file` (it records what
-- ran, so later migrations apply in order):
--
--   npx wrangler d1 migrations apply dhole-workshop --local
--   npx wrangler d1 migrations apply dhole-workshop --remote
--
-- No pattern matching here: lib/store-db.js checks a name's shape
-- (IMAGE_NAME) before it writes, and the table holds only its length.

CREATE TABLE IF NOT EXISTS store_images (
  name   TEXT PRIMARY KEY CHECK (length(name) = 68),
  width  INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0)
);

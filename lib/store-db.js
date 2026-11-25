// Live bench stock in D1 (binding DB): the store_listings and store_sales
// tables from migrations/1001_store.sql.
//
// RefurbOS, the shop's bench app, pushes each refurbished unit it lists here
// (one unit = one listing = stock 1) and pulls back the sales Stripe makes.
// For bench units this database is the truth; data/products.js stays the
// truth for the hand-made catalogue. Shared by the bench API, the public store
// API, checkout and the Stripe webhook.
//
// Timestamps are toISOString() strings, so they compare correctly as text.
// Money is integer cents.

// ---------- identity ----------

// A listing id is the RefurbOS inventory id lower-cased: RO-0042 -> ro-0042.
export const LISTING_ID = /^ro-[0-9]{4,6}$/;
export const INVENTORY_ID = /^RO-[0-9]{4,6}$/;
// Any cart id in the bench namespace. A cart id that matches this is never
// looked up in data/products.js (whose ids never match it), and must also
// match LISTING_ID to be a real listing.
export const BENCH_CART_ID = /^ro-\d+$/;
export const IMAGE_NAME = /^[0-9a-f]{64}\.jpg$/;

export const isBenchId = id => typeof id === "string" && BENCH_CART_ID.test(id);

export const imageKey = name => `bench/${name}`;
export const imageUrl = name => `/api/store/img/${name}`;
export const productUrl = id => `/product?id=${id}`;

export const nowIso = (ms = Date.now()) => new Date(ms).toISOString();

// How long a checkout holds a bench unit, and the Stripe session's expires_at.
// Stripe's minimum is 30 minutes after Stripe creates the session, which is a
// moment after this code computes the time; one extra minute keeps network
// latency and clock skew from putting expires_at under Stripe's minimum. The
// hold and the session always end at the same second.
export const HOLD_SECONDS = 31 * 60;

// ---------- validating a pushed listing ----------

export const LIMITS = {
  name: 120, platform: 60, condition: 40, blurb: 600,
  details: 12, detail: 200, images: 8,
  priceMin: 100, priceMax: 500000
};

const CATEGORIES = ["console", "accessory"];
const SHIPPING_CLASSES = ["console", "small"];
export const WITHDRAW_REASONS = ["sold_elsewhere", "pulled"];

// Single-line fields refuse every control character; the blurb may keep line
// breaks and tabs.
const CONTROL_LINE = /[\u0000-\u001f\u007f]/;
const CONTROL_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function fail(field, error) {
  return { field, error };
}

// Lengths are JavaScript string lengths (UTF-16 code units), which are never
// fewer than the characters SQLite's length() counts, so anything accepted here
// also passes the table's CHECKs.
function text(value, field, max, { multiline = false } = {}) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    return fail(field, `${field} must be text of 1 to ${max} characters.`);
  }
  if ((multiline ? CONTROL_TEXT : CONTROL_LINE).test(value)) {
    return fail(field, `${field} contains a control character.`);
  }
  return null;
}

function oneOf(value, field, options) {
  if (!options.includes(value)) {
    return fail(field, `${field} must be ${options.map(o => `"${o}"`).join(" or ")}.`);
  }
  return null;
}

// Returns { listing } or { field, error }. Unknown fields are ignored.
export function validateListing(id, body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return fail("body", "The body must be a JSON object.");
  }

  const inv = body.inventory_id;
  if (typeof inv !== "string" || !INVENTORY_ID.test(inv) || inv.toLowerCase() !== id) {
    return fail("inventory_id", `inventory_id must be "${id.toUpperCase()}" to match the listing id ${id}.`);
  }

  const checks = [
    () => text(body.name, "name", LIMITS.name),
    () => text(body.platform, "platform", LIMITS.platform),
    () => oneOf(body.category, "category", CATEGORIES),
    () => text(body.condition, "condition", LIMITS.condition),
    () => (typeof body.price_cents === "number" && Number.isInteger(body.price_cents)
            && body.price_cents >= LIMITS.priceMin && body.price_cents <= LIMITS.priceMax)
      ? null
      : fail("price_cents", `price_cents must be a whole number of cents from ${LIMITS.priceMin} to ${LIMITS.priceMax}.`),
    () => oneOf(body.shipping_class, "shipping_class", SHIPPING_CLASSES),
    () => text(body.blurb, "blurb", LIMITS.blurb, { multiline: true }),
    () => {
      const d = body.details;
      if (!Array.isArray(d) || d.length > LIMITS.details) {
        return fail("details", `details must be a list of 0 to ${LIMITS.details} lines.`);
      }
      for (let i = 0; i < d.length; i++) {
        if (text(d[i], "details", LIMITS.detail)) {
          return fail("details", `details[${i}] must be text of 1 to ${LIMITS.detail} characters, with no control characters.`);
        }
      }
      return null;
    },
    () => {
      const im = body.images;
      if (!Array.isArray(im) || im.length < 1 || im.length > LIMITS.images) {
        return fail("images", `images must list 1 to ${LIMITS.images} photos, the primary first.`);
      }
      for (let i = 0; i < im.length; i++) {
        if (typeof im[i] !== "string" || !IMAGE_NAME.test(im[i])) {
          return fail("images", `images[${i}] must be "<sha256 in lower-case hex>.jpg".`);
        }
      }
      if (new Set(im).size !== im.length) return fail("images", "images lists the same photo twice.");
      return null;
    }
  ];
  for (const check of checks) {
    const bad = check();
    if (bad) return bad;
  }

  return {
    listing: {
      id,
      inventory_id: inv,
      name: body.name,
      platform: body.platform,
      category: body.category,
      condition: body.condition,
      price_cents: body.price_cents,
      shipping_class: body.shipping_class,
      blurb: body.blurb,
      details: [...body.details],
      images: [...body.images]
    }
  };
}

// ---------- status ----------

// A reservation whose reserved_until has passed counts as available
// everywhere: the storefront, checkout, withdraw and the bench's listing.
export function effectiveStatus(row, now) {
  if (row.status === "reserved" && !(row.reserved_until > now)) return "available";
  return row.status;
}

const EFFECTIVE_STATUS_SQL = "CASE WHEN status = 'reserved' AND reserved_until <= ?1 THEN 'available' ELSE status END";
const REACHABLE_SQL = "(status = 'available' OR (status = 'reserved' AND reserved_until <= ?1))";

function parseArray(textValue) {
  try {
    const v = JSON.parse(textValue);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------- the bench's side ----------

export async function getListing(db, id) {
  return db.prepare("SELECT * FROM store_listings WHERE id = ?1").bind(id).first();
}

// Creates or updates a listing in one statement. new -> available;
// withdrawn -> available (re-listed); available / reserved -> copy, price and
// images updated, status unchanged; sold -> nothing changes.
// Returns { row } on success, { sold: row } when the unit has already sold.
export async function upsertListing(db, listing, now) {
  await db.prepare(`
    INSERT INTO store_listings
      (id, inventory_id, status, name, platform, category, condition, price_cents,
       shipping_class, blurb, details, images, created_at, updated_at)
    VALUES (?1, ?2, 'available', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      platform = excluded.platform,
      category = excluded.category,
      condition = excluded.condition,
      price_cents = excluded.price_cents,
      shipping_class = excluded.shipping_class,
      blurb = excluded.blurb,
      details = excluded.details,
      images = excluded.images,
      status = CASE WHEN store_listings.status = 'withdrawn' THEN 'available' ELSE store_listings.status END,
      withdrawn_reason = NULL,
      updated_at = excluded.updated_at
    WHERE store_listings.status <> 'sold'
  `).bind(
    listing.id, listing.inventory_id, listing.name, listing.platform, listing.category,
    listing.condition, listing.price_cents, listing.shipping_class, listing.blurb,
    JSON.stringify(listing.details), JSON.stringify(listing.images), now
  ).run();

  const row = await getListing(db, listing.id);
  if (row && row.status === "sold") return { sold: row };
  return { row };
}

// available (or an expired hold) -> withdrawn. Returns
// { row, changed } where row is the listing after the attempt (null: no such
// listing) and changed says whether this call withdrew it.
export async function withdrawListing(db, id, reason, now) {
  const res = await db.prepare(`
    UPDATE store_listings
       SET status = 'withdrawn', withdrawn_reason = ?2,
           reserved_until = NULL, reserved_session = NULL, updated_at = ?1
     WHERE id = ?3 AND ${REACHABLE_SQL}
  `).bind(now, reason, id).run();
  const row = await getListing(db, id);
  return { row, changed: (res.meta?.changes ?? 0) > 0 };
}

export async function benchListings(db, now) {
  const { results } = await db.prepare(`
    SELECT id, inventory_id, ${EFFECTIVE_STATUS_SQL} AS status, price_cents, updated_at, sold_at
      FROM store_listings
     ORDER BY created_at DESC, id DESC
  `).bind(now).all();
  return results.map(r => ({
    id: r.id,
    inventory_id: r.inventory_id,
    status: r.status,
    price_cents: r.price_cents,
    updated_at: r.updated_at,
    sold_at: r.sold_at ?? null
  }));
}

export const SALES_PAGE = 100;

export async function salesAfter(db, after) {
  const { results } = await db.prepare(
    "SELECT * FROM store_sales WHERE sale_id > ?1 ORDER BY sale_id ASC LIMIT ?2"
  ).bind(after, SALES_PAGE + 1).all();
  const page = results.slice(0, SALES_PAGE);
  return {
    sales: page.map(r => ({
      sale_id: r.sale_id,
      listing_id: r.listing_id,
      inventory_id: r.inventory_id,
      amount_cents: r.amount_cents,
      order_shipping_cents: r.order_shipping_cents,
      currency: r.currency,
      stripe_session_id: r.stripe_session_id,
      payment_intent: r.payment_intent ?? null,
      buyer_name: r.buyer_name ?? null,
      buyer_email: r.buyer_email ?? null,
      ship_to: r.ship_to ? JSON.parse(r.ship_to) : null,
      sold_at: r.sold_at
    })),
    more: results.length > SALES_PAGE
  };
}

// ---------- the storefront's side ----------

// A listing in the same shape as a data/products.js entry, so the storefront
// and checkout treat both the same way. Nothing else leaves the database:
// no inventory_id, reservation, timestamps or sales.
export function toProduct(row) {
  const images = parseArray(row.images).map(imageUrl);
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    category: row.category,
    condition: row.condition,
    priceCents: row.price_cents,
    stock: 1,
    shippingClass: row.shipping_class,
    image: images[0],
    images,
    blurb: row.blurb,
    details: parseArray(row.details),
    source: "bench"
  };
}

export async function publicListings(db, now) {
  const { results } = await db.prepare(`
    SELECT * FROM store_listings WHERE ${REACHABLE_SQL} ORDER BY created_at DESC, id DESC
  `).bind(now).all();
  return results.map(toProduct);
}

// For the sitemap: every unit with a page worth indexing (on sale, or held by
// a checkout that may yet lapse), with its photos and last change. Sold and
// withdrawn units are left out; their pages answer 410 / 404.
export async function sitemapListings(db) {
  const { results } = await db.prepare(`
    SELECT id, images, updated_at FROM store_listings
     WHERE status IN ('available', 'reserved') ORDER BY created_at DESC, id DESC
  `).all();
  return results.map(r => ({ id: r.id, images: parseArray(r.images).map(imageUrl), updatedAt: r.updated_at }));
}

// ---------- checkout ----------

// id -> { product, status, reservedUntil } for the given listing ids.
export async function loadForCheckout(db, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const marks = ids.map((_, i) => `?${i + 1}`).join(", ");
  const { results } = await db.prepare(`SELECT * FROM store_listings WHERE id IN (${marks})`)
    .bind(...ids).all();
  for (const row of results) {
    out.set(row.id, { product: toProduct(row), status: row.status, reservedUntil: row.reserved_until });
  }
  return out;
}

// Holds every listed unit for one checkout, or none of them. One UPDATE: it
// only touches rows when the count of reachable units among `ids` equals
// ids.length, and SQLite evaluates that uncorrelated count once, before it
// changes any row. D1 runs each statement atomically, so two checkouts racing
// for the same unit cannot both win. Returns true when all were held.
export async function reserveUnits(db, ids, holdToken, until, now) {
  const n = ids.length;
  const marks = ids.map((_, i) => `?${i + 4}`).join(", ");
  const res = await db.prepare(`
    UPDATE store_listings
       SET status = 'reserved', reserved_until = ?2, reserved_session = ?3
     WHERE id IN (${marks})
       AND ${REACHABLE_SQL}
       AND (SELECT count(*) FROM store_listings WHERE id IN (${marks}) AND ${REACHABLE_SQL}) = ${n}
  `).bind(now, until, holdToken, ...ids).run();
  const changed = res.meta?.changes ?? 0;
  if (changed === n) return true;
  // Can't happen with one statement, but never leave part of an order held.
  if (changed > 0) await releaseHolds(db, [holdToken]);
  return false;
}

// Once Stripe has answered, the hold is keyed by the Checkout Session id.
export async function attachSession(db, holdToken, sessionId) {
  await db.prepare(`
    UPDATE store_listings SET reserved_session = ?1
     WHERE status = 'reserved' AND reserved_session = ?2
  `).bind(sessionId, holdToken).run();
}

// Releases whatever is still held under any of these keys (a hold token or a
// Checkout Session id). A unit that has sold or been re-held since is not
// touched: its status or reserved_session no longer matches.
export async function releaseHolds(db, keys) {
  const list = keys.filter(k => typeof k === "string" && k);
  if (!list.length) return 0;
  const marks = list.map((_, i) => `?${i + 1}`).join(", ");
  const res = await db.prepare(`
    UPDATE store_listings SET status = 'available', reserved_until = NULL, reserved_session = NULL
     WHERE status = 'reserved' AND reserved_session IN (${marks})
  `).bind(...list).run();
  return res.meta?.changes ?? 0;
}

// ---------- sales (from the Stripe webhook) ----------

// One store_sales row per unit and the listing marked sold, in one batch (D1
// runs a batch as a transaction). Idempotent on (stripe_session_id,
// listing_id): a redelivered webhook adds nothing and keeps the first sold_at.
// A listing withdrawn meanwhile is still marked sold, because the money has
// been taken and the owner must see it. sale.units: [{ listingId, amountCents }].
export async function recordSales(db, sale, now) {
  const statements = [];
  for (const { listingId, amountCents } of sale.units) {
    statements.push(db.prepare(`
      INSERT INTO store_sales
        (listing_id, inventory_id, amount_cents, order_shipping_cents, currency,
         stripe_session_id, payment_intent, buyer_name, buyer_email, ship_to, sold_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT (stripe_session_id, listing_id) DO NOTHING
    `).bind(
      listingId, listingId.toUpperCase(), amountCents, sale.shippingCents, sale.currency,
      sale.sessionId, sale.paymentIntent, sale.buyerName, sale.buyerEmail,
      sale.shipTo ? JSON.stringify(sale.shipTo) : null, sale.soldAt, now
    ));
    statements.push(db.prepare(`
      UPDATE store_listings
         SET status = 'sold', sold_at = ?1, reserved_until = NULL, reserved_session = NULL,
             withdrawn_reason = NULL, updated_at = ?2
       WHERE id = ?3 AND status <> 'sold'
    `).bind(sale.soldAt, now, listingId));
  }
  if (statements.length) await db.batch(statements);
}

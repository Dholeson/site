// Tests for the bench API (functions/api/bench/[[path]].js): the endpoints
// RefurbOS calls to push units to the store and pull back sales. Runs the
// Function's onRequest directly against a D1 stand-in over node:sqlite (every
// file in migrations/ applied) and an in-memory R2.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { harness } from "./support/harness.js";
import {
  TOKEN, makeEnv, call, jpeg, imageName, seedImages, listingBody, pushListing, row,
  holdDirect, iso, spyTimingSafeEqual
} from "./support/store-fixtures.js";

const { section, test, run } = harness();

// ---------- auth ----------

section("bench API: auth");

test("503 with the contract's message when BENCH_TOKEN is unset, short or blank", async () => {
  for (const BENCH_TOKEN of [undefined, "", "x".repeat(31), " ".repeat(40)]) {
    const env = makeEnv({ BENCH_TOKEN });
    const r = await call(bench, env, "GET", "/api/bench/listings", { token: "x".repeat(31) });
    assert.equal(r.status, 503, `BENCH_TOKEN=${JSON.stringify(BENCH_TOKEN)}`);
    assert.deepEqual(r.json, { error: "Bench API is not configured." });
  }
});

test("401 with a JSON error for no token, a wrong token, or another scheme", async () => {
  const env = makeEnv();
  const cases = [
    {},
    { token: "y".repeat(TOKEN.length) },
    { token: TOKEN + "x" },
    { token: TOKEN.slice(0, -1) },
    { headers: { Authorization: `Basic ${TOKEN}` } },
    { headers: { Authorization: `Bearer` } }
  ];
  for (const c of cases) {
    const r = await call(bench, env, "GET", "/api/bench/listings", c);
    assert.equal(r.status, 401, JSON.stringify(c));
    assert.equal(typeof r.json.error, "string");
    assert.deepEqual(Object.keys(r.json), ["error"]);
  }
});

test("auth runs before routing: an unknown path is 401, not 404, without the token", async () => {
  const r = await call(bench, makeEnv(), "GET", "/api/bench/nope");
  assert.equal(r.status, 401);
});

test("the token is compared with crypto.subtle.timingSafeEqual on equal-length buffers only", async () => {
  const spy = spyTimingSafeEqual();
  try {
    const env = makeEnv();
    let r = await call(bench, env, "GET", "/api/bench/listings", { token: "z".repeat(TOKEN.length) });
    assert.equal(r.status, 401);
    assert.deepEqual(spy.calls, [[TOKEN.length, TOKEN.length]], "same length: one constant-time compare");

    spy.calls.length = 0;
    r = await call(bench, env, "GET", "/api/bench/listings", { token: TOKEN + "extra" });
    assert.equal(r.status, 401);
    assert.deepEqual(spy.calls, [], "different lengths never match and are never compared");

    r = await call(bench, env, "GET", "/api/bench/listings", { token: TOKEN });
    assert.equal(r.status, 200);
    assert.deepEqual(spy.calls, [[TOKEN.length, TOKEN.length]]);
  } finally {
    spy.restore();
  }
});

test("a configured token with a trailing newline (piped into wrangler) still matches", async () => {
  const r = await call(bench, makeEnv({ BENCH_TOKEN: `${TOKEN}\n` }), "GET", "/api/bench/listings", { token: TOKEN });
  assert.equal(r.status, 200);
});

// ---------- images ----------

section("bench API: PUT /api/bench/images/<sha256>.jpg");

const putImage = (env, name, bytes, headers = { "Content-Type": "image/jpeg" }) =>
  call(bench, env, "PUT", `/api/bench/images/${name}`, { token: TOKEN, body: bytes, headers });

test("a new photo is stored at bench/<sha>.jpg: 201 with its name and public URL", async () => {
  const env = makeEnv();
  const bytes = jpeg("new");
  const name = imageName(bytes);
  const r = await putImage(env, name, bytes);
  assert.equal(r.status, 201);
  assert.deepEqual(r.json, { name, url: `/api/store/img/${name}` });
  const stored = env.STORE_IMAGES.objects.get(`bench/${name}`);
  assert.ok(stored, "not in R2");
  assert.deepEqual([...stored.bytes], [...bytes]);
  assert.equal(stored.httpMetadata.contentType, "image/jpeg");
});

test("idempotent: the same photo again is 200 and isn't written twice", async () => {
  const env = makeEnv();
  const bytes = jpeg("again");
  const name = imageName(bytes);
  assert.equal((await putImage(env, name, bytes)).status, 201);
  const r = await putImage(env, name, bytes);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { name, url: `/api/store/img/${name}` });
  assert.equal(env.STORE_IMAGES.ops.filter(([op]) => op === "put").length, 1);
});

test("a body whose SHA-256 doesn't match the name is 400, and nothing is stored", async () => {
  const env = makeEnv();
  const r = await putImage(env, imageName(jpeg("one")), jpeg("two"));
  assert.equal(r.status, 400);
  assert.match(r.json.error, /SHA-256/);
  assert.equal(env.STORE_IMAGES.objects.size, 0);
});

test("a body that doesn't start FF D8 FF is 415, even with the right hash", async () => {
  const env = makeEnv();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const r = await putImage(env, imageName(png), png);
  assert.equal(r.status, 415);
  assert.match(r.json.error, /JPEG/);
  assert.equal(env.STORE_IMAGES.objects.size, 0);
});

test("2,000,000 bytes is accepted; one more is 413 (declared or streamed)", async () => {
  const env = makeEnv();
  const max = jpeg("max", 2_000_000);
  assert.equal((await putImage(env, imageName(max), max)).status, 201);

  const over = jpeg("over", 2_000_001);
  const r = await putImage(env, imageName(over), over);
  assert.equal(r.status, 413);

  // No Content-Length: the stream is cut off at the cap.
  const stream = new Blob([over]).stream();
  const request = new Request(`https://dhole.dev/api/bench/images/${imageName(over)}`, {
    method: "PUT", body: stream, duplex: "half",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "image/jpeg" }
  });
  assert.equal(request.headers.get("Content-Length"), null);
  const res = await bench({ request, env });
  assert.equal(res.status, 413);
  assert.equal(env.STORE_IMAGES.objects.size, 1);
});

test("the name must be lower-case hex SHA-256 + .jpg (400), and the type image/jpeg (415)", async () => {
  const env = makeEnv();
  const bytes = jpeg("names");
  const sha = imageName(bytes).slice(0, 64);
  for (const bad of [sha.toUpperCase() + ".jpg", sha + ".jpeg", sha.slice(1) + ".jpg", "x.jpg"]) {
    assert.equal((await putImage(env, bad, bytes)).status, 400, bad);
  }
  assert.equal((await putImage(env, imageName(bytes), bytes, { "Content-Type": "image/png" })).status, 415);
  assert.equal((await putImage(env, imageName(bytes), bytes, {})).status, 415);
});

test("only PUT: GET on an image path is 405 with Allow", async () => {
  const r = await call(bench, makeEnv(), "GET", `/api/bench/images/${imageName(jpeg())}`, { token: TOKEN });
  assert.equal(r.status, 405);
  assert.equal(r.res.headers.get("Allow"), "PUT");
});

test("503 when the STORE_IMAGES binding is missing", async () => {
  const bytes = jpeg();
  const r = await putImage(makeEnv({ STORE_IMAGES: undefined }), imageName(bytes), bytes);
  assert.equal(r.status, 503);
});

// ---------- listings: upsert ----------

section("bench API: PUT /api/bench/listings/<id>");

test("a new listing is available: 200 { id, status, updated_at, url }", async () => {
  const env = makeEnv();
  const r = await pushListing(bench, env, "ro-0042");
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["id", "status", "updated_at", "url"]);
  assert.equal(r.json.id, "ro-0042");
  assert.equal(r.json.status, "available");
  assert.equal(r.json.url, "/product?id=ro-0042");
  assert.match(r.json.updated_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  const saved = row(env, "ro-0042");
  assert.equal(saved.inventory_id, "RO-0042");
  assert.equal(saved.price_cents, 22900);
  assert.equal(JSON.parse(saved.images).length, 2);
});

// Each field the contract lists, with values that must be refused. Every one
// is a 400 that names the field.
const BAD = {
  inventory_id: [undefined, "RO-0043", "ro-0042", "RO-42", 42],
  name: [undefined, "", "   ", "x".repeat(121), 7, "line\nbreak"],
  platform: [undefined, "", "x".repeat(61), ["PS4"]],
  category: [undefined, "game", "Console", ""],
  condition: [undefined, "", "x".repeat(41)],
  price_cents: [undefined, 99, 500001, 229.5, "22900", null, -100, Infinity],
  shipping_class: [undefined, "large", "Console"],
  blurb: [undefined, "", "x".repeat(601), "tab\u0000nul"],
  details: [undefined, "one line", Array(13).fill("x"), ["x".repeat(201)], [""], [3], ["ok", null]],
  images: [undefined, [], "abc.jpg", Array(9).fill("x"), ["ABC.jpg"], [123]]
};

test("every field is validated: a bad value is a 400 naming the field", async () => {
  const env = makeEnv();
  const images = await seedImages(env, "v1");
  for (const [field, values] of Object.entries(BAD)) {
    for (const value of values) {
      const body = listingBody("ro-0042", images);
      if (value === undefined) delete body[field];
      else body[field] = value;
      const r = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", { token: TOKEN, body });
      assert.equal(r.status, 400, `${field}=${JSON.stringify(value)} should be refused`);
      assert.equal(r.json.field, field, `${field}=${JSON.stringify(value)}`);
      assert.match(r.json.error, new RegExp(field), `the error should name ${field}`);
    }
  }
  assert.equal(row(env, "ro-0042"), null, "nothing was written");
});

test("the edges of each limit are accepted", async () => {
  const env = makeEnv();
  const images = await seedImages(env, 1, 2, 3, 4, 5, 6, 7, 8);
  const r = await call(bench, env, "PUT", "/api/bench/listings/ro-123456", {
    token: TOKEN,
    body: listingBody("ro-123456", images, {
      name: "n".repeat(120), platform: "p".repeat(60), condition: "c".repeat(40),
      blurb: "b".repeat(600), details: Array(12).fill("d".repeat(200)),
      price_cents: 500000, category: "accessory", shipping_class: "small"
    })
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const lo = await call(bench, env, "PUT", "/api/bench/listings/ro-0001", {
    token: TOKEN, body: listingBody("ro-0001", images.slice(0, 1), { price_cents: 100, details: [] })
  });
  assert.equal(lo.status, 200, JSON.stringify(lo.json));
});

test("duplicate photos in images are refused", async () => {
  const env = makeEnv();
  const [a] = await seedImages(env, "dup");
  const r = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", {
    token: TOKEN, body: listingBody("ro-0042", [a, a])
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.field, "images");
});

test("unknown fields are ignored", async () => {
  const env = makeEnv();
  const images = await seedImages(env, "u");
  const r = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", {
    token: TOKEN, body: { ...listingBody("ro-0042", images), colour: "red", stock: 5, status: "sold" }
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "available");
});

test("a photo not yet in R2 is 400 with the missing names", async () => {
  const env = makeEnv();
  const [have] = await seedImages(env, "have");
  const absent = imageName(jpeg("absent"));
  const r = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", {
    token: TOKEN, body: listingBody("ro-0042", [have, absent])
  });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json.missing, [absent]);
  assert.equal(typeof r.json.error, "string");
  assert.equal(row(env, "ro-0042"), null);
});

test("a malformed id in the path is 400; a body that isn't JSON is 400", async () => {
  const env = makeEnv();
  const images = await seedImages(env, "i");
  for (const id of ["RO-0042", "ro-42", "ro-1234567", "ro-00a2", "x"]) {
    const r = await call(bench, env, "PUT", `/api/bench/listings/${id}`, {
      token: TOKEN, body: listingBody("ro-0042", images)
    });
    assert.equal(r.status, 400, id);
  }
  const r = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", {
    token: TOKEN, body: "{not json", headers: { "Content-Type": "application/json" }
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.field, "body");
  const arr = await call(bench, env, "PUT", "/api/bench/listings/ro-0042", { token: TOKEN, body: [1] });
  assert.equal(arr.status, 400);
});

section("bench API: listing status transitions");

test("available -> PUT again: copy and price updated, still available", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const r = await pushListing(bench, env, "ro-0042", { price_cents: 19900, name: "Cheaper now" });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "available");
  const saved = row(env, "ro-0042");
  assert.equal(saved.price_cents, 19900);
  assert.equal(saved.name, "Cheaper now");
});

test("withdrawn -> PUT: re-listed as available", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  await call(bench, env, "POST", "/api/bench/listings/ro-0042/withdraw", { token: TOKEN, body: { reason: "pulled" } });
  assert.equal(row(env, "ro-0042").status, "withdrawn");
  const r = await pushListing(bench, env, "ro-0042");
  assert.equal(r.json.status, "available");
  assert.equal(row(env, "ro-0042").withdrawn_reason, null);
});

test("reserved -> PUT: copy and price updated, the hold untouched", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const until = Date.now() + 20 * 60_000;
  holdDirect(env, "ro-0042", "cs_test_live", until);
  const r = await pushListing(bench, env, "ro-0042", { price_cents: 20900 });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "reserved");
  const saved = row(env, "ro-0042");
  assert.equal(saved.status, "reserved");
  assert.equal(saved.reserved_session, "cs_test_live");
  assert.equal(saved.reserved_until, iso(until));
  assert.equal(saved.price_cents, 20900);
});

test("sold -> PUT: 409 { status: 'sold' } and nothing changes", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0042'").run(iso(Date.now()));
  const before = row(env, "ro-0042");
  const r = await pushListing(bench, env, "ro-0042", { price_cents: 100, name: "Changed" });
  assert.equal(r.status, 409);
  assert.equal(r.json.status, "sold");
  assert.equal(typeof r.json.error, "string");
  assert.deepEqual(row(env, "ro-0042"), before);
});

// ---------- withdraw ----------

section("bench API: POST /api/bench/listings/<id>/withdraw");

const withdraw = (env, id, reason = "sold_elsewhere") =>
  call(bench, env, "POST", `/api/bench/listings/${id}/withdraw`, { token: TOKEN, body: { reason } });

test("available -> withdrawn; again is 200 too (idempotent)", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  let r = await withdraw(env, "ro-0042");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { id: "ro-0042", status: "withdrawn" });
  assert.equal(row(env, "ro-0042").withdrawn_reason, "sold_elsewhere");
  r = await withdraw(env, "ro-0042", "pulled");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { id: "ro-0042", status: "withdrawn" });
});

test("a live hold (a buyer is in Checkout) is 409 with reserved_until; nothing changes", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const until = Date.now() + 10 * 60_000;
  holdDirect(env, "ro-0042", "cs_test_buyer", until);
  const r = await withdraw(env, "ro-0042");
  assert.equal(r.status, 409);
  assert.equal(r.json.status, "reserved");
  assert.equal(r.json.reserved_until, iso(until));
  assert.equal(typeof r.json.error, "string");
  assert.equal(row(env, "ro-0042").status, "reserved");
});

test("an expired hold counts as available: withdrawn, hold cleared", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  holdDirect(env, "ro-0042", "cs_test_gone", Date.now() - 1000);
  const r = await withdraw(env, "ro-0042");
  assert.equal(r.status, 200);
  const saved = row(env, "ro-0042");
  assert.equal(saved.status, "withdrawn");
  assert.equal(saved.reserved_session, null);
  assert.equal(saved.reserved_until, null);
});

test("sold is 409 { status: 'sold' }; an unknown id is 404", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0042'").run(iso(Date.now()));
  let r = await withdraw(env, "ro-0042");
  assert.equal(r.status, 409);
  assert.equal(r.json.status, "sold");
  r = await withdraw(env, "ro-9999");
  assert.equal(r.status, 404);
  assert.equal(typeof r.json.error, "string");
});

test("the reason must be sold_elsewhere or pulled; only POST", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  for (const body of [{}, { reason: "bored" }, { reason: null }, "x"]) {
    const r = await call(bench, env, "POST", "/api/bench/listings/ro-0042/withdraw", { token: TOKEN, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(row(env, "ro-0042").status, "available");
  const r = await call(bench, env, "GET", "/api/bench/listings/ro-0042/withdraw", { token: TOKEN });
  assert.equal(r.status, 405);
});

// ---------- the bench's view ----------

section("bench API: GET /api/bench/listings and /api/bench/sales");

test("every listing, every status, newest first, in the contract's shape", async () => {
  const env = makeEnv();
  for (const id of ["ro-0001", "ro-0002", "ro-0003", "ro-0004", "ro-0005"]) await pushListing(bench, env, id);
  // Distinct creation times, oldest first.
  ["ro-0001", "ro-0002", "ro-0003", "ro-0004", "ro-0005"].forEach((id, i) => {
    env.DB.raw.prepare("UPDATE store_listings SET created_at = ? WHERE id = ?").run(iso(Date.UTC(2026, 10, 1 + i)), id);
  });
  await withdraw(env, "ro-0002");
  holdDirect(env, "ro-0003", "cs_test_a", Date.now() + 600_000);
  holdDirect(env, "ro-0004", "cs_test_b", Date.now() - 1000);       // expired: counts as available
  const soldAt = iso(Date.now());
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0005'").run(soldAt);

  const r = await call(bench, env, "GET", "/api/bench/listings", { token: TOKEN });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.listings.map(l => [l.id, l.status]), [
    ["ro-0005", "sold"], ["ro-0004", "available"], ["ro-0003", "reserved"],
    ["ro-0002", "withdrawn"], ["ro-0001", "available"]
  ]);
  for (const l of r.json.listings) {
    assert.deepEqual(Object.keys(l).sort(), ["id", "inventory_id", "price_cents", "sold_at", "status", "updated_at"]);
    assert.equal(l.inventory_id, l.id.toUpperCase());
  }
  assert.equal(r.json.listings[0].sold_at, soldAt);
  assert.equal(r.json.listings[1].sold_at, null);
});

function insertSales(env, n) {
  const stmt = env.DB.raw.prepare(`
    INSERT INTO store_sales (listing_id, inventory_id, amount_cents, order_shipping_cents, currency,
      stripe_session_id, payment_intent, buyer_name, buyer_email, ship_to, sold_at, created_at)
    VALUES (?, ?, ?, 1800, 'usd', ?, NULL, NULL, NULL, ?, ?, ?)`);
  for (let i = 1; i <= n; i++) {
    const id = `ro-${String(i).padStart(4, "0")}`;
    const ship = i === 1 ? JSON.stringify({ name: "A Buyer", line1: "1 Main St", line2: null, city: "Town", state: "CA", postal_code: "90000", country: "US" }) : null;
    stmt.run(id, id.toUpperCase(), 10000 + i, `cs_test_${i}`, ship, iso(Date.now()), iso(Date.now()));
  }
}

test("sales page 100 at a time, ascending, with `more`, from a cursor", async () => {
  const env = makeEnv();
  insertSales(env, 205);
  const page = async after => (await call(bench, env, "GET",
    `/api/bench/sales${after === undefined ? "" : `?after=${after}`}`, { token: TOKEN })).json;

  const p1 = await page();
  assert.equal(p1.sales.length, 100);
  assert.equal(p1.more, true);
  assert.deepEqual(p1.sales.map(s => s.sale_id), Array.from({ length: 100 }, (_, i) => i + 1));

  const p2 = await page(p1.sales.at(-1).sale_id);
  assert.equal(p2.sales[0].sale_id, 101);
  assert.equal(p2.more, true);
  const p3 = await page(p2.sales.at(-1).sale_id);
  assert.deepEqual(p3.sales.map(s => s.sale_id), [201, 202, 203, 204, 205]);
  assert.equal(p3.more, false);
  const p4 = await page(205);
  assert.deepEqual(p4, { sales: [], more: false });

  // Exactly 100 left: no phantom next page.
  const p5 = await page(105);
  assert.equal(p5.sales.length, 100);
  assert.equal(p5.more, false);
});

test("a sale row is in the contract's shape, ship_to as an object", async () => {
  const env = makeEnv();
  insertSales(env, 2);
  const { json } = await call(bench, env, "GET", "/api/bench/sales?after=0", { token: TOKEN });
  assert.deepEqual(Object.keys(json.sales[0]).sort(), [
    "amount_cents", "buyer_email", "buyer_name", "currency", "inventory_id", "listing_id",
    "order_shipping_cents", "payment_intent", "sale_id", "ship_to", "sold_at", "stripe_session_id"
  ]);
  assert.deepEqual(json.sales[0].ship_to, {
    name: "A Buyer", line1: "1 Main St", line2: null, city: "Town", state: "CA", postal_code: "90000", country: "US"
  });
  assert.equal(json.sales[1].ship_to, null);
  assert.equal(json.sales[0].inventory_id, "RO-0001");
});

test("a bad cursor is 400; unknown endpoints 404; wrong methods 405", async () => {
  const env = makeEnv();
  for (const after of ["-1", "abc", "1.5", "1e3"]) {
    assert.equal((await call(bench, env, "GET", `/api/bench/sales?after=${after}`, { token: TOKEN })).status, 400, after);
  }
  assert.equal((await call(bench, env, "GET", "/api/bench/nope", { token: TOKEN })).status, 404);
  assert.equal((await call(bench, env, "GET", "/api/bench/listings/ro-0042/extra/x", { token: TOKEN })).status, 404);
  assert.equal((await call(bench, env, "POST", "/api/bench/listings", { token: TOKEN, body: {} })).status, 405);
  assert.equal((await call(bench, env, "DELETE", "/api/bench/listings/ro-0042", { token: TOKEN })).status, 405);
  assert.equal((await call(bench, env, "POST", "/api/bench/sales", { token: TOKEN, body: {} })).status, 405);
});

test("the database enforces the same rules: cents, ids, statuses, ISO timestamps", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const bad = [
    "UPDATE store_listings SET price_cents = 229.5",
    "UPDATE store_listings SET price_cents = 99",
    "UPDATE store_listings SET status = 'lost'",
    "UPDATE store_listings SET status = 'reserved'",           // a hold needs reserved_until + session
    "UPDATE store_listings SET status = 'sold'",               // sold needs sold_at
    "UPDATE store_listings SET images = '[]'",
    "UPDATE store_listings SET updated_at = '2026-13-01T00:00:00.000Z'",   // not a real date
    "UPDATE store_listings SET updated_at = '2026-11-23 00:00:00'",        // not toISOString's shape
    "UPDATE store_listings SET created_at = 'soon'",
    "INSERT INTO store_sales (listing_id, inventory_id, amount_cents, order_shipping_cents, currency, stripe_session_id, sold_at, created_at) VALUES ('ro-1', 'RO-1', 1, 0, 'usd', 'cs_x', '2026-11-23T00:00:00.000Z', '2026-11-23T00:00:00.000Z')",
    "INSERT INTO store_sales (listing_id, inventory_id, amount_cents, order_shipping_cents, currency, stripe_session_id, sold_at, created_at) VALUES ('ro-0042', 'RO-0042', 1.5, 0, 'usd', 'cs_x', '2026-11-23T00:00:00.000Z', '2026-11-23T00:00:00.000Z')"
  ];
  for (const sql of bad) {
    assert.throws(() => env.DB.raw.exec(sql), /CHECK constraint failed/, sql);
  }
});

await run();

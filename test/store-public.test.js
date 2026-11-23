// Tests for the public store API (functions/api/store/[[path]].js): the live
// listings the storefront merges into the catalogue, and the photo route.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { onRequest as store } from "../functions/api/store/[[path]].js";
import { products } from "../data/products.js";
import { harness } from "./support/harness.js";
import {
  TOKEN, makeEnv, call, jpeg, imageName, pushListing, holdDirect, iso
} from "./support/store-fixtures.js";

const { section, test, run } = harness();

section("public store API: GET /api/store/listings");

test("only units a buyer can take now, newest first, in the products.js shape", async () => {
  const env = makeEnv();
  for (const id of ["ro-0001", "ro-0002", "ro-0003", "ro-0004", "ro-0005"]) await pushListing(bench, env, id);
  ["ro-0001", "ro-0002", "ro-0003", "ro-0004", "ro-0005"].forEach((id, i) => {
    env.DB.raw.prepare("UPDATE store_listings SET created_at = ? WHERE id = ?").run(iso(Date.UTC(2026, 10, 1 + i)), id);
  });
  await call(bench, env, "POST", "/api/bench/listings/ro-0002/withdraw", { token: TOKEN, body: { reason: "pulled" } });
  holdDirect(env, "ro-0003", "cs_test_live", Date.now() + 600_000);   // live hold: hidden
  holdDirect(env, "ro-0004", "cs_test_old", Date.now() - 1000);       // lapsed hold: shown
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0005'").run(iso(Date.now()));

  const r = await call(store, env, "GET", "/api/store/listings");
  assert.equal(r.status, 200);
  assert.equal(r.res.headers.get("Cache-Control"), "public, max-age=30");
  assert.match(r.res.headers.get("Content-Type"), /^application\/json/);
  assert.deepEqual(Object.keys(r.json), ["listings"]);
  assert.deepEqual(r.json.listings.map(l => l.id), ["ro-0004", "ro-0001"]);
});

test("each listing has exactly the products.js keys plus images and source, and nothing internal", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const { json } = await call(store, env, "GET", "/api/store/listings");
  const l = json.listings[0];
  assert.deepEqual(Object.keys(l).sort(), [
    "blurb", "category", "condition", "details", "id", "image", "images", "name",
    "platform", "priceCents", "shippingClass", "source", "stock"
  ]);
  // Same keys as a hand-made product, so the storefront can merge them.
  for (const key of Object.keys(products[0])) assert.ok(key in l, `missing ${key}`);
  assert.equal(l.stock, 1);
  assert.equal(l.source, "bench");
  assert.equal(l.priceCents, 22900);
  assert.equal(l.shippingClass, "console");
  assert.deepEqual(l.details, ["Firmware 11.00", "Includes: console, controller, HDMI, power cable"]);
  assert.equal(l.images.length, 2);
  for (const u of l.images) assert.match(u, /^\/api\/store\/img\/[0-9a-f]{64}\.jpg$/);
  assert.equal(l.image, l.images[0], "image is the primary photo");

  const text = JSON.stringify(json);
  for (const leak of ["RO-0042", "inventory_id", "reserved", "session", "sold_at", "created_at", "updated_at", "price_cents"]) {
    assert.ok(!text.includes(leak), `leaks ${leak}`);
  }
});

test("an empty store is { listings: [] }; no DB is a 503 that isn't cached", async () => {
  let r = await call(store, makeEnv(), "GET", "/api/store/listings");
  assert.deepEqual(r.json, { listings: [] });
  r = await call(store, makeEnv({ DB: undefined }), "GET", "/api/store/listings");
  assert.equal(r.status, 503);
  assert.equal(r.res.headers.get("Cache-Control"), "no-store");
  assert.equal(typeof r.json.error, "string");
});

test("read-only: POST is 405; other paths are 404", async () => {
  const env = makeEnv();
  assert.equal((await call(store, env, "POST", "/api/store/listings", { body: {} })).status, 405);
  assert.equal((await call(store, env, "GET", "/api/store/nope")).status, 404);
  assert.equal((await call(store, env, "GET", "/api/store/listings/ro-0042")).status, 404);
});

section("public store API: GET /api/store/img/<sha256>.jpg");

test("serves the R2 object as an immutable, nosniff JPEG", async () => {
  const env = makeEnv();
  const bytes = jpeg("served", 500);
  const name = imageName(bytes);
  await call(bench, env, "PUT", `/api/bench/images/${name}`, {
    token: TOKEN, body: bytes, headers: { "Content-Type": "image/jpeg" }
  });
  const request = new Request(`https://dhole.dev/api/store/img/${name}`);
  const res = await store({ request, env });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/jpeg");
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.ok(res.headers.get("ETag"));
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes);

  const head = await store({ request: new Request(request.url, { method: "HEAD" }), env });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), "500");
});

test("a bad name is 400 and a missing photo 404, never touching R2 for a bad name", async () => {
  const env = makeEnv();
  for (const bad of ["x.jpg", "..%2Fbench%2Fsecret.jpg", `${"A".repeat(64)}.jpg`, `${"a".repeat(64)}.png`]) {
    const r = await call(store, env, "GET", `/api/store/img/${bad}`);
    assert.equal(r.status, 400, bad);
  }
  assert.equal(env.STORE_IMAGES.ops.length, 0);
  const r = await call(store, env, "GET", `/api/store/img/${imageName(jpeg("never"))}`);
  assert.equal(r.status, 404);
  assert.equal(typeof r.json.error, "string");
});

section("public store API: no CSP change needed");

test("the storefront's live stock is same-origin, so the global CSP already covers it", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { ROOT } = await import("./support/store-fixtures.js");
  const { LISTINGS_ENDPOINT } = await import("../assets/catalogue.js");
  assert.match(LISTINGS_ENDPOINT, /^\/api\//, "connect-src 'self'");
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const { json } = await call(store, env, "GET", "/api/store/listings");
  for (const u of [json.listings[0].image, ...json.listings[0].images]) assert.match(u, /^\/api\/store\/img\//, "img-src 'self'");
  // No CSP rule was added or widened for the store.
  const headers = readFileSync(join(ROOT, "_headers"), "utf8");
  const csp = headers.split("\n").filter(l => /^\s*Content-Security-Policy:/.test(l));
  assert.equal(csp.length, 3, "the global policy and the two vendored-app exceptions only");
  const patterns = headers.split("\n").filter(l => /^\S/.test(l) && !l.startsWith("#")).map(l => l.trim());
  assert.deepEqual(patterns.filter(p => p.startsWith("/api")), ["/api/*"],
    "no _headers rule for the store's API besides the static no-store one");
});

await run();

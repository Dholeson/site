// Tests for the Stripe webhook (functions/api/stripe/webhook.js): signature
// checks, completed sessions becoming sales (idempotently), expired sessions
// releasing their holds. Signatures are made with node's own HMAC, so the
// Function's Web Crypto verification is checked against an independent one.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { onRequest as webhook } from "../functions/api/stripe/webhook.js";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { onRequest as checkout } from "../functions/api/checkout.js";
import { harness } from "./support/harness.js";
import {
  TOKEN, makeEnv, call, pushListing, row, sales, holdDirect, iso,
  stripeHeader, sessionEvent, spyTimingSafeEqual
} from "./support/store-fixtures.js";

const { section, test, run } = harness();

async function deliver(env, event, { header, payload } = {}) {
  const body = payload ?? JSON.stringify(event);
  const headers = { "Content-Type": "application/json" };
  const sig = header === undefined ? stripeHeader(body) : header;
  if (sig !== null) headers["Stripe-Signature"] = sig;
  return call(webhook, env, "POST", "/api/stripe/webhook", { body, headers });
}

function paidSession(overrides = {}) {
  return {
    id: "cs_test_paid",
    object: "checkout.session",
    payment_status: "paid",
    status: "complete",
    currency: "usd",
    payment_intent: "pi_test_123",
    amount_total: 24700,
    total_details: { amount_discount: 0, amount_shipping: 1800, amount_tax: 0 },
    customer_details: { name: "Ada Buyer", email: "ada@example.com", address: { country: "US" } },
    collected_information: {
      shipping_details: {
        name: "Ada Buyer",
        address: { line1: "1 Main St", line2: null, city: "Springfield", state: "IL", postal_code: "62701", country: "US" }
      }
    },
    metadata: { order: "ro-0042 x1", bench_ids: "ro-0042", bench_amounts: "22900", bench_hold: "hold_test" },
    ...overrides
  };
}

async function listedAndHeld(id = "ro-0042", session = "cs_test_paid") {
  const env = makeEnv();
  await pushListing(bench, env, id);
  holdDirect(env, id, session, Date.now() + 25 * 60_000);
  return env;
}

section("stripe webhook: signatures");

test("503 while STRIPE_WEBHOOK_SECRET is unset, before reading anything", async () => {
  const r = await deliver(makeEnv({ STRIPE_WEBHOOK_SECRET: undefined }), sessionEvent("checkout.session.completed", paidSession()));
  assert.equal(r.status, 503);
  assert.equal(typeof r.json.error, "string");
});

test("a missing, malformed or wrong signature is 400 and changes nothing", async () => {
  const env = await listedAndHeld();
  const event = sessionEvent("checkout.session.completed", paidSession());
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  for (const header of [
    null, "", "garbage", `t=${t}`, `v1=${"0".repeat(64)}`,
    stripeHeader(body, { secret: "whsec_someone_else" }),
    `t=${t},v1=${"0".repeat(64)}`,
    `t=${t},v1=nothex`,
    stripeHeader(body, { t }).replace(`t=${t}`, `t=${t + 1}`)             // signed for another time
  ]) {
    const r = await deliver(env, event, { header, payload: body });
    assert.equal(r.status, 400, `header ${JSON.stringify(header)}`);
  }
  // A body changed after signing.
  const tampered = body.replace("22900", "1");
  const r = await deliver(env, event, { header: stripeHeader(body), payload: tampered });
  assert.equal(r.status, 400);
  assert.deepEqual(sales(env), []);
  assert.equal(row(env, "ro-0042").status, "reserved");
});

test("a correctly signed but stale (or far-future) timestamp is 400: 5-minute tolerance", async () => {
  const env = await listedAndHeld();
  const event = sessionEvent("checkout.session.completed", paidSession());
  const body = JSON.stringify(event);
  const now = Math.floor(Date.now() / 1000);
  for (const t of [now - 301, now - 3600, now + 301]) {
    const r = await deliver(env, event, { header: stripeHeader(body, { t }), payload: body });
    assert.equal(r.status, 400, `t=now${t - now}`);
    assert.match(r.json.error, /tolerance/);
  }
  assert.deepEqual(sales(env), []);
  const ok = await deliver(env, event, { header: stripeHeader(body, { t: now - 240 }), payload: body });
  assert.equal(ok.status, 200, "four minutes old is inside the tolerance");
});

test("any v1 may match (secret rolling), compared in constant time", async () => {
  const env = await listedAndHeld();
  const event = sessionEvent("checkout.session.completed", paidSession());
  const body = JSON.stringify(event);
  const spy = spyTimingSafeEqual();
  try {
    const r = await deliver(env, event, { header: stripeHeader(body, { extra: [`v1=${"ab".repeat(32)}`, "v0=old"] }), payload: body });
    assert.equal(r.status, 200);
    assert.deepEqual(spy.calls, [[32, 32], [32, 32]], "every v1 checked with crypto.subtle.timingSafeEqual");
  } finally {
    spy.restore();
  }
});

section("stripe webhook: checkout.session.completed");

test("a paid session sells its units: one store_sales row each, listing sold, hold cleared", async () => {
  const env = await listedAndHeld();
  const created = Math.floor(Date.now() / 1000) - 5;
  const r = await deliver(env, sessionEvent("checkout.session.completed", paidSession(), created));
  assert.equal(r.status, 200);

  const listing = row(env, "ro-0042");
  assert.equal(listing.status, "sold");
  assert.equal(listing.sold_at, iso(created * 1000));
  assert.equal(listing.reserved_session, null);
  assert.equal(listing.reserved_until, null);

  const s = sales(env);
  assert.equal(s.length, 1);
  assert.equal(s[0].listing_id, "ro-0042");
  assert.equal(s[0].inventory_id, "RO-0042");
  assert.equal(s[0].amount_cents, 22900);
  assert.equal(s[0].order_shipping_cents, 1800);
  assert.equal(s[0].currency, "usd");
  assert.equal(s[0].stripe_session_id, "cs_test_paid");
  assert.equal(s[0].payment_intent, "pi_test_123");
  assert.equal(s[0].buyer_name, "Ada Buyer");
  assert.equal(s[0].buyer_email, "ada@example.com");
  assert.deepEqual(JSON.parse(s[0].ship_to), {
    name: "Ada Buyer", line1: "1 Main St", line2: null, city: "Springfield", state: "IL", postal_code: "62701", country: "US"
  });
  assert.equal(s[0].sold_at, iso(created * 1000));
});

test("idempotent: the same event twice (or a second event for the session) records one sale per unit", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0001");
  await pushListing(bench, env, "ro-0002");
  holdDirect(env, "ro-0001", "cs_test_two", Date.now() + 600_000);
  holdDirect(env, "ro-0002", "cs_test_two", Date.now() + 600_000);
  const session = paidSession({
    id: "cs_test_two",
    metadata: { bench_ids: "ro-0001,ro-0002", bench_amounts: "22900,15000", bench_hold: "hold_two" }
  });
  const event = sessionEvent("checkout.session.completed", session, Math.floor(Date.now() / 1000) - 60);
  assert.equal((await deliver(env, event)).status, 200);
  const first = sales(env);
  const soldAt = row(env, "ro-0001").sold_at;
  assert.equal((await deliver(env, event)).status, 200);
  assert.equal((await deliver(env, sessionEvent("checkout.session.completed", session))).status, 200);
  assert.deepEqual(sales(env), first);
  assert.deepEqual(first.map(s => [s.sale_id, s.listing_id, s.amount_cents]), [[1, "ro-0001", 22900], [2, "ro-0002", 15000]]);
  assert.equal(row(env, "ro-0001").sold_at, soldAt, "the first sold_at stands");
});

test("a unit withdrawn meanwhile still records the sale (the money was taken)", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  holdDirect(env, "ro-0042", "cs_test_paid", Date.now() - 1000);          // the hold ran out...
  const w = await call(bench, env, "POST", "/api/bench/listings/ro-0042/withdraw", { token: TOKEN, body: { reason: "sold_elsewhere" } });
  assert.equal(w.status, 200);                                              // ...so the bench withdrew it
  const r = await deliver(env, sessionEvent("checkout.session.completed", paidSession()));
  assert.equal(r.status, 200);
  assert.equal(sales(env).length, 1);
  const listing = row(env, "ro-0042");
  assert.equal(listing.status, "sold");
  assert.equal(listing.withdrawn_reason, null);
  // The bench sees it, and can't re-list it.
  const pulled = await call(bench, env, "GET", "/api/bench/sales?after=0", { token: TOKEN });
  assert.equal(pulled.json.sales[0].listing_id, "ro-0042");
  assert.equal((await pushListing(bench, env, "ro-0042")).status, 409);
});

test("an unpaid completed session (a delayed payment method) is not a sale", async () => {
  const env = await listedAndHeld();
  const r = await deliver(env, sessionEvent("checkout.session.completed", paidSession({ payment_status: "unpaid" })));
  assert.equal(r.status, 200);
  assert.deepEqual(sales(env), []);
  assert.equal(row(env, "ro-0042").status, "reserved");
});

test("a session with no bench units, and any other event type, is 200 and ignored", async () => {
  const env = await listedAndHeld();
  const plain = paidSession({ metadata: { order: "snes-controller x1" } });
  assert.equal((await deliver(env, sessionEvent("checkout.session.completed", plain))).status, 200);
  assert.equal((await deliver(env, sessionEvent("payment_intent.succeeded", { id: "pi_1", object: "payment_intent" }))).status, 200);
  assert.equal((await deliver(env, sessionEvent("checkout.session.async_payment_succeeded", paidSession()))).status, 200);
  assert.deepEqual(sales(env), []);
  assert.equal(row(env, "ro-0042").status, "reserved");
});

test("older API versions: ship-to from shipping_details, email from customer_email", async () => {
  const env = await listedAndHeld();
  const session = paidSession({
    collected_information: undefined,
    customer_details: { name: null, email: null },
    customer_email: "old@example.com",
    shipping_details: { name: "Old Api", address: { line1: "9 Elm", city: "X", state: "NY", postal_code: "10001", country: "US" } },
    total_details: undefined,
    shipping_cost: { amount_subtotal: 600, amount_total: 600 },
    payment_intent: null
  });
  assert.equal((await deliver(env, sessionEvent("checkout.session.completed", session))).status, 200);
  const [s] = sales(env);
  assert.equal(s.buyer_email, "old@example.com");
  assert.equal(s.buyer_name, null);
  assert.equal(s.payment_intent, null);
  assert.equal(s.order_shipping_cents, 600);
  assert.equal(JSON.parse(s.ship_to).line1, "9 Elm");
});

section("stripe webhook: checkout.session.expired");

test("expired releases the units that session held, and nothing else", async () => {
  const env = makeEnv();
  for (const id of ["ro-0001", "ro-0002", "ro-0003"]) await pushListing(bench, env, id);
  holdDirect(env, "ro-0001", "cs_test_gone", Date.now() + 600_000);
  holdDirect(env, "ro-0002", "hold_pending", Date.now() + 600_000);      // session id never recorded
  holdDirect(env, "ro-0003", "cs_test_other", Date.now() + 600_000);
  const session = paidSession({
    id: "cs_test_gone", status: "expired", payment_status: "unpaid",
    metadata: { bench_ids: "ro-0001,ro-0002", bench_amounts: "22900,22900", bench_hold: "hold_pending" }
  });
  const r = await deliver(env, sessionEvent("checkout.session.expired", session));
  assert.equal(r.status, 200);
  assert.equal(r.json.released, 2);
  for (const id of ["ro-0001", "ro-0002"]) {
    const saved = row(env, id);
    assert.equal(saved.status, "available", id);
    assert.equal(saved.reserved_session, null);
  }
  assert.equal(row(env, "ro-0003").reserved_session, "cs_test_other");
  assert.deepEqual(sales(env), []);
});

test("expired never un-sells a unit", async () => {
  const env = await listedAndHeld();
  await deliver(env, sessionEvent("checkout.session.completed", paidSession()));
  await deliver(env, sessionEvent("checkout.session.expired", paidSession({ status: "expired" })));
  assert.equal(row(env, "ro-0042").status, "sold");
});

section("end to end: checkout -> Stripe -> webhook -> the bench's sales feed");

test("a unit pushed, bought and paid for shows up in GET /api/bench/sales", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const original = globalThis.fetch;
  let form;
  globalThis.fetch = async (url, init) => {
    form = new URLSearchParams(String(init.body));
    return new Response(JSON.stringify({ id: "cs_test_e2e", url: "https://checkout.stripe.com/e2e" }), { status: 200 });
  };
  try {
    const r = await call(checkout, env, "POST", "/api/checkout", { body: { lines: [{ id: "ro-0042", qty: 1 }] } });
    assert.equal(r.status, 200);
  } finally {
    globalThis.fetch = original;
  }
  // What Stripe would send back: our own metadata on the completed session.
  const metadata = {};
  for (const [k, v] of form) {
    const m = /^metadata\[(.+)\]$/.exec(k);
    if (m) metadata[m[1]] = v;
  }
  await deliver(env, sessionEvent("checkout.session.completed", paidSession({ id: "cs_test_e2e", metadata })));

  const { json } = await call(bench, env, "GET", "/api/bench/sales", { token: TOKEN });
  assert.equal(json.more, false);
  assert.equal(json.sales.length, 1);
  assert.equal(json.sales[0].sale_id, 1);
  assert.equal(json.sales[0].inventory_id, "RO-0042");
  assert.equal(json.sales[0].amount_cents, 22900);
  assert.equal(json.sales[0].stripe_session_id, "cs_test_e2e");
  const listings = await call(bench, env, "GET", "/api/bench/listings", { token: TOKEN });
  assert.equal(listings.json.listings[0].status, "sold");
  const w = await call(bench, env, "POST", "/api/bench/listings/ro-0042/withdraw", { token: TOKEN, body: { reason: "pulled" } });
  assert.equal(w.status, 409);
  assert.equal(w.json.status, "sold");
});

await run();

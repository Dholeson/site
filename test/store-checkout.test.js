// Tests for checkout with bench units (functions/api/checkout.js): bench lines
// priced from D1, held all-or-none before Stripe, released when Stripe fails.
// Stripe is a stubbed fetch; D1 is SQLite with every migration applied.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { onRequest as checkout } from "../functions/api/checkout.js";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { reserveUnits } from "../lib/store-db.js";
import { products } from "../data/products.js";
import { FIXTURE_PRODUCTS } from "./support/catalogue-fixture.js";
import { harness } from "./support/harness.js";
import { makeEnv, call, pushListing, row, holdDirect, iso, TOKEN } from "./support/store-fixtures.js";

const { section, test, run } = harness();
// The live catalogue is empty; stand-ins exercise a mixed bench + catalogue cart.
products.push(...FIXTURE_PRODUCTS);
const smallItem = products.find(p => p.shippingClass === "small");

// Replaces fetch (the only thing checkout fetches is Stripe) for one test.
function stubStripe(answer = () => ({ status: 200, body: { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" } })) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), form: new URLSearchParams(String(init.body)) };
    calls.push(call);
    const a = await answer(call, calls.length);
    if (a instanceof Error) throw a;
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { "Content-Type": "application/json" } });
  };
  return { calls, restore() { globalThis.fetch = original; } };
}

async function withStripe(answer, fn) {
  const stripe = stubStripe(answer);
  try { return await fn(stripe); } finally { stripe.restore(); }
}

const buy = (env, lines) => call(checkout, env, "POST", "/api/checkout", { body: { lines } });

async function listed(...ids) {
  const env = makeEnv();
  for (const id of ids) {
    const r = await pushListing(bench, env, id);
    assert.equal(r.status, 200);
  }
  return env;
}

section("checkout: bench units priced from D1");

test("a bench line is priced from D1 and the client's price is ignored", async () => {
  const env = await listed("ro-0042");
  await withStripe(undefined, async stripe => {
    const r = await buy(env, [{ id: "ro-0042", qty: 1, priceCents: 1, unit_amount: 1 }]);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.url, "https://checkout.stripe.com/c/pay/cs_test_1");
    assert.equal(stripe.calls.length, 1);
    const f = stripe.calls[0].form;
    assert.equal(f.get("line_items[0][price_data][unit_amount]"), "22900");
    assert.equal(f.get("line_items[0][quantity]"), "1");
    assert.equal(f.get("metadata[bench_ids]"), "ro-0042");
    assert.equal(f.get("metadata[bench_amounts]"), "22900");
    assert.match(f.get("line_items[0][price_data][product_data][images][0]"),
      /^https:\/\/dhole\.dev\/api\/store\/img\/[0-9a-f]{64}\.jpg$/, "Stripe needs an absolute image URL");
  });
});

test("the hold and the Stripe session end at the same second, and the hold is keyed by the session", async () => {
  const env = await listed("ro-0042");
  const before = Math.floor(Date.now() / 1000);
  await withStripe(undefined, async stripe => {
    await buy(env, [{ id: "ro-0042", qty: 1 }]);
    const f = stripe.calls[0].form;
    const expiresAt = Number(f.get("expires_at"));
    assert.ok(expiresAt >= before + 30 * 60 && expiresAt <= before + 32 * 60, "30 minutes and change");
    assert.match(f.get("metadata[bench_hold]"), /^hold_/);
    const r = row(env, "ro-0042");
    assert.equal(r.status, "reserved");
    assert.equal(r.reserved_until, iso(expiresAt * 1000));
    assert.equal(r.reserved_session, "cs_test_1");
  });
});

test("a later re-push to a different price doesn't change what the held buyer pays", async () => {
  const env = await listed("ro-0042");
  await withStripe(undefined, async stripe => {
    await buy(env, [{ id: "ro-0042", qty: 1 }]);
    await pushListing(bench, env, "ro-0042", { price_cents: 19900 });
    assert.equal(stripe.calls[0].form.get("metadata[bench_amounts]"), "22900");
    assert.equal(row(env, "ro-0042").status, "reserved");
  });
});

test("qty other than 1 is refused (400) without a hold or a Stripe call", async () => {
  const env = await listed("ro-0042");
  await withStripe(undefined, async stripe => {
    for (const qty of [0, 2, 5, -1, 1.5]) {
      const r = await buy(env, [{ id: "ro-0042", qty }]);
      assert.equal(r.status, 400, `qty ${qty}`);
      assert.match(r.json.error, /one of a kind/);
    }
    assert.equal(stripe.calls.length, 0);
    assert.equal(row(env, "ro-0042").status, "available");
  });
});

test("sold, withdrawn, live-held and unknown units are a 409 that names the unit", async () => {
  const env = await listed("ro-0001", "ro-0002", "ro-0003");
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0001'").run(iso(Date.now()));
  await call(bench, env, "POST", "/api/bench/listings/ro-0002/withdraw", { token: TOKEN, body: { reason: "pulled" } });
  holdDirect(env, "ro-0003", "cs_test_other", Date.now() + 600_000);
  await withStripe(undefined, async stripe => {
    const cases = [["ro-0001", /just sold/], ["ro-0002", /no longer available/], ["ro-0003", /on hold/], ["ro-0404", /no longer available/]];
    for (const [id, re] of cases) {
      const r = await buy(env, [{ id, qty: 1 }]);
      assert.equal(r.status, 409, id);
      assert.match(r.json.error, re, id);
    }
    assert.equal(stripe.calls.length, 0);
    assert.equal(row(env, "ro-0003").reserved_session, "cs_test_other", "someone else's hold is untouched");
  });
});

test("a lapsed hold can be taken by the next buyer", async () => {
  const env = await listed("ro-0042");
  holdDirect(env, "ro-0042", "cs_test_abandoned", Date.now() - 1000);
  await withStripe(() => ({ status: 200, body: { id: "cs_test_next", url: "https://checkout.stripe.com/x" } }), async () => {
    const r = await buy(env, [{ id: "ro-0042", qty: 1 }]);
    assert.equal(r.status, 200);
    assert.equal(row(env, "ro-0042").reserved_session, "cs_test_next");
  });
});

section("checkout: holds are all or none, and only one buyer wins");

// A D1 wrapper that makes every checkout's first stock read wait until `n`
// checkouts have read, so they all see the unit available and then race to
// hold it.
function lockstep(db, n) {
  let arrived = 0;
  let open;
  const gate = new Promise(r => { open = r; });
  return {
    ...db,
    prepare(sql) {
      const st = db.prepare(sql);
      if (!/SELECT \* FROM store_listings WHERE id IN/.test(sql)) return st;
      return {
        bind(...v) {
          const b = st.bind(...v);
          return { ...b, async all() { const r = await b.all(); if (++arrived >= n) open(); await gate; return r; } };
        }
      };
    }
  };
}

test("two checkouts for the same unit at once: exactly one gets Stripe, the other a 409", async () => {
  const env = await listed("ro-0042");
  env.DB = lockstep(env.DB, 2);
  await withStripe((c, n) => ({ status: 200, body: { id: `cs_test_${n}`, url: `https://checkout.stripe.com/${n}` } }), async stripe => {
    const [a, b] = await Promise.all([buy(env, [{ id: "ro-0042", qty: 1 }]), buy(env, [{ id: "ro-0042", qty: 1 }])]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const loser = a.status === 409 ? a : b;
    assert.match(loser.json.error, /on hold/);
    assert.deepEqual(loser.json.unavailable, ["ro-0042"]);
    assert.equal(stripe.calls.length, 1, "the loser never reaches Stripe");
    assert.equal(row(env, "ro-0042").reserved_session, "cs_test_1");
  });
});

test("overlapping carts at once: the loser holds none of its units", async () => {
  const env = await listed("ro-0001", "ro-0002", "ro-0003");
  env.DB = lockstep(env.DB, 2);
  await withStripe((c, n) => ({ status: 200, body: { id: `cs_test_${n}`, url: `https://checkout.stripe.com/${n}` } }), async () => {
    const [a, b] = await Promise.all([
      buy(env, [{ id: "ro-0001", qty: 1 }, { id: "ro-0002", qty: 1 }]),
      buy(env, [{ id: "ro-0002", qty: 1 }, { id: "ro-0003", qty: 1 }])
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const won = a.status === 200 ? ["ro-0001", "ro-0002"] : ["ro-0002", "ro-0003"];
    const lostOnly = a.status === 200 ? "ro-0003" : "ro-0001";
    for (const id of won) assert.equal(row(env, id).status, "reserved", id);
    assert.equal(row(env, lostOnly).status, "available", `${lostOnly} must not stay held by the losing cart`);
  });
});

test("reserveUnits holds nothing when any unit can't be held", async () => {
  const env = await listed("ro-0001", "ro-0002");
  holdDirect(env, "ro-0002", "cs_test_other", Date.now() + 600_000);
  const now = iso(Date.now());
  const ok = await reserveUnits(env.DB, ["ro-0001", "ro-0002"], "hold_x", iso(Date.now() + 1_860_000), now);
  assert.equal(ok, false);
  assert.equal(row(env, "ro-0001").status, "available");
  assert.equal(row(env, "ro-0002").reserved_session, "cs_test_other");
});

section("checkout: Stripe failures release the hold");

test("Stripe refusing the session releases every hold (502)", async () => {
  const env = await listed("ro-0001", "ro-0002");
  await withStripe(() => ({ status: 400, body: { error: { message: "expires_at too soon" } } }), async () => {
    const r = await buy(env, [{ id: "ro-0001", qty: 1 }, { id: "ro-0002", qty: 1 }]);
    assert.equal(r.status, 502);
    for (const id of ["ro-0001", "ro-0002"]) {
      const saved = row(env, id);
      assert.equal(saved.status, "available", id);
      assert.equal(saved.reserved_until, null);
      assert.equal(saved.reserved_session, null);
    }
  });
});

test("Stripe unreachable, or answering garbage, releases the hold too", async () => {
  const env = await listed("ro-0042");
  await withStripe(() => new Error("network down"), async () => {
    assert.equal((await buy(env, [{ id: "ro-0042", qty: 1 }])).status, 502);
  });
  assert.equal(row(env, "ro-0042").status, "available");
  await withStripe(() => ({ status: 200, body: { id: "cs_test_x" } }), async () => {
    assert.equal((await buy(env, [{ id: "ro-0042", qty: 1 }])).status, 502);
  });
  assert.equal(row(env, "ro-0042").status, "available");
});

section("checkout: configuration");

test("without STRIPE_SECRET_KEY, bench units are listed but checkout says not configured, and holds nothing", async () => {
  const env = await listed("ro-0042");
  env.STRIPE_SECRET_KEY = undefined;
  await withStripe(undefined, async stripe => {
    const r = await buy(env, [{ id: "ro-0042", qty: 1 }]);
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "Checkout is not configured.");
    assert.equal(stripe.calls.length, 0);
  });
  assert.equal(row(env, "ro-0042").status, "available");
});

test("a static-only cart doesn't need D1; a bench line without D1 is a 503", async () => {
  await withStripe(undefined, async stripe => {
    const env = makeEnv({ DB: undefined });
    let r = await buy(env, [{ id: smallItem.id, qty: 2 }]);
    assert.equal(r.status, 200);
    assert.equal(stripe.calls[0].form.get("expires_at"), null);
    assert.equal(stripe.calls[0].form.get("metadata[bench_ids]"), null);
    r = await buy(env, [{ id: "ro-0042", qty: 1 }]);
    assert.equal(r.status, 503);
  });
});

await run();

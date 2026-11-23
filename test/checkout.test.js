// Tests for the order-pricing logic -- the code standing between the storefront
// and someone's card, so the hostile paths matter more than the happy one.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { products } from "../data/products.js";
import {
  priceOrder, shippingFor, toForm, buildSessionPayload, benchIdsIn
} from "../lib/checkout-core.js";
import { isBenchId } from "../lib/store-db.js";

const consoleItem = products.find(p => p.shippingClass === "console");
const smallItem   = products.find(p => p.shippingClass === "small");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\ncheckout pricing\n");

test("prices a valid order from the catalogue", () => {
  const { priced, error } = priceOrder([{ id: smallItem.id, qty: 2 }]);
  assert.equal(error, undefined);
  assert.equal(priced.length, 1);
  assert.equal(priced[0].product.priceCents, smallItem.priceCents);
  assert.equal(priced[0].qty, 2);
});

test("ignores any price supplied by the client", () => {
  // The attack this whole design exists to stop.
  const { priced } = priceOrder([{ id: consoleItem.id, qty: 1, priceCents: 1 }]);
  assert.equal(priced[0].product.priceCents, consoleItem.priceCents);
});

test("rejects an unknown product id", () => {
  assert.match(priceOrder([{ id: "free-console-lol", qty: 1 }]).error, /no longer available/);
});

test("rejects quantity above available stock", () => {
  assert.match(priceOrder([{ id: consoleItem.id, qty: consoleItem.stock + 1 }]).error, /left in stock/);
});

test("rejects zero, negative, fractional, and non-numeric quantities", () => {
  for (const qty of [0, -5, 1.5, NaN, null, "abc", Infinity]) {
    assert.match(priceOrder([{ id: smallItem.id, qty }]).error ?? "", /Invalid quantity/,
      `qty=${qty} should be rejected`);
  }
});

test("coerces a numeric string quantity to a real number", () => {
  // Lenient parsing is fine -- what matters is that it is bounds-checked and
  // stored as a number, so no string reaches the arithmetic.
  const { priced, error } = priceOrder([{ id: smallItem.id, qty: "2" }]);
  assert.equal(error, undefined);
  assert.equal(priced[0].qty, 2);
  assert.equal(typeof priced[0].qty, "number");
});

test("rejects duplicate ids that would stack past stock", () => {
  assert.match(priceOrder([
    { id: consoleItem.id, qty: consoleItem.stock },
    { id: consoleItem.id, qty: consoleItem.stock }
  ]).error, /Duplicate/);
});

test("rejects an empty or non-array cart", () => {
  assert.match(priceOrder([]).error, /empty/);
  assert.match(priceOrder(null).error, /empty/);
  assert.match(priceOrder("everything").error, /empty/);
});

test("rejects malformed line objects", () => {
  assert.match(priceOrder([null]).error, /Malformed/);
  assert.match(priceOrder([{ qty: 1 }]).error, /Malformed/);
});

test("rejects absurdly large carts", () => {
  const big = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, qty: 1 }));
  assert.match(priceOrder(big).error, /Too many/);
});

console.log("\nshipping\n");

test("an order containing a console ships at the console rate", () => {
  const { priced } = priceOrder([{ id: consoleItem.id, qty: 1 }, { id: smallItem.id, qty: 1 }]);
  assert.equal(shippingFor(priced).cents, 1800);
});

test("an accessories-only order ships at the small rate", () => {
  assert.equal(shippingFor(priceOrder([{ id: smallItem.id, qty: 1 }]).priced).cents, 600);
});

console.log("\nstripe payload\n");

test("flattens nested objects into Stripe's bracket syntax", () => {
  const form = toForm({
    mode: "payment",
    line_items: [{ quantity: 2, price_data: { unit_amount: 3200, currency: "usd" } }],
    shipping_address_collection: { allowed_countries: ["US", "CA"] }
  });
  assert.equal(form.get("mode"), "payment");
  assert.equal(form.get("line_items[0][quantity]"), "2");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "3200");
  assert.equal(form.get("shipping_address_collection[allowed_countries][0]"), "US");
  assert.equal(form.get("shipping_address_collection[allowed_countries][1]"), "CA");
});

test("drops undefined values rather than sending the string 'undefined'", () => {
  const form = toForm({ a: 1, b: undefined, c: null });
  assert.equal(form.has("b"), false);
  assert.equal(form.has("c"), false);
});

test("builds a session payload with server-side prices and absolute image URLs", () => {
  const { priced } = priceOrder([{ id: consoleItem.id, qty: 1 }]);
  const p = buildSessionPayload(priced, {
    siteUrl: "https://dhole.dev/",
    currency: "usd",
    automaticTax: false,
    shipToCountries: ["US"]
  });
  assert.equal(p.line_items[0].price_data.unit_amount, consoleItem.priceCents);
  assert.equal(p.mode, "payment");
  // Trailing slash on siteUrl must not produce a doubled slash.
  assert.match(p.line_items[0].price_data.product_data.images[0], /^https:\/\/dhole\.dev\/assets\//);
  assert.equal(p.success_url, "https://dhole.dev/order-complete.html?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(p.automatic_tax, undefined, "tax must stay off unless explicitly enabled");
});

test("enables automatic tax only when asked", () => {
  const { priced } = priceOrder([{ id: smallItem.id, qty: 1 }]);
  const p = buildSessionPayload(priced, {
    siteUrl: "https://dhole.dev", currency: "usd", automaticTax: true, shipToCountries: ["US"]
  });
  assert.deepEqual(p.automatic_tax, { enabled: true });
});

// ---------- bench units (live stock from D1) ----------
//
// The checkout Function loads bench units from D1 and passes them in; these
// check the pricing rules on that input. test/store-checkout.test.js drives
// the Function itself against a real SQLite.

console.log("\nbench units\n");

const NOW = "2026-11-23T12:00:00.000Z";
const benchUnit = (id, overrides = {}) => ({
  product: {
    id, name: `Unit ${id}`, platform: "PlayStation 4", category: "console", condition: "refurbished",
    priceCents: 22900, stock: 1, shippingClass: "console",
    image: "/api/store/img/" + "a".repeat(64) + ".jpg", images: [], blurb: "b", details: [], source: "bench"
  },
  status: "available",
  reservedUntil: null,
  ...overrides
});
const stock = (...entries) => new Map(entries.map(e => [e.product.id, e]));

test("a bench line is priced from D1's stock, never from anything the client sends", () => {
  const { priced, error } = priceOrder(
    [{ id: "ro-0042", qty: 1, priceCents: 1, unit_amount: 1, price: 1 }],
    { bench: stock(benchUnit("ro-0042")), now: NOW });
  assert.equal(error, undefined);
  assert.equal(priced[0].product.priceCents, 22900);
  assert.equal(priced[0].qty, 1);
  assert.equal(priced[0].bench, true);
});

test("a bench line's quantity must be exactly 1", () => {
  for (const qty of [0, 2, 10, -1, 1.5, "2", null, undefined]) {
    const r = priceOrder([{ id: "ro-0042", qty }], { bench: stock(benchUnit("ro-0042")), now: NOW });
    assert.match(r.error ?? "", /Invalid quantity/, `qty=${qty} should be refused`);
  }
  assert.equal(priceOrder([{ id: "ro-0042", qty: "1" }], { bench: stock(benchUnit("ro-0042")), now: NOW }).error, undefined);
});

test("a sold, withdrawn, live-held or unknown bench unit is refused with 409", () => {
  const cases = [
    [benchUnit("ro-0042", { status: "sold" }), /just sold/],
    [benchUnit("ro-0042", { status: "withdrawn" }), /no longer available/],
    [benchUnit("ro-0042", { status: "reserved", reservedUntil: "2026-11-23T12:10:00.000Z" }), /on hold/],
    [null, /no longer available/]
  ];
  for (const [entry, re] of cases) {
    const r = priceOrder([{ id: "ro-0042", qty: 1 }], { bench: entry ? stock(entry) : new Map(), now: NOW });
    assert.match(r.error ?? "", re);
    assert.equal(r.status, 409);
  }
  // A hold whose time has passed counts as available.
  const lapsed = benchUnit("ro-0042", { status: "reserved", reservedUntil: "2026-11-23T11:59:59.999Z" });
  assert.equal(priceOrder([{ id: "ro-0042", qty: 1 }], { bench: stock(lapsed), now: NOW }).error, undefined);
});

test("bench ids are their own namespace: never in products.js, never priced from it", () => {
  assert.deepEqual(products.filter(p => isBenchId(p.id)).map(p => p.id), [], "a static id looks like a bench id");
  // Without D1's stock, a bench id is simply unavailable, whatever products.js holds.
  assert.equal(priceOrder([{ id: "ro-0042", qty: 1 }]).status, 409);
  assert.deepEqual(benchIdsIn([{ id: "ro-0042", qty: 1 }, { id: consoleItem.id, qty: 1 }, { id: "ro-12", qty: 1 }, null]),
    ["ro-0042"]);
  assert.deepEqual(benchIdsIn(Array.from({ length: 50 }, (_, i) => ({ id: `ro-${1000 + i}`, qty: 1 }))), [],
    "a cart too large to price asks D1 for nothing");
});

test("a mixed order ships at the console rate and keeps static stock rules", () => {
  const { priced } = priceOrder([{ id: "ro-0042", qty: 1 }, { id: smallItem.id, qty: 2 }],
    { bench: stock(benchUnit("ro-0042")), now: NOW });
  assert.equal(shippingFor(priced).cents, 1800);
  assert.match(priceOrder([{ id: "ro-0042", qty: 1 }, { id: consoleItem.id, qty: consoleItem.stock + 1 }],
    { bench: stock(benchUnit("ro-0042")), now: NOW }).error, /left in stock/);
});

test("a bench order's session expires with its hold and names its units and prices", () => {
  const { priced } = priceOrder([{ id: "ro-0042", qty: 1 }, { id: "ro-0043", qty: 1 }, { id: smallItem.id, qty: 1 }],
    { bench: stock(benchUnit("ro-0042"), benchUnit("ro-0043", { product: { ...benchUnit("ro-0043").product, priceCents: 15000 } })), now: NOW });
  const p = buildSessionPayload(priced, {
    siteUrl: "https://dhole.dev", currency: "usd", automaticTax: false, shipToCountries: ["US"],
    hold: { token: "hold_abc", expiresAt: 1795000000 }
  });
  assert.equal(p.expires_at, 1795000000);
  assert.equal(p.metadata.bench_ids, "ro-0042,ro-0043");
  assert.equal(p.metadata.bench_amounts, "22900,15000");
  assert.equal(p.metadata.bench_hold, "hold_abc");
  assert.equal(p.line_items[0].price_data.unit_amount, 22900);
  assert.equal(p.line_items[0].quantity, 1);
  // Stripe needs absolute image URLs.
  assert.equal(p.line_items[0].price_data.product_data.images[0], `https://dhole.dev/api/store/img/${"a".repeat(64)}.jpg`);
  assert.throws(() => buildSessionPayload(priced, { siteUrl: "https://dhole.dev", currency: "usd", shipToCountries: ["US"] }),
    /needs a hold/);
});

test("a static-only order gets no expiry and no bench metadata", () => {
  const { priced } = priceOrder([{ id: smallItem.id, qty: 1 }]);
  const p = buildSessionPayload(priced, { siteUrl: "https://dhole.dev", currency: "usd", shipToCountries: ["US"] });
  assert.equal(p.expires_at, undefined);
  assert.deepEqual(Object.keys(p.metadata), ["order"]);
});

console.log(`\n${passed} checks passed\n`);

// Tests for the order-pricing logic -- the code standing between the storefront
// and someone's card, so the hostile paths matter more than the happy one.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { products } from "../data/products.js";
import {
  priceOrder, shippingFor, toForm, buildSessionPayload
} from "../lib/checkout-core.js";

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

console.log(`\n${passed} checks passed\n`);

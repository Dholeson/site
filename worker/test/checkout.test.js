// Tests for the order-pricing logic. This is the code that stands between the
// storefront and someone's card, so it is worth checking the hostile paths and
// not just the happy one.
//
// Run with:  node test/checkout.test.js

import assert from "node:assert/strict";
import { __test } from "../src/index.js";
import { products } from "../../data/products.js";

const { priceOrder, toForm, shippingFor } = __test;

const console_item = products.find(p => p.shippingClass === "console");
const small_item = products.find(p => p.shippingClass === "small");

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

test("prices a valid single-item order from the catalogue", () => {
  const { priced, error } = priceOrder([{ id: small_item.id, qty: 2 }]);
  assert.equal(error, undefined);
  assert.equal(priced.length, 1);
  assert.equal(priced[0].product.priceCents, small_item.priceCents);
  assert.equal(priced[0].qty, 2);
});

test("ignores any price supplied by the client", () => {
  // The attack this whole design exists to stop.
  const { priced } = priceOrder([{ id: console_item.id, qty: 1, priceCents: 1 }]);
  assert.equal(priced[0].product.priceCents, console_item.priceCents);
});

test("rejects an unknown product id", () => {
  const { error } = priceOrder([{ id: "free-console-lol", qty: 1 }]);
  assert.match(error, /no longer available/);
});

test("rejects quantity above available stock", () => {
  const { error } = priceOrder([{ id: console_item.id, qty: console_item.stock + 1 }]);
  assert.match(error, /left in stock/);
});

test("rejects zero, negative, fractional, and non-numeric quantities", () => {
  for (const qty of [0, -5, 1.5, NaN, null, "abc", Infinity]) {
    const { error } = priceOrder([{ id: small_item.id, qty }]);
    assert.match(error ?? "", /Invalid quantity/, `qty=${qty} should be rejected`);
  }
});

test("coerces a numeric string quantity to a real number", () => {
  // Lenient parsing is fine -- what matters is that it is bounds-checked and
  // stored as a number, so no string ever reaches the arithmetic.
  const { priced, error } = priceOrder([{ id: small_item.id, qty: "2" }]);
  assert.equal(error, undefined);
  assert.equal(priced[0].qty, 2);
  assert.equal(typeof priced[0].qty, "number");
});

test("rejects duplicate ids that would stack past stock", () => {
  const { error } = priceOrder([
    { id: console_item.id, qty: console_item.stock },
    { id: console_item.id, qty: console_item.stock }
  ]);
  assert.match(error, /Duplicate/);
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
  const { priced } = priceOrder([
    { id: console_item.id, qty: 1 },
    { id: small_item.id, qty: 1 }
  ]);
  assert.equal(shippingFor(priced).cents, 1800);
});

test("an accessories-only order ships at the small rate", () => {
  const { priced } = priceOrder([{ id: small_item.id, qty: 1 }]);
  assert.equal(shippingFor(priced).cents, 600);
});

console.log("\nstripe form encoding\n");

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

console.log(`\n${passed} checks passed\n`);

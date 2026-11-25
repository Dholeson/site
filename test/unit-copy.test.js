// The shared copy modules (assets/unit-copy.js, unit-card.js, owner-block.js)
// and the policy data they read (data/products.js RETURNS, SHIPPING,
// AUTOMATIC_TAX). Every page and the server-written <head> say a unit's name,
// price, shipping and returns through these, so their exact output is pinned
// here.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { harness } from "./support/harness.js";
import { ROOT } from "./support/store-fixtures.js";
import { FIXTURE_PRODUCTS } from "./support/catalogue-fixture.js";
import { products, RETURNS, SHIPPING, AUTOMATIC_TAX, CONDITION_LABELS, formatMoney } from "../data/products.js";
import { OWNER } from "../data/owner.js";
import {
  DISPATCH, displayId, isBench, shippingOf, unitName, cardTitle, deliveredLine, returnsLine, shareDescription
} from "../assets/unit-copy.js";
import { unitCard } from "../assets/unit-card.js";
import { ownerBlock, questionLine } from "../assets/owner-block.js";
import { SUPPORT_EMAIL } from "../assets/store-config.js";
import { priceOrder, buildSessionPayload } from "../lib/checkout-core.js";

const { section, test, run } = harness();

const IMG = n => `/api/store/img/${String(n).repeat(64)}.jpg`;

// A console-class bench unit at $159.00 and a small-class one at $32.00,
// shaped like /api/store/listings entries.
const consoleUnit = {
  id: "ro-0042", name: "Nintendo 64, Charcoal", platform: "Nintendo 64", category: "console",
  condition: "Refurbished", priceCents: 15900, stock: 1, shippingClass: "console",
  image: IMG("a"), images: [IMG("a"), IMG("b")],
  blurb: "Cleaned, recapped and tested through a full boot.", details: [], source: "bench"
};
const smallUnit = {
  id: "ro-0107", name: "Nintendo 64 Controller, Grey", platform: "Nintendo 64", category: "accessory",
  condition: "Used, good", priceCents: 3200, stock: 1, shippingClass: "small",
  image: IMG("c"), images: [IMG("c")],
  blurb: "Original controller. The stick returns to centre.", details: [], source: "bench"
};
// A hand-made catalogue item: no unit id, condition from CONDITION_LABELS.
const catalogueItem = {
  id: "av-cable-composite", name: "Composite AV Cable", platform: "Multi-platform", category: "accessory",
  condition: "new", priceCents: 1200, stock: 25, shippingClass: "small",
  image: "assets/store/av-cable-1.jpg", blurb: "A new composite cable."
};

section("policy data (data/products.js)");

test("RETURNS: the console term, and no accessory term yet", () => {
  assert.equal(RETURNS.console, "If a console doesn't power on, there's a 30-day return window.");
  assert.equal(RETURNS.accessory, null);
});

test("SHIPPING keeps its cents and gains a Stripe label and a short label", () => {
  assert.equal(SHIPPING.small.cents, 600);
  assert.equal(SHIPPING.console.cents, 1800);
  assert.equal(SHIPPING.small.label, "Shipping (accessories), ships within two business days");
  assert.equal(SHIPPING.console.label, "Shipping (console box), ships within two business days");
  assert.equal(SHIPPING.small.short, "Shipping (accessories)");
  assert.equal(SHIPPING.console.short, "Shipping (console box)");
});

test("condition labels have no em dash", () => {
  assert.equal(CONDITION_LABELS["used-good"], "Used, good");
  assert.equal(CONDITION_LABELS["used-fair"], "Used, fair");
  for (const label of Object.values(CONDITION_LABELS)) assert.ok(!label.includes("—"), label);
});

test("AUTOMATIC_TAX mirrors wrangler.toml [vars] ENABLE_AUTOMATIC_TAX", () => {
  const toml = readFileSync(join(ROOT, "wrangler.toml"), "utf8");
  const vars = toml.split(/^\[/m).find(s => s.startsWith("vars]"));
  assert.ok(vars, "wrangler.toml has a [vars] section");
  const m = vars.match(/^ENABLE_AUTOMATIC_TAX\s*=\s*"([^"]*)"/m);
  assert.ok(m, "[vars] sets ENABLE_AUTOMATIC_TAX");
  assert.equal(AUTOMATIC_TAX, m[1] === "true",
    `data/products.js AUTOMATIC_TAX is ${AUTOMATIC_TAX} but wrangler.toml ENABLE_AUTOMATIC_TAX is "${m[1]}": change both together`);
});

section("unit copy (assets/unit-copy.js)");

test("DISPATCH", () => {
  assert.equal(DISPATCH, "Ships within two business days.");
});

test("displayId and isBench", () => {
  assert.equal(displayId("ro-0042"), "RO-0042");
  assert.equal(isBench(consoleUnit), true);
  assert.equal(isBench({ id: "ro-12" }), true, "a bench-shaped id is bench even without source");
  assert.equal(isBench({ id: "x", source: "bench" }), true);
  assert.equal(isBench(catalogueItem), false);
});

test("shippingOf follows the shipping class, small when unset", () => {
  assert.equal(shippingOf(consoleUnit), SHIPPING.console);
  assert.equal(shippingOf(smallUnit), SHIPPING.small);
  assert.equal(shippingOf({ ...catalogueItem, shippingClass: undefined }), SHIPPING.small);
});

test("console-class bench unit ($159.00)", () => {
  assert.equal(unitName(consoleUnit), "Nintendo 64, Charcoal (RO-0042)");
  assert.equal(cardTitle(consoleUnit), "Nintendo 64, Charcoal (RO-0042): $159.00");
  assert.equal(deliveredLine(consoleUnit), "+ $18.00 shipping = $177.00 delivered.");
  assert.equal(returnsLine(consoleUnit), RETURNS.console);
  assert.equal(shareDescription(consoleUnit),
    "$159.00 + $18.00 shipping. Nintendo 64, unit RO-0042. Refurbished. Cleaned, recapped and tested through a full boot.");
});

test("small-class bench unit ($32.00)", () => {
  assert.equal(unitName(smallUnit), "Nintendo 64 Controller, Grey (RO-0107)");
  assert.equal(cardTitle(smallUnit), "Nintendo 64 Controller, Grey (RO-0107): $32.00");
  assert.equal(deliveredLine(smallUnit),
    "+ $6.00 shipping = $38.00 delivered, or no extra shipping in an order with a console.");
  assert.equal(returnsLine(smallUnit), null, "accessories have no stated term yet");
  assert.equal(returnsLine(smallUnit), RETURNS.accessory);
  assert.equal(shareDescription(smallUnit),
    "$32.00 + $6.00 shipping. Nintendo 64, unit RO-0107. Used, good. Original controller. The stick returns to centre.");
});

test("catalogue item (no unit id)", () => {
  assert.equal(unitName(catalogueItem), "Composite AV Cable");
  assert.equal(cardTitle(catalogueItem), "Composite AV Cable: $12.00");
  assert.equal(deliveredLine(catalogueItem),
    "+ $6.00 shipping = $18.00 delivered, or no extra shipping in an order with a console.");
  assert.equal(returnsLine(catalogueItem), null);
  assert.equal(shareDescription(catalogueItem), "$12.00 + $6.00 shipping. Multi-platform. New. A new composite cable.");
  const fixtureConsole = FIXTURE_PRODUCTS.find(p => p.category === "console");
  assert.equal(returnsLine(fixtureConsole), RETURNS.console);
  assert.ok(shareDescription(fixtureConsole).startsWith(`${formatMoney(fixtureConsole.priceCents)} + $18.00 shipping. `));
});

test("returns and delivered lines follow the data, never their own copy", () => {
  assert.equal(returnsLine({ ...smallUnit, category: "console" }), RETURNS.console);
  assert.ok(deliveredLine(consoleUnit).includes(formatMoney(SHIPPING.console.cents)));
  assert.ok(deliveredLine(smallUnit).includes(formatMoney(SHIPPING.small.cents)));
});

test("names and descriptions are one line", () => {
  const messy = { ...consoleUnit, name: "  Nintendo 64,\n Charcoal ", blurb: "Line one.\n\nLine two.", condition: "Refurbished." };
  assert.equal(unitName(messy), "Nintendo 64, Charcoal (RO-0042)");
  assert.equal(shareDescription(messy), "$159.00 + $18.00 shipping. Nintendo 64, unit RO-0042. Refurbished. Line one. Line two.");
});

section("unit card (assets/unit-card.js)");

test("a bench unit's card", () => {
  const html = unitCard(consoleUnit);
  assert.match(html, /^<article class="unit-card" data-unit="ro-0042">/);
  assert.ok(html.includes(`<img class="unit-card-photo" src="${IMG("a")}" alt="" width="400" height="300" loading="lazy">`));
  assert.ok(html.includes(`<h3 class="unit-card-name"><a href="/product?id=ro-0042">Nintendo 64, Charcoal</a></h3>`));
  assert.ok(html.includes(`<p class="unit-card-price num">$159.00</p>`));
  assert.ok(html.includes(`<p class="unit-card-meta"><span class="id">RO-0042</span> <span class="quiet">+ $18.00 shipping</span></p>`));
  assert.ok(html.includes(`<p class="unit-card-condition quiet">Refurbished</p>`));
  assert.ok(!/<button|chip/.test(html), "no button or chips on a card");
});

test("compact card", () => {
  const html = unitCard(smallUnit, { compact: true });
  assert.match(html, /^<article class="unit-card unit-card--compact"/);
  assert.ok(html.includes(`width="120" height="90"`));
  assert.ok(html.includes(`+ $6.00 shipping`));
});

test("a catalogue item's card shows stock, not an id", () => {
  const html = unitCard(catalogueItem);
  assert.ok(html.includes(`src="/assets/store/av-cable-1.jpg"`), "relative image made root-relative");
  assert.ok(html.includes(`<p class="unit-card-meta">In stock <span class="quiet">`));
  assert.ok(html.includes(`<p class="unit-card-condition quiet">New</p>`));
  assert.ok(unitCard({ ...catalogueItem, stock: 0 }).includes(`>Out of stock <span`));
  assert.ok(!html.includes(`class="id"`));
});

test("unitCard escapes hostile copy", () => {
  const hostile = {
    ...consoleUnit,
    name: `<script>alert("x")</script> & 'q'`,
    condition: `<img src=x onerror=alert(1)>`,
    image: `/api/store/img/x.jpg" onerror="alert(2)`
  };
  const html = unitCard(hostile);
  assert.ok(!html.includes("<script>"), html);
  assert.ok(!html.includes("<img src=x"), html);
  assert.ok(!html.includes(`" onerror="`), html);
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

section("owner block and question line (assets/owner-block.js)");

const ownerAsShipped = { ...OWNER };
const setOwner = values => {
  for (const key of Object.keys(OWNER)) OWNER[key] = null;
  Object.assign(OWNER, values);
};

test("data/owner.js names every field", () => {
  assert.deepEqual(Object.keys(OWNER).sort(), ["about", "benchPhoto", "firstName", "fullName", "place"]);
});

test("ownerBlock with everything null returns ''", () => {
  setOwner({});
  try {
    assert.equal(ownerBlock(), "");
    assert.equal(ownerBlock({ heading: "Who runs dhole.dev" }), "");
    setOwner({ fullName: "Full Name", place: "Somewhere", about: "About." });
    assert.equal(ownerBlock(), "", "no firstName, no block");
  } finally {
    setOwner(ownerAsShipped);
  }
});

test("ownerBlock with a name, place, about line and photo", () => {
  setOwner({
    firstName: "Sam <b>", place: "Portland, Oregon", about: "I fix what I sell.",
    benchPhoto: { src: "/assets/owner/bench.jpg", width: 720, height: 540, alt: "The workbench" }
  });
  try {
    const html = ownerBlock({ heading: "Who runs dhole.dev" });
    assert.ok(html.startsWith(`<section class="owner">`));
    assert.ok(html.includes(`<h2>Who runs dhole.dev</h2>`));
    assert.ok(html.includes(`<p>I'm Sam &lt;b&gt;, in Portland, Oregon. I run dhole.dev on my own, so email <a href="mailto:support@dhole.dev">support@dhole.dev</a> and you'll reach me. I fix what I sell.</p>`), html);
    assert.ok(html.includes(`<img class="owner-photo" src="/assets/owner/bench.jpg" alt="The workbench" width="720" height="540" loading="lazy">`));
    setOwner({ firstName: "Sam", benchPhoto: { src: "/x.jpg" } });
    const bare = ownerBlock();
    assert.ok(bare.includes(`<h2>Who you&#39;re buying from</h2>`), "default heading");
    assert.ok(bare.includes(`<p>I'm Sam. I run dhole.dev on my own`), "no place, no comma");
    assert.ok(!bare.includes("<img"), "a photo without its size is left out");
  } finally {
    setOwner(ownerAsShipped);
  }
});

test("questionLine with and without a unit id", () => {
  assert.equal(SUPPORT_EMAIL, "support@dhole.dev");
  assert.equal(questionLine({ unitId: "ro-0042" }),
    `<p class="ask">Questions about <span class="id">RO-0042</span>? <a href="mailto:support@dhole.dev?subject=Question%20about%20RO-0042">Email support@dhole.dev</a></p>`);
  assert.equal(questionLine(),
    `<p class="ask">Questions? <a href="mailto:support@dhole.dev">Email support@dhole.dev</a></p>`);
  assert.equal(questionLine({ unitId: null }), questionLine());
});

section("Stripe's shipping label (lib/checkout-core.js buildSessionPayload)");

// The label change on Stripe's checkout page and receipts is intentional
// (spec §9): display_name is SHIPPING.<class>.label.
products.push(...FIXTURE_PRODUCTS);
const consoleItem = products.find(p => p.shippingClass === "console");
const smallItem = products.find(p => p.shippingClass === "small");
const payloadFor = (priced, hold) => buildSessionPayload(priced, {
  siteUrl: "https://dhole.dev", currency: "usd", automaticTax: false, shipToCountries: ["US"], hold
});
const rateOf = p => p.shipping_options[0].shipping_rate_data;

test("a console order sends SHIPPING.console.label", () => {
  const { priced, error } = priceOrder([{ id: consoleItem.id, qty: 1 }, { id: smallItem.id, qty: 1 }]);
  assert.equal(error, undefined);
  const rate = rateOf(payloadFor(priced));
  assert.equal(rate.display_name, SHIPPING.console.label);
  assert.equal(rate.fixed_amount.amount, SHIPPING.console.cents);
});

test("an accessory order sends SHIPPING.small.label", () => {
  const { priced, error } = priceOrder([{ id: smallItem.id, qty: 1 }]);
  assert.equal(error, undefined);
  const rate = rateOf(payloadFor(priced));
  assert.equal(rate.display_name, SHIPPING.small.label);
  assert.equal(rate.fixed_amount.amount, SHIPPING.small.cents);
});

test("bench orders use the same labels", () => {
  const entry = product => ({ product, status: "available", reservedUntil: null });
  const hold = { token: "hold_abc", expiresAt: 1795000000 };
  for (const [unit, label] of [[consoleUnit, SHIPPING.console.label], [smallUnit, SHIPPING.small.label]]) {
    const { priced, error } = priceOrder([{ id: unit.id, qty: 1 }], { bench: new Map([[unit.id, entry(unit)]]) });
    assert.equal(error, undefined);
    assert.equal(rateOf(payloadFor(priced, hold)).display_name, label);
  }
});

await run();

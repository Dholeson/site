// Tests for what search engines and link previews see: the product page's
// server-written <head> (functions/product.js), the case-study page's
// (functions/case.js), the sitemap (functions/sitemap.xml.js), lib/seo.js,
// and the site-wide rules that keep URLs clean: canonicals, internal links,
// robots.txt, _redirects, _routes.json, the *.pages.dev noindex, and the
// security headers the Functions mirror from _headers.
//
// Everything here fails silently in production (a wrong canonical drops pages
// from Google; a preview card falls back to the generic image), which is why
// it's pinned.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { onRequest as product } from "../functions/product.js";
import { onRequest as caseFn } from "../functions/case.js";
import { onRequest as sitemap } from "../functions/sitemap.xml.js";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { products, SHIPPING, formatMoney } from "../data/products.js";
import { work, findWork } from "../data/portfolio.js";
import {
  CASE_IMAGE, FALLBACK_IMAGE, PAGE_HEADERS, SITE_PAGES, STATES, caseHead, caseNotFoundHead, clip, decimal,
  injectHead, itemCondition, jsonLd, notFoundHead, productHead, SEO_START, SEO_END
} from "../lib/seo.js";
import { sitemapListings } from "../lib/store-db.js";
import { harness } from "./support/harness.js";
import { FIXTURE_PRODUCTS } from "./support/catalogue-fixture.js";
import { ROOT, TOKEN, makeEnv, pushListing, holdDirect, iso, call } from "./support/store-fixtures.js";

// The live catalogue is empty (used hardware is all bench units); stand-ins
// exercise the hand-typed catalogue's heads and sitemap entries.
products.push(...FIXTURE_PRODUCTS);

const { section, test, run } = harness();
const read = rel => readFileSync(join(ROOT, rel), "utf8");
const SHELL = read("product.html");

// Calls functions/product.js the way Pages does, with next() serving
// product.html (or whatever `asset` says).
async function page(env, path, { method = "GET", host = "dhole.dev", asset } = {}) {
  const request = new Request(`https://${host}${path}`, { method });
  const next = async () => asset ? asset() : new Response(method === "HEAD" ? null : SHELL, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"abc"', "Cache-Control": "public, max-age=0, must-revalidate" }
  });
  const res = await product({ request, env, params: {}, data: {}, waitUntil() {}, next });
  const html = await res.text();
  return { res, status: res.status, html, head: html.slice(0, html.indexOf("</head>")) };
}

const ldBlocks = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const ldOf = (html, type) => ldBlocks(html).find(b => b["@type"] === type);
const metaContent = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:name|property)="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)"`));
  return m ? m[1] : null;
};
const canonicalOf = html => (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || null;
const titleOf = html => (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? null;
// Entities back to text, to compare a tag with the copy it was built from.
const text = s => s === null ? null : s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const unitStatusOf = html => metaContent(html, "unit-status");
const checkoutOf = html => metaContent(html, "checkout");
const OG_SITE = "https://dhole.dev/assets/brand/og-site.png";
const OG_PORTFOLIO = "https://dhole.dev/assets/brand/og-portfolio.png";

// A bench unit as lib/store-db.js toProduct shapes it, and a hand-made item,
// both with copy free of em dashes, for calling productHead() directly.
const PHOTO = `/api/store/img/${"a".repeat(64)}.jpg`;
const BENCH_UNIT = {
  id: "ro-0042", name: "Nintendo 64, Charcoal", platform: "Nintendo 64", category: "console",
  condition: "Refurbished", priceCents: 15900, stock: 1, shippingClass: "console",
  image: PHOTO, images: [PHOTO], blurb: "Opened, cleaned and recapped.", details: [], source: "bench"
};
const CATALOGUE_ITEM = {
  id: "plain-cable", name: "Composite AV Cable", platform: "Multi-platform", category: "accessory",
  condition: "new", priceCents: 1200, stock: 5, shippingClass: "small",
  image: "assets/store/av-cable.svg", blurb: "A new multi-out composite cable.", details: []
};

// ---------- lib/seo.js ----------

section("lib/seo.js");

test("decimal() formats integer cents without floating point", () => {
  assert.equal(decimal(14500), "145.00");
  assert.equal(decimal(1805), "18.05");
  assert.equal(decimal(5), "0.05");
  assert.equal(decimal(0), "0.00");
  assert.equal(decimal(500000), "5000.00");
});

test("itemCondition() reads free-text bench conditions", () => {
  assert.equal(itemCondition("refurbished"), "https://schema.org/RefurbishedCondition");
  assert.equal(itemCondition("Refurbished — recapped"), "https://schema.org/RefurbishedCondition");
  assert.equal(itemCondition("new"), "https://schema.org/NewCondition");
  assert.equal(itemCondition("Brand new"), "https://schema.org/NewCondition");
  assert.equal(itemCondition("New, open box"), "https://schema.org/UsedCondition");
  assert.equal(itemCondition("Like new"), "https://schema.org/UsedCondition");
  assert.equal(itemCondition("used-good"), "https://schema.org/UsedCondition");
  assert.equal(itemCondition("Used — Fair"), "https://schema.org/UsedCondition");
});

test("clip() keeps descriptions under the limit and ends on a word", () => {
  const long = "word ".repeat(80);
  const c = clip(long, 160);
  assert.ok(c.length <= 160, c.length);
  assert.ok(c.endsWith("word…"));
  assert.equal(clip("  short\n\ntext  "), "short text");
});

test("jsonLd() can't close its <script> and still parses to the same value", () => {
  const v = { name: `</script><script>alert(1)</script> & "q" \u2028` };
  const s = jsonLd(v);
  assert.ok(!/<|>|&/.test(s));
  assert.deepEqual(JSON.parse(s), v);
});

test("productHead() refuses an unknown state", () => {
  assert.throws(() => productHead(products[0], { state: "maybe" }), /Unknown product state/);
});

test("injectHead() replaces exactly the marked block, and refuses missing or doubled markers", () => {
  const out = injectHead(SHELL, "<title>X</title>");
  assert.ok(out.includes("<title>X</title>"));
  assert.ok(!out.includes(SEO_START) && !out.includes(SEO_END));
  assert.equal(out.slice(out.indexOf("</head>")), SHELL.slice(SHELL.indexOf("</head>")), "the body is untouched");
  assert.throws(() => injectHead("<head></head>", "x"));
  assert.throws(() => injectHead(SHELL + SHELL, "x"));
});

test("the fallback card is og-site.png at 1200x630, and the case card og-portfolio.png", () => {
  assert.deepEqual(FALLBACK_IMAGE, { path: "/assets/brand/og-site.png", width: 1200, height: 630 });
  assert.deepEqual(CASE_IMAGE, { path: "/assets/brand/og-portfolio.png", width: 1200, height: 630 });
});

test("a bench head names the unit with its uppercase id; a gone unit's titles carry no price", () => {
  const h = state => productHead(BENCH_UNIT, { state });
  assert.equal(titleOf(h("in-stock")), "Nintendo 64, Charcoal (RO-0042): $159.00 | dhole.dev");
  assert.equal(metaContent(h("in-stock"), "og:title"), "Nintendo 64, Charcoal (RO-0042): $159.00");
  assert.equal(metaContent(h("reserved"), "twitter:title"), "Nintendo 64, Charcoal (RO-0042): $159.00");
  assert.equal(titleOf(h("sold")), "Sold: Nintendo 64, Charcoal (RO-0042) | dhole.dev");
  assert.equal(titleOf(h("withdrawn")), "No longer listed: Nintendo 64, Charcoal (RO-0042) | dhole.dev");
  for (const state of ["sold", "withdrawn"]) {
    for (const key of ["og:title", "twitter:title"]) {
      assert.ok(metaContent(h(state), key).includes("(RO-0042)"), `${state} ${key}`);
      assert.ok(!metaContent(h(state), key).includes("$"), `${state} ${key}`);
    }
    assert.ok(!titleOf(h(state)).includes("$"), state);
  }
  assert.equal(text(metaContent(h("sold"), "description")), "This unit has sold. See what's listed now at dhole.dev.");
  assert.equal(text(metaContent(h("withdrawn"), "description")), "This unit is no longer listed. See what's listed now at dhole.dev.");
  assert.equal(text(metaContent(h("in-stock"), "description")),
    "$159.00 + $18.00 shipping. Nintendo 64, unit RO-0042. Refurbished. Opened, cleaned and recapped.");
  assert.equal(metaContent(h("in-stock"), "og:image:alt"), "Photo 1 of RO-0042, Nintendo 64, Charcoal");
});

test("unit-status: available, reserved, sold, withdrawn on bench heads; unknown when not found; none on catalogue items", () => {
  const expected = { "in-stock": "available", "reserved": "reserved", "sold": "sold", "withdrawn": "withdrawn" };
  for (const [state, status] of Object.entries(expected)) {
    assert.equal(unitStatusOf(productHead(BENCH_UNIT, { state })), status, state);
    // Bench by id alone counts too (the shape check-layout's fixtures and old caches have).
    assert.equal(unitStatusOf(productHead({ ...BENCH_UNIT, source: undefined }, { state })), status, state);
  }
  for (const state of ["in-stock", "out-of-stock"]) {
    assert.equal(unitStatusOf(productHead(CATALOGUE_ITEM, { state })), null, state);
  }
  const nf = notFoundHead();
  assert.equal(unitStatusOf(nf), "unknown");
  assert.equal(metaContent(nf, "robots"), "noindex");
  assert.equal(titleOf(nf), "Not found | dhole.dev");
  assert.equal(metaContent(nf, "description"), "That listing isn&#39;t here any more. It may have sold.");
});

test("the checkout=off meta appears exactly when checkout: false is passed, bench or catalogue, in every state", () => {
  const cases = [[BENCH_UNIT, ["in-stock", "reserved", "sold", "withdrawn"]], [CATALOGUE_ITEM, ["in-stock", "out-of-stock"]]];
  for (const [p, states] of cases) {
    for (const state of states) {
      const off = productHead(p, { state, checkout: false });
      assert.equal(checkoutOf(off), "off", `${p.id} ${state}`);
      assert.equal(off.split('name="checkout"').length, 2, "exactly one");
      assert.ok(off.includes('<meta name="checkout" content="off" />'));
      for (const on of [productHead(p, { state, checkout: true }), productHead(p, { state })]) {
        assert.ok(!on.includes('name="checkout"'), `${p.id} ${state}`);
      }
    }
  }
});

test("no em dash in anything the heads generate", () => {
  const caseWork = { id: "x", title: "A tool", pitch: "Does one thing well." };
  const heads = [
    ...STATES.filter(s => s !== "out-of-stock").map(state => productHead(BENCH_UNIT, { state, checkout: false })),
    ...["in-stock", "out-of-stock"].map(state => productHead(CATALOGUE_ITEM, { state, checkout: false })),
    // A long blurb, so clip() cuts and adds its ellipsis.
    productHead({ ...BENCH_UNIT, blurb: "word ".repeat(80) }),
    notFoundHead(), caseHead(caseWork), caseNotFoundHead()
  ];
  for (const h of heads) assert.ok(!h.includes("—"), h);
});

// ---------- product.html ----------

section("product.html: the shell the Function fills");

test("one seo:start / seo:end block, holding the title, and no canonical anywhere", () => {
  assert.equal(SHELL.split(SEO_START).length, 2);
  assert.equal(SHELL.split(SEO_END).length, 2);
  const block = SHELL.slice(SHELL.indexOf(SEO_START), SHELL.indexOf(SEO_END));
  assert.ok(block.includes("<title>"));
  // A canonical in the shell would claim every product is one page (it used
  // to point at the store, which told Google to drop every product).
  assert.ok(!/rel="canonical"/.test(SHELL));
});

// ---------- functions/product.js ----------

section("functions/product.js: hand-made items");

test("an in-stock item: 200, its own title, canonical, card and Product data", async () => {
  const p = products.find(x => x.id === "n64-console-charcoal");
  const r = await page(makeEnv(), `/product?id=${p.id}`);
  assert.equal(r.status, 200);
  assert.ok(r.head.includes(`<title>${p.name}: $145.00 | dhole.dev</title>`));
  assert.equal(metaContent(r.head, "og:title"), `${p.name}: $145.00`);
  assert.equal(metaContent(r.head, "twitter:title"), `${p.name}: $145.00`);
  assert.equal(canonicalOf(r.head), "https://dhole.dev/product?id=n64-console-charcoal");
  assert.equal(metaContent(r.head, "og:url"), "https://dhole.dev/product?id=n64-console-charcoal");
  assert.equal(metaContent(r.head, "og:type"), "product");
  // Price and shipping lead: what a buyer reading a preview card wants first.
  assert.ok(metaContent(r.head, "description").startsWith("$145.00 + $18.00 shipping. Nintendo 64. Refurbished. "),
    metaContent(r.head, "description"));
  assert.ok(metaContent(r.head, "description").length <= 160);
  assert.equal(metaContent(r.head, "og:description"), metaContent(r.head, "description"));
  // SVG illustrations don't render in previews: the generic card, with its size.
  assert.equal(metaContent(r.head, "og:image"), OG_SITE);
  assert.equal(metaContent(r.head, "twitter:image"), OG_SITE);
  assert.equal(metaContent(r.head, "og:image:width"), "1200");
  assert.equal(metaContent(r.head, "og:image:height"), "630");
  assert.equal(metaContent(r.head, "product:price:amount"), "145.00");
  assert.equal(metaContent(r.head, "product:availability"), "in stock");
  assert.ok(!/name="robots"/.test(r.head));
  assert.equal(unitStatusOf(r.head), null, "unit-status is for bench units only");
  assert.equal(checkoutOf(r.head), null, "STRIPE_SECRET_KEY is set: no checkout=off");
  assert.ok(!r.head.includes("Product | dhole.dev"), "the fallback block is gone");

  const ld = ldOf(r.head, "Product");
  assert.equal(ld.name, p.name);
  assert.equal(ld.sku, p.id);
  assert.deepEqual(ld.image, ["https://dhole.dev/assets/store/n64-console.svg"]);
  assert.equal(ld.offers.price, "145.00");
  assert.equal(ld.offers.priceCurrency, "USD");
  assert.equal(ld.offers.availability, "https://schema.org/InStock");
  assert.equal(ld.offers.itemCondition, "https://schema.org/RefurbishedCondition");
  assert.equal(ld.offers.shippingDetails.shippingRate.value, "18.00");
  assert.deepEqual(ld.offers.shippingDetails.shippingDestination, [{ "@type": "DefinedRegion", "addressCountry": "US" }]);
  const crumbs = ldOf(r.head, "BreadcrumbList");
  assert.deepEqual(crumbs.itemListElement.map(i => i.item),
    ["https://dhole.dev/", "https://dhole.dev/store", "https://dhole.dev/product?id=n64-console-charcoal"]);
});

test("an accessory's offer carries the small-box rate, and its description leads with it", async () => {
  const r = await page(makeEnv(), "/product?id=snes-controller");
  assert.equal(ldOf(r.head, "Product").offers.shippingDetails.shippingRate.value, decimal(SHIPPING.small.cents));
  assert.equal(ldOf(r.head, "Product").offers.itemCondition, "https://schema.org/UsedCondition");
  assert.ok(metaContent(r.head, "description").startsWith("$28.00 + $6.00 shipping. SNES. Used, good. "),
    metaContent(r.head, "description"));
});

test("stock 0: still 200 and indexable, marked out of stock", async () => {
  const p = products.find(x => x.id === "snes-console");
  const before = p.stock;
  p.stock = 0;
  try {
    const r = await page(makeEnv(), "/product?id=snes-console");
    assert.equal(r.status, 200);
    assert.ok(canonicalOf(r.head));
    assert.equal(ldOf(r.head, "Product").offers.availability, "https://schema.org/OutOfStock");
    assert.ok(metaContent(r.head, "description").startsWith("Out of stock for now. $135.00 + $18.00 shipping."),
      metaContent(r.head, "description"));
    assert.equal(titleOf(r.head), `${p.name}: $135.00 | dhole.dev`);
  } finally {
    p.stock = before;
  }
});

test("SHIP_TO_COUNTRIES sets the shipping destinations", async () => {
  const r = await page(makeEnv({ SHIP_TO_COUNTRIES: "US, ca" }), "/product?id=snes-console");
  assert.deepEqual(ldOf(r.head, "Product").offers.shippingDetails.shippingDestination.map(d => d.addressCountry), ["US", "CA"]);
});

test("no id, an unknown id: 404, noindex, the page still renders its message", async () => {
  for (const path of ["/product", "/product?id=", "/product?id=nope", "/product?id=ro-1", "/product?id=ro-9999"]) {
    const r = await page(makeEnv(), path);
    assert.equal(r.status, 404, path);
    assert.equal(metaContent(r.head, "robots"), "noindex", path);
    assert.equal(canonicalOf(r.head), null, path);
    assert.equal(unitStatusOf(r.head), "unknown", path);
    assert.equal(titleOf(r.head), "Not found | dhole.dev", path);
    assert.ok(r.html.includes('id="product-main"'), path);
  }
});

test("checkout=off rides on every product head exactly while STRIPE_SECRET_KEY is unset", async () => {
  const off = [makeEnv({ STRIPE_SECRET_KEY: undefined }), makeEnv({ STRIPE_SECRET_KEY: "" })];
  for (const env of off) {
    await pushListing(bench, env, "ro-0050");
    for (const id of ["n64-console-charcoal", "snes-controller", "ro-0050"]) {
      const r = await page(env, `/product?id=${id}`);
      assert.equal(r.status, 200, id);
      assert.equal(checkoutOf(r.head), "off", id);
    }
  }
  const on = makeEnv();
  await pushListing(bench, on, "ro-0050");
  for (const id of ["n64-console-charcoal", "snes-controller", "ro-0050"]) {
    const r = await page(on, `/product?id=${id}`);
    assert.ok(!r.head.includes('name="checkout"'), id);
  }
});

section("functions/product.js: bench units");

test("a unit on sale: 200, its real photo on the card, every photo in the data", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const r = await page(env, "/product?id=ro-0042");
  assert.equal(r.status, 200);
  const og = metaContent(r.head, "og:image");
  assert.match(og, /^https:\/\/dhole\.dev\/api\/store\/img\/[0-9a-f]{64}\.jpg$/);
  assert.equal(metaContent(r.head, "twitter:image"), og);
  assert.equal(metaContent(r.head, "og:image:width"), null, "a photo's size isn't known");
  assert.equal(unitStatusOf(r.head), "available");
  // The name, then the id buyers quote back, then the price.
  assert.equal(text(titleOf(r.head)), "PlayStation 4 Slim 500GB — Jet Black (RO-0042): $229.00 | dhole.dev");
  assert.equal(text(metaContent(r.head, "og:title")), "PlayStation 4 Slim 500GB — Jet Black (RO-0042): $229.00");
  assert.equal(metaContent(r.head, "twitter:title"), metaContent(r.head, "og:title"));
  const ld = ldOf(r.head, "Product");
  assert.equal(ld.image.length, 2);
  assert.equal(ld.image[0], og);
  assert.equal(ld.offers.price, "229.00");
  assert.equal(ld.offers.availability, "https://schema.org/InStock");
  assert.equal(ld.offers.itemCondition, "https://schema.org/RefurbishedCondition");
});

// One per shipping class: a bench description starts with the price plus
// what that class ships for on its own, then the platform and the unit id.
test("a console-class unit's description: price + $18.00 shipping, platform, unit id", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0042");
  const r = await page(env, "/product?id=ro-0042");
  const d = text(metaContent(r.head, "description"));
  assert.ok(d.startsWith(`$229.00 + ${formatMoney(SHIPPING.console.cents)} shipping. PlayStation 4, unit RO-0042. `), d);
  assert.equal(SHIPPING.console.cents, 1800);
  assert.ok(d.length <= 160);
  assert.equal(metaContent(r.head, "og:description"), metaContent(r.head, "description"));
});

test("a small-class unit's description: price + $6.00 shipping, platform, unit id", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0047", {
    name: "Nintendo 64 Controller, Grey", platform: "Nintendo 64", category: "accessory",
    condition: "Used, good", price_cents: 3200, shipping_class: "small",
    blurb: "Original controller. The stick returns to centre."
  });
  const r = await page(env, "/product?id=ro-0047");
  assert.equal(r.status, 200);
  assert.equal(text(metaContent(r.head, "description")),
    `$32.00 + ${formatMoney(SHIPPING.small.cents)} shipping. Nintendo 64, unit RO-0047. Used, good. Original controller. The stick returns to centre.`);
  assert.equal(SHIPPING.small.cents, 600);
  assert.equal(titleOf(r.head), "Nintendo 64 Controller, Grey (RO-0047): $32.00 | dhole.dev");
  assert.equal(ldOf(r.head, "Product").offers.shippingDetails.shippingRate.value, "6.00");
  assert.equal(unitStatusOf(r.head), "available");
});

test("bench copy is escaped in attributes and can't break out of the JSON-LD", async () => {
  const env = makeEnv();
  const name = `Evil </script><script>alert(1)</script> "quoted" & <b>`;
  const res = await pushListing(bench, env, "ro-0043", { name, blurb: `</script><img src=x onerror=alert(1)>` });
  assert.ok(res.status === 200 || res.status === 201, `push: ${res.status}`);
  const r = await page(env, "/product?id=ro-0043");
  assert.equal(r.status, 200);
  assert.ok(!r.head.includes("<script>alert(1)"), "no injected script element");
  assert.ok(!r.head.includes("<img src=x"), "no injected element");
  assert.ok(r.head.includes("&lt;/script&gt;"), "escaped in <title> and attributes");
  assert.equal(ldOf(r.head, "Product").name, name, "the JSON-LD still says exactly the name");
  // Every inline script is a JSON-LD data block.
  for (const m of r.head.matchAll(/<script\b([^>]*)>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    assert.equal(m[1].trim(), 'type="application/ld+json"');
  }
});

test("a unit in someone's checkout: 200, out of stock for now; a lapsed hold: in stock", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0044");
  holdDirect(env, "ro-0044", "cs_test_live", Date.now() + 600_000);
  let r = await page(env, "/product?id=ro-0044");
  assert.equal(r.status, 200);
  assert.equal(ldOf(r.head, "Product").offers.availability, "https://schema.org/OutOfStock");
  assert.equal(unitStatusOf(r.head), "reserved");
  assert.ok(text(metaContent(r.head, "description")).startsWith("$229.00 + $18.00 shipping. "), "a hold may lapse: the offer stands");
  assert.match(text(metaContent(r.head, "og:title")), /\(RO-0044\): \$229\.00$/);
  holdDirect(env, "ro-0044", "cs_test_old", Date.now() - 1000);
  r = await page(env, "/product?id=ro-0044");
  assert.equal(ldOf(r.head, "Product").offers.availability, "https://schema.org/InStock");
  assert.equal(unitStatusOf(r.head), "available");
});

test("a sold unit: 410, noindex, no Product data, a 'Sold' card", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0045");
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0045'").run(iso(Date.now()));
  const r = await page(env, "/product?id=ro-0045");
  assert.equal(r.status, 410);
  assert.equal(metaContent(r.head, "robots"), "noindex");
  assert.equal(canonicalOf(r.head), null);
  assert.equal(ldBlocks(r.head).length, 0);
  assert.equal(unitStatusOf(r.head), "sold");
  const name = "PlayStation 4 Slim 500GB — Jet Black";
  assert.equal(text(metaContent(r.head, "og:title")), `Sold: ${name} (RO-0045)`);
  assert.equal(text(metaContent(r.head, "twitter:title")), `Sold: ${name} (RO-0045)`);
  assert.equal(text(titleOf(r.head)), `Sold: ${name} (RO-0045) | dhole.dev`);
  for (const s of [metaContent(r.head, "og:title"), metaContent(r.head, "twitter:title"), titleOf(r.head)]) {
    assert.ok(!s.includes("$"), `no price on a sold unit: ${s}`);
  }
  assert.equal(text(metaContent(r.head, "description")), "This unit has sold. See what's listed now at dhole.dev.");
  assert.equal(metaContent(r.head, "product:price:amount"), null);
  assert.ok(r.html.includes('id="product-main"'));
});

test("a withdrawn unit: 404, noindex, a 'No longer listed' card with no price", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0046");
  await call(bench, env, "POST", "/api/bench/listings/ro-0046/withdraw", { token: TOKEN, body: { reason: "pulled" } });
  const r = await page(env, "/product?id=ro-0046");
  assert.equal(r.status, 404);
  assert.equal(metaContent(r.head, "robots"), "noindex");
  assert.equal(ldBlocks(r.head).length, 0);
  assert.equal(unitStatusOf(r.head), "withdrawn");
  const name = "PlayStation 4 Slim 500GB — Jet Black";
  assert.equal(text(metaContent(r.head, "og:title")), `No longer listed: ${name} (RO-0046)`);
  assert.equal(text(metaContent(r.head, "twitter:title")), `No longer listed: ${name} (RO-0046)`);
  for (const s of [metaContent(r.head, "og:title"), metaContent(r.head, "twitter:title"), titleOf(r.head)]) {
    assert.ok(!s.includes("$"), `no price on a withdrawn unit: ${s}`);
  }
  assert.equal(text(metaContent(r.head, "description")), "This unit is no longer listed. See what's listed now at dhole.dev.");
});

section("functions/product.js: never worse than the static file");

test("no D1 binding: a bench id gets the shell unchanged, 200", async () => {
  const r = await page(makeEnv({ DB: undefined }), "/product?id=ro-0042");
  assert.equal(r.status, 200);
  assert.equal(r.html, SHELL);
});

test("D1 failing: the shell unchanged, 200", async () => {
  const env = makeEnv({ DB: { prepare() { throw new Error("D1 down"); } } });
  const err = console.error; console.error = () => {};
  try {
    const r = await page(env, "/product?id=ro-0042");
    assert.equal(r.status, 200);
    assert.equal(r.html, SHELL);
  } finally { console.error = err; }
});

test("a shell that lost its markers goes out unchanged", async () => {
  const bare = "<!doctype html><html><head><title>t</title></head><body></body></html>";
  const err = console.error; console.error = () => {};
  try {
    const r = await page(makeEnv(), "/product?id=snes-console", {
      asset: () => new Response(bare, { headers: { "Content-Type": "text/html" } })
    });
    assert.equal(r.status, 200);
    assert.equal(r.html, bare);
  } finally { console.error = err; }
});

test("a non-OK or non-HTML asset passes straight through", async () => {
  const r = await page(makeEnv(), "/product?id=snes-console", { asset: () => new Response("gone", { status: 404 }) });
  assert.equal(r.status, 404);
  assert.equal(r.html, "gone");
});

test("HEAD answers with the same status and no body", async () => {
  const env = makeEnv();
  assert.equal((await page(env, "/product?id=snes-console", { method: "HEAD" })).status, 200);
  const r = await page(env, "/product?id=nope", { method: "HEAD" });
  assert.equal(r.status, 404);
  assert.equal(r.html, "");
});

test("the security headers _headers gives static pages, and no stale validators", async () => {
  const r = await page(makeEnv(), "/product?id=snes-console");
  for (const [k, v] of Object.entries(PAGE_HEADERS)) assert.equal(r.res.headers.get(k), v, k);
  assert.equal(r.res.headers.get("ETag"), null);
  assert.match(r.res.headers.get("Content-Type"), /^text\/html/);
  assert.equal(r.res.headers.get("X-Robots-Tag"), null);
});

test("*.pages.dev copies say noindex", async () => {
  for (const host of ["dhole-dev.pages.dev", "claude-x.dhole-dev.pages.dev"]) {
    const r = await page(makeEnv(), "/product?id=snes-console", { host });
    assert.equal(r.res.headers.get("X-Robots-Tag"), "noindex", host);
    // The canonical still names the real site.
    assert.equal(canonicalOf(r.head), "https://dhole.dev/product?id=snes-console");
  }
});

// ---------- functions/case.js ----------

section("functions/case.js: case-study heads");

// A stand-in shell: case.html itself belongs to the portfolio pages, and
// test/case-head.test.js runs the real one through this Function.
const CASE_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <!-- seo:start: functions/case.js writes this block per case study -->
  <title>Case study | dhole.dev</title>
  <meta name="description" content="A product case study." />
  <!-- seo:end -->
  <link rel="stylesheet" href="/assets/site.css?v=2" />
</head>
<body>
  <header class="site-header"></header>
  <main><div class="wrap"><article id="case-main"></article></div></main>
</body>
</html>
`;
const CASE_BODY = CASE_SHELL.slice(CASE_SHELL.indexOf("</head>"));

async function casePage(env, path, { method = "GET", host = "dhole.dev", asset } = {}) {
  const request = new Request(`https://${host}${path}`, { method });
  const next = async () => asset ? asset() : new Response(method === "HEAD" ? null : CASE_SHELL, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"abc"', "Cache-Control": "public, max-age=600" }
  });
  const res = await caseFn({ request, env, params: {}, data: {}, waitUntil() {}, next });
  const html = await res.text();
  return { res, status: res.status, html, head: html.slice(0, html.indexOf("</head>")) };
}

const quietly = async fn => {
  const err = console.error; console.error = () => {};
  try { return await fn(); } finally { console.error = err; }
};

test("a known id: 200, its own title, description, canonical, og:url and the portfolio card", async () => {
  const w = findWork("discover-cleaner");
  assert.ok(w, "data/portfolio.js has discover-cleaner");
  const r = await casePage(makeEnv(), "/case?id=discover-cleaner");
  assert.equal(r.status, 200);
  assert.equal(text(titleOf(r.head)), `${w.title}: case study | dhole.dev`);
  assert.equal(canonicalOf(r.head), "https://dhole.dev/case?id=discover-cleaner");
  assert.equal(metaContent(r.head, "og:url"), "https://dhole.dev/case?id=discover-cleaner");
  assert.equal(metaContent(r.head, "og:type"), "article");
  assert.equal(text(metaContent(r.head, "og:title")), `${w.title}: case study`);
  assert.equal(text(metaContent(r.head, "description")), clip(w.pitch));
  assert.equal(metaContent(r.head, "og:description"), metaContent(r.head, "description"));
  assert.equal(metaContent(r.head, "og:image"), OG_PORTFOLIO);
  assert.equal(metaContent(r.head, "og:image:width"), "1200");
  assert.equal(metaContent(r.head, "og:image:height"), "630");
  assert.equal(metaContent(r.head, "twitter:card"), "summary_large_image");
  assert.equal(metaContent(r.head, "twitter:title"), metaContent(r.head, "og:title"));
  assert.equal(metaContent(r.head, "twitter:image"), OG_PORTFOLIO);
  assert.equal(metaContent(r.head, "robots"), null);
  assert.ok(!r.head.includes("A product case study."), "the fallback block is gone");
  assert.equal(r.html.slice(r.html.indexOf("</head>")), CASE_BODY, "the body is untouched");
});

test("every case study gets 200 and a canonical naming its own id", async () => {
  for (const w of work) {
    const r = await casePage(makeEnv(), `/case?id=${encodeURIComponent(w.id)}`);
    assert.equal(r.status, 200, w.id);
    assert.equal(canonicalOf(r.head), `https://dhole.dev/case?id=${encodeURIComponent(w.id)}`, w.id);
    assert.ok(!/\.html\b/.test(canonicalOf(r.head)), w.id);
  }
});

test("an old id (an alias): 200, with the canonical naming the current id", async () => {
  const aliased = work.filter(w => (w.aliases || []).length);
  assert.ok(aliased.length, "data/portfolio.js still has an alias to test");
  for (const w of aliased) {
    for (const alias of w.aliases) {
      const r = await casePage(makeEnv(), `/case?id=${encodeURIComponent(alias)}`);
      assert.equal(r.status, 200, alias);
      assert.equal(canonicalOf(r.head), `https://dhole.dev/case?id=${w.id}`, alias);
      assert.equal(metaContent(r.head, "og:url"), `https://dhole.dev/case?id=${w.id}`, alias);
    }
  }
  const r = await casePage(makeEnv(), "/case?id=spotify-discover-cleaner");
  assert.equal(canonicalOf(r.head), "https://dhole.dev/case?id=discover-cleaner");
});

test("no id or an unknown id: 404, noindex, no canonical, the page still renders its message", async () => {
  for (const path of ["/case", "/case?id=", "/case?id=nope", `/case?id=${encodeURIComponent('<script>"x"')}`]) {
    const r = await casePage(makeEnv(), path);
    assert.equal(r.status, 404, path);
    assert.equal(metaContent(r.head, "robots"), "noindex", path);
    assert.equal(canonicalOf(r.head), null, path);
    assert.equal(titleOf(r.head), "Case study not found | dhole.dev", path);
    assert.ok(!r.head.includes("<script>"), path);
    assert.equal(r.html.slice(r.html.indexOf("</head>")), CASE_BODY, path);
  }
});

test("a shell without the markers goes out unchanged with 200", async () => {
  const bare = "<!doctype html><html><head><title>t</title></head><body></body></html>";
  for (const path of ["/case?id=discover-cleaner", "/case?id=nope"]) {
    const r = await quietly(() => casePage(makeEnv(), path, {
      asset: () => new Response(bare, { headers: { "Content-Type": "text/html" } })
    }));
    assert.equal(r.status, 200, path);
    assert.equal(r.html, bare, path);
  }
});

test("a non-OK or non-HTML asset, or a POST, passes straight through", async () => {
  let r = await casePage(makeEnv(), "/case?id=discover-cleaner", { asset: () => new Response("gone", { status: 404 }) });
  assert.equal(r.status, 404);
  assert.equal(r.html, "gone");
  r = await casePage(makeEnv(), "/case?id=discover-cleaner", {
    asset: () => new Response("{}", { headers: { "Content-Type": "application/json" } })
  });
  assert.equal(r.html, "{}");
  r = await casePage(makeEnv(), "/case?id=discover-cleaner", { method: "POST", asset: () => new Response("as is", { status: 405 }) });
  assert.equal(r.status, 405);
  assert.equal(r.html, "as is");
});

test("HEAD answers with the same status and no body", async () => {
  let r = await casePage(makeEnv(), "/case?id=discover-cleaner", { method: "HEAD" });
  assert.equal(r.status, 200);
  assert.equal(r.html, "");
  r = await casePage(makeEnv(), "/case?id=nope", { method: "HEAD" });
  assert.equal(r.status, 404);
  assert.equal(r.html, "");
});

test("the security headers, revalidation, no stale validators; *.pages.dev says noindex", async () => {
  const r = await casePage(makeEnv(), "/case?id=discover-cleaner");
  for (const [k, v] of Object.entries(PAGE_HEADERS)) assert.equal(r.res.headers.get(k), v, k);
  assert.equal(r.res.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
  assert.equal(r.res.headers.get("ETag"), null);
  assert.match(r.res.headers.get("Content-Type"), /^text\/html/);
  assert.equal(r.res.headers.get("X-Robots-Tag"), null);
  const nf = await casePage(makeEnv(), "/case?id=nope");
  for (const [k, v] of Object.entries(PAGE_HEADERS)) assert.equal(nf.res.headers.get(k), v, `404 ${k}`);
  for (const host of ["dhole-dev.pages.dev", "claude-x.dhole-dev.pages.dev"]) {
    const p = await casePage(makeEnv(), "/case?id=discover-cleaner", { host });
    assert.equal(p.res.headers.get("X-Robots-Tag"), "noindex", host);
    assert.equal(canonicalOf(p.head), "https://dhole.dev/case?id=discover-cleaner", "the canonical names the real site");
  }
});

test("/case stays out of the sitemap", () => {
  assert.ok(!SITE_PAGES.some(p => p.startsWith("/case")));
});

// ---------- the sitemap ----------

section("functions/sitemap.xml.js");

async function getSitemap(env, { method = "GET", host = "dhole.dev" } = {}) {
  const request = new Request(`https://${host}/sitemap.xml`, { method });
  const res = await sitemap({ request, env, params: {}, data: {}, waitUntil() {}, next() {} });
  return { res, status: res.status, xml: await res.text() };
}
const locs = xml => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, "&"));

test("pages, every hand-made item, and bench units on sale or on hold; nothing sold or withdrawn", async () => {
  const env = makeEnv();
  for (const id of ["ro-0101", "ro-0102", "ro-0103", "ro-0104"]) await pushListing(bench, env, id);
  holdDirect(env, "ro-0102", "cs_test_live", Date.now() + 600_000);
  env.DB.raw.prepare("UPDATE store_listings SET status = 'sold', sold_at = ? WHERE id = 'ro-0103'").run(iso(Date.now()));
  await call(bench, env, "POST", "/api/bench/listings/ro-0104/withdraw", { token: TOKEN, body: { reason: "pulled" } });

  const r = await getSitemap(env);
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get("Content-Type"), /^application\/xml/);
  assert.ok(r.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  const urls = locs(r.xml);
  for (const p of SITE_PAGES) assert.ok(urls.includes(`https://dhole.dev${p}`), p);
  for (const p of products) assert.ok(urls.includes(`https://dhole.dev/product?id=${p.id}`), p.id);
  assert.ok(urls.includes("https://dhole.dev/product?id=ro-0101"));
  assert.ok(urls.includes("https://dhole.dev/product?id=ro-0102"), "a hold may lapse: keep it");
  assert.ok(!urls.some(u => u.includes("ro-0103")), "sold");
  assert.ok(!urls.some(u => u.includes("ro-0104")), "withdrawn");
  assert.ok(!urls.some(u => /\.html\b/.test(u)), "no .html URLs");
  assert.match(r.xml, /<image:loc>https:\/\/dhole\.dev\/api\/store\/img\/[0-9a-f]{64}\.jpg<\/image:loc>/);
  assert.match(r.xml, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(r.xml), "every & is escaped");
});

test("D1 failing: still the pages and the hand-made catalogue", async () => {
  const err = console.error; console.error = () => {};
  try {
    const r = await getSitemap(makeEnv({ DB: { prepare() { throw new Error("down"); } } }));
    assert.equal(r.status, 200);
    assert.equal(locs(r.xml).length, SITE_PAGES.length + products.length);
  } finally { console.error = err; }
});

test("pages.dev says noindex; POST is refused", async () => {
  assert.equal((await getSitemap(makeEnv(), { host: "dhole-dev.pages.dev" })).res.headers.get("X-Robots-Tag"), "noindex");
  assert.equal((await getSitemap(makeEnv(), { method: "POST" })).status, 405);
});

test("sitemapListings() returns photo URLs and the last change", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0201");
  const [l] = await sitemapListings(env.DB);
  assert.equal(l.id, "ro-0201");
  assert.equal(l.images.length, 2);
  assert.match(l.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- site-wide rules ----------

section("site-wide: headers, routes, robots, redirects, pages");

function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { rules.push({ pattern: raw.trim(), lines: [] }); continue; }
    const line = raw.trim();
    const i = line.indexOf(":");
    rules[rules.length - 1].lines.push(line.startsWith("! ")
      ? { detach: line.slice(2).trim() }
      : { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
  return rules;
}
const HEADER_RULES = parseHeaders(read("_headers"));

test("PAGE_HEADERS is exactly _headers' global rule (the Function's copy can't drift)", () => {
  const global = HEADER_RULES.find(r => r.pattern === "/*");
  const fromFile = Object.fromEntries(global.lines.map(l => [l.name, l.value]));
  assert.deepEqual(fromFile, PAGE_HEADERS);
});

test("_headers keeps every *.pages.dev copy out of search, below /*", () => {
  const i = HEADER_RULES.findIndex(r => r.pattern === "/*");
  for (const pattern of ["https://:project.pages.dev/*", "https://:version.:project.pages.dev/*"]) {
    const j = HEADER_RULES.findIndex(r => r.pattern === pattern);
    assert.ok(j > i, pattern);
    assert.deepEqual(HEADER_RULES[j].lines, [{ name: "X-Robots-Tag", value: "noindex" }], pattern);
  }
});

test("_routes.json sends /product, /case and /sitemap.xml to their Functions, and nothing else new", () => {
  const routes = JSON.parse(read("_routes.json"));
  assert.deepEqual(routes.include, ["/api/*", "/product", "/sitemap.xml", "/case"]);
  assert.ok(existsSync(join(ROOT, "functions", "product.js")));
  assert.ok(existsSync(join(ROOT, "functions", "case.js")));
  assert.ok(existsSync(join(ROOT, "functions", "sitemap.xml.js")));
  assert.ok(!existsSync(join(ROOT, "sitemap.xml")), "a static sitemap.xml would only confuse: the Function serves it");
});

test("robots.txt lets crawlers fetch product photos, keeps the APIs out, names the sitemap", () => {
  const robots = read("robots.txt");
  const lines = robots.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  assert.ok(lines.includes("Allow: /api/store/img/"));
  assert.ok(lines.includes("Disallow: /api/"));
  assert.ok(lines.includes("Sitemap: https://dhole.dev/sitemap.xml"));
  // noindex pages must stay fetchable, or their noindex is never seen.
  assert.ok(!lines.some(l => /^Disallow: \/(cart|order-complete|checkout-cancelled)/.test(l)));
  // The output dir is ".", so the dev scripts, templates, fixtures and tests are served too.
  assert.ok(lines.includes("Disallow: /scripts/"));
  assert.ok(lines.includes("Disallow: /test/"));
  // Nothing a buyer or a preview crawler needs is shut out.
  const disallowed = lines.filter(l => l.startsWith("Disallow: ")).map(l => l.slice("Disallow: ".length));
  for (const path of ["/", "/store", "/product?id=ro-0042", "/case?id=discover-cleaner", "/portfolio", "/projects/drift-tester", "/assets/brand/og-site.png"]) {
    assert.ok(!disallowed.some(prefix => path.startsWith(prefix)), path);
  }
});

test("_redirects never targets a .html URL, and never sends /foo to /foo.html", () => {
  for (const line of read("_redirects").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const [from, to] = line.trim().split(/\s+/);
    assert.ok(!/\.html$/.test(to), line);
    assert.notEqual(`${from}.html`, to, line);
  }
});

test("every sitemap page is a real file", () => {
  for (const p of SITE_PAGES) {
    const file = p === "/" ? "index.html" : `${p.slice(1)}.html`;
    assert.ok(existsSync(join(ROOT, file)), `${p} -> ${file}`);
  }
});

// The site's own pages (vendored apps have their own tests).
const SITE_HTML = [
  ...readdirSync(ROOT).filter(f => f.endsWith(".html")),
  ...readdirSync(join(ROOT, "projects")).filter(f => f.endsWith(".html")).map(f => `projects/${f}`)
];

test("inline <script>s are only JSON-LD data blocks, and each one parses", () => {
  for (const f of SITE_HTML) {
    const html = read(f);
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/.test(m[1])) continue;
      assert.match(m[1], /type="application\/ld\+json"/, `${f}: an executable inline script (the CSP blocks it)`);
      assert.doesNotThrow(() => JSON.parse(m[2]), `${f}: JSON-LD that doesn't parse`);
    }
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, "")), `${f}: inline handler`);
  }
});

test("canonical and og:url name the clean URL; links and preloads don't use .html", () => {
  for (const f of SITE_HTML) {
    const html = read(f);
    const canon = canonicalOf(html);
    if (canon) assert.ok(!/\.html\b/.test(canon), `${f}: canonical ${canon}`);
    const og = metaContent(html, "og:url");
    if (og) assert.ok(!/\.html\b/.test(og), `${f}: og:url ${og}`);
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      assert.ok(!/\.html(\?|#|$)/.test(m[1]), `${f}: link ${m[1]}`);
    }
    for (const m of html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)) {
      assert.ok(existsSync(join(ROOT, m[1])), `${f}: preload ${m[1]} is missing`);
    }
  }
});

test("pages that use the shared chrome reserve its header", () => {
  for (const f of SITE_HTML) {
    const html = read(f);
    if (!/entry(\/[\w-]+)?\.js|\.entry\.js/.test(html)) continue;
    assert.match(html, /<body>\s*<header class="site-header"><\/header>/, f);
  }
});

test("every project interface shot exists, desktop and phone crops", async () => {
  const { projects } = await import("../data/projects.js");
  for (const p of projects) {
    if (!p.shot) continue;
    for (const src of [p.shot.src, p.shot.mobile && p.shot.mobile.src].filter(Boolean)) {
      assert.ok(existsSync(join(ROOT, src)), `${p.id}: ${src}`);
    }
    assert.ok(p.shot.alt && p.shot.width > 0 && p.shot.height > 0, p.id);
  }
});

test("the support email in plain HTML matches SUPPORT_EMAIL", async () => {
  const { SUPPORT_EMAIL } = await import("../assets/store-config.js");
  if (!SUPPORT_EMAIL) return;
  assert.ok(read("shipping-returns.html").includes(`mailto:${SUPPORT_EMAIL}`), "shipping-returns.html");
  const org = ldBlocks(read("index.html"))[0]["@graph"].find(n => n["@type"] === "Organization");
  assert.equal(org.email, SUPPORT_EMAIL, "index.html Organization email");
});

test("the store and shipping page quote the real shipping rates", () => {
  for (const f of ["store.html", "shipping-returns.html"]) {
    const html = read(f);
    assert.ok(html.includes(formatMoney(SHIPPING.console.cents)), `${f}: console rate`);
    assert.ok(html.includes(formatMoney(SHIPPING.small.cents)), `${f}: small rate`);
  }
});

await run();

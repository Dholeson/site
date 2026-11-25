// The shop's pages and the browser modules behind them: /store, /product,
// /cart, /order-complete and /checkout-cancelled (spec §10.2 to §10.5).
//
// What's pinned:
// - every shop page's head: the shared snippet in order, shop.css and the
//   entry at ?v=2, the Red Hat Mono preload where ids show, and nothing left
//   of the old look (no eyebrow, pages.css, og.png or old icons);
// - each page's body starts with the empty header, the JS-rendered pages
//   carry their <noscript> notice first in main, and each entry mounts the
//   chrome with its nav key;
// - product.html: one seo block with claim-free fallback tags, no canonical,
//   and modulepreloads for every module the page loads, each a real file;
// - the caching rules for this release: store.js keeps its old exports and
//   re-exports renderProduct and renderCart, catalogue.js exports exactly what
//   it did, and reloadBench({ fresh: true }) skips the browser cache;
// - assets/checkout-return.js against a stubbed localStorage: only a Stripe
//   checkout URL under 30 minutes old is offered back to the buyer.
//
// The pages themselves are checked in a browser by npm run check:layout.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { SHIPPING, formatMoney } from "../data/products.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const PAGES = {
  "store.html": { entry: "store", key: "store", mono: true, what: "what's on the shelf" },
  "product.html": { entry: "product", key: "store", mono: true, what: "this unit's photos and price" },
  "cart.html": { entry: "cart", key: "cart", mono: true, what: "your cart" },
  "order-complete.html": { entry: "order-complete", key: "cart", mono: false, what: null },
  "checkout-cancelled.html": { entry: "checkout-cancelled", key: "cart", mono: false, what: null }
};

const SEO_START = "<!-- seo:start";
const SEO_END = "<!-- seo:end -->";
const noComments = html => html.replace(/<!--[\s\S]*?-->/g, "");
const metaContent = (html, key) => {
  const m = new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};
const mainOf = html => (/<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html) || [, ""])[1];

section("the five shop pages: head, body and nav key");

for (const [file, page] of Object.entries(PAGES)) {
  const html = read(file);

  test(`${file}: the shared head snippet in order, with shop.css and the entry at ?v=2`, () => {
    const order = [
      '<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />',
      '<link rel="apple-touch-icon" href="/assets/brand/icon-180.png" />',
      '<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />',
      '<meta name="theme-color" content="#ffffff" />',
      '<link rel="stylesheet" href="/assets/site.css?v=2" />',
      '<link rel="stylesheet" href="/assets/shop.css?v=2" />',
      `<script type="module" src="/assets/entry/${page.entry}.js?v=2"></script>`
    ];
    let at = -1;
    for (const tag of order) {
      const i = html.indexOf(tag);
      assert.ok(i > at, `${tag} missing or out of order`);
      at = i;
    }
    const mono = '<link rel="preload" href="/assets/fonts/red-hat-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />';
    assert.equal(html.includes(mono), page.mono, page.mono ? "the Red Hat Mono preload (ids show here)" : "no mono preload: no ids here");
    // Every stylesheet and entry script is versioned; modulepreloads are not
    // (they must name files that exist).
    for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) assert.match(m[1], /\?v=2$/, m[1]);
    for (const m of html.matchAll(/<script type="module" src="([^"]+)"/g)) assert.match(m[1], /\?v=2$/, m[1]);
    for (const m of html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)) {
      assert.ok(!m[1].includes("?"), `${m[1]}: preloads stay unversioned`);
      assert.ok(existsSync(join(ROOT, m[1])), `${m[1]} is missing`);
    }
  });

  test(`${file}: nothing left of the old look`, () => {
    for (const old of ["eyebrow", "pages.css", "/og.png", "favicon.svg", "apple-touch-icon.png", "demo-header", "—", "→", "←"]) {
      assert.ok(!html.includes(old), `${file} still has ${old}`);
    }
    assert.ok(!/\sstyle="/.test(html), "no inline styles");
  });

  test(`${file}: the body starts with the empty header; ${page.what ? "the noscript notice is first in main" : "a static page"}`, () => {
    assert.match(html, /<body>\s*<header class="site-header"><\/header>/);
    if (!page.what) return;
    const main = mainOf(html).trim();
    const notice = `<noscript><p class="notice noscript"><strong>This page needs JavaScript to show ${page.what}.</strong> The <a href="/shipping-returns">shipping and returns</a> page works without it, and you can email <a href="mailto:support@dhole.dev">support@dhole.dev</a>.</p></noscript>`;
    assert.ok(main.replace(/^<div class="wrap">\s*/, "").startsWith(notice), `${file}: the noscript notice opens main`);
  });

  test(`${file}: its entry mounts the chrome as "${page.key}"`, () => {
    const src = read(`assets/entry/${page.entry}.js`);
    const calls = [...src.matchAll(/mountChrome\(([^)]*)\)/g)].map(m => m[1].trim());
    assert.deepEqual(calls, [`"${page.key}"`]);
  });
}

test("the cart and order pages are noindex; the store isn't", () => {
  for (const f of ["cart.html", "order-complete.html", "checkout-cancelled.html"]) {
    assert.equal(metaContent(read(f), "robots"), "noindex", f);
  }
  assert.equal(metaContent(read("store.html"), "robots"), null);
});

test("store.html: the head from the spec, both shipping rates, and nothing static after the shelf", () => {
  const html = read("store.html");
  assert.ok(html.includes("<title>Refurbished retro consoles and controllers | dhole.dev</title>"));
  assert.equal(metaContent(html, "og:image"), "https://dhole.dev/assets/brand/og-site.png");
  assert.equal(metaContent(html, "og:title"), "Refurbished retro consoles and controllers");
  for (const cls of ["console", "small"]) assert.ok(html.includes(formatMoney(SHIPPING[cls].cents)), cls);
  assert.ok(html.includes("<h1>Refurbished consoles and controllers</h1>"));
  // Late content can only replace the held shelf or land after it.
  assert.match(mainOf(html), /<section id="shelf" class="shelf"[^>]*>[\s\S]*?<\/section>\s*<div id="store-after"><\/div>\s*<\/div>\s*$/);
});

section("product.html: the shell functions/product.js fills");

const PRODUCT = read("product.html");

test("exactly one seo:start / seo:end pair, and no canonical anywhere", () => {
  assert.equal(PRODUCT.split(SEO_START).length, 2);
  assert.equal(PRODUCT.split(SEO_END).length, 2);
  assert.ok(PRODUCT.indexOf(SEO_START) < PRODUCT.indexOf(SEO_END));
  assert.ok(!/rel="canonical"/.test(PRODUCT));
});

test("the fallback tags make no claims and use og-site.png", () => {
  const block = noComments(PRODUCT.slice(PRODUCT.indexOf(SEO_START), PRODUCT.indexOf(SEO_END)));
  assert.ok(block.includes("<title>Product | dhole.dev</title>"));
  assert.equal(metaContent(block, "description"), "A refurbished retro console or controller from dhole.dev.");
  assert.equal(metaContent(block, "og:description"), "A refurbished retro console or controller from dhole.dev.");
  assert.equal(metaContent(block, "og:title"), "Refurbished retro consoles at dhole.dev");
  assert.equal(metaContent(block, "og:image"), "https://dhole.dev/assets/brand/og-site.png");
  assert.ok(!/\$\d/.test(block), "no price in the fallback");
  assert.ok(!/unit-status|name="checkout"/.test(block), "the Function writes those");
});

test("modulepreloads: the spec's list, unversioned, each a real file", () => {
  const preloads = [...PRODUCT.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(preloads.includes("/assets/product-page.js"));
  assert.ok(preloads.includes("/assets/record.js"));
  assert.deepEqual([...preloads].sort(), [
    "/assets/chrome.js", "/assets/cart.js", "/assets/catalogue.js", "/assets/product-page.js", "/assets/record.js",
    "/assets/unit-copy.js", "/assets/unit-card.js", "/assets/owner-block.js", "/assets/checkout-return.js",
    "/assets/esc.js", "/assets/store-config.js", "/data/products.js", "/data/owner.js"
  ].sort());
  for (const p of preloads) assert.ok(existsSync(join(ROOT, p)), p);
});

test("the body: the noscript notice, then the one element the page renders into", () => {
  assert.match(mainOf(PRODUCT), /<\/noscript>\s*<div id="product-main"><\/div>\s*<\/div>\s*$/);
});

section("caching this release: old exports stay, new options are safe to ignore");

test("assets/store.js keeps renderStore and re-exports renderProduct and renderCart", async () => {
  const store = await import("../assets/store.js");
  const { renderProduct } = await import("../assets/product-page.js");
  const { renderCart } = await import("../assets/cart-page.js");
  assert.equal(typeof store.renderStore, "function");
  assert.equal(store.renderProduct, renderProduct);
  assert.equal(store.renderCart, renderCart);
});

test("assets/catalogue.js exports exactly what it did before the redesign", async () => {
  const catalogue = await import("../assets/catalogue.js");
  assert.deepEqual(Object.keys(catalogue).sort(), [
    "BENCH_LISTING_ID", "LISTINGS_ENDPOINT", "allProducts", "benchState", "findAny", "isBenchId", "loadBench", "reloadBench"
  ]);
});

test("reloadBench({ fresh: true }) asks with cache: 'no-store'; a plain load uses the browser cache", async () => {
  const { loadBench, reloadBench, findAny, benchState } = await import("../assets/catalogue.js");
  const original = globalThis.fetch;
  const calls = [];
  const unit = {
    id: "ro-0042", name: "Nintendo 64, Charcoal", platform: "Nintendo 64", category: "console",
    condition: "Refurbished", priceCents: 15900, stock: 1, shippingClass: "console",
    image: `/api/store/img/${"a".repeat(64)}.jpg`, images: [`/api/store/img/${"a".repeat(64)}.jpg`],
    blurb: "Cleaned and tested.", details: ["Works: Boots."], source: "bench"
  };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, cache: init.cache });
    return new Response(JSON.stringify({ listings: calls.length > 1 ? [unit] : [] }), { status: 200 });
  };
  try {
    assert.equal(await loadBench(), "ok");
    assert.equal(findAny("ro-0042"), null);
    // The same promise until something asks again.
    assert.equal(await loadBench({ fresh: true }), "ok");
    assert.equal(calls.length, 1);
    assert.equal(await reloadBench({ fresh: true }), "ok");
    assert.equal(findAny("ro-0042").priceCents, 15900);
    assert.equal(await reloadBench(), "ok");
    assert.deepEqual(calls, [
      { url: "/api/store/listings", cache: "default" },
      { url: "/api/store/listings", cache: "no-store" },
      { url: "/api/store/listings", cache: "default" }
    ]);
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    assert.equal(await reloadBench({ fresh: true }), "failed");
    assert.equal(benchState(), "failed");
    assert.equal(findAny("ro-0042"), null);
  } finally {
    globalThis.fetch = original;
  }
});

section("assets/checkout-return.js: the way back to the buyer's own checkout");

const KEY = "dhole_checkout_v1";
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_a1b2c3";

// A Map-backed localStorage, or one that throws like a blocked one.
function stubStorage({ broken = false } = {}) {
  const map = new Map();
  const fail = () => { throw new Error("SecurityError: storage is blocked"); };
  globalThis.localStorage = broken
    ? { getItem: fail, setItem: fail, removeItem: fail }
    : {
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: k => { map.delete(k); }
      };
  return map;
}

const { saveCheckout, liveCheckout, clearCheckout } = await import("../assets/checkout-return.js");

test("saveCheckout then liveCheckout: the URL, the ids and when it started", () => {
  const map = stubStorage();
  const before = Date.now();
  saveCheckout({ url: STRIPE_URL, ids: ["ro-0042", "ro-0107"] });
  const stored = JSON.parse(map.get(KEY));
  assert.equal(stored.url, STRIPE_URL);
  assert.deepEqual(stored.ids, ["ro-0042", "ro-0107"]);
  assert.ok(stored.startedAt >= before && stored.startedAt <= Date.now());
  assert.deepEqual(liveCheckout(), stored);
  clearCheckout();
  assert.equal(map.has(KEY), false);
  assert.equal(liveCheckout(), null);
});

test("a URL that isn't Stripe's checkout is never offered back", () => {
  const map = stubStorage();
  for (const url of [
    "http://checkout.stripe.com/c/pay/cs_test",            // not https
    "https://checkout.stripe.com.evil.example/c/pay/x",     // a lookalike host
    "https://evil.example/https://checkout.stripe.com/",
    "javascript:alert(1)",
    "/cart",
    ""
  ]) {
    saveCheckout({ url, ids: ["ro-0042"] });
    assert.equal(liveCheckout(), null, url);
  }
  map.set(KEY, JSON.stringify({ url: 42, ids: ["ro-0042"], startedAt: Date.now() }));
  assert.equal(liveCheckout(), null, "a URL that isn't a string");
});

test("a record 30 minutes old or more, or dated in the future, has expired", () => {
  const map = stubStorage();
  const at = startedAt => map.set(KEY, JSON.stringify({ url: STRIPE_URL, ids: ["ro-0042"], startedAt }));
  at(Date.now() - 29 * 60 * 1000);
  assert.ok(liveCheckout(), "29 minutes: still live");
  at(Date.now() - 30 * 60 * 1000);
  assert.equal(liveCheckout(), null, "30 minutes");
  at(Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(liveCheckout(), null, "2 hours");
  at(Date.now() + 60 * 1000);
  assert.equal(liveCheckout(), null, "a clock that went backwards");
  at("yesterday");
  assert.equal(liveCheckout(), null, "no usable time");
});

test("malformed records read as none; ids keep only strings", () => {
  const map = stubStorage();
  for (const raw of ["{not json", "null", "[]", '"a string"', "7"]) {
    map.set(KEY, raw);
    assert.equal(liveCheckout(), null, raw);
  }
  map.set(KEY, JSON.stringify({ url: STRIPE_URL, ids: ["ro-0042", 7, null, { id: "x" }], startedAt: Date.now() }));
  assert.deepEqual(liveCheckout().ids, ["ro-0042"]);
  map.set(KEY, JSON.stringify({ url: STRIPE_URL, ids: "ro-0042", startedAt: Date.now() }));
  assert.deepEqual(liveCheckout().ids, []);
});

test("blocked storage: nothing throws, and there is no way back to offer", () => {
  stubStorage({ broken: true });
  assert.doesNotThrow(() => saveCheckout({ url: STRIPE_URL, ids: ["ro-0042"] }));
  assert.equal(liveCheckout(), null);
  assert.doesNotThrow(() => clearCheckout());
  delete globalThis.localStorage;
  assert.equal(liveCheckout(), null, "no localStorage at all");
});

section("the order pages and the cart's wording");

test("/order-complete clears the cart and the saved checkout; /checkout-cancelled offers the way back", () => {
  const done = read("assets/entry/order-complete.js");
  assert.match(done, /^clearCart\(\);$/m);
  assert.match(done, /^clearCheckout\(\);$/m);
  const cancelled = read("assets/entry/checkout-cancelled.js");
  assert.ok(cancelled.includes("liveCheckout()"));
  assert.ok(cancelled.includes(">Return to your checkout</a>"));
  assert.ok(cancelled.includes('class="btn-buy"'));
  assert.ok(cancelled.includes("Your cart is as you left it."));
  // Without JavaScript the way back to the cart still shows.
  assert.match(read("checkout-cancelled.html"), /<noscript>[\s\S]*href="\/cart">Back to the cart<\/a>[\s\S]*<\/noscript>/);
});

test("no buyer-facing text points at SETUP.md or blames someone else's checkout", () => {
  for (const f of ["assets/cart-page.js", "assets/product-page.js", "assets/store.js", "lib/checkout-core.js",
    "cart.html", "product.html", "store.html", "order-complete.html", "checkout-cancelled.html"]) {
    const src = read(f);
    assert.ok(!src.includes("SETUP.md"), `${f}: SETUP.md`);
    assert.ok(!/someone else's checkout/i.test(src), `${f}: "someone else's checkout"`);
  }
});

await run();

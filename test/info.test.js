// The info pages: /shipping-returns (shipping-returns.html), the 404 page
// (404.html) and the build log (log.html, assets/log.js), all on
// assets/info.css.
//
// What's pinned: the shipping page states exactly what the code commits to
// (both SHIPPING rates, RETURNS.console word for word, the US-only line only
// while wrangler.toml ships to the US alone, and nowhere else on the site);
// its sections and in-page links; the redesign's head (with the theme head
// and ?v=3) and copy rules on all three pages (no eyebrow, no old
// stylesheet or brand files, no inline styles, no em dash or arrows); each
// page's nav key; the 404 copy; and the log's rendering through renderLog()
// with a stand-in element (escaping, order, dates read as calendar days).
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { SHIPPING, RETURNS, formatMoney } from "../data/products.js";
import { renderLog } from "../assets/log.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const PAGES = {
  "shipping-returns.html": { entry: "assets/entry/shipping-returns.js", key: "store" },
  "404.html": { entry: "assets/entry/not-found.js", key: "" },
  "log.html": { entry: "assets/entry/log.js", key: "" }
};
const SHIP = read("shipping-returns.html");

const stripComments = html => html.replace(/<!--[\s\S]*?-->/g, "");
const textOf = html => stripComments(html)
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();
const bodyOf = html => (/<body>([\s\S]*)<\/body>/.exec(html) || [, ""])[1];
function sectionOf(html, id) {
  const m = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  assert.ok(m, `no <section id="${id}">`);
  return m[1];
}

// Site HTML and JS, without the vendored apps and the tests themselves.
function siteFiles() {
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = dir ? `${dir}/${name}` : name;
      if (statSync(join(ROOT, rel)).isDirectory()) {
        if (dir === "assets" || dir.startsWith("assets/")) walk(rel);
        continue;
      }
      if (/\.(html|js)$/.test(name)) out.push(rel);
    }
  };
  for (const f of readdirSync(ROOT)) if (f.endsWith(".html")) out.push(f);
  for (const f of readdirSync(join(ROOT, "projects"))) if (/\.(html|js)$/.test(f)) out.push(`projects/${f}`);
  for (const f of readdirSync(join(ROOT, "data"))) if (f.endsWith(".js")) out.push(`data/${f}`);
  walk("assets");
  return out;
}

function shipToCountries() {
  const m = /^\s*SHIP_TO_COUNTRIES\s*=\s*"([^"]*)"/m.exec(read("wrangler.toml"));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
section("shipping-returns.html: the figures come from the code");

test("the shipping table quotes both SHIPPING rates, each on its own row", () => {
  const table = /<table>([\s\S]*?)<\/table>/.exec(sectionOf(SHIP, "shipping"));
  assert.ok(table, "no table in the shipping section");
  const rows = [...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
  const row = label => rows.find(r => textOf(r).startsWith(label));
  const small = row("Accessories only (controllers, cables, memory cards)");
  const consoleRow = row("Anything with a console in it");
  assert.ok(small && consoleRow, "both rows are present");
  assert.match(small, new RegExp(`<td class="num">${formatMoney(SHIPPING.small.cents).replace("$", "\\$")}</td>`));
  assert.match(consoleRow, new RegExp(`<td class="num">${formatMoney(SHIPPING.console.cents).replace("$", "\\$")}</td>`));
  // The rate column is right-aligned and tabular, header included.
  assert.match(table[1], /<th scope="col" class="num">Shipping<\/th>/);
});

test("the page's only $ amounts are the two SHIPPING rates", () => {
  const allowed = new Set([formatMoney(SHIPPING.small.cents), formatMoney(SHIPPING.console.cents)]);
  const found = stripComments(SHIP).match(/\$\d[\d,]*(\.\d+)?/g) || [];
  assert.ok(found.length >= 2);
  for (const amount of found) assert.ok(allowed.has(amount), `${amount} isn't a SHIPPING rate`);
});

test("returns: the console term is RETURNS.console word for word, after 'Consoles:'", () => {
  assert.ok(RETURNS.console, "RETURNS.console is set");
  const returns = sectionOf(SHIP, "returns");
  assert.ok(returns.includes(`<p><strong>Consoles:</strong> ${RETURNS.console}</p>`), "the Consoles paragraph");
  assert.equal(SHIP.split(RETURNS.console).length - 1, 1, "stated once");
});

test("returns: no accessory terms and no other time limit", () => {
  const text = textOf(sectionOf(SHIP, "returns"));
  if (RETURNS.accessory === null) assert.ok(!/accessor/i.test(text), "no accessory terms until the owner decides");
  const rest = textOf(SHIP).replace(RETURNS.console, "");
  assert.ok(!/\b\d+[- ]days?\b/i.test(rest), "the only day count on the page is RETURNS.console's");
  assert.ok(!/\b90\b/.test(rest));
  assert.ok(text.includes("If a unit sells to two people at the same moment, the second buyer gets a full refund."));
  assert.ok(/Something wrong with an order\? Email support@dhole\.dev with your order number and what happened\./.test(text));
});

test("'US addresses only' is on the page if and only if wrangler.toml ships to \"US\" alone", () => {
  const usOnly = shipToCountries() === "US";
  const count = stripComments(SHIP).split("US addresses only").length - 1;
  if (usOnly) {
    assert.equal(count, 1, "SHIP_TO_COUNTRIES is \"US\": say so, once");
    assert.ok(sectionOf(SHIP, "shipping").includes("<p>US addresses only for now.</p>"));
  } else {
    assert.equal(count, 0, `SHIP_TO_COUNTRIES is ${JSON.stringify(shipToCountries())}: take the US-only line out`);
  }
});

// Stripe isn't connected (CLAUDE.md, Outstanding 1), and every product page
// says so. This page has to agree. Going live is SETUP.md Step 6, which takes
// the paragraph out together with this test.
test("paying: until Stripe is connected, the section opens by saying checkout is off, and SETUP.md says when to take that out", () => {
  const paying = stripComments(sectionOf(SHIP, "paying"));
  const paras = [...paying.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => textOf(m[1]));
  assert.equal(paras[0], "Online checkout isn't switched on yet. To buy a unit now, email support@dhole.dev with its id.");
  assert.match(paying, /<p><strong>Online checkout isn't switched on yet\.<\/strong> To buy a unit now, email <a href="mailto:support@dhole\.dev">support@dhole\.dev<\/a> with its id\.<\/p>/);
  // The rest reads right once checkout is on, so going live is one deletion.
  for (const p of paras.slice(1)) assert.ok(!/switched on|not yet/i.test(p), p);
  assert.ok(paras[1].startsWith("With online checkout, you pay by card on Stripe's checkout page."), paras[1]);
  const setup = read("SETUP.md");
  const golive = (/## Step 6[^\n]*\n([\s\S]*?)\n---/.exec(setup) || [, ""])[1];
  assert.ok(golive.includes("shipping-returns.html") && golive.includes("Online checkout isn't switched on yet"),
    "SETUP.md Step 6 tells the owner to take the paragraph out");
});

test("your data: the cart is kept until the order is paid (order-complete removes only the paid lines)", () => {
  const text = textOf(sectionOf(SHIP, "data"));
  assert.ok(text.includes("Your cart is kept in your own browser's local storage until your order is paid,"), text);
  assert.ok(!/until you check out/.test(text));
  assert.ok(!/you give Stripe/.test(text), "true whether the order came through Stripe or by email");
});

test("the receipt promise has its setup step: SETUP.md turns on Stripe's Customer emails, Successful payments", () => {
  // Nothing in the Checkout Session asks Stripe for a receipt, so the
  // dashboard setting is what makes these two sentences true.
  assert.ok(textOf(sectionOf(SHIP, "paying")).includes("Stripe emails your receipt"));
  assert.ok(textOf(bodyOf(read("order-complete.html"))).includes("Stripe has emailed your receipt."));
  const setup = read("SETUP.md");
  const step3 = (/## Step 3[^\n]*\n([\s\S]*?)\n---/.exec(setup) || [, ""])[1];
  assert.ok(/Settings → Customer emails/.test(step3) && /Successful\s+payments/.test(step3), "SETUP.md Step 3: the receipt setting");
});

test("no other page or site script says 'addresses only'", () => {
  for (const f of siteFiles()) {
    if (f === "shipping-returns.html") continue;
    assert.ok(!/addresses only/i.test(stripComments(read(f))), f);
  }
});

test("dispatch is 'two business days', never a digit", () => {
  const text = textOf(SHIP);
  assert.ok(text.includes("Orders are packed and shipped within two business days, from the US."));
  assert.ok(!/\d+\s+business days/.test(SHIP));
});

test("the mirror comment names SHIPPING, RETURNS and SHIP_TO_COUNTRIES", () => {
  const comment = (SHIP.match(/<!--[\s\S]*?-->/g) || []).find(c => /mirrors/.test(c));
  assert.ok(comment, "the comment saying what the page mirrors");
  for (const name of ["SHIPPING", "RETURNS", "SHIP_TO_COUNTRIES"]) assert.ok(comment.includes(name), name);
});

// ---------------------------------------------------------------------------
section("shipping-returns.html: structure and copy");

const SECTION_IDS = ["shipping", "returns", "testing", "paying", "data", "contact"];
const TOC = ["Shipping", "Returns", "Testing", "Paying", "Your data", "Contact"];

test("the h1, then the in-page list linking each section in order", () => {
  assert.match(SHIP, /<h1>Shipping, returns and testing<\/h1>\s*<nav aria-label="On this page">\s*<ul class="link-list info-toc">/);
  const toc = /<ul class="link-list info-toc">([\s\S]*?)<\/ul>/.exec(SHIP)[1];
  const links = [...toc.matchAll(/<a href="#([\w-]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(links, SECTION_IDS.map((id, i) => [id, TOC[i]]));
  const order = [...SHIP.matchAll(/<section class="info-section" id="([\w-]+)" aria-labelledby="([\w-]+)">\s*<h2 id="([\w-]+)">([^<]+)<\/h2>/g)];
  assert.deepEqual(order.map(m => m[1]), SECTION_IDS);
  for (const m of order) assert.equal(m[2], m[3], `${m[1]}: aria-labelledby names its h2`);
  assert.deepEqual(order.map(m => m[4]), TOC);
});

test("testing: the three lines, with the drift tester link", () => {
  const text = textOf(sectionOf(SHIP, "testing"));
  assert.ok(text.includes("Every console is opened, cleaned and put through a full boot before it's listed."));
  assert.ok(text.includes("Each listing's photos are of that exact unit, not a stock image."));
  assert.ok(text.includes("Where a listing gives a stick reading, it was taken with the drift tester on this site, and the listing says how."));
  assert.match(sectionOf(SHIP, "testing"), /<a href="\/projects\/drift-tester">drift tester<\/a>/);
});

test("the old overclaiming drift line is gone from every page", () => {
  for (const f of siteFiles()) {
    const text = stripComments(read(f));
    assert.ok(!/reading, not an opinion/i.test(text), f);
    assert.ok(!/"no drift" is a/i.test(text), f);
  }
});

test("contact keeps a visible mailto:support@dhole.dev, and the page ends with 'Go to the store'", () => {
  assert.match(sectionOf(SHIP, "contact"), /<a href="mailto:support@dhole\.dev">support@dhole\.dev<\/a>/);
  for (const m of SHIP.matchAll(/<a href="mailto:([^"]+)">([^<]+)<\/a>/g)) assert.equal(m[2], "support@dhole.dev", "the address is the link text");
  const main = /<main\b[\s\S]*<\/main>/.exec(SHIP)[0];
  const links = [...main.matchAll(/<a class="([^"]+)" href="([^"]+)">([^<]+)<\/a>/g)];
  const last = links[links.length - 1];
  assert.deepEqual([last[1], last[2], last[3]], ["btn", "/store", "Go to the store"]);
});

test("head: title, description and og-site.png", () => {
  assert.match(SHIP, /<title>Shipping, returns and testing \| dhole\.dev<\/title>/);
  assert.ok(SHIP.includes(`<meta name="description" content="Flat shipping: $18.00 for an order with a console, $6.00 for accessories. Orders ship within two business days with tracking. Returns, and how units are tested." />`));
  assert.ok(SHIP.includes(`<link rel="canonical" href="https://dhole.dev/shipping-returns" />`));
});

// ---------------------------------------------------------------------------
section("the three pages: head and copy rules");

for (const [file, { entry, key }] of Object.entries(PAGES)) {
  const html = read(file);

  test(`${file}: the shared head snippet with the theme head, info.css and its entry at ?v=3`, () => {
    assert.ok(html.includes(`<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />`));
    assert.ok(html.includes(`<link rel="apple-touch-icon" href="/assets/brand/icon-180.png" />`));
    assert.ok(html.includes(`<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />`));
    // The theme head (dark-spec §4.1), in this order: the dark theme-color
    // before the light one (the first matching one wins), and theme.js after
    // the metas it rewrites and before every stylesheet. Then site.css,
    // info.css and the entry, all at ?v=3 (spec §2.3: new HTML needs new CSS).
    const order = [
      `<meta name="color-scheme" content="light dark" />`,
      `<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />`,
      `<meta name="theme-color" content="#ffffff" />`,
      `<script src="/assets/theme.js?v=3"></script>`,
      `<link rel="stylesheet" href="/assets/site.css?v=3" />`,
      `<link rel="stylesheet" href="/assets/info.css?v=3" />`,
      `<script type="module" src="/${entry}?v=3"></script>`
    ];
    let at = -1;
    for (const tag of order) {
      const i = html.indexOf(tag);
      assert.ok(i > at, `${file}: ${tag} missing or out of order`);
      at = i;
    }
    for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) assert.match(m[1], /\?v=3$/, `${file}: ${m[1]}`);
    for (const m of html.matchAll(/<script type="module" src="([^"]+)"/g)) assert.match(m[1], /\?v=3$/, `${file}: ${m[1]}`);
    assert.ok(html.includes(`content="https://dhole.dev/assets/brand/og-site.png"`), "og-site.png");
    assert.match(html, /<body>\s*<header class="site-header"><\/header>/);
  });

  test(`${file}: no eyebrow, no pages.css, no old brand files, no inline styles`, () => {
    assert.ok(!/eyebrow/.test(html), "eyebrow");
    assert.ok(!/pages\.css/.test(html), "pages.css");
    assert.ok(!/demo\.css/.test(html), "demo.css");
    assert.ok(!/\/og\.png/.test(html), "og.png");
    assert.ok(!/favicon\.svg|apple-touch-icon\.png/.test(html), "old icons");
    assert.ok(!/\sstyle\s*=/.test(html), "style attribute");
    assert.ok(!/<style\b/.test(html), "style element");
  });

  test(`${file}: no em dash or arrows, and nothing above the h1`, () => {
    assert.ok(!/[\u2014\u2192\u2190]/.test(html));
    const body = bodyOf(html);
    const beforeH1 = body.slice(0, body.indexOf("<h1"));
    assert.ok(beforeH1.length > 0, "an h1 in the static body");
    assert.ok(!/<(p|span|a)\b/.test(stripComments(beforeH1)), "nothing above the h1");
  });

  test(`${entry}: mountChrome(${JSON.stringify(key)})`, () => {
    const src = read(entry);
    assert.match(src, /import \{ mountChrome \} from "\.\.\/chrome\.js";/);
    const calls = [...src.matchAll(/mountChrome\(([^)]*)\)/g)].map(m => m[1]);
    assert.deepEqual(calls, [JSON.stringify(key)]);
  });
}

test("assets/log.js and info.css carry no em dash, arrows, chips, cards or eyebrows", () => {
  for (const f of ["assets/log.js", "assets/info.css"]) {
    const src = read(f);
    assert.ok(!/[\u2014\u2192\u2190]/.test(src), f);
    assert.ok(!/\b(chip|card|eyebrow|dim)\b/.test(src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), f);
  }
});

// ---------------------------------------------------------------------------
section("404.html");

test("noindex, the new copy, and the three ways on", () => {
  const html = read("404.html");
  assert.ok(html.includes(`<meta name="robots" content="noindex" />`));
  assert.match(html, /<h1>That page isn't here<\/h1>\s*<p class="lede">If it was a console listing, it has probably sold\.<\/p>/);
  const row = /<div class="btn-row">([\s\S]*?)<\/div>/.exec(html)[1];
  const links = [...row.matchAll(/<a class="([^"]+)" href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2], m[3]]);
  assert.deepEqual(links, [
    ["btn", "/store", "See what's listed now"],
    ["btn-text", "/projects", "Tools"],
    ["btn-text", "/", "Home"]
  ]);
  // Served at any depth: every local reference is absolute.
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) assert.ok(/^(\/|https:|mailto:|#)/.test(m[1]), m[1]);
});

// ---------------------------------------------------------------------------
section("log.html and assets/log.js");

test("log.html: a noscript notice, the list after the head, out of the header and footer", () => {
  const html = read("log.html");
  assert.ok(html.includes(`<noscript><p class="notice noscript"><strong>This page needs JavaScript to show the build log.</strong>`));
  assert.ok(html.indexOf("</h1>") < html.indexOf("<noscript>") && html.indexOf("<noscript>") < html.indexOf(`<div id="log-main"></div>`));
  assert.match(html, /<main class="info info-log">/);
  assert.ok(!/href="\/log"/.test(read("assets/chrome.js")), "chrome.js links /log");
});

const el = () => ({ innerHTML: "" });
const at = (y, m, d) => new Date(y, m - 1, d, 12);

test("renderLog(): newest first, each week with its dates, status and days", () => {
  const out = el();
  renderLog(out, [
    { id: 1, title: "First", start: "2026-01-28", end: "2026-02-03", status: "completed", notes: { Sunday: "Sun note", Wednesday: "Wed note", Tuesday: "Tue note" } },
    { id: 2, title: "Second", start: "2026-02-04", end: "2026-02-10", status: "in_progress", notes: {} }
  ], at(2026, 11, 25));
  const h = out.innerHTML;
  assert.ok(h.indexOf("Week 2: Second") < h.indexOf("Week 1: First"), "newest first");
  assert.ok(h.includes(`<p class="quiet">January 28 to February 3, 2026. Completed.</p>`), h);
  assert.ok(h.includes(`<p class="quiet">February 4 to 10, 2026. In progress.</p>`), h);
  // 2026-01-28 is a Wednesday: the days run from there.
  const days = [...h.matchAll(/<dt>(\w+)<\/dt>/g)].map(m => m[1]);
  assert.deepEqual(days, ["Wednesday", "Sunday", "Tuesday"]);
  assert.ok(h.includes("<p>Nothing logged for this week yet.</p>"));
  assert.ok(!h.includes("This is the current week."));
  assert.ok(!/[\u2014\u2192\u2190]/.test(h));
  assert.ok(!/chip|card|eyebrow/.test(h));
  // Each heading labels its article.
  for (const m of h.matchAll(/<article class="info-section log-week" aria-labelledby="([\w-]+)">\s*<h2 id="([\w-]+)">/g)) assert.equal(m[1], m[2]);
});

test("renderLog(): dates are calendar days, so the current week includes its last day in any time zone", () => {
  const week = { id: 3, title: "Now", start: "2026-11-23", end: "2026-11-29", status: "in_progress", notes: { Monday: "x" } };
  for (const d of [23, 25, 29]) {
    const out = el();
    renderLog(out, [week], at(2026, 11, d));
    assert.ok(out.innerHTML.includes("This is the current week."), `November ${d}`);
  }
  const after = el();
  renderLog(after, [week], at(2026, 11, 30));
  assert.ok(!after.innerHTML.includes("This is the current week."));
});

test("renderLog(): ranges across years, unreadable dates as written, unknown status kept", () => {
  const out = el();
  renderLog(out, [
    { id: 4, title: "Turn", start: "2025-12-29", end: "2026-01-04", status: "planned", notes: {} },
    { id: 5, title: "Odd", start: "soon", end: "", status: "paused", notes: { Friday: "y" } }
  ], at(2026, 11, 25));
  assert.ok(out.innerHTML.includes("December 29, 2025 to January 4, 2026. Planned."), out.innerHTML);
  assert.ok(out.innerHTML.includes(`<p class="quiet">soon. paused.</p>`), out.innerHTML);
});

test("renderLog(): data from the file is escaped", () => {
  const out = el();
  renderLog(out, [{ id: "<i>6</i>", title: `<img src=x onerror=alert(1)>`, start: "2026-03-01", end: "2026-03-07",
    status: `<b>"x"</b>`, notes: { Sunday: `<script>alert("n")</script>` } }], at(2026, 11, 25));
  const h = out.innerHTML;
  assert.ok(!/<img|<script|<b>|<i>/.test(h), h);
  assert.ok(h.includes("Week &lt;i&gt;6&lt;/i&gt;: &lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(h.includes("&lt;script&gt;alert(&quot;n&quot;)&lt;/script&gt;"));
});

test("renderLog(): no weeks", () => {
  const out = el();
  renderLog(out, [], at(2026, 11, 25));
  assert.equal(out.innerHTML, "<p>No weeks logged yet.</p>");
});

test("renderLog(): the real data/weeks.js renders", async () => {
  const { weeks } = await import("../data/weeks.js");
  const out = el();
  renderLog(out, weeks, at(2026, 11, 25));
  assert.equal((out.innerHTML.match(/<article /g) || []).length, weeks.length || 0);
});

await run();

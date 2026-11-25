// The homepage: index.html, assets/home.js, assets/entry/home.js and
// assets/home.css (spec §10.1).
//
// What's pinned: the head (title, description, link-preview tags on
// og-site.png, the Organization data); the §5 head snippet and a modulepreload
// for every module the entry loads; the index rows, with each tool row equal
// to its data/projects.js entry (href, title, tagline, builtWith, and the
// shot's files and sizes) and in data order; that every $ amount is a
// SHIPPING rate; the removed revision-1 copy and brand files; the order of
// main (late content last); and, through renderHome() with a stand-in
// document and fetch, the status line in each state and when Listed now
// appears.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { projects } from "../data/projects.js";
import { SHIPPING, formatMoney } from "../data/products.js";
import { OWNER } from "../data/owner.js";
import { listingsFor } from "../scripts/fixtures/listings.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const HTML = read("index.html");
const CSS = read("assets/home.css");
const JS = read("assets/home.js");
const ENTRY = read("assets/entry/home.js");

const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, "");
const decode = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = html => decode(stripComments(html)
  .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<\/?(a|span|strong|b|em)\b[^>]*>/gi, "")
  .replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim();
const escAttr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const HEAD = (/<head>([\s\S]*?)<\/head>/.exec(HTML) || [, ""])[1];
const BODY = stripComments((/<body>([\s\S]*)<\/body>/.exec(HTML) || [, ""])[1]);
const MAIN = (/<main class="home">([\s\S]*)<\/main>/.exec(BODY) || [, ""])[1];

const metaContent = (name) => {
  const m = new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(HEAD);
  return m ? decode(m[1]) : null;
};
const rows = () => [...MAIN.matchAll(/<section class="index-row">([\s\S]*?)<\/section>/g)].map(m => m[1]);
const titleLink = row => {
  const m = /<h2 class="index-title"><a href="([^"]+)">([^<]+)<\/a><\/h2>/.exec(row);
  assert.ok(m, `a row without an h2.index-title link: ${row.slice(0, 120)}`);
  return { href: m[1], title: decode(m[2]) };
};

section("index.html: head");

test("title, description and link-preview tags are the spec's, on og-site.png", () => {
  assert.equal(decode((/<title>([^<]*)<\/title>/.exec(HEAD) || [])[1] || ""),
    "dhole.dev: refurbished retro consoles, browser tools and product case studies");
  const description = "Refurbished retro game consoles and controllers, each listed with photos of that exact unit. Also tools that run in your browser, and product case studies.";
  const ogTitle = "dhole.dev: refurbished retro consoles, browser tools and case studies";
  assert.equal(metaContent("description"), description);
  assert.equal(metaContent("og:description"), description);
  assert.equal(metaContent("twitter:description"), description);
  assert.equal(metaContent("og:title"), ogTitle);
  assert.equal(metaContent("twitter:title"), ogTitle);
  assert.equal(metaContent("og:image"), "https://dhole.dev/assets/brand/og-site.png");
  assert.equal(metaContent("twitter:image"), "https://dhole.dev/assets/brand/og-site.png");
  assert.equal(metaContent("og:image:width"), "1200");
  assert.equal(metaContent("og:image:height"), "630");
  assert.equal(metaContent("og:url"), "https://dhole.dev/");
  assert.match(HEAD, /<link rel="canonical" href="https:\/\/dhole\.dev\/" \/>/);
  assert.ok(existsSync(join(ROOT, "assets/brand/og-site.png")), "assets/brand/og-site.png is missing");
});

test("the §5 head snippet, in order, with ?v=2 on the stylesheets and the entry", () => {
  const snippet = [
    '<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/assets/brand/icon-180.png" />',
    '<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />',
    '<meta name="theme-color" content="#ffffff" />',
    '<link rel="stylesheet" href="/assets/site.css?v=2" />',
    '<link rel="stylesheet" href="/assets/home.css?v=2" />',
    '<script type="module" src="/assets/entry/home.js?v=2"></script>'
  ];
  let at = -1;
  for (const line of snippet) {
    const i = HEAD.indexOf(line);
    assert.ok(i > at, `missing or out of order: ${line}`);
    at = i;
  }
  assert.equal((HEAD.match(/rel="stylesheet"/g) || []).length, 2, "only site.css and home.css");
});

test("every module the entry loads is modulepreloaded, unversioned, and exists", () => {
  const preloads = [...HEAD.matchAll(/<link rel="modulepreload" href="([^"]+)" \/>/g)].map(m => m[1]);
  for (const p of preloads) {
    assert.ok(!p.includes("?"), `${p}: modulepreloads stay unversioned`);
    assert.ok(existsSync(join(ROOT, p)), `${p} is missing`);
  }
  // Walk the static imports from the entry. home.js is imported as
  // home.js?v=2 (an old cached copy can't render the new page, spec §2), so
  // its preload would fetch a URL nothing imports: it has none.
  const seen = new Set();
  const versioned = new Set();
  const walk = file => {
    for (const m of read(file).matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)) {
      const [spec, query] = m[1].split("?");
      const dep = join(dirname(file), spec).replace(/\\/g, "/");
      if (query) versioned.add(dep);
      if (seen.has(dep)) continue;
      seen.add(dep);
      walk(dep);
    }
  };
  walk("assets/entry/home.js");
  assert.deepEqual([...versioned], ["assets/home.js"], "the entry imports home.js?v=2, and nothing else versioned");
  assert.match(ENTRY, /import \{ renderHome \} from "\.\.\/home\.js\?v=2";/);
  for (const dep of seen) {
    if (versioned.has(dep)) assert.ok(!preloads.includes(`/${dep}`), `/${dep} is imported versioned, so its unversioned preload is wasted`);
    else assert.ok(preloads.includes(`/${dep}`), `no modulepreload for /${dep}`);
  }
  assert.ok(seen.has("assets/home.js") && seen.has("data/owner.js"), [...seen].join(", "));
});

test("Organization data: the new description and logo, the same email", () => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(HEAD);
  assert.ok(m, "no JSON-LD block");
  const org = JSON.parse(m[1])["@graph"].find(n => n["@type"] === "Organization");
  assert.equal(org.description, "Refurbished retro game consoles and controllers.");
  assert.equal(org.logo, "https://dhole.dev/assets/brand/icon-180.png");
  assert.equal(org.email, "support@dhole.dev");
  assert.ok(existsSync(join(ROOT, "assets/brand/icon-180.png")), "assets/brand/icon-180.png is missing");
});

test("no reference to the old brand files or stylesheets", () => {
  for (const old of ["og.png", "apple-touch-icon.png", "favicon.svg", "pages.css", "demo.css"]) {
    assert.ok(!new RegExp(`[/"]${old.replace(".", "\\.")}`).test(HTML), `index.html references ${old}`);
  }
});

section("index.html: body");

test("the h1 and lede, with nothing above the h1", () => {
  assert.match(MAIN, /^\s*<div class="wrap">\s*<div class="page-head">\s*<h1>I refurbish retro game consoles and controllers and sell them here\.<\/h1>\s*<p class="lede">Every listing has photos of the exact unit you'd get\. This is also where I keep the tools I've built and my product case studies\.<\/p>\s*<\/div>/);
  assert.equal((BODY.match(/<h1\b/g) || []).length, 1);
});

test("no eyebrow, hero buttons, hero note or revision-1 copy", () => {
  assert.ok(!/eyebrow/i.test(HTML), "an eyebrow");
  assert.ok(!/things I build/i.test(HTML), "'Things I build'");
  assert.ok(!/one at a time/i.test(HTML), "'one at a time'");
  assert.ok(!/\bhero\b|btn-primary|btn-buy|btn-ink/.test(BODY), "a hero or a filled button");
  for (const gone of ["Why the consoles are tested", "More on dhole.dev", "In the shop", "Browser tools",
    "reading rather than an opinion", "measured, not guessed", "actually"]) {
    assert.ok(!HTML.includes(gone), `still says "${gone}"`);
  }
  assert.ok(!/[—→←]/.test(stripComments(HTML)), "an em dash or arrow");
  assert.ok(!/<svg\b|\sstyle="/.test(BODY), "a glyph or an inline style");
});

test("main holds, in order: the head, the index, the Lazy Sunday line, #owner, #listed-now (last)", () => {
  const order = ['<div class="page-head">', '<div class="index">', '<p class="home-also">', '<div id="owner"></div>', '<div id="listed-now"></div>'];
  let at = -1;
  for (const s of order) {
    const i = MAIN.indexOf(s);
    assert.ok(i > at, `missing or out of order: ${s}`);
    at = i;
  }
  assert.match(MAIN, /<div id="listed-now"><\/div>\s*<\/div>\s*$/, "#listed-now is the last thing in main");
  assert.equal(textOf(/<p class="home-also">[\s\S]*?<\/p>/.exec(MAIN)[0]),
    "Also here: Lazy Sunday, a modded Minecraft server page for my friends.");
  assert.match(MAIN, /<p class="home-also">Also here: <a href="\/minecraft">Lazy Sunday<\/a>/);
});

test("the rows: Store, then one per data/projects.js entry in data order, then Portfolio", () => {
  const r = rows();
  assert.equal(r.length, projects.length + 2, `${r.length} rows`);
  assert.deepEqual(r.map(titleLink).map(l => l.href), ["/store", ...projects.map(p => p.demo), "/portfolio"]);
  assert.deepEqual(r.map(titleLink).map(l => l.title), ["Store", ...projects.map(p => p.title), "Portfolio"]);
});

test("the Store row: its text, and the status slot that home.js fills", () => {
  const store = rows()[0];
  assert.ok(textOf(store).includes("Refurbished consoles and controllers. Shipping is $18.00 for an order with a console or $6.00 for accessories on their own, and orders ship within two business days."), textOf(store));
  assert.match(store, /<p class="index-status" id="shelf-status" aria-live="polite"><span class="shelf-checking">Checking what's on the shelf…<\/span><noscript><a href="\/store">Open the store<\/a><\/noscript><\/p>/);
  assert.ok(!/class="index-media"/.test(store), "the Store row has no capture");
  // Without JS, "Checking…" would never change: a noscript style hides it.
  assert.match(HEAD, /<noscript><style>\.shelf-checking \{ display: none; \}<\/style><\/noscript>/);
});

test("each tool row matches its data/projects.js entry: href, title, tagline, builtWith and shot", () => {
  const r = rows().slice(1, -1);
  projects.forEach((p, i) => {
    const row = r[i];
    const link = titleLink(row);
    assert.equal(link.href, p.demo, p.id);
    const text = textOf(row);
    for (const k of ["title", "tagline", "builtWith"]) assert.ok(text.includes(p[k]), `${p.id}: the row doesn't say its ${k} "${p[k]}"`);
    assert.ok(row.includes(`<p class="quiet">${p.builtWith}</p>`), `${p.id}: builtWith in .quiet`);
    if (!p.shot) {
      assert.ok(!/<picture|<img|index-media/.test(row), `${p.id}: no shot in the data, so no capture`);
      return;
    }
    const m = p.shot.mobile;
    assert.ok(m, `${p.id}: a shot without a phone crop`);
    // Desktop capture from 60em; the phone crop below it, sized, as the <img>.
    assert.ok(row.includes(`<source media="(min-width: 60em)" srcset="${p.shot.src}" width="${p.shot.width}" height="${p.shot.height}" />`), `${p.id}: desktop <source>`);
    assert.ok(row.includes(`<img src="${m.src}" width="${m.width}" height="${m.height}" alt="${escAttr(p.shot.alt)}"`), `${p.id}: phone <img>`);
    assert.match(row, new RegExp(`<a class="index-media" href="${p.demo}" tabindex="-1">`), `${p.id}: the capture opens the tool`);
    // Title, text, then the capture: site.css gives a row's text 9 columns only when it is the last child.
    assert.ok(row.indexOf('class="index-text"') < row.indexOf('class="index-media"'), `${p.id}: text before the capture`);
  });
});

test("the Portfolio row", () => {
  const portfolio = rows().at(-1);
  assert.equal(textOf(portfolio), "Portfolio Case studies of products I've built on my own time by directing AI coding agents.");
});

test("every $ amount is formatMoney of a SHIPPING rate, and both rates appear", () => {
  const rates = Object.values(SHIPPING).map(s => formatMoney(s.cents));
  const amounts = HTML.match(/\$[\d.,]+\d/g) || [];
  assert.ok(amounts.length >= 2, `amounts: ${amounts}`);
  for (const a of amounts) assert.ok(rates.includes(a), `${a} isn't a SHIPPING rate (${rates.join(", ")})`);
  for (const r of rates) assert.ok(HTML.includes(r), `${r} is missing`);
  assert.ok(HTML.includes("two business days") && !/\b2 business days/.test(HTML), "dispatch is 'two business days'");
});

section("assets/home.css");

test("main is held at the viewport's height; the h1 runs at most 8 columns; captures are capped", () => {
  assert.match(CSS, /main\.home \{ min-height: calc\(100svh - var\(--header-h\)\); \}/);
  assert.match(CSS, /max-width: calc\(\(100% - 11 \* var\(--col-gap\)\) \* 8 \/ 12 \+ 7 \* var\(--col-gap\)\)/);
  assert.match(CSS, /\.home \.index-media \{[^}]*max-width: 240px;/);
});

test("tokens only, and no rules, boxes, shadows or radius on the rows", () => {
  const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(code), "a colour value");
  assert.ok(!/\bborder\b|box-shadow|gradient|border-radius|text-transform/.test(code), "a border, shadow, gradient, radius or uppercase");
  assert.ok(!/font-size:\s*(\d|0?\.\d)/.test(code), "a literal font size (use the tokens)");
});

section("assets/home.js and its entry");

test("the entry mounts the chrome with no current link, then renders", () => {
  assert.match(ENTRY, /mountChrome\(""\);/);
  assert.match(ENTRY, /renderHome\(\);/);
});

test("the old project cards, glyphs and product row are gone", () => {
  assert.ok(!/projectGlyph|home-projects|home-products|data\/projects\.js|chip|btn-sm/.test(JS));
  assert.ok(!/[—→←]/.test(JS), "an em dash or arrow");
});

// renderHome() against a stand-in document: three elements, a matchMedia
// answer, and fetch answering /api/store/listings.
const el = () => ({ innerHTML: "" });
let doc;
let wide = false;
let respond = () => ({ status: 200, body: { listings: [] } });
globalThis.document = { getElementById: id => doc[id] ?? null };
globalThis.matchMedia = query => ({ matches: query === "(min-width: 60em)" && wide, addEventListener() {} });
globalThis.fetch = async url => {
  assert.equal(String(url), "/api/store/listings");
  const { status, body } = respond();
  return { ok: status >= 200 && status < 300, status, json: async () => body };
};

const home = await import("../assets/home.js");
const { reloadBench } = await import("../assets/catalogue.js");

async function render({ units = 0, failed = false, isWide = false } = {}) {
  doc = { "shelf-status": el(), owner: el(), "listed-now": el() };
  wide = isWide;
  respond = () => (failed
    ? { status: 503, body: { error: "The store's live stock isn't available right now." } }
    : { status: 200, body: { listings: listingsFor({ count: units }) } });
  reloadBench();
  await home.renderHome();
  return { status: doc["shelf-status"].innerHTML, owner: doc.owner.innerHTML, listed: doc["listed-now"].innerHTML };
}
const cards = html => (html.match(/<article class="unit-card/g) || []).length;

test("home.js keeps exactly its one export (cached-module rule, spec §2)", () => {
  assert.deepEqual(Object.keys(home), ["renderHome"]);
});

test("0 units: the request line with the address as its text, and no Listed now", async () => {
  const r = await render({ units: 0 });
  assert.equal(r.status, 'Nothing listed right now. Email a request: <a href="mailto:support@dhole.dev?subject=Console%20request">support@dhole.dev</a>');
  assert.equal(r.listed, "");
});

test("1 unit: a link to the store, and one compact card below 960px", async () => {
  const r = await render({ units: 1 });
  assert.equal(r.status, '<a href="/store">1 unit listed now</a>');
  assert.match(r.listed, /<h2 id="listed-now-title">Listed now<\/h2>/);
  assert.equal(cards(r.listed), 1);
  assert.match(r.listed, /class="unit-card unit-card--compact"/);
  assert.ok(!/unit-cards--4|All \d+ units/.test(r.listed));
});

test("3 units at 960px and up: full cards in the 4-column row, and no 'All' link", async () => {
  const r = await render({ units: 3, isWide: true });
  assert.equal(r.status, '<a href="/store">3 units listed now</a>');
  assert.match(r.listed, /<div class="unit-cards unit-cards--4">/);
  assert.equal(cards(r.listed), 3);
  assert.ok(!/unit-card--compact|All \d+ units/.test(r.listed));
});

test("5 units: 4 cards (compact or full) and 'All 5 units in the store'", async () => {
  for (const isWide of [false, true]) {
    const r = await render({ units: 5, isWide });
    assert.equal(r.status, '<a href="/store">5 units listed now</a>');
    assert.equal(cards(r.listed), 4, `wide ${isWide}`);
    assert.match(r.listed, /<p class="listed-now-all"><a href="\/store">All 5 units in the store<\/a><\/p>/);
    // ro-9004's name is hostile: it arrives escaped.
    assert.ok(!/<script|<b>bold/.test(r.listed), "unescaped bench copy");
  }
});

test("a failed check: the store link, and no Listed now", async () => {
  const r = await render({ failed: true });
  assert.equal(r.status, `Couldn't check the shelf just now. <a href="/store">Open the store</a>`);
  assert.equal(r.listed, "");
});

test("#owner stays empty without a name, and gets 'Who runs dhole.dev' with one", async () => {
  assert.equal((await render()).owner, "");
  const saved = OWNER.firstName;
  try {
    OWNER.firstName = "Sam";
    const r = await render();
    assert.match(r.owner, /<section class="owner">\s*<h2>Who runs dhole\.dev<\/h2>/);
  } finally {
    OWNER.firstName = saved;
  }
});

test("status copy fits the copy rules: no '$', no em dash, the address shown wherever a request is offered", async () => {
  for (const opts of [{ units: 0 }, { units: 1 }, { units: 5 }, { failed: true }]) {
    const { status } = await render(opts);
    assert.ok(!/[$—→←]/.test(status), status);
    if (/mailto:/.test(status)) assert.ok(textOf(status).includes("support@dhole.dev"), status);
  }
});

await run();

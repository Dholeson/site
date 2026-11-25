// The homepage: index.html, assets/home.js, assets/entry/home.js and
// assets/home.css (spec §10.1; dark-spec §9.1).
//
// What's pinned: the head (title, description, link-preview tags on
// og-site.png, the Organization data); the §5 head snippet with the theme
// head (dark-spec §4.1) and ?v=3 (§2.3), and a modulepreload for every
// module the entry loads; the index rows, with each tool row equal to its
// data/projects.js entry (href, title, tagline, builtWith, and the shot's
// files and sizes, the chiptune theme pair in dark-spec §7's exact markup)
// and in data order; the Store row's hidden #shelf-media; that every $
// amount is a SHIPPING rate; the removed revision-1 copy and brand files;
// the order of main (late content last); the 280px phone cap and the
// shelf strip's CSS; and, through renderHome() with a stand-in document
// and fetch, the status line in each state (unchanged by the strip), when
// Listed now appears, and when #shelf-media shows up to three photos.
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

// The theme head (dark-spec §4.1) takes the place of the single theme-color:
// the dark theme-color first (the first matching one wins), and theme.js, a
// classic script, after the metas it rewrites and before every stylesheet.
test("the §5 head snippet with the theme head, in order, and ?v=3 on theme.js, the stylesheets and the entry", () => {
  const snippet = [
    '<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/assets/brand/icon-180.png" />',
    '<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />',
    '<meta name="color-scheme" content="light dark" />',
    '<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />',
    '<meta name="theme-color" content="#ffffff" />',
    '<script src="/assets/theme.js?v=3"></script>',
    '<link rel="stylesheet" href="/assets/site.css?v=3" />',
    '<link rel="stylesheet" href="/assets/home.css?v=3" />',
    '<script type="module" src="/assets/entry/home.js?v=3"></script>'
  ];
  let at = -1;
  for (const line of snippet) {
    const i = HEAD.indexOf(line);
    assert.ok(i > at, `missing or out of order: ${line}`);
    at = i;
  }
  assert.ok(HEAD.includes(snippet.slice(3, 8).join("\n  ")), "the theme head is one unbroken block, site.css right after theme.js");
  assert.equal((HEAD.match(/rel="stylesheet"/g) || []).length, 2, "only site.css and home.css");
  assert.equal((HEAD.match(/<meta name="theme-color"/g) || []).length, 2, "two theme-color metas");
  assert.ok(!/\?v=2\b/.test(HTML), "still ?v=2 somewhere");
});

test("every module the entry loads is modulepreloaded, unversioned, and exists", () => {
  const preloads = [...HEAD.matchAll(/<link rel="modulepreload" href="([^"]+)" \/>/g)].map(m => m[1]);
  for (const p of preloads) {
    assert.ok(!p.includes("?"), `${p}: modulepreloads stay unversioned`);
    assert.ok(existsSync(join(ROOT, p)), `${p} is missing`);
  }
  // Walk the static imports from the entry. home.js is imported as
  // home.js?v=3 (an old cached copy can't render the new page, spec §2,
  // dark-spec §2.3), so its preload would fetch a URL nothing imports: it
  // has none.
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
  assert.deepEqual([...versioned], ["assets/home.js"], "the entry imports home.js?v=3, and nothing else versioned");
  assert.match(ENTRY, /import \{ renderHome \} from "\.\.\/home\.js\?v=3";/);
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

test("the Store row: its text, the status slot that home.js fills, and the hidden #shelf-media after the text", () => {
  const store = rows()[0];
  assert.ok(textOf(store).includes("Refurbished consoles and controllers. Shipping is $18.00 for an order with a console or $6.00 for accessories on their own, and orders ship within two business days."), textOf(store));
  assert.match(store, /<p class="index-status" id="shelf-status" aria-live="polite"><span class="shelf-checking">Checking what's on the shelf…<\/span><noscript><a href="\/store">Open the store<\/a><\/noscript><\/p>/);
  assert.ok(!/class="index-media"/.test(store), "the Store row has no capture");
  // dark-spec §9.1: empty and hidden until home.js has photos for it, and the
  // row's last child, so the text keeps 5 columns in every shelf state.
  assert.match(store, /<\/div>\s*<div class="shelf-media" id="shelf-media" hidden><\/div>\s*$/, "#shelf-media, hidden and empty, right after .index-text");
  assert.equal((HTML.match(/id="shelf-media"/g) || []).length, 1);
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
    // dark-spec §7: a shot with a dark twin is the theme pair, exactly; one
    // without is a single <picture>, with no pair class.
    const media = (/<a class="index-media"[\s\S]*?<\/a>/.exec(row) || [""])[0].replace(/>\s+</g, "><");
    if (p.shot.dark) {
      const alt = escAttr(p.shot.alt);
      const pic = (cls, src, phone) => `<picture class="${cls}">` +
        `<source media="(min-width: 60em)" srcset="${src}" width="${p.shot.width}" height="${p.shot.height}" />` +
        `<img src="${phone}" width="${m.width}" height="${m.height}" alt="${alt}" loading="lazy" decoding="async" /></picture>`;
      assert.equal(media, `<a class="index-media" href="${p.demo}" tabindex="-1">` +
        pic("for-light", p.shot.src, m.src) + pic("for-dark", p.shot.dark.src, p.shot.dark.mobile) + "</a>", `${p.id}: the §7 pair`);
    } else {
      assert.ok(!/for-light|for-dark/.test(row) && (row.match(/<picture>/g) || []).length === 1, `${p.id}: one picture, no pair`);
    }
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

test("main is held at the viewport's height; the h1 runs at most 8 columns; captures are capped at 280px below 60em", () => {
  assert.match(CSS, /main\.home \{ min-height: calc\(100svh - var\(--header-h\)\); \}/);
  assert.match(CSS, /max-width: calc\(\(100% - 11 \* var\(--col-gap\)\) \* 8 \/ 12 \+ 7 \* var\(--col-gap\)\)/);
  // dark-spec §9.1: at 240 the chiptune capture was too small to read as the
  // tool; at full width it read as live controls.
  assert.match(CSS, /\.home \.index-media \{[^}]*max-width: 280px;/);
  assert.ok(!/240px/.test(CSS), "the old 240px cap, in a rule or a comment");
});

// home.css as rules, each with the @media it sits in (comments removed).
function cssRules(css) {
  const out = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (text, context) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith("@")) walk(body, [...context, head]);
      else out.push({ selector: head.replace(/\s+/g, " "), body: body.trim().replace(/\s+/g, " "), context });
      i = j;
    }
  };
  walk(src, []);
  return out;
}

// dark-spec §9.1: the Store row's strip of unit photos shows from 60em only,
// in the row's 4-column slot, absolutely placed so the row keeps its height;
// its photos sit on the photo panel, contain-fit, square.
test("the shelf strip: hidden below 60em, and :not([hidden]) only inside @media (min-width: 60em)", () => {
  const rules = cssRules(CSS);
  const find = sel => rules.filter(r => r.selector === sel);
  const WIDE = ["@media (min-width: 60em)"];
  assert.deepEqual(find(".shelf-media").map(r => [r.body, r.context]), [["display: none;", []]]);
  const expect = [
    [".home .shelf-media:not([hidden])", "display: block; grid-column: span 4; position: relative; align-self: stretch;"],
    [".shelf-strip", "position: absolute; inset: 0 0 auto 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-2);"],
    [".shelf-strip img", "display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; background: var(--sweep); object-fit: contain;"]
  ];
  for (const [sel, body] of expect) {
    assert.deepEqual(find(sel).map(r => [r.body, r.context]), [[body, WIDE]], sel);
  }
  for (const r of rules) {
    if (/:not\(\[hidden\]\)/.test(r.selector)) assert.deepEqual(r.context, WIDE, `${r.selector} outside @media (min-width: 60em)`);
    if (/shelf-strip/.test(r.selector)) assert.deepEqual(r.context, WIDE, `${r.selector} outside @media (min-width: 60em)`);
  }
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

// dark-spec §9.1: the strip is always rendered, whatever the width, and CSS
// alone shows or hides it, so a window resized across 60em needs no script.
// So nothing on its code path may ask matchMedia (Listed now still does).
// And it unhides with removeAttribute, never classList.
test("the shelf strip's code path never calls matchMedia, and unhides with removeAttribute", () => {
  const code = JS.replace(/^\s*\/\/.*$/gm, "");
  const helpers = (/const imageSrc = [\s\S]*?\.join\(""\);/.exec(code) || [""])[0];
  assert.ok(/const strip = /.test(helpers), "the imageSrc and strip helpers");
  const start = code.indexOf('document.getElementById("shelf-media")');
  const end = code.indexOf("if (!listed || !live.length) return;");
  assert.ok(start > 0 && end > start, "the strip is filled before Listed now, whatever Listed now does");
  const path = code.slice(start, end);
  assert.match(path, /media\.removeAttribute\("hidden"\);/);
  for (const part of [helpers, path]) {
    assert.ok(!/matchMedia|WIDE|innerWidth|classList/.test(part), `the strip's code path: ${part}`);
  }
  assert.ok(code.indexOf("matchMedia(") > end, "matchMedia only for Listed now, after the strip");
});

// renderHome() against a stand-in document: four elements, a matchMedia
// answer, and fetch answering /api/store/listings. #shelf-media starts with
// its hidden attribute, as in index.html, and records removeAttribute.
const el = () => ({ innerHTML: "" });
const hiddenEl = () => ({
  innerHTML: "",
  attrs: new Set(["hidden"]),
  hasAttribute(name) { return this.attrs.has(name); },
  removeAttribute(name) { this.attrs.delete(name); }
});
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

async function render({ units = 0, failed = false, isWide = false, listings = null } = {}) {
  doc = { "shelf-status": el(), owner: el(), "listed-now": el(), "shelf-media": hiddenEl() };
  wide = isWide;
  respond = () => (failed
    ? { status: 503, body: { error: "The store's live stock isn't available right now." } }
    : { status: 200, body: { listings: listings || listingsFor({ count: units }) } });
  reloadBench();
  await home.renderHome();
  const media = doc["shelf-media"];
  return {
    status: doc["shelf-status"].innerHTML, owner: doc.owner.innerHTML, listed: doc["listed-now"].innerHTML,
    media: media.innerHTML, mediaHidden: media.hasAttribute("hidden")
  };
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

// dark-spec §9.1: #shelf-media holds the first three listed units' first
// photos, in the API's order, decorative (alt="", in a link out of the tab
// order and hidden from screen readers), lazy; the status line is exactly
// what it was, with no thumbnail, at every width.
test("0 units or a failed check: #shelf-media keeps hidden and stays empty, and the status line is unchanged", async () => {
  for (const isWide of [false, true]) {
    const none = await render({ units: 0, isWide });
    assert.deepEqual([none.media, none.mediaHidden], ["", true], `0 units, wide ${isWide}`);
    assert.equal(none.status, 'Nothing listed right now. Email a request: <a href="mailto:support@dhole.dev?subject=Console%20request">support@dhole.dev</a>');
    const failed = await render({ failed: true, isWide });
    assert.deepEqual([failed.media, failed.mediaHidden], ["", true], `failed, wide ${isWide}`);
    assert.equal(failed.status, `Couldn't check the shelf just now. <a href="/store">Open the store</a>`);
  }
});

test("3 and 5 units: the status line is unchanged, and #shelf-media shows one hidden-from-AT link with the first three photos, in the API's order, whatever the width", async () => {
  for (const units of [3, 5]) {
    const photos = listingsFor({ count: units }).filter(p => p.image).slice(0, 3).map(p => p.image);
    assert.equal(photos.length, 3);
    const expected = `<a class="shelf-strip" href="/store" tabindex="-1" aria-hidden="true">` +
      photos.map(src => `<img src="${src}" alt="" loading="lazy" decoding="async" />`).join("") + "</a>";
    for (const isWide of [false, true]) {
      const r = await render({ units, isWide });
      assert.equal(r.status, `<a href="/store">${units} units listed now</a>`, `${units} units, wide ${isWide}`);
      assert.ok(!/<img/.test(r.status), "a thumbnail in the status line");
      assert.equal(r.mediaHidden, false, `${units} units, wide ${isWide}: still hidden`);
      assert.equal(r.media, expected, `${units} units, wide ${isWide}`);
      assert.equal((r.media.match(/<a\b/g) || []).length, 1);
      assert.equal((r.media.match(/<img\b/g) || []).length, 3);
    }
  }
});

// A bench listing with no usable photo never reaches the page (catalogue.js
// drops it), so the strip and the count always agree: no empty strip, and
// the strip takes the next unit that has a photo.
test("listings without a photo: no strip when none has one, and the strip takes the next unit with one", async () => {
  const bare = listingsFor({ count: 3 }).map(p => ({ ...p, image: null, images: [] }));
  const none = await render({ listings: bare, isWide: true });
  assert.equal(none.status, 'Nothing listed right now. Email a request: <a href="mailto:support@dhole.dev?subject=Console%20request">support@dhole.dev</a>');
  assert.deepEqual([none.media, none.mediaHidden], ["", true]);
  const all = listingsFor({ count: 5 });
  const r = await render({ listings: all.map((p, i) => (i === 1 ? { ...p, image: null, images: [] } : p)), isWide: true });
  assert.equal(r.status, '<a href="/store">4 units listed now</a>');
  const srcs = [...r.media.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(srcs, [all[0].image, all[2].image, all[3].image]);
  assert.equal(r.mediaHidden, false);
});

test("status copy fits the copy rules: no '$', no em dash, the address shown wherever a request is offered", async () => {
  for (const opts of [{ units: 0 }, { units: 1 }, { units: 5 }, { failed: true }]) {
    const { status } = await render(opts);
    assert.ok(!/[$—→←]/.test(status), status);
    if (/mailto:/.test(status)) assert.ok(textOf(status).includes("support@dhole.dev"), status);
  }
});

await run();

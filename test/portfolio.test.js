// The portfolio (/portfolio) and case-study pages (/case?id=), and the data
// behind them (data/portfolio.js).
//
// - portfolio.html's static head block is exactly what npm run sync:owner
//   writes from data/owner.js and the profile, so a name or contact change
//   can't ship half-done.
// - Every "Checked:" figure is one the file already states elsewhere: the
//   case studies claim nothing new.
// - The old look is gone: no accent colours, monograms, AI suffix, filters,
//   "Open it" or arrows.
// - case.html keeps one seo block for functions/case.js and no canonical.
// - The renderer's output, through a small DOM stand-in.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { OWNER } from "../data/owner.js";
import { profile, work, findWork } from "../data/portfolio.js";
import { esc } from "../assets/esc.js";
import {
  portfolioOwnerBlock, ownerRegion, withOwnerBlock, contactLinks,
  HEADING_NO_NAME, LEDE_NO_NAME, LEDE_NAMED, OWNER_START, OWNER_END
} from "../scripts/lib/owner-markup.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const PORTFOLIO = read("portfolio.html");
const CASE = read("case.html");
const PAGE_JS = read("assets/portfolio-page.js");
const DATA_JS = read("data/portfolio.js");

const set = v => typeof v === "string" && v.trim() !== "";
const count = (s, sub) => s.split(sub).length - 1;
const metaContent = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:name|property)="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)"`));
  return m ? m[1] : null;
};

// Every string (and number) in a value, with the path it came from.
function strings(value, path = "", out = []) {
  if (typeof value === "string" || typeof value === "number") out.push({ path, text: String(value) });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
}

const SPEC_ORDER = [
  "fsca-show-finder", "discover-cleaner", "drift-tester", "halo-debrief", "fsca-site", "lazy-sunday", "chiptune",
  "osrs-skills", "shop", "leagueify", "darkroom"
];
const EARLIER = ["osrs-skills", "shop", "leagueify", "darkroom"];

// ---------- the static head block ----------

section("portfolio.html: the owner block (npm run sync:owner)");

test("the block between owner:start and owner:end is portfolioOwnerBlock(OWNER, profile), byte for byte", () => {
  const { inner } = ownerRegion(PORTFOLIO);
  assert.equal(count(PORTFOLIO, OWNER_START), 1, "one owner:start marker");
  assert.equal(count(PORTFOLIO, OWNER_END), 1, "one owner:end marker");
  assert.ok(inner === portfolioOwnerBlock(OWNER, profile),
    "portfolio.html's owner block is out of date with data/owner.js or the profile in data/portfolio.js: run npm run sync:owner");
});

const block = ownerRegion(PORTFOLIO).inner;

test("the h1 is OWNER.fullName, or 'Product case studies' without one", () => {
  const h1s = [...PORTFOLIO.matchAll(/<h1>([^<]*)<\/h1>/g)].map(m => m[1]);
  assert.equal(h1s.length, 1, "one h1 on the page");
  assert.ok(block.includes(`<h1>${h1s[0]}</h1>`), "the h1 is inside the owner block");
  assert.equal(h1s[0], set(OWNER.fullName) ? esc(OWNER.fullName.trim()) : "Product case studies");
});

test("p.role is there exactly when fullName is set, and the lede matches", () => {
  assert.equal(/<p class="role">Senior product manager<\/p>/.test(block), set(OWNER.fullName));
  assert.equal(count(PORTFOLIO, 'class="role"'), set(OWNER.fullName) ? 1 : 0, "no free-floating role line");
  assert.ok(block.includes(`<p class="lede">${set(OWNER.fullName) ? LEDE_NAMED : LEDE_NO_NAME}</p>`));
});

test("each contact link is in the block exactly when its profile field is set", () => {
  const expect = {
    email: [set(profile.email) && `href="mailto:${esc(profile.email.trim())}"`, "Email me"],
    resume: [set(profile.resume) && `href="${esc(profile.resume.trim())}"`, "Résumé (PDF)"],
    linkedin: [set(profile.linkedin) && `href="${esc(profile.linkedin.trim())}"`, "LinkedIn"],
    github: [set(profile.github) && `href="${esc(profile.github.trim())}"`, "GitHub"]
  };
  for (const [field, [href, label]] of Object.entries(expect)) {
    if (href) {
      assert.ok(block.includes(href), `${field}: ${href}`);
      assert.ok(block.includes(`>${esc(label)}</a>`), `${field}: label ${label}`);
    } else {
      assert.ok(!block.includes(`>${esc(label)}</a>`), `${field} is null, so no "${label}" link`);
    }
  }
  assert.equal(/class="btn-row/.test(block), contactLinks(profile).length > 0, "a .btn-row only when a link is set");
});

section("scripts/lib/owner-markup.mjs: the generator");

test("no name: the 'Product case studies' h1, the long lede, no role line", () => {
  const out = portfolioOwnerBlock({ fullName: null }, { github: "https://github.com/x" });
  assert.ok(out.includes(`<h1>${HEADING_NO_NAME}</h1>`));
  assert.ok(out.includes(LEDE_NO_NAME));
  assert.ok(!out.includes('class="role"'));
  assert.equal(portfolioOwnerBlock({ fullName: "   " }, {}), portfolioOwnerBlock({ fullName: null }, {}), "a blank name counts as none");
});

test("a name: h1 = the name (escaped), p.role, the short lede", () => {
  const out = portfolioOwnerBlock({ fullName: " Ada <Lovelace> & Co " }, {});
  assert.ok(out.includes("<h1>Ada &lt;Lovelace&gt; &amp; Co</h1>"), out);
  assert.ok(out.includes('<p class="role">Senior product manager</p>'));
  assert.ok(out.includes(`<p class="lede">${LEDE_NAMED}</p>`));
  assert.ok(!out.includes(LEDE_NO_NAME));
  assert.ok(out.indexOf("<h1>") < out.indexOf('class="role"') && out.indexOf('class="role"') < out.indexOf('class="lede"'));
});

test("contact: only the links that are set, in order, Email me ink-filled, every value escaped", () => {
  const all = portfolioOwnerBlock({ fullName: null }, {
    email: "me@example.com", resume: "/cv.pdf", linkedin: "https://www.linkedin.com/in/x\"><script>", github: "https://github.com/x"
  });
  const labels = [...all.matchAll(/<a class="([^"]+)" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(m => [m[1], m[3]]);
  assert.deepEqual(labels, [["btn-ink", "Email me"], ["btn", "Résumé (PDF)"], ["btn", "LinkedIn"], ["btn", "GitHub"]]);
  assert.ok(all.includes('href="mailto:me@example.com"'));
  assert.ok(!all.includes("<script>"), "a hostile URL is escaped");
  assert.ok(all.includes("&quot;&gt;&lt;script&gt;"));
  assert.ok(!portfolioOwnerBlock({ fullName: null }, {}).includes("btn-row"), "no links: no row");
  assert.ok(!portfolioOwnerBlock({ fullName: null }, null).includes("btn-row"), "no profile at all: no row");
});

test("withOwnerBlock replaces only the region, and refuses missing or repeated markers", () => {
  const page = `a\n<!-- owner:start: note -->\nold\n<!-- owner:end -->\nb`;
  assert.equal(withOwnerBlock(page, "NEW"), "a\n<!-- owner:start: note -->NEW<!-- owner:end -->\nb");
  assert.throws(() => withOwnerBlock("no markers", "x"), /owner:start/);
  assert.throws(() => withOwnerBlock(page + page, "x"), /owner:start/);
  assert.throws(() => withOwnerBlock("<!-- owner:end --><!-- owner:start -->", "x"));
});

// ---------- data/portfolio.js ----------

section("data/portfolio.js");

test("entries are in the spec's order, with the four unfinished ones last under group 'earlier'", () => {
  assert.deepEqual(work.map(w => w.id), SPEC_ORDER);
  assert.deepEqual(work.filter(w => w.group === "earlier").map(w => w.id), EARLIER);
  for (const w of work) assert.ok(w.group === undefined || w.group === "earlier", `${w.id}: group ${w.group}`);
});

test("no accent, monogram or AI suffix; no 'actually', no em dash and no 'X, not Y' frame in any string", () => {
  assert.ok(!/\bconst AI\b/.test(DATA_JS), "const AI is gone");
  for (const w of work) {
    assert.ok(!("accent" in w), `${w.id}: accent`);
    assert.ok(!("monogram" in w), `${w.id}: monogram`);
    for (const { path, text } of strings(w)) {
      assert.ok(!text.includes("Built with AI coding agents"), `${w.id}.${path}: the AI suffix`);
      assert.ok(!/\bactually\b/i.test(text), `${w.id}.${path}: "actually"`);
      assert.ok(!text.includes("—"), `${w.id}.${path}: em dash`);
      // Spec §14 allows at most 2 site-wide; the case studies spend none.
      assert.ok(!/,\s+not\s/i.test(text), `${w.id}.${path}: an "X, not Y" frame`);
    }
  }
});

test("every number in a 'checked' line is stated elsewhere in the file, outside the checked lines", () => {
  const others = strings({ profile, work }).filter(s => !/(^|\.)checked$/.test(s.path)).map(s => s.text).join("\n");
  const withChecked = work.filter(w => set(w.checked));
  assert.deepEqual(withChecked.map(w => w.id), ["fsca-show-finder", "discover-cleaner", "osrs-skills", "leagueify", "darkroom"]);
  for (const w of withChecked) {
    const groups = w.checked.match(/\d+(?:[.,]\d+)*/g) || [];
    assert.ok(groups.length, `${w.id}: a checked line without a figure`);
    for (const g of groups) {
      const re = new RegExp(`(?<![\\d.,])${g.replace(/[.,]/g, "\\$&")}(?![\\d]|[.,]\\d)`);
      assert.ok(re.test(others), `${w.id}: "${g}" in its checked line appears nowhere else in data/portfolio.js`);
    }
  }
});

test("the checked lines are the approved wording", () => {
  const by = id => findWork(id).checked;
  assert.equal(by("fsca-show-finder"), "Every parser is checked against the index printed in each program (up to 524 of 524 entries matched), and all 274 programs were re-checked after one wrong start time was reported.");
  assert.equal(by("discover-cleaner"), "An adversarial verifier confirmed 171 of the bugs about 20 agents reported and refuted 5. 444 automated tests. April 2026 plays within 2 of Last.fm's report (661 vs 659).");
  assert.equal(by("osrs-skills"), "27 features verified in-game by hand, which caught an XP table where level 99 came out as 73.");
  assert.equal(by("leagueify"), "22 tests run the old and new storage side by side, and all 1,523 stored matches come back identical.");
  assert.equal(by("darkroom"), "Over 3,300 automated tests, plus an automated run that plays through the whole night.");
});

test("link labels name where they go: no 'Open it', no bare 'Source', no arrows, none repeated", () => {
  const labels = work.flatMap(w => (w.links || []).map(l => ({ id: w.id, ...l })));
  for (const l of labels) {
    assert.ok(!/^(open it|open|source|case study|see the page|visit the site)$/i.test(l.label.trim()), `${l.id}: "${l.label}"`);
    assert.ok(!/[→←]/.test(l.label), `${l.id}: arrow in "${l.label}"`);
    assert.ok(!/\.html(\?|#|$)/.test(l.href), `${l.id}: ${l.href}`);
  }
  const primaries = work.map(w => (w.links || []).find(l => l.primary)).filter(Boolean).map(l => l.label);
  assert.equal(new Set(primaries).size, primaries.length, `primary labels repeat: ${primaries.join(" | ")}`);
  for (const w of work) assert.ok((w.links || []).filter(l => l.primary).length <= 1, `${w.id}: one primary link at most`);
});

test("the drift tester's outcome is 'Live.' and it claims no verdict", () => {
  const d = findWork("drift-tester");
  assert.equal(d.outcome, "Live.");
  assert.ok(!strings(d).some(s => /verdict/i.test(s.text)), "the tester no longer gives a verdict");
});

test("every screenshot is a real file at its stated pixel size, with alt text", () => {
  for (const w of work.filter(w => w.image)) {
    assert.ok(w.image.startsWith("/assets/portfolio/"), `${w.id}: ${w.image}`);
    const file = join(ROOT, w.image);
    assert.ok(existsSync(file), `${w.id}: ${w.image} is missing`);
    assert.deepEqual(imageSize(file), [w.imageWidth, w.imageHeight], `${w.id}: imageWidth/imageHeight`);
    assert.ok(set(w.imageAlt), `${w.id}: imageAlt`);
  }
});

test("profile and findWork keep working, including old ids", () => {
  assert.deepEqual(Object.keys(profile).sort(), ["email", "github", "linkedin", "resume"]);
  assert.equal(findWork("discover-cleaner").id, "discover-cleaner");
  assert.equal(findWork("spotify-discover-cleaner").id, "discover-cleaner");
  assert.equal(findWork("nope"), null);
  assert.equal(findWork(null), null);
  assert.equal(new Set(work.map(w => w.id)).size, work.length, "ids are unique");
});

// ---------- the pages ----------

section("portfolio.html and case.html");

test("portfolio.html: head per the spec, the list holder, a noscript, and none of the old furniture", () => {
  assert.ok(PORTFOLIO.includes("<title>Product case studies | dhole.dev</title>"));
  assert.equal(metaContent(PORTFOLIO, "description"), "Case studies of products built on my own time by a senior product manager directing AI coding agents, and how each was checked.");
  assert.equal(metaContent(PORTFOLIO, "og:image"), "https://dhole.dev/assets/brand/og-portfolio.png");
  assert.equal(metaContent(PORTFOLIO, "og:image:width"), "1200");
  assert.equal(metaContent(PORTFOLIO, "og:image:height"), "630");
  assert.equal(metaContent(PORTFOLIO, "twitter:image"), "https://dhole.dev/assets/brand/og-portfolio.png");
  assert.match(PORTFOLIO, /<link rel="canonical" href="https:\/\/dhole\.dev\/portfolio" \/>/);
  for (const href of ["/assets/site.css?v=2", "/assets/portfolio.css?v=2"]) assert.ok(PORTFOLIO.includes(`<link rel="stylesheet" href="${href}" />`), href);
  assert.ok(PORTFOLIO.includes('<script type="module" src="/assets/entry/portfolio.js?v=2"></script>'));
  assert.ok(PORTFOLIO.includes('<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />'));
  assert.ok(PORTFOLIO.includes('<meta name="theme-color" content="#ffffff" />'));
  assert.ok(PORTFOLIO.includes('<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />'));
  assert.ok(PORTFOLIO.includes('<div id="pf-list" class="pf-list"></div>'));
  assert.match(PORTFOLIO, /<noscript><p class="notice noscript"><strong>This page needs JavaScript to show the case studies\.<\/strong>/);
  for (const old of ["eyebrow", "pf-process", "pf-filters", "pf-grid", "pages.css", "og.png", "favicon.svg", "apple-touch-icon.png"]) {
    assert.ok(!PORTFOLIO.includes(old), `portfolio.html still has ${old}`);
  }
});

test("case.html: one seo block with the fallback head, no canonical, #case-main, a noscript and 'All case studies'", () => {
  assert.equal(count(CASE, "<!-- seo:start"), 1, "one seo:start");
  assert.equal(count(CASE, "<!-- seo:end -->"), 1, "one seo:end");
  assert.ok(CASE.indexOf("<!-- seo:start") < CASE.indexOf("<!-- seo:end -->"));
  const seoBlock = CASE.slice(CASE.indexOf("<!-- seo:start"), CASE.indexOf("<!-- seo:end -->"));
  assert.ok(seoBlock.includes("<title>Case study | dhole.dev</title>"));
  assert.ok(set(metaContent(seoBlock, "description")));
  assert.equal(metaContent(seoBlock, "og:image"), "https://dhole.dev/assets/brand/og-portfolio.png");
  assert.equal(metaContent(seoBlock, "og:image:width"), "1200");
  assert.equal(metaContent(seoBlock, "og:image:height"), "630");
  for (const k of ["og:title", "og:description", "twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    assert.ok(set(metaContent(seoBlock, k)), k);
  }
  assert.ok(!/rel="canonical"/.test(CASE), "no canonical: every case would claim to be one page");
  assert.ok(!/og:url/.test(CASE), "no og:url either");
  assert.equal(count(CASE, "<title>"), 1);
  assert.ok(CASE.includes('<article id="case-main" class="case"></article>'));
  assert.match(CASE, /<noscript><p class="notice noscript"><strong>This page needs JavaScript to show the case studies\.<\/strong>/);
  assert.ok(CASE.includes('<p class="case-all"><a class="btn-text" href="/portfolio">All case studies</a></p>'));
  assert.ok(CASE.indexOf('id="case-main"') < CASE.indexOf('class="case-all"'), "the link comes after #case-main (the script moves it under the head)");
  assert.ok(CASE.includes('<script type="module" src="/assets/entry/case.js?v=2"></script>'));
  assert.ok(!CASE.includes("eyebrow") && !CASE.includes("pages.css") && !CASE.includes("og.png"));
});

test("both entries mount the chrome with the 'portfolio' key and import the renderer versioned", () => {
  for (const f of ["assets/entry/portfolio.js", "assets/entry/case.js"]) {
    const src = read(f);
    assert.match(src, /mountChrome\("portfolio"\)/, f);
    // A copy of the old renderer cached under /assets/* would render into
    // markup it no longer matches.
    assert.match(src, /from "\.\.\/portfolio-page\.js\?v=2"/, `${f}: import portfolio-page.js?v=2`);
  }
  for (const [f, html] of [["portfolio.html", PORTFOLIO], ["case.html", CASE]]) {
    assert.ok(!html.includes('href="/assets/portfolio-page.js"'), `${f}: an unversioned preload of portfolio-page.js fetches a copy the entry never uses`);
  }
});

test("no 'Open it', no arrows, no filters, monograms or accents in the pages and the renderer", () => {
  for (const [f, text] of [["portfolio.html", PORTFOLIO], ["case.html", CASE], ["assets/portfolio-page.js", PAGE_JS], ["data/portfolio.js", DATA_JS]]) {
    assert.ok(!/Open it/.test(text), `${f}: "Open it"`);
    assert.ok(!/[→←]/.test(text), `${f}: an arrow`);
    assert.ok(!text.includes("—"), `${f}: an em dash`);
  }
  for (const old of ["monogram", "thumb(", "pf-filter", "accent", "chip", "eyebrow", "case-hard"]) {
    assert.ok(!PAGE_JS.includes(old), `assets/portfolio-page.js still has ${old}`);
  }
  const css = read("assets/portfolio.css");
  assert.ok(!/\.pf-row[^{]*\{[^}]*\bborder/.test(css), "no border on .pf-row");
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), "no colour values in portfolio.css");
});

// ---------- the renderer, through a DOM stand-in ----------

section("assets/portfolio-page.js: what it renders");

// Just enough DOM for renderPortfolio() and renderCase(): elements whose
// innerHTML is a string, and the few calls the renderer makes.
function fakeElement(extra = {}) {
  return { innerHTML: "", className: "", calls: [], after(n) { this.calls.push(["after", n]); }, append(n) { this.calls.push(["append", n]); }, ...extra };
}

async function renderWith(path) {
  const url = new URL(path, "https://dhole.dev");
  const pfList = fakeElement();
  const link = fakeElement({ className: "btn-text" });
  const all = fakeElement({ querySelector: sel => (sel === "a" ? link : null) });
  const head = fakeElement();
  const caseMain = fakeElement({ querySelector: sel => (sel === ".case-head" ? head : null) });
  const replaced = [];
  const meta = { content: "", setAttribute(k, v) { this[k] = v; } };
  globalThis.location = { search: url.search, hash: "", pathname: url.pathname };
  globalThis.history = { replaceState: (s, t, u) => replaced.push(u) };
  globalThis.document = {
    title: "",
    getElementById: id => ({ "pf-list": pfList, "case-main": caseMain })[id] || null,
    querySelector: sel => (sel === ".case-all" ? all : sel === 'meta[name="description"]' ? meta : null)
  };
  const mod = await import("../assets/portfolio-page.js");
  if (url.pathname === "/portfolio") mod.renderPortfolio(); else mod.renderCase();
  return { list: pfList.innerHTML, main: caseMain.innerHTML, title: document.title, head, caseMain, link, all, replaced, meta };
}

test("the list: every entry in order, Checked lines, the earlier group last, and only real screenshots", async () => {
  const { list } = await renderWith("/portfolio");
  const titles = [...list.matchAll(/<h([23]) class="pf-title"><a href="\/case\?id=([^"]+)">/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(titles.map(t => t[1]), SPEC_ORDER);
  assert.deepEqual(titles.filter(t => t[0] === "3").map(t => t[1]), EARLIER, "earlier entries are h3s under their group's h2");
  const groupAt = list.indexOf('<h2 id="pf-earlier">Earlier and in progress</h2>');
  assert.ok(groupAt > list.indexOf("/case?id=chiptune") && groupAt < list.indexOf("/case?id=osrs-skills"), "the group follows the main list");
  assert.equal(count(list, "<span class=\"quiet\">Checked:</span>"), work.filter(w => set(w.checked)).length);
  assert.equal(count(list, "<img "), work.filter(w => w.image).length, "one image per real screenshot");
  assert.match(list, /<img src="\/assets\/portfolio\/discover-cleaner\.webp" alt="Discover Cleaner&#39;s Now page[^"]*" width="1440" height="900"/);
  assert.ok(list.includes('<p class="quiet">Live demo; open source, 2026</p>'));
  assert.ok(list.includes('<a class="btn-text" href="/projects/drift-tester">Open the drift tester</a>'));
  assert.ok(list.includes('target="_blank" rel="noopener">Open the Show Finder</a>'));
  assert.ok(!/[→←]|Open it|Case study</.test(list));
});

test("a case: head, the link under it, facts in order, named buttons with the first ink-filled, sections, pager", async () => {
  const r = await renderWith("/case?id=discover-cleaner");
  assert.equal(r.title, "Discover Cleaner: case study | dhole.dev");
  assert.deepEqual(r.head.calls.map(c => c[0]), ["after"], "'All case studies' goes right after the head block");
  assert.equal(r.head.calls[0][1], r.all);
  assert.equal(r.link.className, "btn-text");
  const m = r.main;
  assert.ok(m.indexOf("<h1>Discover Cleaner</h1>") < m.indexOf('class="case-pitch"'));
  assert.deepEqual([...m.matchAll(/<dt>([^<]+)<\/dt>/g)].map(x => x[1]), ["Role", "For", "Status", "How to see it", "Year", "Checked"]);
  assert.match(m, /<a class="btn-ink" href="\/projects\/discover-cleaner-demo\/">Open the Discover Cleaner demo<\/a><a class="btn" href="https:\/\/github\.com\/Dholeson\/spotify-discover-cleaner"[^>]*>Source on GitHub<\/a>/);
  assert.equal(count(m, "btn-ink"), 1, "one ink button");
  // "Talk to me about this" follows the profile: it appears once an email or
  // LinkedIn is set (npm run sync:owner), so the expected list does too.
  const heads = [...m.matchAll(/<h2>([^<]+)<\/h2>/g)].map(x => x[1]);
  const contactSet = set(profile.email) || set(profile.linkedin);
  assert.deepEqual(heads, ["The problem", "What shipped", "Decisions", "Outcome", ...(contactSet ? ["Talk to me about this"] : [])]);
  assert.equal(count(m, "<h3>"), findWork("discover-cleaner").decisions.length);
  assert.ok(m.includes('<span class="quiet">Note:</span> Not affiliated'));
  assert.ok(m.includes('<span class="quiet">Built with:</span> Python, Flask'));
  assert.ok(m.includes('width="1440" height="900"'), "the screenshot holds its size");
  assert.ok(m.includes('rel="prev">Previous: FSCA Show Finder</a>'));
  assert.ok(m.includes('rel="next">Next: Controller Drift Tester</a>'));
  assert.equal(m.includes("Talk to me about this"), contactSet, "contact only when set");
  assert.ok(!/[→←]/.test(m));
  assert.equal(r.replaced.length, 0, "the canonical id stays as it is");
});

test("an old id renders the case and moves the address to the current id; the ends of the list have one pager link", async () => {
  const alias = await renderWith("/case?id=spotify-discover-cleaner");
  assert.ok(alias.main.includes("<h1>Discover Cleaner</h1>"));
  assert.deepEqual(alias.replaced, ["/case?id=discover-cleaner"]);
  const first = (await renderWith("/case?id=fsca-show-finder")).main;
  assert.ok(!first.includes("Previous:") && first.includes("Next: Discover Cleaner"));
  const last = (await renderWith("/case?id=darkroom")).main;
  assert.ok(last.includes("Previous: Leagueify") && !last.includes("Next:"));
  assert.ok(!last.includes("<img "), "no screenshot, no image");
});

test("an unknown id: 'No case study with that id' and the 'All case studies' button", async () => {
  for (const path of ["/case?id=nope", "/case"]) {
    const r = await renderWith(path);
    assert.equal(r.title, "Case study not found | dhole.dev", path);
    assert.ok(r.main.includes("<h1>No case study with that id</h1>"), path);
    assert.equal(r.link.className, "btn", `${path}: the link becomes a .btn`);
    assert.deepEqual(r.caseMain.calls.map(c => c[0]), ["append"], path);
  }
});

// WebP (VP8, VP8L, VP8X) and PNG pixel sizes, for the screenshot check.
function imageSize(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  throw new Error(`${file}: not a WebP or PNG this test can read`);
}

await run();

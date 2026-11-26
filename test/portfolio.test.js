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
// - Both pages carry the theme head (dark-spec §4.1) and ?v=3 (§2.3); in
//   case.html it sits after the seo block, which functions/case.js replaces.
// - Every screenshot, dark twin and gallery view is a real file at its
//   stated size. Captures of the site's own tools are shared with home and
//   /projects, not copied (§9.5).
// - The renderer's output, through a small DOM stand-in: the theme pair for
//   an entry with imageDark (both lazy), "More views" for a gallery, and the
//   two-up rule for text-only rows (§9.5, §9.6).
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
// dark-spec §4.1: the theme head, where the single #ffffff theme-color and
// the site.css link used to be. theme.js is a classic script after the
// metas it rewrites and before every stylesheet.
const THEME_HEAD = [
  '<meta name="color-scheme" content="light dark" />',
  '<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />',
  '<meta name="theme-color" content="#ffffff" />',
  '<script src="/assets/theme.js?v=3"></script>',
  '<link rel="stylesheet" href="/assets/site.css?v=3" />'
].join("\n  ");
const CHIPTUNE_ALT = "The chiptune sequencer playing its preloaded pattern, with a dashed outline on the step being heard";
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

// The path rule is relaxed on purpose (dark-spec §9.5). The portfolio's own
// wide screenshot (image) still lives under /assets/portfolio/. The phone
// crop, the dark twins and the gallery views may also be captures the home
// page, /projects or a tool's page already uses (/assets/home/,
// /assets/projects/): shared captures of the site's own tools, not copies,
// so the same bytes aren't committed twice and the browser caches one file.
// Wherever it lives, every file must exist at its stated pixel size (a dark
// twin at its light twin's).
const OWN_DIR = "/assets/portfolio/";
const SHARED_DIRS = ["/assets/portfolio/", "/assets/home/", "/assets/projects/"];
const darkName = src => src.replace(/(\.[a-z0-9]+)$/i, "-dark$1");

function assertFile(src, size, dirs, label) {
  assert.ok(typeof src === "string" && dirs.some(d => src.startsWith(d)), `${label}: ${src} is not under ${dirs.join(", ")}`);
  assert.ok(!src.includes(".."), `${label}: ${src}`);
  const file = join(ROOT, src);
  assert.ok(existsSync(file), `${label}: ${src} is missing`);
  assert.deepEqual(imageSize(file), size, `${label}: ${src} is ${imageSize(file).join("x")}, the data says ${size.join("x")}`);
}

test("every screenshot is a real file at its stated pixel size, with alt text", () => {
  for (const w of work.filter(w => w.image)) {
    assertFile(w.image, [w.imageWidth, w.imageHeight], [OWN_DIR], `${w.id}: image`);
    assert.ok(set(w.imageAlt), `${w.id}: imageAlt`);
    const m = w.imageMobile;
    if (m) assertFile(m.src, [m.width, m.height], SHARED_DIRS, `${w.id}: imageMobile.src`);
    const d = w.imageDark;
    if (d) {
      // A dark twin is the light file's name plus -dark, at the light file's
      // size; check:layout pairs the files by that name.
      assertFile(d.src, [w.imageWidth, w.imageHeight], SHARED_DIRS, `${w.id}: imageDark.src`);
      assert.equal(d.src, darkName(w.image), `${w.id}: imageDark.src is image's name plus -dark`);
      assert.equal(set(d.mobile), Boolean(m), `${w.id}: imageDark.mobile exactly when there is an imageMobile`);
      if (m) {
        assertFile(d.mobile, [m.width, m.height], SHARED_DIRS, `${w.id}: imageDark.mobile`);
        assert.equal(d.mobile, darkName(m.src), `${w.id}: imageDark.mobile is imageMobile's name plus -dark`);
      }
    }
  }
  for (const w of work) {
    assert.ok(!w.imageDark || w.image, `${w.id}: imageDark without an image`);
    assert.ok(!w.imageMobile || w.image, `${w.id}: imageMobile without an image`);
    for (const [i, g] of (w.gallery || []).entries()) {
      const label = `${w.id}: gallery[${i}]`;
      assertFile(g.src, [g.width, g.height], SHARED_DIRS, `${label}.src`);
      assert.ok(g.mobile, `${label}: its phone layout (mobile)`);
      assertFile(g.mobile.src, [g.mobile.width, g.mobile.height], SHARED_DIRS, `${label}.mobile.src`);
      assert.ok(set(g.alt), `${label}: alt`);
      assert.ok(Array.isArray(g.caption) && g.caption.length === 2 && g.caption.every(set), `${label}: caption is [title, text]`);
    }
  }
  // At 390px a 1440px screenshot is a quarter size and unreadable.
  assert.ok(findWork("discover-cleaner").imageMobile, "discover-cleaner has its phone crop");
});

test("chiptune: the mid-playback capture in both themes; its phone crop is the home row's file", () => {
  const c = findWork("chiptune");
  assert.equal(c.image, "/assets/portfolio/chiptune-playing-wide.webp");
  assert.deepEqual([c.imageWidth, c.imageHeight], [1440, 810]);
  assert.equal(c.imageAlt, CHIPTUNE_ALT);
  assert.deepEqual(c.imageMobile, { src: "/assets/home/chiptune-playing-phone.webp", width: 358, height: 360 });
  assert.deepEqual(c.imageDark, { src: "/assets/portfolio/chiptune-playing-wide-dark.webp", mobile: "/assets/home/chiptune-playing-phone-dark.webp" });
  // Only captures of the site's own light interface get a dark twin;
  // Discover Cleaner is a dark interface already.
  assert.deepEqual(work.filter(w => w.imageDark).map(w => w.id), ["chiptune"]);
  // No capture with a real controller yet, so no picture of the tester.
  const drift = findWork("drift-tester");
  for (const k of ["image", "imageMobile", "imageDark", "gallery"]) assert.ok(!(k in drift), `drift-tester: ${k}`);
});

test("discover-cleaner's gallery is /projects/discover-cleaner's three views, alts and captions word for word", () => {
  const html = read("projects/discover-cleaner.html");
  const more = html.slice(html.indexOf('<div class="dc-more">'));
  const page = [...more.matchAll(/<figure>\s*<picture>\s*<source media="\(min-width: 60em\)" srcset="([^"]+)" width="(\d+)" height="(\d+)" \/>\s*<img src="([^"]+)" width="(\d+)" height="(\d+)" loading="lazy"\s+alt="([^"]*)" \/>\s*<\/picture>\s*<figcaption><strong>([^<]+)<\/strong> ([^<]+)<\/figcaption>/g)]
    .map(m => ({ src: m[1], width: +m[2], height: +m[3], mobile: { src: m[4], width: +m[5], height: +m[6] }, alt: m[7], caption: [m[8], m[9]] }));
  assert.equal(page.length, 3, "projects/discover-cleaner.html has its three further views");
  assert.deepEqual(findWork("discover-cleaner").gallery, page);
  assert.deepEqual(work.filter(w => w.gallery).map(w => w.id), ["discover-cleaner"], "no other case has a gallery");
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

// The theme head of dark-spec §4.1 where the single #ffffff theme-color and
// site.css?v=2 used to be, then portfolio.css and the entry at ?v=3 (§2.3).
function assertThemeHead(html, f, entry) {
  const head = html.slice(0, html.indexOf("</head>"));
  assert.ok(head.includes(`\n  ${THEME_HEAD}\n  <link rel="stylesheet" href="/assets/portfolio.css?v=3" />\n`),
    `${f}: the theme head of dark-spec §4.1, then portfolio.css?v=3`);
  assert.ok(head.includes(`<script type="module" src="/assets/entry/${entry}.js?v=3"></script>`), `${f}: entry/${entry}.js?v=3`);
  assert.equal((head.match(/<meta name="theme-color"/g) || []).length, 2, `${f}: two theme-color metas`);
  assert.equal((head.match(/<meta name="color-scheme"/g) || []).length, 1, `${f}: one color-scheme meta`);
  assert.equal((head.match(/<script\b/g) || []).length, 2, `${f}: theme.js and the entry module, nothing else`);
  assert.ok(head.indexOf("/assets/theme.js") < head.indexOf('rel="stylesheet"'), `${f}: theme.js before the first stylesheet`);
  assert.ok(!/\?v=2\b/.test(html), `${f}: nothing left at ?v=2`);
}

test("portfolio.html: head per the spec, the list holder, a noscript, and none of the old furniture", () => {
  assert.ok(PORTFOLIO.includes("<title>Product case studies | dhole.dev</title>"));
  assert.equal(metaContent(PORTFOLIO, "description"), "Case studies of products built on my own time by a senior product manager directing AI coding agents, and how each was checked.");
  assert.equal(metaContent(PORTFOLIO, "og:image"), "https://dhole.dev/assets/brand/og-portfolio.png");
  assert.equal(metaContent(PORTFOLIO, "og:image:width"), "1200");
  assert.equal(metaContent(PORTFOLIO, "og:image:height"), "630");
  assert.equal(metaContent(PORTFOLIO, "twitter:image"), "https://dhole.dev/assets/brand/og-portfolio.png");
  assert.match(PORTFOLIO, /<link rel="canonical" href="https:\/\/dhole\.dev\/portfolio" \/>/);
  assertThemeHead(PORTFOLIO, "portfolio.html", "portfolio");
  assert.ok(PORTFOLIO.includes('<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />'));
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
  assertThemeHead(CASE, "case.html", "case");
  // functions/case.js replaces everything between the markers, so a theme
  // head inside them would vanish from every served case page.
  assert.ok(CASE.indexOf(THEME_HEAD) > CASE.indexOf("<!-- seo:end -->"), "the theme head comes after <!-- seo:end -->");
  assert.ok(!seoBlock.includes("theme-color") && !seoBlock.includes("theme.js") && !seoBlock.includes("color-scheme"), "nothing of the theme head inside the seo block");
  assert.ok(!CASE.includes("eyebrow") && !CASE.includes("pages.css") && !CASE.includes("og.png"));
});

test("both entries mount the chrome with the 'portfolio' key and import the renderer versioned", () => {
  for (const f of ["assets/entry/portfolio.js", "assets/entry/case.js"]) {
    const src = read(f);
    assert.match(src, /mountChrome\("portfolio"\)/, f);
    // A copy of the old renderer cached under /assets/* would render into
    // markup it no longer matches.
    assert.match(src, /from "\.\.\/portfolio-page\.js\?v=3"/, `${f}: import portfolio-page.js?v=3`);
    assert.equal((src.match(/\?v=\d/g) || []).length, 1, `${f}: only the renderer's import is versioned`);
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
  assert.equal(count(list, "<img "), work.filter(w => w.image).length + work.filter(w => w.imageDark).length,
    "one image per real screenshot, two for a theme pair");
  assert.ok(!list.includes("case-gallery") && !list.includes("More views"), "galleries are for the case page only");
  assert.ok(list.includes('<picture><source media="(min-width: 60em)" srcset="/assets/portfolio/discover-cleaner.webp" width="1440" height="900">'), "the screenshot from 60em");
  assert.match(list, /<img src="\/assets\/portfolio\/discover-cleaner-phone\.webp" alt="Discover Cleaner&#39;s Now page[^"]*" width="374" height="491" loading="lazy"/);
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
  assert.deepEqual(heads, ["The problem", "What shipped", "More views", "Decisions", "Outcome", ...(contactSet ? ["Talk to me about this"] : [])]);
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

// dark-spec §7, §9.5: an entry with imageDark renders a theme pair in the
// one figure, the light <picture> then the dark one, each the same structure
// as the single picture (the laptop view from 60em, the phone crop as the
// <img>), the same sizes and alt on both, and both lazy even on the case
// page, where a single screenshot is eager.
const pairPic = (cls, wide, phone, alt) => `<picture class="${cls}">` +
  `<source media="(min-width: 60em)" srcset="${wide}" width="1440" height="810">` +
  `<img src="${phone}" alt="${alt}" width="358" height="360" loading="lazy" decoding="async"></picture>`;
const CHIPTUNE_PAIR = (cls) => `<figure class="${cls}">` +
  pairPic("for-light", "/assets/portfolio/chiptune-playing-wide.webp", "/assets/home/chiptune-playing-phone.webp", CHIPTUNE_ALT) +
  pairPic("for-dark", "/assets/portfolio/chiptune-playing-wide-dark.webp", "/assets/home/chiptune-playing-phone-dark.webp", CHIPTUNE_ALT) +
  "</figure>";

test("chiptune: the theme pair on /portfolio and on its case page, both lazy, light first, one alt", async () => {
  const { list } = await renderWith("/portfolio");
  assert.ok(list.includes(CHIPTUNE_PAIR("pf-media")), "the /portfolio row's pair");
  const row = list.slice(list.indexOf('<article class="pf-row pf-row--media">\n      <h2 class="pf-title"><a href="/case?id=chiptune">'));
  assert.ok(row.startsWith("<article"), "the chiptune row has the media class (full width)");
  const { main } = await renderWith("/case?id=chiptune");
  assert.ok(main.includes(CHIPTUNE_PAIR("case-shot")), "the case page leads with the pair, lazy");
  // A capture of a tool on this site opens it, as on home and /projects:
  // its pictured Stop, Randomise and sliders would otherwise sit beside the
  // real "Open the sequencer" button doing nothing.
  assert.ok(main.includes(`<a class="case-shot-link" href="/projects/chiptune" tabindex="-1">${CHIPTUNE_PAIR("case-shot")}</a>`),
    "the case page's capture is a link to the sequencer, out of the tab order");
  assert.ok(main.indexOf('class="case-shot"') < main.indexOf("<h2>The problem</h2>"), "the screenshot leads the story");
  assert.ok(!/prefers-color-scheme/.test(list + main), "never a colour-scheme <source>");
  assert.ok(!main.includes("More views"), "chiptune has no gallery");
  // Discover Cleaner (a dark interface) keeps its single picture, eager on
  // its case page as the first capture.
  const dc = (await renderWith("/case?id=discover-cleaner")).main;
  assert.ok(!/for-light|for-dark/.test(dc), "no pair without imageDark");
  assert.match(dc, /<a class="case-shot-link" href="\/projects\/discover-cleaner-demo\/" tabindex="-1"><figure class="case-shot"><picture><source media="\(min-width: 60em\)" srcset="\/assets\/portfolio\/discover-cleaner\.webp" width="1440" height="900"><img src="\/assets\/portfolio\/discover-cleaner-phone\.webp" alt="[^"]+" width="374" height="491" decoding="async"><\/picture><\/figure><\/a>/);
});

test("discover-cleaner: 'More views' right after What shipped, three framed figures in order, lazy, captions as on its tool page", async () => {
  const { main } = await renderWith("/case?id=discover-cleaner");
  const at = main.indexOf("<h2>More views</h2>");
  assert.ok(at > main.indexOf("<h2>What shipped</h2>") && at < main.indexOf("<h2>Decisions</h2>"), "after What shipped, before Decisions");
  const sec = main.slice(main.lastIndexOf("<section>", at), main.indexOf("</section>", at));
  assert.ok(sec.startsWith('<section><h2>More views</h2><div class="case-gallery"><figure><picture>'), sec.slice(0, 120));
  const figs = [...sec.matchAll(/<figure><picture><source media="\(min-width: 60em\)" srcset="([^"]+)" width="1440" height="900"><img src="([^"]+)" alt="([^"]*)" width="748" height="(\d+)" loading="lazy" decoding="async"><\/picture><figcaption>(.*?)<\/figcaption><\/figure>/g)];
  assert.equal(count(sec, "<figure>"), 3);
  assert.deepEqual(figs.map(m => m[1].replace(/^.*\//, "")), ["insights-report.webp", "artist.webp", "library-backlog.webp"]);
  assert.deepEqual(figs.map(m => m[2].replace(/^.*\//, "")), ["insights-report-phone.webp", "artist-phone.webp", "library-backlog-phone.webp"]);
  assert.equal(count(sec, "<img "), count(sec, 'loading="lazy"'), "every image is lazy");
  // Character for character, the alts and captions /projects/discover-cleaner shows.
  const html = read("projects/discover-cleaner.html");
  const more = html.slice(html.indexOf('<div class="dc-more">'));
  const pageCaptions = [...more.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map(m => m[1]);
  const pageAlts = [...more.matchAll(/\balt="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(figs.map(m => decode(m[5])), pageCaptions);
  assert.deepEqual(figs.map(m => decode(m[3])), pageAlts);
});

test("no other case study gets a gallery, and none renders an empty one", async () => {
  for (const w of work.filter(w => w.id !== "discover-cleaner")) {
    const { main } = await renderWith(`/case?id=${w.id}`);
    assert.ok(!main.includes("More views") && !main.includes("case-gallery"), `${w.id}: no gallery`);
  }
});

// Stand-in entries, pushed onto the real list for one render and removed:
// the renderer reads data/portfolio.js's own `work` array.
async function renderStub(stub) {
  work.push(stub);
  try {
    return (await renderWith(`/case?id=${stub.id}`)).main;
  } finally {
    work.splice(work.indexOf(stub), 1);
  }
}
const STUB = {
  id: "zz-stub", title: "Stub", pitch: "A stub.", shipped: ["One thing."],
  image: "/assets/portfolio/stub.webp", imageWidth: 1440, imageHeight: 810, imageAlt: "A stub & its \"alt\""
};

test("the case capture links only to an on-site primary link: off-site, protocol-relative or no link is a plain figure", async () => {
  const fig = '<figure class="case-shot"><img src="/assets/portfolio/stub.webp"';
  for (const links of [undefined, [], [{ label: "Elsewhere", href: "https://example.com/", primary: true }],
    [{ label: "Sneaky", href: "//example.com/", primary: true }], [{ label: "Not primary", href: "/projects/stub" }]]) {
    const main = await renderStub({ ...STUB, links });
    assert.ok(main.includes(fig) && !main.includes("case-shot-link"), `links ${JSON.stringify(links)}: a plain figure`);
  }
  const onsite = await renderStub({ ...STUB, links: [{ label: "Open it", href: "/projects/stub?x=\"1\"", primary: true }] });
  assert.ok(onsite.includes(`<a class="case-shot-link" href="/projects/stub?x=&quot;1&quot;" tabindex="-1">${fig}`), "on-site: a link, href escaped");
  const noShot = await renderStub({ ...STUB, image: "", links: [{ label: "Open it", href: "/projects/stub", primary: true }] });
  assert.ok(!noShot.includes("case-shot"), "no screenshot: no link either");
  // The link is capped like the capture below 60em, so the blank page beside
  // a phone crop on a tablet isn't clickable.
  const pcss = read("assets/portfolio.css");
  assert.match(pcss, /\.case-shot:has\(picture\),\s*\.case-shot-link:has\(picture\) \{ max-width: calc\(23\.375rem \+ 2 \* var\(--s-3\)\); \}/);
  assert.match(pcss, /@media \(min-width: 60em\) \{\s*\.pf-media picture img,[^@]*?\.case-shot-link:has\(picture\) \{ max-width: none; \}\s*\}/);
});

test("a pair without a phone crop is two single-image pictures; half a pair is the light screenshot alone", async () => {
  const alt = "A stub &amp; its &quot;alt&quot;";
  const wide = cls => `<picture class="${cls}"><img src="/assets/portfolio/stub${cls === "for-dark" ? "-dark" : ""}.webp" alt="${alt}" width="1440" height="810" loading="lazy" decoding="async"></picture>`;
  const noPhone = await renderStub({ ...STUB, imageDark: { src: "/assets/portfolio/stub-dark.webp" } });
  assert.ok(noPhone.includes(`<figure class="case-shot">${wide("for-light")}${wide("for-dark")}</figure>`), noPhone.slice(0, 600));
  const half = await renderStub({
    ...STUB, imageMobile: { src: "/assets/portfolio/stub-phone.webp", width: 358, height: 360 },
    imageDark: { src: "/assets/portfolio/stub-dark.webp" }
  });
  assert.ok(!/for-light|for-dark|stub-dark/.test(half), "no dark phone crop: no pair");
  assert.ok(half.includes('<img src="/assets/portfolio/stub-phone.webp"'), "the light screenshot as before");
});

test("the gallery escapes its data, skips items without a real size, and renders nothing when none is left", async () => {
  const hostile = await renderStub({ ...STUB, gallery: [
    { src: "/assets/portfolio/a\"b.webp", width: 1440, height: 900,
      mobile: { src: "/assets/portfolio/<a>.webp", width: 748, height: 600 },
      alt: "<img onerror=x>", caption: ["<b>Title</b>", "Text & \"more\""] },
    { src: "/assets/portfolio/nosize.webp", alt: "no size", caption: ["No size.", "Skipped."] }
  ] });
  assert.ok(!hostile.includes("<b>Title") && !hostile.includes("<img onerror") && !hostile.includes('a"b'), "escaped");
  assert.ok(hostile.includes("<figcaption><strong>&lt;b&gt;Title&lt;/b&gt;</strong> Text &amp; &quot;more&quot;</figcaption>"));
  assert.equal(count(hostile, "<figure>"), 1, "the item without a size is skipped");
  assert.ok(!hostile.includes("nosize"));
  const none = await renderStub({ ...STUB, gallery: [{ src: "/assets/portfolio/x.webp", alt: "x" }] });
  assert.ok(!none.includes("More views") && !none.includes("case-gallery"), "nothing renderable: no section");
  const empty = await renderStub({ ...STUB, gallery: [] });
  assert.ok(!empty.includes("More views"), "an empty gallery: no section");
});

// ---------- assets/portfolio.css ----------

section("assets/portfolio.css: the frame, the two-up rows, the gallery");

const CSS = read("assets/portfolio.css");
const squashCss = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
const FLAT = squashCss(CSS);
// Split the sheet into what sits inside @media (min-width: 60em) blocks
// (WIDE) and everything else (NARROW), matching braces.
const [WIDE, NARROW] = (() => {
  const wide = [];
  let rest = "";
  let i = 0;
  const at = "@media (min-width: 60em) {";
  while (i < FLAT.length) {
    const start = FLAT.indexOf(at, i);
    if (start < 0) { rest += FLAT.slice(i); break; }
    rest += FLAT.slice(i, start);
    let depth = 1;
    let j = start + at.length;
    for (; j < FLAT.length && depth; j++) depth += FLAT[j] === "{" ? 1 : FLAT[j] === "}" ? -1 : 0;
    wide.push(FLAT.slice(start + at.length, j - 1).trim());
    i = j;
  }
  return [wide.join(" "), rest];
})();

test("from 60em, text-only rows sit two to a line in data order; a row with a screenshot and the earlier group span the line", () => {
  assert.ok(WIDE.includes(".pf-list, .pf-group { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--col-gap); }"), "the two-up grid");
  assert.ok(WIDE.includes(".pf-list > .pf-row--media, .pf-group > .pf-row--media, .pf-list > .pf-earlier { grid-column: 1 / -1; }"), ".pf-row--media spans 1 / -1");
  assert.ok(!/grid-auto-flow:\s*dense|(^|[;{\s])order:/.test(FLAT), "no dense packing and no CSS order: the DOM order is the reading order");
  // Below 60em the list stays one column.
  assert.ok(WIDE.length > 0 && !NARROW.includes("repeat(2,"), "two columns only from 60em");
});

test("screenshots and gallery views sit on a 12 px --panel frame; --sweep is for unit photos", () => {
  assert.ok(FLAT.includes(".pf-media, .case-shot { padding: var(--s-3); background: var(--panel); }"), "the frame");
  assert.match(FLAT, /\.pf-media img, \.case-shot img \{[^}]*background: var\(--panel\);/, "the img background");
  assert.match(FLAT, /\.case-gallery \{ display: grid; gap: var\(--s-6\); \}/);
  assert.match(FLAT, /\.case-gallery picture \{[^}]*padding: var\(--s-3\); background: var\(--panel\); \}/);
  assert.match(FLAT, /\.case-gallery img \{ width: 100%; height: auto; max-width: 23\.375rem; \}/);
  assert.match(FLAT, /\.case-gallery figcaption \{ margin-top: var\(--s-3\); max-width: var\(--measure\); \}/);
  assert.ok(/\.case-gallery img, \.case-gallery picture \{ max-width: none; \}/.test(WIDE), "from 60em the laptop view fills");
  // ...and its section isn't held to --measure (36rem), which stopped the
  // three 1440x900 views at 552 px, narrower than the capture above them.
  assert.ok(WIDE.includes(".case-body > section:has(> .case-gallery) { max-width: none; }"), "from 60em the gallery's section is let out of the measure");
  assert.ok(!NARROW.includes(":has(> .case-gallery)"), "only from 60em");
  assert.ok(!/--sweep/.test(CSS), "no --sweep in portfolio.css");
  // A rule that set display on a picture would beat site.css's .for-dark.
  assert.ok(!/picture[^{]*\{[^}]*display:/.test(FLAT), "no display on pictures here (site.css's pair rules decide)");
});

// &#39; and friends, as esc() writes them.
function decode(t) {
  return t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

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

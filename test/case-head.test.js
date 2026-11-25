// /case?id= end to end: the real case.html, served through
// functions/case.js the way Pages runs it (context.next() hands the Function
// the static file). test/seo.test.js covers the Function against a stand-in
// shell; this file checks that the two real halves fit: case.html's seo
// markers, and the head lib/seo.js writes between them.
//
//   a known id     200, the case study's own head in place of the fallback
//                  block, and everything else in the file (the rest of the
//                  head, and the body after </head>) byte for byte as shipped
//   an old id      200, the canonical names the current id
//   unknown or no  404, noindex, the same body
//
// The theme head (dark-spec §4.1: the color-scheme meta, the two theme-color
// metas and theme.js before the first stylesheet) sits outside the seo
// block, so every served case page keeps it exactly once (§11.3 item 2).
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { onRequest } from "../functions/case.js";
import { work, findWork } from "../data/portfolio.js";
import { PAGE_HEADERS, SEO_END, SEO_START, caseHead, caseNotFoundHead, injectHead } from "../lib/seo.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { section, test, run } = harness();

const SITE = "https://dhole.dev";
const SHELL_BYTES = readFileSync(join(ROOT, "case.html"));
const SHELL = SHELL_BYTES.toString("utf8");
const BLOCK_START = SHELL.indexOf(SEO_START);
const BLOCK_END = SHELL.indexOf(SEO_END) + SEO_END.length;
// What surrounds the block the Function may replace.
const BEFORE_BLOCK = SHELL.slice(0, BLOCK_START);
const AFTER_BLOCK = SHELL.slice(BLOCK_END);
const HEAD_CLOSE = Buffer.from("</head>");
const THEME_HEAD = [
  '<meta name="color-scheme" content="light dark" />',
  '<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />',
  '<meta name="theme-color" content="#ffffff" />',
  '<script src="/assets/theme.js?v=3"></script>',
  '<link rel="stylesheet" href="/assets/site.css?v=3" />'
].join("\n  ");
const shellBody = SHELL_BYTES.subarray(SHELL_BYTES.indexOf(HEAD_CLOSE));

// Runs functions/case.js the way Pages does: next() serves case.html as a
// static asset would.
async function serve(path, { method = "GET", host = "dhole.dev", env = { SITE_URL: SITE } } = {}) {
  const request = new Request(`https://${host}${path}`, { method });
  const next = async () => new Response(method === "HEAD" ? null : SHELL_BYTES, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"case-html"', "Cache-Control": "public, max-age=600" }
  });
  const res = await onRequest({ request, env, params: {}, data: {}, waitUntil() {}, next });
  const bytes = Buffer.from(await res.arrayBuffer());
  const html = bytes.toString("utf8");
  const at = bytes.indexOf(HEAD_CLOSE);
  return { res, status: res.status, bytes, html, head: html.slice(0, html.indexOf("</head>")), body: at < 0 ? null : bytes.subarray(at) };
}

const decode = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const all = (html, re) => [...html.matchAll(re)];
const titlesOf = head => all(head, /<title>([^<]*)<\/title>/g).map(m => decode(m[1]));
const canonicalsOf = head => all(head, /<link rel="canonical" href="([^"]*)"/g).map(m => decode(m[1]));
const metaOf = (head, key) => {
  const m = new RegExp(`<meta (?:name|property)="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)"`).exec(head);
  return m ? decode(m[1]) : null;
};

// The theme head, once, outside the seo block, with theme.js before the
// first stylesheet: what a served page must keep whatever head it got.
function assertThemeHead(html, label) {
  const count = (s, sub) => s.split(sub).length - 1;
  assert.equal(count(html, THEME_HEAD), 1, `${label}: the theme head of dark-spec §4.1, exactly once`);
  assert.equal(count(html, "/assets/theme.js"), 1, `${label}: theme.js once`);
  assert.equal(count(html, '<meta name="color-scheme"'), 1, `${label}: one color-scheme meta`);
  assert.equal(count(html, '<meta name="theme-color"'), 2, `${label}: two theme-color metas`);
  const t = html.indexOf("/assets/theme.js");
  assert.ok(t > 0 && t < html.indexOf('rel="stylesheet"'), `${label}: theme.js before the first stylesheet`);
  assert.ok(html.indexOf(THEME_HEAD) > html.indexOf("</title>"), `${label}: after the written head`);
}

// Byte for byte: the shell with only its seo block swapped for `tags`.
function assertOnlyBlockReplaced(r, tags, label) {
  assert.ok(r.body, `${label}: no </head> in the response`);
  assert.ok(r.body.equals(shellBody), `${label}: the body after </head> differs from case.html's`);
  assert.equal(r.html, BEFORE_BLOCK + tags + AFTER_BLOCK, `${label}: something other than the seo block changed`);
}

section("case.html, as the Function receives it");

test("case.html has one seo block, no canonical of its own, and an empty #case-main for the page to fill", () => {
  assert.ok(BLOCK_START > 0, "case.html has no <!-- seo:start");
  assert.equal(SHELL.indexOf(SEO_START, BLOCK_START + 1), -1, "two seo:start markers");
  assert.ok(BLOCK_END > BLOCK_START, "case.html has no <!-- seo:end --> after seo:start");
  assert.equal(SHELL.indexOf(SEO_END, BLOCK_END), -1, "two seo:end markers");
  assert.ok(BLOCK_END < SHELL.indexOf("</head>"), "the seo block is inside <head>");
  assert.deepEqual(canonicalsOf(SHELL), [], "case.html must never carry a canonical: every case study would claim to be that one page");
  assert.match(SHELL, /<article id="case-main"[^>]*><\/article>/);
});

test("case.html's theme head comes after <!-- seo:end -->, where the Function never writes", () => {
  assertThemeHead(SHELL, "case.html");
  assert.ok(SHELL.indexOf(THEME_HEAD) > BLOCK_END, "the theme head is after the seo block");
  const block = SHELL.slice(BLOCK_START, BLOCK_END);
  for (const part of ["color-scheme", "theme-color", "theme.js"]) assert.ok(!block.includes(part), `${part} inside the seo block`);
});

test("the theme head survives the server-written heads: caseHead for every entry and caseNotFoundHead", () => {
  for (const w of work) assertThemeHead(injectHead(SHELL, caseHead(w, { site: SITE })), `caseHead(${w.id})`);
  assertThemeHead(injectHead(SHELL, caseNotFoundHead()), "caseNotFoundHead()");
});

section("a known id");

test("/case?id=discover-cleaner: 200 with its own head, and the body after </head> byte-identical to case.html", async () => {
  const w = findWork("discover-cleaner");
  assert.ok(w, "data/portfolio.js has discover-cleaner");
  const r = await serve("/case?id=discover-cleaner");
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get("Content-Type") || "", /^text\/html/);
  assertOnlyBlockReplaced(r, caseHead(w, { site: SITE }), "discover-cleaner");

  assert.deepEqual(titlesOf(r.head), [`${w.title}: case study | dhole.dev`], "one title, the case study's");
  assert.deepEqual(canonicalsOf(r.head), [`${SITE}/case?id=discover-cleaner`], "one canonical, its own");
  assert.equal(metaOf(r.head, "og:url"), `${SITE}/case?id=discover-cleaner`);
  assert.equal(metaOf(r.head, "og:type"), "article");
  assert.equal(metaOf(r.head, "og:title"), `${w.title}: case study`);
  assert.equal(metaOf(r.head, "twitter:title"), `${w.title}: case study`);
  assert.equal(metaOf(r.head, "og:image"), `${SITE}/assets/brand/og-portfolio.png`);
  assert.equal(metaOf(r.head, "robots"), null, "a known case study is indexable");
  assert.ok(!r.head.includes("Case study | dhole.dev"), "the fallback title is gone");
  // The rest of the head is still the shipped one: icon, fonts, styles, entry.
  for (const line of ['<link rel="icon" href="/assets/brand/icon.svg"', THEME_HEAD,
    '<link rel="stylesheet" href="/assets/portfolio.css?v=3" />', '<script type="module" src="/assets/entry/case.js?v=3"></script>']) {
    assert.ok(r.head.includes(line), `the head lost: ${line}`);
  }
  assertThemeHead(r.html, "served /case?id=discover-cleaner");
});

test("every case study in data/portfolio.js: 200, its own title and canonical, the body untouched", async () => {
  assert.ok(work.length > 0);
  for (const w of work) {
    const r = await serve(`/case?id=${encodeURIComponent(w.id)}`);
    assert.equal(r.status, 200, w.id);
    assertOnlyBlockReplaced(r, caseHead(w, { site: SITE }), w.id);
    assert.deepEqual(titlesOf(r.head), [`${w.title.replace(/\s+/g, " ").trim()}: case study | dhole.dev`], w.id);
    assert.deepEqual(canonicalsOf(r.head), [`${SITE}/case?id=${encodeURIComponent(w.id)}`], w.id);
    assertThemeHead(r.html, `served ${w.id}`);
  }
});

test("an old id (an alias) gets 200 and a canonical naming the current id", async () => {
  const aliased = work.filter(w => (w.aliases || []).length);
  assert.ok(aliased.length, "data/portfolio.js has at least one alias (spotify-discover-cleaner)");
  for (const w of aliased) {
    for (const alias of w.aliases) {
      const r = await serve(`/case?id=${encodeURIComponent(alias)}`);
      assert.equal(r.status, 200, alias);
      assertOnlyBlockReplaced(r, caseHead(w, { site: SITE }), alias);
      assert.deepEqual(canonicalsOf(r.head), [`${SITE}/case?id=${encodeURIComponent(w.id)}`], alias);
    }
  }
});

test("the served page has no executable inline script (the CSP would block it)", async () => {
  const r = await serve("/case?id=discover-cleaner");
  for (const m of r.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    assert.ok(/\ssrc="/.test(attrs) || /type="application\/ld\+json"/.test(attrs), `an inline script: <script${attrs}>`);
  }
  assert.equal(r.res.headers.get("Content-Security-Policy"), PAGE_HEADERS["Content-Security-Policy"]);
});

section("an unknown id");

test("/case?id=nope: 404, noindex, the not-found head, and the same body", async () => {
  const r = await serve("/case?id=nope");
  assert.equal(r.status, 404);
  assertOnlyBlockReplaced(r, caseNotFoundHead(), "nope");
  assert.deepEqual(titlesOf(r.head), ["Case study not found | dhole.dev"]);
  assert.equal(metaOf(r.head, "robots"), "noindex");
  assert.deepEqual(canonicalsOf(r.head), [], "no canonical for a page that isn't there");
  assertThemeHead(r.html, "served /case?id=nope");
});

test("no id, an empty id and a hostile id are all 404 with the body untouched", async () => {
  for (const path of ["/case", "/case?id=", `/case?id=${encodeURIComponent('"><script>x</script>')}`]) {
    const r = await serve(path);
    assert.equal(r.status, 404, path);
    assertOnlyBlockReplaced(r, caseNotFoundHead(), path);
    assert.ok(!r.html.includes("<script>x</script>"), `${path}: the id is never echoed`);
  }
});

await run();

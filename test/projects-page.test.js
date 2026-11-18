// Checks on the Projects page: data/portfolio.js is the site's one project
// list (portfolio.html, the case studies and the homepage all read it), and
// the page is served at /portfolio but called Projects.
//
// These catch what used to go wrong silently: an app under projects/ that
// nothing on the site links to (league-ify was live for a day with no way in),
// a link to a page that isn't there, and an old /projects URL that 404s.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { work } from "../data/portfolio.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message.split("\n").join("\n      ")}`);
    process.exitCode = 1;
  }
}

// Every href in the project list, and the on-site ones.
const links = work.flatMap(w => w.links.map(l => ({ id: w.id, ...l })));
const onSite = links.filter(l => l.href.startsWith("/"));

// "/projects/x.html" -> projects/x.html, "/projects/app/" -> projects/app/index.html
function fileFor(href) {
  const path = href.split(/[?#]/)[0].replace(/^\//, "");
  return join(ROOT, path.endsWith("/") ? `${path}index.html` : path);
}

console.log("\nProjects page\n");

test("every page under projects/ is linked from data/portfolio.js", () => {
  const dir = join(ROOT, "projects");
  const pages = readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return existsSync(join(full, "index.html")) ? [`/projects/${name}/`] : [];
    }
    return name.endsWith(".html") ? [`/projects/${name}`] : [];
  });
  assert.ok(pages.length > 0, "found no pages under projects/");
  const linked = new Set(onSite.map(l => l.href));
  const orphans = pages.filter(p => !linked.has(p));
  assert.deepEqual(orphans, [], "nothing on the Projects page leads to these; add a link in data/portfolio.js");
});

test("every on-site link in data/portfolio.js points at a file that exists", () => {
  const missing = onSite.filter(l => !existsSync(fileFor(l.href))).map(l => `${l.id}: ${l.href}`);
  assert.deepEqual(missing, []);
});

test("each project has at most one primary link", () => {
  const many = work.filter(w => w.links.filter(l => l.primary).length > 1).map(w => w.id);
  assert.deepEqual(many, []);
});

test("the homepage's featured projects each open a page on this site", () => {
  const featured = work.filter(w => w.featured);
  assert.ok(featured.length >= 1, "no project has featured: true, so the homepage section is empty");
  for (const w of featured) {
    const primary = w.links.find(l => l.primary);
    assert.ok(primary && primary.href.startsWith("/"), `${w.id} is featured but has no on-site primary link`);
  }
});

test("the old Projects URLs redirect to /portfolio, and /portfolio redirects nowhere", () => {
  const rules = readFileSync(join(ROOT, "_redirects"), "utf8")
    .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => l.split(/\s+/));
  const target = from => (rules.find(r => r[0] === from) || [])[1];
  for (const from of ["/projects", "/projects/", "/projects.html"]) {
    assert.equal(target(from), "/portfolio", `${from} should redirect to /portfolio`);
  }
  // Cloudflare already serves portfolio.html at /portfolio and 308s
  // /portfolio.html there; a rule on either would loop (see CLAUDE.md).
  for (const from of ["/portfolio", "/portfolio.html"]) {
    assert.equal(target(from), undefined, `${from} must not be redirected`);
  }
  assert.ok(!existsSync(join(ROOT, "projects.html")), "projects.html is back; the redirects above would never fire");
});

test("no page or script links to the old /projects.html", () => {
  const files = [
    ...readdirSync(ROOT).filter(f => f.endsWith(".html")),
    ...readdirSync(join(ROOT, "projects")).filter(f => /\.(html|js)$/.test(f)).map(f => `projects/${f}`),
    ...readdirSync(join(ROOT, "assets")).filter(f => f.endsWith(".js")).map(f => `assets/${f}`),
    ...readdirSync(join(ROOT, "assets", "entry")).map(f => `assets/entry/${f}`),
    ...readdirSync(join(ROOT, "data")).map(f => `data/${f}`),
  ];
  const stale = files.filter(f => /["'(]\/projects(\.html)?["'#?)]/.test(readFileSync(join(ROOT, f), "utf8")));
  assert.deepEqual(stale, [], "link to /portfolio.html instead");
});

console.log(`\n${passed} passed\n`);

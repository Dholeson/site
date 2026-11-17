// Checks on the vendored league-ify app: the SPA (projects/league-ify/), its API
// Function (functions/api/league-ify/[[path]].js), the config they need, and
// the CSP exception that lets it show Data Dragon art.
//
// league-ify is built in its own repo (Dholeson/league-ify) and copied in with
// `node scripts/build-site.mjs <path-to-this-site>` from there. Like the
// Discover Cleaner checks, everything here would otherwise fail silently in
// production: a CSP block, a missing asset, a Function that can't bind D1.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPA = join(ROOT, "projects", "league-ify");
const FN = join(ROOT, "functions", "api", "league-ify", "[[path]].js");
const MIGRATION = join(ROOT, "migrations", "0001_league_ify.sql");
const RULE = "/projects/league-ify/*";
const DDRAGON = "https://ddragon.leagueoflegends.com";   // Riot's static art CDN
const EXTRA = { "img-src": [DDRAGON], "connect-src": [DDRAGON] };

// Pages Functions are bundled into one Worker; stay well inside the smallest
// (free-plan) size limit.
const FN_BUDGET = 3 * 1024 * 1024;
const CF_MAX_FILE = 25 * 1024 * 1024;

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

const read = p => readFileSync(p, "utf8");
const rel = p => relative(ROOT, p).split(sep).join("/");

// ---------- _headers ----------

// Same parser as test/discover-cleaner-demo.test.js: a URL pattern at column 0,
// then indented "Name: value" lines, or "! Name" to detach an earlier header.
function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { rules.push({ pattern: raw.trim(), lines: [] }); continue; }
    const line = raw.trim();
    const rule = rules[rules.length - 1];
    if (line.startsWith("! ")) rule.lines.push({ detach: line.slice(2).trim().toLowerCase() });
    else {
      const i = line.indexOf(":");
      rule.lines.push({ name: line.slice(0, i).trim().toLowerCase(), value: line.slice(i + 1).trim() });
    }
  }
  return rules;
}

function directives(csp) {
  return new Map(csp.split(";").map(d => d.trim()).filter(Boolean).map(d => {
    const [name, ...values] = d.split(/\s+/);
    return [name, values];
  }));
}

const rules = parseHeaders(read(join(ROOT, "_headers")));
const globalRule = rules.find(r => r.pattern === "/*");
const rule = rules.find(r => r.pattern === RULE);
const cspOf = r => r.lines.find(l => l.name === "content-security-policy")?.value;

console.log("\n_headers: league-ify's CSP exception\n");

test("the league-ify rule detaches the global CSP before setting its own, below /*", () => {
  assert.ok(rule, `no ${RULE} rule`);
  assert.ok(rules.indexOf(rule) > rules.indexOf(globalRule),
    "a detach only removes what earlier rules added, so the rule must come after /*");
  const detach = rule.lines.findIndex(l => l.detach === "content-security-policy");
  const set = rule.lines.findIndex(l => l.name === "content-security-policy");
  assert.ok(detach !== -1, "missing '! Content-Security-Policy' (without it the two policies are comma-joined)");
  assert.ok(detach < set, "the detach must come before the new value");
  assert.equal(rule.lines.filter(l => l.name === "content-security-policy").length, 1);
});

test("the league-ify CSP is the global one plus Data Dragon in img-src and connect-src, nothing else", () => {
  const g = directives(cspOf(globalRule));
  const d = directives(cspOf(rule));
  assert.deepEqual([...d.keys()].sort(), [...g.keys()].sort(), "same directives");
  for (const [name, values] of g) {
    assert.deepEqual(d.get(name), [...values, ...(EXTRA[name] ?? [])], `${name} differs`);
  }
  assert.ok(!/unsafe-inline/.test(d.get("script-src").join(" ")), "scripts must stay 'self' only");
});

// ---------- config ----------

console.log("\nwrangler.toml and the migration\n");

const toml = read(join(ROOT, "wrangler.toml"));

test("nodejs_compat is on (the Function uses AsyncLocalStorage)", () => {
  const m = toml.match(/^compatibility_flags\s*=\s*\[([^\]]*)\]/m);
  assert.ok(m, "no compatibility_flags line");
  assert.match(m[1], /"nodejs_compat"/);
});

test("a D1 database is bound as DB", () => {
  const blocks = toml.split(/^\[\[d1_databases\]\]\s*$/m).slice(1);
  assert.ok(blocks.some(b => /^\s*binding\s*=\s*"DB"/m.test(b.split(/^\[/m)[0])), "no [[d1_databases]] with binding = \"DB\"");
});

test("the migration creates league-ify's four tables", () => {
  assert.ok(existsSync(MIGRATION), `missing ${rel(MIGRATION)}`);
  const sql = read(MIGRATION);
  for (const t of ["documents", "matches", "lu_users", "lu_sessions"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`), `no ${t} table`);
  }
});

// ---------- the vendored build ----------

console.log("\nprojects/league-ify/ and its Function: the vendored build\n");

const files = [];
(function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push({ path: p, size: st.size });
  }
})(SPA);

test("index.html and the Function bundle exist", () => {
  assert.ok(existsSync(join(SPA, "index.html")), "missing projects/league-ify/index.html");
  assert.ok(existsSync(FN), `missing ${rel(FN)}`);
});

test("index.html has no executable inline <script> or event handler", () => {
  const html = read(join(SPA, "index.html"));
  const bad = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\bsrc\s*=/i.test(m[1])) bad.push(`inline <script${m[1]}>`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*>/gi)) {
    if (/\son[a-z]+\s*=/i.test(m[0])) bad.push(`inline handler in ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(bad, [], "the site CSP blocks these");
});

test("every script and stylesheet index.html loads is under /projects/league-ify/ and present", () => {
  const html = read(join(SPA, "index.html"));
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*"([^"]+)"/gi)].map(m => m[1]);
  assert.ok(refs.length >= 2, "expected the entry script and stylesheet");
  const bad = refs.filter(r => !r.startsWith("/projects/league-ify/") || !existsSync(join(ROOT, r.split(/[?#]/)[0])));
  assert.deepEqual(bad, [], "built with the wrong base path, or a file is missing");
});

test("the Function bundle exports onRequest and fits the Worker size limit", () => {
  const text = read(FN);
  assert.match(text, /export\s*\{[^}]*\bonRequest\b/, "no onRequest export");
  const size = statSync(FN).size;
  assert.ok(size <= FN_BUDGET, `${(size / 1048576).toFixed(2)} MB`);
});

test("no file over Cloudflare's 25 MiB, and no local machine paths in the code", () => {
  assert.deepEqual(files.filter(f => f.size > CF_MAX_FILE).map(f => rel(f.path)), []);
  const re = /\b[A-Za-z]:[\\/]+Users[\\/]|(?:^|[\s"'(=])\/(?:Users|home)\/[\w.-]+\//m;
  const code = [...files.filter(f => /\.(html|js|css)$/.test(f.path)).map(f => f.path), FN];
  assert.deepEqual(code.filter(p => re.test(read(p))).map(rel), []);
});

console.log(`\n${passed} checks passed\n`);

// Checks on the vendored Discover Cleaner demo (projects/discover-cleaner-demo/)
// and on the one CSP exception that serves it.
//
// The demo is built in the app's repo and copied in by
// `npm run sync:discover-cleaner`. Everything checked here fails silently in
// production rather than loudly: a CSP block, a missing module, a fixture that
// doesn't parse. The bundle checks skip (with a note) while the folder is
// absent; the _headers checks always run.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = join(ROOT, "projects", "discover-cleaner-demo");
const DEMO_RULE = "/projects/discover-cleaner-demo/*";
const DEMO_IMG_EXTRA = "https://i.scdn.co";   // album covers: Spotify's image CDN

const BUDGET_BYTES = 15 * 1024 * 1024;        // the demo's own budget, uncompressed
const BUDGET_FILES = 1500;
const CF_MAX_FILE = 25 * 1024 * 1024;         // Cloudflare Pages' per-file limit

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

// ---------- _headers ----------

// Cloudflare's format: a URL pattern at column 0, then indented
// "Name: value" lines, or "! Name" to detach a header an earlier rule set.
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

const rules = parseHeaders(readFileSync(join(ROOT, "_headers"), "utf8"));
const cspSetters = rules.filter(r => r.lines.some(l => l.name === "content-security-policy"));
const globalRule = rules.find(r => r.pattern === "/*");
const demoRule = rules.find(r => r.pattern === DEMO_RULE);
const cspOf = rule => rule.lines.find(l => l.name === "content-security-policy")?.value;

console.log("\n_headers: the demo's CSP exception\n");

test("only the global rule and the demo rule set a CSP", () => {
  assert.deepEqual(cspSetters.map(r => r.pattern).sort(), ["/*", DEMO_RULE].sort());
});

test("the demo rule detaches the global CSP before setting its own, below /*", () => {
  assert.ok(demoRule, `no ${DEMO_RULE} rule`);
  assert.ok(rules.indexOf(demoRule) > rules.indexOf(globalRule),
    "a detach only removes what earlier rules added, so the demo rule must come after /*");
  const detach = demoRule.lines.findIndex(l => l.detach === "content-security-policy");
  const set = demoRule.lines.findIndex(l => l.name === "content-security-policy");
  assert.ok(detach !== -1, "missing '! Content-Security-Policy' (without it the two policies are comma-joined)");
  assert.ok(detach < set, "the detach must come before the new value");
  assert.equal(demoRule.lines.filter(l => l.name === "content-security-policy").length, 1);
});

test("the demo CSP is the global one plus Spotify's image CDN in img-src, nothing else", () => {
  const g = directives(cspOf(globalRule));
  const d = directives(cspOf(demoRule));
  assert.deepEqual([...d.keys()].sort(), [...g.keys()].sort(), "same directives");
  for (const [name, values] of g) {
    const want = name === "img-src" ? [...values, DEMO_IMG_EXTRA] : values;
    assert.deepEqual(d.get(name), want, `${name} differs`);
  }
  assert.ok(!/unsafe-inline/.test(d.get("script-src").join(" ")), "scripts must stay 'self' only");
});

// ---------- the bundle ----------

console.log("\nprojects/discover-cleaner-demo/: the vendored demo\n");

if (!existsSync(DEMO)) {
  console.log("  skip  projects/discover-cleaner-demo/ is not there yet.");
  console.log("        Build the demo in the app repo, then: npm run sync:discover-cleaner");
  console.log(`\n${passed} checks passed (bundle checks skipped)\n`);
} else {
  checkBundle();
  console.log(`\n${passed} checks passed\n`);
}

function checkBundle() {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else files.push({ path: p, size: st.size, ext: extname(name).toLowerCase() });
    }
  })(DEMO);

  const rel = p => relative(ROOT, p).split(sep).join("/");
  const read = p => readFileSync(p, "utf8");
  // Fixtures ship gzipped (the demo unpacks them in the browser).
  const readJson = p => p.endsWith(".gz") ? gunzipSync(readFileSync(p)).toString("utf8") : read(p);
  const html = files.filter(f => f.ext === ".html");
  const js = files.filter(f => f.ext === ".js" || f.ext === ".mjs");
  const css = files.filter(f => f.ext === ".css");
  const json = files.filter(f => f.ext === ".json" || f.path.endsWith(".json.gz"));
  const TEXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".txt", ".md", ".svg", ".webmanifest", ".map"]);

  // A local reference resolves the way Cloudflare Pages serves it: the file
  // itself, a folder's index.html, or "/foo" for foo.html.
  function resolves(fromFile, ref) {
    const clean = ref.split(/[?#]/)[0];
    if (!clean) return true;
    const target = clean.startsWith("/")
      ? join(ROOT, clean)
      : resolve(dirname(fromFile), decodeURIComponent(clean));
    if (relative(ROOT, target).startsWith("..")) return false;
    const isFile = p => existsSync(p) && statSync(p).isFile();
    return isFile(target) || isFile(join(target, "index.html")) || isFile(`${target}.html`);
  }
  const isLocal = ref => ref && !/^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);

  function attrs(tag) {
    const out = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
    }
    return out;
  }

  test("index.html exists", () => {
    assert.ok(existsSync(join(DEMO, "index.html")));
  });

  // The CSP blocks every inline script it would execute. A JSON data block
  // (<script type="application/json">, the demo's page config) is never
  // executed, so it is the one inline <script> allowed.
  test("no executable inline <script>, event handler or javascript: URL in any page", () => {
    const bad = [];
    for (const f of html) {
      const text = read(f.path);
      for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/i.test(m[1])) continue;
        if ((attrs(`<script${m[1]}>`).type || "").trim().toLowerCase() === "application/json") continue;
        bad.push(`${rel(f.path)}: inline <script${m[1]}>`);
      }
      for (const m of text.matchAll(/<[a-z][^>]*>/gi)) {
        if (/\son[a-z]+\s*=/i.test(m[0])) bad.push(`${rel(f.path)}: inline handler in ${m[0].slice(0, 80)}`);
        if (/=\s*["']?\s*javascript:/i.test(m[0])) bad.push(`${rel(f.path)}: javascript: URL in ${m[0].slice(0, 80)}`);
      }
    }
    assert.deepEqual(bad, [], "the site CSP blocks these");
  });

  test("every script, stylesheet, image and link in the pages resolves", () => {
    const missing = [];
    for (const f of html) {
      for (const m of read(f.path).matchAll(/<(script|link|img|source|a)\b[^>]*>/gi)) {
        const a = attrs(m[0]);
        for (const ref of [a.src, a.href, a.srcset?.split(",")[0]?.trim().split(/\s+/)[0]]) {
          if (isLocal(ref) && !resolves(f.path, ref)) missing.push(`${rel(f.path)} -> ${ref}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  test("scripts and stylesheets are referenced relatively (works under any path)", () => {
    const absolute = [];
    for (const f of html) {
      for (const m of read(f.path).matchAll(/<(script|link)\b[^>]*>/gi)) {
        const a = attrs(m[0]);
        const ref = m[1].toLowerCase() === "script" ? a.src : a.href;
        if (ref && /^(\/|https?:)/i.test(ref)) absolute.push(`${rel(f.path)} -> ${ref}`);
      }
    }
    assert.deepEqual(absolute, []);
  });

  test("every relative module import resolves", () => {
    const missing = [];
    const patterns = [
      /\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?["'](\.{1,2}\/[^"']+)["']/g,
      /\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'](\.{1,2}\/[^"']+)["']/g,
      /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
    ];
    for (const f of js) {
      const text = read(f.path);
      for (const re of patterns) {
        for (const m of text.matchAll(re)) {
          if (!resolves(f.path, m[1])) missing.push(`${rel(f.path)} -> ${m[1]}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  test("every local url() in the stylesheets resolves", () => {
    const missing = [];
    for (const f of css) {
      for (const m of read(f.path).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        if (isLocal(m[1]) && !resolves(f.path, m[1])) missing.push(`${rel(f.path)} -> ${m[1]}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test(`every fixture parses as JSON, gzipped or not (${json.length} files)`, () => {
    const broken = [];
    for (const f of json) {
      try { JSON.parse(readJson(f.path)); }
      catch (err) { broken.push(`${rel(f.path)}: ${err.message}`); }
    }
    assert.deepEqual(broken, []);
  });

  // fixtures/manifest.json lists every fixture the demo may ask for. A listed
  // file that's missing breaks a view; an unlisted one is dead weight.
  test("the fixture manifest and the fixture files match", () => {
    const dir = join(DEMO, "fixtures");
    const manifest = join(dir, "manifest.json");
    if (!existsSync(manifest)) return;
    const listed = JSON.parse(read(manifest)).files;
    assert.ok(Array.isArray(listed) && listed.length, "manifest.files should list the fixtures");
    const onDisk = files
      .filter(f => f.path.startsWith(dir + sep) && f.path !== manifest)
      .map(f => relative(dir, f.path).split(sep).join("/"));
    assert.deepEqual(listed.filter(p => !onDisk.includes(p)), [], "listed but missing");
    assert.deepEqual(onDisk.filter(p => !listed.includes(p)), [], "on disk but not listed");
  });

  test("within budget: 15 MB, 1,500 files, no file over Cloudflare's 25 MiB", () => {
    const total = files.reduce((n, f) => n + f.size, 0);
    assert.ok(files.length <= BUDGET_FILES, `${files.length} files`);
    assert.ok(total <= BUDGET_BYTES, `${(total / 1048576).toFixed(1)} MB`);
    const big = files.filter(f => f.size > CF_MAX_FILE).map(f => rel(f.path));
    assert.deepEqual(big, []);
  });

  test("no local machine paths in any text file", () => {
    const leaks = [];
    const re = /\b[A-Za-z]:[\\/]+Users[\\/]|(?:^|[\s"'(=])\/(?:Users|home)\/[\w.-]+\//m;
    for (const f of files.filter(f => TEXT.has(f.ext) || f.path.endsWith(".json.gz"))) {
      if (re.test(readJson(f.path))) leaks.push(rel(f.path));
    }
    assert.deepEqual(leaks, []);
  });
}

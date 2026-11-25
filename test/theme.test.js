// Cross-cutting theme guards (dark-spec §11.3): the rules of the two themes
// that span every page and every package, read statically from the site's
// own files, so a later page, renderer or stylesheet can't quietly break one.
//
//   heads       every site page carries the theme head of dark-spec §4.1,
//               strictly: the color-scheme meta, the dark theme-color (its
//               content the dark --paper), the #ffffff theme-color, theme.js
//               and site.css, once each, next to each other and in that
//               order, theme.js a plain classic script on the same ?v= as
//               site.css. theme.js is the only classic external script in
//               any head, and every inline <script> is JSON-LD (as seo.test
//               says, restated beside the new head script)
//   server      functions/product.js and functions/case.js replace everything
//               between <!-- seo:start and <!-- seo:end -->, so the theme head
//               sits after seo:end in product.html and case.html, and
//               lib/seo.js injectHead's output (productHead, notFoundHead,
//               caseHead, caseNotFoundHead) still carries it exactly once,
//               before the first stylesheet. A theme head inside the block
//               would pass the static check and vanish in production
//   split       var(--sweep) only as the background of unit-photo panels;
//               --sweep-ink and --sweep-graphite only as the text colour on
//               them; no photo panel on --panel (dark-spec §3.2). --sweep is
//               the one token to retune to real photos' backdrop, so nothing
//               else may move with it
//   pairs       every .for-dark <picture> (in site HTML, and in what
//               projects-page.js and portfolio-page.js render from the data)
//               follows its .for-light twin in the same parent, with the same
//               sources, sizes and alt, both images lazy (so the hidden twin
//               is never fetched), the dark file named light + "-dark" and
//               the same pixel size; and site.css holds the §5.3 rules in
//               exactly their media contexts (screen only, so print shows
//               the light twin)
//   sources     no prefers-color-scheme in site HTML except the dark
//               theme-color meta, and none in site JS strings except
//               theme.js's DARK constant (site CSS may use it). A <source
//               media="(prefers-color-scheme: dark)"> ignores the visitor's
//               footer choice
//   drawing     code that draws on a canvas (the drift tester) listens for
//               "dhole:theme", so a theme change repaints it
//   stand-ins   no site file names a scripted or stubbed-pad capture, or a
//               prototype-only row (dark-spec §8.3): shots are real captures
//
// test/design.test.js also checks the theme head, leniently: a page with
// none of it passes there with the old single #ffffff theme-color. That was
// the rule while each package moved its own pages during the build; this
// file is the strict one, so a page without the theme head fails here.
// theme.js's behaviour (stored choice, blocked storage, other tabs, the
// back/forward cache) and the footer control are test/theme-core.test.js's.
//
// The CSS parser, the JS string scanner and the image-size reader are
// copied from test/design.test.js and test/tools.test.js (tests don't import
// each other). Never the vendored apps, scripts/ or test/.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import {
  injectHead, productHead, notFoundHead, caseHead, caseNotFoundHead, SEO_START, SEO_END
} from "../lib/seo.js";
import { projects } from "../data/projects.js";
import { work } from "../data/portfolio.js";
import { toolRow } from "../assets/projects-page.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

// ---------- scope (as test/design.test.js) ----------

const EXCLUDED = [
  "projects/discover-cleaner-demo/", "projects/league-ify/", "functions/api/league-ify/",
  ".wrangler/", "node_modules/", "test/", "scripts/", ".git/"
];
const inScope = f => !EXCLUDED.some(x => f.startsWith(x));
const filesIn = (dir, re) => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter(d => d.isFile() && re.test(d.name))
  .map(d => (dir ? `${dir}/${d.name}` : d.name))
  .filter(inScope)
  .sort();
const filesUnder = (dir, re) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(d => {
  const rel = dir ? `${dir}/${d.name}` : d.name;
  if (d.isDirectory()) return inScope(`${rel}/`) ? filesUnder(rel, re) : [];
  return d.isFile() && re.test(d.name) && inScope(rel) ? [rel] : [];
});

const SITE_HTML = [...filesIn("", /\.html$/), ...filesIn("projects", /\.html$/)];
const SITE_CSS = filesIn("assets", /\.css$/);
// Site JS: design.test's set, plus every data file (the renderers print
// them) and the page Functions (they write HTML).
const SITE_JS = [...new Set([
  ...filesIn("assets", /\.js$/), ...filesIn("assets/entry", /\.js$/), ...filesIn("projects", /\.js$/),
  ...filesIn("lib", /\.js$/), ...filesIn("data", /\.js$/), ...filesIn("functions", /\.js$/)
])];
const SITE_CSS_FILE = "assets/site.css";
const THEME_FILE = "assets/theme.js";
const DRIFT_FILE = "projects/drift-tester.js";

// ---------- small helpers (copied from test/design.test.js) ----------

function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return pos => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}
// Blank a match but keep its newlines and length, so offsets and line
// numbers still hold.
const blank = m => m.replace(/[^\n]/g, " ");
const blankHtmlComments = html => html.replace(/<!--[\s\S]*?-->/g, blank);

// Fails with every problem found, one per line, each naming its file.
function report(problems, what) {
  if (problems.length) assert.fail(`${what}:\n  ${problems.join("\n  ")}`);
}

function splitTop(s, isSep) {
  const parts = [];
  let depth = 0, quote = null, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { cur += c; if (c === "\\") cur += s[++i] ?? ""; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (depth === 0 && isSep(c, s, i)) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
const selectorList = sel => splitTop(sel, c => c === ",").map(s => s.trim()).filter(Boolean);
// A selector's compound selectors, outermost first (combinators dropped).
const compounds = sel => splitTop(sel.replace(/\s*([>+~])\s*/g, " "), c => /\s/.test(c)).filter(Boolean);
const hasClass = (compound, cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(compound);

const attrsOf = tag => {
  const a = {};
  for (const m of tag.replace(/^<[\w-]+/, "").matchAll(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    a[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return a;
};

// ---------- CSS: design.test's parser ----------
//
// Rules come out flat: { file, line, selector, context: [at-rule preludes],
// decls: [{ prop, value, line }] }.

function parseCss(src, file, lineOffset = 0) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  const lineAt = lineIndex(text);
  const rules = [];
  let i = 0;

  const skipSpace = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const readChunk = () => {
    const start = i;
    let depth = 0, quote = null;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (depth <= 0 && (c === ";" || c === "{" || c === "}")) break;
    }
    return { start, chunk: text.slice(start, i), stop: text[i] || "" };
  };
  const nest = (prelude, parent) => {
    if (!parent) return prelude;
    const outer = selectorList(parent);
    return selectorList(prelude).flatMap(s => outer.map(p => (s.includes("&") ? s.replace(/&/g, p) : `${p} ${s}`))).join(", ");
  };
  const GROUPING = new Set(["media", "supports", "layer", "container", "document", "scope", "starting-style"]);

  function block(context, parent) {
    const decls = [];
    while (i < text.length) {
      skipSpace();
      if (i >= text.length) break;
      if (text[i] === "}") { i++; return decls; }
      const { start, chunk, stop } = readChunk();
      if (stop === "{") {
        i++;
        const prelude = chunk.trim().replace(/\s+/g, " ");
        const line = lineOffset + lineAt(start);
        if (prelude.startsWith("@")) {
          const name = (/^@([\w-]+)/.exec(prelude) || [, ""])[1].toLowerCase();
          if (name === "font-face") {
            rules.push({ file, line, selector: "@font-face", context, decls: block([...context, prelude], null) });
          } else if (GROUPING.has(name)) {
            const inner = block([...context, prelude], parent);
            if (inner.length && parent) rules.push({ file, line, selector: parent, context: [...context, prelude], decls: inner });
          } else {
            block([...context, prelude], null);
          }
        } else {
          const selector = nest(prelude, parent);
          const own = block(context, selector);
          rules.push({ file, line, selector, context, decls: own });
        }
        continue;
      }
      if (stop === ";") i++;
      const t = chunk.trim();
      if (!t || t.startsWith("@")) continue;
      const colon = t.indexOf(":");
      if (colon > 0) {
        const lead = chunk.length - chunk.trimStart().length;
        decls.push({
          prop: t.slice(0, colon).trim().toLowerCase(),
          value: t.slice(colon + 1).replace(/\s*!important\s*$/i, "").trim(),
          line: lineOffset + lineAt(start + lead)
        });
      }
    }
    return decls;
  }
  block([], null);
  return rules;
}

// Every piece of site CSS: the stylesheets, then <style> blocks and style
// attributes in site HTML.
function allCssRules() {
  const rules = [];
  for (const f of SITE_CSS) rules.push(...parseCss(read(f), f));
  for (const f of SITE_HTML) {
    const html = blankHtmlComments(read(f));
    const lineAt = lineIndex(html);
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      const at = m.index + m[0].indexOf(">") + 1;
      rules.push(...parseCss(m[1], f, lineAt(at) - 1));
    }
    for (const m of html.matchAll(/<[a-z][\w-]*\s[^>]*?\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const css = m[2] ?? m[3] ?? "";
      const parsed = parseCss(`[style] { ${css} }`, f, lineAt(m.index) - 1);
      rules.push(...parsed.map(r => ({ ...r, selector: "[style attribute]" })));
    }
  }
  return rules;
}
const RULES = allCssRules();
const THEME_ROOTS = new Set([":root", ':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
const isSiteRoot = r => r.file === SITE_CSS_FILE && THEME_ROOTS.has(r.selector);
const where = (r, d) => `${r.file}:${(d || r).line} (${r.selector})`;
const ctx = r => (r.context.length ? r.context.join(" ") : "no @media");

// ---------- JS: design.test's string scanner ----------

const KEYWORDS_BEFORE_EXPR = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"
]);

function unescapeAt(src, i) {
  const c = src[i + 1];
  const simple = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };
  if (c === "\n") return ["", 2];
  if (c === "\r") return ["", src[i + 2] === "\n" ? 3 : 2];
  if (c in simple && !(c === "0" && /\d/.test(src[i + 2] || ""))) return [simple[c], 2];
  if (c === "x") return [String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16)), 4];
  if (c === "u") {
    if (src[i + 2] === "{") {
      const end = src.indexOf("}", i + 3);
      return [String.fromCodePoint(parseInt(src.slice(i + 3, end), 16)), end - i + 1];
    }
    return [String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)), 6];
  }
  return [c ?? "", 2];
}

// Every string literal and template-literal chunk in a JS source, as
// { value, line }. Comments and regex literals are skipped.
function jsStrings(src, file = "source") {
  const lineAt = lineIndex(src);
  const out = [];
  const n = src.length;
  const exprDepth = [];
  let i = 0;
  let regexOk = true;

  const fail = why => { throw new Error(`${file}:${lineAt(i)}: ${why}`); };
  const readTemplate = () => {
    let buf = "", start = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { const [t, len] = unescapeAt(src, i); buf += t; i += len; continue; }
      if (c === "`") { out.push({ value: buf, line: lineAt(start) }); i++; regexOk = false; return; }
      if (c === "$" && src[i + 1] === "{") { out.push({ value: buf, line: lineAt(start) }); i += 2; exprDepth.push(0); regexOk = true; return; }
      buf += c; i++;
    }
    fail("unterminated template literal");
  };

  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) fail("unterminated comment");
      i = end + 2; continue;
    }
    if (c === "'" || c === '"') {
      const start = i;
      let buf = "";
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") { const [t, len] = unescapeAt(src, i); buf += t; i += len; continue; }
        if (src[i] === "\n") fail("unterminated string");
        buf += src[i++];
      }
      i++;
      out.push({ value: buf, line: lineAt(start) });
      regexOk = false;
      continue;
    }
    if (c === "`") { i++; readTemplate(); continue; }
    if (c === "/") {
      if (regexOk) {
        let inClass = false;
        i++;
        while (i < n) {
          const ch = src[i];
          if (ch === "\\") { i += 2; continue; }
          if (ch === "\n") fail("unterminated regex literal");
          i++;
          if (ch === "[") inClass = true;
          else if (ch === "]") inClass = false;
          else if (ch === "/" && !inClass) break;
        }
        while (i < n && /[a-z]/i.test(src[i])) i++;
        regexOk = false;
      } else {
        i++;
        regexOk = true;
      }
      continue;
    }
    if (c === "{") { if (exprDepth.length) exprDepth[exprDepth.length - 1]++; i++; regexOk = true; continue; }
    if (c === "}") {
      if (exprDepth.length) {
        if (exprDepth[exprDepth.length - 1] === 0) { exprDepth.pop(); i++; readTemplate(); continue; }
        exprDepth[exprDepth.length - 1]--;
      }
      i++; regexOk = true; continue;
    }
    if (/[A-Za-z_$À-￿]/.test(c)) {
      let j = i;
      while (j < n && /[\w$À-￿]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const afterDot = /\.\s*$/.test(src.slice(Math.max(0, i - 3), i)) && !/\.\.\.\s*$/.test(src.slice(Math.max(0, i - 4), i));
      regexOk = !afterDot && KEYWORDS_BEFORE_EXPR.has(word);
      i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      while (i < n && /[0-9a-zA-Z_.]/.test(src[i])) i++;
      regexOk = false; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (c === ")" || c === "]") { i++; regexOk = false; continue; }
    if ((c === "+" || c === "-") && src[i + 1] === c) { i += 2; regexOk = false; continue; }
    i++;
    regexOk = true;
  }
  if (exprDepth.length) fail("unterminated template expression");
  return out;
}

// ---------- images (copied from test/tools.test.js) ----------

// Pixel size from a WebP (VP8, VP8L or VP8X) or PNG header.
function imageSize(file) {
  const b = readFileSync(file);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8 " && b.readUIntBE(23, 3) === 0x9d012a) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
  }
  return null;
}
// A dark twin is its light file's name plus "-dark" before the extension.
const darkName = src => String(src).replace(/(\.[a-z0-9]+)$/i, "-dark$1");
const fileOf = src => String(src).split(/[?#]/)[0].replace(/^\/+/, "");

// ---------- the theme head (dark-spec §4.1) ----------

// The dark --paper, which the dark theme-color meta must equal (the phone
// browser's bar matches the page).
const DARK_PAPER = (() => {
  const r = RULES.find(r => r.file === SITE_CSS_FILE && r.selector === ':root[data-theme="dark"]');
  const d = r && r.decls.find(d => d.prop === "--paper");
  return d ? d.value.trim() : null;
})();
const DARK_MEDIA = "(prefers-color-scheme: dark)";
const THEME_JS = /^\/assets\/theme\.js\?v=(\d+)$/;
const SITE_CSS_HREF = /^\/assets\/site\.css\?v=(\d+)$/;
// A script runs as classic JavaScript with no type, an empty one or a
// JavaScript MIME type; "module" and data blocks (application/ld+json) don't.
const isClassic = a => !("type" in a) || /^\s*$|^(text|application)\/(x-)?(java|ecma)script$/i.test(a.type);
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// Every start tag in a page's <head>, in order, with its offset and line.
// Comments are blanked first (lengths kept, so offsets match the original).
function headOf(html) {
  const text = blankHtmlComments(html);
  const m = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(text);
  if (!m) return null;
  const start = m.index + m[0].indexOf(">") + 1;
  const lineAt = lineIndex(text);
  const tags = [...m[1].matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)].map(t => ({
    name: t[1].toLowerCase(), at: start + t.index, line: lineAt(start + t.index), a: attrsOf(t[0])
  }));
  return { tags, start, end: start + m[1].length };
}

const isScheme = t => t.name === "meta" && (t.a.name || "").toLowerCase() === "color-scheme";
const isThemeColour = t => t.name === "meta" && (t.a.name || "").toLowerCase() === "theme-color";
const isThemeJs = t => t.name === "script" && /^\/assets\/theme\.js(\?|$)/.test(t.a.src || "");
const isSheet = t => t.name === "link" && (t.a.rel || "").toLowerCase() === "stylesheet";

// The theme head, strictly: once each, consecutive, in §4.1's order and
// form. `label` names the page (and how it was made, for a server head);
// `lineOf` says whether there are line numbers to give.
function themeHeadProblems(html, label, { lines = true } = {}) {
  const h = headOf(html);
  if (!h) return [`${label}: no <head>`];
  const at = t => (lines ? `${label}:${t.line}` : label);
  const problems = [];
  const schemes = h.tags.filter(isScheme);
  const colours = h.tags.filter(isThemeColour);
  const scripts = h.tags.filter(isThemeJs);
  const sheets = h.tags.filter(isSheet);
  const fix = "copy the five lines of dark-spec §4.1 from store.html's head";

  if (schemes.length !== 1) problems.push(`${label}: ${schemes.length} <meta name="color-scheme"> tags; the theme head has exactly one (${fix})`);
  else if (!same(schemes[0].a, { name: "color-scheme", content: "light dark" })) {
    problems.push(`${at(schemes[0])}: the color-scheme meta must be exactly <meta name="color-scheme" content="light dark" /> (theme.js narrows it to the chosen theme)`);
  }
  if (colours.length !== 2) problems.push(`${label}: ${colours.length} theme-color metas; the theme head has exactly two, the dark one first (${fix})`);
  else {
    const [dark, light] = colours;
    if (!same(dark.a, { name: "theme-color", content: DARK_PAPER, media: DARK_MEDIA, "data-dark": "" })) {
      problems.push(`${at(dark)}: the first theme-color must be exactly <meta name="theme-color" content="${DARK_PAPER}" media="${DARK_MEDIA}" data-dark /> (the first matching one wins; its content is the dark --paper in ${SITE_CSS_FILE})`);
    }
    if (!same(light.a, { name: "theme-color", content: "#ffffff" })) {
      problems.push(`${at(light)}: the second theme-color must be exactly <meta name="theme-color" content="#ffffff" />, with no media`);
    }
  }
  let version = null;
  if (scripts.length !== 1) problems.push(`${label}: ${scripts.length} <script src="/assets/theme.js?v=N"> tags; the theme head has exactly one (${fix})`);
  else {
    const s = scripts[0];
    const v = THEME_JS.exec(s.a.src);
    if (!v) problems.push(`${at(s)}: theme.js must be loaded as /assets/theme.js?v=N, versioned like every stylesheet (dark-spec §2.3)`);
    else version = v[1];
    const extra = Object.keys(s.a).filter(k => k !== "src");
    if (extra.length) problems.push(`${at(s)}: theme.js has ${extra.join(", ")}; it must be a plain classic <script src> (no type, async or defer), so it runs before <body> is parsed and the chosen theme is on <html> before first paint`);
  }
  // Every classic external script in the head is theme.js: anything else
  // would block parsing for its own reasons, before or after the theme.
  for (const t of h.tags) {
    if (t.name === "script" && "src" in t.a && isClassic(t.a) && !isThemeJs(t)) {
      problems.push(`${at(t)}: <script src="${t.a.src}"> is a classic script in <head>; theme.js is the only one there. Load other code as an entry module (type="module")`);
    }
  }
  if (!sheets.length) problems.push(`${label}: no stylesheet`);

  if (!problems.length) {
    // Next to each other, in this order, with site.css (the first
    // stylesheet) straight after theme.js: theme.js after the metas it
    // rewrites, before every stylesheet so it doesn't wait for CSS.
    const want = [["the color-scheme meta", schemes[0]], ["the dark theme-color", colours[0]],
      ["the #ffffff theme-color", colours[1]], ["theme.js", scripts[0]], ["the site.css link", sheets[0]]];
    const first = h.tags.indexOf(want[0][1]);
    want.forEach(([what, t], k) => {
      if (h.tags.indexOf(t) !== first + k) {
        problems.push(`${at(t)}: ${what} must come straight after ${want[k - 1][0]} (line ${want[k - 1][1].line}), with nothing between: the theme head is five consecutive lines (dark-spec §4.1)`);
      }
    });
    const css = SITE_CSS_HREF.exec(sheets[0].a.href || "");
    if (!css) problems.push(`${at(sheets[0])}: the first stylesheet must be /assets/site.css?v=N, straight after theme.js`);
    else if (version !== null && css[1] !== version) {
      problems.push(`${at(scripts[0])}: theme.js is ?v=${version} but site.css is ?v=${css[1]}; a release bumps both (dark-spec §2.3)`);
    }
  }
  return problems;
}

// Inline scripts anywhere in a page: each must be a JSON-LD data block,
// which the CSP never runs. `<noscript>` doesn't match "<script".
function inlineScriptProblems(html, label, { lines = true } = {}) {
  const text = blankHtmlComments(html);
  const lineAt = lineIndex(text);
  const problems = [];
  for (const m of text.matchAll(/<script\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    if ("src" in a) continue;
    if ((a.type || "").toLowerCase() !== "application/ld+json") {
      problems.push(`${lines ? `${label}:${lineAt(m.index)}` : label}: an inline <script${a.type ? ` type="${a.type}"` : ""}>. The CSP has no 'unsafe-inline' for scripts, so it would be blocked in production: move the code into an entry module in assets/entry/ (only <script type="application/ld+json"> may be inline)`);
    }
  }
  return problems;
}

// =====================================================================

section("every page carries the theme head (dark-spec §4.1, §11.3 item 1)");

// The 15 pages the dark-mode build moved to the theme head. A new page is
// checked below like these (CLAUDE.md, "A new page"); this list only makes
// sure the scan can't quietly lose one.
const KNOWN_PAGES = [
  "404.html", "cart.html", "case.html", "checkout-cancelled.html", "index.html", "log.html", "order-complete.html",
  "portfolio.html", "product.html", "projects.html", "shipping-returns.html", "store.html",
  "projects/chiptune.html", "projects/discover-cleaner.html", "projects/drift-tester.html"
];

test("the scan covers every site page, the 15 the build moved included", () => {
  const missing = KNOWN_PAGES.filter(f => !SITE_HTML.includes(f));
  assert.deepEqual(missing, [], `not in the scan: ${missing.join(", ")}. If a page was removed, take it off KNOWN_PAGES here`);
  assert.ok(DARK_PAPER && /^#[0-9a-f]{6}$/i.test(DARK_PAPER), `${SITE_CSS_FILE}: no --paper in :root[data-theme="dark"], so the dark theme-color has nothing to match`);
});

for (const f of SITE_HTML) {
  test(`${f}: the theme head, once, in order, before every stylesheet; theme.js the only classic script in <head>`, () => {
    report(themeHeadProblems(read(f), f), "Theme head");
  });
}

test("no site page has an executable inline script (every <script> without src is JSON-LD)", () => {
  report(SITE_HTML.flatMap(f => inlineScriptProblems(read(f), f)), "Inline script");
});

// =====================================================================

section("the theme head survives the server-written heads (§11.3 item 2)");

// The same bench unit test/seo.test.js calls productHead() with.
const PHOTO = `/api/store/img/${"a".repeat(64)}.jpg`;
const BENCH_UNIT = {
  id: "ro-0042", name: "Nintendo 64, Charcoal", platform: "Nintendo 64", category: "console",
  condition: "Refurbished", priceCents: 15900, stock: 1, shippingClass: "console",
  image: PHOTO, images: [PHOTO], blurb: "Opened, cleaned and recapped.", details: [], source: "bench"
};

for (const [f, fn] of [["product.html", "functions/product.js"], ["case.html", "functions/case.js"]]) {
  test(`${f}: the theme head sits after <!-- seo:end -->, outside the block ${fn} replaces`, () => {
    const html = read(f);
    const a = html.indexOf(SEO_START), b = html.indexOf(SEO_END);
    assert.ok(a >= 0 && b > a, `${f}: no seo:start / seo:end block`);
    const h = headOf(html);
    const parts = [["the color-scheme meta", h.tags.filter(isScheme)], ["a theme-color meta", h.tags.filter(isThemeColour)],
      ["theme.js", h.tags.filter(isThemeJs)]];
    const problems = [];
    for (const [what, tags] of parts) {
      if (!tags.length) problems.push(`${f}: no ${what}`);
      for (const t of tags) {
        if (t.at < b) {
          problems.push(`${f}:${t.line}: ${what} is ${t.at > a ? "inside" : "before"} the seo block, which ${fn} replaces with the server-written head, so it would vanish in production. Move it below <!-- seo:end --> (dark-spec §4.1)`);
        }
      }
    }
    report(problems, "Theme head and the seo block");
  });
}

const SERVED = [
  ...["in-stock", "reserved", "sold", "withdrawn"].flatMap(state => [
    [`product.html with productHead(ro-0042, ${state})`, "product.html", productHead(BENCH_UNIT, { state })],
    [`product.html with productHead(ro-0042, ${state}, checkout off)`, "product.html", productHead(BENCH_UNIT, { state, checkout: false })]
  ]),
  ["product.html with notFoundHead()", "product.html", notFoundHead()],
  ...work.map(w => [`case.html with caseHead(${w.id})`, "case.html", caseHead(w)]),
  ["case.html with caseNotFoundHead()", "case.html", caseNotFoundHead()]
];

test(`lib/seo.js injectHead: ${SERVED.length} server-written heads each keep the theme head once, before the first stylesheet`, () => {
  const problems = [];
  for (const [label, f, tags] of SERVED) {
    const out = injectHead(read(f), tags);
    if (!out.includes(tags)) problems.push(`${label}: the server head wasn't injected (seo markers in ${f}?)`);
    problems.push(...themeHeadProblems(out, label, { lines: false }).map(p => `${p}. Keep the theme head in ${f} below <!-- seo:end -->`));
    problems.push(...inlineScriptProblems(out, label, { lines: false }));
  }
  report(problems, "Theme head in the served product and case pages");
});

// =====================================================================

section("the photo/panel split (dark-spec §3.2, §11.3 item 3)");

// Unit-photo panels: the selector's subject is one of these classes, or an
// img inside one of these. Only they sit on --sweep, the one token that can
// be retuned to the backdrop of real photos.
const PHOTO_PANELS = ["strip", "shot", "unit-card-photo", "owner-photo"];
const PHOTO_IMG_IN = ["thumbs", "cart-line", "look-thumb", "shelf-strip", "shot"];
const PHOTO_LIST = ".strip, .shot, .unit-card-photo, .thumbs img, .cart-line img, .look-thumb img, .owner-photo, .shelf-strip img";
function photoPanel(sel) {
  const parts = compounds(sel);
  const subject = parts[parts.length - 1] || "";
  if (PHOTO_PANELS.some(c => hasClass(subject, c))) return true;
  return /^img(?![\w-])/i.test(subject) && parts.slice(0, -1).some(p => PHOTO_IMG_IN.some(c => hasClass(p, c)));
}
// Text on a photo panel: its loading and failed panels, and a broken
// image's alt text.
const SWEEP_TEXT = ["panel-msg", "shot", "unit-card-photo"];
const sweepText = sel => { const parts = compounds(sel); return SWEEP_TEXT.some(c => hasClass(parts[parts.length - 1] || "", c)); };

const usesVar = (value, name) => new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value);

test("var(--sweep) is only the background of a unit-photo panel", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      if (!usesVar(d.value, "--sweep")) continue;
      if (isSiteRoot(r) && d.prop === "--sweep") continue;
      const others = selectorList(r.selector).filter(s => !photoPanel(s));
      if (!/^background(-color)?$/.test(d.prop)) {
        problems.push(`${where(r, d)}: ${d.prop}: ${d.value}. --sweep is only ever a photo panel's background; text on it uses --sweep-ink or --sweep-graphite`);
      } else if (others.length) {
        problems.push(`${where(r, d)}: ${others.join(", ")} on --sweep. --sweep is for unit-photo panels only (${PHOTO_LIST}); every other surface uses --panel, so retuning --sweep to real photos moves nothing else`);
      }
    }
  }
  report(problems, "--sweep outside a unit-photo panel");
});

test("--sweep-ink and --sweep-graphite are only the text colour of .panel-msg, .shot and .unit-card-photo", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      for (const name of ["--sweep-ink", "--sweep-graphite"]) {
        if (!usesVar(d.value, name)) continue;
        const others = selectorList(r.selector).filter(s => !sweepText(s));
        if (d.prop !== "color") problems.push(`${where(r, d)}: ${d.prop}: ${d.value}. ${name} is only a text colour on a photo panel`);
        else if (others.length) problems.push(`${where(r, d)}: ${others.join(", ")} uses ${name}, which is for text on a photo panel (.panel-msg, .shot, .unit-card-photo); elsewhere use --ink or --graphite`);
      }
    }
  }
  report(problems, "--sweep-ink or --sweep-graphite off a photo panel");
});

test("no unit-photo panel uses --panel or --panel-dk", () => {
  const problems = [];
  for (const r of RULES) {
    const photo = selectorList(r.selector).filter(photoPanel);
    if (!photo.length) continue;
    for (const d of r.decls) {
      for (const name of ["--panel", "--panel-dk"]) {
        if (usesVar(d.value, name)) problems.push(`${where(r, d)}: ${photo.join(", ")} is a unit-photo panel on ${name}; photo panels use --sweep (dark-spec §3.2)`);
      }
    }
  }
  report(problems, "A unit-photo panel on --panel");
});

test("the split guard finds today's photo panels (it isn't passing on nothing)", () => {
  const sweep = RULES.filter(r => !isSiteRoot(r) && r.decls.some(d => usesVar(d.value, "--sweep")));
  const named = new Set(sweep.flatMap(r => selectorList(r.selector)));
  for (const s of [".strip", ".shot", ".unit-card-photo", ".thumbs img", ".cart-line img"]) {
    assert.ok(named.has(s), `${s} isn't on --sweep any more: if photo panels moved, update PHOTO_PANELS here with them`);
  }
});

// =====================================================================

section("theme pairs (dark-spec §5.3, §7, §11.3 item 4)");

// Every <picture>…</picture> in some markup, with its offset, classes,
// <source>s and <img>s, plus any non-picture element carrying a pair class.
function picturesIn(html) {
  const text = blankHtmlComments(html);
  const pics = [...text.matchAll(/<picture\b([^>]*)>([\s\S]*?)<\/picture\s*>/gi)].map(m => ({
    at: m.index, end: m.index + m[0].length,
    classes: (attrsOf(`<picture${m[1]}>`).class || "").split(/\s+/).filter(Boolean),
    sources: [...m[2].matchAll(/<source\b[^>]*>/gi)].map(t => attrsOf(t[0])),
    imgs: [...m[2].matchAll(/<img\b[^>]*>/gi)].map(t => attrsOf(t[0]))
  }));
  const strays = [...text.matchAll(/<(?!picture\b)([a-z][\w-]*)\b[^>]*\bclass\s*=\s*("[^"]*"|'[^']*')/gi)]
    .filter(m => /(^|\s)for-(light|dark)(\s|$)/.test(m[2].slice(1, -1)))
    .map(m => ({ at: m.index, tag: m[1].toLowerCase() }));
  return { text, pics, strays };
}

// Pair problems in a piece of markup. `label(at)` says where an offset is.
// `files` collects every [light, dark, where] path pair for the file check.
function pairProblems(html, label, files) {
  const { text, pics, strays } = picturesIn(html);
  const problems = [];
  let count = 0;
  for (const s of strays) problems.push(`${label(s.at)}: a <${s.tag}> with class for-light or for-dark. A theme pair is two <picture>s (dark-spec §7)`);
  pics.forEach((p, k) => {
    const dark = p.classes.includes("for-dark"), light = p.classes.includes("for-light");
    if (light && dark) { problems.push(`${label(p.at)}: a <picture> with both for-light and for-dark`); return; }
    if (light) {
      const next = pics[k + 1];
      if (!next || !next.classes.includes("for-dark") || text.slice(p.end, next.at).trim()) {
        problems.push(`${label(p.at)}: a .for-light <picture> with no .for-dark twin straight after it. Alone it shows nothing in dark: add the twin, or drop the class`);
      }
      return;
    }
    if (!dark) return;
    const prev = pics[k - 1];
    if (!prev || !prev.classes.includes("for-light") || text.slice(prev.end, p.at).trim()) {
      problems.push(`${label(p.at)}: a .for-dark <picture> whose previous sibling isn't its .for-light twin. The light one comes first, straight before it, in the same parent`);
      return;
    }
    count++;
    const at = label(p.at);
    if (prev.sources.length !== p.sources.length) problems.push(`${at}: the dark twin has ${p.sources.length} <source>, the light one ${prev.sources.length}; they must match`);
    prev.sources.forEach((ls, i) => {
      const ds = p.sources[i];
      if (!ds) return;
      for (const k2 of ["media", "width", "height"]) {
        if (ls[k2] !== ds[k2]) problems.push(`${at}: <source> ${i + 1} ${k2} is "${ds[k2]}" in the dark twin and "${ls[k2]}" in the light one; a dark twin is the same frame at the same size`);
      }
      if (ds.srcset !== darkName(ls.srcset)) problems.push(`${at}: <source> ${i + 1} srcset is "${ds.srcset}"; the dark twin of "${ls.srcset}" is "${darkName(ls.srcset)}" (light name + "-dark")`);
      else files.push([ls.srcset, ds.srcset, at]);
    });
    if (prev.imgs.length !== 1 || p.imgs.length !== 1) { problems.push(`${at}: each twin has exactly one <img>`); return; }
    const [li, di] = [prev.imgs[0], p.imgs[0]];
    for (const k2 of ["width", "height", "alt"]) {
      if (li[k2] !== di[k2]) problems.push(`${at}: <img> ${k2} is "${di[k2]}" in the dark twin and "${li[k2]}" in the light one; they must be identical (only one renders, so a screen reader hears the alt once)`);
    }
    for (const [which, img] of [["light", li], ["dark", di]]) {
      if (img.loading !== "lazy") problems.push(`${at}: the ${which} twin's <img> isn't loading="lazy". Both twins are always lazy, so the hidden one is never fetched (dark-spec §7)`);
    }
    if (di.src !== darkName(li.src)) problems.push(`${at}: <img> src is "${di.src}"; the dark twin of "${li.src}" is "${darkName(li.src)}" (light name + "-dark")`);
    else files.push([li.src, di.src, at]);
  });
  return { problems, count };
}

// What the two renderers print from the data, through a small DOM stand-in
// (the same shape test/portfolio.test.js uses).
function fakeElement(extra = {}) {
  return { innerHTML: "", className: "", after() {}, append() {}, ...extra };
}
async function portfolioMarkup() {
  const out = [];
  const saved = { document: globalThis.document, location: globalThis.location, history: globalThis.history };
  const mod = await import("../assets/portfolio-page.js");
  const pages = ["/portfolio", ...work.map(w => `/case?id=${encodeURIComponent(w.id)}`)];
  try {
    for (const path of pages) {
      const url = new URL(path, "https://dhole.dev");
      const list = fakeElement(), head = fakeElement();
      const main = fakeElement({ querySelector: sel => (sel === ".case-head" ? head : null) });
      const all = fakeElement({ querySelector: () => null });
      globalThis.location = { search: url.search, hash: "", pathname: url.pathname };
      globalThis.history = { replaceState() {} };
      globalThis.document = {
        title: "",
        getElementById: id => ({ "pf-list": list, "case-main": main })[id] || null,
        querySelector: sel => (sel === ".case-all" ? all : sel === 'meta[name="description"]' ? { setAttribute() {} } : null)
      };
      if (url.pathname === "/portfolio") mod.renderPortfolio(); else mod.renderCase();
      out.push([`assets/portfolio-page.js (${path})`, url.pathname === "/portfolio" ? list.innerHTML : main.innerHTML]);
    }
  } finally {
    Object.assign(globalThis, saved);
  }
  return out;
}

test("every .for-dark picture follows its .for-light twin: same sources, sizes and alt, both lazy, the -dark file at the light file's size", async () => {
  const problems = [];
  const files = [];
  let pairs = 0;
  for (const f of SITE_HTML) {
    const lineAt = lineIndex(read(f));
    const r = pairProblems(read(f), at => `${f}:${lineAt(at)}`, files);
    problems.push(...r.problems); pairs += r.count;
  }
  const live = projects.filter(p => p.demo);
  const firstShot = live.findIndex(p => p.shot);
  for (const [i, p] of live.entries()) {
    const r = pairProblems(toolRow(p, { eager: i === firstShot }), () => `assets/projects-page.js toolRow (data/projects.js "${p.id}")`, files);
    problems.push(...r.problems); pairs += r.count;
  }
  for (const [label, html] of await portfolioMarkup()) {
    const r = pairProblems(html, () => label, files);
    problems.push(...r.problems); pairs += r.count;
  }
  const seen = new Set();
  for (const [light, dark, at] of files) {
    if (seen.has(`${light} ${dark}`)) continue;
    seen.add(`${light} ${dark}`);
    const [lf, df] = [fileOf(light), fileOf(dark)];
    if (!existsSync(join(ROOT, lf))) { problems.push(`${at}: ${light} doesn't exist`); continue; }
    if (!existsSync(join(ROOT, df))) { problems.push(`${at}: ${dark} doesn't exist; run npm run capture:tools, which takes both themes`); continue; }
    const [ls, ds] = [imageSize(join(ROOT, lf)), imageSize(join(ROOT, df))];
    if (!ls || !ds) problems.push(`${at}: can't read the pixel size of ${ls ? dark : light} (not a WebP or PNG)`);
    else if (ls.width !== ds.width || ls.height !== ds.height) {
      problems.push(`${at}: ${dark} is ${ds.width}x${ds.height} but ${light} is ${ls.width}x${ls.height}; a dark twin is the same frame at the same size`);
    }
  }
  report(problems, "Theme pair");
  assert.ok(pairs > 0, "no theme pair found in site HTML or either renderer's output: the scanner is broken, or the pairs are gone (then this guard goes with them)");
});

// dark-spec §5.3: the default hides the dark twin everywhere (print and a
// light screen); the two dark rules use the dark tokens' own selectors and
// media, so a footer choice wins over the device and print stays light.
const PAIR_RULES = [
  [".for-dark", [], "none"],
  [':root:not([data-theme="light"]) .for-light', ["@media screen and (prefers-color-scheme: dark)"], "none"],
  [':root:not([data-theme="light"]) .for-dark', ["@media screen and (prefers-color-scheme: dark)"], "block"],
  [':root[data-theme="dark"] .for-light', ["@media screen"], "none"],
  [':root[data-theme="dark"] .for-dark', ["@media screen"], "block"]
];

test("site.css holds the pair rules in exactly their media contexts, and nothing else sets a twin's display", () => {
  const problems = [];
  const naming = RULES.filter(r => /\.for-(light|dark)(?![\w-])/.test(r.selector) && r.decls.some(d => d.prop === "display"));
  for (const [selector, context, display] of PAIR_RULES) {
    const found = naming.filter(r => r.selector === selector);
    const want = `${selector} { display: ${display} } in ${context.length ? context.join(" ") : "no @media"}`;
    if (found.length !== 1) { problems.push(`${SITE_CSS_FILE}: ${found.length} rules for ${selector}; there is exactly one: ${want} (dark-spec §5.3)`); continue; }
    const r = found[0];
    if (r.file !== SITE_CSS_FILE) problems.push(`${where(r)}: the pair rules live in ${SITE_CSS_FILE}`);
    if (JSON.stringify(r.context) !== JSON.stringify(context)) {
      problems.push(`${where(r)}: in ${ctx(r)}; it must be in ${context.length ? context.join(" ") : "no @media at all"}. ${context.length ? "Screen only, so print and Save as PDF always show the light twin" : "It is the default for print and a light screen"} (dark-spec §5.3)`);
    }
    const d = r.decls.filter(d => d.prop === "display");
    if (d.length !== 1 || d[0].value !== display) problems.push(`${where(r)}: display must be ${display}`);
  }
  for (const r of naming) {
    if (!PAIR_RULES.some(([s]) => s === r.selector)) {
      problems.push(`${where(r)}: sets display on a theme twin outside the five rules of dark-spec §5.3; a rule like this can show both twins, or neither, in some theme`);
    }
  }
  report(problems, "Theme-pair rules");
});

// =====================================================================

section("no colour-scheme <source> (§11.3 item 5)");

// The one place HTML may name the device's colour scheme: the dark
// theme-color meta, which theme.js retargets when the visitor chooses.
const isDarkMeta = tag => { const a = attrsOf(tag); return /^meta$/i.test((/^<([\w-]+)/.exec(tag) || [])[1] || "") && (a.name || "").toLowerCase() === "theme-color" && "data-dark" in a; };

test("site HTML names prefers-color-scheme only in the dark theme-color meta (and in CSS)", () => {
  const problems = [];
  for (const f of SITE_HTML) {
    let text = blankHtmlComments(read(f));
    text = text.replace(/<style\b[\s\S]*?<\/style\s*>/gi, blank);
    text = text.replace(/<meta\b[^>]*>/gi, t => (isDarkMeta(t) ? blank(t) : t));
    const lineAt = lineIndex(text);
    for (const m of text.matchAll(/prefers-color-scheme/gi)) {
      const tag = text.lastIndexOf("<", m.index);
      problems.push(`${f}:${lineAt(m.index)}: ${text.slice(tag, text.indexOf(">", m.index) + 1).replace(/\s+/g, " ").slice(0, 120)}. Never pick a capture by the device's scheme: it ignores the footer choice. Use a .for-light/.for-dark pair (dark-spec §7)`);
    }
  }
  report(problems, "prefers-color-scheme in site HTML");
});

test("site JS strings name prefers-color-scheme only in theme.js's DARK constant", () => {
  const problems = [];
  for (const f of SITE_JS) {
    for (const s of jsStrings(read(f), f)) {
      if (!/prefers-color-scheme/i.test(s.value)) continue;
      if (f === THEME_FILE && s.value === DARK_MEDIA) continue;
      problems.push(`${f}:${s.line}: "${s.value.slice(0, 80)}". Only ${THEME_FILE} asks for the device's scheme; a page that picks markup or colours by it ignores the footer choice. Listen for "dhole:theme" and use dholeTheme.resolved(), or a .for-light/.for-dark pair`);
    }
  }
  const theme = read(THEME_FILE);
  if (!/\bvar\s+DARK\s*=\s*"\(prefers-color-scheme: dark\)"\s*;/.test(theme)) problems.push(`${THEME_FILE}: no var DARK = "${DARK_MEDIA}"; (dark-spec §4.2)`);
  const named = jsStrings(theme, THEME_FILE).filter(s => /prefers-color-scheme/i.test(s.value));
  if (named.length !== 1) problems.push(`${THEME_FILE}: ${named.length} strings name prefers-color-scheme; only the DARK constant should`);
  report(problems, "prefers-color-scheme in site JS");
});

// =====================================================================

section("drawing code follows the theme (§11.3 item 6)");

test(`code that draws on a canvas listens for "dhole:theme" (the drift tester among it)`, () => {
  const listens = src => /addEventListener\(\s*(["'`])dhole:theme\1/.test(src);
  const drawers = SITE_JS.filter(f => /\.getContext\(/.test(read(f)));
  assert.ok(listens(read(DRIFT_FILE)), `${DRIFT_FILE}: no window.addEventListener("dhole:theme", ...). The plot is drawn with the tokens read at init, so without it a theme change leaves the old colours on the canvas: re-read the tokens and redraw (dark-spec §6.1)`);
  const problems = drawers.filter(f => !listens(read(f)))
    .map(f => `${f}: draws on a canvas but has no "dhole:theme" listener. Re-read the colour tokens and redraw on it, as ${DRIFT_FILE} does`);
  report(problems, "Drawing code that ignores the theme");
  assert.ok(drawers.includes(DRIFT_FILE), `${DRIFT_FILE} no longer calls getContext: update this guard`);
});

// =====================================================================

section("stand-ins never ship (§8.3, §11.3 item 7)");

// What the dark-mode prototypes made and must never reach the site: a
// scripted gamepad's captures and the density prototype's labelled rows.
// PROTOTYPE is matched in capitals only: the portfolio's own copy says
// "prototype" about real work.
const STAND_INS = [/drift-scripted/i, /stubpad/i, /stubbed-pad/i, /PROTOTYPE/, /scripted stick/i];

test("no site file, or file name, names a scripted-pad capture or a prototype-only row", () => {
  const problems = [];
  const sources = [...new Set([...SITE_HTML, ...SITE_CSS, ...SITE_JS])];
  for (const f of sources) {
    read(f).split("\n").forEach((line, i) => {
      for (const re of STAND_INS) {
        if (re.test(line)) problems.push(`${f}:${i + 1}: names ${re.source}. Shots are real captures only (CLAUDE.md, dark-spec §8.3): remove it`);
      }
    });
  }
  const names = [...filesUnder("assets", /./), ...filesUnder("data", /./), ...filesIn("projects", /./), ...filesIn("", /./)];
  for (const f of names) {
    for (const re of STAND_INS) if (re.test(f)) problems.push(`${f}: a file named like a stand-in (${re.source}); it must never ship`);
  }
  report(problems, "Stand-in in a site file");
});

await run();

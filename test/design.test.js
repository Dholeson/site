// Site-wide design guards (spec §16): the house rules every page shares,
// checked statically over the site's own files, so a later edit can't
// quietly bring back what the redesign took out.
//
//   colour      hex only in site.css :root; no colour values anywhere else in
//               site CSS; no quoted colour strings in site JS; WCAG contrast
//               computed from the real :root values
//   effects     no shadows, blurs, gradients or clipped text; radius at most
//               4px; no uppercase; letter-spacing at most 0.01em; no text
//               under 16px; no overflow-x on html or body
//   tokens      every @font-face is font-display: optional; --font-id only in
//               .id rules; --buy-* and --kapton* only in .btn-buy rules
//   structure   no borders on index rows, portfolio rows or unit cards; no
//               painted ::before/::after
//   copy        no em dash, arrows, eyebrows, "actually" or the old formula
//               lines; "business days" is always "two business days"; buyers
//               never see the word "bench"
//   money       every $ amount on home, store and shipping is a SHIPPING rate;
//               no "$18"-style amounts; no "N days" except RETURNS.console
//   heads       site.css, the Public Sans preload, theme-color, icon.svg;
//               a <noscript> notice on every page JavaScript renders
//   files       fonts and licences; the retired stylesheets and brand files
//               are gone and unreferenced; preview images at their sizes
//
// Scope. Site HTML: *.html in the root and projects/*.html. Site CSS:
// assets/*.css, plus <style> blocks and style attributes in site HTML. Site
// JS: assets/*.js, assets/entry/*.js, projects/*.js, lib/seo.js and
// data/projects.js. Never the vendored apps (projects/discover-cleaner-demo/,
// projects/league-ify/, functions/api/league-ify/) or .wrangler/,
// node_modules/, test/, scripts/ and .git/.
//
// JS copy is read from string and template literals only: comments are
// skipped, and so are regex literals (lib/seo.js has an em dash inside one).
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { RETURNS, SHIPPING, formatMoney } from "../data/products.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

// ---------- scope ----------

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
  const rel = `${dir}/${d.name}`;
  if (d.isDirectory()) return inScope(`${rel}/`) ? filesUnder(rel, re) : [];
  return d.isFile() && re.test(d.name) && inScope(rel) ? [rel] : [];
});

const SITE_HTML = [...filesIn("", /\.html$/), ...filesIn("projects", /\.html$/)];
const SITE_CSS = filesIn("assets", /\.css$/);
const SITE_JS = [
  ...filesIn("assets", /\.js$/), ...filesIn("assets/entry", /\.js$/), ...filesIn("projects", /\.js$/),
  "lib/seo.js", "data/projects.js"
];
const SITE_CSS_FILE = "assets/site.css";

// Pages whose content JavaScript renders (spec §10): each carries the
// <noscript> notice at the top of main.
const JS_RENDERED = [
  "store.html", "product.html", "cart.html", "projects.html", "portfolio.html", "case.html", "log.html",
  "projects/drift-tester.html", "projects/chiptune.html"
];
// Regions that only ever add to a finished static page, after everything
// else (home's owner block and Listed now, the store's after-shelf block).
const APPEND_ONLY_REGIONS = new Set(["owner", "listed-now", "store-after"]);

// ---------- small helpers ----------

// Line numbers for offsets into a text.
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
// Blank a match but keep its newlines, so line numbers still hold.
const blank = m => m.replace(/[^\n]/g, " ");
const blankHtmlComments = html => html.replace(/<!--[\s\S]*?-->/g, blank);

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", mdash: "\u2014", ndash: "\u2013",
  rarr: "\u2192", larr: "\u2190", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
  hellip: "\u2026", middot: "\u00b7", bull: "\u2022", copy: "\u00a9", dollar: "$", times: "\u00d7"
};
const decodeEntities = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") {
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return NAMED_ENTITIES[e.toLowerCase()] ?? m;
});

// Fails with every problem found, one per line, each naming its file.
function report(problems, what) {
  if (problems.length) assert.fail(`${what}:\n  ${problems.join("\n  ")}`);
}

// Splits on a separator at the top level only (not inside parentheses,
// brackets or strings).
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
// The compound selector a rule's declarations land on: the last one.
const subjectOf = sel => {
  const parts = splitTop(sel.replace(/\s*([>+~])\s*/g, " "), c => /\s/.test(c)).filter(Boolean);
  return parts[parts.length - 1] || "";
};
const hasClass = (compound, cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(compound);

// ---------- CSS: a small parser ----------
//
// Rules come out flat: { file, line, selector, context: [at-rule preludes],
// decls: [{ prop, value, line }] }. @font-face blocks are rules with the
// selector "@font-face". Nested rules (CSS nesting) get their parent's
// selector in front.

function parseCss(src, file, lineOffset = 0) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  const lineAt = lineIndex(text);
  const rules = [];
  let i = 0;

  const skipSpace = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  // Reads up to the next ; { or } at the top level, outside strings and ().
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
        const prelude = chunk.trim();
        const line = lineOffset + lineAt(start);
        if (prelude.startsWith("@")) {
          const name = (/^@([\w-]+)/.exec(prelude) || [, ""])[1].toLowerCase();
          if (name === "font-face") {
            rules.push({ file, line, selector: "@font-face", context, decls: block([...context, prelude], null) });
          } else if (GROUPING.has(name)) {
            const inner = block([...context, prelude], parent);
            if (inner.length && parent) rules.push({ file, line, selector: parent, context: [...context, prelude], decls: inner });
          } else {
            // @keyframes, @page and the like: their blocks are rules too.
            block([...context, prelude], null);
          }
        } else {
          const selector = nest(prelude.replace(/\s+/g, " "), parent);
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
const isRoot = r => r.selector === ":root";
const isSiteRoot = r => r.file === SITE_CSS_FILE && isRoot(r);
const where = (r, d) => `${r.file}:${(d || r).line} (${r.selector})`;

// ---------- tokens ----------

const tokenMap = rules => {
  const m = new Map();
  for (const r of rules) for (const d of r.decls) if (d.prop.startsWith("--")) m.set(d.prop, d.value);
  return m;
};
const BASE_ROOT_RULES = RULES.filter(r => isSiteRoot(r) && r.context.length === 0);
const TOKENS = tokenMap(BASE_ROOT_RULES);

// Replaces var() with token values until none are left. An unknown token
// without a fallback comes out as <unresolved --name>.
function resolveVars(value, tokens = TOKENS) {
  let v = value;
  for (let n = 0; n < 25 && /var\(/.test(v); n++) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g, (m, name, fb) =>
      tokens.has(name) ? tokens.get(name) : fb !== undefined ? fb.trim() : `<unresolved ${name}>`);
  }
  return /var\(/.test(v) ? `<unresolved ${value}>` : v;
}

// ---------- colour ----------

const HEX = /(^|[^\w&-])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/i;
const COLOUR_FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\s*\(/i;
const COLOUR_PROPS = /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|fill|stroke|caret-color|accent-color|text-decoration(-color)?|text-emphasis(-color)?|column-rule(-color)?|scrollbar-color|-webkit-tap-highlight-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?|stop-color|flood-color|lighting-color|text-shadow|box-shadow)$/;
const NAMED_COLOURS = new Set((
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
  "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
  "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
  "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
  "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
  "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
  "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
  "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue " +
  "mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
  "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
  "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
  "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue " +
  "slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
  "whitesmoke yellow yellowgreen canvas canvastext linktext visitedtext activetext buttonface buttontext buttonborder " +
  "field fieldtext highlight highlighttext selecteditem selecteditemtext mark marktext graytext accentcolor accentcolortext"
).split(/\s+/));

function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, "").toLowerCase();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(h)) return null;
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  return [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16));
}
function luminance([r, g, b]) {
  const lin = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Text pairs (4.5:1) and non-text edges (3:1), named by token.
const TEXT_PAIRS = [
  ["ink", "paper"], ["graphite", "paper"], ["fault", "paper"],
  ["ink", "sweep"], ["graphite", "sweep"], ["fault", "sweep"],
  ["ink", "sweep-dk"], ["graphite", "sweep-dk"],
  ["buy-fg", "buy-bg"], ["buy-fg", "buy-bg-hover"],
  ["ink", "kapton"], ["ink", "kapton-dk"],
  ["paper", "ink"], ["paper", "graphite"]
];
const EDGE_PAIRS = [["edge", "paper"], ["edge", "sweep"]];

function contrastProblems(tokens, label) {
  const problems = [];
  const colourOf = name => {
    const v = resolveVars(`var(--${name})`, tokens);
    const rgb = hexToRgb(v);
    if (!rgb) problems.push(`${label}: --${name} is "${v}", which isn't a plain #rgb or #rrggbb colour, so its contrast can't be checked`);
    return rgb ? { rgb, hex: v.trim() } : null;
  };
  const check = ([fg, bg], min, hint) => {
    const a = colourOf(fg), b = colourOf(bg);
    if (!a || !b) return;
    const ratio = contrast(a.rgb, b.rgb);
    if (ratio + 1e-9 < min) {
      problems.push(`${label}: --${fg} (${a.hex}) on --${bg} (${b.hex}) is ${ratio.toFixed(2)}:1, under ${min}:1.${hint ? ` ${hint}` : ""}`);
    }
  };
  for (const p of TEXT_PAIRS) check(p, 4.5);
  check(EDGE_PAIRS[0], 3, "Input and outline-button borders must stay visible on the page: darken --edge.");
  check(EDGE_PAIRS[1], 3, "A darker --sweep needs a darker --edge too: darken --edge until it is at least 3:1 on both --paper and --sweep.");
  return problems;
}

// ---------- JS: string and template literals ----------

const KEYWORDS_BEFORE_EXPR = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"
]);

function unescapeAt(src, i) {
  // src[i] is a backslash. Returns [text, length consumed].
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
  const exprDepth = [];   // one entry per open ${ }, counting its inner braces
  let i = 0;
  let regexOk = true;

  const fail = why => { throw new Error(`${file}:${lineAt(i)}: ${why}`); };
  const readTemplate = () => {
    let buf = "", start = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { const [t, len] = unescapeAt(src, i); buf += t; i += len; continue; }
      if (c === "`") { out.push({ value: buf, line: lineAt(start), kind: "template" }); i++; regexOk = false; return; }
      if (c === "$" && src[i + 1] === "{") { out.push({ value: buf, line: lineAt(start), kind: "template" }); i += 2; exprDepth.push(0); regexOk = true; return; }
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
      out.push({ value: buf, line: lineAt(start), kind: "string" });
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
    if (/[A-Za-z_$\u00c0-\uffff]/.test(c)) {
      let j = i;
      while (j < n && /[\w$\u00c0-\uffff]/.test(src[j])) j++;
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

const JS_STRINGS = Object.fromEntries(SITE_JS.map(f => [f, jsStrings(read(f), f)]));
// CSS strings (content: "…") are copy too.
const CSS_STRINGS = RULES.flatMap(r => r.decls
  .filter(d => d.prop === "content")
  .flatMap(d => [...d.value.matchAll(/"([^"]*)"|'([^']*)'/g)].map(m => ({ file: r.file, line: d.line, value: m[1] ?? m[2] }))));

// Every string in site JS and CSS, decoded, as { file, line, kind, value }.
function* allStrings() {
  for (const f of SITE_JS) for (const s of JS_STRINGS[f]) yield { file: f, line: s.line, kind: s.kind, value: decodeEntities(s.value) };
  for (const s of CSS_STRINGS) yield { ...s, kind: "string", value: decodeEntities(s.value) };
}

// Where a pattern first matches in a string, as "file:line: text around it".
// A template literal can span lines, so the line is the match's own.
function matchIn(s, re) {
  const m = new RegExp(re.source, re.flags.replace("g", "")).exec(s.value);
  if (!m) return null;
  const line = s.line + (s.kind === "template" ? (s.value.slice(0, m.index).match(/\n/g) || []).length : 0);
  const around = s.value.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, " ").trim();
  return { at: `${s.file}:${line}`, match: m[0], around: JSON.stringify(around) };
}

// Site HTML with comments blanked and entities decoded, line by line.
const htmlLines = f => blankHtmlComments(read(f)).split("\n").map(decodeEntities);
const htmlFlat = f => decodeEntities(blankHtmlComments(read(f))).replace(/\s+/g, " ");

// ---------- copy rules ----------

const BANNED_COPY = [
  { re: /\u2014/, what: "an em dash (—)" },
  { re: /\u2192/, what: "a right arrow (→)" },
  { re: /\u2190/, what: "a left arrow (←)" },
  { re: /\bclass(?:Name)?\s*=\s*["'`]?[^"'`>]*\beyebrow\b/i, what: 'an eyebrow (class="eyebrow")' },
  { re: /\bactually\b/i, what: '"actually"' },
  { re: /reading rather than an opinion/i, what: '"a reading rather than an opinion"' },
  { re: /measured,?\s+not guessed/i, what: '"measured, not guessed"' },
  { re: /\b2\s+business\s+days\b/i, what: '"2 business days" (write "two business days")' },
  { re: /(?<!\btwo[\s\u00a0]+)\bbusiness[\s\u00a0]+days\b/i, what: '"business days" without "two" before it' }
];

// "30 days", "30-day", "thirty days": a time promise. The only one allowed is
// the returns term, verbatim from RETURNS.console.
const DAYS_PHRASE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|forty-five|sixty|ninety)(?:[\s\u00a0]+|-)days?\b/i;
// Blanked to the same length, so match positions still hold.
const withoutReturnsTerm = s => (RETURNS.console ? s.split(RETURNS.console).join(" ".repeat(RETURNS.console.length)) : s);
// "$18" with no cents: every amount on the site is formatMoney's "$18.00".
const BARE_DOLLARS = /\$\d+(?![\d.,])/;
const DOLLAR_AMOUNT = /\$\s*\d[\d,]*(?:\.\d+)?/g;

// The text a visitor can see: body text (noscript included), the <title>,
// alt/title/aria-label/placeholder attributes, and the description and
// link-preview title tags. Line numbers are kept.
const SHOWN_META = /^(description|og:title|og:description|twitter:title|twitter:description|og:image:alt|twitter:image:alt)$/i;
function visibleLines(f) {
  let t = blankHtmlComments(read(f));
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, blank);
  t = t.replace(/<[^>]*>/g, tag => {
    const shown = [];
    for (const m of tag.matchAll(/\s(alt|title|aria-label|placeholder)\s*=\s*("([^"]*)"|'([^']*)')/gi)) shown.push(m[3] ?? m[4]);
    if (/^<meta\b/i.test(tag)) {
      const key = (/\s(?:name|property)\s*=\s*"([^"]*)"/i.exec(tag) || [])[1];
      const content = (/\scontent\s*=\s*"([^"]*)"/i.exec(tag) || [])[1];
      if (key && content && SHOWN_META.test(key)) shown.push(content);
    }
    const lines = tag.split("\n").length - 1;
    return ` ${shown.join(" ")} ${"\n".repeat(lines)}`;
  });
  return t.split("\n").map(decodeEntities);
}

// ---------- HTML heads ----------

const attrsOf = tag => {
  const a = {};
  for (const m of tag.replace(/^<[\w-]+/, "").matchAll(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    a[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return a;
};
const headOf = f => (/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(blankHtmlComments(read(f))) || [, ""])[1];
const tagsIn = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(m => attrsOf(m[0]));

// PNG width and height from the IHDR chunk.
function pngSize(f) {
  const b = readFileSync(join(ROOT, f));
  assert.ok(b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString("latin1", 12, 16) === "IHDR", `${f} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// =====================================================================

section("the scanners themselves");

test("the CSS parser finds rules, nested @media rules, @font-face and declaration lines", () => {
  const rules = parseCss(`/* x */\n:root { --a: #fff; }\n@media (min-width: 1em) {\n  .b, .c > .d { color: var(--a);\n  border: 0 }\n}\n@font-face { font-family: "X"; font-display: optional; }\n.e { content: "a;b{c}"; }`, "t.css");
  const sel = rules.map(r => r.selector);
  assert.deepEqual(sel.sort(), [".b, .c > .d", ".e", ":root", "@font-face"].sort());
  const bd = rules.find(r => r.selector === ".b, .c > .d");
  assert.deepEqual(bd.context, ["@media (min-width: 1em)"]);
  assert.deepEqual(bd.decls.map(d => [d.prop, d.line]), [["color", 4], ["border", 5]]);
  assert.equal(rules.find(r => r.selector === ".e").decls[0].value, '"a;b{c}"');
  assert.equal(subjectOf(".c > .d"), ".d");
  assert.equal(subjectOf(".a:is(.b .c) .d::after"), ".d::after");
});

test("the JS scanner reads strings and templates, and skips comments and regex literals", () => {
  const src = [
    "// a comment with 'quotes' and \u2014",
    "const a = 'one', b = \"two\\u2014\"; /* '#fff' */",
    "const r = /[\\s,.;:\u2014-]+$/g, q = x / 2 / y;",
    "const t = `head ${a ? `in ${'deep'}` : { k: '}' }} tail`;",
    "if (ok) return /#a78bfa/.test(s); const z = (1) / 3;"
  ].join("\n");
  const values = jsStrings(src).map(s => s.value);
  assert.deepEqual(values, ["one", "two\u2014", "head ", "in ", "deep", "", "}", " tail"]);
});

test("every site JS file scans cleanly", () => {
  // jsStrings throws on anything it can't follow; reaching here means every
  // file was read to its end with its templates and regexes balanced.
  for (const f of SITE_JS) assert.ok(Array.isArray(JS_STRINGS[f]), f);
  assert.ok(SITE_JS.includes("projects/chiptune.js") && SITE_JS.includes("lib/seo.js") && SITE_JS.includes("data/projects.js"));
  assert.ok(SITE_HTML.includes("index.html") && SITE_HTML.includes("projects/drift-tester.html"));
  assert.ok(!SITE_HTML.some(f => f.startsWith("projects/discover-cleaner-demo/") || f.startsWith("projects/league-ify/")));
});

// =====================================================================

section("colour");

test("hex colours appear only in site.css :root", () => {
  const problems = [];
  for (const r of RULES) {
    if (isSiteRoot(r)) continue;
    for (const d of r.decls) {
      const m = HEX.exec(d.value);
      if (m) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (hex colours belong in site.css :root; use a token)`);
    }
  }
  report(problems, "Hex colour outside site.css :root");
});

test("no other colour values outside site.css :root (rgb(), hsl(), named colours)", () => {
  const problems = [];
  for (const r of RULES) {
    if (isSiteRoot(r)) continue;
    for (const d of r.decls) {
      if (COLOUR_FN.test(d.value)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      if (COLOUR_PROPS.test(d.prop)) {
        const words = d.value.replace(/var\([^()]*\)/g, " ").toLowerCase().match(/[a-z][a-z-]*/g) || [];
        const named = words.filter(w => NAMED_COLOURS.has(w));
        if (named.length) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (named colour ${named.join(", ")}; use a token)`);
      }
    }
  }
  report(problems, "Colour value outside site.css :root");
});

test("no quoted colour strings in site JS ('#rgb', '#rrggbb', '#rrggbbaa', or rgb()/hsl() literals)", () => {
  const problems = [];
  for (const f of SITE_JS) {
    for (const s of JS_STRINGS[f]) {
      const v = s.value.trim();
      if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) problems.push(`${f}:${s.line}: '${v}'`);
      else if (/\b(rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(\s*[\d.]/i.test(v)) problems.push(`${f}:${s.line}: '${v}'`);
    }
  }
  report(problems, "Colour literal in site JS (read colours from the CSS tokens with getComputedStyle)");
});

test("site.css :root defines every material, and the money button's three lines", () => {
  for (const name of ["paper", "sweep", "sweep-dk", "ink", "graphite", "rule-c", "edge", "kapton", "kapton-dk", "fault", "buy-bg", "buy-bg-hover", "buy-fg"]) {
    assert.ok(TOKENS.has(`--${name}`), `${SITE_CSS_FILE} :root has no --${name}`);
  }
});

test("text pairs are at least 4.5:1 and edges at least 3:1, from the actual :root values", () => {
  const problems = contrastProblems(TOKENS, `${SITE_CSS_FILE} :root`);
  // A :root inside @media (a dark scheme, say) is checked as an overlay too.
  for (const r of RULES.filter(r => isSiteRoot(r) && r.context.length)) {
    const overlay = new Map(TOKENS);
    for (const d of r.decls) if (d.prop.startsWith("--")) overlay.set(d.prop, d.value);
    const colourTokens = r.decls.some(d => /^--(paper|sweep|sweep-dk|ink|graphite|edge|kapton|kapton-dk|fault|buy-[\w-]+)$/.test(d.prop));
    if (colourTokens) problems.push(...contrastProblems(overlay, `${SITE_CSS_FILE}:${r.line} :root in ${r.context.join(" ")}`));
  }
  report(problems, "Contrast");
});

test("the contrast check catches a darker --sweep that leaves --edge alone", () => {
  // The spec's own example: --sweep #e8e8e8 puts edge on sweep at 2.82:1.
  const tuned = new Map(TOKENS);
  tuned.set("--sweep", "#e8e8e8");
  const problems = contrastProblems(tuned, "test");
  assert.ok(problems.some(p => /--edge .* on --sweep .* is 2\.8\d:1/.test(p) && /darken --edge/.test(p)), problems.join("\n"));
});

// =====================================================================

section("effects and type");

test("no shadows, blurs, gradients or clipped text", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      const v = d.value.toLowerCase();
      const none = /^(none|initial|unset|inherit)$/.test(v);
      if ((d.prop === "box-shadow" || d.prop === "text-shadow") && !none) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      else if (/^(-webkit-)?backdrop-filter$/.test(d.prop) && !none) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      else if (d.prop === "filter" && /\b(drop-shadow|blur)\(/.test(v)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      else if (/gradient\(/.test(v)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (a gradient)`);
      else if (/^(-webkit-)?background-clip$/.test(d.prop) && /\btext\b/.test(v)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      else if (d.prop === "background" && /\btext\b/.test(v)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (background-clip: text)`);
    }
  }
  for (const s of allStrings()) {
    if (/\b(box-shadow|text-shadow|backdrop-filter)\s*:|gradient\(|background-clip\s*:\s*text/i.test(s.value)) {
      const hit = matchIn(s, /\b(box-shadow|text-shadow|backdrop-filter)\s*:|gradient\(|background-clip\s*:\s*text/i);
      problems.push(`${hit.at}: a style string: ${hit.around}`);
    }
  }
  report(problems, "Shadow, blur, gradient or clipped text");
});

const lengths = v => [...v.matchAll(/(-?\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax|svh|dvh|lvh|ch|ex|cap|lh|rlh|pt|pc|cm|mm|in|q)?(?![\w-])/gi)]
  .map(m => ({ n: Number(m[1]), unit: (m[2] || "").toLowerCase(), raw: m[0] }));

test("corner radius is at most 4px", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      if (!/^border(-[\w-]+)?-radius$/.test(d.prop)) continue;
      const v = resolveVars(d.value);
      if (/unresolved/.test(v)) { problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (not a :root token; use var(--radius) or 0)`); continue; }
      for (const l of lengths(v.replace(/\//g, " "))) {
        const px = l.unit === "px" || l.unit === "" ? l.n : l.unit === "rem" || l.unit === "em" ? l.n * 16 : l.n === 0 ? 0 : Infinity;
        if (px > 4) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (${l.raw})`);
      }
    }
  }
  report(problems, "Radius above 4px");
});

test("no uppercase or small caps", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      if (d.prop === "text-transform" && /uppercase/i.test(d.value)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      if (/^font-variant(-caps)?$/.test(d.prop) && /(small|petite|titling|all)-caps|unicase/i.test(d.value)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
    }
  }
  for (const s of allStrings()) {
    const hit = matchIn(s, /text-transform\s*:\s*uppercase/i);
    if (hit) problems.push(`${hit.at}: ${hit.around}`);
  }
  report(problems, "Uppercase");
});

test("letter-spacing is at most 0.01em", () => {
  const problems = [];
  for (const r of RULES) {
    for (const d of r.decls) {
      if (d.prop !== "letter-spacing") continue;
      const v = resolveVars(d.value);
      if (/^(normal|0|initial|inherit|unset)$/i.test(v.trim())) continue;
      if (/unresolved/.test(v)) { problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`); continue; }
      for (const l of lengths(v)) {
        const em = l.unit === "em" || l.unit === "rem" ? l.n : l.unit === "px" ? l.n / 16 : l.n === 0 ? 0 : Infinity;
        if (em > 0.01 + 1e-9) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      }
    }
  }
  report(problems, "Letter-spacing above 0.01em");
});

test("no font-size under 1rem or 16px (canvas labels aside)", () => {
  const problems = [];
  const tooSmall = (v, r, d) => {
    if (/\b(xx-small|x-small|small|smaller)\b/i.test(v)) return problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
    if (/unresolved/.test(v)) return problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (use a --t-* token from :root)`);
    for (const l of lengths(v)) {
      const px = l.unit === "px" ? l.n : l.unit === "rem" || l.unit === "em" ? l.n * 16 : l.unit === "%" ? l.n * 0.16
        : l.unit === "" ? null : -1;
      if (px === null) continue;
      if (px < 16) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (${l.raw}${px < 0 ? ", a unit that can shrink below 16px" : ""})`);
    }
  };
  for (const r of RULES) {
    for (const d of r.decls) {
      if (d.prop === "font-size") tooSmall(resolveVars(d.value), r, d);
      else if (d.prop === "font") {
        const v = resolveVars(d.value);
        if (/^(inherit|initial|unset|revert)$/i.test(v.trim())) continue;
        // The size is the length before the optional "/line-height".
        const size = (/(?:^|\s)(-?\d*\.?\d+[a-z%]+|xx-small|x-small|small|smaller)(?=\s*\/|\s)/i.exec(v) || [])[1];
        if (size) tooSmall(size, r, d);
      } else if (/^--t-/.test(d.prop) && isRoot(r)) tooSmall(resolveVars(d.value), r, d);
    }
  }
  report(problems, "Text under 16px");
});

test("no overflow-x on html or body", () => {
  const problems = [];
  for (const r of RULES) {
    const onPage = selectorList(r.selector).some(s => /^(html|body)(?![\w-])|:root(?![\w-])/i.test(subjectOf(s)));
    if (!onPage) continue;
    for (const d of r.decls) {
      if (/^overflow(-x|-inline)?$/.test(d.prop)) problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (it hides a page that's too wide instead of fixing it, and breaks position: sticky)`);
    }
  }
  report(problems, "overflow-x on html or body");
});

// =====================================================================

section("fonts and tokens");

test("every @font-face uses font-display: optional, and site.css self-hosts both faces", () => {
  const faces = RULES.filter(r => r.selector === "@font-face");
  const problems = [];
  for (const r of faces) {
    const display = r.decls.find(d => d.prop === "font-display");
    if (!display || display.value.toLowerCase() !== "optional") problems.push(`${r.file}:${r.line}: font-display is ${display ? display.value : "missing"}`);
  }
  report(problems, "@font-face without font-display: optional");
  const srcs = faces.filter(r => r.file === SITE_CSS_FILE).map(r => (r.decls.find(d => d.prop === "src") || {}).value || "");
  assert.ok(srcs.some(s => s.includes('url("/assets/fonts/public-sans-latin-wght-normal.woff2")')), "site.css has no Public Sans face");
  assert.ok(srcs.some(s => s.includes('url("/assets/fonts/red-hat-mono-latin-400-normal.woff2")')), "site.css has no Red Hat Mono face");
  assert.ok(!srcs.some(s => /url\(\s*["']?(https?:)?\/\//.test(s)), "a font from another host");
});

// The rule's every selector must land on the class.
const onlyOn = (r, cls) => selectorList(r.selector).every(s => hasClass(subjectOf(s), cls));

test("--font-id appears only in .id rules", () => {
  const problems = [];
  for (const r of RULES) {
    if (isSiteRoot(r)) continue;
    for (const d of r.decls) {
      if ((d.prop.includes("--font-id") || d.value.includes("--font-id")) && !onlyOn(r, "id")) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
    }
  }
  for (const s of allStrings()) {
    const hit = matchIn(s, /--font-id/);
    if (hit) problems.push(`${hit.at}: ${hit.around}`);
  }
  for (const f of SITE_HTML) htmlLines(f).forEach((l, k) => { if (l.includes("--font-id")) problems.push(`${f}:${k + 1}`); });
  report(problems, "--font-id outside .id (identifiers only: unit ids and pad ids)");
});

test("--buy-* and --kapton* appear outside :root only in .btn-buy rules", () => {
  const problems = [];
  const re = /--(buy|kapton)(?![\w])|--(buy|kapton)-/;
  for (const r of RULES) {
    if (isRoot(r)) continue;
    for (const d of r.decls) {
      if ((re.test(d.prop) || re.test(d.value)) && !onlyOn(r, "btn-buy")) problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
    }
  }
  for (const s of allStrings()) {
    const hit = matchIn(s, re);
    if (hit) problems.push(`${hit.at}: ${hit.around}`);
  }
  report(problems, "Money-button token outside .btn-buy");
});

// =====================================================================

section("borders and decoration");

test("no borders on .index-row, .pf-row or .unit-card rules", () => {
  const problems = [];
  const ROWS = /\.(index-row|pf-row|unit-card)(?:--[\w-]+)?(?![\w-])/;
  for (const r of RULES) {
    if (!selectorList(r.selector).some(s => ROWS.test(subjectOf(s)))) continue;
    for (const d of r.decls) {
      // A line: border, border-top, border-block-end-color, border-image...
      // (corners, border-collapse and border-spacing draw nothing).
      const drawsLine = /^border(-|$)/.test(d.prop) && !/-(radius|collapse|spacing)$/.test(d.prop);
      if (!drawsLine) continue;
      if (/^(0|0px|none|0 none|none 0)$/i.test(d.value.trim())) continue;
      problems.push(`${where(r, d)}: ${d.prop}: ${d.value} (rows and cards are grouped by space, never by rules or boxes)`);
    }
  }
  report(problems, "Border on an index row, portfolio row or unit card");
});

test("no ::before or ::after paints a background", () => {
  const problems = [];
  for (const r of RULES) {
    if (!selectorList(r.selector).some(s => /::?(before|after)\b/i.test(subjectOf(s)))) continue;
    for (const d of r.decls) {
      if (/^background(-color|-image)?$/.test(d.prop) && !/^(none|transparent|initial|unset|inherit)$/i.test(d.value.trim())) {
        problems.push(`${where(r, d)}: ${d.prop}: ${d.value}`);
      }
    }
  }
  report(problems, "Decorative ::before/::after background");
});

test("no .eyebrow rules in site CSS", () => {
  const problems = RULES.filter(r => /\.eyebrow(?![\w-])/.test(r.selector)).map(r => `${r.file}:${r.line} (${r.selector})`);
  report(problems, "Eyebrow style");
});

// =====================================================================

section("copy");

test("site HTML and JS strings: no em dash, arrows, eyebrow, 'actually', formula lines or '2 business days'", () => {
  const problems = [];
  for (const f of SITE_HTML) {
    const lines = htmlLines(f);
    for (const { re, what } of BANNED_COPY) {
      let found = 0;
      lines.forEach((l, k) => { if (re.test(l)) { found++; problems.push(`${f}:${k + 1}: ${what}`); } });
      if (!found && re.test(htmlFlat(f))) problems.push(`${f}: ${what} (across a line break)`);
    }
  }
  for (const s of allStrings()) {
    for (const { re, what } of BANNED_COPY) {
      const hit = matchIn(s, re);
      if (hit) problems.push(`${hit.at}: ${what}: ${hit.around}`);
    }
  }
  report(problems, "Banned copy");
});

test("buyers never see the word 'bench' on a site page", () => {
  const problems = [];
  for (const f of SITE_HTML) {
    const lines = visibleLines(f);
    lines.forEach((l, k) => { if (/\bbench(es)?\b/i.test(l)) problems.push(`${f}:${k + 1}: ${l.trim().slice(0, 100)}`); });
    if (!problems.some(p => p.startsWith(`${f}:`)) && /\bbench(es)?\b/i.test(lines.join(" ").replace(/\s+/g, " "))) {
      problems.push(`${f}: "bench" across a line break`);
    }
  }
  // Copy that JS renders: strings that read as words (they have a space).
  for (const f of SITE_JS) {
    for (const s of JS_STRINGS[f]) {
      if (!/\s/.test(s.value.trim())) continue;
      const hit = matchIn({ ...s, file: f, value: decodeEntities(s.value.replace(/<[^>]*>/g, blank)) }, /\bbench(es)?\b/i);
      if (hit) problems.push(`${hit.at}: ${hit.around}`);
    }
  }
  report(problems, '"bench" in copy a visitor sees (it\'s the workshop\'s word, not the buyer\'s)');
});

// =====================================================================

section("money and returns");

const RATES = [formatMoney(SHIPPING.small.cents), formatMoney(SHIPPING.console.cents)];

test("every $ amount on home, store and shipping is a SHIPPING rate, and both rates appear", () => {
  assert.deepEqual(RATES, ["$6.00", "$18.00"], "the spec's two rates");
  const problems = [];
  for (const f of ["index.html", "store.html", "shipping-returns.html"]) {
    const lines = htmlLines(f);
    const seen = new Set();
    lines.forEach((l, k) => {
      for (const m of l.matchAll(DOLLAR_AMOUNT)) {
        const amount = m[0].replace(/\s+/g, "");
        if (RATES.includes(amount)) seen.add(amount);
        else problems.push(`${f}:${k + 1}: ${m[0]} isn't formatMoney of a SHIPPING value (${RATES.join(" or ")})`);
      }
    });
    for (const rate of RATES) if (!seen.has(rate)) problems.push(`${f}: never states ${rate}`);
  }
  report(problems, "Dollar amounts");
});

test("no '$18'-style amounts anywhere in site HTML or JS strings", () => {
  const problems = [];
  for (const f of SITE_HTML) {
    htmlLines(f).forEach((l, k) => { const m = BARE_DOLLARS.exec(l); if (m) problems.push(`${f}:${k + 1}: ${m[0]}`); });
  }
  for (const s of allStrings()) {
    const hit = matchIn(s, BARE_DOLLARS);
    if (hit) problems.push(`${hit.at}: ${hit.match} in ${hit.around}`);
  }
  report(problems, 'Amount without cents (write it with formatMoney, "$18.00")');
});

test("no 'N days' or 'N-day' outside the exact RETURNS.console sentence", () => {
  assert.ok(RETURNS.console && DAYS_PHRASE.test(RETURNS.console), "RETURNS.console states its window, and the pattern sees it");
  const problems = [];
  for (const f of SITE_HTML) {
    const lines = htmlLines(f);
    lines.forEach((l, k) => { const m = DAYS_PHRASE.exec(withoutReturnsTerm(l)); if (m) problems.push(`${f}:${k + 1}: "${m[0]}"`); });
    if (!problems.some(p => p.startsWith(`${f}:`)) && DAYS_PHRASE.test(withoutReturnsTerm(htmlFlat(f)))) {
      problems.push(`${f}: "${DAYS_PHRASE.exec(withoutReturnsTerm(htmlFlat(f)))[0]}" (across a line break)`);
    }
  }
  for (const s of allStrings()) {
    const hit = matchIn({ ...s, value: withoutReturnsTerm(s.value) }, DAYS_PHRASE);
    if (hit) problems.push(`${hit.at}: "${hit.match}" in ${hit.around}`);
  }
  report(problems, "A day count outside the returns term (state terms only through RETURNS in data/products.js)");
});

// =====================================================================

section("page heads");

for (const f of SITE_HTML) {
  test(`${f}: site.css first, the Public Sans preload, theme-color #ffffff and icon.svg`, () => {
    const head = headOf(f);
    assert.ok(head, `${f} has no <head>`);
    const links = tagsIn(head, "link");
    const sheets = links.filter(a => (a.rel || "").toLowerCase() === "stylesheet");
    assert.ok(sheets.length, `${f}: no stylesheet`);
    assert.match(sheets[0].href || "", /^\/assets\/site\.css(\?v=[\w.-]+)?$/, `${f}: the first stylesheet must be /assets/site.css`);
    assert.ok(links.some(a => (a.rel || "").toLowerCase() === "preload" && a.href === "/assets/fonts/public-sans-latin-wght-normal.woff2"
      && a.as === "font" && a.type === "font/woff2" && "crossorigin" in a), `${f}: no Public Sans preload (as="font" type="font/woff2" crossorigin)`);
    const metas = tagsIn(head, "meta");
    const theme = metas.filter(a => (a.name || "").toLowerCase() === "theme-color");
    assert.equal(theme.length, 1, `${f}: one <meta name="theme-color">`);
    assert.equal(theme[0].content, "#ffffff", `${f}: theme-color`);
    assert.ok(links.some(a => (a.rel || "").toLowerCase() === "icon" && a.href === "/assets/brand/icon.svg"), `${f}: no <link rel="icon" href="/assets/brand/icon.svg">`);
  });
}

test("every page JavaScript renders carries a <noscript> notice at the top of main", () => {
  const problems = [];
  const rendered = new Set(JS_RENDERED);
  for (const f of SITE_HTML) {
    const html = blankHtmlComments(read(f));
    const main = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html) || [, ""])[1];
    // Backstop for new pages: an empty, visible container with an id is
    // where JavaScript puts the page.
    const holes = [...main.matchAll(/<([a-z]+)\b([^>]*)\bid="([^"]+)"([^>]*)>\s*<\/\1>/gi)]
      .filter(m => !/\bhidden\b/.test(m[2] + m[4]) && !APPEND_ONLY_REGIONS.has(m[3]))
      .map(m => m[3]);
    if (holes.length && !rendered.has(f)) problems.push(`${f}: JavaScript fills #${holes.join(", #")}, so the page needs the <noscript> notice (add it to JS_RENDERED here too)`);
    if (rendered.has(f) || holes.length) {
      if (!/<noscript>\s*<p class="notice noscript">/.test(main)) problems.push(`${f}: no <noscript><p class="notice noscript"> in <main>`);
    }
  }
  for (const f of JS_RENDERED) if (!SITE_HTML.includes(f)) problems.push(`${f}: listed as JS-rendered but missing`);
  report(problems, "No-JS notice");
});

// =====================================================================

section("files");

test("both fonts and both licences are present", () => {
  for (const f of ["public-sans-latin-wght-normal.woff2", "red-hat-mono-latin-400-normal.woff2"]) {
    const p = join(ROOT, "assets/fonts", f);
    assert.ok(existsSync(p), `assets/fonts/${f} is missing`);
    assert.equal(readFileSync(p).toString("latin1", 0, 4), "wOF2", `assets/fonts/${f} is not WOFF2`);
  }
  for (const f of ["LICENSE-public-sans.txt", "LICENSE-red-hat-mono.txt"]) {
    const p = join(ROOT, "assets/fonts", f);
    assert.ok(existsSync(p), `assets/fonts/${f} is missing`);
    assert.match(readFileSync(p, "utf8"), /SIL Open Font License, Version 1\.1/, `assets/fonts/${f} isn't the OFL text`);
  }
});

// Everything the site serves as its own: pages, styles, scripts, the
// Functions (league-ify's bundle aside) and the Pages config files.
const SERVED_TEXT = [
  ...SITE_HTML, ...SITE_CSS, ...SITE_JS,
  ...filesUnder("functions", /\.js$/), ...filesUnder("lib", /\.js$/), ...filesUnder("data", /\.js$/),
  ...["_headers", "_redirects", "_routes.json", "robots.txt"].filter(f => existsSync(join(ROOT, f)))
].filter((f, k, all) => all.indexOf(f) === k);

test("pages.css and demo.css are gone, and nothing links them", () => {
  for (const f of ["assets/pages.css", "assets/demo.css"]) assert.ok(!existsSync(join(ROOT, f)), `${f} should be deleted`);
  const problems = [];
  for (const f of SERVED_TEXT) {
    read(f).split("\n").forEach((l, k) => { if (/\b(pages|demo)\.css\b/.test(l)) problems.push(`${f}:${k + 1}: ${l.trim().slice(0, 100)}`); });
  }
  report(problems, "Reference to a retired stylesheet");
});

test("og.png, favicon.svg and apple-touch-icon.png are gone, and nothing references them", () => {
  for (const f of ["assets/brand/og.png", "assets/brand/favicon.svg", "assets/brand/apple-touch-icon.png"]) {
    assert.ok(!existsSync(join(ROOT, f)), `${f} should be deleted (its replacement has a new name, so caches fetch it fresh)`);
  }
  const problems = [];
  for (const f of SERVED_TEXT) {
    read(f).split("\n").forEach((l, k) => {
      if (/(^|[\/"'\s(=])og\.png\b|\bfavicon\.svg\b|\bapple-touch-icon\.png\b/.test(l)) problems.push(`${f}:${k + 1}: ${l.trim().slice(0, 100)}`);
    });
  }
  report(problems, "Reference to a retired brand file (use og-site.png, icon.svg, icon-180.png)");
});

test("the link-preview cards are 1200x630, icon-180 is 180x180", () => {
  for (const f of ["og-site.png", "og-tools.png", "og-portfolio.png"]) {
    assert.deepEqual(pngSize(`assets/brand/${f}`), { width: 1200, height: 630 }, `assets/brand/${f}`);
  }
  assert.deepEqual(pngSize("assets/brand/icon-180.png"), { width: 180, height: 180 }, "assets/brand/icon-180.png");
});

test("icon.svg is drawn only in the ink and paper hexes", () => {
  const svg = read("assets/brand/icon.svg");
  const allowed = ["#1b1b1b", "#ffffff"];
  assert.deepEqual([TOKENS.get("--ink"), TOKENS.get("--paper")], allowed, "the icon's two hexes are --ink and --paper");
  const hexes = [...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(m => m[0].toLowerCase());
  assert.ok(hexes.length, "icon.svg has no colours");
  for (const h of hexes) assert.ok(allowed.includes(h), `icon.svg uses ${h}`);
  for (const h of allowed) assert.ok(hexes.includes(h), `icon.svg doesn't use ${h}`);
  assert.ok(!COLOUR_FN.test(svg), "icon.svg uses a colour function");
  for (const m of svg.matchAll(/\b(fill|stroke|stop-color|color)\s*[=:]\s*"?([^"\s;>]+)/gi)) {
    assert.ok(allowed.includes(m[2].toLowerCase()) || /^none$/i.test(m[2]), `icon.svg: ${m[1]} ${m[2]}`);
  }
  assert.ok(!/gradient|filter|<image\b/i.test(svg), "icon.svg has a gradient, filter or image");
});

await run();

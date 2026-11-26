// npm run check:layout: loads the site's pages in Chromium at phone and
// desktop sizes and measures what the redesign promises (spec §16):
//
//   overflow    document scrollWidth minus innerWidth is 0
//   header      .site-header is 61px tall
//   CLS         buffered layout-shift entries (no recent input) sum to 0.000,
//               3 s after load and after any stubs, at scroll 0
//   font        the smallest visible text outside <canvas> is at least 16px
//   headings    no h1-h3 is larger than the page's h1
//   contrast    the worst text contrast against the first opaque ancestor
//               background is at least 4.5:1 (:disabled controls skipped)
//   CSP         no console message mentions Content Security Policy
//   fold        on /product?id=ro-9001 and ro-9002 at 360x780, 390x844,
//               960x800 and 1280x800, [data-primary-action] ends inside the
//               first viewport. With --units failed the page has no buy
//               action by design (spec §10.3), so there it is the
//               "Couldn't load this unit just now." message that must
//               end inside the first viewport
//   photos      on ro-9001 and ro-9002 at every size, phone landscape
//               (844x390) included, the photo panel and its counter row
//               (.unit-gallery) end inside the first viewport
//   $0.00       /cart never shows "$0.00", not even for a moment
//   nav         with --text-scale: Cart, with its count, shows in full inside
//               the header nav (only Store, Tools and Portfolio may scroll)
//
// And the two themes (dark-spec §12), in every run, --text-scale included,
// in this order after the measurements above (CLS first, at scroll 0):
//   theme       the expected theme is --theme, or --scheme when --theme is
//               auto. html's computed color-scheme is that theme ("light
//               only" when --theme is light: site.css opts a chosen Light out
//               of the browser's auto dark); html
//               [data-theme] is the --theme value (absent for auto); and the
//               first meta[name=theme-color] whose media is absent or matches
//               has the same colour as body's computed background
//   pairs       every assets/**/*-dark.webp and its light partner (the same
//               name without -dark) make a pair. Image requests are recorded
//               from the start; after the measurements the page is scrolled
//               to the bottom in viewport steps and given 500 ms. No request
//               may be for the other theme's member of a pair, and every
//               rendered .for-light/.for-dark img is complete with a
//               naturalWidth. Recording stops here, before print (print shows
//               the light twin, and Chromium then fetches it)
//   ring        (not with --text-scale) on /product?id=ro-9001 and ro-9002 at
//               390x844 and 1280x800, unless --units failed (no photos then):
//               Tab once, focus .strip, and read the two rings' colours from
//               the page (.strip's outline-color, outer; its first .shot img's,
//               inner). They must be at least 3:1 apart. In a 1x12 px
//               screenshot at the strip's top centre, pixels 0-1 are the outer
//               colour and 2-3 the inner (within 8 per channel), and the photo
//               pixel at 8 is at least 3:1 from one of them. Then the same
//               again under emulateMedia({ forcedColors: "active" }), where the
//               rings must still be two colours (CanvasText and Canvas)
//   print       last: emulateMedia({ media: "print" }) with the context's
//               colorScheme left as it is (the device stays dark in a dark
//               run). html's color-scheme is light ("light only" with
//               --theme light), body is rgb(255, 255, 255)
//               with rgb(27, 27, 27) text, every .for-dark is display: none
//               and no .for-light is. Then emulateMedia({ media: null })
//
// --first-paint measures only this, instead of everything above:
//   first paint every *.js and *.mjs request except /assets/theme.js is held
//               back 4000 ms, and the page is opened with waitUntil "commit".
//               Once readyState isn't "loading" and body's background is
//               opaque (site.css applied): .site-header is still empty (no
//               module ran); body's background has relative luminance under
//               0.05 for an expected dark theme or over 0.9 for light, and the
//               h1, if any, is on the other side of 0.5; the theme check
//               above holds; and any .for-light/.for-dark shows only for the
//               expected theme
//
// It serves the repo with scripts/lib/static-server.mjs (random port, the real
// CSP) and answers the data requests in the browser from
// scripts/fixtures/listings.mjs: /api/store/listings after 1000 ms (or 503
// with --units failed), and every /api/store/img/*.jpg with an SVG labelled
// "fixture photo N". /cart is seeded with ro-9001, ro-9002 and ro-9005. The
// drift tester gets a stubbed gamepad (empty for 1000 ms, then one pad with a
// 60-character id) and a click on "Measure rest (2 s)".
//
// Options:
//   --pages a,b,c       paths (default: every page below); "ro-9001" means /product?id=ro-9001
//   --widths WxH,...    viewport sizes (default 320x640,360x780,390x844,1280x800, plus
//                       1440x1600 for / and /store, 960x800 for ro-9001, ro-9002 and
//                       chiptune, and 844x390 for ro-9001 and ro-9002)
//   --units 0,5         listings to serve besides the page's own fixture: numbers or "failed"
//                       (only on pages that fetch listings: /, /store, /product, /cart)
//   --checkout on|off   off: product heads say checkout is off (no STRIPE_SECRET_KEY)
//   --slow-fonts        delay /assets/fonts/* by 2000 ms; CLS must still be 0
//   --text-scale        larger and wider text at 320, 360 and 390, three ways: html
//                       font-size 115%; WCAG 1.4.12 text spacing (line height 1.5,
//                       letter 0.12em, word 0.16em, paragraphs 2em apart); and the
//                       browser's own text size at 200% (default font 32px). Checks
//                       only that the page doesn't overflow and that Cart, with its
//                       count, shows in full inside the header nav
//   --scheme light|dark the device's colour scheme: the context's colorScheme (default light)
//   --theme auto|light|dark
//                       the visitor's footer choice: an init script sets localStorage
//                       dhole_theme_v1 before any page script, or removes it for auto
//                       (default auto: follow the device)
//   --first-paint       measure only the first paint (above), at 390x844 unless --widths
//   --concurrency N     browser contexts at once (default and maximum 4)
//   --root DIR          serve another folder instead of the repo (to test this script)
//
// Needs Playwright (scripts/lib/playwright.mjs):
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run check:layout
// A full run is a few hundred page loads and takes minutes: run it in the
// background for full runs, e.g.
//   npm run check:layout > layout.log 2>&1 &
// Progress goes to stderr, the table to stdout; the header line and the table
// both name the scheme and theme. Exit 0 when everything passes, 1 when any
// check fails, 2 when it can't run. Pages that haven't been migrated to the
// redesign (or to the theme head) yet may fail; it only reports.

import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { ROOT, start } from "./lib/static-server.mjs";
import { loadChromium } from "./lib/playwright.mjs";
import { CART_SEED, fixtureSvg, listingsFor } from "./fixtures/listings.mjs";

const DEFAULT_PAGES = [
  "/", "/store",
  "/product?id=ro-9001", "/product?id=ro-9002", "/product?id=ro-9003", "/product?id=ro-9004",
  "/product?id=ro-9006", "/product?id=ro-9010", "/product?id=ro-9011", "/product?id=ro-9012",
  "/product?id=ro-0000",
  "/cart", "/order-complete", "/checkout-cancelled", "/shipping-returns",
  "/projects", "/projects/drift-tester", "/projects/chiptune", "/projects/discover-cleaner",
  "/portfolio", "/case?id=discover-cleaner", "/log", "/no-such-page"
];
const BASE_WIDTHS = ["320x640", "360x780", "390x844", "1280x800"];
const EXTRA_WIDTHS = {
  "/": ["1440x1600"],
  "/store": ["1440x1600"],
  "/product?id=ro-9001": ["960x800", "844x390"],
  "/product?id=ro-9002": ["960x800", "844x390"],
  "/projects/chiptune": ["960x800"]
};
const TEXT_SCALE_SIZES = ["320x640", "360x780", "390x844"];
// --text-scale's three ways to make text bigger or wider.
const TEXT_MODES = ["115%", "spacing", "200%"];
const TEXT_SPACING_CSS = "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }" +
  " p { margin-bottom: 2em !important; }";
const FOLD_PAGES = new Set(["/product?id=ro-9001", "/product?id=ro-9002"]);
const FOLD_SIZES = new Set(["360x780", "390x844", "960x800", "1280x800"]);
// The photo strip's two focus rings (dark-spec §5.1), on the fold pages.
const RING_SIZES = new Set(["390x844", "1280x800"]);
const FIRST_PAINT_SIZES = ["390x844"];
const LISTING_PATHS = new Set(["/", "/store", "/product", "/cart"]);

const LISTINGS_DELAY_MS = 1000;
const FONT_DELAY_MS = 2000;
const SETTLE_MS = 3000;
const PAD_CONNECT_MS = 1000;
const MEASURE_WAIT_MS = 2600;
const PAIRS_WAIT_MS = 500;
// --first-paint: how long every module is held back.
const MODULE_HOLD_MS = 4000;
const THEME_KEY = "dhole_theme_v1";
const MAX_CONTEXTS = 4;
// 60 characters, like a long real pad.id.
const PAD_ID = "Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)";
if (PAD_ID.length !== 60) throw new Error("PAD_ID must be 60 characters");

const delay = ms => new Promise(ok => setTimeout(ok, ms));

// ---------- options ----------

function usage(problem) {
  if (problem) console.error(`check-layout: ${problem}\n`);
  console.error("Usage: node scripts/check-layout.mjs [--pages a,b] [--widths 390x844,...] [--units 0,5|failed]\n" +
    "         [--checkout on|off] [--slow-fonts] [--text-scale] [--scheme light|dark] [--theme auto|light|dark]\n" +
    "         [--first-paint] [--concurrency N] [--root DIR]\n" +
    "See the header comment of scripts/check-layout.mjs. Run it in the background for full runs.");
  process.exit(problem ? 2 : 0);
}

function normalisePage(p) {
  if (/^ro-\d+$/.test(p)) return `/product?id=${p}`;
  return p.startsWith("/") ? p : `/${p}`;
}

function parseArgs(argv) {
  const opts = { pages: DEFAULT_PAGES, widths: null, units: ["0", "5"], checkout: "on",
    slowFonts: false, textScale: false, scheme: "light", theme: "auto", firstPaint: false,
    concurrency: MAX_CONTEXTS, root: undefined };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => {
      const v = inline !== undefined ? inline : argv[++i];
      if (v === undefined || v === "") usage(`${flag} needs a value`);
      return v;
    };
    const list = () => value().split(",").map(s => s.trim()).filter(Boolean);
    switch (flag) {
      case "--pages": opts.pages = list().map(normalisePage); break;
      case "--widths": opts.widths = list(); break;
      case "--units": opts.units = list(); break;
      case "--checkout": opts.checkout = value(); break;
      case "--slow-fonts": opts.slowFonts = true; break;
      case "--text-scale": opts.textScale = true; break;
      case "--scheme": opts.scheme = value(); break;
      case "--theme": opts.theme = value(); break;
      case "--first-paint": opts.firstPaint = true; break;
      case "--concurrency": opts.concurrency = Number(value()); break;
      case "--root": opts.root = resolve(value()); break;
      case "--help": case "-h": usage(); break;
      default: usage(`unknown option ${argv[i]}`);
    }
  }
  if (!["on", "off"].includes(opts.checkout)) usage("--checkout must be on or off");
  if (!["light", "dark"].includes(opts.scheme)) usage("--scheme must be light or dark");
  if (!["auto", "light", "dark"].includes(opts.theme)) usage("--theme must be auto, light or dark");
  if (opts.firstPaint && opts.textScale) usage("--first-paint and --text-scale can't be combined");
  for (const w of opts.widths || []) if (!/^\d{3,4}x\d{3,4}$/.test(w)) usage(`bad size ${w} (want WxH, e.g. 390x844)`);
  for (const u of opts.units) if (u !== "failed" && !/^\d+$/.test(u)) usage(`bad --units value ${u} (want numbers or "failed")`);
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) usage("--concurrency must be a whole number");
  opts.concurrency = Math.min(opts.concurrency, MAX_CONTEXTS);
  // The theme every check expects: the visitor's choice, else the device's.
  opts.expected = opts.theme === "auto" ? opts.scheme : opts.theme;
  // html's computed color-scheme for it, on screen and in print. A chosen
  // Light is "only light" (site.css: Chrome's auto dark leaves it alone),
  // which Chromium computes as "light only".
  opts.computedScheme = opts.theme === "light" ? "light only" : opts.expected;
  opts.printScheme = opts.theme === "light" ? "light only" : "light";
  return opts;
}

// ---------- the runs ----------

const pathOf = page => page.split("?")[0];

function jobsFor(opts) {
  const jobs = [];
  for (const page of opts.pages) {
    const path = pathOf(page);
    let sizes = opts.widths || [...BASE_WIDTHS, ...(EXTRA_WIDTHS[page] || [])];
    if (opts.textScale && !opts.widths) sizes = TEXT_SCALE_SIZES;
    if (opts.firstPaint && !opts.widths) sizes = FIRST_PAINT_SIZES;
    const listings = LISTING_PATHS.has(path);
    const own = path === "/product" ? [new URLSearchParams(page.split("?")[1] || "").get("id")].filter(Boolean)
      : path === "/cart" ? CART_SEED : [];
    for (const size of sizes) {
      // A first paint comes before any module runs, so the listings never
      // matter there: one run per page and size.
      for (const units of listings && !opts.firstPaint ? opts.units : [null]) for (const text of opts.textScale ? TEXT_MODES : [null]) {
        jobs.push({
          page, size, units, own, text,
          cart: path === "/cart",
          drift: path === "/projects/drift-tester",
          fold: FOLD_PAGES.has(page) && FOLD_SIZES.has(size) && !opts.textScale,
          photos: FOLD_PAGES.has(page) && !opts.textScale,
          // --units failed shows no photos by design, so no strip to focus.
          ring: FOLD_PAGES.has(page) && RING_SIZES.has(size) && !opts.textScale && units !== "failed"
        });
      }
    }
  }
  return jobs;
}

function listingsBody(job) {
  if (job.units === "failed") return null;
  return { listings: listingsFor({ own: job.own, count: job.units === null ? 0 : Number(job.units) }) };
}

// Runs in every document before the page's own scripts: records layout
// shifts with their sources, and (on /cart) the first moment "$0.00" shows.
function observeInit() {
  const L = window.__layout = { shifts: [], zeroMoney: null };
  const name = n => {
    if (!n || n.nodeType !== 1) return n && n.nodeName ? n.nodeName.toLowerCase() : "?";
    let s = n.tagName.toLowerCase();
    if (n.id) s += `#${n.id}`;
    if (n.classList && n.classList.length) s += `.${[...n.classList].slice(0, 2).join(".")}`;
    return s;
  };
  const box = r => (r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : "");
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        L.shifts.push({
          value: e.value, input: e.hadRecentInput, t: Math.round(e.startTime),
          sources: (e.sources || []).map(s => `${name(s.node)} ${box(s.previousRect)} -> ${box(s.currentRect)}`)
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch { /* no layout-shift support */ }
  if (location.pathname === "/cart") {
    const scan = () => {
      if (L.zeroMoney === null && document.body && document.body.textContent.includes("$0.00")) {
        L.zeroMoney = Math.round(performance.now());
      }
    };
    try { new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true }); } catch { /* ignore */ }
  }
}

function seedCartInit(ids) {
  try { localStorage.setItem("dhole_store_cart_v1", JSON.stringify(ids.map(id => ({ id, qty: 1 })))); } catch { /* opaque origin */ }
}

// --theme: the visitor's footer choice, stored before any page script runs
// (assets/theme.js reads it in the head), or removed for auto.
function themeInit({ key, theme }) {
  try {
    if (theme === "auto") localStorage.removeItem(key);
    else localStorage.setItem(key, theme);
  } catch { /* opaque origin */ }
}

// Every theme pair under assets/ (dark-spec §7): a -dark.webp file and its
// light partner, the same name without -dark, as site paths.
function themePairs(root) {
  const pairs = [];
  const walk = dir => {
    let entries;
    try { entries = readdirSync(join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const d of entries) {
      const rel = `${dir}/${d.name}`;
      if (d.isDirectory()) walk(rel);
      else if (d.isFile() && /-dark\.webp$/.test(d.name)) pairs.push({ dark: `/${rel}`, light: `/${rel.replace(/-dark\.webp$/, ".webp")}` });
    }
  };
  walk("assets");
  return pairs;
}

// ---------- colours, in Node ----------

const rgbOf = c => {
  const m = /rgba?\(([^)]+)\)/.exec(c || "");
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const hexRgb = h => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  const x = m[1].length === 3 ? [...m[1]].map(c => c + c).join("") : m[1];
  return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
};
const relLum = ({ r, g, b }) => {
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratioOf = (x, y) => { const [a, b] = [relLum(x), relLum(y)].sort((m, n) => n - m); return (a + 0.05) / (b + 0.05); };
const sameRgb = (x, y, tol = 0) => x && y && ["r", "g", "b"].every(k => Math.abs(x[k] - y[k]) <= tol);
const rgbText = c => (c ? `rgb(${c.r}, ${c.g}, ${c.b})` : "none");

// Pixels of a Chromium screenshot: an 8-bit RGB or RGBA, non-interlaced PNG.
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`unexpected PNG (depth ${depth}, colour type ${type}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, at: (x, y) => { const i = y * stride + x * bpp; return { r: out[i], g: out[i + 1], b: out[i + 2], a: 1 }; } };
}

// ---------- the theme checks, in the page ----------

// html's color-scheme and data-theme, the active theme-color meta and body's
// colours, and which theme-paired pictures show.
function themeState() {
  const de = document.documentElement;
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const active = metas.find(m => { const q = m.getAttribute("media"); return !q || window.matchMedia(q).matches; });
  const shown = sel => [...document.querySelectorAll(sel)].filter(e => getComputedStyle(e).display !== "none").length;
  const body = document.body;
  const h1 = document.querySelector("h1");
  const header = document.querySelector(".site-header");
  return {
    readyState: document.readyState,
    scheme: getComputedStyle(de).colorScheme,
    attr: de.getAttribute("data-theme"),
    meta: active ? active.getAttribute("content") : null,
    bg: body ? getComputedStyle(body).backgroundColor : null,
    fg: body ? getComputedStyle(body).color : null,
    h1: h1 ? getComputedStyle(h1).color : null,
    headerEmpty: header ? header.children.length === 0 && !header.textContent.trim() : null,
    device: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    print: window.matchMedia("print").matches,
    pairs: {
      light: document.querySelectorAll(".for-light").length, dark: document.querySelectorAll(".for-dark").length,
      lightShown: shown(".for-light"), darkShown: shown(".for-dark")
    }
  };
}

// What the theme check finds wrong in a themeState(), or [].
function themeProblems(t, opts) {
  const out = [];
  if (t.scheme !== opts.computedScheme) out.push(`html's color-scheme is "${t.scheme}", expected "${opts.computedScheme}"`);
  const attr = opts.theme === "auto" ? null : opts.theme;
  if (t.attr !== attr) out.push(`html[data-theme] is ${t.attr === null ? "absent" : `"${t.attr}"`}, expected ${attr === null ? "absent" : `"${attr}"`}`);
  const meta = hexRgb(t.meta), bg = rgbOf(t.bg);
  if (!meta) out.push(`no active theme-color meta with a hex colour (found ${t.meta === null ? "none" : `"${t.meta}"`})`);
  else if (!sameRgb(meta, bg)) out.push(`the active theme-color is ${t.meta}, but body's background is ${t.bg}`);
  return out;
}

// Scrolls to the bottom in viewport steps, so lazy images load.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(1, window.innerHeight);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(ok => setTimeout(ok, 50));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}

// The photo strip's two rings, as configured and then under forced colours.
async function ringCheck(page) {
  const passes = [];
  for (const forced of [false, true]) {
    const label = forced ? "forced colours" : "normal";
    const problems = [];
    let seen = null;
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const strip = document.querySelector(".strip");
        if (!strip) return null;
        strip.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        const img = strip.querySelector(".shot img");
        const r = strip.getBoundingClientRect();
        return {
          focused: document.activeElement === strip && strip.matches(":focus-visible"),
          outer: getComputedStyle(strip).outlineColor,
          inner: img ? getComputedStyle(img).outlineColor : null,
          x: Math.floor(r.left + r.width / 2), y: Math.round(r.top), top: r.top
        };
      });
      if (!info) problems.push("no .strip");
      else {
        const outer = rgbOf(info.outer), inner = rgbOf(info.inner);
        if (!info.focused) problems.push(".strip isn't focused with :focus-visible after Tab and focus()");
        if (!outer || !inner) problems.push(`ring colours unreadable (outer ${info.outer}, inner ${info.inner})`);
        else {
          const apart = ratioOf(outer, inner);
          if (apart < 3) problems.push(`the two rings are only ${apart.toFixed(2)}:1 apart (outer ${info.outer}, inner ${info.inner})`);
          const shot = decodePng(await page.screenshot({ clip: { x: info.x, y: info.y, width: 1, height: 12 } }));
          const px = k => shot.at(0, k);
          for (const k of [0, 1]) if (!sameRgb(px(k), outer, 8)) problems.push(`pixel ${k} from the strip's top is ${rgbText(px(k))}, not the outer ring ${info.outer}`);
          for (const k of [2, 3]) if (!sameRgb(px(k), inner, 8)) problems.push(`pixel ${k} from the strip's top is ${rgbText(px(k))}, not the inner ring ${info.inner}`);
          const photo = px(8);
          const best = Math.max(ratioOf(photo, outer), ratioOf(photo, inner));
          if (best < 3) problems.push(`the photo pixel at 8 px (${rgbText(photo)}) is under 3:1 from both rings (best ${best.toFixed(2)}:1)`);
          seen = { outer: info.outer, inner: info.inner, photo: rgbText(photo), apart: apart.toFixed(2) };
        }
      }
    } catch (err) {
      problems.push(`failed: ${String(err && err.message || err).split("\n")[0]}`);
    } finally {
      if (forced) await page.emulateMedia({ forcedColors: null });
    }
    passes.push({ label, ...seen, problems });
  }
  return passes;
}

// Print, last in every run: the light tokens whatever the screen shows.
async function printCheck(page) {
  await page.emulateMedia({ media: "print" });
  try {
    return await page.evaluate(themeState);
  } finally {
    await page.emulateMedia({ media: null });
  }
}

function printProblems(t, opts) {
  const out = [];
  if (!t.print) out.push("print media isn't applied");
  if (t.device !== opts.scheme) out.push(`the device reads ${t.device} under print, not ${opts.scheme}`);
  if (t.scheme !== opts.printScheme) out.push(`html's color-scheme is "${t.scheme}" in print, expected "${opts.printScheme}"`);
  if (t.bg !== "rgb(255, 255, 255)") out.push(`body's background is ${t.bg} in print`);
  if (t.fg !== "rgb(27, 27, 27)") out.push(`body's text is ${t.fg} in print`);
  if (t.pairs.darkShown) out.push(`${t.pairs.darkShown} .for-dark shown in print`);
  if (t.pairs.lightShown !== t.pairs.light) out.push(`${t.pairs.light - t.pairs.lightShown} .for-light hidden in print`);
  return out;
}

function textScaleInit({ mode, spacingCss }) {
  const apply = () => {
    if (!document.documentElement) return false;
    if (mode === "115%") {
      document.documentElement.style.setProperty("font-size", "115%", "important");
    } else {
      const style = document.createElement("style");
      style.textContent = spacingCss;
      document.documentElement.appendChild(style);
    }
    return true;
  };
  if (!apply()) {
    new MutationObserver((_, o) => { if (apply()) o.disconnect(); }).observe(document, { childList: true });
  }
}

// navigator.getGamepads is empty for the first second, then one connected pad.
function gamepadInit({ padId, connectMs }) {
  const pad = {
    id: padId, index: 0, connected: true, mapping: "standard", timestamp: 0,
    axes: [0.01, -0.02, 0.003, 0.004],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: null
  };
  let live = false;
  const getGamepads = function getGamepads() {
    if (!live) return [null, null, null, null];
    pad.timestamp = performance.now();
    return [pad, null, null, null];
  };
  try { Object.defineProperty(Navigator.prototype, "getGamepads", { value: getGamepads, configurable: true, writable: true }); } catch { /* ignore */ }
  try { Object.defineProperty(navigator, "getGamepads", { value: getGamepads, configurable: true, writable: true }); } catch { /* ignore */ }
  setTimeout(() => {
    live = true;
    const ev = new Event("gamepadconnected");
    Object.defineProperty(ev, "gamepad", { value: pad });
    window.dispatchEvent(ev);
  }, connectMs);
}

// Runs in the page after it has settled. Returns the raw measurements.
function measure({ fold, failed, photos }) {
  const out = {};
  const de = document.documentElement;
  out.overflow = de.scrollWidth - window.innerWidth;
  out.viewportH = window.innerHeight;

  const header = document.querySelector(".site-header");
  out.header = header ? Math.round(header.getBoundingClientRect().height * 100) / 100 : null;

  // How much of Cart (and its count) shows: the part inside both the nav's
  // box and the viewport, as a share of the link's width.
  const cart = document.querySelector(".site-nav .cart-link");
  const nav = document.querySelector(".site-nav");
  if (cart && nav) {
    const c = cart.getBoundingClientRect(), n = nav.getBoundingClientRect();
    const left = Math.max(c.left, n.left, 0), right = Math.min(c.right, n.right, window.innerWidth);
    out.cart = { shown: c.width ? Math.max(0, right - left) / c.width : 0, text: cart.textContent.trim() };
  } else {
    out.cart = null;
  }

  const L = window.__layout || { shifts: [], zeroMoney: null };
  const counted = L.shifts.filter(s => !s.input);
  out.cls = counted.reduce((sum, s) => sum + s.value, 0);
  out.shifts = counted.slice(0, 4);
  out.zeroMoney = L.zeroMoney;

  const describe = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) s += `.${cls.join(".")}`;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return text ? `${s} "${text}"` : s;
  };
  const visible = el => {
    if (el.closest("canvas, noscript, script, style, template")) return false;
    if (!el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };

  // Text-bearing elements.
  const els = new Set();
  const walker = document.createTreeWalker(document.body || de, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue.trim() && n.parentElement) els.add(n.parentElement);
  }
  const shown = [...els].filter(visible);

  // Smallest text, including what form controls display.
  let minFont = null;
  const controls = [...document.querySelectorAll("input, select, textarea")]
    .filter(el => !/^(hidden|range|checkbox|radio|color|file|image)$/i.test(el.type || "") && visible(el));
  for (const el of [...shown, ...controls]) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (minFont === null || size < minFont.size) minFont = { size, at: describe(el) };
  }
  out.minFont = minFont;

  // Headings against the page's h1.
  const heads = [...document.querySelectorAll("h1, h2, h3")].filter(visible);
  const h1 = heads.find(h => h.tagName === "H1");
  out.h1 = h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
  out.bigHeadings = h1
    ? heads.filter(h => parseFloat(getComputedStyle(h).fontSize) > out.h1 + 0.01)
        .map(h => `${describe(h)} ${getComputedStyle(h).fontSize}`)
    : [];

  // Contrast (WCAG 2.x) against the first opaque ancestor background.
  const parse = c => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((m, n) => n - m); return (a + 0.05) / (b + 0.05); };
  const bgOf = el => {
    for (let e = el; e; e = e.parentElement) {
      const bg = parse(getComputedStyle(e).backgroundColor);
      if (bg && bg.a >= 1) return bg;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  let worst = null;
  let unparsed = 0;
  for (const el of shown) {
    if (el.closest(":disabled")) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) { unparsed++; continue; }
    let alpha = fg.a;
    for (let e = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
    if (alpha <= 0) continue;
    const bg = bgOf(el);
    const mix = k => alpha * fg[k] + (1 - alpha) * bg[k];
    const r = ratio({ r: mix("r"), g: mix("g"), b: mix("b") }, bg);
    if (worst === null || r < worst.ratio) worst = { ratio: r, at: describe(el), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})` };
  }
  out.contrast = worst;
  out.unparsedColours = unparsed;

  if (fold) {
    const a = document.querySelector(failed ? ".unit--pending .panel-msg" : "[data-primary-action]");
    if (a) {
      const r = a.getBoundingClientRect();
      out.fold = { bottom: Math.round((r.bottom + window.scrollY) * 10) / 10, at: describe(a) };
    } else {
      out.fold = { bottom: null };
    }
  }
  if (photos) {
    const g = document.querySelector(".unit-gallery");
    out.photos = { bottom: g ? Math.round((g.getBoundingClientRect().bottom + window.scrollY) * 10) / 10 : null };
  }
  return out;
}

async function runJob(browser, base, job, opts) {
  const [width, height] = job.size.split("x").map(Number);
  const result = { ...job, failures: [], notes: [], m: null, http: null };
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: opts.scheme });
  try {
    const body = listingsBody(job);
    await context.route("**/api/store/listings*", async route => {
      await delay(LISTINGS_DELAY_MS);
      try {
        if (!body) {
          await route.fulfill({ status: 503, contentType: "application/json",
            body: JSON.stringify({ error: "The store's live stock isn't available right now." }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        }
      } catch { /* the page is gone */ }
    });
    await context.route("**/api/store/img/**", async route => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      try { await route.fulfill({ status: 200, contentType: "image/svg+xml", body: fixtureSvg(name) }); } catch { /* gone */ }
    });
    if (opts.slowFonts) {
      await context.route("**/assets/fonts/**", async route => {
        await delay(FONT_DELAY_MS);
        try { await route.continue(); } catch { /* gone */ }
      });
    }
    await context.addInitScript(observeInit);
    await context.addInitScript(themeInit, { key: THEME_KEY, theme: opts.theme });
    if (job.cart) await context.addInitScript(seedCartInit, CART_SEED);
    if (job.text === "115%" || job.text === "spacing") {
      await context.addInitScript(textScaleInit, { mode: job.text, spacingCss: TEXT_SPACING_CSS });
    }
    if (job.drift) await context.addInitScript(gamepadInit, { padId: PAD_ID, connectMs: PAD_CONNECT_MS });

    const page = await context.newPage();
    if (job.text === "200%") {
      // The browser's own text-size setting: every rem and em scales from it.
      const cdp = await context.newCDPSession(page);
      await cdp.send("Page.enable");
      await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32, fixed: 26 } });
    }
    const csp = [];
    page.on("console", msg => { if (/content[\s-]security[\s-]policy/i.test(msg.text())) csp.push(msg.text()); });
    page.on("pageerror", err => result.notes.push(`page error: ${String(err && err.message || err).split("\n")[0]}`));
    // Requests for either member of a theme pair, until the pairs check ends.
    const pairRequests = [];
    let recording = true;
    page.on("request", req => {
      if (!recording) return;
      const path = new URL(req.url()).pathname;
      if (PAIR_PATHS.has(path)) pairRequests.push(path);
    });

    const response = await page.goto(base + job.page, { waitUntil: "load", timeout: 30000 });
    result.http = response ? response.status() : null;
    const loadedAt = Date.now();

    if (job.drift) {
      const button = page.getByRole("button", { name: "Measure rest (2 s)", exact: true });
      let clicked = false;
      try {
        await button.waitFor({ state: "visible", timeout: 5000 });
        const until = Date.now() + PAD_CONNECT_MS + 4000;
        while (!(await button.isEnabled()) && Date.now() < until) await delay(100);
        if (await button.isEnabled()) {
          await button.click();
          clicked = true;
          await delay(MEASURE_WAIT_MS);
        }
      } catch { /* reported below */ }
      if (!clicked) result.failures.push("drift: no enabled 'Measure rest (2 s)' button after the pad connected");
    }

    const wait = loadedAt + SETTLE_MS - Date.now();
    if (wait > 0) await delay(wait);
    await page.evaluate(() => window.scrollTo(0, 0));
    result.m = await page.evaluate(measure, { fold: job.fold, failed: job.units === "failed", photos: job.photos });
    result.m.csp = csp;

    // The two themes (dark-spec §12): theme, pairs, ring, then print last.
    result.m.theme = await page.evaluate(themeState);
    await scrollThrough(page);
    await delay(PAIRS_WAIT_MS);
    const images = await page.evaluate(() => [...document.querySelectorAll(".for-light img, .for-dark img, img.for-light, img.for-dark")]
      .filter(img => img.getClientRects().length)
      .map(img => ({ src: img.currentSrc || img.src, ok: img.complete && img.naturalWidth > 0 })));
    recording = false;
    const wrong = new Set(PAIRS.map(p => (opts.expected === "dark" ? p.light : p.dark)));
    result.m.pairs = { images, wrong: [...new Set(pairRequests.filter(p => wrong.has(p)))], requested: pairRequests.length };
    if (job.ring) result.m.ring = await ringCheck(page);
    result.m.print = await printCheck(page);
  } catch (err) {
    result.failures.push(`run failed: ${String(err && err.message || err).split("\n")[0]}`);
  } finally {
    await context.close().catch(() => {});
  }
  judge(result, opts);
  return result;
}

// --first-paint: modules held back, so what shows is the head's work alone
// (theme.js and site.css).
async function runFirstPaint(browser, base, job, opts) {
  const [width, height] = job.size.split("x").map(Number);
  const result = { ...job, failures: [], notes: [], m: null, http: null };
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: opts.scheme });
  try {
    await context.addInitScript(themeInit, { key: THEME_KEY, theme: opts.theme });
    await context.route(url => /\.m?js$/.test(url.pathname) && !url.pathname.startsWith("/assets/theme.js"), async route => {
      await delay(MODULE_HOLD_MS);
      try { await route.continue(); } catch { /* the page is gone */ }
    });
    const page = await context.newPage();
    const csp = [];
    page.on("console", msg => { if (/content[\s-]security[\s-]policy/i.test(msg.text())) csp.push(msg.text()); });
    const started = Date.now();
    const response = await page.goto(base + job.page, { waitUntil: "commit", timeout: 30000 });
    result.http = response ? response.status() : null;
    await page.waitForFunction(() => {
      if (document.readyState === "loading" || !document.body) return false;
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(document.body).backgroundColor);
      const p = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : [];
      return p.length >= 3 && (p.length < 4 || p[3] >= 1);
    }, null, { timeout: MODULE_HOLD_MS - 500 });
    result.m = { first: await page.evaluate(themeState), after: Date.now() - started, csp };
  } catch (err) {
    result.failures.push(`run failed: ${String(err && err.message || err).split("\n")[0]}`);
  } finally {
    await context.close().catch(() => {});
  }
  judgeFirstPaint(result, opts);
  return result;
}

function judgeFirstPaint(r, opts) {
  const t = r.m && r.m.first;
  if (!t) return;
  const fail = msg => r.failures.push(`first paint: ${msg}`);
  if (t.headerEmpty !== true) fail(t.headerEmpty === null ? "no .site-header" : ".site-header was already filled: a module ran before this measurement");
  const bg = rgbOf(t.bg), h1 = rgbOf(t.h1);
  const dark = opts.expected === "dark";
  const lum = bg ? relLum(bg) : null;
  if (lum === null) fail(`body's background is ${t.bg}`);
  else if (dark ? !(lum < 0.05) : !(lum > 0.9)) fail(`body's background ${t.bg} has luminance ${lum.toFixed(3)}, expected ${dark ? "under 0.05" : "over 0.9"} for ${opts.expected}`);
  if (h1 && (dark ? !(relLum(h1) > 0.5) : !(relLum(h1) < 0.5))) fail(`the h1 is ${t.h1}, not ${dark ? "light" : "dark"} text on the ${opts.expected} page`);
  for (const p of themeProblems(t, opts)) fail(p);
  const p = t.pairs;
  if (p.light || p.dark) {
    const want = dark ? { light: 0, dark: p.dark } : { light: p.light, dark: 0 };
    if (p.lightShown !== want.light || p.darkShown !== want.dark) fail(`pairs show ${p.lightShown} .for-light and ${p.darkShown} .for-dark in ${opts.expected}`);
  }
  if (r.m.csp.length) fail(`CSP: ${r.m.csp.length} console message(s), first: ${r.m.csp[0].slice(0, 200)}`);
}

// ---------- pass or fail ----------

function judge(r, opts) {
  const m = r.m;
  if (!m) return;
  const fail = msg => r.failures.push(msg);
  if (m.overflow > 0) fail(`overflow: scrollWidth is ${m.overflow}px wider than the viewport`);
  if (m.theme) for (const p of themeProblems(m.theme, opts)) fail(`theme: ${p}`);
  if (m.pairs) {
    for (const p of m.pairs.wrong) fail(`pairs: ${p} was requested, but the ${opts.expected} theme shows its twin`);
    for (const img of m.pairs.images) if (!img.ok) fail(`pairs: ${img.src} is shown but didn't load`);
  }
  if (m.print) for (const p of printProblems(m.print, opts)) fail(`print: ${p}`);
  if (opts.textScale) {
    if (m.cart && m.cart.shown < 0.999) fail(`nav: only ${Math.round(m.cart.shown * 100)}% of "${m.cart.text}" shows in the header (${r.text})`);
    return;
  }
  if (m.header === null) fail("header: no .site-header");
  else if (Math.abs(m.header - 61) > 0.01) fail(`header: .site-header is ${m.header}px, not 61`);
  if (m.cls >= 0.0005) {
    const first = m.shifts.map(s => `${s.value.toFixed(3)} at ${s.t} ms: ${s.sources.join("; ") || "no source"}`).join(" | ");
    fail(`CLS ${m.cls.toFixed(3)} (${first})`);
  }
  if (m.minFont && m.minFont.size < 15.99) fail(`font: ${m.minFont.size}px text at ${m.minFont.at}`);
  if (m.h1 === null) fail("headings: no visible h1");
  for (const h of m.bigHeadings) fail(`headings: larger than the ${m.h1}px h1: ${h}`);
  if (m.contrast && m.contrast.ratio < 4.5) {
    fail(`contrast ${m.contrast.ratio.toFixed(2)}:1 at ${m.contrast.at} (${m.contrast.fg} on ${m.contrast.bg})`);
  }
  if (m.csp.length) fail(`CSP: ${m.csp.length} console message(s), first: ${m.csp[0].slice(0, 200)}`);
  if (r.fold) {
    // A failed listings load shows the failure message and no buy action.
    const target = r.units === "failed" ? "the failure message (.panel-msg)" : "[data-primary-action]";
    if (m.fold.bottom === null) fail(`fold: no ${target}`);
    else if (m.fold.bottom > m.viewportH) fail(`fold: ${target} ends at y${m.fold.bottom}, below the ${m.viewportH}px viewport`);
  }
  if (r.photos) {
    if (m.photos.bottom === null) fail("photos: no .unit-gallery");
    else if (m.photos.bottom > m.viewportH) fail(`photos: the photo panel and counter row end at y${m.photos.bottom}, below the ${m.viewportH}px viewport`);
  }
  if (r.cart && m.zeroMoney !== null) fail(`$0.00 appeared on /cart at ${m.zeroMoney} ms`);
  if (r.ring) {
    if (!m.ring) fail("ring: not measured");
    else for (const pass of m.ring) for (const p of pass.problems) fail(`ring (${pass.label}): ${p}`);
  }
}

// ---------- output ----------

const schemeTheme = opts => `${opts.scheme}/${opts.theme}`;
const verdict = (r, prefix) => (r.failures.some(f => f.startsWith(prefix)) ? "FAIL" : "ok");

function row(r, opts) {
  const m = r.m;
  const dash = "-";
  const scaled = opts.textScale;
  const cell = (cond, text) => (m && cond ? text : dash);
  if (opts.firstPaint) {
    const t = m && m.first;
    return [r.page, r.size, schemeTheme(opts), r.http ?? dash,
      t ? `${verdict(r, "first paint")} (${t.readyState}, ${t.bg})` : dash, r.failures.length ? "FAIL" : "ok"];
  }
  const ring = m && m.ring ? m.ring.map(p => `${p.label === "normal" ? "" : "forced "}${p.problems.length ? "FAIL" : "ok"}`).join(" / ") : dash;
  return [
    r.page,
    r.size,
    schemeTheme(opts),
    r.units === null ? dash : r.units,
    r.text || dash,
    r.http ?? dash,
    cell(true, String(Math.max(0, m ? m.overflow : 0))),
    cell(!scaled, m && m.header !== null ? String(m.header) : "none"),
    cell(scaled && m && m.cart, m && m.cart ? `${Math.round(m.cart.shown * 100)}%` : ""),
    cell(!scaled, m ? m.cls.toFixed(3) : ""),
    cell(!scaled && m && m.minFont, m && m.minFont ? String(Math.round(m.minFont.size * 10) / 10) : ""),
    cell(!scaled, m && m.h1 === null ? "no h1" : m && m.bigHeadings.length ? "FAIL" : "ok"),
    cell(!scaled && m && m.contrast, m && m.contrast ? m.contrast.ratio.toFixed(2) : ""),
    cell(!scaled, m ? String(m.csp.length) : ""),
    r.fold && m && m.fold ? (m.fold.bottom === null ? "none" : `${m.fold.bottom}/${m.viewportH}`) : dash,
    r.photos && m && m.photos ? (m.photos.bottom === null ? "none" : `${m.photos.bottom}/${m.viewportH}`) : dash,
    cell(m && m.theme, verdict(r, "theme")),
    cell(m && m.pairs, m && m.pairs ? `${verdict(r, "pairs")} (${m.pairs.images.length} shown)` : ""),
    r.ring ? ring : dash,
    cell(m && m.print, verdict(r, "print")),
    r.failures.length ? "FAIL" : "ok"
  ];
}

function printTable(results, opts) {
  const head = opts.firstPaint
    ? ["page", "size", "scheme/theme", "http", "first paint", "result"]
    : ["page", "size", "scheme/theme", "units", "text", "http", "overflow", "header", "cart", "CLS", "min font", "headings", "contrast", "CSP", "fold", "photos", "theme", "pairs", "ring", "print", "result"];
  const rows = [head, ...results.map(r => row(r, opts).map(String))];
  const widths = head.map((_, i) => Math.max(...rows.map(cells => cells[i].length)));
  const line = cells => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(rows[0]));
  console.log(widths.map(w => "-".repeat(w)).join("  "));
  for (const cells of rows.slice(1)) console.log(line(cells));
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------- main ----------

const opts = parseArgs(process.argv.slice(2));
const jobs = jobsFor(opts);
const PAIRS = themePairs(opts.root || ROOT);
const PAIR_PATHS = new Set(PAIRS.flatMap(p => [p.light, p.dark]));
if (!jobs.length) usage("nothing to run");

let chromium;
try {
  chromium = await loadChromium();
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const server = await start({ checkout: opts.checkout, root: opts.root });
let browser;
try {
  browser = await chromium.launch();
} catch (err) {
  await server.close();
  console.error(`check-layout: Chromium didn't start: ${String(err.message).split("\n")[0]}`);
  process.exit(2);
}

const t0 = Date.now();
console.error(`check-layout: ${jobs.length} runs on ${server.url}, scheme ${opts.scheme}, theme ${opts.theme}` +
  ` (expecting ${opts.expected}), checkout ${opts.checkout}` +
  `${opts.slowFonts ? ", fonts delayed 2 s" : ""}${opts.textScale ? ", text at 115%, spaced and at 200% (overflow, Cart, theme, pairs and print only)" : ""}` +
  `${opts.firstPaint ? `, first paint only (modules held ${MODULE_HOLD_MS} ms)` : ""}, ${PAIRS.length} theme pair(s), ` +
  `${opts.concurrency} at a time`);
let done = 0;
const results = await pool(jobs, opts.concurrency, async job => {
  const r = opts.firstPaint ? await runFirstPaint(browser, server.url, job, opts) : await runJob(browser, server.url, job, opts);
  done++;
  console.error(`[${done}/${jobs.length}] ${r.failures.length ? "FAIL" : "ok  "} ${job.page} ${job.size}` +
    `${job.units === null ? "" : ` units ${job.units}`}${job.text ? ` text ${job.text}` : ""}`);
  return r;
});
await browser.close();
await server.close();

console.log("");
printTable(results, opts);

const failed = results.filter(r => r.failures.length);
const noted = results.filter(r => r.notes.length);
if (failed.length) {
  console.log("\nFailures:");
  for (const r of failed) {
    console.log(`\n${r.page} ${r.size}${r.units === null ? "" : ` units ${r.units}`}${r.text ? ` text ${r.text}` : ""}:`);
    for (const f of r.failures) console.log(`  - ${f}`);
  }
}
if (noted.length) {
  console.log("\nNotes (not failures):");
  for (const r of noted) {
    console.log(`${r.page} ${r.size}${r.units === null ? "" : ` units ${r.units}`}: ${[...new Set(r.notes)].join("; ")}`);
  }
}
console.log(`\n${results.length - failed.length} of ${results.length} runs passed in ${Math.round((Date.now() - t0) / 1000)} s ` +
  `(scheme ${opts.scheme}, theme ${opts.theme}, checkout ${opts.checkout}${opts.slowFonts ? ", slow fonts" : ""}` +
  `${opts.textScale ? ", text scale" : ""}${opts.firstPaint ? ", first paint" : ""}).`);
process.exit(failed.length ? 1 : 0);

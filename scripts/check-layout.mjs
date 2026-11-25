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
//               first viewport
//   $0.00       /cart never shows "$0.00", not even for a moment
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
//                       1440x1600 for / and /store and 960x800 for ro-9001, ro-9002 and chiptune)
//   --units 0,5         listings to serve besides the page's own fixture: numbers or "failed"
//                       (only on pages that fetch listings: /, /store, /product, /cart)
//   --checkout on|off   off: product heads say checkout is off (no STRIPE_SECRET_KEY)
//   --slow-fonts        delay /assets/fonts/* by 2000 ms; CLS must still be 0
//   --text-scale        html font-size 115% at 360 and 390; checks only document overflow
//   --concurrency N     browser contexts at once (default and maximum 4)
//   --root DIR          serve another folder instead of the repo (to test this script)
//
// Needs Playwright (scripts/lib/playwright.mjs):
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run check:layout
// A full run is a few hundred page loads and takes minutes: run it in the
// background for full runs, e.g.
//   npm run check:layout > layout.log 2>&1 &
// Progress goes to stderr, the table to stdout. Exit 0 when everything passes,
// 1 when any check fails, 2 when it can't run. Pages that haven't been
// migrated to the redesign yet may fail; it only reports.

import { resolve } from "node:path";
import { start } from "./lib/static-server.mjs";
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
  "/product?id=ro-9001": ["960x800"],
  "/product?id=ro-9002": ["960x800"],
  "/projects/chiptune": ["960x800"]
};
const TEXT_SCALE_SIZES = ["360x780", "390x844"];
const FOLD_PAGES = new Set(["/product?id=ro-9001", "/product?id=ro-9002"]);
const FOLD_SIZES = new Set(["360x780", "390x844", "960x800", "1280x800"]);
const LISTING_PATHS = new Set(["/", "/store", "/product", "/cart"]);

const LISTINGS_DELAY_MS = 1000;
const FONT_DELAY_MS = 2000;
const SETTLE_MS = 3000;
const PAD_CONNECT_MS = 1000;
const MEASURE_WAIT_MS = 2600;
const MAX_CONTEXTS = 4;
// 60 characters, like a long real pad.id.
const PAD_ID = "Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)";
if (PAD_ID.length !== 60) throw new Error("PAD_ID must be 60 characters");

const delay = ms => new Promise(ok => setTimeout(ok, ms));

// ---------- options ----------

function usage(problem) {
  if (problem) console.error(`check-layout: ${problem}\n`);
  console.error("Usage: node scripts/check-layout.mjs [--pages a,b] [--widths 390x844,...] [--units 0,5|failed]\n" +
    "         [--checkout on|off] [--slow-fonts] [--text-scale] [--concurrency N] [--root DIR]\n" +
    "See the header comment of scripts/check-layout.mjs. Run it in the background for full runs.");
  process.exit(problem ? 2 : 0);
}

function normalisePage(p) {
  if (/^ro-\d+$/.test(p)) return `/product?id=${p}`;
  return p.startsWith("/") ? p : `/${p}`;
}

function parseArgs(argv) {
  const opts = { pages: DEFAULT_PAGES, widths: null, units: ["0", "5"], checkout: "on",
    slowFonts: false, textScale: false, concurrency: MAX_CONTEXTS, root: undefined };
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
      case "--concurrency": opts.concurrency = Number(value()); break;
      case "--root": opts.root = resolve(value()); break;
      case "--help": case "-h": usage(); break;
      default: usage(`unknown option ${argv[i]}`);
    }
  }
  if (!["on", "off"].includes(opts.checkout)) usage("--checkout must be on or off");
  for (const w of opts.widths || []) if (!/^\d{3,4}x\d{3,4}$/.test(w)) usage(`bad size ${w} (want WxH, e.g. 390x844)`);
  for (const u of opts.units) if (u !== "failed" && !/^\d+$/.test(u)) usage(`bad --units value ${u} (want numbers or "failed")`);
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) usage("--concurrency must be a whole number");
  opts.concurrency = Math.min(opts.concurrency, MAX_CONTEXTS);
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
    const listings = LISTING_PATHS.has(path);
    const own = path === "/product" ? [new URLSearchParams(page.split("?")[1] || "").get("id")].filter(Boolean)
      : path === "/cart" ? CART_SEED : [];
    for (const size of sizes) {
      for (const units of listings ? opts.units : [null]) {
        jobs.push({
          page, size, units, own,
          cart: path === "/cart",
          drift: path === "/projects/drift-tester",
          fold: FOLD_PAGES.has(page) && FOLD_SIZES.has(size) && !opts.textScale
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

function textScaleInit() {
  const apply = () => {
    if (!document.documentElement) return false;
    document.documentElement.style.setProperty("font-size", "115%", "important");
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
function measure({ fold }) {
  const out = {};
  const de = document.documentElement;
  out.overflow = de.scrollWidth - window.innerWidth;
  out.viewportH = window.innerHeight;

  const header = document.querySelector(".site-header");
  out.header = header ? Math.round(header.getBoundingClientRect().height * 100) / 100 : null;

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
    const a = document.querySelector("[data-primary-action]");
    if (a) {
      const r = a.getBoundingClientRect();
      out.fold = { bottom: Math.round((r.bottom + window.scrollY) * 10) / 10, at: describe(a) };
    } else {
      out.fold = { bottom: null };
    }
  }
  return out;
}

async function runJob(browser, base, job, opts) {
  const [width, height] = job.size.split("x").map(Number);
  const result = { ...job, failures: [], notes: [], m: null, http: null };
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
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
    if (job.cart) await context.addInitScript(seedCartInit, CART_SEED);
    if (opts.textScale) await context.addInitScript(textScaleInit);
    if (job.drift) await context.addInitScript(gamepadInit, { padId: PAD_ID, connectMs: PAD_CONNECT_MS });

    const page = await context.newPage();
    const csp = [];
    page.on("console", msg => { if (/content[\s-]security[\s-]policy/i.test(msg.text())) csp.push(msg.text()); });
    page.on("pageerror", err => result.notes.push(`page error: ${String(err && err.message || err).split("\n")[0]}`));

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
    result.m = await page.evaluate(measure, { fold: job.fold });
    result.m.csp = csp;
  } catch (err) {
    result.failures.push(`run failed: ${String(err && err.message || err).split("\n")[0]}`);
  } finally {
    await context.close().catch(() => {});
  }
  judge(result, opts);
  return result;
}

// ---------- pass or fail ----------

function judge(r, opts) {
  const m = r.m;
  if (!m) return;
  const fail = msg => r.failures.push(msg);
  if (m.overflow > 0) fail(`overflow: scrollWidth is ${m.overflow}px wider than the viewport`);
  if (opts.textScale) return;
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
    if (m.fold.bottom === null) fail("fold: no [data-primary-action]");
    else if (m.fold.bottom > m.viewportH) fail(`fold: [data-primary-action] ends at y${m.fold.bottom}, below the ${m.viewportH}px viewport`);
  }
  if (r.cart && m.zeroMoney !== null) fail(`$0.00 appeared on /cart at ${m.zeroMoney} ms`);
}

// ---------- output ----------

function row(r, opts) {
  const m = r.m;
  const dash = "-";
  const scaled = opts.textScale;
  const cell = (cond, text) => (m && cond ? text : dash);
  return [
    r.page,
    r.size,
    r.units === null ? dash : r.units,
    r.http ?? dash,
    cell(true, String(Math.max(0, m ? m.overflow : 0))),
    cell(!scaled, m && m.header !== null ? String(m.header) : "none"),
    cell(!scaled, m ? m.cls.toFixed(3) : ""),
    cell(!scaled && m && m.minFont, m && m.minFont ? String(Math.round(m.minFont.size * 10) / 10) : ""),
    cell(!scaled, m && m.h1 === null ? "no h1" : m && m.bigHeadings.length ? "FAIL" : "ok"),
    cell(!scaled && m && m.contrast, m && m.contrast ? m.contrast.ratio.toFixed(2) : ""),
    cell(!scaled, m ? String(m.csp.length) : ""),
    r.fold && m && m.fold ? (m.fold.bottom === null ? "none" : `${m.fold.bottom}/${m.viewportH}`) : dash,
    r.failures.length ? "FAIL" : "ok"
  ];
}

function printTable(results, opts) {
  const head = ["page", "size", "units", "http", "overflow", "header", "CLS", "min font", "headings", "contrast", "CSP", "fold", "result"];
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
console.error(`check-layout: ${jobs.length} runs on ${server.url}, checkout ${opts.checkout}` +
  `${opts.slowFonts ? ", fonts delayed 2 s" : ""}${opts.textScale ? ", text at 115% (overflow only)" : ""}, ` +
  `${opts.concurrency} at a time`);
let done = 0;
const results = await pool(jobs, opts.concurrency, async job => {
  const r = await runJob(browser, server.url, job, opts);
  done++;
  console.error(`[${done}/${jobs.length}] ${r.failures.length ? "FAIL" : "ok  "} ${job.page} ${job.size}` +
    `${job.units === null ? "" : ` units ${job.units}`}`);
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
    console.log(`\n${r.page} ${r.size}${r.units === null ? "" : ` units ${r.units}`}:`);
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
  `(checkout ${opts.checkout}${opts.slowFonts ? ", slow fonts" : ""}${opts.textScale ? ", text scale" : ""}).`);
process.exit(failed.length ? 1 : 0);

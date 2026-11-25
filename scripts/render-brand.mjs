// npm run render:brand: renders the link-preview cards and the touch icon
// from committed sources.
//
//   scripts/brand/og-site.html       -> assets/brand/og-site.png       1200x630
//   scripts/brand/og-tools.html      -> assets/brand/og-tools.png      1200x630
//   scripts/brand/og-portfolio.html  -> assets/brand/og-portfolio.png  1200x630
//   assets/brand/icon.svg            -> assets/brand/icon-180.png      180x180
//
// It serves the repo with scripts/lib/static-server.mjs (random port, the real
// CSP) and loads each template over HTTP, never file://, so site.css and the
// font resolve exactly as they do on the site. Viewport 1200x630, DPR 1.
//
// Each template declares Public Sans with font-display: block, and the script
// refuses to write a card unless document.fonts.check('500 68px "Public Sans"')
// is true and Chromium actually drew every line in Public Sans. It also
// refuses when any text leaves the box x80-1120, y60-570 (a very long name).
//
// og-portfolio's headline and sub come from data/owner.js: OWNER.fullName and
// the named sub when the name is set, otherwise the no-name copy. The text is
// set with page.evaluate; the templates carry no scripts.
//
// icon.svg is the mark, kept verbatim from the design's favicon.svg. To change
// the mark, pass the new SVG and it is copied byte for byte before the render:
//   node scripts/render-brand.mjs --icon-from path/to/favicon.svg
// icon-180.png keeps the SVG's rounded corners transparent; iOS masks its own,
// wider corners over them.
//
// Needs Playwright (scripts/lib/playwright.mjs), for example:
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run render:brand
// npm run sync:owner runs this after a name change. Look at the PNGs, then
// commit them.

import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { start, ROOT } from "./lib/static-server.mjs";
import { loadChromium } from "./lib/playwright.mjs";
import { OWNER } from "../data/owner.js";

const CARD = { width: 1200, height: 630 };
const ICON_SIZE = 180;
const TEXT_BOX = { left: 80, right: 1120, top: 60, bottom: 570 };
const FONT_CHECK = '500 68px "Public Sans"';
const BRAND_DIR = join(ROOT, "assets", "brand");
const ICON_SVG = join(BRAND_DIR, "icon.svg");

// The portfolio card's copy (spec §12). The template holds the no-name pair.
const PORTFOLIO_NO_NAME = {
  headline: "Product case studies",
  sub: "By a senior product manager, from things I've built on my own time."
};
const PORTFOLIO_NAMED_SUB = "Senior product manager. Product case studies from things I've built.";

const fullName = typeof OWNER?.fullName === "string" && OWNER.fullName.trim() ? OWNER.fullName.trim() : null;

const CARDS = [
  { name: "og-site" },
  { name: "og-tools" },
  {
    name: "og-portfolio",
    slots: fullName ? { headline: fullName, sub: PORTFOLIO_NAMED_SUB } : PORTFOLIO_NO_NAME
  }
];

const fail = msg => { throw new Error(`render-brand: ${msg}`); };

// Width and height from a PNG's IHDR chunk.
function pngSize(buf) {
  const sig = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.subarray(0, 8).toString("hex") !== sig || buf.subarray(12, 16).toString("latin1") !== "IHDR") {
    return null;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// The families Chromium rendered a node's text with (DevTools protocol).
async function usedFonts(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) fail(`${selector} is not in the template`);
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.map(f => f.familyName);
  } finally {
    await cdp.detach();
  }
}

function watchErrors(page) {
  const problems = [];
  page.on("console", m => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", e => problems.push(String(e && e.message || e)));
  page.on("requestfailed", r => problems.push(`${r.url()} failed: ${r.failure()?.errorText}`));
  page.on("response", r => { if (r.status() >= 400) problems.push(`${r.url()} answered ${r.status()}`); });
  return problems;
}

async function writePng(file, png, expected) {
  const size = pngSize(png);
  if (!size || size.width !== expected.width || size.height !== expected.height) {
    fail(`${file} would be ${size ? `${size.width}x${size.height}` : "not a PNG"}, not ${expected.width}x${expected.height}`);
  }
  await writeFile(file, png);
  const onDisk = pngSize(await readFile(file));
  if (!onDisk || onDisk.width !== expected.width || onDisk.height !== expected.height) fail(`${file} didn't write as ${expected.width}x${expected.height}`);
  return onDisk;
}

async function renderCard(browser, base, card) {
  const context = await browser.newContext({ viewport: CARD, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = watchErrors(page);
  try {
    // The server 308s /scripts/brand/<name>.html to the clean URL, as Pages
    // does; goto follows it and returns the final response.
    const res = await page.goto(`${base}/scripts/brand/${card.name}.html`, { waitUntil: "load" });
    if (!res || res.status() !== 200) fail(`/scripts/brand/${card.name}.html answered ${res ? res.status() : "nothing"}`);

    const hasTokens = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--sweep").trim() !== "");
    if (!hasTokens) fail(`${card.name}: /assets/site.css didn't load (no --sweep token)`);

    if (card.slots) {
      await page.evaluate(slots => {
        for (const [slot, text] of Object.entries(slots)) {
          const el = document.querySelector(`[data-slot="${slot}"]`);
          if (!el) throw new Error(`no [data-slot="${slot}"] in the template`);
          el.textContent = text;
        }
      }, card.slots);
    }

    await page.evaluate(() => document.fonts.ready);
    // Two frames, so the layout after any slot change is painted.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const fontOk = await page.evaluate(spec => document.fonts.check(spec), FONT_CHECK);
    if (!fontOk) fail(`${card.name}: document.fonts.check('${FONT_CHECK}') is false, so Public Sans isn't loaded`);

    // Each line of text: where its glyph boxes fall, and how many lines it wraps to.
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll("main > *")].map((el, i) => {
        if (!el.id) el.id = `brand-line-${i}`;
        const range = document.createRange();
        range.selectNodeContents(el);
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const q of range.getClientRects()) {
          if (!q.width || !q.height) continue;
          l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
        }
        const lines = Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
        return { id: el.id, text: el.textContent.trim(), l, t, r, b, lines };
      }));
    for (const b of boxes) {
      b.fonts = await usedFonts(page, `#${b.id}`);
      if (!b.fonts.some(f => /^Public Sans/.test(f))) fail(`${card.name}: "${b.text}" is drawn in ${b.fonts.join(", ") || "nothing"}, not Public Sans`);
      const others = b.fonts.filter(f => !/^Public Sans/.test(f));
      if (others.length) console.warn(`render-brand: ${card.name}: some characters of "${b.text}" fall outside Public Sans's latin set and use ${others.join(", ")}.`);
      if (!(b.l >= TEXT_BOX.left && b.r <= TEXT_BOX.right && b.t >= TEXT_BOX.top && b.b <= TEXT_BOX.bottom)) {
        fail(`${card.name}: "${b.text}" spans x${Math.round(b.l)}-${Math.round(b.r)}, y${Math.round(b.t)}-${Math.round(b.b)}, outside x${TEXT_BOX.left}-${TEXT_BOX.right}, y${TEXT_BOX.top}-${TEXT_BOX.bottom}. Shorten it.`);
      }
    }

    if (problems.length) fail(`${card.name}: ${problems.join(" | ")}`);

    const png = await page.screenshot({ clip: { x: 0, y: 0, ...CARD }, animations: "disabled", caret: "hide" });
    const file = join(BRAND_DIR, `${card.name}.png`);
    const size = await writePng(file, png, CARD);
    return { file, size, bytes: png.length, boxes };
  } finally {
    await context.close();
  }
}

async function renderIcon(browser, base) {
  const context = await browser.newContext({ viewport: { width: ICON_SIZE, height: ICON_SIZE }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = watchErrors(page);
  try {
    const res = await page.goto(`${base}/assets/brand/icon.svg`, { waitUntil: "load" });
    if (!res || res.status() !== 200) fail(`/assets/brand/icon.svg answered ${res ? res.status() : "nothing"}`);
    // Draw the 64-unit viewBox at 180px: only the in-browser copy changes.
    const viewBox = await page.evaluate(size => {
      const svg = document.documentElement;
      if (!svg || svg.localName !== "svg") return null;
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      return svg.getAttribute("viewBox");
    }, ICON_SIZE);
    if (!viewBox) fail("assets/brand/icon.svg is not an SVG document");
    if (problems.length) fail(`icon.svg: ${problems.join(" | ")}`);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: ICON_SIZE, height: ICON_SIZE }, omitBackground: true });
    const file = join(BRAND_DIR, "icon-180.png");
    const size = await writePng(file, png, { width: ICON_SIZE, height: ICON_SIZE });
    return { file, size, bytes: png.length };
  } finally {
    await context.close();
  }
}

async function main() {
  const i = process.argv.indexOf("--icon-from");
  if (i > 0) {
    const from = process.argv[i + 1];
    if (!from) fail("--icon-from needs a path to an SVG");
    const text = await readFile(resolve(from), "utf8");
    if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text)) fail(`${from} doesn't start with <svg`);
    await copyFile(resolve(from), ICON_SVG);
    console.log(`assets/brand/icon.svg: copied byte for byte from ${from}`);
  }

  const chromium = await loadChromium();
  const server = await start({ port: 0 });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const card of CARDS) results.push(await renderCard(browser, server.url, card));
    results.push(await renderIcon(browser, server.url));
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(`og-portfolio: ${fullName ? `named, ${JSON.stringify(fullName)}` : "no name (OWNER.fullName is null)"}`);
  console.log('Fonts are as Chromium reports them. The variable Public Sans file names itself "Public Sans Thin" at every weight it draws.');
  for (const r of results) {
    const rel = r.file.slice(ROOT.length + 1).split("\\").join("/");
    console.log(`${rel}: IHDR ${r.size.width}x${r.size.height}, ${r.bytes} bytes`);
    for (const b of r.boxes || []) {
      console.log(`  x${Math.round(b.l)}-${Math.round(b.r)} y${Math.round(b.t)}-${Math.round(b.b)}, ${b.lines} line${b.lines === 1 ? "" : "s"}, ${[...new Set(b.fonts)].join(" + ")}: ${b.text}`);
    }
  }
  console.log("Look at the images, then commit them.");
}

main().catch(err => {
  console.error(err && err.message ? err.message : err);
  if (err && err.cause) console.error(String(err.cause.message || err.cause));
  process.exit(1);
});

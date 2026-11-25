// npm run capture:tools: takes the chiptune sequencer's captures for the
// /projects and home index rows (data/projects.js `shot`), from the real page.
//
//   desktop  /projects/chiptune at 1440x900, DPR 1: the transport and the
//            grid, framed at 16:9 and scaled to 720x405
//   phone    the same page at 390x844, DPR 1: a 358x201 crop of the grid's
//            first two tracks, unscaled
//
// It serves the repo with scripts/lib/static-server.mjs (random port, the real
// CSP), loads the page, then reloads it, so the font (font-display: optional)
// is in place, and refuses to capture unless the text is rendered in Public
// Sans: document.fonts.check() and the fonts Chromium actually used for the
// grid labels and the Play button. It waits for the preloaded pattern before
// each shot.
//
// Output: assets/home/chiptune.webp and chiptune-phone.webp, encoded with
// sharp. When sharp can't be imported it writes .png instead (scaled in the
// browser) and switches the two srcs in data/projects.js to .png. Either
// way the other pair is deleted, so only the written extension is committed.
//
// Needs Playwright (scripts/lib/playwright.mjs), for example:
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run capture:tools
// Run it after any change to the sequencer's look, then commit the images.

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { start, ROOT } from "./lib/static-server.mjs";
import { loadChromium } from "./lib/playwright.mjs";

const PAGE = "/projects/chiptune";
const DESKTOP = { viewport: { width: 1440, height: 900 }, out: { width: 720, height: 405 } };
const PHONE = { viewport: { width: 390, height: 844 }, out: { width: 358, height: 201 } };
const PAD = 24;            // space kept round the controls in the desktop frame
const TRACKS = 6;
const STEPS = 16;
const OUT_DIR = join(ROOT, "assets", "home");
const DATA = join(ROOT, "data", "projects.js");

const fail = msg => { throw new Error(`capture-tools: ${msg}`); };

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch {
    return null;
  }
}

// The families Chromium rendered a node's text with (DevTools protocol).
async function usedFonts(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) fail(`${selector} is not on the page`);
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.map(f => f.familyName);
  } finally {
    await cdp.detach();
  }
}

// Load, reload, check the font, wait for the preloaded pattern.
async function openSequencer(browser, base, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("console", m => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", e => problems.push(String(e && e.message || e)));

  await page.goto(base + PAGE, { waitUntil: "load" });
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const checked = await page.evaluate(() => document.fonts.check('16px "Public Sans"'));
    const label = await usedFonts(page, ".seq-label");
    const play = await usedFonts(page, "#play-btn");
    ok = checked && [label, play].every(f => f.length && f.every(n => /^Public Sans/.test(n)));
    if (!ok && attempt === 2) fail(`text isn't rendered in Public Sans (labels: ${label.join(", ")}; Play: ${play.join(", ")})`);
  }

  await page.waitForFunction(({ cells }) => document.querySelectorAll("#seq-grid .seq-cell").length === cells
    && document.querySelector('#seq-grid .seq-cell[aria-pressed="true"]'), { cells: TRACKS * STEPS });
  const state = await page.evaluate(() => ({
    on: document.querySelectorAll('.seq-cell[aria-pressed="true"]').length,
    playing: document.querySelectorAll(".seq-cell.playing").length,
    play: document.getElementById("play-btn").textContent.trim()
  }));
  if (state.on === 0 || state.playing || state.play !== "Play") fail(`unexpected state ${JSON.stringify(state)}`);
  // Nothing hovered or focused.
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  if (problems.length) fail(`the page logged errors: ${problems.join(" | ")}`);
  return { context, page };
}

// The box round the transport's controls and the grid's labels and cells,
// padded and grown to 16:9 (downwards, or to the right).
async function desktopFrame(page) {
  const box = await page.evaluate(() => {
    const els = document.querySelectorAll(".seq-transport .btn-row > *, .seq-control, .seq-label, .seq-cell");
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const q = el.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    return { l, t, r, b, pageW: document.documentElement.scrollWidth, pageH: document.documentElement.scrollHeight };
  });
  let x = Math.floor(box.l - PAD), y = Math.floor(box.t - PAD);
  let w = Math.ceil(box.r + PAD) - x, h = Math.ceil(box.b + PAD) - y;
  const ratio = DESKTOP.out.width / DESKTOP.out.height;
  if (w / h > ratio) h = Math.round(w / ratio); else w = Math.round(h * ratio);
  if (x < 0 || y < 0 || x + w > box.pageW || y + h > box.pageH) fail(`the frame ${x},${y} ${w}x${h} leaves the page`);
  return { x, y, width: w, height: h };
}

// From 4px above the first track's label, 201px down: Lead in full, then
// Harmony's label and first row of eight.
async function phoneFrame(page) {
  const r = await page.evaluate(() => {
    const steps = document.querySelector(".seq-steps").getBoundingClientRect();
    const label = document.querySelector(".seq-label").getBoundingClientRect();
    return { left: steps.left, width: steps.width, top: label.top + window.scrollY };
  });
  if (Math.round(r.width) !== PHONE.out.width) fail(`the phone grid is ${r.width}px wide, not ${PHONE.out.width}`);
  return { x: Math.round(r.left), y: Math.floor(r.top - 4), width: PHONE.out.width, height: PHONE.out.height };
}

// Scale a PNG in the page with a canvas (the fallback when sharp is missing).
async function scaleInBrowser(page, png, width, height) {
  const data = await page.evaluate(async ({ b64, width, height }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, width, height);
    return c.toDataURL("image/png").split(",")[1];
  }, { b64: png.toString("base64"), width, height });
  return Buffer.from(data, "base64");
}

async function encode(sharp, page, png, { width, height }) {
  if (sharp) {
    return sharp(png).resize(width, height, { fit: "fill", kernel: "lanczos3" }).webp({ quality: 90, effort: 6 }).toBuffer();
  }
  const meta = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  return meta.width === width && meta.height === height ? png : scaleInBrowser(page, png, width, height);
}

// Point data/projects.js at the extension written, if it names the other one.
async function pointData(ext) {
  const other = ext === "webp" ? "png" : "webp";
  const text = await readFile(DATA, "utf8");
  const next = text
    .replace(`/assets/home/chiptune.${other}"`, `/assets/home/chiptune.${ext}"`)
    .replace(`/assets/home/chiptune-phone.${other}"`, `/assets/home/chiptune-phone.${ext}"`);
  if (!next.includes(`/assets/home/chiptune.${ext}"`) || !next.includes(`/assets/home/chiptune-phone.${ext}"`)) {
    fail("data/projects.js has no chiptune shot to point at the captures");
  }
  if (next !== text) {
    await writeFile(DATA, next);
    console.log(`data/projects.js: chiptune shot now .${ext}`);
  }
}

async function main() {
  const sharp = await loadSharp();
  const ext = sharp ? "webp" : "png";
  if (!sharp) console.warn("capture-tools: sharp isn't installed, so writing PNG (scaled in the browser).");

  const chromium = await loadChromium();
  const server = await start({ port: 0 });
  const browser = await chromium.launch();
  const written = [];
  try {
    for (const [shot, frameOf, name] of [[DESKTOP, desktopFrame, "chiptune"], [PHONE, phoneFrame, "chiptune-phone"]]) {
      const { context, page } = await openSequencer(browser, server.url, shot.viewport);
      try {
        const clip = await frameOf(page);
        const png = await page.screenshot({ clip, fullPage: true, animations: "disabled", caret: "hide" });
        const out = await encode(sharp, page, png, shot.out);
        const file = join(OUT_DIR, `${name}.${ext}`);
        await writeFile(file, out);
        written.push(`assets/home/${name}.${ext}`);
        console.log(`${name}.${ext}: ${shot.out.width}x${shot.out.height}, ${out.length} bytes, from ${clip.width}x${clip.height} at ${clip.x},${clip.y} of a ${shot.viewport.width}px page`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const other = ext === "webp" ? "png" : "webp";
  for (const name of ["chiptune", "chiptune-phone"]) await rm(join(OUT_DIR, `${name}.${other}`), { force: true });
  await pointData(ext);
  console.log(`Wrote ${written.join(" and ")}. Look at them, then commit them.`);
}

main().catch(err => {
  console.error(err && err.message ? err.message : err);
  if (err && err.cause) console.error(String(err.cause.message || err.cause));
  process.exit(1);
});

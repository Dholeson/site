// npm run capture:tools: takes the tools' captures from the real pages.
//
// chiptune: the /projects and home index rows' pair (data/projects.js `shot`).
//   desktop  /projects/chiptune at 1440x900, DPR 1: the transport and the
//            grid, framed at 16:9 and scaled to 720x405
//   phone    the same page at 390x844, DPR 1: the grid's width (358px),
//            from 4px above the transport (Play, Randomise and Clear, then
//            tempo, waveform and volume) to 4px below the Lead track, so it
//            ends on a whole track; unscaled. Its height goes into
//            data/projects.js and index.html.
//
// discover-cleaner: the phone views for /projects/discover-cleaner, the home
// and /projects row and the case study, each shown below 60em through a
// <picture> whose desktop <source> is the 1440x900 capture of the same view.
//   from the vendored demo (/projects/discover-cleaner-demo/) 390px wide
//   (2400px tall, so nothing is scrolled), DPR 2, one card or section of the
//   phone layout each, with 8px of the page round it, never an album cover
//   (the demo loads those from Spotify, which a capture can't count on):
//     insights-report-phone  Insights, Month: the plays card and its chart
//     artist-phone           Dance Gavin Dance: "Your history" through the
//                            longest streak
//     library-backlog-phone  Library, Backlog: the tracks-left card
//   cropped from the committed phone capture now-phone.webp (390x844):
//     assets/home/discover-cleaner-now-phone  the countdown and the Like &
//                            clear and Keep in backlog buttons, ending above
//                            the next row of buttons (358px wide)
//     assets/portfolio/discover-cleaner-phone  the whole Now playing card
// The sizes it writes are printed; they must match projects/discover-
// cleaner.html, data/projects.js, index.html and data/portfolio.js
// (test/tools.test.js, test/home.test.js and test/portfolio.test.js read the
// files' headers).
//
//   node scripts/capture-tools.mjs [chiptune] [discover-cleaner]   (default: both)
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
// The Discover Cleaner views need sharp (they are cropped and encoded with
// it, as WebP like the captures beside them); without it that part stops.
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
const PHONE = { viewport: { width: 390, height: 844 }, out: null }; // unscaled: the frame's own size
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

// The grid's width, from 4px above the transport to 4px below the Lead
// track: the controls and one whole track, never a track cut in half.
const PHONE_WIDTH = 358;
async function phoneFrame(page) {
  const r = await page.evaluate(() => {
    const steps = document.querySelector(".seq-steps").getBoundingClientRect();
    const transport = document.querySelector(".seq-transport").getBoundingClientRect();
    const lead = document.querySelector(".seq-track").getBoundingClientRect();
    return {
      left: steps.left, width: steps.width, top: transport.top + window.scrollY, bottom: lead.bottom + window.scrollY,
      transport: [transport.left, transport.right]
    };
  });
  if (Math.round(r.width) !== PHONE_WIDTH) fail(`the phone grid is ${r.width}px wide, not ${PHONE_WIDTH}`);
  if (r.transport[0] < r.left - 0.5 || r.transport[1] > r.left + r.width + 0.5) fail("the transport is wider than the grid");
  const y = Math.floor(r.top - 4);
  return { x: Math.round(r.left), y, width: PHONE_WIDTH, height: Math.ceil(r.bottom + 4) - y };
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

async function encode(sharp, page, png, out) {
  if (!out) return sharp ? sharp(png).webp({ quality: 90, effort: 6 }).toBuffer() : png;
  const { width, height } = out;
  if (sharp) {
    return sharp(png).resize(width, height, { fit: "fill", kernel: "lanczos3" }).webp({ quality: 90, effort: 6 }).toBuffer();
  }
  const meta = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  return meta.width === width && meta.height === height ? png : scaleInBrowser(page, png, width, height);
}

// Point data/projects.js and index.html at the extension written, and give
// them the phone crop's height (its width is always PHONE_WIDTH).
const INDEX = join(ROOT, "index.html");
async function pointData(ext, phone) {
  const other = ext === "webp" ? "png" : "webp";
  for (const [file, size] of [
    [DATA, [/(mobile: \{ src: "\/assets\/home\/chiptune-phone\.\w+", width: )\d+(, height: )\d+/, `$1${phone.width}$2${phone.height}`]],
    [INDEX, [/(<img src="\/assets\/home\/chiptune-phone\.\w+" width=")\d+(" height=")\d+/, `$1${phone.width}$2${phone.height}`]]
  ]) {
    const text = await readFile(file, "utf8");
    const next = text
      .replaceAll(`/assets/home/chiptune.${other}"`, `/assets/home/chiptune.${ext}"`)
      .replaceAll(`/assets/home/chiptune-phone.${other}"`, `/assets/home/chiptune-phone.${ext}"`)
      .replace(size[0], size[1]);
    if (!next.includes(`/assets/home/chiptune.${ext}"`) || !next.includes(`/assets/home/chiptune-phone.${ext}"`) || !size[0].test(next)) {
      fail(`${file} has no chiptune shot to point at the captures`);
    }
    if (next !== text) {
      await writeFile(file, next);
      console.log(`${file.slice(ROOT.length + 1)}: chiptune shot now .${ext}, phone crop ${phone.width}x${phone.height}`);
    }
  }
}

async function captureChiptune(browser, base, sharp) {
  const ext = sharp ? "webp" : "png";
  if (!sharp) console.warn("capture-tools: sharp isn't installed, so writing PNG (scaled in the browser).");
  const written = [];
  let phone = null;
  for (const [shot, frameOf, name] of [[DESKTOP, desktopFrame, "chiptune"], [PHONE, phoneFrame, "chiptune-phone"]]) {
    const { context, page } = await openSequencer(browser, base, shot.viewport);
    try {
      const clip = await frameOf(page);
      const png = await page.screenshot({ clip, fullPage: true, animations: "disabled", caret: "hide" });
      const out = await encode(sharp, page, png, shot.out);
      const size = shot.out || { width: clip.width, height: clip.height };
      if (!shot.out) phone = size;
      await writeFile(join(OUT_DIR, `${name}.${ext}`), out);
      written.push(`assets/home/${name}.${ext}`);
      console.log(`${name}.${ext}: ${size.width}x${size.height}, ${out.length} bytes, from ${clip.width}x${clip.height} at ${clip.x},${clip.y} of a ${shot.viewport.width}px page`);
    } finally {
      await context.close();
    }
  }
  const other = ext === "webp" ? "png" : "webp";
  for (const name of ["chiptune", "chiptune-phone"]) await rm(join(OUT_DIR, `${name}.${other}`), { force: true });
  await pointData(ext, phone);
  return written;
}

// ---------- Discover Cleaner ----------

const DC_DEMO = "/projects/discover-cleaner-demo/";
const DC_DIR = join(ROOT, "assets", "projects", "discover-cleaner");
// 390px wide, the phone layout. Tall, because the demo scrolls inside its
// own frame between a fixed header and player bar: at 2400px every card
// below sits in the open, nothing scrolled and nothing overlapping it.
const DC_VIEWPORT = { width: 390, height: 2400 };
const DC_DPR = 2;
const DC_MARGIN = 8;   // CSS px of the demo's page kept round each card

// The box (page coordinates) of the outermost element whose text starts
// with `text`, inside `root`: a card found by its heading, whatever its class.
function boxStartingWith({ root, text }) {
  const scope = document.querySelector(root);
  if (!scope) return null;
  const starts = el => (el.textContent || "").replace(/\s+/g, " ").trim().startsWith(text);
  let hit = null;
  for (const el of scope.querySelectorAll("*")) if (starts(el) && !el.querySelector(":scope > *") ) { hit = el; break; }
  if (!hit) for (const el of scope.querySelectorAll("*")) if (starts(el)) hit = el;
  if (!hit) return null;
  while (hit.parentElement && hit.parentElement !== scope && starts(hit.parentElement)) hit = hit.parentElement;
  const r = hit.getBoundingClientRect();
  return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right };
}

function boxOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right };
}

const DC_VIEWS = [
  {
    // The month's plays against the month before, and plays per day.
    name: "insights-report-phone", hash: "#/insights",
    async frame(page) {
      await page.waitForSelector(".ins-hero .ins-hero-chart");
      const period = await page.evaluate(() => (document.querySelector(".ins-hero-period") || {}).textContent || "");
      if (!/\b(19|20)\d\d\b/.test(period) || /^\s*week/i.test(period)) fail(`Insights isn't on a month (${period})`);
      return page.evaluate(boxOf, ".ins-hero");
    }
  },
  {
    // "Your history" from its heading to the longest streak: plays, rank,
    // first and last listen, days listened, streak.
    name: "artist-phone", hash: "#/artist/Dance%20Gavin%20Dance",
    async frame(page) {
      await page.waitForSelector(".ar-history .ar-plays");
      const head = await page.evaluate(boxOf, ".ar-history");
      const streak = await page.evaluate(boxStartingWith, { root: ".ar-history", text: "Longest streak" });
      if (!head || !streak) fail("the artist page has no 'Your history' or no longest streak");
      return { ...head, bottom: streak.bottom };
    }
  },
  {
    // The backlog's own card: tracks left, cleared today and this week, and
    // the auto-clear switch. It stops at the card: the playing-now row under
    // it shows an album cover. The page's alt and caption name only what the
    // card shows, since one of each serves this crop and the laptop view.
    name: "library-backlog-phone", hash: "#/library",
    async frame(page) {
      await page.locator("main :is(a, button, [role=tab])", { hasText: /^\s*Backlog/ }).first().click();
      await page.waitForSelector(".lib-bl-hero");
      const card = await page.evaluate(boxOf, ".lib-bl-hero");
      const text = await page.evaluate(() => document.querySelector(".lib-bl-hero").textContent);
      if (!/Tracks left in/.test(text) || !/Auto-clear/.test(text)) fail("Library's Backlog card has no tracks left or no auto-clear");
      return card;
    }
  }
];

// Crops of the committed 390x844 phone capture of the Now page (DPR 1).
const NOW_PHONE = join(DC_DIR, "now-phone.webp");
const NOW_CROPS = [
  // The countdown card and the Like & clear and Keep in backlog buttons,
  // 6px above the card and 5px below the buttons, above the next row.
  { out: join(ROOT, "assets", "home", "discover-cleaner-now-phone.webp"), left: 16, top: 275, width: 358, height: 183 },
  // The whole Now playing card: cover, song, countdown and every button.
  { out: join(ROOT, "assets", "portfolio", "discover-cleaner-phone.webp"), left: 8, top: 72, width: 374, height: 491 }
];

async function captureDiscoverCleaner(browser, base, sharp) {
  if (!sharp) fail("the Discover Cleaner captures need sharp (npm i --no-save sharp)");
  const written = [];
  const context = await browser.newContext({ viewport: DC_VIEWPORT, deviceScaleFactor: DC_DPR });
  // Album covers come from Spotify's image server; a capture never shows a
  // stand-in for one, so the frames above avoid them, and the requests are
  // answered at once rather than left to time out.
  await context.route("https://i.scdn.co/**", route => route.abort());
  try {
    for (const view of DC_VIEWS) {
      const page = await context.newPage();
      const problems = [];
      page.on("pageerror", e => problems.push(String(e && e.message || e)));
      await page.goto(base + DC_DEMO + view.hash, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const box = await view.frame(page);
      await page.waitForTimeout(500);
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      if (problems.length) fail(`${view.name}: the demo threw: ${problems.join(" | ")}`);
      const x = Math.max(0, Math.floor(box.left - DC_MARGIN));
      const y = Math.floor(box.top - DC_MARGIN);
      const clip = { x, y, width: Math.min(DC_VIEWPORT.width, Math.ceil(box.right + DC_MARGIN)) - x, height: Math.ceil(box.bottom + DC_MARGIN) - y };
      if (clip.y < 0 || clip.y + clip.height > DC_VIEWPORT.height) fail(`${view.name}: the frame leaves the ${DC_VIEWPORT.height}px viewport`);
      const png = await page.screenshot({ clip, animations: "disabled", caret: "hide" });
      const out = await sharp(png).webp({ quality: 82, effort: 6 }).toBuffer();
      const meta = await sharp(out).metadata();
      await writeFile(join(DC_DIR, `${view.name}.webp`), out);
      written.push(`assets/projects/discover-cleaner/${view.name}.webp`);
      console.log(`${view.name}.webp: ${meta.width}x${meta.height}, ${out.length} bytes, from ${clip.width}x${clip.height} CSS px at ${clip.x},${clip.y} (DPR ${DC_DPR})`);
      await page.close();
    }
  } finally {
    await context.close();
  }
  for (const c of NOW_CROPS) {
    const out = await sharp(NOW_PHONE).extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .webp({ quality: 90, effort: 6 }).toBuffer();
    await writeFile(c.out, out);
    written.push(c.out.slice(ROOT.length + 1));
    console.log(`${c.out.slice(ROOT.length + 1)}: ${c.width}x${c.height}, ${out.length} bytes, from now-phone.webp at ${c.left},${c.top}`);
  }
  return written;
}

async function main() {
  const asked = process.argv.slice(2);
  const known = ["chiptune", "discover-cleaner"];
  for (const a of asked) if (!known.includes(a)) fail(`unknown capture "${a}" (want ${known.join(" or ")})`);
  const which = asked.length ? asked : known;
  const sharp = await loadSharp();
  const chromium = await loadChromium();
  const server = await start({ port: 0 });
  const browser = await chromium.launch();
  const written = [];
  try {
    if (which.includes("chiptune")) written.push(...await captureChiptune(browser, server.url, sharp));
    if (which.includes("discover-cleaner")) written.push(...await captureDiscoverCleaner(browser, server.url, sharp));
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`Wrote ${written.join(", ")}. Look at them, then commit them.`);
}

main().catch(err => {
  console.error(err && err.message ? err.message : err);
  if (err && err.cause) console.error(String(err.cause.message || err.cause));
  process.exit(1);
});

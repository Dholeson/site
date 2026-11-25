// npm run capture:tools: takes the tools' captures from the real pages.
//
//   node scripts/capture-tools.mjs [chiptune] [discover-cleaner]   (default: both)
//
// chiptune: /projects/chiptune playing its own preloaded pattern, in both
// themes. Six files, every one a real frame of the real page, taken after
// Play was pressed and while the pattern sounds:
//
//   assets/home/chiptune-playing.webp                 720x405    desktop, light
//   assets/home/chiptune-playing-dark.webp            720x405    desktop, dark
//   assets/home/chiptune-playing-phone.webp           358xH      phone, light
//   assets/home/chiptune-playing-phone-dark.webp      358xH      phone, dark
//   assets/portfolio/chiptune-playing-wide.webp       1440x810   desktop, light
//   assets/portfolio/chiptune-playing-wide-dark.webp  1440x810   desktop, dark
//
//   desktop  a 1440x900 window at DPR 2, caught while column 4 (step 5)
//            plays: the transport's controls and the grid's labels and
//            cells, padded 24px and grown to 16:9. That one frame is scaled
//            to 720x405 (home and /projects) and to 1440x810 (the
//            portfolio), so it must be at least 1440 device px wide.
//   phone    a 390x844 window at DPR 1, caught while column 6 (step 7)
//            plays: the grid's width (358px), from 4px above the transport
//            (Play, now reading Stop, Randomise and Clear, then tempo,
//            waveform and volume) to 4px below the Lead track, so it ends
//            on a whole track. Unscaled; H is measured (360 today).
//
// The theme is the browser context's colorScheme with nothing stored, so
// assets/theme.js follows the device; the script checks that html's
// computed color-scheme is that theme. A dark twin is its light file's name
// plus "-dark", at the same size: both themes take the same steps, so a
// pair shows the same moment of the pattern.
//
// Taking a frame: load the page, reload until the text renders in Public
// Sans (document.fonts.check() and the fonts Chromium used for the grid
// labels and the Play button; it refuses otherwise), wait for the preloaded
// pattern, press Play, move the pointer to (0, 0), off every cell, and blur.
// Then poll every 15ms until the wanted column is the one playing,
// screenshot it, and read the column again: the frame is kept only if the
// column hasn't moved and Play reads "Stop". Otherwise wait for the pattern
// to come round again (16 steps, about 1.8 s at the page's own 132 BPM,
// which is left alone so the frame shows the page as it opens). A frame
// gets 20 s of tries; each kept frame prints the attempt it was kept on. At
// 20 s it exits 1, naming the file and the attempts made. All six frames
// are taken before anything is written, so a failure writes nothing and no
// pair is ever half new. A playhead that never moves (no AudioContext in
// the browser) fails the same way.
//
// After writing: each file's pixel size from its WebP header, in a table,
// checked against every place that names it (data/projects.js shot and
// shot.dark; data/portfolio.js image, imageMobile and imageDark; the
// <source> and <img> tags in index.html). A size mismatch, or a file that
// still names one of the old captures, exits 1 and says what to update; a
// file nothing names yet is a note. The script never edits a page or a data
// file: copy the sizes it prints by hand. It deletes the captures this
// replaced, assets/home/chiptune.webp and chiptune-phone.webp, and any
// chiptune*.png in assets/home/ or assets/portfolio/.
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
// It serves the repo with scripts/lib/static-server.mjs (random port, the
// real CSP). Both parts encode with sharp, which is required (it comes with
// wrangler; otherwise npm i --no-save sharp, and keep it out of the commit):
// lanczos3 where a frame is scaled, WebP at quality 90, effort 6, for the
// chiptune files. Needs Playwright (scripts/lib/playwright.mjs), for example:
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run capture:tools
// Run it after any change to a tool's look, look at every file it wrote, and
// commit them.

import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { start, ROOT } from "./lib/static-server.mjs";
import { loadChromium } from "./lib/playwright.mjs";

const fail = msg => { throw new Error(`capture-tools: ${msg}`); };

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch (err) {
    throw new Error("capture-tools: sharp is required (npm i --no-save sharp, kept out of the commit)", { cause: err });
  }
}

// ---------- Chiptune ----------

const PAGE = "/projects/chiptune";
const THEMES = ["light", "dark"];
const TRACKS = 6;
const STEPS = 16;
const PAD = 24;            // CSS px kept round the controls in the desktop frame
const PHONE_WIDTH = 358;   // the phone grid's width, and the phone crop's
const POLL_MS = 15;
const BUDGET_MS = 20000;   // per frame: about 11 turns of the 16-step pattern
const WEBP = { quality: 90, effort: 6 };

// The two frames each theme takes, and the files each one makes. A dark
// twin's name is its light file's plus "-dark".
const FRAMES = [
  {
    name: "desktop", viewport: { width: 1440, height: 900 }, dpr: 2, col: 4,
    outs: [
      { file: "assets/home/chiptune-playing.webp", width: 720, height: 405 },
      { file: "assets/portfolio/chiptune-playing-wide.webp", width: 1440, height: 810 }
    ]
  },
  {
    name: "phone", viewport: { width: 390, height: 844 }, dpr: 1, col: 6,
    outs: [{ file: "assets/home/chiptune-playing-phone.webp", width: null, height: null }] // unscaled
  }
];
const themed = (file, theme) => (theme === "dark" ? file.replace(/\.webp$/, "-dark.webp") : file);

// The captures this replaces: deleted after a run.
const OLD = ["assets/home/chiptune.webp", "assets/home/chiptune-phone.webp"];
const OLD_PNG_DIRS = ["assets/home", "assets/portfolio"];

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

// Load, reload until Public Sans renders, check the theme, wait for the
// preloaded pattern. Returns the page with nothing hovered, focused or playing.
async function openSequencer(browser, base, frame, theme) {
  const context = await browser.newContext({ viewport: frame.viewport, deviceScaleFactor: frame.dpr, colorScheme: theme });
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

  const scheme = await page.evaluate(() => ({
    computed: getComputedStyle(document.documentElement).colorScheme,
    stored: document.documentElement.getAttribute("data-theme")
  }));
  if (scheme.computed !== theme || scheme.stored !== null) {
    fail(`${frame.name}, ${theme}: html's color-scheme is "${scheme.computed}"${scheme.stored ? ` with data-theme="${scheme.stored}"` : ""}, not "${theme}" from the device`);
  }

  await page.waitForFunction(({ cells }) => document.querySelectorAll("#seq-grid .seq-cell").length === cells
    && document.querySelector('#seq-grid .seq-cell[aria-pressed="true"]'), { cells: TRACKS * STEPS });
  const state = await page.evaluate(() => ({
    on: document.querySelectorAll('.seq-cell[aria-pressed="true"]').length,
    playing: document.querySelectorAll(".seq-cell.playing").length,
    play: document.getElementById("play-btn").textContent.trim()
  }));
  if (state.on === 0 || state.playing || state.play !== "Play") fail(`unexpected state ${JSON.stringify(state)}`);
  return { context, page, problems };
}

// The box round the transport's controls and the grid's labels and cells,
// padded and grown to 16:9 (downwards, or to the right), in CSS px.
async function desktopFrame(page) {
  const box = await page.evaluate(() => {
    const els = document.querySelectorAll(".seq-transport .btn-row > *, .seq-control, .seq-label, .seq-cell");
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const q = el.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    return { l, t, r, b };
  });
  let x = Math.floor(box.l - PAD), y = Math.floor(box.t - PAD);
  let w = Math.ceil(box.r + PAD) - x, h = Math.ceil(box.b + PAD) - y;
  const ratio = 16 / 9;
  if (w / h > ratio) h = Math.round(w / ratio); else w = Math.round(h * ratio);
  return { x, y, width: w, height: h };
}

// The grid's width, from 4px above the transport to 4px below the Lead
// track: the controls and one whole track, never a track cut in half.
async function phoneFrame(page) {
  const r = await page.evaluate(() => {
    const steps = document.querySelector(".seq-steps").getBoundingClientRect();
    const transport = document.querySelector(".seq-transport").getBoundingClientRect();
    const lead = document.querySelector(".seq-track").getBoundingClientRect();
    return { left: steps.left, width: steps.width, top: transport.top, bottom: lead.bottom, transport: [transport.left, transport.right] };
  });
  if (Math.round(r.width) !== PHONE_WIDTH) fail(`the phone grid is ${r.width}px wide, not ${PHONE_WIDTH}`);
  if (r.transport[0] < r.left - 0.5 || r.transport[1] > r.left + r.width + 0.5) fail("the transport is wider than the grid");
  const y = Math.floor(r.top - 4);
  return { x: Math.round(r.left), y, width: PHONE_WIDTH, height: Math.ceil(r.bottom + 4) - y };
}

// The column being heard (every track's cell in it is .playing), what Play
// says, and whether the pointer is over a cell.
const readPlayhead = () => {
  const cols = [...document.querySelectorAll("#seq-grid .seq-cell.playing")].map(c => Number(c.dataset.col));
  const col = cols.length && cols.every(c => c === cols[0]) ? cols[0] : -1;
  return {
    col, cells: cols.length,
    play: document.getElementById("play-btn").textContent.trim(),
    hovered: Boolean(document.querySelector(".seq-cell:hover"))
  };
};

// Press Play, then catch the frame's column: one theme's one frame, as a
// PNG at the frame's DPR. Throws after BUDGET_MS without a kept frame.
async function catchFrame(browser, base, frame, theme) {
  const label = themed(frame.outs[0].file, theme);
  const { context, page, problems } = await openSequencer(browser, base, frame, theme);
  try {
    await page.click("#play-btn");
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const clip = await (frame.name === "desktop" ? desktopFrame(page) : phoneFrame(page));
    const vp = frame.viewport;
    if (clip.x < 0 || clip.y < 0 || clip.x + clip.width > vp.width || clip.y + clip.height > vp.height) {
      fail(`${label}: the frame ${clip.x},${clip.y} ${clip.width}x${clip.height} leaves the ${vp.width}x${vp.height} window`);
    }
    for (const o of frame.outs) {
      if (o.width && clip.width * frame.dpr < o.width) fail(`${label}: the frame is ${clip.width * frame.dpr} device px wide, under the ${o.width} of ${o.file}`);
    }

    const t0 = Date.now();
    let attempts = 0;
    while (Date.now() - t0 < BUDGET_MS) {
      const before = await page.evaluate(readPlayhead);
      if (before.col !== frame.col || before.cells !== TRACKS || before.hovered) {
        await page.waitForTimeout(POLL_MS);
        continue;
      }
      attempts++;
      const png = await page.screenshot({ clip, animations: "disabled", caret: "hide" });
      const after = await page.evaluate(readPlayhead);
      if (after.col === frame.col && after.cells === TRACKS && after.play === "Stop" && !after.hovered) {
        if (problems.length) fail(`${label}: the page logged errors: ${problems.join(" | ")}`);
        return { png, clip, attempts, ms: Date.now() - t0 };
      }
      // The step moved on during the screenshot: wait for the pattern to
      // come round to this column again.
    }
    fail(`${label}: no frame kept in ${BUDGET_MS / 1000} s; ${attempts} attempt${attempts === 1 ? "" : "s"} on column ${frame.col} (step ${frame.col + 1})${attempts ? "" : ", and the playhead never reached it (is the AudioContext running?)"}. Nothing was written.`);
  } finally {
    await context.close();
  }
}

// Pixel size from a WebP (VP8, VP8L or VP8X) header, as the tests read it.
function webpSize(b) {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

// Every place that names a capture with a size: [{ src, width, height, where }].
async function namedSizes() {
  const fresh = file => `${pathToFileURL(join(ROOT, file)).href}?t=${Date.now()}`;
  const claims = [];
  const claim = (src, width, height, where) => { if (src) claims.push({ src, width, height, where }); };

  const { projects } = await import(fresh("data/projects.js"));
  for (const p of projects) {
    const s = p.shot;
    if (!s) continue;
    const where = `data/projects.js (${p.id})`;
    claim(s.src, s.width, s.height, `${where} shot`);
    if (s.mobile) claim(s.mobile.src, s.mobile.width, s.mobile.height, `${where} shot.mobile`);
    // A dark twin has its light file's size.
    if (s.dark) {
      claim(s.dark.src, s.width, s.height, `${where} shot.dark.src`);
      if (s.mobile) claim(s.dark.mobile, s.mobile.width, s.mobile.height, `${where} shot.dark.mobile`);
    }
  }

  const { work } = await import(fresh("data/portfolio.js"));
  for (const w of work) {
    const where = `data/portfolio.js (${w.id})`;
    claim(w.image, w.imageWidth, w.imageHeight, `${where} image`);
    const m = w.imageMobile;
    if (m) claim(m.src, m.width, m.height, `${where} imageMobile`);
    if (w.imageDark) {
      claim(w.imageDark.src, w.imageWidth, w.imageHeight, `${where} imageDark.src`);
      if (m) claim(w.imageDark.mobile, m.width, m.height, `${where} imageDark.mobile`);
    }
  }

  const html = await readFile(join(ROOT, "index.html"), "utf8");
  for (const t of html.matchAll(/<(source|img)\b([^>]*)>/g)) {
    const attr = n => (new RegExp(`\\b${n}="([^"]*)"`).exec(t[2]) || [])[1];
    const src = attr(t[1] === "img" ? "src" : "srcset");
    const line = html.slice(0, t.index).split("\n").length;
    claim(src, Number(attr("width")), Number(attr("height")), `index.html:${line} <${t[1]}>`);
  }
  return claims;
}

async function captureChiptune(browser, base, sharp) {
  // Every frame first; nothing is written unless all of them were kept.
  const kept = [];
  for (const theme of THEMES) {
    for (const frame of FRAMES) {
      const shot = await catchFrame(browser, base, frame, theme);
      const files = frame.outs.map(o => themed(o.file, theme));
      console.log(`${files.join(" and ")}: kept on attempt ${shot.attempts}, ${(shot.ms / 1000).toFixed(1)} s in (${theme}, column ${frame.col} playing, Play reads Stop)`);
      kept.push({ theme, frame, ...shot });
    }
  }
  // A pair is the same frame in two themes: the same layout, so the same box.
  for (const frame of FRAMES) {
    const [a, b] = THEMES.map(t => kept.find(k => k.theme === t && k.frame === frame).clip);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`the ${frame.name} frame differs between the themes: ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
  }

  const written = [];
  for (const { theme, frame, png, clip } of kept) {
    for (const o of frame.outs) {
      const out = o.width
        ? await sharp(png).resize(o.width, o.height, { fit: "fill", kernel: "lanczos3" }).webp(WEBP).toBuffer()
        : await sharp(png).webp(WEBP).toBuffer();
      const file = themed(o.file, theme);
      await writeFile(join(ROOT, file), out);
      written.push({ file, bytes: out.length, from: `${clip.width}x${clip.height} CSS px at ${clip.x},${clip.y}, DPR ${frame.dpr}` });
    }
  }

  // The captures these replace.
  const gone = [...OLD];
  for (const dir of OLD_PNG_DIRS) {
    for (const f of await readdir(join(ROOT, dir))) if (/^chiptune.*\.png$/.test(f)) gone.push(`${dir}/${f}`);
  }
  for (const f of gone) await rm(join(ROOT, f), { force: true });

  // Sizes from the headers, against everything that names the files.
  const claims = await namedSizes();
  const problems = [], notes = [];
  console.log("\nfile                                                 size       bytes   from");
  for (const w of written) {
    const size = webpSize(await readFile(join(ROOT, w.file)));
    if (!size) fail(`${w.file} isn't a WebP file`);
    console.log(`${w.file.padEnd(52)} ${`${size.width}x${size.height}`.padEnd(10)} ${String(w.bytes).padStart(6)}   ${w.from}`);
    const named = claims.filter(c => c.src === `/${w.file}`);
    if (!named.length) notes.push(`note: nothing names /${w.file} yet`);
    for (const c of named) {
      if (c.width !== size.width || c.height !== size.height) {
        problems.push(`${c.where} says ${c.width}x${c.height} for /${w.file}, which is ${size.width}x${size.height}`);
      }
    }
  }
  for (const c of claims) {
    if (OLD.some(f => c.src === `/${f}`)) problems.push(`${c.where} still names /${c.src.slice(1)}, which this capture replaced and deleted`);
  }
  console.log("");
  for (const n of notes) console.log(n);
  if (problems.length) fail(`the files were written, but these places need updating:\n  ${problems.join("\n  ")}`);
  console.log(`Every place that names these files states their sizes. Deleted (if present): ${gone.join(", ")}.`);
  return written.map(w => w.file);
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

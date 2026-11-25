// The Controller Drift Tester (projects/drift-core.js, drift-tester.js and
// drift-tester.html). The core is pure, so its arithmetic is pinned here
// directly: the offset is the distance of the mean position (noise around
// centre averages out), jitter is the RMS spread around that position, an
// empty measurement is no measurement, and a stick the pad doesn't have is
// never listed. The page files are checked as text: one scale (BANDS), no
// grade words, no colour values in the script, and the copy the spec fixes.
// And the theme (dark-spec §6.1): the theme head and ?v=3, the plot redrawn
// on "dhole:theme", its canvas on --panel, and kept so under forced colours.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import {
  BANDS, PLATFORMS, READING_MAX, SAMPLE_MS, TRAIL_MAX,
  cleanPadId, formatAxis, formatDate, methodText, readingLine, sticksFor, summarise
} from "../projects/drift-core.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const JS = read("projects/drift-tester.js");
const CORE = read("projects/drift-core.js");
const HTML = read("projects/drift-tester.html");
const CSS = read("assets/drift.css");
const ENTRY = read("projects/drift-tester.entry.js");

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const labels = list => list.map(s => s.label);

const { section, test, run } = harness();

section("drift-core.js: the one scale");

test("BANDS holds only the deadzone ring, at 0.08, and can't be changed at runtime", () => {
  assert.deepEqual(Object.keys(BANDS), ["deadzone"]);
  assert.equal(BANDS.deadzone, 0.08);
  assert.ok(Object.isFrozen(BANDS));
  assert.equal(SAMPLE_MS, 2000);
  assert.equal(TRAIL_MAX, 90);
});

section("summarise: offset, jitter, samples");

test("an empty measurement is null, not a zero reading", () => {
  assert.equal(summarise([]), null);
  assert.equal(summarise(undefined), null);
  assert.equal(summarise([[NaN, 0], [0, undefined]]), null);
});

test("a constant [0.1, 0] reads offset 0.1 and jitter 0", () => {
  const s = summarise(Array.from({ length: 120 }, () => [0.1, 0]));
  close(s.offset, 0.1);
  close(s.jitter, 0);
  assert.equal(s.n, 120);
});

test("symmetric noise around centre has an offset of about 0 (the mean vector, not the mean magnitude)", () => {
  const ring = [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]];
  const samples = Array.from({ length: 30 }, () => ring).flat();
  const s = summarise(samples);
  close(s.offset, 0);
  close(s.jitter, 0.1);
  assert.equal(s.n, 120);
  // Pseudo-random noise, mirrored so it is exactly symmetric.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.04;
  const half = Array.from({ length: 200 }, () => [rnd(), rnd()]);
  const noisy = summarise([...half, ...half.map(([x, y]) => [-x, -y])]);
  assert.ok(noisy.offset < 1e-12, `offset ${noisy.offset}`);
  assert.ok(noisy.jitter > 0.005, `jitter ${noisy.jitter}`);
});

test("jitter is the RMS distance from the mean position, so it doesn't grow with the sample count", () => {
  const base = [[0.02, 0.01], [0.04, 0.01], [0.03, 0.03], [0.03, -0.01]];
  const s = summarise(base);
  close(s.x, 0.03);
  close(s.y, 0.01);
  close(s.offset, Math.hypot(0.03, 0.01));
  const rms = Math.sqrt((0.0001 + 0.0001 + 0.0004 + 0.0004) / 4);
  close(s.jitter, rms);
  const many = summarise(Array.from({ length: 50 }, () => base).flat());
  close(many.jitter, rms);
  assert.equal(many.n, 200);
});

test("non-numeric samples are skipped", () => {
  const s = summarise([[0.1, 0], [NaN, 1], null, [0.1, 0]]);
  assert.equal(s.n, 2);
  close(s.offset, 0.1);
});

section("sticksFor: only the sticks the pad has");

test("Nintendo 64 shows one stick, on axes 0 and 1, with 2 or 4 axes", () => {
  assert.deepEqual(labels(sticksFor("n64", 2)), ["Stick"]);
  assert.deepEqual(labels(sticksFor("n64", 4)), ["Stick"]);
  assert.deepEqual(sticksFor("n64", 4)[0].axes, [0, 1]);
});

test("GameCube shows the C-stick only when the pad has 4 axes", () => {
  assert.deepEqual(labels(sticksFor("gamecube", 2)), ["Control stick"]);
  assert.deepEqual(labels(sticksFor("gamecube", 3)), ["Control stick"]);
  assert.deepEqual(labels(sticksFor("gamecube", 4)), ["Control stick", "C-stick"]);
  assert.deepEqual(sticksFor("gamecube", 4)[1].axes, [2, 3]);
});

test("something else shows the right stick only when the pad has 4 axes", () => {
  assert.deepEqual(labels(sticksFor("other", 2)), ["Left stick"]);
  assert.deepEqual(labels(sticksFor("other", 4)), ["Left stick", "Right stick"]);
  assert.deepEqual(labels(sticksFor("other", 6)), ["Left stick", "Right stick"]);
});

test("a pad with fewer than 2 axes has no sticks, and an unknown platform reads as something else", () => {
  for (const p of Object.keys(PLATFORMS)) {
    assert.deepEqual(sticksFor(p, 0), [], p);
    assert.deepEqual(sticksFor(p, 1), [], p);
    assert.deepEqual(sticksFor(p, undefined), [], p);
  }
  assert.deepEqual(labels(sticksFor("nes", 4)), ["Left stick", "Right stick"]);
});

test("the picker's platforms, and which of them the store sells", () => {
  assert.deepEqual(Object.keys(PLATFORMS), ["n64", "gamecube", "other"]);
  assert.deepEqual(Object.values(PLATFORMS).map(p => p.label), ["Nintendo 64", "GameCube", "Something else"]);
  assert.deepEqual(Object.entries(PLATFORMS).filter(([, p]) => p.stocked).map(([k]) => k), ["n64", "gamecube"]);
  for (const [k, p] of Object.entries(PLATFORMS)) {
    assert.ok(HTML.includes(`<option value="${k}"`), `drift-tester.html has no option for ${k}`);
    assert.ok(HTML.includes(`>${p.label}</option>`), `drift-tester.html has no "${p.label}" option`);
  }
});

section("readingLine: the line Copy reading copies");

test("with a short id it matches the RefurbOS Measured: format exactly", () => {
  const line = readingLine({ label: "Stick", offset: 0.0183, jitter: 0.0061, n: 118, padId: "raphnet.net GC/N64_USB v3.6", date: "2026-11-24" });
  assert.equal(line, "Measured: Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, raphnet.net GC/N64_USB v3.6, 2026-11-24)");
  assert.equal(
    readingLine({ label: "Left stick", offset: 0, jitter: 0, n: 1, padId: "Pad", date: new Date(2026, 10, 25) }),
    "Measured: Left stick rest offset 0.000, jitter 0.000 (2 s, 1 sample, Pad, 2026-11-25)"
  );
});

test("a 300-character pad.id is cut with '…' so the line is at most 200 characters", () => {
  const padId = "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6) ".repeat(5).slice(0, 300);
  assert.equal(padId.length, 300);
  for (const label of ["Stick", "Control stick", "C-stick", "Left stick", "Right stick"]) {
    const line = readingLine({ label, offset: 1.41421, jitter: 0.5, n: 1440, padId, date: "2026-11-25" });
    assert.ok(line.length <= READING_MAX, `${line.length} characters`);
    assert.ok(line.length >= READING_MAX - 1, `cut too short: ${line.length}`);
    assert.ok(line.startsWith("Measured: "), line);
    assert.ok(line.endsWith("…, 2026-11-25)"), line);
  }
  assert.equal(READING_MAX, 200);
});

test("the pad id has whitespace collapsed and control and bidi characters removed", () => {
  assert.equal(cleanPadId("  Pad\t\n\u0000Name‮​  x "), "Pad Name x");
  assert.equal(cleanPadId(null), "");
  const line = readingLine({ label: "Stick", offset: 0.01, jitter: 0.002, n: 100, padId: "A\u0007\r\nB", date: "2026-11-25" });
  assert.ok(line.includes(", A B, 2026-11-25)"), line);
  assert.ok(!/[\u0000-\u001f\u007f‪-‮]/.test(line), line);
  assert.ok(readingLine({ label: "Stick", offset: 0, jitter: 0, n: 2, padId: "\u0000", date: "2026-11-25" }).includes(", no controller id, "));
});

test("cutting never splits a character in two", () => {
  const padId = "\u{1F3AE}".repeat(150);
  const line = readingLine({ label: "Stick", offset: 0.01, jitter: 0.002, n: 100, padId, date: "2026-11-25" });
  assert.ok(line.length <= READING_MAX);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(line), "a lone surrogate");
});

test("formatDate is the local date as YYYY-MM-DD; formatAxis never prints -0.000", () => {
  assert.equal(formatDate(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(formatDate(new Date(2026, 10, 25, 0, 1)), "2026-11-25");
  assert.equal(formatAxis(-0.0001), "0.000");
  assert.equal(formatAxis(-0.02), "−0.020");
  assert.equal(formatAxis(0.0105), "0.011");
  assert.equal(formatAxis(undefined), "0.000");
});

section("the method prose comes from BANDS");

test("methodText states the ring at BANDS.deadzone and the sample time, with no grade", () => {
  const m = methodText();
  assert.ok(m.includes(`The dashed ring is drawn at ${BANDS.deadzone},`), m);
  assert.ok(m.startsWith(`Measure rest samples each stick for ${SAMPLE_MS / 1000} seconds.`), m);
  assert.ok(m.includes("reports numbers without a grade"), m);
});

test("drift-tester.html carries exactly the generated method prose, and the script writes it", () => {
  const p = HTML.match(/<p id="drift-method">([^<]*)<\/p>/);
  assert.ok(p, "no <p id=\"drift-method\">");
  assert.equal(p[1], methodText(), "drift-tester.html's method paragraph differs from methodText(): copy it from drift-core.js");
  assert.match(HTML, /<h2 id="method">How this is measured<\/h2>/);
  assert.match(JS, /setText\(els\.method, methodText\(\)\)/);
});

test("the Measure button's label comes from SAMPLE_MS", () => {
  assert.ok(HTML.includes(`>Measure rest (${SAMPLE_MS / 1000} s)</button>`));
  assert.ok(JS.includes("`Measure rest (${SAMPLE_MS / 1000} s)`"));
});

section("drift-tester.js: numbers without a grade, colours from tokens");

test("no verdict words or classify()", () => {
  for (const word of ["Good", "Within deadzone", "Slight drift", "Significant drift", "classify", "Healthy", "healthy", "worn"]) {
    assert.ok(!JS.includes(word), `drift-tester.js says "${word}"`);
    assert.ok(!CORE.includes(`"${word}`), `drift-core.js says "${word}"`);
  }
});

test("no quoted hex colours or colour functions in the script or the core", () => {
  for (const [name, src] of [["drift-tester.js", JS], ["drift-core.js", CORE]]) {
    assert.ok(!/["'`]#[0-9a-f]{3,8}\b/i.test(src), `${name}: a quoted hex colour`);
    assert.ok(!/\b(rgba?|hsla?)\(/i.test(src), `${name}: a colour function`);
  }
  for (const token of ["--ink", "--graphite", "--edge", "--rule-c"]) {
    assert.ok(JS.includes(`v("${token}")`), `the plot doesn't read ${token}`);
  }
});

test("the dashed ring is drawn at the plot radius times BANDS.deadzone, and the dot has one colour", () => {
  assert.match(JS, /const ring = r \* BANDS\.deadzone;/);
  assert.ok(!/DEADZONE\s*\*\s*\d|deadzone\s*\*\s*\d/.test(JS), "the ring is scaled by a constant");
  for (const m of JS.matchAll(/fillStyle\s*=\s*([^;\n]+)/g)) {
    assert.ok(!m[1].includes("?"), `a conditional fill: ${m[0]}`);
    assert.ok(/^colours\.(ink|graphite)$/.test(m[1].trim()), `an unexpected fill: ${m[0]}`);
  }
  assert.ok(JS.includes("ctx.globalAlpha = 0.55;"), "the trail is ink at 55%");
});

test("no '—' anywhere, and unmeasured values read 'Not measured yet'", () => {
  for (const [name, src] of [["drift-tester.js", JS], ["drift-core.js", CORE], ["drift-tester.html", HTML], ["drift.css", CSS]]) {
    assert.ok(!src.includes("—") && !/\\u2014|&mdash;|&#8212;/i.test(src), `${name} has an em dash`);
    assert.ok(!src.includes("→") && !/\\u2192|&rarr;/i.test(src), `${name} has a "→"`);
  }
  assert.ok(JS.includes('const NOT_MEASURED = "Not measured yet";'));
});

test("the no-readings message and the store line are the spec's copy", () => {
  assert.ok(JS.includes("No readings came in during the ${SAMPLE_MS / 1000} seconds."));
  assert.ok(JS.includes("Keep the controller connected, press a button on it, and try again."));
  assert.ok(HTML.includes('Need a controller? <a href="/store">See what\'s in the store</a>.'));
  assert.ok(JS.includes('"Copy reading"'));
});

section("drift-tester.html: head, copy and layout hooks");

test("the head: title, description, JSON-LD, og-tools.png and the shared snippet", () => {
  const desc = "Plug in a controller and measure where its sticks rest and how much they jitter, in your browser. Nothing is uploaded.";
  assert.ok(HTML.includes("<title>Controller Drift Tester: measure stick drift in your browser | dhole.dev</title>"));
  assert.ok(HTML.includes(`<meta name="description" content="${desc}" />`));
  const ld = JSON.parse(HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "WebApplication");
  assert.equal(ld.description, desc);
  assert.match(HTML, /<meta property="og:image" content="https:\/\/dhole\.dev\/assets\/brand\/og-tools\.png" \/>/);
  assert.match(HTML, /<meta name="twitter:image" content="https:\/\/dhole\.dev\/assets\/brand\/og-tools\.png" \/>/);
  assert.ok(!HTML.includes("og.png"));
  // The theme head (dark-spec §4.1): the dark theme-color first, since the
  // first matching one wins; theme.js after the metas it rewrites and before
  // every stylesheet, so data-theme is set before first paint and the plot's
  // first draw reads the chosen theme's tokens. ?v=3: this release's new HTML
  // needs its new CSS (spec §2.3).
  const order = [
    '<link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/assets/brand/icon-180.png" />',
    '<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />',
    '<meta name="color-scheme" content="light dark" />',
    '<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />',
    '<meta name="theme-color" content="#ffffff" />',
    '<script src="/assets/theme.js?v=3"></script>',
    '<link rel="stylesheet" href="/assets/site.css?v=3" />',
    '<link rel="stylesheet" href="/assets/drift.css?v=3" />',
    '<script type="module" src="/projects/drift-tester.entry.js?v=3"></script>'
  ];
  let at = -1;
  for (const tag of order) {
    const i = HTML.indexOf(tag);
    assert.ok(i > at, `missing or out of order: ${tag}`);
    at = i;
  }
  assert.equal(HTML.match(/<meta name="theme-color"/g).length, 2, "exactly two theme-color metas");
  assert.equal(HTML.match(/<script src=/g).length, 1, "theme.js is the one classic script");
  // Every stylesheet and entry script is versioned; modulepreloads are not
  // (they must name files that exist, and drift-tester.js stays unversioned:
  // its one change, a listener, pairs safely with any HTML).
  for (const m of HTML.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) assert.match(m[1], /\?v=3$/, m[1]);
  for (const m of HTML.matchAll(/<script type="module" src="([^"]+)"/g)) assert.match(m[1], /\?v=3$/, m[1]);
  for (const m of HTML.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)) {
    assert.ok(!m[1].includes("?"), `${m[1]}: preloads stay unversioned`);
  }
  assert.ok(!/pages\.css|demo\.css|favicon\.svg|apple-touch-icon\.png/.test(HTML));
});

test("the copy in order, with a noscript block and none of the removed lines", () => {
  const order = [
    "<noscript><p class=\"notice noscript\"><strong>This page needs JavaScript to show the drift tester.</strong>",
    "<h1>Controller Drift Tester</h1>",
    "Plug a controller into this device, let go of the sticks, and measure where they rest. Nothing is uploaded.",
    "This reads this controller, through this adapter, right now. It isn't a promise about how the stick will wear.",
    "Plug in a controller and press any button on it, so the browser can see it. On a phone or tablet, pair a Bluetooth controller first.",
    '<label for="drift-platform">What is it?</label>',
    "Let go of the sticks, then press Measure rest.",
    ">Reset</button>",
    ">Waiting for a controller</p>",
    'class="drift-plots"',
    'class="drift-readings"',
    'class="drift-results"',
    'class="drift-store"',
    '<h2 id="method">How this is measured</h2>',
    "<h2>How it works</h2>"
  ];
  let at = -1;
  for (const s of order) {
    const i = HTML.indexOf(s);
    assert.ok(i > at, `missing or out of order: ${s}`);
    at = i;
  }
  for (const gone of ["0.02", "0.15", "eyebrow", "measured here first", "Every controller I sell", "turns green", "purple", "class=\"readout\"", "<table"]) {
    assert.ok(!HTML.includes(gone), `drift-tester.html still has "${gone}"`);
  }
  assert.ok(!/\sstyle=/.test(HTML), "an inline style attribute");
});

test("the Measure button is the page's one .btn-ink; the entry mounts the Tools nav", () => {
  assert.equal(HTML.match(/class="btn-ink"/g).length, 1);
  assert.match(HTML, /<button type="button" class="btn-ink" id="drift-measure" disabled>/);
  assert.match(ENTRY, /mountChrome\("tools"\)/);
});

test("pad.id is shown in a wrapping .id span, after the plots and the readings", () => {
  assert.ok(HTML.includes('<p class="drift-pad" id="drift-pad" hidden>Controller: <span class="id id--wrap"></span></p>'));
  assert.ok(HTML.indexOf('id="drift-pad"') > HTML.indexOf('id="drift-plots"'));
  // The readings are on screen from load, so the line a connect adds goes
  // after them (and in the row after them from 60em): nothing above moves.
  assert.ok(HTML.indexOf('id="drift-pad"') > HTML.indexOf('id="drift-readings"'));
  assert.match(CSS, /\.drift-tool > \.drift-readings \{ grid-row: 3; \}\s*\.drift-tool > \.drift-pad \{ grid-row: 4; \}/);
});

// Before a pad connects the tool's held space is filled by the readings
// blocks for the sticks the plots show, not left blank (spec §10.9 allows
// "Not measured yet"); X and Y say there's no controller rather than show 0.
test("the readings blocks are drawn from load, with no number standing in for a reading", () => {
  assert.ok(JS.includes('const NO_PAD = "No controller yet";'));
  assert.match(JS, /syncPlots\(\);\s*renderReadings\(\);/, "initDriftTester draws the readings after the plots");
  assert.match(JS, /const sticks = pad \? currentSticks\(\) : sticksFor\(state\.platform, state\.lastAxes\);/);
  assert.match(JS, /pad \? el\("span", \{ class: "num" \}, "0\.000"\) : el\("span", \{ class: "quiet" \}, NO_PAD\)/);
  assert.match(JS, /els\.measure\.disabled = !pad \|\| /, "no Measure without a pad");
  const disconnect = /function disconnect\(\) \{([\s\S]*?)\n\}/.exec(JS)[1];
  assert.ok(disconnect.includes("renderReadings();") && !disconnect.includes("readings.hidden = true"), "a disconnect keeps the blocks");
});

test("drift.css: tokens only, the tool holds a viewport, 5/7 from 60em, side by side from 35em", () => {
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(CSS.replace(/\/\*[\s\S]*?\*\//g, "")), "a hex colour");
  assert.ok(!/\b(rgba?|hsla?)\(|box-shadow|gradient|backdrop-filter|uppercase|letter-spacing/i.test(CSS));
  assert.match(CSS, /\.drift-tool \{\s*min-height: calc\(100svh - var\(--header-h\)\);/);
  assert.match(CSS, /@media \(min-width: 60em\)[\s\S]*grid-column: 1 \/ span 5;[\s\S]*grid-column: 6 \/ span 7;/);
  assert.match(CSS, /@media \(min-width: 35em\) \{\s*\.drift-plots\[data-count="2"\]/);
  assert.match(CSS, /@media \(min-width: 35em\) \{\s*\.drift-readings\[data-count="2"\]/);
  for (const m of CSS.matchAll(/font-size:\s*([^;]+);/g)) assert.fail(`drift.css sets a font size: ${m[1]}`);
});

// dark-spec §6.1. The canvas background is CSS, so it follows the theme by
// itself; the strokes are pixels drawn with the tokens read at init, so they
// only follow if the script reads the tokens again and redraws.
section("the plot follows the theme");

test("drift-tester.js redraws on dhole:theme: it re-reads the tokens, then calls drawAll()", () => {
  const init = /export function initDriftTester\(\) \{([\s\S]*?)\n\}/.exec(JS)[1];
  const listener = 'window.addEventListener("dhole:theme", () => { colours = readColours(); drawAll(); });';
  assert.ok(init.includes(listener), "initDriftTester has no dhole:theme listener that re-reads the colours and redraws");
  assert.equal(JS.split('addEventListener("dhole:theme"').length - 1, 1, "one dhole:theme listener");
  // Right after the first read, so it is in place before the early return
  // for a browser without the Gamepad API (whose plots are drawn too).
  const first = init.indexOf("colours = readColours();");
  assert.ok(first >= 0 && init.indexOf(listener) > first, "the listener is added after the first readColours()");
  assert.ok(init.indexOf(listener) < init.indexOf('typeof navigator.getGamepads !== "function"'), "the listener is added before the no-Gamepad return");
  // drawAll() with no argument redraws from state: the live pad, if any, and
  // its trail. readColours() reads every colour the plot draws with.
  assert.match(JS, /function drawAll\(pad = state\.pad \? activePad\(\) : null\)/);
  const reads = /function readColours\(\) \{([\s\S]*?)\n\}/.exec(JS)[1];
  for (const token of ["--rule-c", "--edge", "--graphite", "--ink"]) assert.ok(reads.includes(`v("${token}")`), `readColours() doesn't read ${token}`);
});

test("drift.css: the canvas sits on --panel (not the unit-photo --sweep), and keeps it under forced colours", () => {
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const canvas = /(?:^|\})\s*\.plot canvas \{([^}]*)\}/.exec(css);
  assert.ok(canvas, "no .plot canvas rule");
  assert.match(canvas[1], /background: var\(--panel\);/, ".plot canvas background is not var(--panel)");
  assert.ok(!/--sweep/.test(css), "drift.css names --sweep, which is for unit photos only");
  // A contrast theme forces the canvas's CSS background but not its drawn
  // strokes: with Dark chosen on a light forced palette the dot was 1.27:1.
  assert.match(css, /@media \(forced-colors: active\) \{\s*\.plot canvas \{\s*forced-color-adjust: none;\s*\}\s*\}/,
    "no forced-color-adjust: none on .plot canvas inside @media (forced-colors: active)");
  assert.equal(css.split("forced-color-adjust").length - 1, 1, "forced-color-adjust only on the plot");
});

await run();

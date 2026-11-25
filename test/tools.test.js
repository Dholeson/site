// The tools pages: /projects (projects.html, assets/projects-page.js), the
// chiptune sequencer and the Discover Cleaner landing, and the project data
// both the /projects and home index rows render from (data/projects.js).
//
// What's pinned: the data carries no colours and every button names where
// it goes; every capture exists at the pixel size the data states (read from
// the file's own header), so the reserved box matches the image; the
// sequencer draws in CSS tokens only; and the three pages carry the
// redesign's head (og-tools.png, no eyebrow, no old stylesheets).
//
// Run with:  npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./support/harness.js";
import { projects } from "../data/projects.js";
import { toolRow } from "../assets/projects-page.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const PAGES = ["projects.html", "projects/chiptune.html", "projects/discover-cleaner.html"];
const ENTRIES = ["assets/entry/projects.js", "projects/chiptune.entry.js", "projects/discover-cleaner.entry.js"];
const HEX = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;
const QUOTED_HEX = /["'`]#(?:[0-9a-f]{3}|[0-9a-f]{6})["'`]/i;

// Pixel size from a WebP (VP8, VP8L or VP8X) or PNG header.
function imageSize(file) {
  const b = readFileSync(file);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { type: "webp", width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      assert.equal(b.readUIntBE(23, 3), 0x9d012a, `${file}: VP8 start code`);
      return { type: "webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      assert.equal(b[20], 0x2f, `${file}: VP8L signature`);
      const bits = b.readUInt32LE(21);
      return { type: "webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
  }
  throw new Error(`${file}: not a PNG or WebP file`);
}

const shotsOf = p => (p.shot ? [
  { src: p.shot.src, width: p.shot.width, height: p.shot.height },
  ...(p.shot.mobile ? [{ src: p.shot.mobile.src, width: p.shot.mobile.width, height: p.shot.mobile.height }] : [])
] : []);

section("data/projects.js");

test("the order and ids are the spec's: drift tester, Discover Cleaner, chiptune", () => {
  assert.deepEqual(projects.map(p => p.id), ["drift-tester", "discover-cleaner", "chiptune"]);
});

test("no accent field and no hex colour anywhere in the project data", () => {
  for (const p of projects) assert.ok(!("accent" in p), `${p.id} has an accent`);
  const code = read("data/projects.js").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert.ok(!HEX.test(code), `a hex value: ${(code.match(HEX) || [])[0]}`);
  assert.ok(!HEX.test(JSON.stringify(projects)), "a hex value in the exported data");
});

test("every tool has a page, and a button label that names it, with no arrow", () => {
  for (const p of projects) {
    assert.ok(p.demo && p.demo.startsWith("/") && !/\.html\b/.test(p.demo), `${p.id}: demo ${p.demo}`);
    assert.ok(existsSync(join(ROOT, `${p.demo.slice(1)}.html`)), `${p.id}: ${p.demo}.html is missing`);
    const cta = p.cta || "";
    assert.ok(cta.trim(), `${p.id}: no cta`);
    assert.ok(!/[→←]/.test(cta) && !/(->|>)\s*$/.test(cta), `${p.id}: "${cta}" has an arrow`);
    assert.ok(!/^(open( it)?|try it|launch|go|view|learn more|more)$/i.test(cta.trim()), `${p.id}: "${cta}" is generic`);
    const words = p.title.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    assert.ok(words.some(w => cta.toLowerCase().includes(w)), `${p.id}: "${cta}" doesn't name ${p.title}`);
  }
});

test("copy: no em dash, arrow or 'actually' in the project data", () => {
  for (const p of projects) {
    for (const k of ["title", "tagline", "description", "cta", "builtWith"]) {
      const v = String(p[k] || "");
      assert.ok(!/[—→←]/.test(v), `${p.id}.${k}: ${v}`);
      assert.ok(!/\bactually\b/i.test(v), `${p.id}.${k}: "actually"`);
    }
  }
});

test("the drift tester has no shot, and its old all-zeros captures are gone", () => {
  assert.equal(projects.find(p => p.id === "drift-tester").shot, undefined);
  for (const f of ["drift-tester.webp", "drift-tester-phone.webp", "drift-tester.png", "drift-tester-phone.png"]) {
    assert.ok(!existsSync(join(ROOT, "assets", "home", f)), `assets/home/${f} still exists`);
  }
});

test("every shot file exists at the pixel size the data states (from its header)", () => {
  let n = 0;
  for (const p of projects) {
    if (p.shot) assert.ok(p.shot.alt && p.shot.alt.trim(), `${p.id}: no alt`);
    for (const s of shotsOf(p)) {
      assert.match(s.src, /^\/assets\/home\/[\w-]+\.(webp|png)$/, `${p.id}: ${s.src}`);
      const file = join(ROOT, s.src);
      assert.ok(existsSync(file), `${p.id}: ${s.src} is missing`);
      const size = imageSize(file);
      assert.equal(size.type, s.src.split(".").pop(), `${s.src}: the extension doesn't match the file`);
      assert.deepEqual([size.width, size.height], [s.width, s.height], `${s.src}: stated ${s.width}x${s.height}`);
      n++;
    }
  }
  assert.ok(n >= 4, "expected the desktop and phone captures of two tools");
});

test("the chiptune shot is 720x405 and 358x201 with the spec's alt, and only the written extension exists", () => {
  const { shot } = projects.find(p => p.id === "chiptune");
  assert.deepEqual([shot.width, shot.height, shot.mobile.width, shot.mobile.height], [720, 405, 358, 201]);
  assert.equal(shot.alt, "The chiptune sequencer with its preloaded pattern: six tracks of sixteen steps, the transport and tempo controls");
  const ext = shot.src.split(".").pop();
  assert.equal(shot.mobile.src.split(".").pop(), ext);
  const other = ext === "webp" ? "png" : "webp";
  for (const f of [`chiptune.${other}`, `chiptune-phone.${other}`]) {
    assert.ok(!existsSync(join(ROOT, "assets", "home", f)), `assets/home/${f} should not exist next to the .${ext} pair`);
  }
});

section("/projects rows (assets/projects-page.js)");

test("a row is the title link, the capture, the text and a named button: no chips, glyphs, inline styles or arrows", () => {
  for (const p of projects) {
    const html = toolRow(p);
    assert.match(html, new RegExp(`<h2 class="index-title"[^>]*><a href="${p.demo}">`), p.id);
    assert.ok(html.includes(`<a class="btn" href="${p.demo}">${p.cta}</a>`), `${p.id}: button`);
    assert.ok(!/style=|class="[^"]*\bchips?\b|<svg|[→←]/.test(html), `${p.id}: ${html}`);
    if (p.shot) {
      assert.ok(html.includes(`width="${p.shot.mobile.width}" height="${p.shot.mobile.height}"`), `${p.id}: phone size`);
      assert.ok(html.includes(`srcset="${p.shot.src}" width="${p.shot.width}" height="${p.shot.height}"`), `${p.id}: desktop size`);
      assert.ok(html.indexOf("index-media") < html.indexOf("index-text"), `${p.id}: the capture comes before the text`);
    } else {
      assert.ok(!html.includes("index-media") && html.includes("tool-row--text"), `${p.id}: a text-only row`);
    }
  }
});

test("rows escape their data", () => {
  const html = toolRow({ id: "x", title: "<b>", description: "\"&", demo: "/projects/x", cta: "Open <x>" });
  assert.ok(!html.includes("<b>") && !html.includes("Open <x>") && html.includes("&lt;b&gt;"));
});

section("The three pages");

test("each page uses tools.css with ?v=2, og-tools.png, and no eyebrow, pages.css or demo.css", () => {
  for (const f of PAGES) {
    const html = read(f);
    assert.ok(html.includes('href="/assets/site.css?v=2"'), `${f}: site.css?v=2`);
    assert.ok(html.includes('href="/assets/tools.css?v=2"'), `${f}: tools.css?v=2`);
    assert.match(html, /<script type="module" src="\/[^"]+\.js\?v=2"><\/script>/, `${f}: the entry script with ?v=2`);
    assert.ok(!/pages\.css|demo\.css/.test(html), `${f}: links an old stylesheet`);
    assert.ok(!/eyebrow/.test(html), `${f}: an eyebrow`);
    assert.ok(html.includes('content="https://dhole.dev/assets/brand/og-tools.png"'), `${f}: og-tools.png`);
    assert.ok(!/brand\/og\.png|favicon\.svg|apple-touch-icon\.png/.test(html), `${f}: an old brand file`);
    assert.ok(html.includes('href="/assets/brand/icon.svg"') && html.includes('href="/assets/brand/icon-180.png"'), `${f}: icons`);
    assert.ok(html.includes('<meta name="theme-color" content="#ffffff" />'), `${f}: theme-color`);
    assert.ok(html.includes('rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2"'), `${f}: font preload`);
  }
});

test("site copy on the three pages: no em dash, arrows, 'actually', inline styles or mono costume", () => {
  for (const f of PAGES) {
    const html = read(f);
    assert.ok(!/[—→←]|&rarr;|&larr;|&mdash;/.test(html), `${f}: an em dash or arrow`);
    assert.ok(!/\bactually\b/i.test(html), `${f}: "actually"`);
    assert.ok(!/\sstyle="/.test(html), `${f}: an inline style`);
    assert.ok(!/class="[^"]*\bmono\b/.test(html), `${f}: .mono`);
  }
});

test("the JS-rendered pages carry a noscript notice; the page heads have a title and an h1 and nothing above it", () => {
  for (const f of ["projects.html", "projects/chiptune.html"]) {
    assert.match(read(f), /<noscript><p class="notice noscript"><strong>This page needs JavaScript to show (the tools|the sequencer)\.<\/strong>/, f);
  }
  for (const f of PAGES) {
    const html = read(f);
    assert.match(html, /<div class="page-head">\s*<h1>/, `${f}: the h1 opens the page head`);
  }
  assert.ok(read("projects.html").includes("<title>Tools: drift tester, Discover Cleaner, chiptune sequencer | dhole.dev</title>"));
  assert.match(read("projects.html"), /<div id="tools" class="index"><\/div>/);
});

test("every entry module calls mountChrome('tools')", () => {
  for (const f of ENTRIES) assert.match(read(f), /mountChrome\("tools"\)/, f);
});

test("the Discover Cleaner landing links the demo exactly twice, from a .btn-ink and a .btn", () => {
  const html = read("projects/discover-cleaner.html");
  const links = [...html.matchAll(/<a\b[^>]*href="\/projects\/discover-cleaner-demo\/"[^>]*>([^<]*)<\/a>/g)];
  assert.equal(links.length, 2, links.map(m => m[0]).join("\n"));
  assert.match(links[0][0], /class="btn-ink"/);
  assert.match(links[1][0], /class="btn"/);
  for (const m of links) assert.equal(m[1], "Open the live demo");
  assert.equal((html.match(/class="btn-ink"/g) || []).length, 1, "one .btn-ink");
  assert.ok(html.includes("The case study covers how it was rebuilt."));
  assert.ok(!/dc-header|dc-jobs|dc-stage|class="card/.test(html), "the old glow, counters or cards");
});

section("Chiptune sequencer");

test("chiptune.js has no quoted colour strings, no track colours and no inline --track-color", () => {
  const js = read("projects/chiptune.js");
  assert.ok(!QUOTED_HEX.test(js), `a quoted colour: ${(js.match(QUOTED_HEX) || [])[0]}`);
  assert.ok(!/\bcolor\s*:/.test(js), "a color field");
  assert.ok(!/--track-color|style=/.test(js), "an inline style");
  assert.ok(!/btn-primary/.test(js), "the old button class");
});

test("the transport: Play is the page's one .btn-ink, and the tempo shows in <output class=\"num\">", () => {
  const html = read("projects/chiptune.html");
  assert.match(html, /<button type="button" class="btn-ink seq-play" id="play-btn">Play<\/button>/);
  assert.equal((html.match(/class="btn-ink/g) || []).length, 1);
  assert.match(html, /<output class="num[^"]*" id="tempo-out" for="tempo">132 BPM<\/output>/);
});

test("the CSS holds the empty grid for as many tracks as chiptune.js has", () => {
  const tracks = (read("projects/chiptune.js").match(/^\s*\{ name: "[^"]+",\s*freq:/gm) || []).length;
  const css = read("assets/tools.css");
  const held = Number((css.match(/--tracks:\s*(\d+)/) || [])[1]);
  assert.equal(tracks, 6);
  assert.equal(held, tracks, "--tracks in assets/tools.css");
  assert.match(css, /\.seq-steps\s*\{[^}]*grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 64em\)[\s\S]*grid-template-columns:\s*repeat\(16, minmax\(0, 44px\)\)/);
});

section("assets/tools.css");

test("tokens only: no colour values, shadows, gradients, uppercase or radius above 4px", () => {
  const css = read("assets/tools.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!HEX.test(css), `a hex value: ${(css.match(HEX) || [])[0]}`);
  assert.ok(!/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/.test(css), "a colour function");
  assert.ok(!/box-shadow|backdrop-filter|gradient|background-clip|text-transform|letter-spacing/.test(css));
  assert.ok(!/overflow-x\s*:\s*hidden/.test(css));
  for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) {
    assert.ok(/^(0|var\(--radius\))$/.test(m[1].trim()), `border-radius: ${m[1]}`);
  }
  for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) {
    assert.ok(/^var\(--t-/.test(m[1].trim()), `font-size: ${m[1]}`);
  }
});

test("nothing else in the repo still points at the deleted drift captures", () => {
  const hits = [];
  const walk = dir => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "league-ify" || e.name === "discover-cleaner-demo") continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (/\.(html|js|mjs|css)$/.test(e.name) && rel !== "test/tools.test.js" && read(rel).includes("home/drift-tester")) hits.push(rel);
    }
  };
  walk("");
  assert.deepEqual(hits, []);
});

await run();

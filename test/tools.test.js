// The tools pages: /projects (projects.html, assets/projects-page.js), the
// chiptune sequencer and the Discover Cleaner landing, and the project data
// both the /projects and home index rows render from (data/projects.js).
//
// What's pinned: the data carries no colours and every button names where
// it goes; every capture exists at the pixel size the data states (read from
// the file's own header), so the reserved box matches the image, and a dark
// twin is its light file's name plus "-dark" at the same size; the chiptune
// shot is the mid-playback pair in both themes (dark-spec §8.1, §9.3), and the
// captures it replaced are gone; a shot with `dark` renders as the §7 theme
// pair, both lazy; the sequencer draws in CSS tokens only, every panel on
// --panel and beat cells on the darker --panel-dk; and the three pages carry
// the theme head (dark-spec §4.1) and ?v=3 (§2.3) beside the redesign's head
// (og-tools.png, no eyebrow, no old stylesheets).
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
// dark-spec §4.1: the theme head, where the single #ffffff theme-color and
// the site.css link used to be. theme.js is a classic script after the
// metas it rewrites and before every stylesheet.
const THEME_HEAD = [
  '<meta name="color-scheme" content="light dark" />',
  '<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />',
  '<meta name="theme-color" content="#ffffff" />',
  '<script src="/assets/theme.js?v=3"></script>',
  '<link rel="stylesheet" href="/assets/site.css?v=3" />'
].join("\n  ");
const CHIPTUNE_ALT = "The chiptune sequencer playing its preloaded pattern, with a dashed outline on the step being heard";
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

// Every file a shot names, with its stated size. A dark twin (shot.dark,
// paths only) has its light file's size.
const shotsOf = p => {
  const s = p.shot;
  if (!s) return [];
  const m = s.mobile;
  return [
    { src: s.src, width: s.width, height: s.height },
    ...(m ? [{ src: m.src, width: m.width, height: m.height }] : []),
    ...(s.dark ? [{ src: s.dark.src, width: s.width, height: s.height, light: s.src }] : []),
    ...(s.dark && m ? [{ src: s.dark.mobile, width: m.width, height: m.height, light: m.src }] : [])
  ];
};
const darkName = src => src.replace(/\.(webp|png)$/, "-dark.$1");

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

test("every shot file exists at the pixel size the data states (from its header), dark twins included", () => {
  let n = 0, dark = 0;
  for (const p of projects) {
    if (p.shot) assert.ok(p.shot.alt && p.shot.alt.trim(), `${p.id}: no alt`);
    if (p.shot && p.shot.dark) {
      assert.deepEqual(Object.keys(p.shot.dark).sort(), ["mobile", "src"], `${p.id}: shot.dark is { src, mobile }, paths only`);
    }
    for (const s of shotsOf(p)) {
      assert.match(s.src, /^\/assets\/home\/[\w-]+\.(webp|png)$/, `${p.id}: ${s.src}`);
      const file = join(ROOT, s.src);
      assert.ok(existsSync(file), `${p.id}: ${s.src} is missing`);
      const size = imageSize(file);
      assert.equal(size.type, s.src.split(".").pop(), `${s.src}: the extension doesn't match the file`);
      assert.deepEqual([size.width, size.height], [s.width, s.height], `${s.src}: stated ${s.width}x${s.height}`);
      // check:layout finds pairs by this name (dark-spec §7).
      if (s.light) { assert.equal(s.src, darkName(s.light), `${p.id}: a dark twin is its light file's name plus -dark`); dark++; }
      n++;
    }
  }
  assert.ok(n >= 6, "expected the desktop and phone captures of two tools, and the chiptune pair's dark twins");
  assert.equal(dark, 2, "the chiptune shot's two dark twins");
});

// dark-spec §8.1 and §9.3: /projects/chiptune mid-playback, in both themes.
// The phone crop runs from the transport to the end of the Lead track, so
// it ends on a whole track; one alt has to be true of both crops and both
// themes, and it says what a frame taken while the pattern plays shows.
test("the chiptune shot is the playing pair: 720x405 and 358 wide on a phone, the dark twins at the same sizes (from the headers), and the new alt", () => {
  const { shot } = projects.find(p => p.id === "chiptune");
  assert.equal(shot.src, "/assets/home/chiptune-playing.webp");
  assert.equal(shot.mobile.src, "/assets/home/chiptune-playing-phone.webp");
  assert.deepEqual(shot.dark, { src: "/assets/home/chiptune-playing-dark.webp", mobile: "/assets/home/chiptune-playing-phone-dark.webp" });
  assert.deepEqual([shot.width, shot.height, shot.mobile.width], [720, 405, 358]);
  assert.ok(shot.mobile.height > 300 && shot.mobile.height < 420, `phone crop height ${shot.mobile.height}: the transport and one whole track`);
  for (const [light, dark] of [[shot.src, shot.dark.src], [shot.mobile.src, shot.dark.mobile]]) {
    const a = imageSize(join(ROOT, light)), b = imageSize(join(ROOT, dark));
    assert.equal(a.type, "webp", `${light}: WebP (capture-tools writes no PNG)`);
    assert.deepEqual([b.type, b.width, b.height], [a.type, a.width, a.height], `${dark} is ${b.width}x${b.height}, its light twin ${a.width}x${a.height}`);
  }
  assert.equal(shot.alt, CHIPTUNE_ALT);
  assert.ok(!/six tracks|sixteen steps/.test(shot.alt), "the phone crop shows one track");
});

// The captures the playing pair replaced: gone from disk, with no PNG left
// beside them (capture-tools no longer has a PNG fallback), and named by no
// page, stylesheet or module. The capture script itself may name them (it
// deletes them); tests may too.
test("the old chiptune captures are gone and unreferenced", () => {
  for (const f of ["chiptune.webp", "chiptune-phone.webp"]) {
    assert.ok(!existsSync(join(ROOT, "assets", "home", f)), `assets/home/${f} still exists`);
  }
  for (const dir of ["assets/home", "assets/portfolio"]) {
    for (const f of readdirSync(join(ROOT, dir))) assert.ok(!/^chiptune.*\.png$/.test(f), `${dir}/${f}: a PNG capture`);
  }
  const hits = [];
  const walk = dir => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "league-ify" || e.name === "discover-cleaner-demo") continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (rel !== "test") walk(rel); continue; }
      if (/\.(html|js|css)$/.test(e.name) && /home\/chiptune(-phone)?\.(webp|png)/.test(read(rel))) hits.push(rel);
    }
  };
  walk("");
  assert.deepEqual(hits, [], "files still naming the old chiptune captures");
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

// dark-spec §7 and §9.3: a shot with `dark` is the theme pair inside the one
// link, the light picture then the dark one, each with the desktop <source>
// from 35em (as for a single capture on this page) and the phone crop as the
// <img>, the same sizes and alt on both, both lazy even as the page's first
// capture. A shot without `dark` is the single picture, exactly as before.
const STUB = {
  id: "stub", title: "Stub Tool", description: "A tool.", demo: "/projects/stub", cta: "Open the stub tool",
  shot: {
    src: "/assets/home/stub.webp", width: 720, height: 405,
    mobile: { src: "/assets/home/stub-phone.webp", width: 358, height: 300 },
    alt: "A stub & its \"alt\""
  }
};
const STUB_DARK = { ...STUB, shot: { ...STUB.shot, dark: { src: "/assets/home/stub-dark.webp", mobile: "/assets/home/stub-phone-dark.webp" } } };
const squash = html => html.replace(/>\s+</g, "><").trim();
const mediaOf = html => (/<a class="index-media"[\s\S]*?<\/a>/.exec(html) || [""])[0];

test("toolRow renders the theme pair for a shot with `dark`: both pictures lazy, same sizes and alt, light first", () => {
  const alt = "A stub &amp; its &quot;alt&quot;";
  const pic = (cls, src, phone, lazy) => `<picture${cls ? ` class="${cls}"` : ""}>` +
    `<source media="(min-width: 35em)" srcset="${src}" width="720" height="405" />` +
    `<img src="${phone}" width="358" height="300" alt="${alt}"${lazy ? ' loading="lazy"' : ""} decoding="async" /></picture>`;
  for (const eager of [true, false]) {
    const html = toolRow(STUB_DARK, { eager });
    assert.equal(squash(mediaOf(html)), '<a class="index-media" href="/projects/stub" tabindex="-1">' +
      pic("for-light", "/assets/home/stub.webp", "/assets/home/stub-phone.webp", true) +
      pic("for-dark", "/assets/home/stub-dark.webp", "/assets/home/stub-phone-dark.webp", true) + "</a>", `eager ${eager}`);
    assert.equal((html.match(/class="index-media"/g) || []).length, 1, "one link round both pictures");
    assert.ok(!/prefers-color-scheme/.test(html), "never a colour-scheme <source>");
  }
  // Without `dark`: one picture with no class, eager only when asked.
  assert.equal(squash(mediaOf(toolRow(STUB, { eager: true }))), '<a class="index-media" href="/projects/stub" tabindex="-1">' +
    pic("", "/assets/home/stub.webp", "/assets/home/stub-phone.webp", false) + "</a>");
  assert.equal(squash(mediaOf(toolRow(STUB))), '<a class="index-media" href="/projects/stub" tabindex="-1">' +
    pic("", "/assets/home/stub.webp", "/assets/home/stub-phone.webp", true) + "</a>");
  assert.ok(!/for-light|for-dark/.test(toolRow(STUB)), "no pair without shot.dark");
});

test("the chiptune row on /projects is the pair of the playing captures", () => {
  const html = toolRow(projects.find(p => p.id === "chiptune"), { eager: true });
  const pics = [...html.matchAll(/<picture class="(for-light|for-dark)">([\s\S]*?)<\/picture>/g)];
  assert.deepEqual(pics.map(m => m[1]), ["for-light", "for-dark"]);
  assert.match(pics[0][2], /srcset="\/assets\/home\/chiptune-playing\.webp" width="720" height="405"/);
  assert.match(pics[0][2], /<img src="\/assets\/home\/chiptune-playing-phone\.webp" width="358" height="\d+"/);
  assert.match(pics[1][2], /srcset="\/assets\/home\/chiptune-playing-dark\.webp" width="720" height="405"/);
  assert.match(pics[1][2], /<img src="\/assets\/home\/chiptune-playing-phone-dark\.webp" width="358" height="\d+"/);
  for (const m of pics) {
    assert.ok(m[2].includes(`alt="${CHIPTUNE_ALT}" loading="lazy"`), `${m[1]}: the alt, lazy`);
  }
});

test("rows escape their data", () => {
  const html = toolRow({ id: "x", title: "<b>", description: "\"&", demo: "/projects/x", cta: "Open <x>" });
  assert.ok(!html.includes("<b>") && !html.includes("Open <x>") && html.includes("&lt;b&gt;"));
});

section("The three pages");

test("each page has the theme head, then tools.css and its entry with ?v=3, og-tools.png, and no eyebrow, pages.css or demo.css", () => {
  for (const f of PAGES) {
    const html = read(f);
    const head = (/<head>([\s\S]*?)<\/head>/.exec(html) || [, ""])[1];
    assert.ok(head.includes(`\n  ${THEME_HEAD}\n  <link rel="stylesheet" href="/assets/tools.css?v=3" />\n  <script type="module" src="`), `${f}: the theme head of dark-spec §4.1, then tools.css?v=3 and the entry`);
    assert.equal((head.match(/<meta name="theme-color"/g) || []).length, 2, `${f}: two theme-color metas`);
    assert.equal((head.match(/<script\b/g) || []).length, 2, `${f}: theme.js and the entry module, nothing else`);
    assert.match(head, /<script type="module" src="\/[^"]+\.js\?v=3"><\/script>/, `${f}: the entry script with ?v=3`);
    assert.ok(!/\?v=2\b/.test(html), `${f}: still ?v=2 somewhere`);
    assert.ok(!/pages\.css|demo\.css/.test(html), `${f}: links an old stylesheet`);
    assert.ok(!/eyebrow/.test(html), `${f}: an eyebrow`);
    assert.ok(html.includes('content="https://dhole.dev/assets/brand/og-tools.png"'), `${f}: og-tools.png`);
    assert.ok(!/brand\/og\.png|favicon\.svg|apple-touch-icon\.png/.test(html), `${f}: an old brand file`);
    assert.ok(html.includes('href="/assets/brand/icon.svg"') && html.includes('href="/assets/brand/icon-180.png"'), `${f}: icons`);
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

test("every entry module calls mountChrome('tools'); /projects imports its renderer as ../projects-page.js?v=3", () => {
  for (const f of ENTRIES) assert.match(read(f), /mountChrome\("tools"\)/, f);
  // dark-spec §2.3: the renderer's behaviour changed (the pair), so an old
  // cached copy must not render into the new page.
  const entry = read("assets/entry/projects.js");
  assert.match(entry, /^import \{ renderProjects \} from "\.\.\/projects-page\.js\?v=3";$/m);
  assert.deepEqual([...entry.matchAll(/from "([^"]+\?[^"]*)"/g)].map(m => m[1]), ["../projects-page.js?v=3"], "nothing else versioned");
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

// At 390px a 1440px capture is a quarter size and its labels can't be read,
// so below 60em Insights, Artist page and Library are their phone layouts
// (npm run capture:tools); from 60em the laptop views, 3-up.
test("the Discover Cleaner landing: each image states its file's real size, and the three views have phone crops below 60em", () => {
  const html = read("projects/discover-cleaner.html");
  let n = 0;
  for (const m of html.matchAll(/<(img|source)\b([^>]*)>/g)) {
    const attr = name => (new RegExp(`\\b${name}="([^"]*)"`).exec(m[2]) || [])[1];
    const src = attr(m[1] === "img" ? "src" : "srcset");
    if (!src || !src.startsWith("/assets/")) continue;
    n++;
    const size = imageSize(join(ROOT, src));
    assert.deepEqual([Number(attr("width")), Number(attr("height"))], [size.width, size.height], `${src}: stated size`);
  }
  assert.ok(n >= 8, `${n} images`);
  const more = html.slice(html.indexOf('<div class="dc-more">'));
  const pictures = [...more.matchAll(/<picture>\s*<source media="\(min-width: 60em\)" srcset="([^"]+)"[^>]*>\s*<img src="([^"]+)"/g)];
  assert.deepEqual(pictures.map(p => p[1].split("/").pop()), ["insights-report.webp", "artist.webp", "library-backlog.webp"]);
  for (const p of pictures) assert.equal(p[2], p[1].replace(".webp", "-phone.webp"));
  // One alt and one caption serve both captures. Library's phone crop is the
  // backlog card alone (scripts/capture-tools.mjs), with no search field and
  // no playing-now row, so neither may claim them.
  const library = /<figure>\s*<picture>(?:(?!<\/figure>)[\s\S])*library-backlog(?:(?!<\/figure>)[\s\S])*<\/figure>/.exec(more)[0];
  assert.ok(!/search|playing/i.test(library.replace(/<source\b[^>]*>|src="[^"]*"/g, "")), library);
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

// The playhead and the keyboard focus ring are both 2px ink rings, so the
// playhead is dashed, and the focus rule comes after it: a focused cell keeps
// its solid ring while the playhead passes. In a Windows contrast theme every
// cell would look the same, so an on cell keeps a fill in the theme's text
// colour (site.css tokens, so tools.css still names no colour).
test("cells: a dashed playhead that can't be mistaken for focus, and a pattern that survives contrast themes", () => {
  const css = read("assets/tools.css");
  assert.match(css, /\.seq-cell\.playing \{ outline: 2px dashed var\(--ink\); outline-offset: 1px; \}\n\.seq-cell:focus-visible \{ outline: var\(--focus-ring\); outline-offset: var\(--focus-gap\); \}/);
  const forced = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(forced, "a forced-colors block");
  assert.match(forced[1], /\.seq-cell\[aria-pressed="true"\] \{ forced-color-adjust: none; border-color: var\(--forced-on\); background: var\(--forced-on\); \}/);
  assert.match(forced[1], /\.seq-cell\.playing \{ outline-color: var\(--forced-mark\); \}/);
  assert.match(read("assets/site.css"), /--forced-on: CanvasText; --forced-mark: Highlight;/);
});

section("assets/tools.css");

// dark-spec §3.2, §6.2 and §9.3: everything a tool page puts on a panel is
// --panel, in both themes; --sweep is for unit photos, and no tool shows one.
// Beat cells are --panel-dk, which the design guard holds darker than --panel
// in both themes, because the page says so.
test("panels: the capture frame, sequencer cells, Discover Cleaner's screenshots and the code block on --panel; beat cells on --panel-dk; no --sweep", () => {
  const css = read("assets/tools.css");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = sel => {
    const m = new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(code);
    assert.ok(m, `no ${sel} rule`);
    return m[1];
  };
  assert.match(rule(".tool-row > .index-media"), /background: var\(--panel\);/);
  assert.match(rule(".seq-cell"), /background: var\(--panel\);/);
  assert.match(rule(".seq-cell.beat"), /background: var\(--panel-dk\);/);
  assert.match(rule(".dc-run pre"), /background: var\(--panel\);/);
  // The 12px frame round each Discover Cleaner screenshot, in both themes.
  const shots = rule(".dc-shots img");
  assert.match(shots, /padding: var\(--s-3\);/);
  assert.match(shots, /background: var\(--panel\);/);
  assert.match(shots, /border-radius: 0;/);
  assert.ok(!/--sweep/.test(css), "tools.css names --sweep or --sweep-dk");
  assert.ok(read("projects/chiptune.html").includes("The darker squares mark each beat, every four steps."), "the sequencer note, word for word");
});

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

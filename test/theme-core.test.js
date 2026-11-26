// The theme script and its control (dark-spec §4.2, §4.4, §11.1b).
//
// What's pinned:
// - assets/theme.js, run in node:vm against a stub document (an <html>
//   whose attribute changes are recorded, one dark theme-color meta, one
//   color-scheme meta), a stub window (listeners recorded, localStorage a
//   getter that can throw), a device whose dark preference and change
//   events the test controls, and a CustomEvent that records what is
//   announced: the stored choice, junk, blocked storage (which never resets
//   the page's own choice, not even on a storage event or a back/forward
//   cache restore), set(), device changes, other tabs, and the three
//   back/forward-cache cases. It is a classic script with no colours.
// - The footer control in assets/chrome.js, statically and with a stub DOM:
//   rendered only when window.dholeTheme exists; legend "Theme", then
//   "Match device", "Light", "Dark" (auto, light, dark; name="site-theme"),
//   the current choice checked, each radio autocomplete="off"; a change
//   calls dholeTheme.set(); a "dhole:theme" event and every pageshow
//   re-check the radios (a Back that reloads the page can otherwise restore
//   the radio checked when the visitor left); nothing in the header; THEMES
//   and themeChoice are not exported. A chosen Light narrows the
//   color-scheme meta to "only light" (Chrome's auto dark opt-out).
//
// Why node:vm and not a browser: Playwright launches Chromium with the
// back/forward cache off, and re-enabling it headless gave a "masked"
// restore, so no browser run exercises pageshow with persisted: true.
//
// Every page's theme head, the server-written heads, theme pairs and the
// photo/panel split span all packages: test/theme.test.js holds those.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { harness } from "./support/harness.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(join(ROOT, f), "utf8");
const { section, test, run } = harness();

const THEME_FILE = "assets/theme.js";
const CHROME_FILE = "assets/chrome.js";
const THEME_SRC = read(THEME_FILE);
const CHROME_SRC = read(CHROME_FILE);
const KEY = "dhole_theme_v1";
const DARK = "(prefers-color-scheme: dark)";

// ---------- theme.js in a stub page ----------

// Runs theme.js once, as a page would before <body>. Options: what is stored
// (undefined for nothing), whether the device prefers dark, whether storage
// is blocked (the localStorage getter itself throws, as in Safari's private
// mode or with site data blocked), and whether matchMedia exists.
function page({ stored, dark = false, blocked = false, matchMedia = true } = {}) {
  const store = new Map(stored === undefined ? [] : [[KEY, stored]]);
  const state = { blocked };
  const attrs = new Map();
  const listeners = {};
  const events = [];
  const queries = [];
  const metaDark = { attrs: new Map([["name", "theme-color"], ["content", "#161616"], ["media", DARK], ["data-dark", ""]]) };
  const metaScheme = { attrs: new Map([["name", "color-scheme"], ["content", "light dark"]]) };
  for (const m of [metaDark, metaScheme]) m.setAttribute = (k, v) => m.attrs.set(k, String(v));

  const storage = {
    getItem: k => { if (state.blocked) throw new Error("SecurityError"); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (state.blocked) throw new Error("SecurityError"); store.set(k, String(v)); },
    removeItem: k => { if (state.blocked) throw new Error("SecurityError"); store.delete(k); }
  };
  const device = { matches: dark, listeners: [], addEventListener(type, fn) { if (type === "change") this.listeners.push(fn); } };
  const window = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    dispatchEvent: e => { events.push(e); return true; }
  };
  if (matchMedia) window.matchMedia = q => { queries.push(q); return device; };
  Object.defineProperty(window, "localStorage", {
    get() { if (state.blocked) throw new Error("SecurityError: storage is blocked"); return storage; }
  });
  const document = {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, String(v)),
      removeAttribute: k => attrs.delete(k)
    },
    // Only the exact selectors theme.js is meant to use find anything.
    querySelectorAll: sel => (sel === 'meta[name="theme-color"][data-dark]' ? [metaDark] : []),
    querySelector: sel => (sel === 'meta[name="color-scheme"]' ? metaScheme : null)
  };
  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  vm.runInNewContext(THEME_SRC, { window, document, CustomEvent }, { filename: THEME_FILE });

  const fire = (type, e = {}) => { for (const fn of listeners[type] || []) fn(e); };
  return {
    theme: window.dholeTheme, attrs, store, state, events, queries, device, listeners, fire,
    media: () => metaDark.attrs.get("media"),
    scheme: () => metaScheme.attrs.get("content"),
    announced: () => events.filter(e => e.type === "dhole:theme"),
    switchDevice(toDark) { device.matches = toDark; for (const fn of device.listeners) fn({ matches: toDark }); }
  };
}

const where = what => `${THEME_FILE}: ${what}`;
// Objects made inside the vm have its own prototypes; compare plain copies.
const plain = o => JSON.parse(JSON.stringify(o));

section("assets/theme.js: what a page starts with");

test("nothing stored, light device: no data-theme, the dark meta keeps its media, color-scheme 'light dark', resolved light", () => {
  const p = page();
  assert.equal(p.attrs.has("data-theme"), false, where("no stored choice must leave <html> without data-theme, so the device decides"));
  assert.equal(p.media(), DARK, where("the dark theme-color meta keeps media=\"(prefers-color-scheme: dark)\" while following the device"));
  assert.equal(p.scheme(), "light dark", where("color-scheme stays \"light dark\" while following the device"));
  assert.equal(p.theme.choice(), "auto", where("choice() is \"auto\" with nothing stored"));
  assert.equal(p.theme.resolved(), "light", where("resolved() follows a light device"));
  assert.deepEqual(p.queries, [DARK], where("it asks matchMedia for (prefers-color-scheme: dark) once"));
  assert.equal(p.announced().length, 0, where("a normal load announces nothing (spec §4.7): code reads the tokens at init"));
});

test("nothing stored, dark device: still no attribute, resolved dark", () => {
  const p = page({ dark: true });
  assert.equal(p.attrs.has("data-theme"), false, where("the CSS media block does the work on a dark device"));
  assert.equal(p.theme.resolved(), "dark", where("resolved() follows a dark device"));
});

test("stored \"dark\": data-theme=\"dark\", the dark meta's media \"all\", color-scheme \"dark\"", () => {
  const p = page({ stored: "dark" });
  assert.equal(p.attrs.get("data-theme"), "dark", where("a stored dark choice sets data-theme=\"dark\" before <body>"));
  assert.equal(p.media(), "all", where("chose dark: the dark theme-color applies everywhere (media \"all\")"));
  assert.equal(p.scheme(), "dark", where("chose dark: color-scheme narrows to \"dark\""));
  assert.equal(p.theme.resolved(), "dark");
});

test("stored \"light\" on a dark device: data-theme=\"light\", the dark meta's media \"not all\", resolved light", () => {
  const p = page({ stored: "light", dark: true });
  assert.equal(p.attrs.get("data-theme"), "light", where("a stored light choice beats a dark device"));
  assert.equal(p.media(), "not all", where("chose light: the dark theme-color never applies (media \"not all\")"));
  assert.equal(p.scheme(), "only light", where("chose light: color-scheme narrows to \"only light\", so Chrome's auto dark leaves the page alone (a plain \"light\" page gets darkened by it)"));
  assert.equal(p.theme.resolved(), "light", where("resolved() is the choice, not the device"));
});

test("a stored junk value means auto", () => {
  for (const junk of ["", "Dark", "auto", "sepia", "null"]) {
    const p = page({ stored: junk, dark: true });
    assert.equal(p.theme.choice(), "auto", where(`stored ${JSON.stringify(junk)} must read as auto`));
    assert.equal(p.attrs.has("data-theme"), false, where(`stored ${JSON.stringify(junk)} must leave no data-theme`));
  }
});

test("no matchMedia at all: follows nothing, resolves light, and doesn't throw", () => {
  const p = page({ matchMedia: false });
  assert.equal(p.theme.choice(), "auto");
  assert.equal(p.theme.resolved(), "light", where("without matchMedia there is no device preference to follow"));
});

section("assets/theme.js: blocked storage");

test("a localStorage getter that throws: auto with no exception; set(\"dark\") applies and announces; choice() is \"dark\"", () => {
  const p = page({ blocked: true, dark: false });
  assert.equal(p.theme.choice(), "auto", where("unreadable storage starts the page on auto"));
  assert.doesNotThrow(() => p.theme.set("dark"), where("set() must not throw when storage is blocked"));
  assert.equal(p.theme.choice(), "dark", where("the choice holds for this page even though it couldn't be stored"));
  assert.equal(p.attrs.get("data-theme"), "dark", where("set(\"dark\") applies at once"));
  assert.equal(p.media(), "all");
  const a = p.announced();
  assert.equal(a.length, 1, where("set() announces once"));
  assert.deepEqual(plain(a[0].detail), { choice: "dark", resolved: "dark" });
});

test("still blocked: a storage event and a back/forward-cache restore both leave the page's choice alone", () => {
  const p = page({ blocked: true });
  p.theme.set("dark");
  const before = p.announced().length;
  p.fire("storage", { key: KEY });
  assert.equal(p.theme.choice(), "dark", where("a storage event must never reset the page's choice when storage can't be read (read() returns null)"));
  p.fire("storage", { key: null });
  assert.equal(p.theme.choice(), "dark", where("nor may a cleared-storage event"));
  p.fire("pageshow", { persisted: true });
  assert.equal(p.theme.choice(), "dark", where("a back/forward-cache restore must never reset the page's choice when storage can't be read"));
  assert.equal(p.attrs.get("data-theme"), "dark");
  assert.equal(p.announced().length, before, where("nothing changed, so nothing is announced"));
});

section("assets/theme.js: changes");

test("set(\"auto\") removes the stored key and the attribute, and resets both metas", () => {
  const p = page({ stored: "dark" });
  p.theme.set("auto");
  assert.equal(p.store.has(KEY), false, where("set(\"auto\") removes dhole_theme_v1"));
  assert.equal(p.attrs.has("data-theme"), false, where("set(\"auto\") removes data-theme"));
  assert.equal(p.media(), DARK);
  assert.equal(p.scheme(), "light dark");
  p.theme.set("light");
  assert.equal(p.store.get(KEY), "light", where("set(\"light\") stores \"light\""));
  assert.equal(p.scheme(), "only light", where("set(\"light\") narrows color-scheme to \"only light\""));
  p.theme.set("dark");
  assert.equal(p.scheme(), "dark", where("set(\"dark\") narrows color-scheme to \"dark\""));
  p.theme.set("bogus");
  assert.equal(p.theme.choice(), "auto", where("an unknown value means auto"));
  assert.equal(p.store.has(KEY), false);
});

test("a device change announces while following the device, and not once a theme is chosen", () => {
  const p = page();
  assert.equal(p.device.listeners.length, 1, where("one change listener on the device's media query"));
  p.switchDevice(true);
  assert.equal(p.announced().length, 1, where("on auto, a device switch announces so drawing code can redraw"));
  assert.deepEqual(plain(p.announced()[0].detail), { choice: "auto", resolved: "dark" });
  p.theme.set("dark");
  const n = p.announced().length;
  p.switchDevice(false);
  assert.equal(p.announced().length, n, where("with a chosen theme, a device switch changes nothing and announces nothing"));
});

test("another tab's choice (a storage event with the key) applies here and announces once", () => {
  const p = page();
  p.store.set(KEY, "dark");
  p.fire("storage", { key: "dhole_store_cart_v1" });
  assert.equal(p.attrs.has("data-theme"), false, where("a storage event for another key changes nothing"));
  assert.equal(p.announced().length, 0);
  p.fire("storage", { key: KEY });
  assert.equal(p.attrs.get("data-theme"), "dark", where("a storage event with dhole_theme_v1 applies the new choice"));
  assert.equal(p.media(), "all");
  assert.equal(p.announced().length, 1, where("and announces it once"));
  p.fire("storage", { key: KEY });
  assert.equal(p.announced().length, 1, where("the same value again announces nothing"));
  p.store.clear();
  p.fire("storage", { key: null });
  assert.equal(p.theme.choice(), "auto", where("storage cleared in another tab (key null): back to auto"));
  assert.equal(p.announced().length, 2);
});

section("assets/theme.js: back/forward cache (pageshow)");

test("a restore picks up a choice stored while the page was frozen; a normal pageshow doesn't", () => {
  const p = page();
  p.store.set(KEY, "dark");                      // chosen on the next page, behind this one's back
  p.fire("pageshow", { persisted: false });
  assert.equal(p.attrs.has("data-theme"), false, where("pageshow without persisted is a normal load: nothing changes"));
  assert.equal(p.announced().length, 0, where("and nothing is announced"));
  p.fire("pageshow", { persisted: true });
  assert.equal(p.attrs.get("data-theme"), "dark", where("a page restored from the back/forward cache must take up the stored choice (it missed the storage event)"));
  assert.equal(p.media(), "all");
  assert.equal(p.scheme(), "dark");
  const a = p.announced();
  assert.equal(a.length, 1, where("one announce, so the footer's radios and drawing code catch up"));
  assert.equal(a[0].detail.choice, "dark");
});

test("a restore while following the device, with nothing stored changed: one announce", () => {
  const p = page();
  p.fire("pageshow", { persisted: true });
  assert.equal(p.attrs.has("data-theme"), false);
  assert.equal(p.announced().length, 1, where("on auto a restore announces anyway: the device may have switched while the page was cached, and drawing code must re-read the tokens"));
});

test("a restore with an unchanged chosen theme: nothing announced", () => {
  const p = page({ stored: "light" });
  p.fire("pageshow", { persisted: true });
  assert.equal(p.theme.choice(), "light");
  assert.equal(p.announced().length, 0, where("an explicit choice that didn't change is silent on restore"));
});

section("assets/theme.js: what kind of script it is");

test("a classic script: no import or export, no colour literal, and window.dholeTheme has exactly choice, resolved and set", () => {
  const code = THEME_SRC.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/^\s*(import|export)\b/m.test(code), where("it is loaded with a plain <script src> before site.css, so it can't be a module"));
  assert.ok(!/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i.test(code), where("no colour literals: site.css owns every colour"));
  assert.deepEqual(plain(Object.keys(page().theme).sort()), ["choice", "resolved", "set"]);
});

// ---------- the footer control in chrome.js ----------

section("assets/chrome.js: the footer's theme choice, statically");

// The body of a top-level function declaration in chrome.js.
function fnBody(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return null;
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i + 1, j);
  }
  return null;
}

test("themeChoice() renders the fieldset only behind a window.dholeTheme check", () => {
  const body = fnBody(CHROME_SRC, "themeChoice");
  assert.ok(body, `${CHROME_FILE}: no function themeChoice()`);
  const guard = /\bif\s*\(\s*!\s*(window\.dholeTheme|theme)\s*\)\s*return\s*""/.exec(body);
  assert.ok(guard && /window\.dholeTheme/.test(body), `${CHROME_FILE}: themeChoice() must return "" when window.dholeTheme is missing (an old cached page without theme.js), before any markup`);
  assert.ok(guard.index < body.indexOf("<fieldset"), `${CHROME_FILE}: the window.dholeTheme check must come before the fieldset`);
});

test("THEMES lists Match device, Light and Dark in that order, as auto, light and dark", () => {
  const m = /const THEMES = (\[[^\n]*\]);/.exec(CHROME_SRC);
  assert.ok(m, `${CHROME_FILE}: no THEMES list`);
  assert.deepEqual(JSON.parse(m[1]), [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]],
    `${CHROME_FILE}: THEMES must be [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]] (plain words, in this order)`);
});

test("the markup: fieldset.theme-choice, legend \"Theme\", radios named site-theme, autocomplete=\"off\"", () => {
  const body = fnBody(CHROME_SRC, "themeChoice");
  assert.match(body, /<fieldset class="theme-choice">\s*<legend>Theme<\/legend>\s*<div class="theme-options">/, `${CHROME_FILE}: the fieldset, its legend "Theme" and .theme-options`);
  assert.match(body, /<label><input type="radio" name="site-theme" value="\$\{value\}"/, `${CHROME_FILE}: each option a native radio named site-theme inside its label`);
  // A Back that reloads the page (no back/forward cache) otherwise has
  // Chrome and Firefox restore the radio checked when the visitor left, over
  // the one rendered from choice(), with no change event: measured in
  // Chromium, the footer then showed Dark on a light page.
  assert.match(body, /<input type="radio" name="site-theme"[^>]* autocomplete="off" \/>/, `${CHROME_FILE}: each radio carries autocomplete="off", so the browser never restores an old checked state over the current choice`);
});

test("the footer places it between the footer nav and the copyright line, and the header has no theme control", () => {
  const footer = /footer\.innerHTML = `([\s\S]*?)`;/.exec(CHROME_SRC);
  assert.ok(footer, `${CHROME_FILE}: no footer markup`);
  assert.match(footer[1], /<\/ul><\/nav>\s*\$\{themeChoice\(\)\}\s*<p class="site-footer-meta">/, `${CHROME_FILE}: \${themeChoice()} goes between the footer <nav> and <p class="site-footer-meta">`);
  const header = /header\.innerHTML = `([\s\S]*?)`;/.exec(CHROME_SRC);
  assert.ok(header, `${CHROME_FILE}: no header markup`);
  assert.ok(!/theme|radio/i.test(header[1]), `${CHROME_FILE}: the header markup must not change (Cart at 320px stays as it is)`);
});

test("a change calls dholeTheme.set(); \"dhole:theme\" and every pageshow re-check the radios", () => {
  assert.match(CHROME_SRC, /addEventListener\("change", e => \{\s*if \(e\.target\.name === "site-theme"\) window\.dholeTheme\.set\(e\.target\.value\);/,
    `${CHROME_FILE}: a change listener on .theme-choice calls window.dholeTheme.set(e.target.value) for site-theme radios`);
  const sync = /const sync = \(\) => \{([\s\S]*?)\n {4}\};/.exec(CHROME_SRC);
  assert.ok(sync && /\.checked = [\s\S]*?window\.dholeTheme\.choice\(\)/.test(sync[1]),
    `${CHROME_FILE}: a sync() sets each radio's checked from dholeTheme.choice()`);
  assert.match(CHROME_SRC, /window\.addEventListener\("dhole:theme", sync\);/,
    `${CHROME_FILE}: "dhole:theme" (another tab, or a back/forward-cache restore) runs sync()`);
  assert.match(CHROME_SRC, /window\.addEventListener\("pageshow", sync\);/,
    `${CHROME_FILE}: every pageshow runs sync(), persisted or not: a Back that reloads the page can restore an old checked radio`);
});

test("THEMES and themeChoice stay internal: chrome.js exports only mountChrome", async () => {
  assert.ok(!/export\s+(const|function|let)\s+(THEMES|themeChoice)\b/.test(CHROME_SRC) && !/export\s*\{[^}]*\b(THEMES|themeChoice)\b/.test(CHROME_SRC),
    `${CHROME_FILE}: THEMES and themeChoice must not be exported (no module gains a named export in this release)`);
  const mod = await import("../assets/chrome.js");
  assert.deepEqual(Object.keys(mod), ["mountChrome"], `${CHROME_FILE}: exports`);
});

section("assets/chrome.js: the footer's theme choice, mounted on a stub page");

// A stub page just big enough for mountChrome(): an empty header to fill, a
// body to append the footer to, and a footer that finds its own fieldset
// and radios in the markup it was given.
function mount(dholeTheme) {
  const listeners = {};
  const header = { innerHTML: "" };
  let footer = null;
  const radiosOf = html => [...html.matchAll(/<input type="radio" name="site-theme" value="(\w+)"( checked)?/g)]
    .map(m => ({ name: "site-theme", value: m[1], checked: Boolean(m[2]) }));
  const makeFooter = () => {
    const el = { className: "", innerHTML: "", fieldset: null };
    el.querySelector = sel => {
      if (sel !== ".theme-choice" || !el.innerHTML.includes('class="theme-choice"')) return null;
      if (!el.fieldset) {
        const radios = radiosOf(el.innerHTML);
        el.fieldset = {
          radios, handlers: {},
          addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
          querySelectorAll: s => (s === 'input[name="site-theme"]' ? radios : [])
        };
      }
      return el.fieldset;
    };
    return el;
  };
  globalThis.window = { dholeTheme, addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); } };
  globalThis.document = {
    querySelector: sel => (sel === "body > header.site-header" ? header : null),
    querySelectorAll: () => [],
    createElement: () => (footer = makeFooter()),
    body: { append() {}, prepend() {} }
  };
  return { listeners, header, footer: () => footer };
}

const { mountChrome } = await import("../assets/chrome.js");
const restore = () => { delete globalThis.window; delete globalThis.document; };

test("without window.dholeTheme (an old cached page): no fieldset, no listener, and nothing throws", () => {
  try {
    const p = mount(undefined);
    assert.doesNotThrow(() => mountChrome("store"), `${CHROME_FILE}: mountChrome() must work on a page without theme.js`);
    assert.ok(!p.footer().innerHTML.includes("theme-choice"), `${CHROME_FILE}: no theme choice without window.dholeTheme`);
    assert.ok(!p.listeners["dhole:theme"] && !p.listeners.pageshow, `${CHROME_FILE}: no "dhole:theme" or pageshow listener without the control`);
    assert.ok(p.header.innerHTML.includes('class="site-nav"'), "the header is still filled");
  } finally { restore(); }
});

test("with window.dholeTheme: one fieldset, three radios in order, the current choice checked", () => {
  try {
    for (const current of ["auto", "light", "dark"]) {
      const p = mount({ choice: () => current, set() {} });
      mountChrome("");
      const html = p.footer().innerHTML;
      assert.equal(html.split('class="theme-choice"').length - 1, 1, `${CHROME_FILE}: exactly one theme choice in the footer`);
      assert.ok(html.indexOf("</nav>") < html.indexOf("theme-choice") && html.indexOf("theme-choice") < html.indexOf("site-footer-meta"),
        `${CHROME_FILE}: between the footer nav and the copyright line`);
      const labels = [...html.matchAll(/<label><input [^>]*\/>([^<]+)<\/label>/g)].map(m => m[1]);
      assert.deepEqual(labels, ["Match device", "Light", "Dark"]);
      const radios = p.footer().querySelector(".theme-choice").radios;
      assert.deepEqual(radios.map(r => r.value), ["auto", "light", "dark"]);
      assert.deepEqual(radios.filter(r => r.checked).map(r => r.value), [current], `${CHROME_FILE}: the radio for "${current}" is the one checked`);
      assert.ok(!p.header.innerHTML.includes("theme"), `${CHROME_FILE}: nothing theme-related in the header`);
    }
  } finally { restore(); }
});

test("choosing calls dholeTheme.set() with the radio's value; \"dhole:theme\" re-checks the radios", () => {
  try {
    let choice = "auto";
    const calls = [];
    const p = mount({ choice: () => choice, set: v => { calls.push(v); choice = v; } });
    mountChrome("cart");
    const fs = p.footer().querySelector(".theme-choice");
    assert.equal((fs.handlers.change || []).length, 1, `${CHROME_FILE}: one change listener on .theme-choice`);
    fs.handlers.change[0]({ target: { name: "site-theme", value: "dark" } });
    fs.handlers.change[0]({ target: { name: "something-else", value: "light" } });
    assert.deepEqual(calls, ["dark"], `${CHROME_FILE}: only a site-theme radio's change calls set(), with its value`);
    // Another tab (or a restored page) moves the choice: the radios follow.
    choice = "light";
    assert.equal((p.listeners["dhole:theme"] || []).length, 1, `${CHROME_FILE}: one window "dhole:theme" listener`);
    p.listeners["dhole:theme"][0]({ detail: { choice: "light", resolved: "light" } });
    assert.deepEqual(fs.radios.filter(r => r.checked).map(r => r.value), ["light"], `${CHROME_FILE}: "dhole:theme" checks the radio for dholeTheme.choice()`);
    // A Back that reloads the page: the browser restored the radio checked
    // when the visitor left (here Dark), with no change event, while the
    // choice is Light. pageshow (persisted or not) puts it right.
    for (const r of fs.radios) r.checked = r.value === "dark";
    assert.equal((p.listeners.pageshow || []).length, 1, `${CHROME_FILE}: one window "pageshow" listener`);
    p.listeners.pageshow[0]({ persisted: false });
    assert.deepEqual(fs.radios.filter(r => r.checked).map(r => r.value), ["light"], `${CHROME_FILE}: pageshow checks the radio for dholeTheme.choice(), even when not persisted`);
  } finally { restore(); }
});

await run();

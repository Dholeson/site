// Theme: light, dark, or the device's choice.
//
// A classic script (not a module), loaded with a plain <script src> in every
// page's <head>, after the color-scheme and theme-color metas and before
// site.css. It runs before <body> is parsed, so a visitor who chose a theme
// never sees the other one first. It is a same-origin file, so the CSP's
// script-src 'self' allows it; nothing is inline.
//
// The choice is localStorage "dhole_theme_v1": "light", "dark", or absent
// (follow the device). It becomes data-theme="light" | "dark" on <html>, or
// no attribute, and site.css does the rest. No colours here.
//
// Two metas follow the choice too:
//   <meta name="color-scheme">: "light dark", or the chosen theme;
//   <meta name="theme-color" data-dark media="(prefers-color-scheme: dark)">:
//     its media becomes "all" (chose dark) or "not all" (chose light).
//
// Storage missing, blocked or throwing: the choice holds for this page only,
// and nothing here ever resets it to "auto" because storage couldn't be read.
//
// window.dholeTheme = { choice(), resolved(), set(choice) }. Every change (a
// choice here, a choice in another tab, the device switching while the page
// follows it, a page coming back from the back/forward cache to a different
// stored choice) dispatches "dhole:theme" on window with detail
// { choice, resolved }. Code that draws listens and re-reads the tokens.
//
// Print never sees any of this: site.css keeps both dark blocks screen-only.
(function () {
  "use strict";
  var KEY = "dhole_theme_v1";
  var DARK = "(prefers-color-scheme: dark)";
  var root = document.documentElement;
  var device = typeof window.matchMedia === "function" ? window.matchMedia(DARK) : null;

  // The stored choice: "light", "dark" or "auto" (nothing stored, or junk).
  // null when storage can't be read at all (blocked, or it throws).
  function read() {
    try {
      var v = window.localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "auto";
    } catch (e) {
      return null;
    }
  }
  var choice = read() || "auto";

  function resolved() {
    if (choice !== "auto") return choice;
    return device && device.matches ? "dark" : "light";
  }

  function apply() {
    if (choice === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    var metas = document.querySelectorAll('meta[name="theme-color"][data-dark]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].setAttribute("media", choice === "dark" ? "all" : choice === "light" ? "not all" : DARK);
    }
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.setAttribute("content", choice === "auto" ? "light dark" : choice);
  }

  function announce() {
    window.dispatchEvent(new CustomEvent("dhole:theme", { detail: { choice: choice, resolved: resolved() } }));
  }

  function set(next) {
    choice = next === "light" || next === "dark" ? next : "auto";
    try {
      if (choice === "auto") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, choice);
    } catch (e) { /* no storage: this page only */ }
    apply();
    announce();
  }

  // Take up the stored choice if it differs from this page's. Storage that
  // can't be read keeps this page's own choice. True when it changed.
  function follow() {
    var next = read();
    if (next === null || next === choice) return false;
    choice = next;
    apply();
    announce();
    return true;
  }

  apply();

  if (device) {
    var onDevice = function () { if (choice === "auto") announce(); };
    if (typeof device.addEventListener === "function") device.addEventListener("change", onDevice);
    else if (typeof device.addListener === "function") device.addListener(onDevice);
  }

  // Another tab chose: follow it here.
  window.addEventListener("storage", function (e) {
    if (e.key === KEY || e.key === null) follow();
  });

  // Back from the back/forward cache: the page was frozen, so it missed any
  // storage event (a theme chosen on the page the visitor came back from) and
  // perhaps a device switch. Catch up. While following the device, announce
  // anyway: CSS follows by itself, but drawing code must re-read the tokens.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    if (!follow() && choice === "auto") announce();
  });

  window.dholeTheme = { choice: function () { return choice; }, resolved: resolved, set: set };
})();

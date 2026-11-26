// Shared header and footer.
//
// The site has no build step, so rather than copy-pasting the nav into every
// page (and inevitably letting them drift apart), each page calls mountChrome()
// with its own key. Add a page here once and it appears everywhere.
//
// Pages carry an empty <header class="site-header"></header> as the first
// thing in <body>. CSS holds it at 61px and this fills it, so the page
// doesn't jump down when the script arrives (a layout shift on every page
// view otherwise). A page without one still gets a header, prepended.
//
// Links use the extensionless URLs Cloudflare serves (/store, not
// /store.html): the .html form costs every click a 308 redirect.
//
// The cart link is a single text node, "Cart" or "Cart (3)", kept current by
// mountCartBadge() in cart.js. It sits outside .nav-scroll, so when large
// text makes the bar too narrow, only Store, Tools and Portfolio scroll and
// Cart with its count is never clipped. The mark carries no colour of its own:
// site.css fills .mark-bg with --ink and .mark-fg with --paper.
//
// The footer carries the theme choice: a "Theme" fieldset of three native
// radios (Match device, Light, Dark) between the footer links and the
// copyright line. assets/theme.js (a classic script in every page's head)
// does the work through window.dholeTheme; this only renders the radios,
// calls dholeTheme.set() on a change, and re-checks them on "dhole:theme"
// (another tab's choice, or a page back from the back/forward cache) and on
// every pageshow. The radios are autocomplete="off": a Back that reloads the
// page (no back/forward cache: a no-store page, or one the cache dropped)
// otherwise has the browser restore the radio that was checked when the
// visitor left, over the one rendered here and with no change event, so the
// footer shows one theme while the page is in another. With no
// window.dholeTheme (an old cached page without theme.js) there is no
// choice to offer, so nothing is rendered. The header never changes.

import { mountCartBadge } from "./cart.js";
import { SUPPORT_EMAIL } from "./store-config.js";

// The key a page passes picks the current nav link:
//   "store"      /store, /product, /shipping-returns
//   "tools"      /projects and the pages under /projects/ ("projects" is an alias)
//   "portfolio"  /portfolio, /case
//   "cart"       /cart, /order-complete, /checkout-cancelled
//   ""           home, 404 and the build log: no link is current
const NAV = [
  { key: "store",     href: "/store",     label: "Store" },
  { key: "tools",     href: "/projects",  label: "Tools" },
  { key: "portfolio", href: "/portfolio", label: "Portfolio" }
];
const ALIASES = { projects: "tools" };

// The footer's theme choice, in this order. Internal: not exported.
const THEMES = [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]];

// The fieldset, with the current choice checked, or "" when theme.js hasn't
// run (window.dholeTheme missing), so a page never offers a choice that
// can't take effect.
function themeChoice() {
  const theme = window.dholeTheme;
  if (!theme) return "";
  const current = theme.choice();
  const options = THEMES.map(([value, label]) =>
    `<label><input type="radio" name="site-theme" value="${value}"${value === current ? " checked" : ""} autocomplete="off" />${label}</label>`).join("");
  return `<fieldset class="theme-choice">
      <legend>Theme</legend>
      <div class="theme-options">${options}</div>
    </fieldset>`;
}

// The "d" of assets/brand/icon.svg, drawn in a 64x64 box.
const MARK_PATH = "M30.57 52Q25.12 52 22.02 48.25Q18.92 44.51 18.92 37.6Q18.92 33.31 20.17 30.14Q21.43 26.96 23.89 25.22Q26.36 23.47 29.98 23.47Q31.69 23.47 33.08 23.88Q34.47 24.29 35.56 24.96Q36.64 25.63 37.4 26.43Q38.16 27.22 38.58 28.01V12H45.08V51.47H40.31L39.58 45.84Q39.25 46.82 38.63 47.9Q38.01 48.97 36.96 49.91Q35.91 50.84 34.34 51.42Q32.77 52 30.57 52ZM31.9 47.24Q35.38 47.24 36.98 44.98Q38.58 42.71 38.58 37.44Q38.56 34.45 37.86 32.41Q37.16 30.36 35.72 29.32Q34.28 28.29 31.97 28.29Q29.05 28.29 27.17 30.43Q25.29 32.58 25.29 37.44Q25.29 42.27 27.02 44.76Q28.75 47.24 31.9 47.24Z";

export function mountChrome(current = "") {
  const key = ALIASES[current] ?? current;
  const here = k => (k === key ? ' aria-current="page"' : "");

  let header = document.querySelector("body > header.site-header");
  if (!header) {
    header = document.createElement("header");
    header.className = "site-header";
    document.body.prepend(header);
  }
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="/">
        <svg class="brand-mark" width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <rect class="mark-bg" width="64" height="64" rx="6"/><path class="mark-fg" d="${MARK_PATH}"/>
        </svg><span class="brand-word">dhole.dev</span>
      </a>
      <nav class="site-nav" aria-label="Main">
        <div class="nav-scroll">${NAV.map(n => `<a href="${n.href}"${here(n.key)}>${n.label}</a>`).join("")}</div><a href="/cart" class="cart-link" data-cart-link${here("cart")}>Cart</a>
      </nav>
    </div>`;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap">
    <nav aria-label="Footer"><ul class="link-list">
      <li><a href="/store">Store</a></li><li><a href="/shipping-returns">Shipping and returns</a></li>
      <li><a href="/projects">Tools</a></li><li><a href="/portfolio">Portfolio</a></li>
      <li><a href="/minecraft">Lazy Sunday</a></li><li><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></li>
    </ul></nav>
    ${themeChoice()}
    <p class="site-footer-meta">© ${new Date().getFullYear()} dhole.dev</p>
  </div>`;
  document.body.append(footer);

  const choice = footer.querySelector(".theme-choice");
  if (choice) {
    // Arrow keys and clicks both fire change, so each applies at once.
    choice.addEventListener("change", e => {
      if (e.target.name === "site-theme") window.dholeTheme.set(e.target.value);
    });
    // Check the radio for the current choice. On "dhole:theme": another tab
    // chose, or the page came back from the back/forward cache to a
    // different stored choice. On every pageshow: a browser that restores
    // form state despite autocomplete="off" has done so by then.
    const sync = () => {
      for (const radio of choice.querySelectorAll('input[name="site-theme"]')) {
        radio.checked = radio.value === window.dholeTheme.choice();
      }
    };
    window.addEventListener("dhole:theme", sync);
    window.addEventListener("pageshow", sync);
  }

  mountCartBadge();
}

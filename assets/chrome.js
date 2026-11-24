// Shared header and footer.
//
// The site has no build step, so rather than copy-pasting the nav into every
// page (and inevitably letting them drift apart), each page calls mountChrome()
// with its own key. Add a page here once and it appears everywhere.
//
// Pages carry an empty <header class="site-header"></header> as the first
// thing in <body>. CSS reserves its height, and this fills it, so the page
// doesn't jump down when the script arrives (a layout shift on every page
// view otherwise). A page without one still gets a header, prepended.
//
// Links use the extensionless URLs Cloudflare serves (/store, not
// /store.html): the .html form costs every click a 308 redirect.

import { mountCartBadge } from "./cart.js";
import { SUPPORT_EMAIL } from "./store-config.js";

const NAV = [
  { key: "projects", href: "/projects", label: "Projects" },
  { key: "store",    href: "/store",    label: "Store" },
  { key: "portfolio", href: "/portfolio", label: "Work" },
  // Phones drop Log from the header (it's in the footer) so Cart never
  // scrolls out of sight: site.css .nav-wide.
  { key: "log",      href: "/log",      label: "Log", wide: true }
];

export function mountChrome(current = "") {
  let header = document.querySelector("body > header.site-header");
  if (!header) {
    header = document.createElement("header");
    header.className = "site-header";
    document.body.prepend(header);
  }
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="/">dhole<span class="dot">.</span>dev</a>
      <nav class="site-nav" aria-label="Main">
        ${NAV.map(n => `
          <a href="${n.href}"${n.wide ? ' class="nav-wide"' : ""}${n.key === current ? ' aria-current="page"' : ""}>${n.label}</a>
        `).join("")}
        <a class="cart-link" href="/cart"${current === "cart" ? ' aria-current="page"' : ""}>
          Cart <span class="cart-badge" data-cart-count aria-live="polite"></span>
        </a>
      </nav>
    </div>`;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <span>© ${new Date().getFullYear()} dhole.dev</span>
      <nav aria-label="Footer">
        <a href="/projects">Projects</a>
        <a href="/store">Store</a>
        <a href="/shipping-returns">Shipping &amp; returns</a>
        <a href="/portfolio">Portfolio</a>
        <a href="/log">Log</a>${SUPPORT_EMAIL ? `
        <a href="mailto:${SUPPORT_EMAIL}">Contact</a>` : ""}
      </nav>
    </div>`;
  document.body.append(footer);

  mountCartBadge();
}

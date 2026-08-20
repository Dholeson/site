// Shared header and footer.
//
// The site has no build step, so rather than copy-pasting the nav into every
// page (and inevitably letting them drift apart), each page calls mountChrome()
// with its own key. Add a page here once and it appears everywhere.

import { mountCartBadge } from "./cart.js";

const NAV = [
  { key: "projects", href: "/projects.html", label: "Projects" },
  { key: "store",    href: "/store.html",    label: "Store" },
  { key: "log",      href: "/log.html",      label: "Log" }
];

export function mountChrome(current = "") {
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="/">dhole<span class="dot">.</span>dev</a>
      <nav class="site-nav" aria-label="Main">
        ${NAV.map(n => `
          <a href="${n.href}"${n.key === current ? ' aria-current="page"' : ""}>${n.label}</a>
        `).join("")}
        <a class="cart-link" href="/cart.html"${current === "cart" ? ' aria-current="page"' : ""}>
          Cart <span class="cart-badge" data-cart-count aria-live="polite"></span>
        </a>
      </nav>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <span>© ${new Date().getFullYear()} dhole.dev</span>
      <nav aria-label="Footer">
        <a href="/projects.html">Projects</a>
        <a href="/store.html">Store</a>
        <a href="/log.html">Log</a>
      </nav>
    </div>`;
  document.body.append(footer);

  mountCartBadge();
}

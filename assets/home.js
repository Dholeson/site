// Homepage: a hub that sends people to either the projects or the shop.
// Most shop traffic will arrive by direct link, so this page's job is to catch
// everyone else and make it obvious there are two things here.

import { projects } from "../data/projects.js";
import { formatMoney } from "../data/products.js";
import { allProducts, loadBench } from "./catalogue.js";
import { esc } from "./esc.js";

export function renderHome() {
  renderFeaturedProjects();
  renderFeaturedProducts();
}

function renderFeaturedProjects() {
  const el = document.getElementById("home-projects");
  const featured = projects.filter(p => p.demo).slice(0, 2);

  if (!featured.length) {
    el.innerHTML = `<p class="muted">No live projects yet.</p>`;
    return;
  }

  // A real view of each tool where there is one; the glyph otherwise.
  el.innerHTML = featured.map(p => `
    <article class="card project-card tool-card">
      ${p.shot
        ? `<a class="tool-shot" href="${esc(p.demo)}" tabindex="-1">
             <picture>
               ${p.shot.mobile ? `<source media="(max-width: 700px)" srcset="${esc(p.shot.mobile.src)}"
                 width="${esc(p.shot.mobile.width)}" height="${esc(p.shot.mobile.height)}" />` : ""}
               <img src="${esc(p.shot.src)}" alt="${esc(p.shot.alt)}"
                    width="${esc(p.shot.width)}" height="${esc(p.shot.height)}" loading="lazy" />
             </picture>
           </a>`
        : `<a class="tool-shot tool-shot-glyph" href="${esc(p.demo)}" tabindex="-1" style="--proj-accent:${esc(p.accent)}">
             <span aria-hidden="true">${projectGlyph(p.id)}</span>
           </a>`}
      <div class="card-body">
        <h3><a href="${esc(p.demo)}">${esc(p.title)}</a></h3>
        <p class="tool-desc">${esc(p.tagline)}</p>
        <a class="btn btn-sm tool-cta" href="${esc(p.demo)}">${esc(p.cta || "Open it →")}</a>
        ${p.builtWith ? `<p class="built-with">${esc(p.builtWith)}</p>` : ""}
      </div>
    </article>`).join("");
}

// "View Super Nintendo details": the platform as people say it.
const PLATFORM_NAMES = { "SNES": "Super Nintendo" };
const detailsLabel = p => p.category === "console"
  ? `View ${PLATFORM_NAMES[p.platform] || p.platform} details`
  : "View details";

function renderFeaturedProducts() {
  const el = document.getElementById("home-products");
  // Lead with things actually in stock -- nothing sells a shop like a sold-out row.
  // Bench units come first: one of a kind, with real photos. Three fills the
  // desktop grid exactly; a fourth wrapped to a lonely second row.
  const paint = state => {
    const inStock = allProducts().filter(p => p.stock > 0);
    // Hold the row's height while loading and when the shelf is empty, so the
    // sections below don't jump when units arrive.
    el.classList.toggle("shelf-hold", !inStock.length);
    if (!inStock.length) {
      el.innerHTML = state === "ok"
        ? `<div class="empty-state shelf-empty"><p>Nothing on the shelf right now. New units go up as they come off the bench.</p>
             <p><a class="btn btn-sm" href="/store">See the store</a></p></div>`
        : state === "failed"
          ? `<div class="empty-state shelf-empty"><p><a href="/store">See what's in the store</a></p></div>`
          : `<p class="muted">Loading what's on the shelf…</p>`;
      return;
    }
    const bench = inStock.filter(p => p.source === "bench");
    const rest = inStock.filter(p => p.source !== "bench").sort((a, b) => b.priceCents - a.priceCents);
    const featured = [...bench, ...rest].slice(0, 3);

    el.innerHTML = featured.map(p => `
    <article class="card product-card">
      <a href="/product?id=${encodeURIComponent(p.id)}">
        <img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3><a href="/product?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <div class="chips"><span class="chip">${esc(p.platform)}</span>${
          p.source === "bench" ? `<span class="chip">One of one</span>` : ""}</div>
        <div class="price">${formatMoney(p.priceCents)}</div>
        <a class="btn btn-sm product-details-link" href="/product?id=${encodeURIComponent(p.id)}">${esc(detailsLabel(p))}</a>
      </div>
    </article>`).join("");
  };
  // The hand-made catalogue shows at once; live units replace it if they load.
  paint("loading");
  loadBench().then(paint);
}

// Small inline marks so the homepage has something to look at without shipping
// screenshots that would go stale the moment a demo changes.
function projectGlyph(id) {
  if (id === "discover-cleaner") {
    return `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <rect x="6" y="10" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" opacity=".3"/>
      <path d="M24 15.5 H38" opacity=".3"/>
      <rect x="6" y="26.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>
      <path d="M24 32 H44"/>
      <rect x="6" y="43" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" opacity=".6"/>
      <path d="M24 48.5 H37" opacity=".6"/>
      <circle cx="51" cy="15.5" r="8" opacity=".3"/>
      <path d="M51 7.5 A8 8 0 1 1 43 15.5"/>
    </svg>`;
  }
  if (id === "drift-tester") {
    return `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="32" cy="32" r="22" opacity=".35"/>
      <circle cx="32" cy="32" r="10" opacity=".55"/>
      <circle cx="41" cy="26" r="4.5" fill="currentColor" stroke="none"/>
      <path d="M32 32 L41 26" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="8" y="26" width="8" height="12" rx="2" fill="currentColor" stroke="none" opacity=".5"/>
    <rect x="20" y="18" width="8" height="28" rx="2" fill="currentColor" stroke="none"/>
    <rect x="32" y="30" width="8" height="8"  rx="2" fill="currentColor" stroke="none" opacity=".5"/>
    <rect x="44" y="22" width="8" height="20" rx="2" fill="currentColor" stroke="none" opacity=".8"/>
  </svg>`;
}

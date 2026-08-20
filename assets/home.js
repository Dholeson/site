// Homepage: a hub that sends people to either the projects or the shop.
// Most shop traffic will arrive by direct link, so this page's job is to catch
// everyone else and make it obvious there are two things here.

import { projects } from "../data/projects.js";
import { products, formatMoney } from "../data/products.js";
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

  el.innerHTML = featured.map(p => `
    <article class="card project-card">
      <a class="project-preview" href="${esc(p.demo)}" style="--proj-accent:${esc(p.accent)}">
        <span class="project-preview-glyph" aria-hidden="true">${projectGlyph(p.id)}</span>
        <span class="chip chip-live">Playable</span>
      </a>
      <div class="card-body">
        <h3><a href="${esc(p.demo)}">${esc(p.title)}</a></h3>
        <p class="muted">${esc(p.tagline)}</p>
        <div class="chips">${p.tags.map(t => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        <a class="btn btn-sm" href="${esc(p.demo)}" style="margin-top:auto">Open it →</a>
      </div>
    </article>`).join("");
}

function renderFeaturedProducts() {
  const el = document.getElementById("home-products");
  // Lead with things actually in stock -- nothing sells a shop like a sold-out row.
  // Three fills the desktop grid exactly; a fourth wrapped to a lonely second row.
  const featured = [...products]
    .filter(p => p.stock > 0)
    .sort((a, b) => b.priceCents - a.priceCents)
    .slice(0, 3);

  el.innerHTML = featured.map(p => `
    <article class="card product-card">
      <a href="/product.html?id=${encodeURIComponent(p.id)}">
        <img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3><a href="/product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <div class="chips"><span class="chip">${esc(p.platform)}</span></div>
        <div class="price">${formatMoney(p.priceCents)}</div>
      </div>
    </article>`).join("");
}

// Small inline marks so the homepage has something to look at without shipping
// screenshots that would go stale the moment a demo changes.
function projectGlyph(id) {
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

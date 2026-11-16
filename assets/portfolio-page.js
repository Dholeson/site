// Portfolio: an index grid (portfolio.html) and one templated case-study page
// (case.html?id=...). Everything comes from data/portfolio.js, so adding a
// project is adding a block there -- no new HTML page.

import { profile, work, findWork } from "../data/portfolio.js";
import { esc } from "./esc.js";

// ---------- index ----------

export function renderPortfolio() {
  renderProfile();

  const grid = document.getElementById("pf-grid");
  const filterBar = document.getElementById("pf-filters");

  // Filters are built from the data, in first-seen order, so a new category
  // shows up without touching the page.
  const kinds = [...new Set(work.map(w => w.kind))];
  const initial = kinds.includes(decodeURIComponent(location.hash.slice(1)))
    ? decodeURIComponent(location.hash.slice(1)) : "All";

  filterBar.innerHTML = ["All", ...kinds].map(k => `
    <button type="button" class="pf-filter" data-kind="${esc(k)}"
      aria-pressed="${k === initial}">${esc(k)}</button>`).join("");

  function apply(kind) {
    const list = kind === "All" ? work : work.filter(w => w.kind === kind);
    grid.innerHTML = list.map(card).join("");
    for (const b of filterBar.querySelectorAll("button")) {
      b.setAttribute("aria-pressed", String(b.dataset.kind === kind));
    }
  }

  filterBar.addEventListener("click", e => {
    const b = e.target.closest("button[data-kind]");
    if (!b) return;
    const kind = b.dataset.kind;
    history.replaceState(null, "", kind === "All" ? location.pathname : `#${encodeURIComponent(kind)}`);
    apply(kind);
  });

  apply(initial);
}

function renderProfile() {
  const el = document.getElementById("pf-contact");
  if (!el) return;
  const links = [
    profile.email  && { label: "Email me", href: `mailto:${profile.email}`, primary: true },
    profile.resume && { label: "Résumé", href: profile.resume },
    profile.github && { label: "GitHub", href: profile.github },
    profile.linkedin && { label: "LinkedIn", href: profile.linkedin }
  ].filter(Boolean);
  el.innerHTML = links.map(l =>
    `<a class="btn btn-sm${l.primary ? " btn-primary" : ""}" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`
  ).join("");
}

function card(w) {
  const caseHref = `/case.html?id=${encodeURIComponent(w.id)}`;
  const primary = w.links.find(l => l.primary);
  return `
  <article class="card pf-card">
    <a class="pf-thumb" href="${caseHref}" style="--proj-accent:${esc(w.accent)}" tabindex="-1" aria-hidden="true">
      ${thumb(w)}
      ${w.access ? `<span class="chip pf-access">${esc(w.access)}</span>` : ""}
    </a>
    <div class="card-body">
      <p class="pf-meta">${esc(w.kind)} · ${esc(w.year)}</p>
      <h3><a href="${caseHref}">${esc(w.title)}</a></h3>
      <p class="muted">${esc(w.pitch)}</p>
      <div class="pf-actions">
        <a class="btn btn-sm" href="${caseHref}">Case study</a>
        ${primary ? `<a class="btn btn-sm btn-primary" href="${esc(primary.href)}"${external(primary.href)}>${esc(primary.label)} →</a>` : ""}
      </div>
    </div>
  </article>`;
}

function thumb(w) {
  if (w.image) {
    return `<img src="${esc(w.image)}" alt="" loading="lazy" />`;
  }
  return `<span class="pf-monogram">${esc(w.monogram || w.title.slice(0, 2))}</span>`;
}

// ---------- case study ----------

export function renderCase() {
  const main = document.getElementById("case-main");
  const id = new URLSearchParams(location.search).get("id");
  const w = findWork(id);

  if (!w) {
    document.title = "Not found — dhole.dev";
    main.innerHTML = `<div class="empty-state"><p>No project called “${esc(id || "")}”.</p>
      <a class="btn" href="/portfolio.html">All work →</a></div>`;
    return;
  }

  document.title = `${w.title} — Portfolio — dhole.dev`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", w.pitch);

  const i = work.indexOf(w);
  const prev = work[(i - 1 + work.length) % work.length];
  const next = work[(i + 1) % work.length];

  main.innerHTML = `
    <header class="case-head" style="--proj-accent:${esc(w.accent)}">
      <p class="eyebrow">${esc(w.kind)} · ${esc(w.year)}</p>
      <h1>${esc(w.title)}</h1>
      <p class="lede">${esc(w.pitch)}</p>
      ${w.links.length ? `<div class="hero-actions">
        ${w.links.map(l => `<a class="btn${l.primary ? " btn-primary" : ""}" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)} →</a>`).join("")}
      </div>` : ""}
    </header>

    ${w.image ? `<img class="case-hero" src="${esc(w.image)}" alt="${esc(w.imageAlt || w.title)}" />` : ""}

    <dl class="case-facts">
      <div class="case-wide"><dt>My role</dt><dd>${esc(w.role)}</dd></div>
      ${w.users ? `<div class="case-wide"><dt>Who it's for</dt><dd>${esc(w.users)}</dd></div>` : ""}
      <div><dt>Status</dt><dd>${esc(w.status)}</dd></div>
      ${w.access ? `<div><dt>How to see it</dt><dd>${esc(w.access)}</dd></div>` : ""}
    </dl>

    <div class="case-body">
      ${section("The problem", w.problem && `<p>${esc(w.problem)}</p>`)}
      ${section("What shipped", list(w.shipped))}
      ${section("Key decisions", w.decisions && w.decisions.map(d =>
        `<div class="case-hard"><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p></div>`).join(""))}
      ${section("Outcome", w.outcome && `<p>${esc(w.outcome)}</p>`)}
      ${section("What's next", w.next && `<p>${esc(w.next)}</p>`)}
      ${w.tags && w.tags.length ? `<section class="case-built"><h2>Built with</h2><div class="chips">${w.tags.map(t => `<span class="chip">${esc(t)}</span>`).join("")}</div></section>` : ""}
      ${w.note ? `<div class="notice info">${esc(w.note)}</div>` : ""}
    </div>

    <nav class="case-pager" aria-label="More work">
      <a href="/case.html?id=${encodeURIComponent(prev.id)}"><span class="dim">← Previous</span>${esc(prev.title)}</a>
      <a href="/portfolio.html" class="case-pager-all">All work</a>
      <a href="/case.html?id=${encodeURIComponent(next.id)}" class="next"><span class="dim">Next →</span>${esc(next.title)}</a>
    </nav>`;
}

function section(title, html) {
  return html ? `<section><h2>${esc(title)}</h2>${html}</section>` : "";
}

function list(items) {
  return items && items.length ? `<ul>${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
}

function external(href) {
  return /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : "";
}

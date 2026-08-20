// Projects index. Everything listed here should be openable in a browser;
// anything without a demo says so rather than looking clickable.

import { projects } from "../data/projects.js";
import { esc } from "./esc.js";

export function renderProjects() {
  const el = document.getElementById("projects-grid");

  if (!projects.length) {
    el.innerHTML = `<div class="empty-state"><p>Nothing published yet.</p></div>`;
    return;
  }

  el.innerHTML = projects.map(p => {
    const live = Boolean(p.demo);
    return `
    <article class="card project-card">
      ${live
        ? `<a class="project-preview" href="${esc(p.demo)}" style="--proj-accent:${esc(p.accent)}">
             <span class="project-preview-glyph" aria-hidden="true">${glyph(p.id)}</span>
             <span class="chip chip-live">Playable</span>
           </a>`
        : `<div class="project-preview" style="--proj-accent:${esc(p.accent)}">
             <span class="project-preview-glyph" aria-hidden="true">${glyph(p.id)}</span>
             <span class="chip">Write-up only</span>
           </div>`}
      <div class="card-body">
        <h3>${live ? `<a href="${esc(p.demo)}">${esc(p.title)}</a>` : esc(p.title)}</h3>
        <p class="muted">${esc(p.description)}</p>
        <div class="chips">
          ${p.tags.map(t => `<span class="chip">${esc(t)}</span>`).join("")}
          <span class="chip chip-accent">${esc(p.year)}</span>
        </div>
        ${live
          ? `<a class="btn btn-sm" href="${esc(p.demo)}" style="margin-top:auto">Open it →</a>`
          : `<span class="dim" style="margin-top:auto">No demo yet</span>`}
      </div>
    </article>`;
  }).join("");
}

function glyph(id) {
  if (id === "drift-tester") {
    return `<svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="32" cy="32" r="22" opacity=".35"/>
      <circle cx="32" cy="32" r="10" opacity=".55"/>
      <circle cx="41" cy="26" r="4.5" fill="currentColor" stroke="none"/>
      <path d="M32 32 L41 26" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="8"  y="26" width="8" height="12" rx="2" fill="currentColor" stroke="none" opacity=".5"/>
    <rect x="20" y="18" width="8" height="28" rx="2" fill="currentColor" stroke="none"/>
    <rect x="32" y="30" width="8" height="8"  rx="2" fill="currentColor" stroke="none" opacity=".5"/>
    <rect x="44" y="22" width="8" height="20" rx="2" fill="currentColor" stroke="none" opacity=".8"/>
  </svg>`;
}

// The /projects index: one row per data/projects.js entry, in data order.
//
// A row is the title (an h2 link to the tool), the capture when the entry has
// a real one, the description, the "Built with" line and a button named for
// the tool. Below 35em the capture is the phone crop and the row reads title,
// capture, description; from 60em the text takes 5 columns and the capture 7
// (assets/tools.css). An entry without a shot is a text-only row. No glyphs,
// chips or arrows.
//
// The row classes are the shared .index vocabulary in site.css; tools.css
// places them for this page.

import { projects } from "../data/projects.js";
import { esc } from "./esc.js";

// The phone crop below 35em, the desktop capture from 35em. width and height
// on both <source> and <img> reserve the box before the image arrives.
// The capture sits on a sweep panel and opens the tool, so a click on the
// pictured controls goes to the real ones. It is left out of the tab order:
// the title and the button already lead there.
function capture(shot, href, { eager }) {
  const m = shot.mobile;
  const img = m || shot;
  return `<a class="index-media" href="${href}" tabindex="-1">
      <picture>
        ${m ? `<source media="(min-width: 35em)" srcset="${esc(shot.src)}" width="${esc(shot.width)}" height="${esc(shot.height)}" />` : ""}
        <img src="${esc(img.src)}" width="${esc(img.width)}" height="${esc(img.height)}" alt="${esc(shot.alt)}"${eager ? "" : ` loading="lazy"`} decoding="async" />
      </picture>
    </a>`;
}

export function toolRow(p, { eager = false } = {}) {
  const href = esc(p.demo);
  const id = esc(p.id);
  return `<article class="index-row tool-row${p.shot ? "" : " tool-row--text"}" id="${id}" aria-labelledby="tool-${id}">
    <h2 class="index-title" id="tool-${id}"><a href="${href}">${esc(p.title)}</a></h2>
    ${p.shot ? capture(p.shot, href, { eager }) : ""}
    <div class="index-text">
      <p>${esc(p.description)}</p>
      ${p.builtWith ? `<p class="quiet">${esc(p.builtWith)}</p>` : ""}
      <div class="btn-row"><a class="btn" href="${href}">${esc(p.cta || `Open ${p.title}`)}</a></div>
    </div>
  </article>`;
}

export function renderProjects(el = document.getElementById("tools")) {
  if (!el) return;
  const live = projects.filter(p => p.demo);
  const firstShot = live.findIndex(p => p.shot);
  el.innerHTML = live.map((p, i) => toolRow(p, { eager: i === firstShot })).join("");
}

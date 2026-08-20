// Build log. The old site split this across three pages (current week, archive,
// weeks) that rendered nearly the same thing; it is one page now.
//
// Notes are read-only here. The old version let anyone type into the page and
// saved it to their own localStorage, which looked like editing the site but
// only ever changed their browser -- confusing on a page other people visit.

import { weeks } from "../data/weeks.js";
import { esc } from "./esc.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_LABELS = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned"
};

export function renderLog() {
  const el = document.getElementById("log-main");

  if (!weeks.length) {
    el.innerHTML = `<div class="empty-state"><p>No weeks logged yet.</p></div>`;
    return;
  }

  const today = new Date();
  const ordered = [...weeks].sort((a, b) => new Date(b.start) - new Date(a.start));

  el.innerHTML = ordered.map(week => {
    const current = new Date(week.start) <= today && today <= new Date(week.end);
    const entries = DAYS
      .map(day => ({ day, note: (week.notes || {})[day] }))
      .filter(e => e.note && e.note.trim());

    return `
      <article class="card log-card${current ? " current" : ""}">
        <div class="card-body">
          <div class="log-head">
            <h2>Week ${esc(week.id)} — ${esc(week.title)}</h2>
            ${current ? `<span class="chip chip-live">This week</span>` : ""}
          </div>
          <div class="chips">
            <span class="chip">${esc(week.start)} → ${esc(week.end)}</span>
            <span class="chip chip-accent">${esc(STATUS_LABELS[week.status] || week.status)}</span>
          </div>
          ${entries.length
            ? `<ol class="day-log">${entries.map(e => `
                 <li><span class="day-name">${esc(e.day)}</span><span>${esc(e.note)}</span></li>
               `).join("")}</ol>`
            : `<p class="dim">Nothing logged for this week yet.</p>`}
        </div>
      </article>`;
  }).join("");
}

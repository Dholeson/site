// Build log: every week in data/weeks.js on one page, newest first. The old
// site split this across three pages (current week, archive, weeks) that
// rendered nearly the same thing.
//
// Notes are read-only here. The old version let anyone type into the page and
// saved it to their own localStorage, which looked like editing the site but
// only ever changed their browser: confusing on a page other people visit.
//
// Each week is a section like the shipping page's (assets/info.css): its
// heading, then one line with its dates and status, then a .dl-rows of the
// days that have a note, in calendar order from the week's first day.
//
// Dates in the data are calendar days ("2026-01-28"). They are read as
// numbers, never through new Date("2026-01-28"), which means midnight UTC
// and shows the day before anywhere west of Greenwich.
//
// renderLog(el, list, now) takes optional arguments so test/info.test.js can
// render into a stand-in element; the page calls it with none.

import { weeks } from "../data/weeks.js";
import { esc } from "./esc.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const STATUS_LABELS = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned"
};

// "2026-01-28" -> { iso, y, m, d, weekday }, or null for anything else.
function parseDay(s) {
  const iso = String(s ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { iso, y, m: mo, d, weekday: t.getUTCDay() };
}

// The viewer's own calendar day, as "YYYY-MM-DD".
function localDay(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "January 28 to February 3, 2026", "January 5 to 11, 2026",
// "December 29, 2025 to January 4, 2026". Dates that can't be read are shown
// as written.
function formatRange(start, end) {
  const a = parseDay(start), b = parseDay(end);
  if (!a || !b) return [start, end].map(s => String(s ?? "").trim()).filter(Boolean).join(" to ");
  const md = x => `${MONTHS[x.m - 1]} ${x.d}`;
  if (a.y !== b.y) return `${md(a)}, ${a.y} to ${md(b)}, ${b.y}`;
  if (a.m !== b.m) return `${md(a)} to ${md(b)}, ${b.y}`;
  if (a.d !== b.d) return `${md(a)} to ${b.d}, ${b.y}`;
  return `${md(a)}, ${a.y}`;
}

// Both ends included.
function isCurrent(week, today) {
  const a = parseDay(week.start), b = parseDay(week.end);
  return Boolean(a && b) && a.iso <= today && today <= b.iso;
}

// The days that have a note, in calendar order from the week's first day
// (Sunday first when the start date can't be read).
function entriesOf(week) {
  const notes = (week.notes && typeof week.notes === "object") ? week.notes : {};
  const first = parseDay(week.start)?.weekday ?? 0;
  return DAYS.map((_, i) => DAYS[(first + i) % 7])
    .map(day => ({ day, note: typeof notes[day] === "string" ? notes[day].trim() : "" }))
    .filter(e => e.note);
}

function weekHtml(week, today, hid) {
  const name = String(week.title ?? "").trim();
  const title = `Week ${esc(week.id)}${name ? `: ${esc(name)}` : ""}`;
  const status = STATUS_LABELS[week.status] || String(week.status ?? "").trim();
  const meta = [formatRange(week.start, week.end), status].filter(Boolean).map(s => `${esc(s)}.`);
  if (isCurrent(week, today)) meta.push("This is the current week.");
  const entries = entriesOf(week);
  return `
    <article class="info-section log-week" aria-labelledby="${hid}">
      <h2 id="${hid}">${title}</h2>
      <div class="prose">
        ${meta.length ? `<p class="quiet">${meta.join(" ")}</p>` : ""}
        ${entries.length
          ? `<dl class="dl-rows">${entries.map(e => `<div><dt>${esc(e.day)}</dt><dd>${esc(e.note)}</dd></div>`).join("")}</dl>`
          : `<p>Nothing logged for this week yet.</p>`}
      </div>
    </article>`;
}

export function renderLog(el = document.getElementById("log-main"), list = weeks, now = new Date()) {
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<p>No weeks logged yet.</p>`;
    return;
  }
  const today = localDay(now);
  // ISO dates sort as text.
  const ordered = [...list].sort((a, b) => String(b.start ?? "").localeCompare(String(a.start ?? "")));
  el.innerHTML = `<div class="info-sections">${
    ordered.map((week, i) => weekHtml(week, today, `log-week-${i + 1}`)).join("")
  }</div>`;
}

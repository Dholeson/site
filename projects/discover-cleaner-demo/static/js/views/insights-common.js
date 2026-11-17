// Shared pieces for the Insights tabs: a small session cache for report payloads, chart slots,
// the ranked "top" list (Last.fm library style, with play buttons and change chips), the coverage
// banner and plain-language date/number helpers.
import { html, raw, fmt, infoTip, toDate, escapeHtml, notice } from '../core/ui.js';
import { isAbort } from '../core/api.js';
import { rankList, cover, playButton, deltaMark } from '../components/rank-list.js';

// The ranked list, covers and play buttons are shared with the artist page.
export { cover, playButton };

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ======================================================================= session cache
// Payloads for finished periods never change, so tab switches and Back are instant. Running
// periods are shown from cache at once and refreshed in the background (stale-while-revalidate).
const cache = new Map();
const CACHE_MAX = 60;

const keyOf = (path, params) => `${path}?${new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null && v !== '')).toString()}`;

export function peek(path, params) {
  return cache.get(keyOf(path, params)) || null;
}

/** GET through the session cache: a cached payload younger than maxAgeMs is returned as is. */
export async function cachedGet(api, path, params, { signal, maxAgeMs = 60000, force = false, timeoutMs } = {}) {
  const key = keyOf(path, params);
  const hit = cache.get(key);
  if (hit && !force && Date.now() - hit.at < maxAgeMs) return hit.data;
  const data = await api.get(path, { params, signal, timeoutMs });
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return data;
}

/** Forget cached payloads whose path starts with prefix (after hiding an artist, for example). */
export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

/** Warm the cache for a likely next view without surfacing errors. */
export function prefetch(api, path, params) {
  if (cache.has(keyOf(path, params))) return;
  cachedGet(api, path, params, { timeoutMs: 20000 }).catch(() => {});
}

export { isAbort };

// ======================================================================= charts
/** Put a chart figure into a slot, destroying the chart it replaces (observers, tooltip). */
export function putChart(slot, fig) {
  if (!slot) return fig;
  for (const old of slot.querySelectorAll('figure.chart')) old.chart?.destroy?.();
  if (fig) slot.replaceChildren(fig); else slot.replaceChildren();
  return fig;
}

/** Update a chart in place when one of the same kind is already there (keeps focus, no flash). */
export function upsertChart(slot, kind, make, data, opts) {
  const cur = slot?.querySelector(`figure.chart[data-ins-kind="${kind}"]`);
  if (cur && cur.chart) {
    cur.chart.update(data, opts);
    return cur;
  }
  const fig = make(data, opts);
  fig.dataset.insKind = kind;
  return putChart(slot, fig);
}

export function destroyCharts(root) {
  root?.querySelectorAll('figure.chart').forEach((f) => f.chart?.destroy?.());
}

// ======================================================================= text helpers
/** 'YYYY-MM-DD' → "Sep 21, 2022" (year shown when it isn't this year, or always). */
export function dayText(day, { year = 'auto', weekday = false } = {}) {
  return day ? fmt.date(day, { year, weekday }) : '—';
}

/** "Apr 25 – Jun 21, 2025" (drops the first year when both ends share it). */
export function rangeText(start, end) {
  const a = toDate(start); const b = toDate(end);
  if (!a || !b) return '—';
  if (a.getTime() === b.getTime()) return fmt.date(a, { year: 'always' });
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const right = b.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} – ${right}`;
}

/** 0..23 → "4 PM"; with {range:true} → "4–5 PM". */
export function hourText(h, { range = false } = {}) {
  if (h == null) return '—';
  if (!range) return fmt.hour(h);
  const a = fmt.hour(h); const b = fmt.hour((Number(h) + 1) % 24);
  const [an, ap] = a.split(' '); const [bn, bp] = b.split(' ');
  return ap === bp ? `${an}–${bn} ${bp}` : `${a}–${b}`;
}

/** Listening seconds → "38 h" / "4.5 h" / "45 min". */
export function hoursText(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '—';
  if (s < 3600) return `${Math.max(0, Math.round(s / 60))} min`;
  return fmt.hours(s);
}

/** Split an hours string into value + unit for stat tiles ("38 h" → ["38", "h"]). */
export function hoursParts(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return ['—', ''];
  if (s < 3600) return [String(Math.max(0, Math.round(s / 60))), 'min'];
  const h = s / 3600;
  return [h < 10 ? h.toFixed(1) : fmt.num(Math.round(h)), 'h'];
}

/** Percentage change, or null when the base is too small to mean anything (matches the API rule). */
export function pctChange(cur, prev, minPrev = 5) {
  const c = Number(cur); const p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || prev == null || p < minPrev) return null;
  return Math.round(((c - p) / p) * 100);
}

/** "vs August" / "vs Aug 1 – 25" / "vs 2024": the previous period, without the current year. */
export function prevShort(period) {
  if (!period || !period.prev_label) return '';
  const y = String(period.start_day || '').slice(0, 4);
  let s = String(period.prev_label);
  if (period.type !== 'year' && y) s = s.replace(new RegExp(`,? ${y}$`), '');
  return `vs ${s}`;
}

/** Arrow icon + "+12%" / "−8%" (the stat tiles' look) with a screen-reader sentence. */
export function deltaChip(pct, label = '') {
  if (pct == null || !Number.isFinite(Number(pct))) return '';
  const n = Number(pct);
  const txt = fmt.pct(Math.abs(n));
  const words = n > 0 ? `Up ${txt}` : n < 0 ? `Down ${txt}` : 'No change';
  return html`<span class="ins-delta">${deltaMark(n, { sr: words })}${label ? html` <span class="ins-delta-label">${label}</span>` : ''}</span>`;
}

// ======================================================================= banners
/** Coverage banner: always shown when the API has a note (e.g. Last.fm stopped syncing). */
export function coverageBanner(coverage, { compact = false } = {}) {
  const note = coverage?.note;
  if (!note) return '';
  return notice({
    tone: 'warning', compact, role: 'note', className: 'ins-banner',
    body: note,
    actions: html`<a class="btn btn-secondary btn-sm ins-banner-action" href="#/settings?section=history">Sync in Settings</a>`,
  });
}

// ======================================================================= top lists
/** Ranked list with bars (components/rank-list.js). kind: 'artists' | 'albums' | 'tracks'. */
export function topList(items, opts = {}) {
  return rankList(items, opts);
}

// ======================================================================= misc components
/** Card with an h2/h3 header (title + ⓘ + one-line description) and a body slot. */
export function card({ id, title, desc, info, actions, body = '', className = '', level = 2 }) {
  const h = level === 3 ? 'h3' : 'h2';
  return html`<section class="card ins-card${className ? ` ${className}` : ''}" ${id ? raw(`aria-labelledby="${escapeHtml(id)}-title"`) : ''}>
    <div class="ins-card-head">
      <div class="ins-card-heading">
        ${raw(`<${h} class="ins-card-title"${id ? ` id="${escapeHtml(id)}-title"` : ''}>`)}<span>${title}</span>${info ? infoTip(info, { label: title }) : ''}${raw(`</${h}>`)}
        ${desc ? html`<p class="ins-card-desc">${desc}</p>` : ''}
      </div>
      ${actions ? html`<div class="ins-card-actions">${actions}</div>` : ''}
    </div>
    <div class="ins-card-body"${id ? raw(` id="${escapeHtml(id)}"`) : ''}>${body}</div>
  </section>`;
}

/** Scroll an element into view inside #view only when it is above the visible area. */
export function revealTop(el) {
  const view = document.getElementById('view');
  if (!el || !view) return;
  const r = el.getBoundingClientRect();
  const v = view.getBoundingClientRect();
  if (r.top < v.top) view.scrollTop += r.top - v.top - 8;
}

// Small building blocks shared by the Settings sections: switch, inline notices, status chips,
// live relative times, byte sizes, field errors, and the /api/settings loader that the Accounts
// and Advanced sections share. Styles: static/css/views/settings.css (.st-*), which also covers
// dialogs (they live in #modal-root, outside .view-settings).
import api from '../core/api.js';
import { html, raw, icon, fmt, toDate, notice as coreNotice } from '../core/ui.js';

// ======================================================================= controls
/**
 * switchControl({id, checked, labelledby, describedby, label, disabled}) → a role="switch"
 * button. The visible label lives next to it (labelledby) so the whole row reads naturally.
 */
export function switchControl({ id, checked = false, labelledby, describedby, label, disabled = false, name } = {}) {
  return html`<button type="button" class="st-switch" role="switch" ${id ? raw(`id="${id}"`) : ''}
    aria-checked="${checked ? 'true' : 'false'}"
    ${labelledby ? raw(`aria-labelledby="${labelledby}"`) : ''}
    ${describedby ? raw(`aria-describedby="${describedby}"`) : ''}
    ${label ? html`aria-label="${label}"` : ''}
    ${name ? html`data-name="${name}"` : ''}
    ${disabled ? raw('disabled') : ''}><span class="st-switch-thumb" aria-hidden="true"></span></button>`;
}

export function setSwitch(btn, on) {
  if (btn) btn.setAttribute('aria-checked', on ? 'true' : 'false');
}

export const switchOn = (btn) => btn?.getAttribute('aria-checked') === 'true';

// ======================================================================= feedback
/** Inline banner: tone info | good | warning | critical. The shared core notice (same look on every page). */
export const notice = (opts = {}) => coreNotice(opts);

/** Status chip: tone good | warning | critical | muted, always icon + words (never colour alone). */
export function statusChip(tone, label, iconName) {
  const ic = iconName || { good: 'checkCircle', warning: 'alert', critical: 'alertCircle', muted: 'clock', busy: 'refresh' }[tone] || 'info';
  return html`<span class="chip st-chip" data-tone="${tone}">${icon(ic)}<span>${label}</span></span>`;
}

// ======================================================================= time + sizes
/** <time> that keeps saying "5 minutes ago" correctly: refreshRelTimes() rewrites [data-rel]. */
export function relTime(ts, { fallback = 'never' } = {}) {
  const d = toDate(ts);
  if (!d) return html`<span>${fallback}</span>`;
  return html`<time class="st-rel" data-rel="${d.getTime()}" datetime="${d.toISOString()}" title="${fullDate(d)}">${fmt.relTime(d)}</time>`;
}

export function refreshRelTimes(root) {
  if (!root) return;
  root.querySelectorAll('[data-rel]').forEach((el) => {
    const t = fmt.relTime(Number(el.dataset.rel));
    if (el.textContent !== t) el.textContent = t;
  });
}

/** "Sep 25, 2026, 3:12 PM" */
export function fullDate(v) {
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "3:12 PM" */
export function clockTime(v) {
  const d = toDate(v);
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';
}

/** 41418752 → "41.4 MB" */
export function fmtBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  if (v < 1024) return `${v} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024; let i = 0;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i += 1; }
  return `${x >= 100 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}

/** Days between a past timestamp and now (whole days, ≥ 0). */
export function daysSince(ts) {
  const d = toDate(ts);
  return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400e3)) : null;
}

/** "12 s", "2 min", "1 min 30 s" for the clear-after threshold. */
export function secondsLabel(s, { long = false } = {}) {
  const v = Math.round(Number(s) || 0);
  if (v < 60) return long ? `${v} ${v === 1 ? 'second' : 'seconds'}` : `${v} s`;
  const m = Math.floor(v / 60); const r = v % 60;
  if (long) return r ? `${m} min ${r} s` : `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  return r ? `${m} min ${r} s` : `${m} min`;
}

// ======================================================================= field errors
/** Show/clear an inline error under a form control (aria-invalid + aria-describedby). */
export function setFieldError(input, message) {
  if (!input) return;
  const field = input.closest('.st-field') || input.parentElement;
  let err = field?.querySelector('.st-field-error');
  if (!message) {
    input.removeAttribute('aria-invalid');
    if (err) err.hidden = true;
    return;
  }
  if (!err && field) {
    err = document.createElement('p');
    err.className = 'st-field-error';
    err.id = `${input.id || 'f'}-err`;
    field.appendChild(err);
  }
  if (!err) return;
  err.hidden = false;
  err.replaceChildren();
  const ic = document.createElement('span');
  ic.className = 'st-field-error-icon';
  ic.setAttribute('aria-hidden', 'true');
  ic.textContent = '!';
  err.append(ic, document.createTextNode(message));
  input.setAttribute('aria-invalid', 'true');
  const ids = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  ids.add(err.id);
  input.setAttribute('aria-describedby', [...ids].join(' '));
}

// ======================================================================= /api/settings
// One loader for the page: Accounts and Advanced both read it, and a save from either refreshes
// both (the POST answers with the full, masked list).
const listeners = new Set();
let current = null;
let inflight = null;

function adopt(body) {
  const list = Array.isArray(body?.settings) ? body.settings : [];
  current = {
    list,
    byKey: Object.fromEntries(list.map((s) => [s.key, s])),
    restartPending: Array.isArray(body?.restart_pending) ? body.restart_pending : list.filter((s) => s.pending_restart).map((s) => s.key),
    envPath: body?.env_path || current?.envPath || '',
  };
  listeners.forEach((fn) => { try { fn(current); } catch (err) { console.error(err); } });
  return current;
}

export const settingsStore = {
  get current() { return current; },
  load({ force = false, signal } = {}) {
    if (current && !force) return Promise.resolve(current);
    if (inflight && !force) return inflight;
    inflight = api.get('/api/settings', { signal, timeoutMs: 10000 })
      .then(adopt)
      .finally(() => { inflight = null; });
    return inflight;
  },
  /** POST {updates}; resolves to the server's answer (and refreshes every listener). */
  async save(updates) {
    const r = await api.post('/api/settings', { updates }, { timeoutMs: 20000 });
    if (r?.settings) adopt({ settings: r.settings, env_path: current?.envPath });
    return r;
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/** Did the user type something new into a secret input? (Empty = keep the saved one.) */
export const secretTyped = (input) => !!(input && input.value.trim());

/** Placeholder for a masked secret: "Saved (••••1234) — type to replace". */
export function secretPlaceholder(item, emptyText = 'Paste it here') {
  if (item?.has_value) return `Saved (${item.hint || '••••'}) — type to replace`;
  return emptyText;
}


// UI toolkit for the v2 shell and views: safe templating, formatters, feedback (toasts, dialogs,
// tooltips, popovers/menus), state blocks and small components.
//
// Rules (see SPEC.md "Frontend architecture"):
// - Markup reaches the DOM only through html`` + mount(). mount(el, 'plain string') renders TEXT.
// - No inline event handlers: render data-action="name" data-*="..." and handle them with
//   on(root, 'click', '[data-action]', fn) or actions(root, {name: fn}).
// - Navigation uses real links (href="#/artist/…"), so middle-click and back/forward work.
// - Global actions (registered by main.js, usable from any view without wiring):
//   data-action="play-uri" data-uri="spotify:track:…" [data-name] · data-action="play-track"
//   data-artist="…" data-name="…" (no Spotify id: resolved via /api/v2/resolve, toast when not found) ·
//   data-action="open-artist" data-name="…" · data-action="undo-clear" data-seq="…" ·
//   data-action="show-shortcuts". Views must not reuse these names.
import { html, raw, escapeHtml, safeUrl, toHtml, isSafeHtml, SafeHtml } from './ui-safe.js';
import { icon } from './icons.js';

export { html, raw, escapeHtml, safeUrl, toHtml, isSafeHtml, SafeHtml, icon };

let uidSeq = 0;
export const uid = (prefix = 'ui') => `${prefix}-${++uidSeq}`;

/** Replace el's content. Accepts html`` values (or arrays of them), DOM nodes, or plain text. */
export function mount(el, content) {
  if (!el) return el;
  if (content instanceof Node) el.replaceChildren(content);
  else el.innerHTML = toHtml(content);
  return el;
}

export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

// ======================================================================= formatters
const isNum = (v) => v !== null && v !== undefined && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v));
const NF = new Intl.NumberFormat('en-US');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const MINUS = '−';
const DASH = '—';

/** Parse ms epoch, 'YYYY-MM-DD' (LOCAL day), 'YYYY-MM', ISO strings or Date into a Date (or null). */
export function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (isNum(v)) return new Date(Number(v));
  if (typeof v === 'string') {
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = v.match(/^(\d{4})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, 1);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const fmt = {
  /** 1234 → "1,234"; null → "—". digits: fixed decimals. */
  num(n, { digits = 0 } = {}) {
    if (!isNum(n)) return DASH;
    const v = Number(n);
    if (!digits) return NF.format(Math.round(v)).replace('-', MINUS);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v).replace('-', MINUS);
  },
  /** 1284 → "1,284", 12900 → "12.9K" (exact below 10,000). */
  compact(n) {
    if (!isNum(n)) return DASH;
    const v = Number(n);
    return (Math.abs(v) < 10000 ? NF.format(Math.round(v)) : CF.format(v)).replace('-', MINUS);
  },
  /** Percent value (14.2 → "14%"). {fraction:true} for 0..1 input, {signed:true} for "+14%". */
  pct(v, { digits, signed = false, fraction = false } = {}) {
    if (!isNum(v)) return DASH;
    let x = Number(v) * (fraction ? 100 : 1);
    const d = digits ?? (Math.abs(x) > 0 && Math.abs(x) < 1 ? 1 : 0);
    const s = Math.abs(x).toFixed(d);
    const isZero = Number(s) === 0;
    const sign = x < 0 && !isZero ? MINUS : signed && !isZero ? '+' : '';
    return `${sign}${s}%`;
  },
  signedPct(v, opts = {}) { return fmt.pct(v, { ...opts, signed: true }); },
  /** Signed integer: "+12", "−3", "0". */
  signed(n) {
    if (!isNum(n)) return DASH;
    const v = Math.round(Number(n));
    return v > 0 ? `+${NF.format(v)}` : v < 0 ? `${MINUS}${NF.format(-v)}` : '0';
  },
  /** Human duration: "2h 11m", "4m 5s", "45s", "3d 4h". Input ms by default; {unit:'s'} for seconds. */
  duration(v, { unit = 'ms' } = {}) {
    if (!isNum(v)) return DASH;
    let s = Math.max(0, Math.round(unit === 's' ? Number(v) : Number(v) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); const sec = s - m * 60;
    if (d) return h ? `${d}d ${h}h` : `${d}d`;
    if (h) return m ? `${h}h ${m}m` : `${h}h`;
    if (m) return sec && m < 10 ? `${m}m ${sec}s` : `${m}m`;
    return `${sec}s`;
  },
  /** Listening time in hours from seconds: 4.5 h, 312 h, 1,204 h. */
  hours(seconds) {
    if (!isNum(seconds)) return DASH;
    const h = Number(seconds) / 3600;
    return h < 10 ? `${h.toFixed(1)} h` : `${NF.format(Math.round(h))} h`;
  },
  /** Track clock: 200000 → "3:20", 3723000 → "1:02:03". */
  clock(ms) {
    if (!isNum(ms)) return '0:00';
    let s = Math.max(0, Math.floor(Number(ms) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); const sec = String(s - m * 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  },
  /** "just now", "5 minutes ago", "yesterday", "in 2 hours", then a date. */
  relTime(v, now = Date.now()) {
    const d = toDate(v);
    if (!d) return DASH;
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
    if (abs < 45e3) return diff <= 0 ? 'just now' : 'in a moment';
    if (abs < 45 * MIN) return RTF.format(Math.round(diff / MIN), 'minute');
    if (abs < 22 * HOUR) return RTF.format(Math.round(diff / HOUR), 'hour');
    if (abs < 6.5 * DAY) return RTF.format(Math.round(diff / DAY), 'day');
    if (abs < 5 * 7 * DAY) return RTF.format(Math.round(diff / (7 * DAY)), 'week');
    return fmt.date(d);
  },
  /** "Mar 4" (this year) / "Mar 4, 2024". {year:'always'|'never'|'auto'}, {weekday:true}. */
  date(v, { year = 'auto', weekday = false, month = 'short' } = {}) {
    const d = toDate(v);
    if (!d) return DASH;
    const showYear = year === 'always' || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
    const o = { month, day: 'numeric' };
    if (showYear) o.year = 'numeric';
    if (weekday) o.weekday = 'short';
    return d.toLocaleDateString('en-US', o);
  },
  /** 'YYYY-MM-DD' (local) → "Today" / "Yesterday" / "Mon, Mar 4" (+ year when not this year). */
  dayLabel(day) {
    const d = toDate(day);
    if (!d) return DASH;
    const today = new Date();
    if (sameDay(d, today)) return 'Today';
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (sameDay(d, y)) return 'Yesterday';
    return fmt.date(d, { weekday: true });
  },
  /** 'YYYY-MM' → "March 2026" ({short:true} → "Mar 2026"). */
  month(ym, { short = false } = {}) {
    const d = toDate(ym);
    if (!d) return DASH;
    return d.toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: 'numeric' });
  },
  /** Hour of day 0..23 → "4 PM". */
  hour(h) {
    if (!isNum(h)) return DASH;
    const n = ((Number(h) % 24) + 24) % 24;
    return `${n % 12 === 0 ? 12 : n % 12} ${n < 12 ? 'AM' : 'PM'}`;
  },
  /** plural(1, 'play') → "1 play"; plural(1234, 'play') → "1,234 plays". */
  plural(n, one, many) {
    const word = Number(n) === 1 ? one : (many || `${one}s`);
    return `${fmt.num(n)} ${word}`;
  },
  /** "Dance Gavin Dance" → "DD", "Woe, Is Me" → "WM" (first + last word, punctuation ignored). */
  initials(name) {
    const parts = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  },
};

// ======================================================================= delegated events
/** Delegate: handler(event, matchedEl, matchedEl.dataset). Returns an unsubscribe function. */
export function on(el, type, selector, handler, options) {
  const fn = (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest(selector) : null;
    if (target && el.contains(target)) handler(ev, target, target.dataset);
  };
  el.addEventListener(type, fn, options);
  return () => el.removeEventListener(type, fn, options);
}

/**
 * actions(root, {name(dataset, el, ev) {…}}) — dispatches clicks on [data-action] by name.
 * Non-button elements with data-action also respond to Enter/Space (give them role="button" tabindex="0").
 */
export function actions(root, map) {
  const run = (ev, el) => {
    const fn = map[el.dataset.action];
    if (!fn) return;
    if (el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
    if (el.tagName === 'A' && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) ev.preventDefault();
    try {
      const r = fn(el.dataset, el, ev);
      if (r && typeof r.catch === 'function') r.catch((err) => reportError(err));
    } catch (err) { reportError(err); }
  };
  const offClick = on(root, 'click', '[data-action]', (ev, el) => run(ev, el));
  const offKey = on(root, 'keydown', '[data-action]', (ev, el) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      ev.preventDefault();
      run(ev, el);
    }
  });
  return () => { offClick(); offKey(); };
}

/** Report a caught-but-unexpected error to the dev error list without breaking the UI. */
export function reportError(err) {
  if (err && (err.name === 'AbortError')) return;
  try {
    (window.__errors ||= []).push({ message: String(err?.message || err), stack: err?.stack || '', ts: Date.now(), handled: true });
    if (window.__syncJsErrors) window.__syncJsErrors();
    else if (document.body) document.body.dataset.jsErrors = String(window.__errors.length);
  } catch { /* ignore */ }
  console.error(err);
}

// ======================================================================= overlays + Esc
const overlayStack = [];

/** Register something Esc should close. Returns a remover. The top-most overlay closes first. */
export function pushOverlay(close) {
  const entry = { close };
  overlayStack.push(entry);
  return () => {
    const i = overlayStack.indexOf(entry);
    if (i >= 0) overlayStack.splice(i, 1);
  };
}

function onGlobalKeydown(ev) {
  if (ev.key !== 'Escape') return;
  if (document.querySelector('dialog[open]')) return; // native <dialog> handles its own Esc
  if (hideTooltip()) { ev.preventDefault(); return; }
  const top = overlayStack.pop();
  if (top) {
    ev.preventDefault();
    try { top.close(); } catch (err) { reportError(err); }
  }
}

// ======================================================================= tooltips
// Any element with data-tip="text" gets a tooltip on hover (short delay) and keyboard focus.
// .info-tip buttons also toggle it on click/tap. Text is set with textContent (never HTML).
let tipEl = null;
let tipOwner = null;
let tipTimer = null;
let tipPinned = false;

function ensureTip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.id = 'ui-tooltip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function positionFloating(el, anchor, placement = 'top') {
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth; const h = el.offsetHeight;
  const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
  const gap = 8;
  let top;
  if (placement === 'right') {
    const left = r.right + gap;
    if (left + w <= vw - 8) {
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(Math.min(Math.max(8, r.top + r.height / 2 - h / 2), vh - h - 8))}px`;
      return;
    }
  }
  if (placement === 'top') {
    top = r.top - h - gap;
    if (top < 8) top = r.bottom + gap;
  } else {
    top = r.bottom + gap;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - gap);
  }
  let left = r.left + r.width / 2 - w / 2;
  left = Math.min(Math.max(8, left), vw - w - 8);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function showTooltip(anchor, text, { pinned = false } = {}) {
  if (!anchor || !text) return;
  const el = ensureTip();
  if (tipOwner && tipOwner !== anchor) releaseTipOwner();
  el.textContent = text;
  tipOwner = anchor;
  tipPinned = pinned;
  if (anchor.classList.contains('info-tip')) anchor.setAttribute('aria-expanded', 'true');
  else if (anchor.getAttribute('aria-label') !== text) anchor.setAttribute('aria-describedby', el.id);
  positionFloating(el, anchor, anchor.dataset.tipPlacement || 'top');
  el.classList.add('is-visible');
}

function releaseTipOwner() {
  if (!tipOwner) return;
  if (tipOwner.getAttribute('aria-describedby') === 'ui-tooltip') tipOwner.removeAttribute('aria-describedby');
  if (tipOwner.classList.contains('info-tip')) tipOwner.setAttribute('aria-expanded', 'false');
  tipOwner = null;
}

/** Hides the tooltip; returns true if one was visible. */
export function hideTooltip() {
  clearTimeout(tipTimer);
  if (!tipEl || !tipEl.classList.contains('is-visible')) { releaseTipOwner(); return false; }
  tipEl.classList.remove('is-visible');
  releaseTipOwner();
  tipPinned = false;
  return true;
}

function initTooltips() {
  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'touch') return;
    const t = ev.target instanceof Element ? ev.target.closest('[data-tip]') : null;
    if (!t || t === tipOwner) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { if (t.isConnected && t.matches(':hover')) showTooltip(t, t.dataset.tip); }, t.classList.contains('info-tip') ? 120 : 450);
  });
  document.addEventListener('pointerout', (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('[data-tip]') : null;
    if (!t) return;
    if (ev.relatedTarget instanceof Node && t.contains(ev.relatedTarget)) return;
    clearTimeout(tipTimer);
    if (t === tipOwner && !tipPinned) hideTooltip();
  });
  document.addEventListener('focusin', (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('[data-tip]') : null;
    if (t && t.matches(':focus-visible')) showTooltip(t, t.dataset.tip);
  });
  document.addEventListener('focusout', (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('[data-tip]') : null;
    if (t && t === tipOwner) hideTooltip();
  });
  document.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('.info-tip[data-tip]') : null;
    if (t) {
      ev.preventDefault();
      if (tipOwner === t && tipPinned) hideTooltip();
      else showTooltip(t, t.dataset.tip, { pinned: true });
      return;
    }
    if (tipPinned) hideTooltip();
  });
  document.addEventListener('scroll', () => { if (tipOwner) hideTooltip(); }, true);
  window.addEventListener('resize', () => hideTooltip());
}

// ======================================================================= popover + menu
const openPopovers = new WeakMap();

/**
 * Floating panel anchored to `anchor`. Calling it again for the same anchor closes it (toggle)
 * and returns null. Closes on outside pointerdown, Esc (focus returns to the anchor), or close().
 * placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'.
 */
export function popover(anchor, content, { placement = 'bottom-start', className = '', role = 'dialog', label, onClose, focus = true } = {}) {
  const existing = openPopovers.get(anchor);
  if (existing) { existing.close(); return null; }
  const el = document.createElement('div');
  el.className = `popover ${className}`.trim();
  el.setAttribute('role', role);
  if (label) el.setAttribute('aria-label', label);
  el.tabIndex = -1;
  el.id = uid('pop');
  mount(el, content);
  document.body.appendChild(el);

  const position = () => {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth; const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
    const [side, align] = placement.split('-');
    let top = side === 'top' ? r.top - h - 6 : r.bottom + 6;
    if (side === 'top' && top < 8) top = r.bottom + 6;
    if (side !== 'top' && top + h > vh - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.min(Math.max(8, left), vw - w - 8);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
  };
  position();

  anchor.setAttribute('aria-expanded', 'true');
  if (!anchor.hasAttribute('aria-controls')) anchor.setAttribute('aria-controls', el.id);
  let closed = false;
  const onDown = (ev) => { if (!el.contains(ev.target) && !anchor.contains(ev.target)) api.close(); };
  const onScroll = (ev) => { if (!el.contains(ev.target)) position(); };
  const removeOverlay = pushOverlay(() => api.close({ restoreFocus: true }));
  document.addEventListener('pointerdown', onDown, true);
  window.addEventListener('resize', position);
  document.addEventListener('scroll', onScroll, true);

  const api = {
    el,
    reposition: position,
    close({ restoreFocus = false } = {}) {
      if (closed) return;
      closed = true;
      removeOverlay();
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', onScroll, true);
      anchor.setAttribute('aria-expanded', 'false');
      if (anchor.getAttribute('aria-controls') === el.id) anchor.removeAttribute('aria-controls');
      openPopovers.delete(anchor);
      const hadFocus = el.contains(document.activeElement);
      el.remove();
      if ((restoreFocus || hadFocus) && anchor.isConnected) anchor.focus({ preventScroll: true });
      if (onClose) { try { onClose(); } catch (err) { reportError(err); } }
    },
  };
  openPopovers.set(anchor, api);
  if (focus) {
    const first = el.querySelector('[autofocus], button:not([disabled]), [href], input, [tabindex="0"]');
    (first || el).focus({ preventScroll: true });
  }
  return api;
}

/**
 * menu(anchor, items, opts) — an accessible action menu (role=menu) in a popover.
 * items: [{label, icon, onSelect, href, external, danger, disabled, hint} | {separator:true} | {heading:'…'}]
 * Arrow keys / Home / End move focus, Enter activates, Esc or Tab closes.
 */
export function menu(anchor, items, opts = {}) {
  const body = items.map((it, i) => {
    if (it.separator) return html`<div class="menu-sep" role="separator"></div>`;
    if (it.heading) return html`<div class="menu-label" role="presentation">${it.heading}</div>`;
    const inner = html`${it.icon ? icon(it.icon) : ''}<span class="truncate">${it.label}</span>${it.hint ? html`<span class="spacer"></span><span class="muted small">${it.hint}</span>` : ''}`;
    const cls = `menu-item${it.danger ? ' menu-item-danger' : ''}`;
    if (it.href) {
      return html`<a class="${cls}" role="menuitem" tabindex="-1" data-idx="${i}" href="${safeUrl(it.href)}" ${it.external ? raw('target="_blank" rel="noopener noreferrer"') : ''}>${inner}</a>`;
    }
    return html`<button type="button" class="${cls}" role="menuitem" tabindex="-1" data-idx="${i}" ${it.disabled ? raw('aria-disabled="true"') : ''}>${inner}</button>`;
  });
  const pop = popover(anchor, body, { placement: 'bottom-end', ...opts, role: 'menu', focus: false });
  if (!pop) return null;
  const el = pop.el;
  const itemsEls = () => [...el.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
  const focusAt = (i) => { const list = itemsEls(); if (list.length) list[(i + list.length) % list.length].focus(); };
  el.addEventListener('keydown', (ev) => {
    const list = itemsEls();
    const idx = list.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); focusAt(idx + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); focusAt(idx - 1); }
    else if (ev.key === 'Home') { ev.preventDefault(); focusAt(0); }
    else if (ev.key === 'End') { ev.preventDefault(); focusAt(list.length - 1); }
    else if (ev.key === 'Tab') { pop.close({ restoreFocus: true }); }
  });
  el.addEventListener('click', (ev) => {
    const itemEl = ev.target instanceof Element ? ev.target.closest('[data-idx]') : null;
    if (!itemEl || itemEl.getAttribute('aria-disabled') === 'true') return;
    const it = items[Number(itemEl.dataset.idx)];
    if (!it) return;
    pop.close({ restoreFocus: !it.href });
    if (it.onSelect) {
      try {
        const r = it.onSelect(ev);
        if (r && typeof r.catch === 'function') r.catch(reportError);
      } catch (err) { reportError(err); }
    }
  });
  focusAt(0);
  return pop;
}

// ======================================================================= toasts
const TOAST_ICONS = { success: 'checkCircle', info: 'info', warning: 'alert', error: 'alertCircle' };
const toastsByKey = new Map();
const MAX_TOASTS = 4;

function toastRegion() {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

/**
 * toast(message, {kind, action:{label, onClick}, timeoutMs, persistent, key, detail, icon})
 * kind: 'info' | 'success' | 'warning' | 'error'. persistent:true keeps it until dismissed
 * (use for errors that need attention). key: a new toast with the same key replaces the old one.
 * message/detail may be plain text or html``. Returns {el, dismiss(), update(message, opts)}.
 */
export function toast(message, opts = {}) {
  const { kind = 'info', action, persistent = false, key, detail, icon: iconName } = opts;
  const timeoutMs = opts.timeoutMs ?? (action ? 9000 : kind === 'error' ? 8000 : 4500);
  const region = toastRegion();
  if (key && toastsByKey.has(key)) toastsByKey.get(key).dismiss({ immediate: true });

  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.kind = kind;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  let timer = null;
  let remaining = persistent ? null : timeoutMs;
  let startedAt = 0;
  let gone = false;

  const render = (msg, det, act) => {
    mount(el, html`
      <span class="toast-icon">${icon(iconName || TOAST_ICONS[kind] || 'info')}</span>
      <div class="toast-msg">${msg}${det ? html`<span class="toast-detail">${det}</span>` : ''}</div>
      ${act ? html`<button type="button" class="toast-action">${act.label}</button>` : ''}
      <button type="button" class="toast-close" aria-label="Dismiss notification">${icon('close')}</button>`);
  };
  let currentAction = action;
  render(message, detail, action);

  const stop = () => { if (timer) { clearTimeout(timer); timer = null; remaining = Math.max(1200, remaining - (Date.now() - startedAt)); } };
  const start = () => { if (remaining == null || gone) return; startedAt = Date.now(); timer = setTimeout(() => api.dismiss(), remaining); };

  const api = {
    el,
    dismiss({ immediate = false } = {}) {
      if (gone) return;
      gone = true;
      clearTimeout(timer);
      if (key && toastsByKey.get(key) === api) toastsByKey.delete(key);
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.remove(); return; }
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 180);
    },
    update(msg, o = {}) {
      if (gone) return;
      currentAction = o.action !== undefined ? o.action : currentAction;
      if (o.kind) { el.dataset.kind = o.kind; }
      render(msg, o.detail, currentAction);
      if (o.timeoutMs !== undefined || o.persistent !== undefined) {
        stop();
        remaining = o.persistent ? null : (o.timeoutMs ?? timeoutMs);
        start();
      }
    },
  };

  el.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (!t) return;
    if (t.closest('.toast-close')) { api.dismiss(); return; }
    if (t.closest('.toast-action') && currentAction) {
      const cb = currentAction.onClick;
      api.dismiss();
      try {
        const r = cb && cb();
        if (r && typeof r.catch === 'function') r.catch(reportError);
      } catch (err) { reportError(err); }
    }
  });
  el.addEventListener('pointerenter', stop);
  el.addEventListener('pointerleave', start);
  el.addEventListener('focusin', stop);
  el.addEventListener('focusout', (ev) => { if (!el.contains(ev.relatedTarget)) start(); });

  region.appendChild(el);
  if (key) toastsByKey.set(key, api);
  const live = [...region.querySelectorAll('.toast:not(.is-leaving)')];
  if (live.length > MAX_TOASTS) live.slice(0, live.length - MAX_TOASTS).forEach((n) => n.remove());
  start();
  return api;
}

/** Toast for a caught ApiError (or any error): the message says what happened. */
export function toastError(err, fallback = 'Something went wrong.') {
  if (err && err.name === 'AbortError') return null;
  const msg = (err && err.message) || fallback;
  return toast(msg, { kind: 'error' });
}

// ======================================================================= dialogs
function modalRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

/**
 * openDialog({title, subtitle, body, actions:[{label, kind, value}], wide, initialFocus})
 * A native modal <dialog>: focus moves in, Esc/backdrop/× close it, focus returns to the opener.
 * Returns {el, body, close(value), done: Promise<value>} ('' when dismissed).
 */
export function openDialog({ title, subtitle, body = '', actions: acts = [], wide = false, initialFocus, className = '' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal${wide ? ' modal-wide' : ''}${className ? ' ' + className : ''}`;
  const id = uid('dlg');
  dlg.setAttribute('aria-labelledby', `${id}-title`);
  mount(dlg, html`
    <div class="modal-head">
      <div class="page-heading">
        <h2 class="modal-title" id="${id}-title">${title}</h2>
        ${subtitle ? html`<p class="modal-sub">${subtitle}</p>` : ''}
      </div>
      <button type="button" class="btn btn-icon" data-dialog-close aria-label="Close dialog">${icon('close')}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${acts.length ? html`<div class="modal-foot">${acts.map((a) => html`<button type="button" class="btn btn-${a.kind || 'secondary'}" data-dialog-value="${a.value ?? ''}">${a.label}</button>`)}</div>` : ''}`);
  modalRoot().appendChild(dlg);
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  hideTooltip();
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  dlg.addEventListener('close', () => {
    resolve(dlg.returnValue || '');
    dlg.remove();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  dlg.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (!t) return;
    if (t === dlg) {
      // A click on the backdrop lands on the <dialog> itself, outside its box.
      const r = dlg.getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) dlg.close('');
      return;
    }
    if (t.closest('[data-dialog-close]')) { dlg.close(''); return; }
    const v = t.closest('[data-dialog-value]');
    if (v) dlg.close(v.dataset.dialogValue);
  });
  dlg.showModal();
  const focusEl = (initialFocus && dlg.querySelector(initialFocus)) || dlg.querySelector('[autofocus]') || dlg.querySelector('.modal-foot .btn-primary, .modal-foot .btn-danger') || dlg.querySelector('.modal-body input, .modal-body button') || dlg.querySelector('[data-dialog-close]');
  focusEl?.focus();
  return {
    el: dlg,
    body: dlg.querySelector('.modal-body'),
    close(value = '') { if (dlg.open) dlg.close(String(value)); },
    done,
  };
}

/** confirmDialog({title, body, confirmLabel, cancelLabel, danger}) → Promise<boolean>. */
export async function confirmDialog({ title, body = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  const d = openDialog({
    title,
    body: isSafeHtml(body) ? body : html`<p>${body}</p>`,
    actions: [
      { label: cancelLabel, kind: 'ghost', value: 'cancel' },
      { label: confirmLabel, kind: danger ? 'danger' : 'primary', value: 'confirm' },
    ],
    // Destructive confirmations start on Cancel so a stray Enter does no harm.
    initialFocus: danger ? '[data-dialog-value="cancel"]' : '[data-dialog-value="confirm"]',
  });
  return (await d.done) === 'confirm';
}

// ======================================================================= state blocks
export function loadingState(label = 'Loading…', { compact = false } = {}) {
  return html`<div class="state${compact ? ' state-compact' : ''}" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div><div class="state-body">${label}</div></div>`;
}

const NOTICE_ICON = { info: 'info', good: 'checkCircle', warning: 'alert', critical: 'alertCircle', busy: 'refresh', quiet: 'info' };

/**
 * notice({tone, icon, title, body, actions, compact, role, className}) — an inline banner inside a
 * page: a coverage gap, Spotify cooling down, an artist hidden from stats, a sync in progress.
 * tone: info | good | warning | critical | quiet (the icon and the words carry the meaning; the
 * tint only supports it). body/actions may be html``.
 */
export function notice({ tone = 'info', icon: iconName, title, body, actions: acts, compact = false, role, className = '' } = {}) {
  const r = role || (tone === 'critical' ? 'alert' : 'status');
  return html`<div class="notice${compact ? ' notice-compact' : ''}${className ? ' ' + className : ''}" data-tone="${tone}" role="${r}">
    <span class="notice-icon">${icon(iconName || NOTICE_ICON[tone] || 'info')}</span>
    <div class="notice-main">
      ${title ? html`<div class="notice-title">${title}</div>` : ''}
      ${body ? html`<div class="notice-body">${body}</div>` : ''}
    </div>
    ${acts ? html`<div class="notice-actions">${acts}</div>` : ''}
  </div>`;
}

/** emptyState({title, body, action:{label, href} | {label, action, data:{…}}, icon}) */
export function emptyState({ title, body, action, icon: iconName = 'inbox', compact = false } = {}) {
  return html`<div class="state${compact ? ' state-compact' : ''}">
    <div class="state-icon">${icon(iconName)}</div>
    ${title ? html`<div class="state-title">${title}</div>` : ''}
    ${body ? html`<div class="state-body">${body}</div>` : ''}
    ${action ? html`<div class="state-actions">${actionButton(action, 'btn btn-secondary')}</div>` : ''}
  </div>`;
}

const retryFns = new Map();
let retrySeq = 0;

/**
 * errorState(err, {retry, title, compact}) — says what happened and offers a retry.
 * retry: a function (wired automatically) or true (renders data-action="retry" for your own handler).
 */
export function errorState(err, { retry, title, compact = false, body } = {}) {
  const isRate = err && (err.status === 429 || err.code === 'rate_limited');
  const heading = title || (isRate ? 'Spotify is cooling down' : err?.status === 0 ? "Can't reach the app" : "Couldn't load this");
  const message = body || err?.message || 'Something went wrong.';
  let retryBtn = '';
  if (typeof retry === 'function') {
    const id = `r${++retrySeq}`;
    retryFns.set(id, retry);
    if (retryFns.size > 60) retryFns.delete(retryFns.keys().next().value);
    retryBtn = html`<button type="button" class="btn btn-secondary" data-ui-retry="${id}">${icon('refresh')}Try again</button>`;
  } else if (retry) {
    retryBtn = html`<button type="button" class="btn btn-secondary" data-action="retry">${icon('refresh')}Try again</button>`;
  }
  return html`<div class="state state-error${compact ? ' state-compact' : ''}" role="alert">
    <div class="state-icon">${icon(isRate ? 'hourglass' : 'alertCircle')}</div>
    <div class="state-title">${heading}</div>
    <div class="state-body">${message}</div>
    ${retryBtn ? html`<div class="state-actions">${retryBtn}</div>` : ''}
  </div>`;
}

function actionButton(a, cls) {
  if (a.href) return html`<a class="${cls}" href="${safeUrl(a.href)}">${a.icon ? icon(a.icon) : ''}${a.label}</a>`;
  const data = Object.entries(a.data || {}).map(([k, v]) => raw(` data-${k.replace(/[^a-z0-9-]/gi, '')}="${escapeHtml(v)}"`));
  return html`<button type="button" class="${cls}" data-action="${a.action || ''}"${data}>${a.icon ? icon(a.icon) : ''}${a.label}</button>`;
}

// ======================================================================= components
export const artistHref = (name) => `#/artist/${encodeURIComponent(String(name ?? ''))}`;

/** Link to the in-app artist page. */
export function artistLink(name, { className = 'artist-link' } = {}) {
  if (!name) return '';
  return html`<a class="${className}" href="${artistHref(name)}">${name}</a>`;
}

/**
 * artistLinks(artist_list | "A, B") → comma-separated links. Prefer artist_list ([{id,name}]):
 * a joined string is split on ", " which is wrong for names like "Tyler, The Creator".
 */
export function artistLinks(list, { max = 4 } = {}) {
  let names = [];
  if (Array.isArray(list)) names = list.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean);
  else if (typeof list === 'string' && list.trim()) names = list.split(', ').map((s) => s.trim()).filter(Boolean);
  const shown = names.slice(0, max);
  const parts = [];
  shown.forEach((n, i) => { if (i) parts.push(', '); parts.push(artistLink(n)); });
  if (names.length > max) parts.push(html`<span class="muted"> +${names.length - max}</span>`);
  return parts;
}

/** Stable hue (0–359) for a name, so an artist without a photo gets the same tint on every page. */
export function nameHue(name) {
  let h = 0;
  for (const ch of String(name || '').normalize('NFKC').toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

/**
 * Placeholder for an artist without a photo: initials on a muted tint derived from the name
 * (.avatar-ph in base.css). size → px square; className adds the page's own sizing class.
 */
export function initialsAvatar(name, { size, className = '', round = true } = {}) {
  const style = `--h:${nameHue(name)}${size ? `;--s:${Number(size)}px;width:${Number(size)}px;height:${Number(size)}px` : ''}`;
  return html`<span class="avatar-ph${round ? '' : ' avatar-ph-square'}${className ? ' ' + className : ''}" style="${style}" aria-hidden="true">${fmt.initials(name)}</span>`;
}

/** Album art / avatar with a placeholder when there is no image. */
export function thumb(src, { round = false, size, alt = '', iconName = 'music', className = '' } = {}) {
  const style = size ? raw(` style="width:${Number(size)}px;height:${Number(size)}px"`) : '';
  const cls = `thumb${round ? ' thumb-round' : ''}${className ? ' ' + className : ''}`;
  const url = safeUrl(src, '');
  if (url && /^https?:/i.test(url)) return html`<img class="${cls}" src="${url}" alt="${alt}" loading="lazy" decoding="async"${style}>`;
  return html`<span class="${cls} thumb-ph" aria-hidden="true"${style}>${icon(iconName)}</span>`;
}

/** Artist picture: the photo when there is one, else the shared initials avatar (never a generic icon). */
export function artistThumb(image, name, { size, className = '' } = {}) {
  const url = safeUrl(image, '');
  if (url && /^https?:/i.test(url)) return thumb(url, { round: true, size, alt: '', className });
  return initialsAvatar(name, { size, className: `thumb thumb-round${className ? ' ' + className : ''}` });
}

/** Page header pattern: one h1 per view (focused after navigation), description, optional actions. */
export function pageHeader({ title, desc, eyebrow, actions: acts } = {}) {
  return html`<header class="page-header">
    <div class="page-heading">
      ${eyebrow ? html`<div class="page-eyebrow">${eyebrow}</div>` : ''}
      <h1 class="page-title" tabindex="-1">${title}</h1>
      ${desc ? html`<p class="page-desc">${desc}</p>` : ''}
    </div>
    ${acts ? html`<div class="page-actions">${acts}</div>` : ''}
  </header>`;
}

/**
 * Section header inside a view: h2 title (+ optional ⓘ definition), one-line description that says
 * what is counted and over which window, optional actions on the right. id → heading id for
 * aria-labelledby; level 3 for a header inside a card that already sits under a section h2.
 */
export function sectionHeader({ title, desc, info, actions: acts, id, level = 2 } = {}) {
  const h = level === 3 ? 'h3' : 'h2';
  return html`<div class="section-head">
    <div class="section-heading">
      ${raw(`<${h} class="section-title${level === 3 ? ' section-title-sm' : ''}"${id ? ` id="${escapeHtml(id)}"` : ''}>`)}<span>${title}</span>${info ? infoTip(info, { label: title }) : ''}${raw(`</${h}>`)}
      ${desc ? html`<p class="section-desc">${desc}</p>` : ''}
    </div>
    ${acts ? html`<div class="section-actions">${acts}</div>` : ''}
  </div>`;
}

/**
 * trackRow({rank, image, name, artist_list | artists | artist, album, meta, uri, actions, play})
 * Play button: uri → data-action="play-uri"; no uri but a known artist → data-action="play-track"
 * (looked up on Spotify when clicked); play:false → no button. actions: extra trusted html``.
 */
export function trackRow({ rank, image, name, artist_list, artists, artist, album, meta, uri, actions: extra, sub, play = true } = {}) {
  const who = artist_list?.length ? artistLinks(artist_list) : artists ? artistLinks(artists) : artist ? artistLink(artist) : '';
  const primary = artist || (artist_list?.[0]?.name ?? (typeof artist_list?.[0] === 'string' ? artist_list[0] : '')) || (typeof artists === 'string' ? artists.split(', ')[0] : '');
  let playBtn;
  if (play && uri) playBtn = html`<button type="button" class="btn btn-icon btn-sm" data-action="play-uri" data-uri="${uri}" data-name="${name}" aria-label="Play ${name}" data-tip="Play">${icon('play')}</button>`;
  else if (play && primary && name) playBtn = html`<button type="button" class="btn btn-icon btn-sm" data-action="play-track" data-artist="${primary}" data-name="${name}" aria-label="Play ${name}" data-tip="Find on Spotify and play">${icon('play')}</button>`;
  // Rows without a play button keep an empty slot so the meta column lines up across the list.
  else playBtn = html`<span class="row-action-slot" aria-hidden="true"></span>`;
  const subline = sub ?? (album ? html`${who}${who ? ' · ' : ''}<span>${album}</span>` : who);
  return html`<div class="list-row track-row" role="listitem">
    <div class="row-lead">
      ${rank != null ? html`<span class="row-rank">${rank}</span>` : ''}
      ${image !== undefined ? thumb(image, { alt: '' }) : ''}
    </div>
    <div class="row-main"><div class="row-title">${name}</div>${subline ? html`<div class="row-sub">${subline}</div>` : ''}</div>
    <div class="row-meta">${meta ?? ''}</div>
    <div class="row-actions">${playBtn}${extra || ''}</div>
  </div>`;
}

/**
 * statTile({label, value, unit, delta, deltaLabel, deltaFormat, goodDirection, hint, info})
 * value: number (formatted with fmt.num) or preformatted string. delta: signed number; with
 * deltaFormat 'pct' (default) renders "+12%", 'num' renders "+12". deltaLabel names the period
 * ("vs last month"). goodDirection: 'up' | 'down' | 'neutral' (colour only; the arrow and sign carry
 * the meaning). info: definition text shown in an ⓘ tooltip.
 */
export function statTile({ label, value, unit, delta, deltaLabel, deltaFormat = 'pct', goodDirection = 'up', hint, info, className = '' } = {}) {
  const shown = typeof value === 'number' ? fmt.num(value) : (value ?? DASH);
  let deltaHtml = '';
  if (isNum(delta)) {
    const d = Number(delta);
    const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    let tone = 'delta-flat';
    if (dir !== 'flat' && goodDirection !== 'neutral') tone = (dir === 'up') === (goodDirection === 'up') ? 'delta-up' : 'delta-down';
    const txt = deltaFormat === 'num' ? fmt.signed(d) : fmt.signedPct(d);
    const word = dir === 'up' ? 'Up' : dir === 'down' ? 'Down' : 'No change';
    deltaHtml = html`<div class="stat-delta"><span class="delta ${tone}">${dir === 'flat' ? '' : icon(dir === 'up' ? 'arrowUp' : 'arrowDown')}<span class="sr-only">${word} </span>${txt}</span>${deltaLabel ? html`<span>${deltaLabel}</span>` : ''}</div>`;
  } else if (deltaLabel) {
    deltaHtml = html`<div class="stat-delta"><span>${deltaLabel}</span></div>`;
  }
  return html`<div class="stat-tile${className ? ' ' + className : ''}">
    <div class="stat-label"><span>${label}</span>${info ? infoTip(info, { label }) : ''}</div>
    <div class="stat-value">${shown}${unit ? html`<span class="unit">${unit}</span>` : ''}</div>
    ${deltaHtml}
    ${hint ? html`<div class="stat-hint">${hint}</div>` : ''}
  </div>`;
}

/** meter({value, max, label, valueLabel, tone}) — tone: 'data' (default) | 'accent' | 'good' | 'warning' | 'critical'. */
export function meter({ value = 0, max = 100, label, valueLabel, tone = 'data', showHead = true } = {}) {
  const v = isNum(value) ? Number(value) : 0;
  const m = isNum(max) && Number(max) > 0 ? Number(max) : 100;
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const text = valueLabel ?? `${fmt.num(v)} of ${fmt.num(m)}`;
  return html`<div class="meter" data-tone="${tone}">
    ${showHead && (label || text) ? html`<div class="meter-head"><span>${label || ''}</span><span class="meter-value">${text}</span></div>` : ''}
    <div class="meter-track" role="meter" aria-valuemin="0" aria-valuemax="${m}" aria-valuenow="${v}" aria-valuetext="${text}" ${label ? raw(`aria-label="${escapeHtml(label)}"`) : ''}>
      <div class="meter-fill" style="width:${pct.toFixed(2)}%"></div>
    </div>
  </div>`;
}

/** ⓘ button whose tooltip shows a definition. The definition is also in the accessible name. */
export function infoTip(definition, { label } = {}) {
  if (!definition) return '';
  const name = label ? `About ${label}: ${definition}` : `Definition: ${definition}`;
  return html`<button type="button" class="info-tip" data-tip="${definition}" aria-label="${name}" aria-expanded="false">${icon('info')}</button>`;
}

/**
 * tabs({items:[{id, label, count, href}], selected, label})
 * With href → a nav of links (aria-current on the selected one; for router-driven tabs).
 * Without → role=tablist buttons; wire them with bindChoiceGroup(el, onChange).
 */
export function tabs({ items = [], selected, label = 'Sections' } = {}) {
  if (items.some((i) => i.href)) {
    return html`<nav class="tabs" aria-label="${label}">${items.map((it) => html`<a class="tab" href="${safeUrl(it.href)}" ${it.id === selected ? raw('aria-current="page"') : ''}>${it.label}${it.count != null ? html`<span class="tab-count">${fmt.num(it.count)}</span>` : ''}</a>`)}</nav>`;
  }
  return html`<div class="tabs" role="tablist" aria-label="${label}">${items.map((it) => html`<button type="button" class="tab" role="tab" id="tab-${it.id}" data-value="${it.id}" aria-selected="${it.id === selected ? 'true' : 'false'}" tabindex="${it.id === selected ? '0' : '-1'}" ${it.controls ? raw(`aria-controls="${escapeHtml(it.controls)}"`) : ''}>${it.label}${it.count != null ? html`<span class="tab-count">${fmt.num(it.count)}</span>` : ''}</button>`)}</div>`;
}

/** segmented({items:[{id, label}], selected, label}) — a single-choice control (role=radiogroup). */
export function segmented({ items = [], selected, label = 'Options' } = {}) {
  return html`<div class="segmented" role="radiogroup" aria-label="${label}">${items.map((it) => html`<button type="button" class="segment" role="radio" data-value="${it.id}" aria-checked="${it.id === selected ? 'true' : 'false'}" tabindex="${it.id === selected ? '0' : '-1'}">${it.label}</button>`)}</div>`;
}

/**
 * Wire tabs()/segmented() markup inside `container`: click, Arrow keys, Home/End select an item
 * (roving tabindex) and call onChange(value, el). Returns an unsubscribe function.
 */
export function bindChoiceGroup(container, onChange) {
  const sel = '[role="tab"], [role="radio"]';
  const attrFor = (el) => (el.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-checked');
  const select = (el, { focus = false } = {}) => {
    const group = el.closest('[role="tablist"], [role="radiogroup"]');
    if (!group) return;
    const changed = el.getAttribute(attrFor(el)) !== 'true';
    group.querySelectorAll(sel).forEach((b) => { b.setAttribute(attrFor(b), b === el ? 'true' : 'false'); b.tabIndex = b === el ? 0 : -1; });
    if (focus) el.focus();
    if (changed && onChange) {
      try { onChange(el.dataset.value, el); } catch (err) { reportError(err); }
    }
  };
  const offClick = on(container, 'click', sel, (ev, el) => select(el));
  const offKey = on(container, 'keydown', sel, (ev, el) => {
    const group = el.closest('[role="tablist"], [role="radiogroup"]');
    const list = [...group.querySelectorAll(sel)];
    const i = list.indexOf(el);
    let next = null;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = list[(i + 1) % list.length];
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = list[(i - 1 + list.length) % list.length];
    else if (ev.key === 'Home') next = list[0];
    else if (ev.key === 'End') next = list[list.length - 1];
    if (next) { ev.preventDefault(); select(next, { focus: true }); }
  });
  return () => { offClick(); offKey(); };
}

/** Refetch state for a panel: keep the previous render, dimmed, instead of flashing a skeleton. */
export function setRefetching(el, on = true) {
  if (!el) return;
  el.classList.toggle('is-refetching', !!on);
  if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
}

/** Mark a button busy (spinner, aria-busy) while an async action runs. */
export async function withBusy(btn, fn) {
  if (!btn) return fn();
  btn.classList.add('is-busy');
  btn.setAttribute('aria-busy', 'true');
  try { return await fn(); }
  finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
}

// ======================================================================= init
let initialised = false;
export function initUi() {
  if (initialised) return;
  initialised = true;
  toastRegion();
  modalRoot();
  initTooltips();
  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('[data-ui-retry]') : null;
    if (!b) return;
    const fn = retryFns.get(b.dataset.uiRetry);
    retryFns.delete(b.dataset.uiRetry);
    if (fn) {
      try {
        const r = fn();
        if (r && typeof r.catch === 'function') r.catch(reportError);
      } catch (err) { reportError(err); }
    }
  });
}

export const ui = {
  html, raw, escapeHtml, safeUrl, mount, icon, uid, debounce, fmt, toDate,
  on, actions, reportError, pushOverlay, showTooltip, hideTooltip, popover, menu,
  toast, toastError, openDialog, confirmDialog, loadingState, emptyState, errorState, notice,
  artistHref, artistLink, artistLinks, nameHue, initialsAvatar, artistThumb, thumb, pageHeader, sectionHeader, trackRow, statTile, meter, infoTip,
  tabs, segmented, bindChoiceGroup, withBusy, setRefetching,
};
export default ui;

// Library (#/library/<tab>): Recent plays · Backlog · Liked · Favorites · Watchlist.
// The shell owns the header and the tab bar (with live counts); each tab is a controller from
// ./library-<tab>.js with {mount(el, params), update(params), unmount(), onStatus(status, info)}.
// Tab switches and filter changes arrive through update() (same view), so tab state and the
// module-level caches survive switching back and forth.
import { api } from '../core/api.js';
import { html, mount, pageHeader, fmt, reportError, notice } from '../core/ui.js';
import { createRecentTab } from './library-recent.js';
import { createBacklogTab } from './library-backlog.js';
import { createLikedTab } from './library-liked.js';
import { createFavoritesTab } from './library-favorites.js';
import { createWatchlistTab } from './library-watchlist.js';

const TABS = [
  { id: 'recent', label: 'Recent plays', create: createRecentTab },
  { id: 'backlog', label: 'Backlog', create: createBacklogTab },
  { id: 'liked', label: 'Liked', create: createLikedTab },
  { id: 'favorites', label: 'Favorites', create: createFavoritesTab },
  { id: 'watchlist', label: 'Watchlist', create: createWatchlistTab },
];
// The static web demo (static/js/demo/) says where a tab shows simulated data.
const WEB_DEMO = window.APP_CONFIG?.webDemo || null;
const DEMO_NOTES = WEB_DEMO ? {
  backlog: `The demo’s backlog is a simulated playlist made of the tracks the app saw play. When each one was added and how long it runs aren’t known, so no dates are shown and every track plays ${WEB_DEMO.simSeconds || 45} s.`,
  liked: 'Liked Songs are simulated in the demo: a sample of tracks from the backlog, plus anything you like here. When the sample was liked isn’t known.',
} : {};
let root = null;
let panel = null;
let ctxRef = null;
let active = null;              // {id, ctrl}
const counts = {};               // tabId -> number | null
let offWatch = null;

const tabFor = (id) => TABS.find((t) => t.id === id) || TABS[0];

function renderShell(selected) {
  mount(root, html`
    ${pageHeader({ title: 'Library', desc: "What you've played, what's still waiting in your backlog, and the music you've saved." })}
    <nav class="tabs lib-tabs" aria-label="Library sections">
      ${TABS.map((t) => html`<a class="tab" href="#/library/${t.id}" data-tab="${t.id}" ${t.id === selected ? html`aria-current="page"` : ''}>${t.label}<span class="tab-count" data-count="${t.id}" hidden></span></a>`)}
    </nav>
    ${WEB_DEMO ? html`<div class="lib-demo-note" data-demo-note></div>` : ''}
    <div class="lib-panel" data-panel></div>`);
  panel = root.querySelector('[data-panel]');
  Object.keys(counts).forEach((id) => paintCount(id));
}

function paintCount(id) {
  const el = root?.querySelector(`[data-count="${id}"]`);
  if (!el) return;
  const n = counts[id];
  const show = Number.isFinite(n);
  el.hidden = !show;
  const text = show ? fmt.compact(n) : '';
  if (el.textContent !== text) el.textContent = text;
}

export function setCount(id, n) {
  counts[id] = Number.isFinite(Number(n)) && n !== null ? Number(n) : null;
  paintCount(id);
}

function markSelected(id) {
  root.querySelectorAll('.lib-tabs [data-tab]').forEach((a) => {
    if (a.dataset.tab === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // On narrow screens the tab strip scrolls sideways: keep the current tab in view.
  const nav = root.querySelector('.lib-tabs');
  const a = nav?.querySelector(`[data-tab="${id}"]`);
  if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
  const nr = nav.getBoundingClientRect();
  const ar = a.getBoundingClientRect();
  if (ar.left < nr.left) nav.scrollLeft -= nr.left - ar.left + 16;
  else if (ar.right > nr.right) nav.scrollLeft += ar.right - nr.right + 16;
}

function select(params) {
  const tab = tabFor(params?.tab);
  ctxRef?.setTitle?.(`${tab.label} · Library`);
  if (active && active.id === tab.id) {
    active.ctrl.update?.(params);
    return;
  }
  if (!active) {
    // First render: the counts are not painted yet; wait a frame so widths are final.
    requestAnimationFrame(() => { if (root) markSelected(tab.id); });
  }
  if (active) {
    try { active.ctrl.unmount?.(); } catch (err) { reportError(err); }
  }
  markSelected(tab.id);
  const note = root.querySelector('[data-demo-note]');
  if (note) mount(note, DEMO_NOTES[tab.id] ? notice({ tone: 'quiet', icon: 'info', compact: true, body: DEMO_NOTES[tab.id] }) : '');
  panel.replaceChildren();
  panel.className = `lib-panel lib-panel-${tab.id}`;
  const ctrl = tab.create({ ctx: ctxRef, setCount });
  active = { id: tab.id, ctrl };
  ctrl.mount(panel, params);
  const s = ctxRef?.store?.status;
  if (s) {
    try { ctrl.onStatus?.(s, { changed: new Set(Object.keys(s)), initial: true }); } catch (err) { reportError(err); }
  }
}

async function loadWatchCount() {
  try {
    const r = await api.get('/api/research', { params: { status: 'active' }, timeoutMs: 8000 });
    setCount('watchlist', r?.counts?.active ?? (Array.isArray(r?.items) ? r.items.length : null));
  } catch { /* the tab shows its own error */ }
}

function applyStatus(status) {
  const b = status?.backlog;
  const total = b && Number.isFinite(Number(b.total)) ? Number(b.total) : status?.playlist_total;
  if (Number.isFinite(Number(total)) && (b ? b.playlist_id : true)) setCount('backlog', Number(total));
  if (Array.isArray(status?.favorite_artists)) setCount('favorites', status.favorite_artists.length);
}

export default {
  id: 'library',
  title: 'Library',
  mount(el, params, ctx) {
    root = el;
    ctxRef = ctx;
    renderShell(tabFor(params?.tab).id);
    active = null;
    select(params);
    loadWatchCount();
    const onChanged = () => loadWatchCount();
    window.addEventListener('app:watchlist-changed', onChanged);
    offWatch = () => window.removeEventListener('app:watchlist-changed', onChanged);
  },
  update(params, ctx) {
    ctxRef = ctx || ctxRef;
    if (!root) return;
    select(params);
  },
  onStatus(status, info) {
    applyStatus(status);
    if (active) active.ctrl.onStatus?.(status, info || {});
  },
  unmount() {
    if (active) {
      try { active.ctrl.unmount?.(); } catch (err) { reportError(err); }
    }
    offWatch?.();
    offWatch = null;
    active = null;
    root = null;
    panel = null;
    ctxRef = null;
  },
};

// Hash router.
//
// Routes (path params are decoded; query params are plain strings):
//   #/now                         → {id:'now'}
//   #/insights?period=month&anchor=YYYY-MM-DD → {id:'insights', query:{period, anchor}}
//   #/insights/<reports|all-time|year|backlog>[/<yyyy>] → {id:'insights', params:{tab, year}}
//                                 (the query form #/insights?tab=backlog&year=2025 works too)
//   #/artist/<encodeURIComponent(name)>        → {id:'artist', params:{name}}
//   #/artists                     → {id:'artists'}
//   #/library/<tab>               → {id:'library', params:{tab}}   (recent|backlog|liked|favorites|watchlist)
//   #/search?q=…                  → {id:'search', query:{q}}
//   #/settings, #/styleguide
//   #/setup                       → first-run setup (Now shows it on its own until Spotify is set up)
//
// navigate('/artist/Sleep Token') or navigate(href('artist', {name})) pushes a history entry;
// {replace:true} replaces it. setQuery({period:'year'}) updates query params (replace by default).
// Back/forward work natively (every change is a real hash entry). Scroll: a new entry starts at
// the top; going back/forward restores the scroll position that entry had.

const ROUTES = [
  { id: 'now', re: /^\/now\/?$/ },
  { id: 'insights', re: /^\/insights(?:\/(reports|all-time|year|backlog))?(?:\/(\d{4}))?\/?$/, keys: ['tab', 'year'] },
  { id: 'artist', re: /^\/artist\/(.+?)\/?$/, keys: ['name'] },
  { id: 'artists', re: /^\/artists\/?$/ },
  { id: 'library', re: /^\/library(?:\/([^/]+))?\/?$/, keys: ['tab'] },
  { id: 'search', re: /^\/search\/?$/ },
  { id: 'settings', re: /^\/settings\/?$/ },
  { id: 'styleguide', re: /^\/styleguide\/?$/ },
  { id: 'setup', re: /^\/setup\/?$/ },
];

export const DEFAULT_PATH = '/now';

const listeners = new Set();
let currentRoute = null;
let entrySeq = 0;
const scrollByEntry = new Map();
let scroller = null;

// A replaced entry is a new page for scroll purposes: drop our entry tag so it gets a fresh one.
const withoutEntry = (st) => {
  if (!st || typeof st !== 'object') return null;
  const { __entry, ...rest } = st;
  return Object.keys(rest).length ? rest : null;
};

const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** Parse a hash ("#/artist/X?y=1") into a route object. */
export function parse(hash = location.hash) {
  const h = String(hash || '').replace(/^#/, '');
  const qIdx = h.indexOf('?');
  const rawPath = (qIdx >= 0 ? h.slice(0, qIdx) : h) || '';
  const query = {};
  if (qIdx >= 0) {
    for (const [k, v] of new URLSearchParams(h.slice(qIdx + 1))) query[k] = v;
  }
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = {};
    (r.keys || []).forEach((k, i) => { if (m[i + 1] !== undefined) params[k] = safeDecode(m[i + 1]); });
    return { id: r.id, path, params, query, hash: `#${h}`, key: `${r.id}:${JSON.stringify(params)}` };
  }
  return { id: 'not_found', path, params: {}, query, hash: `#${h}`, key: `not_found:${path}` };
}

/** Build an in-app href: href('artist', {name:'AC/DC'}) → '#/artist/AC%2FDC'. */
export function href(id, params = {}, query = {}) {
  let path;
  switch (id) {
    case 'artist': path = `/artist/${encodeURIComponent(params.name ?? '')}`; break;
    case 'library': path = params.tab ? `/library/${encodeURIComponent(params.tab)}` : '/library'; break;
    case 'insights': path = `/insights${params.tab ? `/${encodeURIComponent(params.tab)}` : ''}${params.tab && params.year ? `/${Number(params.year)}` : ''}`; break;
    default: path = `/${id}`;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `#${path}${s ? `?${s}` : ''}`;
}

function normalise(target) {
  let t = String(target || '');
  if (t.startsWith('#')) t = t.slice(1);
  if (!t.startsWith('/')) t = `/${t}`;
  return `#${t}`;
}

/** Go to a path ('/insights?period=year' or '#/insights'). */
export function navigate(target, { replace = false } = {}) {
  const hash = normalise(target);
  if (hash === location.hash) { handleChange({ force: true }); return; }
  if (replace) {
    history.replaceState(withoutEntry(history.state), '', hash);
    handleChange();
  } else {
    location.hash = hash;   // fires hashchange → handleChange
  }
}

/** Merge query params into the current route (null/'' removes a key). */
export function setQuery(patch, { replace = true } = {}) {
  const r = currentRoute || parse();
  const q = { ...r.query };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined || v === '') delete q[k]; else q[k] = String(v);
  }
  const qs = new URLSearchParams(q).toString();
  navigate(`${r.path}${qs ? `?${qs}` : ''}`, { replace });
}

export function current() { return currentRoute || parse(); }

/** fn(route, prevRoute, {isTraversal}) on every change. Returns an unsubscribe function. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function tagEntry() {
  const st = history.state;
  if (st && typeof st === 'object' && st.__entry) return { entry: st.__entry, traversal: true };
  const entry = ++entrySeq + Date.now() * 1000;
  try { history.replaceState({ ...(st && typeof st === 'object' ? st : {}), __entry: entry }, '', location.href); } catch { /* ignore */ }
  return { entry, traversal: false };
}

let lastEntry = null;

function handleChange({ force = false } = {}) {
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    history.replaceState(withoutEntry(history.state), '', `#${DEFAULT_PATH}`);
  }
  // Remember where the entry we are leaving was scrolled to.
  if (lastEntry != null && scroller) scrollByEntry.set(lastEntry, scroller.scrollTop);
  const { entry, traversal } = tagEntry();
  lastEntry = entry;
  const prev = currentRoute;
  const next = parse();
  if (!force && prev && prev.hash === next.hash) return;
  currentRoute = next;
  const samePage = prev && prev.key === next.key;
  for (const fn of [...listeners]) {
    try { fn(next, prev, { isTraversal: traversal, samePage }); } catch (err) {
      (window.__errors ||= []).push({ message: String(err?.message || err), stack: err?.stack || '', ts: Date.now(), source: 'router' });
      if (document.body) document.body.dataset.jsErrors = String(window.__errors.length);
      console.error(err);
    }
  }
}

/** Restore/reset scroll after the new view rendered. Called by the view outlet. */
export function applyScroll(route, { isTraversal, samePage } = {}) {
  if (!scroller) return;
  if (isTraversal && scrollByEntry.has(lastEntry)) {
    const y = scrollByEntry.get(lastEntry);
    requestAnimationFrame(() => { scroller.scrollTop = y; });
  } else if (!samePage) {
    scroller.scrollTop = 0;
  }
}

/** Start routing. scrollEl is the scroll container (#view). */
export function start(scrollEl) {
  scroller = scrollEl || null;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', () => handleChange());
  handleChange({ force: true });
}

export const router = { parse, href, navigate, setQuery, current, onChange, start, applyScroll, DEFAULT_PATH };
export default router;

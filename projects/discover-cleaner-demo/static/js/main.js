// App boot: UI toolkit, status store, player, search, Spotify status pill, shortcuts, and the
// view outlet driven by the hash router.
//
// View contract (static/js/views/<id>.js):
//   export default {
//     id, title,
//     mount(root, params, ctx),     // params = {...route.query, ...route.params}; may be async
//     unmount(),                    // optional; ctx.signal is aborted on unmount anyway
//     update(params, ctx),          // optional; if present, same-view navigations (query changes,
//                                   // another artist) call it instead of remounting
//     onStatus(status, {changed}),  // optional; every /api/status change while mounted
//   }
//   ctx = { api, store, router, ui, charts, signal, route, setTitle(text) }
// root is <div class="view view-<id>"> inside <main id="view">; put per-view CSS in
// static/css/views/<id>.css scoped under .view-<id>.
import api, { isAbort } from './core/api.js';
import store from './core/store.js';
import router from './core/router.js';
import ui, { html, mount, icon, toast, errorState, emptyState, reportError, actions, pageHeader, initUi } from './core/ui.js';
import { initPlayer, undo as undoClear, playUri, playTrack } from './components/player.js';
import { initSearch } from './components/search.js';
import { initStatusPill } from './components/status-pill.js';
import { initShortcuts, showShortcuts } from './components/shortcuts.js';

const APP_NAME = 'Discover Cleaner';

const VIEWS = {
  now: () => import('./views/now.js'),
  insights: () => import('./views/insights.js'),
  artist: () => import('./views/artist.js'),
  artists: () => import('./views/artists.js'),
  library: () => import('./views/library.js'),
  search: () => import('./views/search.js'),
  settings: () => import('./views/settings.js'),
  styleguide: () => import('./views/styleguide.js'),
  setup: () => import('./views/setup.js'),
};

// Which rail entry is "current" for each route.
const NAV_FOR = { now: 'now', insights: 'insights', artist: 'artists', artists: 'artists', library: 'library', settings: 'settings' };

const viewEl = document.getElementById('view');
let charts = null;
let active = null;   // {id, key, view, ctrl, root}
let navSeq = 0;
let firstRoute = true;

function setTitle(text) {
  document.title = text ? `${text} · ${APP_NAME}` : APP_NAME;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((n) => {
    mount(n, icon(n.dataset.icon));
    n.removeAttribute('data-icon');
    n.classList.add('icon-slot');
  });
}

function updateNav(route) {
  const current = NAV_FOR[route.id] || null;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Icon rail (700-1100 px) hides labels, so give the links tooltips there.
function syncRailTips() {
  const iconRail = window.matchMedia('(min-width: 700px) and (max-width: 1099.98px)').matches;
  document.querySelectorAll('.rail-link').forEach((a) => {
    const label = a.querySelector('.rail-label')?.textContent || '';
    if (iconRail) { a.dataset.tip = label; a.dataset.tipPlacement = 'right'; }
    else { delete a.dataset.tip; delete a.dataset.tipPlacement; }
  });
}

function paramsOf(route) {
  return { ...route.query, ...route.params };
}

function notFoundView() {
  return {
    id: 'not-found',
    title: 'Page not found',
    mount(root) {
      mount(root, html`${pageHeader({ title: 'Page not found', desc: "That address doesn't match a page in Discover Cleaner." })}
        ${emptyState({ title: 'Nothing here', body: 'Head back to what is playing now.', icon: 'search', action: { label: 'Go to Now', href: '#/now' } })}`);
    },
  };
}

// First run: until a Spotify app is set up, Now shows the Setup steps; once Spotify is connected
// but no backlog playlist is chosen yet, Now shows the "pick your backlog playlist" step. The
// offline demo never gates. Returns the setup step to show instead of the route, or null.
// views/setup.js sets SETUP_CONNECTING after saving the app keys, so the guided flow (not Now's
// generic "Spotify isn't connected" screen) stays up until the sign-in round trip completes.
const SETUP_CONNECTING = 'dc.setup.connecting';
function setupConnecting() {
  try { return sessionStorage.getItem(SETUP_CONNECTING) === '1'; } catch { return false; }
}
function gateFor(route, s) {
  if (route.id !== 'now' || !s?.setup || s.setup.demo) return null;
  if (s.setup.needs_credentials) return 'connect';
  if (s.auth_ready === false && setupConnecting()) return 'connect';
  if (s.setup.needs_playlist) return 'playlist';
  return null;
}

async function showRoute(route, prev, info = {}) {
  const seq = ++navSeq;
  updateNav(route);
  const isFirst = firstRoute;
  firstRoute = false;
  const gate = gateFor(route, store.status);
  const params = gate ? { ...paramsOf(route), step: gate, gated: '1' } : paramsOf(route);
  if (gate) route = { ...route, id: 'setup' };

  // Same view with an update() hook: let it handle the change in place.
  if (active && active.id === route.id && active.gate === gate && typeof active.view.update === 'function') {
    active.ctx.route = route;
    try {
      const r = active.view.update(params, active.ctx);
      if (r && typeof r.catch === 'function') r.catch((err) => { if (!isAbort(err)) reportError(err); });
    } catch (err) { reportError(err); }
    router.applyScroll(route, info);
    return;
  }

  let mod = null;
  const loader = VIEWS[route.id];
  if (loader) {
    try {
      mod = await loader();
    } catch (err) {
      if (seq !== navSeq) return;
      reportError(err);
      teardown();
      const root = freshRoot(route.id);
      mount(root, errorState(err, { title: "This page didn't load", body: 'A script for this page failed to load. Reload to try again.', retry: () => showRoute(router.current(), null, {}) }));
      return;
    }
  }
  if (seq !== navSeq) return;
  const view = (mod && mod.default) || notFoundView();
  teardown();
  const root = freshRoot(view.id || route.id);
  const ctrl = new AbortController();
  const ctx = { api, store, router, ui, charts, signal: ctrl.signal, route, setTitle };
  active = { id: route.id, key: route.key, gate, view, ctrl, root, ctx };
  setTitle(view.title);

  let mounted;
  try {
    mounted = view.mount(root, params, ctx);
  } catch (err) {
    reportError(err);
    mount(root, errorState(err, { title: 'This page hit an error', retry: () => showRoute(router.current(), null, {}) }));
  }
  if (store.status && typeof view.onStatus === 'function') {
    try { view.onStatus(store.status, { changed: new Set(Object.keys(store.status)), initial: true }); } catch (err) { reportError(err); }
  }
  router.applyScroll(route, info);
  if (!isFirst) {
    const h1 = root.querySelector('h1');
    (h1 || viewEl).focus({ preventScroll: true });
  }
  if (mounted && typeof mounted.then === 'function') {
    mounted.then(() => {
      if (info.isTraversal && seq === navSeq) router.applyScroll(route, info);
    }, (err) => {
      if (isAbort(err) || seq !== navSeq) return;
      reportError(err);
      mount(root, errorState(err, { retry: () => showRoute(router.current(), null, {}) }));
    });
  }
}

function freshRoot(id) {
  const root = document.createElement('div');
  root.className = `view view-${id}`;
  viewEl.replaceChildren(root);
  return root;
}

function teardown() {
  if (!active) return;
  const { view, ctrl } = active;
  active = null;
  try { ctrl.abort(); } catch { /* ignore */ }
  if (typeof view.unmount === 'function') {
    try { view.unmount(); } catch (err) { reportError(err); }
  }
}

function forwardStatus(status, info) {
  if (!active) return;
  // Setup finished (or was undone) while its page is showing: show what the route really is.
  const route = router.current();
  if ((active.gate || null) !== gateFor(route, status) && (active.gate || route.id === 'now')) {
    showRoute(route, null, {});
    return;
  }
  if (typeof active.view.onStatus !== 'function') return;
  try { active.view.onStatus(status, info); } catch (err) { reportError(err); }
}

// "Offline demo · simulated Spotify" in the top bar (app-config.demo, then /api/status setup.demo).
function renderDemoBadge(on) {
  const right = document.querySelector('.topbar-right');
  let badge = document.getElementById('demo-badge');
  if (!on) { if (badge) badge.hidden = true; return; }
  if (!badge && right) {
    // The static web demo (dist/web-demo) runs in the browser: "Live demo", and the badge
    // re-opens its banner (static/js/demo/banner.js).
    const web = !!window.APP_CONFIG?.webDemo;
    badge = document.createElement('span');
    badge.id = 'demo-badge';
    badge.className = 'demo-badge';
    badge.dataset.tip = web
      ? 'Real listening history, frozen in time; Spotify is simulated. Click for details.'
      : 'Nothing here talks to Spotify: playback is simulated over the author’s real listening history. Changes stay on this computer.';
    badge.dataset.tipPlacement = 'bottom';
    badge.tabIndex = 0;
    if (web) badge.setAttribute('role', 'button');
    mount(badge, html`${icon('wifiOff')}<span>${web ? 'Live demo' : 'Offline demo'}<span class="demo-badge-sub"> · simulated Spotify</span></span>`);
    right.prepend(badge);
  }
  if (badge) badge.hidden = false;
  document.body.dataset.demo = '1';
}

function appConfig() {
  try { return JSON.parse(document.getElementById('app-config')?.textContent || '{}') || {}; } catch { return {}; }
}

function renderUser(status) {
  const chip = document.getElementById('user-chip');
  if (!chip) return;
  const name = status?.auth_ready === false ? '' : status?.user_display_name;
  if (!name) { chip.hidden = true; return; }
  chip.hidden = false;
  const nameEl = chip.querySelector('.user-name');
  const av = chip.querySelector('.avatar');
  if (nameEl && nameEl.textContent !== name) nameEl.textContent = name;
  if (av) av.textContent = ui.fmt.initials(name);
  chip.setAttribute('aria-label', `Signed in to Spotify as ${name}`);
}

function trackToastOffset() {
  const player = document.getElementById('player');
  const update = () => {
    const top = player ? player.getBoundingClientRect().top : window.innerHeight - 100;
    const offset = Math.max(16, Math.round(window.innerHeight - top + 12));
    document.documentElement.style.setProperty('--toast-offset', `${offset}px`);
  };
  update();
  if (player && 'ResizeObserver' in window) new ResizeObserver(update).observe(player);
  window.addEventListener('resize', update);
}

function initConnectionNotice() {
  let notice = null;
  store.on('connection', ({ ok }) => {
    if (!ok) {
      notice = toast("Can't reach Discover Cleaner. Retrying…", { kind: 'error', persistent: true, key: 'connection', detail: 'Is the app still running? Everything resumes when it answers again.' });
    } else if (notice) {
      notice.dismiss();
      notice = null;
      toast('Reconnected.', { kind: 'success', key: 'connection', timeoutMs: 2500 });
    }
  });
}

function initGlobalActions() {
  actions(document.body, {
    'play-uri': (ds) => playUri(ds.uri, ds.name),
    // History rows without a Spotify id: data-artist + data-name, resolved on click.
    'play-track': (ds) => playTrack({ uri: ds.uri, id: ds.trackId, artist: ds.artist, name: ds.name }),
    'open-artist': (ds) => { if (ds.name) router.navigate(router.href('artist', { name: ds.name })); },
    'undo-clear': (ds) => undoClear(Number(ds.seq)),
    'show-shortcuts': () => showShortcuts(),
    'skip-to-content': () => { const h1 = viewEl.querySelector('h1'); (h1 || viewEl).focus(); },
  });
}

async function loadCharts() {
  try {
    const m = await import('./core/charts.js');
    return m.default || m;
  } catch (err) {
    reportError(err);
    return null;
  }
}

async function boot() {
  initUi();
  hydrateIcons();
  syncRailTips();
  window.matchMedia('(min-width: 700px) and (max-width: 1099.98px)').addEventListener('change', syncRailTips);

  initPlayer(document.getElementById('player'));
  initSearch(document.querySelector('.search'));
  initStatusPill(document.getElementById('spotify-status'));
  initShortcuts();
  initGlobalActions();
  initConnectionNotice();
  trackToastOffset();

  if (appConfig().demo) renderDemoBadge(true);
  store.on('status', (s, info) => {
    if (s?.auth_ready) { try { sessionStorage.removeItem(SETUP_CONNECTING); } catch { /* storage off */ } }
    if (s?.setup?.demo) renderDemoBadge(true);
    renderUser(s);
    forwardStatus(s, info);
  });
  // The first route may be gated by setup state: give the first /api/status a moment to arrive.
  const firstStatus = store.status ? null : new Promise((resolve) => {
    const off = store.on('status', () => { off(); resolve(); });
    setTimeout(resolve, 1500);
  });
  store.start();

  charts = await loadCharts();
  if (firstStatus) await firstStatus;
  router.onChange((route, prev, info) => { showRoute(route, prev, info); });
  router.start(viewEl);

  // Dev handle for the console and headless checks.
  window.__app = { api, store, router, ui, get charts() { return charts; } };
  window.__appReady = true;
  document.body.dataset.appReady = '1';
}

boot().catch((err) => {
  reportError(err);
  mount(viewEl, errorState(err, { title: "Discover Cleaner didn't start", body: String(err?.message || err) }));
});

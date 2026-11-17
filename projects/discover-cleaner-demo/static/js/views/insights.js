// Insights view (#/insights): four tabs over the local listening history.
//   Reports        #/insights?period=week|month|year|all&anchor=YYYY-MM-DD
//   All time       #/insights/all-time
//   Year in music  #/insights/year/YYYY
//   Backlog        #/insights/backlog
// The router maps the path forms to params {tab, year}; the older query forms
// (#/insights?tab=backlog, #/insights?tab=year&year=YYYY) still work.
// Each tab lives in its own module (insights-*.js) with mount/update/onStatus/unmount.
import { html, mount, pageHeader, errorState, loadingState, reportError } from '../core/ui.js';
import { revealTop } from './insights-common.js';

const TABS = [
  { id: 'reports', label: 'Reports', load: () => import('./insights-reports.js') },
  { id: 'all-time', label: 'All time', load: () => import('./insights-alltime.js') },
  { id: 'year', label: 'Year in music', load: () => import('./insights-year.js') },
  { id: 'backlog', label: 'Backlog', load: () => import('./insights-backlog.js') },
];
const TITLES = { reports: 'Insights', 'all-time': 'All time · Insights', year: 'Year in music · Insights', backlog: 'Backlog · Insights' };

function tabOf(params = {}) {
  const t = String(params.tab || '').toLowerCase();
  if (['all-time', 'alltime', 'overview', 'all'].includes(t)) return 'all-time';
  if (['year', 'year-in-music', 'wrapped'].includes(t) || (!t && /^\d{4}$/.test(String(params.year || '')))) return 'year';
  if (t === 'backlog') return 'backlog';
  return 'reports';
}

let root = null;
let ctx = null;
let active = null;      // {id, inst, panel}
let switchSeq = 0;
const modules = {};     // tab id -> module (loaded once per session)

function hrefFor(id) {
  const r = ctx.router;
  if (id === 'reports') return r.href('insights', {}, modules.reports?.reportsQuery?.() || {});
  if (id === 'year') return r.href('insights', { tab: 'year', year: modules.year?.yearQuery?.() || undefined });
  return r.href('insights', { tab: id });
}

function renderTabs(selected) {
  return html`<nav class="tabs ins-tabs" aria-label="Insights sections">${TABS.map((t) => html`<a class="tab" data-tab="${t.id}" href="${hrefFor(t.id)}" ${t.id === selected ? html`aria-current="page"` : ''}>${t.label}</a>`)}</nav>`;
}

function syncTabs(selected) {
  root?.querySelectorAll('.ins-tabs [data-tab]').forEach((a) => {
    a.setAttribute('href', hrefFor(a.dataset.tab));
    if (a.dataset.tab === selected) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function showTab(id, params) {
  const my = ++switchSeq;
  if (active) {
    try { active.inst.unmount(); } catch (err) { reportError(err); }
    active = null;
  }
  const holder = root.querySelector('[data-slot="panel"]');
  const panel = document.createElement('div');
  panel.className = `ins-panel ins-panel--${id}`;
  panel.id = 'ins-panel';
  holder.replaceChildren(panel);
  syncTabs(id);
  ctx.setTitle?.(TITLES[id]);
  const def = TABS.find((t) => t.id === id);
  let mod = modules[id];
  if (!mod) {
    mount(panel, loadingState('Loading…'));
    try {
      mod = await def.load();
      modules[id] = mod;
    } catch (err) {
      if (my !== switchSeq) return;
      reportError(err);
      mount(panel, errorState(err, { title: "This section didn't load", body: 'A script failed to load. Reload the page to try again.', retry: () => showTab(id, params) }));
      return;
    }
  }
  if (my !== switchSeq || !root) return;
  const factory = mod.default;
  const inst = factory({ api: ctx.api, router: ctx.router, store: ctx.store, setTitle: ctx.setTitle });
  active = { id, inst, panel };
  try {
    inst.mount(panel, params);
    if (ctx.store?.status && inst.onStatus) inst.onStatus(ctx.store.status, { initial: true });
  } catch (err) {
    reportError(err);
    mount(panel, errorState(err, { title: 'This section hit an error', retry: () => showTab(id, params) }));
  }
  syncTabs(id);
}

export default {
  id: 'insights',
  title: 'Insights',
  mount(el, params, c) {
    root = el;
    ctx = c;
    const id = tabOf(params);
    mount(root, html`
      ${pageHeader({ title: 'Insights', desc: 'Your listening from Last.fm and this app: what you played, when you played it, and what was new.' })}
      <div data-slot="tabs">${renderTabs(id)}</div>
      <div data-slot="panel"></div>`);
    return showTab(id, params);
  },
  update(params) {
    if (!root) return undefined;
    const id = tabOf(params);
    if (active && active.id === id) {
      active.inst.update?.(params);
      syncTabs(id);
      return undefined;
    }
    revealTop(root.querySelector('.ins-tabs'));
    return showTab(id, params);
  },
  onStatus(status, info) {
    try { active?.inst.onStatus?.(status, info); } catch (err) { reportError(err); }
  },
  unmount() {
    switchSeq++;
    if (active) {
      try { active.inst.unmount(); } catch (err) { reportError(err); }
    }
    active = null;
    root = null;
    ctx = null;
  },
};

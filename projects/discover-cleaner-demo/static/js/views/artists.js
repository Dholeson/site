// Your artists (#/artists): everyone in your listening history with search, sort, a toggle for
// artists hidden from stats, and pages of 50. State lives in the URL
// (#/artists?q=&sort=recent&hidden=1&page=2) so Back works and views are linkable.
// Data: GET /api/v2/artists?q=&sort=&hidden=exclude|include&limit=&offset=
import api, { isAbort } from '../core/api.js';
import router from '../core/router.js';
import {
  html, mount, fmt, icon, toast, toastError, pageHeader, emptyState, errorState, loadingState, infoTip,
  segmented, bindChoiceGroup, debounce, artistHref, setRefetching, actions, toDate, initialsAvatar,
} from '../core/ui.js';

const PAGE = 50;
const DAY = 86400e3;
const SORTS = [
  { id: 'plays', label: 'Most played', desc: 'by plays, all time' },
  { id: 'recent', label: 'Recently played', desc: 'most recently played first' },
  { id: 'first', label: 'First heard', desc: 'newest discoveries first' },
  { id: 'name', label: 'A–Z', desc: 'by name' },
];
const DEF = {
  rank: 'Place among all artists in your history by plays. Artists hidden from stats take no place.',
  plays: 'Every play of the artist, all time: Last.fm scrobbles plus plays heard in this app.',
  first: 'Your earliest play of the artist in your history.',
  last: 'Your most recent play of the artist.',
  hidden: 'Artists you hid from stats (podcasts, audiobooks, noise). Their plays stay in your history but are left out of rankings and reports.',
};

let V = null;

function ago(ts, now = Date.now()) {
  if (!ts) return '—';
  const days = Math.floor((now - Number(ts)) / DAY);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 63) return `${Math.round(days / 7)} weeks ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}
const monthYear = (ts) => { const d = toDate(ts); return d ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'; };

function readParams(params = {}) {
  const sort = SORTS.some((s) => s.id === params.sort) ? params.sort : 'plays';
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  return { q: String(params.q || '').slice(0, 200), sort, hidden: params.hidden === '1', page };
}

function hiddenToggleInner(on, count) {
  return html`${icon(on ? 'check' : 'eye')}<span>Show hidden</span><span class="as-count" data-part="hidden-count">${count ? fmt.num(count) : ''}</span>`;
}

function renderFrame() {
  const p = V.p;
  mount(V.root, html`
    ${pageHeader({ title: 'Your artists', desc: 'Everyone in your listening history. Open one to see your history with them, their catalog and similar artists.' })}
    <div class="as-filters" role="search" aria-label="Filter artists">
      <label class="as-search">
        ${icon('search')}
        <span class="sr-only">Search your artists</span>
        <input class="input as-search-input" type="search" placeholder="Search your artists" value="${p.q}" autocomplete="off" spellcheck="false" enterkeyhint="search">
      </label>
      <div class="as-sort" data-part="sort">${segmented({ items: SORTS.map((s) => ({ id: s.id, label: s.label })), selected: p.sort, label: 'Sort artists' })}</div>
      <button type="button" class="chip chip-lg as-hidden-toggle" data-action="as-hidden" aria-pressed="${p.hidden ? 'true' : 'false'}" data-tip="${DEF.hidden}">${hiddenToggleInner(p.hidden)}</button>
    </div>
    <p class="as-summary" data-part="summary" aria-live="polite"></p>
    <div class="card as-card" data-part="list">${loadingState('Loading your artists…', { compact: true })}</div>
    <nav class="as-pager" data-part="pager" aria-label="Pages"></nav>`);

  const input = V.root.querySelector('.as-search-input');
  const push = debounce((value) => router.setQuery({ q: value.trim() || null, page: null }), 250);
  input.addEventListener('input', () => push(input.value));
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { push.cancel(); router.setQuery({ q: input.value.trim() || null, page: null }); }
    if (ev.key === 'Escape' && input.value) { ev.stopPropagation(); input.value = ''; push.cancel(); router.setQuery({ q: null, page: null }); }
  });
  V.offs.push(() => push.cancel());
  V.offs.push(bindChoiceGroup(V.root.querySelector('[data-part="sort"]'), (value) => router.setQuery({ sort: value === 'plays' ? null : value, page: null }, { replace: false })));
}

async function load() {
  const p = V.p;
  const v = V;
  if (v.ctrl) v.ctrl.abort();
  v.ctrl = new AbortController();
  const listEl = v.root.querySelector('[data-part="list"]');
  if (v.data) setRefetching(listEl, true);
  try {
    const data = await api.get('/api/v2/artists', {
      params: { q: p.q || undefined, sort: p.sort, hidden: p.hidden ? 'include' : 'exclude', limit: PAGE, offset: (p.page - 1) * PAGE },
      signal: v.ctrl.signal, timeoutMs: 20000,
    });
    if (V !== v) return;
    v.data = data;
    v.err = null;
    // A page past the end (e.g. after a narrower search): go to the last real page.
    const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE));
    if (p.page > pages && data.total > 0) { router.setQuery({ page: pages > 1 ? pages : null }); return; }
  } catch (err) {
    if (isAbort(err) || V !== v) return;
    v.err = err;
    if (err.code === 'history_not_ready' || err.status === 503) {
      clearTimeout(v.retryT);
      v.retryT = setTimeout(() => { if (V === v) load(); }, 5000);
    }
  } finally {
    if (V === v) setRefetching(listEl, false);
  }
  renderList();
}

function renderList() {
  const v = V;
  const p = v.p;
  const listEl = v.root.querySelector('[data-part="list"]');
  const summary = v.root.querySelector('[data-part="summary"]');
  const pager = v.root.querySelector('[data-part="pager"]');
  const hc = v.root.querySelector('[data-part="hidden-count"]');
  if (v.err && !v.data) {
    const notReady = v.err.code === 'history_not_ready';
    mount(listEl, notReady
      ? loadingState('Your listening history is still being prepared. The list fills in by itself in a moment.', { compact: true })
      : errorState(v.err, { title: 'Your artists didn’t load', retry: () => load(), compact: true }));
    mount(summary, '');
    mount(pager, '');
    return;
  }
  const d = v.data;
  if (!d) return;
  if (hc) mount(hc, d.hidden_total ? html`${fmt.num(d.hidden_total)}` : '');
  const total = d.total || 0;
  const start = total ? (p.page - 1) * PAGE + 1 : 0;
  const end = Math.min(total, (p.page - 1) * PAGE + (d.items || []).length);
  const sort = SORTS.find((s) => s.id === p.sort) || SORTS[0];
  mount(summary, total
    ? html`${p.q ? html`<strong>${fmt.plural(total, 'artist')}</strong> match “${p.q}”` : html`<strong>${fmt.plural(total, 'artist')}</strong> in your history`}<span class="as-dot" aria-hidden="true">·</span>${sort.desc}${p.hidden ? html`<span class="as-dot" aria-hidden="true">·</span>hidden artists included${infoTip(DEF.hidden, { label: 'Hidden artists' })}` : ''}`
    : '');

  if (!total) {
    mount(listEl, p.q
      ? emptyState({ title: `No artists match “${p.q}”`, body: 'Check the spelling, or search Spotify with the box at the top of the page.', icon: 'search', action: { label: 'Clear search', action: 'as-clear' }, compact: true })
      : emptyState({ title: 'No artists yet', body: 'Play some music, or import your Last.fm history in Settings → History & data.', icon: 'artists', action: { label: 'Import in Settings', href: '#/settings?section=history' }, compact: true }));
    mount(pager, '');
    return;
  }

  const max = Number(d.max_plays) || Math.max(1, ...d.items.map((a) => a.plays));
  const now = Date.now();
  mount(listEl, html`<div class="table-wrap as-table-wrap">
    <table class="table as-table">
      <caption class="sr-only">Your artists, ${sort.desc}, ${start} to ${end} of ${total}</caption>
      <thead><tr>
        <th scope="col" class="num as-col-rank"><span class="as-th">Rank${infoTip(DEF.rank, { label: 'Rank' })}</span></th>
        <th scope="col">Artist</th>
        <th scope="col" class="as-col-plays"><span class="as-th">Plays${infoTip(DEF.plays, { label: 'Plays' })}</span></th>
        <th scope="col" class="as-col-date"><span class="as-th">First heard${infoTip(DEF.first, { label: 'First heard' })}</span></th>
        <th scope="col" class="as-col-date"><span class="as-th">Last heard${infoTip(DEF.last, { label: 'Last heard' })}</span></th>
      </tr></thead>
      <tbody>
        ${d.items.map((a) => html`<tr class="${a.hidden ? 'is-hidden' : ''}" data-name="${a.name}">
          <td class="num as-col-rank">${a.rank ? fmt.num(a.rank) : html`<span class="muted" aria-label="Hidden, no rank">—</span>`}</td>
          <td class="as-col-name">
            <div class="as-name-cell">
              ${initialsAvatar(a.name, { size: 36, className: 'as-avatar' })}
              <span class="as-name-main">
                <a class="as-name strong" href="${artistHref(a.name)}">${a.name}</a>
                <span class="as-sub">${a.hidden ? html`<span class="as-hidden-chip">${icon('eye')}Hidden</span>` : ''}<span class="as-sub-dates">First ${monthYear(a.first_ts)} · last ${ago(a.last_ts, now).toLowerCase()}</span></span>
              </span>
              ${a.hidden ? html`<button type="button" class="btn btn-ghost btn-sm as-unhide" data-action="as-unhide" data-name="${a.name}" aria-label="Show ${a.name} in stats again">Show in stats</button>` : ''}
            </div>
          </td>
          <td class="as-col-plays">
            <div class="as-plays">
              <span class="as-bar" aria-hidden="true"><span style="width:${Math.max(0.5, Math.min(100, (a.plays / max) * 100)).toFixed(2)}%"></span></span>
              <span class="as-plays-num">${fmt.num(a.plays)}</span>
            </div>
          </td>
          <td class="as-col-date" title="${fmt.date(a.first_ts, { year: 'always' })}">${monthYear(a.first_ts)}</td>
          <td class="as-col-date" title="${fmt.date(a.last_ts, { year: 'always' })}">${ago(a.last_ts, now)}</td>
        </tr>`)}
      </tbody>
    </table>
  </div>`);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  mount(pager, pages > 1 ? html`
    <span class="as-range">${fmt.num(start)}–${fmt.num(end)} of ${fmt.num(total)}</span>
    <div class="btn-group">
      <button type="button" class="btn btn-secondary btn-sm" data-action="as-page" data-page="${p.page - 1}" ${p.page <= 1 ? html`disabled` : ''}>${icon('chevronLeft')}Previous</button>
      <span class="as-pageno">Page ${fmt.num(p.page)} of ${fmt.num(pages)}</span>
      <button type="button" class="btn btn-secondary btn-sm" data-action="as-page" data-page="${p.page + 1}" ${p.page >= pages ? html`disabled` : ''}>Next${icon('chevronRight')}</button>
    </div>` : html`<span class="as-range">${fmt.plural(total, 'artist')}</span>`);
}

async function unhide(name) {
  try {
    await api.post(`/api/v2/artist/${encodeURIComponent(name)}/hide`, { hidden: false });
    toast(html`<strong>${name}</strong> is back in your stats.`, {
      kind: 'success', icon: 'checkCircle',
      action: { label: 'Undo', onClick: async () => { try { await api.post(`/api/v2/artist/${encodeURIComponent(name)}/hide`, { hidden: true }); if (V) load(); } catch (err) { toastError(err); } } },
    });
    load();
  } catch (err) { toastError(err, 'Couldn’t update this artist.'); }
}

export default {
  id: 'artists',
  title: 'Artists',
  mount(root, params) {
    V = { root, p: readParams(params), data: null, err: null, ctrl: null, offs: [], retryT: null };
    renderFrame();
    V.offs.push(actions(root, {
      'as-hidden': () => router.setQuery({ hidden: V.p.hidden ? null : '1', page: null }, { replace: false }),
      'as-page': (ds) => {
        router.setQuery({ page: Number(ds.page) > 1 ? ds.page : null }, { replace: false });
        root.querySelector('h1')?.focus({ preventScroll: true });
      },
      'as-clear': () => { const i = root.querySelector('.as-search-input'); if (i) { i.value = ''; i.focus(); } router.setQuery({ q: null, page: null }); },
      'as-unhide': (ds) => unhide(ds.name),
    }));
    // Whole-row click opens the artist (the name link stays the keyboard / middle-click target).
    const onRow = (ev) => {
      const t = ev.target instanceof Element ? ev.target : null;
      if (!t || t.closest('a, button, input, .info-tip')) return;
      const tr = t.closest('tbody tr[data-name]');
      if (tr && !window.getSelection()?.toString()) router.navigate(artistHref(tr.dataset.name));
    };
    root.addEventListener('click', onRow);
    V.offs.push(() => root.removeEventListener('click', onRow));
    load();
  },
  update(params) {
    if (!V) return;
    const next = readParams(params);
    const prev = V.p;
    V.p = next;
    // Keep the search box as typed (don't fight the user); sync it only when it differs from the URL.
    const input = V.root.querySelector('.as-search-input');
    if (input && document.activeElement !== input && input.value.trim() !== next.q) input.value = next.q;
    if (prev.sort !== next.sort) {
      V.root.querySelectorAll('[data-part="sort"] [role="radio"]').forEach((b) => {
        const on = b.dataset.value === next.sort;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    }
    const hb = V.root.querySelector('[data-action="as-hidden"]');
    if (hb && prev.hidden !== next.hidden) {
      hb.setAttribute('aria-pressed', next.hidden ? 'true' : 'false');
      mount(hb, hiddenToggleInner(next.hidden, V.data?.hidden_total));
    }
    load();
  },
  unmount() {
    if (!V) return;
    if (V.ctrl) V.ctrl.abort();
    clearTimeout(V.retryT);
    V.offs.forEach((off) => { try { off(); } catch { /* ignore */ } });
    V = null;
  },
};

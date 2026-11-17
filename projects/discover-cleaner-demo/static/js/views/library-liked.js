// Library → Liked (GET /api/liked-songs?limit=&offset=): your liked songs from Spotify, newest
// first, 50 at a time ("Load more" / "Load all" page through every like), with how often you've
// played each one (from your local history). Search, sort and a "never played" filter work on
// the loaded songs, are instant and live in the URL (#/library/liked?q=&sort=&unplayed=1).
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import {
  html, mount, icon, fmt, thumb, debounce, actions, loadingState, emptyState, errorState, segmented,
  bindChoiceGroup, infoTip, withBusy, notice,
} from '../core/ui.js';
import { creditLinks, playButton, moreButton, openTrackMenu, searchBox, playCounts, captureFocus, restoreFocus, coolingDownText } from './library-shared.js';

const FRESH_MS = 5 * 60 * 1000;
const PAGE = 50;   // Spotify's page size for saved tracks
const SORTS = [
  { id: 'recent', label: 'Recently liked' },
  { id: 'plays', label: 'Most played' },
  { id: 'name', label: 'A–Z' },
];
const PLAYS_DEF = 'Plays of this song in your whole history (Last.fm scrobbles plus plays in the app). Other versions of the same song — live, remastered — count too.';

// Session cache: Spotify calls are slow and rate-limited, so switching tabs never refetches.
// counts: Map id -> plays, filled page by page (null until the first page's counts arrive).
const cache = { tracks: null, total: null, nextOffset: null, fetchedAt: 0, counts: null };

export function createLikedTab({ setCount }) {
  let el = null;
  let listEl = null;
  let off = [];
  let ctrl = null;
  // more: 'one' | 'all' while extra pages load; moreError: why the last extra page failed
  const st = { q: '', sort: 'recent', unplayed: false, loading: false, error: null, more: null, moreError: null };

  const fetchPage = (offset, signal) => api.get('/api/liked-songs', { params: { limit: PAGE, offset }, signal, timeoutMs: 45000 });

  function takePage(r, { reset }) {
    const rows = Array.isArray(r?.tracks) ? r.tracks : [];
    if (reset) cache.tracks = [];
    const have = new Set(cache.tracks.map((t) => t.id));
    const fresh = rows.filter((t) => t && t.id && !have.has(t.id));
    cache.tracks.push(...fresh);
    cache.total = Number.isFinite(Number(r?.total)) ? Number(r.total) : cache.tracks.length;
    cache.nextOffset = r?.next_offset ?? null;
    setCount('liked', cache.total);
    return fresh;
  }

  async function load({ force = false } = {}) {
    if (ctrl) ctrl.abort();
    const my = new AbortController();
    ctrl = my;
    st.loading = true;
    st.error = null;
    st.more = null;
    st.moreError = null;
    if (cache.tracks) listEl?.classList.add('is-refetching');
    render();
    try {
      const r = await fetchPage(0, my.signal);
      cache.fetchedAt = Date.now();
      cache.counts = null;
      takePage(r, { reset: true });
      loadCounts(cache.tracks, my.signal);
    } catch (err) {
      if (isAbort(err)) return;
      st.error = err;
    } finally {
      if (my === ctrl && !my.signal.aborted) {
        st.loading = false;
        listEl?.classList.remove('is-refetching');
        render();
      }
    }
  }

  /** The next page (or every remaining page, one after another, with all: true). */
  async function loadMore({ all = false } = {}) {
    if (st.more || st.loading || cache.nextOffset == null) return;
    const my = ctrl || new AbortController();
    ctrl = my;
    st.more = all ? 'all' : 'one';
    st.moreError = null;
    render();
    try {
      do {
        const r = await fetchPage(cache.nextOffset, my.signal);
        if (my.signal.aborted) return;
        const fresh = takePage(r, { reset: false });
        loadCounts(fresh, my.signal);
        render();
      } while (all && cache.nextOffset != null && st.more === 'all');
    } catch (err) {
      if (isAbort(err)) return;
      st.moreError = err;
    } finally {
      if (my === ctrl && !my.signal.aborted) {
        st.more = null;
        render();
      }
    }
  }

  async function loadCounts(tracks, signal) {
    if (!tracks?.length) return;
    try {
      const r = await playCounts({ tracks: tracks.map((t) => ({ id: t.id, name: t.name, artist: t.artist || (t.artists || '').split(', ')[0] })) }, { signal });
      if (!cache.counts) cache.counts = new Map();
      tracks.forEach((t, i) => cache.counts.set(t.id, r.tracks[i]));
      render();
    } catch { /* counts are optional */ }
  }

  function visible() {
    const q = st.q.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let list = (cache.tracks || []).map((t, i) => ({ ...t, _i: i, _plays: cache.counts ? cache.counts.get(t.id) : null }));
    if (words.length) list = list.filter((t) => { const hay = `${t.name} ${t.artists} ${t.album} ${(t.genres || []).join(' ')}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
    if (st.unplayed && cache.counts) list = list.filter((t) => t._plays === 0);
    if (st.sort === 'plays') list.sort((a, b) => (b._plays ?? -1) - (a._plays ?? -1) || a._i - b._i);
    else if (st.sort === 'name') list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    return list;
  }

  function row(t) {
    const plays = t._plays;
    return html`<div class="list-row lib-row lib-liked-row" role="listitem" data-key="${t.id}">
      ${thumb(t.image, { alt: '' })}
      <div class="row-main">
        <div class="row-title">${t.name}</div>
        <div class="row-sub">${plays == null ? '' : html`<span class="lib-plays-inline${plays === 0 ? ' is-zero' : ''}">${plays > 0 ? fmt.plural(plays, 'play') : 'Not played'} · </span>`}${creditLinks(t.artist, t.artists)}${t.album ? html`<span class="lib-album"> · ${t.album}</span>` : ''}</div>
      </div>
      <div class="lib-genres">${(t.genres || []).slice(0, 2).map((g) => html`<span class="chip">${g}</span>`)}</div>
      <span class="lib-plays num${plays === 0 ? ' is-zero' : ''}">${plays == null ? '' : plays > 0 ? fmt.plural(plays, 'play') : 'Not played yet'}</span>
      <span class="lib-liked-at" ${t.liked_at ? html`data-tip="Liked ${fmt.date(t.liked_at, { year: 'always' })}"` : ''}>${t.liked_at ? fmt.date(t.liked_at) : ''}</span>
      <div class="row-actions">${playButton({ uri: t.uri, id: t.id, name: t.name })}${moreButton(`More actions for ${t.name}`, { key: t.id })}</div>
    </div>`;
  }

  function render() {
    if (!el) return;
    paintSummary();
    const saved = captureFocus(listEl);
    if (!cache.tracks) {
      if (st.error) mount(listEl, failure());
      else mount(listEl, loadingState('Getting your liked songs from Spotify…'));
      return;
    }
    const note = st.error ? notice({ tone: 'warning', icon: st.error.isRateLimited ? 'hourglass' : 'alert', className: 'lib-notice', body: `${st.error.isRateLimited ? coolingDownText(st.error) : st.error.message} Showing the list from ${fmt.relTime(cache.fetchedAt)}.` }) : '';
    if (!cache.tracks.length) {
      mount(listEl, html`${note}${emptyState({ icon: 'heart', title: 'No liked songs yet', body: 'Press Like (L) while a song plays and it shows up here — liking a backlog track also clears it from your backlog.' })}`);
      return;
    }
    const list = visible();
    if (!list.length) {
      mount(listEl, html`${note}${emptyState({
        icon: st.unplayed && !st.q ? 'checkCircle' : 'search',
        title: st.unplayed && !st.q ? "You've played every liked song" : `No liked songs match “${st.q}”`,
        body: st.unplayed && !st.q ? 'Every song on this list shows up in your listening history.' : 'Search looks at song, artist, album and genre.',
        action: { label: 'Show all liked songs', action: 'lk-reset' },
      })}`);
      return;
    }
    mount(listEl, html`${note}<div class="list lib-list" role="list" aria-label="Liked songs">${list.map(row)}</div>${moreFooter()}`);
    restoreFocus(listEl, saved);
  }

  /** "Showing 50 of 1,234 · Load 50 more · Load all" under the list while Spotify has more. */
  function moreFooter() {
    const loaded = (cache.tracks || []).length;
    const total = Math.max(cache.total || 0, loaded);
    const more = cache.nextOffset != null;
    if (!more && !st.moreError) return '';
    const left = Math.max(0, total - loaded);
    const filtered = !!(st.q || st.unplayed);
    const busy = st.more === 'all'
      ? html`<span class="lib-more-busy" role="status"><span class="spinner spinner-sm" aria-hidden="true"></span>Loading all your liked songs… ${fmt.num(loaded)} of ${fmt.num(total)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-action="lk-stop">Stop</button>`
      : st.more === 'one'
        ? html`<span class="lib-more-busy" role="status"><span class="spinner spinner-sm" aria-hidden="true"></span>Loading…</span>`
        : html`<button type="button" class="btn btn-secondary btn-sm" data-action="lk-more">${icon('chevronDown')}Load ${fmt.num(Math.min(PAGE, left || PAGE))} more</button>
          ${left > PAGE ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="lk-all">Load all ${fmt.num(total)}</button>` : ''}`;
    return html`<div class="lib-more">
      <p class="lib-more-text">Showing ${fmt.num(loaded)} of ${fmt.num(total)} liked songs, newest first.${filtered ? ' Search and filters cover the loaded songs.' : ''}</p>
      ${st.moreError ? html`<p class="lib-more-error" role="alert">${st.moreError.isRateLimited ? coolingDownText(st.moreError) : st.moreError.message}</p>` : ''}
      <div class="lib-more-actions">${more ? busy : ''}</div>
    </div>`;
  }

  function failure() {
    const err = st.error;
    return errorState(err, {
      title: err.isRateLimited ? 'Spotify is cooling down' : err.status === 401 ? 'Spotify is not connected' : "Couldn't load your liked songs",
      body: err.isRateLimited ? `${coolingDownText(err)} Your plays, backlog and watchlist still work.` : `${err.message} Your plays and watchlist still work.`,
      retry: () => load(),
    });
  }

  function paintSummary() {
    const s = el.querySelector('[data-summary]');
    if (!s) return;
    const all = cache.tracks || [];
    let content = '';
    if (all.length) {
      const zero = cache.counts ? all.filter((t) => cache.counts.get(t.id) === 0).length : null;
      const shown = visible().length;
      const total = Math.max(cache.total || 0, all.length);
      const whole = total <= all.length;
      let lead;
      if (shown !== all.length) lead = `${fmt.num(shown)} of ${fmt.num(all.length)} loaded liked songs`;
      else if (whole) lead = `All ${fmt.num(total)} of your liked songs`;
      else lead = `Your ${fmt.num(all.length)} most recent liked songs (of ${fmt.num(total)})`;
      content = html`<span>${lead}</span>${zero ? html`<span class="lib-summary-insight"> · ${fmt.num(zero)} never played${whole ? '' : ' so far'}${infoTip('Liked songs with no plays in your history (Last.fm scrobbles plus plays in the app). Use the filter to find them.', { label: 'Never played' })}</span>` : ''}`;
    }
    mount(s, content);
    const chip = el.querySelector('[data-action="lk-unplayed"]');
    if (chip) {
      chip.setAttribute('aria-pressed', st.unplayed ? 'true' : 'false');
      chip.disabled = !cache.counts;
    }
  }

  const pushSearch = debounce((q) => router.setQuery({ q: q || null }), 300);

  function wire() {
    off.push(actions(el, {
      'lk-refresh': (ds, btn) => withBusy(btn, () => load({ force: true })),
      'lk-more': () => loadMore(),
      'lk-all': () => loadMore({ all: true }),
      'lk-stop': () => { if (st.more === 'all') st.more = 'one'; },
      'lk-unplayed': () => router.setQuery({ unplayed: st.unplayed ? null : '1' }),
      'lk-reset': () => { const i = el.querySelector('.lib-search-input'); if (i) i.value = ''; router.setQuery({ q: null, unplayed: null }); },
      'lib-more': (ds, btn) => {
        const t = (cache.tracks || []).find((x) => x.id === ds.key);
        if (t) openTrackMenu(btn, { id: t.id, name: t.name, artist: t.artist || (t.artists || '').split(', ')[0], image: t.image });
      },
    }));
    off.push(bindChoiceGroup(el.querySelector('[data-sort]'), (v) => router.setQuery({ sort: v === 'recent' ? null : v })));
    const input = el.querySelector('.lib-search-input');
    const onInput = () => { st.q = input.value.trim(); render(); pushSearch(st.q); };
    const onKey = (ev) => { if (ev.key === 'Escape' && input.value) { ev.stopPropagation(); input.value = ''; onInput(); } };
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKey);
    off.push(() => { input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey); pushSearch.cancel(); });
  }

  function applyParams(params) {
    st.q = (params?.q || '').trim();
    st.sort = SORTS.some((s) => s.id === params?.sort) ? params.sort : 'recent';
    st.unplayed = params?.unplayed === '1';
  }

  return {
    mount(container, params) {
      el = container;
      applyParams(params);
      st.more = null;          // a page load cut short by leaving the tab doesn't block "Load more"
      st.moreError = null;
      mount(el, html`
        <div class="lib-toolbar">
          ${searchBox({ value: st.q, placeholder: 'Search liked songs', label: 'Search your liked songs' })}
          <div data-sort>${segmented({ items: SORTS, selected: st.sort, label: 'Sort liked songs' })}</div>
          <button type="button" class="chip chip-lg lib-toggle-chip" data-action="lk-unplayed" aria-pressed="${st.unplayed ? 'true' : 'false'}">${icon('filter')}Never played</button>
          <button type="button" class="btn btn-icon btn-sm" data-action="lk-refresh" aria-label="Check Spotify for new likes" data-tip="Check Spotify for new likes">${icon('refresh')}</button>
        </div>
        <p class="lib-summary lib-summary-line" data-summary aria-live="polite"></p>
        <div class="lib-liked-cols"><span></span><span>Title</span><span>Genres</span><span class="num">Your plays ${infoTip(PLAYS_DEF, { label: 'Your plays' })}</span><span>Liked</span><span></span></div>
        <div class="lib-body" data-list></div>`);
      listEl = el.querySelector('[data-list]');
      wire();
      if (cache.tracks) { setCount('liked', cache.total ?? cache.tracks.length); render(); }
      if (!cache.tracks || Date.now() - cache.fetchedAt > FRESH_MS) load();
      else if (!cache.counts) loadCounts(cache.tracks);
      else render();
    },
    update(params) {
      const prev = { ...st };
      applyParams(params);
      const input = el?.querySelector('.lib-search-input');
      if (input && document.activeElement !== input && input.value !== st.q) input.value = st.q;
      const seg = el?.querySelector(`[data-sort] [data-value="${st.sort}"]`);
      if (seg && seg.getAttribute('aria-checked') !== 'true') {
        el.querySelectorAll('[data-sort] [role="radio"]').forEach((b) => { const on = b === seg; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      }
      if (prev.q !== st.q || prev.sort !== st.sort || prev.unplayed !== st.unplayed) render();
    },
    unmount() {
      if (ctrl) ctrl.abort();
      off.forEach((fn) => fn());
      off = [];
      el = null;
      listEl = null;
    },
  };
}

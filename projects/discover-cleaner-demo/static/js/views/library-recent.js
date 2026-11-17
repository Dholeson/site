// Library → Recent plays (GET /api/v2/history): every play, newest first, grouped by day.
// Filter box (q) and an artist filter live in the URL (#/library/recent?q=&artist=), "Show older
// plays" pages with next_before_ms, and new plays slide in at the top while you listen.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import {
  html, mount, icon, fmt, thumb, artistLink, artistLinks, debounce, actions, loadingState, emptyState, errorState,
  withBusy, reportError, toDate,
} from '../core/ui.js';
import { timeOfDay, playButton, moreButton, openTrackMenu, searchBox, captureFocus, restoreFocus, keepScrollAnchor } from './library-shared.js';

const PAGE = 50;
const SOURCE = {
  live: { label: 'In app', tip: 'Played in Spotify while Discover Cleaner was running' },
  lastfm: { label: 'Last.fm', tip: 'From your Last.fm scrobble history' },
  spotify_recent: { label: 'Spotify', tip: "From Spotify's recently played list" },
};

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function groupByDay(items) {
  const groups = [];
  let cur = null;
  for (const p of items) {
    const day = p.day || localDay(toDate(p.ts_ms) || new Date());
    if (!cur || cur.day !== day) { cur = { day, items: [] }; groups.push(cur); }
    cur.items.push(p);
  }
  return groups;
}

function badges(p) {
  const src = SOURCE[p.source] || { label: p.source || 'Unknown', tip: '' };
  const parts = [html`<span class="lib-src" data-tip="${src.tip}">${src.label}</span>`];
  if (p.source === 'live' && Number(p.listened_s) > 0) {
    parts.push(html`<span class="lib-heard num" data-tip="How long you listened while the app was running">heard ${fmt.clock(Number(p.listened_s) * 1000)}</span>`);
  }
  if (p.is_backlog) parts.push(html`<span class="lib-tag lib-tag-accent" data-tip="Played from your backlog playlist">Backlog</span>`);
  if (p.hidden) parts.push(html`<span class="lib-tag" data-tip="You hid this artist from your stats; plays still show here">Hidden</span>`);
  return parts;
}

function playRow(p) {
  const key = `p${p.id}`;
  const time = timeOfDay(p.ts_ms);
  const approx = p.bulk ? html`<span aria-hidden="true">≈ </span><span class="sr-only">About </span>` : '';
  return html`<div class="list-row lib-row lib-play-row${p._new ? ' is-new' : ''}" role="listitem" data-key="${key}">
    <span class="lib-time num" ${p.bulk ? html`data-tip="Scrobbled offline in a batch, so the exact time isn't known" tabindex="0"` : ''}>${approx}${time}</span>
    ${thumb(p.image, { alt: '' })}
    <div class="row-main">
      <div class="row-title">${p.track}</div>
      <div class="row-sub"><span class="lib-time-inline num">${p.bulk ? '≈ ' : ''}${time} · </span>${artistLink(p.artist)}${p.album ? html`<span class="lib-album"> · ${p.album}</span>` : ''}</div>
    </div>
    <div class="lib-badges">${badges(p)}</div>
    <div class="row-actions">${playButton({ id: p.spotify_track_id, name: p.track, artist: p.artist })}${moreButton(`More actions for ${p.track}`, { key })}</div>
  </div>`;
}

export function createRecentTab({ ctx }) {
  let el = null;
  let body = null;
  let more = null;
  let summary = null;
  let input = null;
  let off = [];
  let ctrl = null;
  let seq = 0;
  let status = null;
  let lastPlaysToday = null;
  let lastTrackId = null;
  let refreshTimer = null;
  let retryTimer = null;
  const st = { q: '', artist: '', items: [], next: null, loading: false, error: null, loaded: false };

  const filtered = () => !!(st.q || st.artist);

  // ---------------------------------------------------------------- data
  async function load({ reset = false } = {}) {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const mySeq = ++seq;
    st.loading = true;
    st.error = null;
    if (reset) { st.next = null; }
    if (reset && st.loaded) body.classList.add('is-refetching');
    paintMore();
    try {
      const r = await api.get('/api/v2/history', {
        params: { limit: PAGE, q: st.q || undefined, artist: st.artist || undefined, before_ms: reset ? undefined : st.next || undefined },
        signal: ctrl.signal,
        timeoutMs: 15000,
      });
      if (mySeq !== seq) return;
      const items = Array.isArray(r?.items) ? r.items : [];
      st.items = reset ? items : dedupe([...st.items, ...items]);
      st.next = r?.next_before_ms ?? null;
      st.demoEnd = r?.demo_end || null;   // the static web demo carries only the latest plays
      st.loaded = true;
    } catch (err) {
      if (isAbort(err) || mySeq !== seq) return;
      st.error = err;
      // Right after the app starts the ledger takes a few seconds to build: try again by itself.
      if (err.code === 'history_not_ready') { clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (el) load({ reset: true }); }, 5000); }
      if (reset) st.items = [];
    } finally {
      if (mySeq === seq) {
        st.loading = false;
        body?.classList.remove('is-refetching');
        render();
      }
    }
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }

  // New plays land while you listen: merge the fresh first page into what is loaded.
  async function refreshTop() {
    if (!el || st.loading || !st.loaded || st.error) return;
    const mySeq = seq;
    try {
      const r = await api.get('/api/v2/history', { params: { limit: PAGE, q: st.q || undefined, artist: st.artist || undefined }, timeoutMs: 10000 });
      if (mySeq !== seq || !el) return;
      const fresh = Array.isArray(r?.items) ? r.items : [];
      if (!fresh.length) return;
      const known = new Set(st.items.map((p) => p.id));
      const freshIds = new Set(fresh.map((p) => p.id));
      const newest = st.items[0]?.ts_ms ?? 0;
      const oldestFresh = fresh[fresh.length - 1].ts_ms;
      const added = fresh.filter((p) => !known.has(p.id) && p.ts_ms >= newest).map((p) => ({ ...p, _new: true }));
      // A provisional in-app play can be replaced by its Last.fm scrobble: drop rows that vanished.
      const kept = st.items.filter((p) => p.ts_ms < oldestFresh || freshIds.has(p.id)).map((p) => (p._new ? { ...p, _new: false } : p));
      if (!added.length && kept.length === st.items.length) return;
      st.items = dedupe([...added, ...kept]).sort((a, b) => b.ts_ms - a.ts_ms || b.id - a.id);
      if (!st.items.length) st.next = r?.next_before_ms ?? null;
      keepScrollAnchor(body, render);
    } catch (err) {
      if (!isAbort(err) && err?.status !== 503) reportError(err);
    }
  }

  // ---------------------------------------------------------------- render
  function render() {
    if (!el) return;
    paintFilters();
    paintMore();
    const saved = captureFocus(body);
    if (!st.items.length) {
      if (st.loading || !st.loaded && !st.error) mount(body, loadingState('Loading your plays…'));
      else if (st.error) {
        const notReady = st.error.code === 'history_not_ready';
        mount(body, errorState(st.error, {
          title: notReady ? 'Your history is still being prepared' : "Couldn't load your plays",
          body: notReady ? 'This takes a few seconds after the app starts — the list appears by itself. Everything else keeps working.' : `${st.error.message} Your backlog and liked songs still work.`,
          retry: () => load({ reset: true }),
        }));
      } else if (filtered()) {
        mount(body, emptyState({
          icon: 'search',
          title: st.q ? `No plays match “${st.q}”${st.artist ? ` by ${st.artist}` : ''}` : `No plays by ${st.artist} yet`,
          body: 'Try a different word, or clear the filter to see everything.',
          action: { label: 'Clear filters', action: 'rec-clear-filters' },
        }));
      } else {
        mount(body, emptyState({
          icon: 'clock',
          title: 'No plays yet',
          body: 'Plays show up here as you listen in Spotify with the app running. Import your Last.fm history in Settings to see everything from before.',
          action: { label: 'Import in Settings', href: '#/settings?section=history' },
        }));
      }
      paintNow();
      return;
    }
    const groups = groupByDay(st.items);
    const today = localDay();
    const showNow = !filtered() && !!status?.current_track;
    if (showNow && groups[0]?.day !== today) groups.unshift({ day: today, items: [] });
    mount(body, groups.map((g, i) => {
      const complete = i < groups.length - 1 || !st.next;
      const n = g.items.length;
      const headId = `rec-day-${g.day}`;
      return html`<section class="lib-day" aria-labelledby="${headId}">
        <h2 class="lib-day-title" id="${headId}">${fmt.dayLabel(g.day)}${n && complete ? html`<span class="lib-day-meta">${fmt.plural(n, 'play')}</span>` : ''}</h2>
        <div class="list lib-list" role="list">
          ${g.day === today && showNow ? html`<div class="lib-now-slot" data-now-slot role="presentation"></div>` : ''}
          ${g.items.map(playRow)}
        </div>
      </section>`;
    }));
    paintNow();
    restoreFocus(body, saved);
    st.items.forEach((p) => { p._new = false; });
  }

  function paintFilters() {
    const box = el.querySelector('[data-artist-filter]');
    if (box) {
      mount(box, st.artist ? html`<span class="lib-filter-chip">${icon('artists')}<span class="truncate">Only ${st.artist}</span><button type="button" class="lib-chip-x" data-action="rec-clear-artist" aria-label="Show plays by every artist">${icon('close')}</button></span>` : '');
    }
    if (input && document.activeElement !== input && input.value !== st.q) input.value = st.q;
    if (summary) {
      const n = st.items.length;
      let text = '';
      if (st.loaded && !st.error && n) {
        const oldest = st.items[n - 1];
        text = st.next || st.demoEnd
          ? `${fmt.plural(n, 'play')} shown · back to ${fmt.date(oldest.ts_ms, { year: 'auto' })}`
          : `All ${fmt.plural(n, 'play')}${filtered() ? ' that match' : ''}`;
      }
      if (summary.textContent !== text) summary.textContent = text;
    }
  }

  function paintMore() {
    if (!more) return;
    if (st.items.length && st.next) {
      if (!more.querySelector('[data-action="rec-more"]')) {
        mount(more, html`<button type="button" class="btn btn-secondary" data-action="rec-more">${icon('chevronDown')}Show older plays</button>`);
      }
      const btn = more.querySelector('[data-action="rec-more"]');
      btn.classList.toggle('is-busy', st.loading);
      btn.setAttribute('aria-busy', st.loading ? 'true' : 'false');
    } else if (st.items.length && st.loaded && !st.next) {
      mount(more, html`<p class="lib-end muted small">${st.demoEnd || (filtered() ? "That's every matching play." : 'That’s the start of your listening history.')}</p>`);
    } else {
      mount(more, '');
    }
  }

  function paintNow() {
    const slot = el?.querySelector('[data-now-slot]');
    if (!slot) return;
    const t = status?.current_track;
    if (!t) { if (slot.firstChild) keepScrollAnchor(body, () => mount(slot, '')); slot.dataset.sig = ''; return; }
    const playing = !!status.is_playing;
    const inBacklog = !!status.current_in_playlist;
    const sig = `${t.id}|${playing}|${inBacklog}`;
    if (slot.dataset.sig === sig) return;
    slot.dataset.sig = sig;
    const artists = t.artist_list?.length ? t.artist_list : t.artists;
    keepScrollAnchor(body, () => mount(slot, html`<div class="list-row lib-row lib-play-row lib-now-row" role="listitem" data-key="now">
      <span class="lib-time lib-now-time">${playing ? html`<span class="lib-eq" aria-hidden="true"><i></i><i></i><i></i></span>Now` : 'Paused'}</span>
      ${thumb(t.image, { alt: '' })}
      <div class="row-main">
        <div class="row-title">${t.name}<span class="sr-only"> (${playing ? 'playing now' : 'paused'})</span></div>
        <div class="row-sub"><span class="lib-time-inline">${playing ? 'Now' : 'Paused'} · </span>${artistLinks(artists)}${t.album ? html`<span class="lib-album"> · ${t.album}</span>` : ''}</div>
      </div>
      <div class="lib-badges"><span class="lib-src" data-tip="Playing in Spotify right now; it's added to your history when it ends">Playing</span>${inBacklog ? html`<span class="lib-tag lib-tag-accent" data-tip="This track is in your backlog playlist">Backlog</span>` : ''}</div>
      <div class="row-actions"><span class="row-action-slot" aria-hidden="true"></span>${moreButton(`More actions for ${t.name}`, { key: 'now' })}</div>
    </div>`));
  }

  // ---------------------------------------------------------------- events
  function rowItem(key) {
    if (key === 'now') {
      const t = status?.current_track;
      if (!t) return null;
      return { id: t.id, name: t.name, artist: t.artist_list?.[0]?.name || (t.artists || '').split(', ')[0], image: t.image, url: t.url };
    }
    const p = st.items.find((x) => `p${x.id}` === key);
    return p ? { id: p.spotify_track_id, name: p.track, artist: p.artist, image: p.image } : null;
  }

  const pushFilter = debounce((q) => { router.setQuery({ q: q || null }); }, 300);

  function wire() {
    off.push(actions(el, {
      'rec-more': (ds, btn) => withBusy(btn, () => load()),
      'rec-clear-artist': () => router.setQuery({ artist: null }),
      'rec-clear-filters': () => { if (input) input.value = ''; router.setQuery({ q: null, artist: null }); },
      'lib-more': (ds, btn) => {
        const t = rowItem(ds.key);
        if (!t) return;
        const extra = t.artist && st.artist.toLowerCase() !== t.artist.toLowerCase()
          ? [{ label: `Only plays by ${t.artist}`, icon: 'filter', onSelect: () => router.setQuery({ artist: t.artist }) }]
          : [];
        openTrackMenu(btn, t, { extra });
      },
    }));
    const onInput = () => pushFilter(input.value.trim());
    input.addEventListener('input', onInput);
    const onKey = (ev) => { if (ev.key === 'Escape' && input.value) { ev.stopPropagation(); input.value = ''; pushFilter.cancel(); router.setQuery({ q: null }); } };
    input.addEventListener('keydown', onKey);
    off.push(() => { input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey); pushFilter.cancel(); });
  }

  return {
    mount(container, params) {
      el = container;
      st.q = (params?.q || '').trim();
      st.artist = (params?.artist || '').trim();
      mount(el, html`
        <div class="lib-toolbar">
          ${searchBox({ value: st.q, placeholder: 'Filter by song, artist or album', label: 'Filter your plays' })}
          <div class="lib-filter-slot" data-artist-filter></div>
          <p class="lib-summary" data-summary aria-live="polite"></p>
        </div>
        <div class="lib-body" data-body></div>
        <div class="lib-more" data-more></div>`);
      body = el.querySelector('[data-body]');
      more = el.querySelector('[data-more]');
      summary = el.querySelector('[data-summary]');
      input = el.querySelector('.lib-search-input');
      wire();
      render();
      load({ reset: true });
    },
    update(params) {
      const q = (params?.q || '').trim();
      const artist = (params?.artist || '').trim();
      if (q === st.q && artist === st.artist) return;
      st.q = q;
      st.artist = artist;
      load({ reset: true });
      paintFilters();
    },
    onStatus(s, info = {}) {
      status = s;
      const changed = info.changed || new Set();
      if (changed.has('current_track') || changed.has('is_playing') || changed.has('current_in_playlist')) paintNow();
      const plays = s?.today?.plays_today;
      const tid = s?.current_track?.id || null;
      const bump = (lastPlaysToday != null && plays !== lastPlaysToday) || (lastTrackId != null && tid !== lastTrackId);
      lastPlaysToday = plays ?? lastPlaysToday;
      lastTrackId = tid;
      if (bump && !info.initial) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshTop, 1500);
      }
      if (!info.initial && !st.items.length && !st.loading && !filtered() && body && !body.querySelector('[data-now-slot]') && s?.current_track) render();
    },
    unmount() {
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      if (ctrl) ctrl.abort();
      off.forEach((fn) => fn());
      off = [];
      el = null;
    },
  };
}

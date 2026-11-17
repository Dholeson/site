// Library → Favorites (GET /api/favorites/overview, POST /api/favorites): new releases from your
// favorite artists (with NEW since your last visit) and the favorites list itself — liked-song
// counts, your plays, remove with undo, add, and restore artists you removed.
// The overview can take ~13 s the first time (Spotify lookups), so it is cached for the session.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import store from '../core/store.js';
import {
  html, mount, icon, fmt, thumb, artistLink, actions, loadingState, emptyState, errorState, segmented,
  bindChoiceGroup, toast, withBusy, reportError, toDate, sectionHeader, artistThumb, notice,
} from '../core/ui.js';
import { playCounts, playAlbum, coolingDownText, openWatchlistDialog } from './library-shared.js';

const VISIT_KEY = 'dc.favorites.lastVisit';
const RELEASE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'album', label: 'Albums' },
  { id: 'single', label: 'Singles & EPs' },
];
const RELEASES_SHOWN = 12;
const DAY = 86400e3;

const cache = { data: null, fetchedAt: 0, plays: null };
let visitBaseline = null;   // ms: releases after this are NEW (read once per session)

function baseline() {
  if (visitBaseline != null) return visitBaseline;
  let prev = null;
  try { prev = Number(localStorage.getItem(VISIT_KEY)) || null; } catch { /* storage unavailable */ }
  visitBaseline = prev || Date.now() - 14 * DAY;
  try { localStorage.setItem(VISIT_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  return visitBaseline;
}

function releaseDate(r) {
  const s = String(r.release_date || '');
  if (!s) return { label: '', ms: 0 };
  const d = toDate(s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s);
  const ms = d ? d.getTime() : 0;
  if (r.release_precision === 'year' || s.length === 4) return { label: s.slice(0, 4), ms };
  if (r.release_precision === 'month' || s.length === 7) return { label: fmt.month(s.slice(0, 7), { short: true }), ms };
  return { label: fmt.date(s), ms };
}

const typeLabel = (t) => ({ album: 'Album', single: 'Single', compilation: 'Compilation', ep: 'EP' }[String(t || '').toLowerCase()] || 'Release');

export function createFavoritesTab() {
  let el = null;
  let off = [];
  let ctrl = null;
  const st = { filter: 'all', showAll: false, loading: false, error: null, sort: 'plays' };

  async function load({ force = false } = {}) {
    if (ctrl) ctrl.abort();
    const my = new AbortController();
    ctrl = my;
    st.loading = true;
    st.error = null;
    if (cache.data) el?.querySelector('[data-body]')?.classList.add('is-refetching');
    else render();
    try {
      const r = await api.get('/api/favorites/overview', { params: { force: force ? 1 : undefined }, signal: my.signal, timeoutMs: 60000 });
      cache.data = r || {};
      cache.fetchedAt = Date.now();
      loadPlays();
    } catch (err) {
      if (isAbort(err)) return;
      st.error = err;
    } finally {
      if (my === ctrl) {
        st.loading = false;
        el?.querySelector('[data-body]')?.classList.remove('is-refetching');
        render();
      }
    }
  }

  async function loadPlays() {
    const favs = cache.data?.favorites || [];
    if (!favs.length) return;
    try {
      const r = await playCounts({ artists: favs.map((f) => f.display_name || f.name) });
      cache.plays = r.artists;
      render();
    } catch (err) { if (!isAbort(err)) reportError(err); }
  }

  // ---------------------------------------------------------------- render
  function render() {
    const bodyEl = el?.querySelector('[data-body]');
    if (!bodyEl) return;
    const d = cache.data;
    if (!d) {
      if (st.error) {
        const err = st.error;
        mount(bodyEl, errorState(err, {
          title: err.isRateLimited ? 'Spotify is cooling down' : err.status === 401 ? 'Spotify is not connected' : "Couldn't load your favorites",
          body: err.isRateLimited ? `${coolingDownText(err)} Your plays and backlog still work.` : `${err.message} Your plays and backlog still work.`,
          retry: () => load(),
        }));
      } else {
        mount(bodyEl, loadingState('Checking your favorite artists for new releases… the first look can take a few seconds.'));
      }
      return;
    }
    const focusRow = document.activeElement?.closest?.('[data-fkey]');
    const focusKey = focusRow?.dataset.fkey;
    const focusAction = document.activeElement?.dataset?.action;
    const focusIndex = focusRow ? [...focusRow.parentElement.children].indexOf(focusRow) : -1;
    const focusOptOut = !!focusRow?.closest('.lib-optout-list');
    const addInput = bodyEl.querySelector('#fv-add-input');
    const addState = addInput ? { value: addInput.value, focused: document.activeElement === addInput } : null;
    mount(bodyEl, html`
      ${st.error ? notice({ tone: 'warning', icon: st.error.isRateLimited ? 'hourglass' : 'alert', className: 'lib-notice', body: `${st.error.isRateLimited ? coolingDownText(st.error) : st.error.message} Showing what was loaded ${fmt.relTime(cache.fetchedAt)}.` }) : ''}
      ${releasesSection(d)}
      ${favoritesSection(d)}
      ${optOutSection(d)}`);
    const newAdd = bodyEl.querySelector('#fv-add-input');
    if (addState && newAdd) {
      newAdd.value = addState.value;
      if (addState.focused) newAdd.focus({ preventScroll: true });
    }
    if (focusKey) {
      const row = bodyEl.querySelector(`[data-fkey="${CSS.escape(focusKey)}"]`);
      const target = row?.querySelector(`[data-action="${focusAction}"]`) || row?.querySelector('a, button');
      if (target) target.focus({ preventScroll: true });
      else {
        // The row left this list: move to the row that took its place.
        const rows = [...bodyEl.querySelectorAll(focusOptOut ? '.lib-optout-list .lib-fav-row' : '.lib-fav-list:not(.lib-optout-list) .lib-fav-row')];
        const next = rows[Math.min(focusIndex, rows.length - 1)];
        (next?.querySelector(`[data-action="${focusAction}"]`) || next?.querySelector('button') || bodyEl.querySelector('#fv-add-input'))?.focus({ preventScroll: true });
      }
    }
    segOffs.splice(0).forEach((fn) => fn());
    const seg = bodyEl.querySelector('[data-rel-filter]');
    if (seg) bindSeg(seg, (v) => { st.filter = v; st.showAll = false; render(); });
    const sortSeg = bodyEl.querySelector('[data-fav-sort]');
    if (sortSeg) bindSeg(sortSeg, (v) => { st.sort = v; render(); });
  }

  const segOffs = [];
  function bindSeg(node, fn) {
    segOffs.push(bindChoiceGroup(node, fn));
  }

  function releasesSection(d) {
    const favCount = d.favorite_count ?? (d.favorites || []).length;
    const since = baseline();
    const all = (d.release_feed || []).map((r) => ({ ...r, _date: releaseDate(r) }));
    const isNew = (r) => r._date.ms > since && r._date.ms <= Date.now() + DAY;
    const filtered = all.filter((r) => st.filter === 'all' || (st.filter === 'album' ? r.album_type === 'album' : r.album_type !== 'album'));
    const shown = st.showAll ? filtered : filtered.slice(0, RELEASES_SHOWN);
    const newCount = all.filter(isNew).length;
    const partial = d.release_partial && d.release_total;
    const desc = favCount
      ? `Latest albums and singles from your ${fmt.plural(favCount, 'favorite artist')}, newest first.${newCount ? ` ${fmt.num(newCount)} new since your last visit.` : ''}`
      : 'Add favorite artists below to follow their new releases here.';
    let bodyHtml;
    if (!favCount) bodyHtml = '';
    else if (!all.length) {
      bodyHtml = emptyState({
        icon: d.release_error ? 'hourglass' : 'disc',
        compact: true,
        title: d.release_demo ? 'Not part of the demo' : d.release_error ? 'New releases are on their way' : 'No releases found yet',
        body: d.release_error || 'Nothing new from your favorites turned up. Check back later.',
      });
    } else if (!filtered.length) {
      bodyHtml = emptyState({ icon: 'disc', compact: true, title: st.filter === 'album' ? 'No albums in this list' : 'No singles or EPs in this list' });
    } else {
      bodyHtml = html`<ul class="lib-releases" role="list">${shown.map((r) => html`<li class="lib-release">
        <div class="lib-release-art">
          ${thumb(r.image || r.artist_image, { alt: '', iconName: 'disc', className: 'lib-release-img' })}
          ${r.album_id ? html`<button type="button" class="lib-release-play" data-action="fv-play" data-id="${r.album_id}" data-name="${r.album_name}" data-artist="${r.artist_name}" aria-label="Play ${r.album_name} by ${r.artist_name}">${icon('play')}</button>` : ''}
          ${isNew(r) ? html`<span class="lib-new-badge">New</span>` : ''}
        </div>
        <div class="lib-release-title" title="${r.album_name}">${r.album_name}</div>
        <div class="lib-release-sub">${artistLink(r.artist_name)}</div>
        <div class="lib-release-meta">${typeLabel(r.album_type)}${r._date.label ? ` · ${r._date.label}` : ''}</div>
      </li>`)}</ul>
      ${filtered.length > RELEASES_SHOWN ? html`<div class="lib-more"><button type="button" class="btn btn-secondary btn-sm" data-action="fv-releases-toggle">${st.showAll ? 'Show fewer' : `Show all ${fmt.num(filtered.length)}`}</button></div>` : ''}`;
    }
    return html`<section class="section lib-section" aria-labelledby="fv-rel-h">
      ${sectionHeader({
        id: 'fv-rel-h',
        title: 'New releases',
        desc,
        info: 'Albums, EPs and singles your favorite artists put out, from Spotify. “New” marks releases that came out since you last opened this tab.',
        actions: all.length ? html`<div data-rel-filter>${segmented({ items: RELEASE_FILTERS, selected: st.filter, label: 'Release type' })}</div>` : '',
      })}
      ${partial ? html`<p class="lib-partial muted small">${icon('hourglass')}<span>Checked ${fmt.num(d.release_checked || 0)} of ${fmt.plural(d.release_total, 'artist')} so far — the rest fill in shortly.</span> <button type="button" class="btn btn-ghost btn-sm" data-action="fv-reload">Check again</button></p>` : ''}
      ${bodyHtml}
    </section>`;
  }

  function favoritesSection(d) {
    const favs = [...(d.favorites || [])];
    const plays = cache.plays || {};
    const nameOf = (f) => f.display_name || f.name;
    const playsOf = (f) => plays[nameOf(f)];
    if (st.sort === 'plays' && cache.plays) favs.sort((a, b) => (playsOf(b) ?? -1) - (playsOf(a) ?? -1) || nameOf(a).localeCompare(nameOf(b)));
    else if (st.sort === 'liked') favs.sort((a, b) => (b.liked_count ?? 0) - (a.liked_count ?? 0) || nameOf(a).localeCompare(nameOf(b)));
    else favs.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }));
    const images = new Map();
    const latest = new Map();
    (d.release_feed || []).forEach((r) => {
      const k = String(r.artist_name || '').toLowerCase();
      if (r.artist_image && !images.has(k)) images.set(k, r.artist_image);
      if (!latest.has(k)) latest.set(k, { ...r, _label: releaseDate(r).label });
    });
    const list = favs.length ? html`<ul class="lib-fav-list" role="list">${favs.map((f) => {
      const name = nameOf(f);
      const k = name.toLowerCase();
      const p = playsOf(f);
      const rel = latest.get(k);
      return html`<li class="lib-fav-row" data-fkey="${f.name}">
        ${artistThumb(images.get(k), name, { size: 44 })}
        <div class="lib-fav-main">
          <a class="lib-fav-name" href="${router.href('artist', { name })}">${name}</a>
          <div class="lib-fav-sub">${[
            Number(f.liked_count) > 0 ? fmt.plural(f.liked_count, 'liked song') : null,
            rel ? `latest: ${rel.album_name}${rel._label ? ` (${rel._label})` : ''}` : null,
          ].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="lib-fav-plays">
          ${p == null ? '' : html`<span class="num lib-fav-count${p > 0 ? '' : ' is-zero'}">${p > 0 ? fmt.plural(p, 'play') : 'Not played yet'}</span>`}
        </div>
        <div class="lib-fav-actions">
          <button type="button" class="btn btn-icon btn-sm" data-action="fv-watch" data-name="${name}" aria-label="Save ${name} to your watchlist" data-tip="Save to watchlist">${icon('bookmark')}</button>
          <button type="button" class="btn btn-icon btn-sm lib-star" data-action="fv-remove" data-name="${f.name}" data-display="${name}" aria-label="Remove ${name} from favorites" data-tip="Remove from favorites">${icon('heartFilled')}</button>
        </div>
      </li>`;
    })}</ul>` : emptyState({ icon: 'heart', compact: true, title: 'No favorite artists yet', body: 'Add one below, or tap ★ Favorite on an artist page. Artists whose songs you like often are added for you.' });
    return html`<section class="section lib-section" aria-labelledby="fv-fav-h">
      ${sectionHeader({
        id: 'fv-fav-h',
        title: `Favorite artists${favs.length ? ` (${fmt.num(favs.length)})` : ''}`,
        desc: 'Artists you follow here. Your plays count every play in your history; liked songs come from Spotify.',
        info: 'Favorites are artists you added yourself or artists whose songs you liked often enough to be added for you. Removing one stops it from being added back automatically.',
        actions: favs.length > 1 ? html`<div data-fav-sort>${segmented({ items: [{ id: 'plays', label: 'Most played' }, { id: 'liked', label: 'Most liked' }, { id: 'name', label: 'A–Z' }], selected: st.sort, label: 'Sort favorites' })}</div>` : '',
      })}
      <form class="lib-add-fav" data-add-fav>
        <label class="sr-only" for="fv-add-input">Add a favorite artist</label>
        <input id="fv-add-input" class="input" type="text" name="artist" maxlength="200" placeholder="Add an artist by name" autocomplete="off">
        <button type="submit" class="btn btn-secondary">${icon('plus')}Add</button>
      </form>
      ${list}
    </section>`;
  }

  function optOutSection(d) {
    const outs = d.opt_outs || [];
    if (!outs.length) return '';
    return html`<section class="section lib-section" aria-labelledby="fv-out-h">
      <details class="lib-details">
        <summary><h2 class="section-title section-title-sm" id="fv-out-h">Removed from favorites <span class="muted">(${fmt.num(outs.length)})</span></h2></summary>
        <p class="section-desc">These won't be added back automatically when you like their songs. Restore any of them.</p>
        <ul class="lib-fav-list lib-optout-list" role="list">${outs.map((o) => html`<li class="lib-fav-row" data-fkey="out:${o.name}">
          ${artistThumb(null, o.display_name || o.name, { size: 36 })}
          <div class="lib-fav-main">${artistLink(o.display_name || o.name, { className: 'lib-fav-name' })}</div>
          <div class="lib-fav-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="fv-restore" data-name="${o.name}" data-display="${o.display_name || o.name}">${icon('undo')}Restore</button></div>
        </li>`)}</ul>
      </details>
    </section>`;
  }

  // ---------------------------------------------------------------- mutations (optimistic on the cached overview)
  function applyLocal(name, display, fav) {
    const d = cache.data;
    if (!d) return;
    const key = name.toLowerCase();
    d.favorites = (d.favorites || []).filter((f) => f.name !== key);
    d.opt_outs = (d.opt_outs || []).filter((o) => o.name !== key);
    if (fav) d.favorites.push({ name: key, display_name: display || name, liked_count: null });
    else d.opt_outs.push({ name: key, display_name: display || name });
    d.favorite_count = d.favorites.length;
  }

  async function setFavorite(name, display, fav, { quiet = false } = {}) {
    const before = JSON.stringify(cache.data);
    applyLocal(name, display, fav);
    render();
    try {
      await api.post('/api/favorites', { action: fav ? 'add' : 'remove', artist: display || name });
      store.refreshSoon(300);
      if (fav && cache.plays && !(display in cache.plays)) {
        playCounts({ artists: [display] }).then((r) => { Object.assign(cache.plays, r.artists); render(); }).catch(() => {});
      }
      if (!quiet) {
        toast(fav ? html`Added <strong>${display}</strong> to your favorites` : html`Removed <strong>${display}</strong> from your favorites`, {
          kind: 'success',
          icon: fav ? 'heartFilled' : 'heart',
          key: `fav:${name.toLowerCase()}`,
          detail: fav ? 'Their new releases show up here.' : "They won't be added back automatically.",
          action: { label: 'Undo', onClick: () => setFavorite(name, display, !fav, { quiet: true }).then(() => toast(fav ? html`<strong>${display}</strong> is no longer a favorite` : html`<strong>${display}</strong> is a favorite again`, { kind: 'info', key: `fav:${name.toLowerCase()}` })) },
        });
      }
      return true;
    } catch (err) {
      cache.data = JSON.parse(before);
      render();
      toast(err.message || "Couldn't update your favorites.", { kind: 'error' });
      return false;
    }
  }

  function wire() {
    off.push(actions(el, {
      'fv-play': (ds) => playAlbum({ id: ds.id, name: ds.name, artist: ds.artist }),
      'fv-remove': (ds) => setFavorite(ds.name, ds.display, false),
      'fv-restore': (ds) => setFavorite(ds.name, ds.display, true),
      'fv-watch': (ds) => openWatchlistDialog({ entity_type: 'artist', entity_name: ds.name }),
      'fv-releases-toggle': () => { st.showAll = !st.showAll; render(); },
      'fv-reload': (ds, btn) => withBusy(btn, () => load()),
    }));
    const onSubmit = async (ev) => {
      const form = ev.target instanceof Element ? ev.target.closest('[data-add-fav]') : null;
      if (!form) return;
      ev.preventDefault();
      const input = form.querySelector('input');
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if ((cache.data?.favorites || []).some((f) => f.name === name.toLowerCase())) {
        toast(html`<strong>${name}</strong> is already a favorite`, { kind: 'info' });
        return;
      }
      const ok = await setFavorite(name, name, true);
      if (ok) {
        const again = el?.querySelector('#fv-add-input');
        if (again) { again.value = ''; again.focus(); }
      }
    };
    el.addEventListener('submit', onSubmit);
    off.push(() => el?.removeEventListener('submit', onSubmit));
  }

  return {
    mount(container) {
      el = container;
      mount(el, html`<div class="lib-body" data-body></div>`);
      wire();
      baseline();
      render();
      // Cold overview calls take seconds; reuse the session copy for 10 minutes.
      if (!cache.data || Date.now() - cache.fetchedAt > 10 * 60e3) load();
      else if (cache.data.release_partial && Date.now() - cache.fetchedAt > 90e3) load();
      else if (!cache.plays) loadPlays();
    },
    update() {},
    onStatus(s, info = {}) {
      // Favorites changed elsewhere (artist page, auto-favorite): refresh the list quietly.
      if (!info.initial && info.changed?.has('favorite_artists') && cache.data && Array.isArray(s?.favorite_artists)) {
        const mine = new Set((cache.data.favorites || []).map((f) => f.name));
        const theirs = new Set(s.favorite_artists);
        const same = mine.size === theirs.size && [...mine].every((n) => theirs.has(n));
        if (!same) load();
      }
    },
    unmount() {
      if (ctrl) ctrl.abort();
      off.forEach((fn) => fn());
      segOffs.forEach((fn) => fn());
      off = [];
      el = null;
    },
  };
}

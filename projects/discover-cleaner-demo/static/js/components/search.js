// Top-bar search: a combobox with a results listbox in two sections, "Your library"
// (GET /api/v2/search/local) and "Spotify" (GET /api/search). Debounced 250 ms; the previous request
// is aborted on every keystroke. Keyboard: ↑/↓ move, Enter opens/plays, Shift+Enter opens a track's
// artist, Esc closes (a second Esc clears), Tab leaves. A missing endpoint (404/501/503) hides its
// section quietly; a Spotify cooldown (429) shows a single "cooling down" row.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import { html, raw, mount, icon, fmt, thumb, artistThumb, debounce, reportError } from '../core/ui.js';
import { playUri } from './player.js';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
// Narrow top bars cut the long placeholder off ("Search artists, song"): use one word there.
const NARROW_QUERY = '(max-width: 560px)';
const SHORT_PLACEHOLDER = 'Search';

let input;
let panel;
let clearBtn;
let hint;
let ctrl = null;
let seq = 0;
let options = [];      // flat list of activatable options, in render order
let activeIdx = -1;
let state = null;      // {q, local:{status, data, error}, spotify:{status, data, error}}

const isOpen = () => !panel.hidden;

function open() {
  if (!panel.hidden) return;
  panel.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function close({ clear = false } = {}) {
  panel.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  activeIdx = -1;
  if (clear) {
    input.value = '';
    syncClear();
    debounced.cancel();   // a search still waiting to run must not reopen the panel
    abort();
    state = null;
    mount(panel, '');
  }
}

function abort() {
  if (ctrl) { ctrl.abort(); ctrl = null; }
}

function syncClear() {
  const has = !!input.value;
  clearBtn.hidden = !has;
  if (hint) hint.hidden = has;
}

// ======================================================================= fetching
async function runSearch(q) {
  if (input.value.trim() !== q) return;   // the box changed (or was cleared) while this waited
  abort();
  const mySeq = ++seq;
  ctrl = new AbortController();
  const signal = ctrl.signal;
  state = { q, local: { status: 'loading' }, spotify: { status: 'loading' } };
  render();
  open();

  const local = api.get('/api/v2/search/local', { params: { q, limit: 6 }, signal, timeoutMs: 8000 })
    .then((data) => { state.local = { status: 'ok', data: data || {} }; })
    .catch((err) => {
      if (isAbort(err)) throw err;
      // Missing / broken local search is not worth a message: hide the section.
      state.local = { status: 'hidden', error: err };
    });
  const spotify = api.get('/api/search', { params: { q, type: 'track,artist' }, signal, timeoutMs: 10000 })
    .then((data) => { state.spotify = { status: 'ok', data: data || {} }; })
    .catch((err) => {
      if (isAbort(err)) throw err;
      if (err.isRateLimited || err.code === 'rate_limited') state.spotify = { status: 'cooling', error: err };
      else if (err.status === 401 || err.code === 'signed_out') state.spotify = { status: 'signed_out', error: err };
      else if (err.isUnavailable) state.spotify = { status: 'hidden', error: err };
      else state.spotify = { status: 'failed', error: err };
    });
  const settle = (p) => p.then(() => { if (mySeq === seq) render(); }, (err) => { if (!isAbort(err)) reportError(err); });
  await Promise.all([settle(local), settle(spotify)]);
}

const debounced = debounce((q) => { runSearch(q).catch((err) => { if (!isAbort(err)) reportError(err); }); }, DEBOUNCE_MS);

// ======================================================================= render
function sameName(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

function buildOptions() {
  const opts = [];
  const loc = state.local.status === 'ok' ? state.local.data : null;
  const spo = state.spotify.status === 'ok' ? state.spotify.data : null;
  // Short sections so the Spotify results stay in view without scrolling the panel.
  const localArtists = (loc?.artists || []).slice(0, 3);
  const localTracks = (loc?.tracks || []).slice(0, 3);
  const localAlbums = (loc?.albums || []).slice(0, 2);
  // Local rows have no art; borrow the Spotify artist's picture when the names match.
  const spImage = (name) => (spo?.artists || []).find((s) => sameName(s.name, name))?.image || null;
  localArtists.forEach((a) => opts.push({ section: 'local', kind: 'artist', name: a.name, plays: a.plays, image: spImage(a.name) }));
  localTracks.forEach((t) => opts.push({ section: 'local', kind: 'track', name: t.name, artist: t.artist, plays: t.plays, uri: t.spotify_track_id ? `spotify:track:${t.spotify_track_id}` : null }));
  localAlbums.forEach((al) => opts.push({ section: 'local', kind: 'album', name: al.name, artist: al.artist, plays: al.plays }));
  const spArtists = (spo?.artists || []).filter((a) => !localArtists.some((l) => sameName(l.name, a.name))).slice(0, 2);
  const spTracks = (spo?.tracks || []).slice(0, 4);
  spArtists.forEach((a) => opts.push({ section: 'spotify', kind: 'artist', name: a.name, image: a.image, genres: a.genres }));
  spTracks.forEach((t) => {
    const artistName = t.artist_list?.[0]?.name || String(t.artists || '').split(', ')[0];
    opts.push({ section: 'spotify', kind: 'track', name: t.name, artist: artistName, artists: t.artists, album: t.album, image: t.image, uri: t.uri || (t.id ? `spotify:track:${t.id}` : null), duration: t.duration_ms });
  });
  opts.push({ section: 'all', kind: 'all', name: state.q });
  opts.forEach((o, i) => { o.id = `so-${i}`; });
  return opts;
}

function optionMarkup(o) {
  const selected = options.indexOf(o) === activeIdx;
  const common = raw(`id="${o.id}" role="option" aria-selected="${selected ? 'true' : 'false'}" data-idx="${options.indexOf(o)}"`);
  if (o.kind === 'all') {
    return html`<div class="search-option search-see-all" ${common}><span class="thumb-slot">${icon('search')}</span><span class="truncate">See all results for “${o.name}”</span></div>`;
  }
  if (o.kind === 'artist') {
    const sub = o.section === 'local' ? (o.plays != null ? `Artist · ${fmt.plural(o.plays, 'play')}` : 'Artist') : `Artist${o.genres?.length ? ` · ${o.genres.slice(0, 2).join(', ')}` : ''}`;
    return html`<div class="search-option" ${common}>
      ${artistThumb(o.image, o.name)}
      <div class="row-main"><div class="opt-title truncate">${o.name}</div><div class="opt-sub truncate">${sub}</div></div>
      <span class="opt-side">${icon('chevronRight', { size: 'sm' })}</span></div>`;
  }
  if (o.kind === 'album') {
    return html`<div class="search-option" ${common}>
      ${thumb(null, { iconName: 'disc' })}
      <div class="row-main"><div class="opt-title truncate">${o.name}</div><div class="opt-sub truncate">Album · ${o.artist || ''}${o.plays != null ? ` · ${fmt.plural(o.plays, 'play')}` : ''}</div></div>
      <span class="opt-side">${icon('chevronRight', { size: 'sm' })}</span></div>`;
  }
  const sub = o.section === 'local'
    ? `${o.artist || ''}${o.plays != null ? ` · ${fmt.plural(o.plays, 'play')}` : ''}`
    : `${o.artists || o.artist || ''}${o.album ? ` · ${o.album}` : ''}`;
  return html`<div class="search-option" ${common}>
    ${thumb(o.image, { iconName: 'music' })}
    <div class="row-main"><div class="opt-title truncate">${o.name}</div><div class="opt-sub truncate">${sub}</div></div>
    <span class="opt-side">
      ${o.duration ? html`<span class="tabular-nums">${fmt.clock(o.duration)}</span>` : ''}
      ${o.artist ? html`<button type="button" class="btn btn-icon btn-sm" tabindex="-1" data-secondary="artist" aria-label="${`Open ${o.artist}`}" data-tip="${`Open ${o.artist}`}">${icon('artists')}</button>` : ''}
      ${o.uri ? html`<span class="btn btn-icon btn-sm" aria-hidden="true">${icon('play')}</span>` : ''}
    </span></div>`;
}

function sectionMarkup(title, key, opts, note) {
  if (!opts.length && !note) return '';
  const labelId = `search-sec-${key}`;
  return html`<div class="search-section" role="group" aria-labelledby="${labelId}">
    <div class="search-section-title" id="${labelId}" role="presentation"><span>${title}</span></div>
    ${opts.map(optionMarkup)}
    ${note || ''}
  </div>`;
}

function noteMarkup(iconName, text) {
  return html`<div class="search-note" role="option" aria-disabled="true" aria-selected="false">${icon(iconName)}<span>${text}</span></div>`;
}

function render() {
  if (!state) return;
  const prevActiveKey = options[activeIdx] ? `${options[activeIdx].section}|${options[activeIdx].kind}|${options[activeIdx].name}` : null;
  options = buildOptions();
  if (prevActiveKey) activeIdx = options.findIndex((o) => `${o.section}|${o.kind}|${o.name}` === prevActiveKey);
  const loading = (s) => s.status === 'loading';
  const localOpts = options.filter((o) => o.section === 'local');
  const spOpts = options.filter((o) => o.section === 'spotify');
  const allOpt = options.filter((o) => o.section === 'all');

  let localNote = '';
  if (loading(state.local)) localNote = html`<div class="search-note" role="presentation"><span class="spinner spinner-sm" aria-hidden="true"></span><span>Searching your library…</span></div>`;
  else if (state.local.status === 'ok' && !localOpts.length) localNote = html`<div class="search-note muted" role="presentation"><span>No matches in your listening history.</span></div>`;

  let spNote = '';
  const sp = state.spotify;
  if (loading(sp)) spNote = html`<div class="search-note" role="presentation"><span class="spinner spinner-sm" aria-hidden="true"></span><span>Searching Spotify…</span></div>`;
  else if (sp.status === 'cooling') {
    const ra = sp.error?.retryAfter;
    spNote = noteMarkup('hourglass', `Spotify search is cooling down${ra ? ` · try again in ${fmt.duration(ra, { unit: 's' })}` : ''}. Your library still works.`);
  } else if (sp.status === 'signed_out') spNote = noteMarkup('link', 'Connect Spotify to search the catalog.');
  else if (sp.status === 'failed') spNote = noteMarkup('alertCircle', "Spotify search didn't work this time. Your library still works.");
  else if (sp.status === 'ok' && !spOpts.length) spNote = html`<div class="search-note muted" role="presentation"><span>No Spotify results.</span></div>`;

  const showLocal = state.local.status !== 'hidden';
  const showSp = sp.status !== 'hidden';
  mount(panel, html`
    ${showLocal ? sectionMarkup('Your library', 'local', localOpts, localNote) : ''}
    ${showSp ? sectionMarkup('Spotify', 'spotify', spOpts, spNote) : ''}
    <div class="search-section" role="group" aria-label="More">${allOpt.map(optionMarkup)}</div>
    <div class="search-foot" aria-hidden="true"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open or play</span><span><kbd>⇧</kbd><kbd>↵</kbd> track's artist</span><span><kbd>esc</kbd> close</span></div>`);
  syncActive();
}

function syncActive() {
  panel.querySelectorAll('[role="option"][data-idx]').forEach((n) => {
    n.setAttribute('aria-selected', Number(n.dataset.idx) === activeIdx ? 'true' : 'false');
  });
  const o = options[activeIdx];
  if (o) {
    input.setAttribute('aria-activedescendant', o.id);
    panel.querySelector(`#${o.id}`)?.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

// ======================================================================= activation
function activate(o, { secondary = false } = {}) {
  if (!o) return;
  if (o.kind === 'all') {
    close();
    input.blur();
    router.navigate(router.href('search', {}, { q: o.name }));
    return;
  }
  const goArtist = (name) => { close({ clear: true }); input.blur(); router.navigate(router.href('artist', { name })); };
  if (o.kind === 'artist') return goArtist(o.name);
  if (o.kind === 'album') return goArtist(o.artist || o.name);
  if (secondary || !o.uri) return goArtist(o.artist || o.name);
  close({ clear: true });
  playUri(o.uri, o.name);
}

function move(delta) {
  if (!options.length) return;
  if (activeIdx < 0) activeIdx = delta > 0 ? 0 : options.length - 1;
  else activeIdx = (activeIdx + delta + options.length) % options.length;
  syncActive();
}

// ======================================================================= init
export function initSearch(root) {
  input = root.querySelector('.search-input');
  panel = root.querySelector('.search-panel');
  clearBtn = root.querySelector('.search-clear');
  hint = root.querySelector('.search-hint');
  if (!input || !panel) return;

  input.addEventListener('input', () => {
    syncClear();
    const q = input.value.trim();
    if (q.length < MIN_CHARS) {
      debounced.cancel();
      abort();
      state = null;
      close();
      return;
    }
    debounced(q);
  });
  input.addEventListener('focus', () => {
    if (state && input.value.trim().length >= MIN_CHARS) open();
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (!isOpen() && state) open();
      move(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      move(-1);
    } else if (ev.key === 'Enter') {
      const q = input.value.trim();
      if (!q) return;
      ev.preventDefault();
      if (isOpen() && options[activeIdx]) activate(options[activeIdx], { secondary: ev.shiftKey });
      else activate({ kind: 'all', name: q });
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      if (isOpen()) close();
      else if (input.value) close({ clear: true });
      else input.blur();
    } else if (ev.key === 'Tab') {
      close();
    }
  });
  // Keep focus in the input while clicking an option (so activation isn't pre-empted by blur).
  panel.addEventListener('pointerdown', (ev) => { ev.preventDefault(); });
  panel.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    const optEl = t?.closest('[role="option"][data-idx]');
    if (!optEl) return;
    const o = options[Number(optEl.dataset.idx)];
    activate(o, { secondary: !!t.closest('[data-secondary]') });
  });
  panel.addEventListener('pointermove', (ev) => {
    const optEl = ev.target instanceof Element ? ev.target.closest('[role="option"][data-idx]') : null;
    if (!optEl) return;
    const i = Number(optEl.dataset.idx);
    if (i !== activeIdx) { activeIdx = i; syncActive(); }
  });
  clearBtn?.addEventListener('click', () => { close({ clear: true }); input.focus(); });
  // The box belongs to the page you searched from: leaving it clears the query, and the
  // search page keeps the box in sync with its ?q= (back/forward included).
  const syncToRoute = (route) => {
    if (route?.id === 'search') {
      const q = String(route.query?.q || '');
      if (document.activeElement !== input && input.value !== q) {
        input.value = q;
        state = null;
        close();
        syncClear();
      }
    } else if (document.activeElement !== input && input.value) {
      close({ clear: true });
    }
  };
  router.onChange((route) => syncToRoute(route));
  syncToRoute(router.current());
  const longPlaceholder = input.getAttribute('placeholder') || '';
  const mq = window.matchMedia ? window.matchMedia(NARROW_QUERY) : null;
  const fitPlaceholder = () => { input.setAttribute('placeholder', mq?.matches ? SHORT_PLACEHOLDER : longPlaceholder); };
  fitPlaceholder();
  mq?.addEventListener?.('change', fitPlaceholder);
  document.addEventListener('pointerdown', (ev) => {
    if (isOpen() && !root.contains(ev.target)) close();
  });
  input.addEventListener('blur', () => {
    // Leave it open while focus moves into the panel (it never takes focus) — close otherwise.
    setTimeout(() => { if (document.activeElement !== input) close(); }, 120);
  });
  syncClear();
}

export function focusSearch() {
  if (!input) return;
  input.focus();
  input.select();
}

export default { initSearch, focusSearch };

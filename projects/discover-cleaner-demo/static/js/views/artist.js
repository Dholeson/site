// Artist page (#/artist/<name>): your personal history with an artist (instant, from the local
// plays ledger), then Spotify + Last.fm enrichment filling in progressively (artist-info can take
// several seconds and can be rate limited), and the discography with heard progress.
//
// Data: GET /api/v2/artist/<name>/stats (local) · GET /api/artist-info?artist_name=&source=page
// (photo, listeners, tags, popular tracks with my_plays, similar artists, bio) ·
// GET /api/artist/discography?artist_name= (+ /release?album_id=&artist_name=).
// Each section renders into its own slot, so a slow or failing source never blocks the others.
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import router from '../core/router.js';
import {
  html, raw, mount, fmt, icon, toast, toastError, confirmDialog, menu, emptyState, errorState,
  loadingState, statTile, infoTip, sectionHeader, trackRow, artistHref, actions, segmented,
  bindChoiceGroup, withBusy, setRefetching, safeUrl, toDate, initialsAvatar as avatarPh, notice,
} from '../core/ui.js';
import { playTrack } from '../components/player.js';
import { rankList } from '../components/rank-list.js';
import { openWatchlistDialog } from '../components/watchlist-dialog.js';

const SHOW_TRACKS = 10;
const SHOW_RELEASES = 12;
const SHOW_SIMILAR = 6;
const DAY = 86400e3;

// Definitions for the ⓘ tips (plain words: what is counted, over which window).
const DEF = {
  plays: 'Every time a song by this artist was played, all time: Last.fm scrobbles plus plays heard in this app. The same play is never counted twice.',
  rank: 'Where this artist sits among everyone in your history, by plays. Artists hidden from stats (podcasts, noise) take no place.',
  share: 'This artist’s plays as a share of all your music plays (hidden artists left out).',
  sources: 'Where the plays come from: Last.fm scrobbles, or plays this app heard itself that Last.fm doesn’t have.',
  first: 'Your earliest play of this artist in your history.',
  last: 'Your most recent play of this artist.',
  days: 'Days with at least one play. Plays imported in bulk with unreliable times are left out.',
  streak: 'The most days in a row with at least one play of this artist.',
  peak: 'The calendar month with the most plays of this artist.',
  songs: 'Different songs you’ve played. Versions of one song (live, remastered, instrumental…) count once; recordings counts each version separately.',
  topTracks: 'Plays per song, all time. Versions of the same song are merged and counted together.',
  topAlbums: 'Plays filed under each album name, all time. Deluxe and remastered editions count as the same album.',
  listeners: 'People who have scrobbled this artist on Last.fm, all time.',
  unheard: 'Their most popular tracks (Spotify’s top tracks, or Last.fm’s when Spotify is unavailable) that you have never played.',
  coverage: 'Tracks on their albums and EPs that you have played at least once. Singles, live records, compilations and duplicate editions are left out.',
  similar: 'Artists Last.fm listeners also play, most similar first. Your play counts come from your own history.',
  match: 'How similar Last.fm finds this artist (100% = the closest match).',
};

let S = null;          // state of the artist on screen
let offActions = null;
let rootEl = null;
let viewCtx = null;

// ======================================================================= helpers
const fold = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '');
const monthYear = (ts) => { const d = toDate(ts); return d ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'; };
const longDate = (ts) => fmt.date(ts, { year: 'always' });
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function dayRange(start, end) {
  const a = toDate(start); const b = toDate(end);
  if (!a || !b) return '';
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} – ${b.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// Last.fm bios end with a licence line and sometimes carry a "Read more" anchor: text only.
function cleanBio(text) {
  return String(text || '')
    .replace(/<a\b[^>]*>.*?<\/a>/gis, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*User-contributed text is available under the Creative Commons By-SA License;?\s*additional terms may apply\.?/i, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const httpUrl = (u) => { const s = safeUrl(u, ''); return /^https?:\/\//i.test(s) ? s : ''; };

const starIcon = (filled) => icon(filled ? 'starFilled' : 'star');

const initialsAvatar = (name, cls = '') => avatarPh(name, { className: `ar-initials ${cls}`.trim() });

function displayName() {
  return (S?.stats?.found && S.stats.name) || S?.info?.name || S?.name || '';
}

function isFavorite() {
  if (S?.favOverride != null) return S.favOverride;
  const list = store.status?.favorite_artists;
  const n = displayName().trim().toLowerCase();
  return Array.isArray(list) ? list.includes(n) || list.includes(S.name.trim().toLowerCase()) : !!S?.info?.artist_liked;
}

function slot(name) { return rootEl?.querySelector(`[data-slot="${name}"]`) || null; }

function later(fn, ms) {
  if (!S) return;
  const st = S;
  const t = setTimeout(() => { st.timers.delete(t); if (S === st) fn(); }, ms);
  st.timers.add(t);
}

function destroyCharts(st = S) {
  if (!st) return;
  st.charts.forEach((f) => { try { f.chart?.destroy(); } catch { /* ignore */ } });
  st.charts = [];
}

// ======================================================================= shell
function newState(name) {
  return {
    name, ctrl: new AbortController(), timers: new Set(), charts: [],
    stats: null, statsErr: null,
    info: null, infoErr: null, infoLoading: true,
    disco: null, discoErr: null, discoLoading: true, discoRetries: 0,
    filter: 'all', unheardOnly: false, showAllReleases: false, releases: new Map(),
    showAllTracks: false, showAllAlbums: false, showAllSimilar: false, bioOpen: false,
    favOverride: null, watchlisted: null,
  };
}

function renderShell() {
  const name = S.name;
  mount(rootEl, html`
    <div class="ar" data-state="loading">
      <section class="ar-hero" data-slot="hero" aria-label="Artist">
        <div class="ar-hero-backdrop" data-part="backdrop" aria-hidden="true"></div>
        <div class="ar-hero-inner">
          <div class="ar-hero-art" data-part="art">${initialsAvatar(name)}</div>
          <div class="ar-hero-body">
            <div class="page-eyebrow ar-eyebrow" data-part="eyebrow">Artist</div>
            <h1 class="page-title ar-name" tabindex="-1" data-part="name">${name}</h1>
            <div class="ar-hero-meta" data-part="meta"><span class="ar-meta-loading">Loading artist details…</span></div>
            <div class="ar-tags" data-part="tags"></div>
            <div class="ar-hero-actions">
              <button type="button" class="btn btn-primary" data-action="ar-play-top" data-part="play">${icon('play')}<span>Play</span></button>
              <button type="button" class="btn btn-secondary ar-fav" data-action="ar-fav" aria-pressed="false" data-part="fav">${starIcon(false)}<span>Favorite</span></button>
              <button type="button" class="btn btn-secondary" data-action="ar-watch" data-part="watch">${icon('bookmark')}<span>Save to watchlist</span></button>
              <button type="button" class="btn btn-icon" data-action="ar-more" aria-haspopup="menu" aria-label="More actions for ${name}" data-tip="More">${icon('more')}</button>
            </div>
            <div class="ar-nowplaying" data-part="nowplaying" hidden></div>
          </div>
        </div>
      </section>
      <div data-slot="notice"></div>
      <nav class="ar-jump" data-slot="jump" aria-label="On this page"></nav>
      <div class="ar-body">
        <div data-slot="history">${historySkeleton()}</div>
        <div data-slot="charts"></div>
        <div data-slot="tops"></div>
        <div data-slot="unheard"></div>
        <div data-slot="disco"></div>
        <div data-slot="similar"></div>
        <div data-slot="about"></div>
      </div>
    </div>`);
}

function historySkeleton() {
  return html`<section class="section" aria-busy="true">
    ${sectionHeader({ title: 'Your history', id: 'ar-sec-history' })}
    <div class="card">${loadingState('Counting your plays…', { compact: true })}</div>
  </section>`;
}

// ======================================================================= loading
function load() {
  loadStats();
  loadInfo();
  loadDisco();
  loadWatchlistState();
}

async function loadStats({ refetch = false } = {}) {
  const st = S;
  const el = slot('history');
  if (refetch) { setRefetching(el, true); setRefetching(slot('charts'), true); setRefetching(slot('tops'), true); }
  try {
    const data = await api.get(`/api/v2/artist/${encodeURIComponent(st.name)}/stats`, { signal: st.ctrl.signal, timeoutMs: 20000 });
    if (S !== st) return;
    st.stats = data;
    st.statsErr = null;
  } catch (err) {
    if (isAbort(err) || S !== st) return;
    st.statsErr = err;
    if (err.code === 'history_not_ready' || err.status === 503) later(() => loadStats(), 5000);
  } finally {
    if (S === st) { setRefetching(el, false); setRefetching(slot('charts'), false); setRefetching(slot('tops'), false); }
  }
  if (S !== st) return;
  renderAll({ stats: true, info: false });
}

async function loadInfo() {
  const st = S;
  st.infoLoading = true;
  try {
    const data = await api.get('/api/artist-info', {
      params: { artist_name: st.name, source: 'page' }, signal: st.ctrl.signal, timeoutMs: 45000,
    });
    if (S !== st) return;
    st.info = data || {};
    st.infoErr = null;
  } catch (err) {
    if (isAbort(err) || S !== st) return;
    st.infoErr = err;
  }
  st.infoLoading = false;
  renderAll({ stats: false, info: true });
  // The discography could not find the artist by name, but artist-info resolved an id.
  if (st.discoErr && st.info?.artist_id && st.discoErr.code === 'artist_not_found') loadDisco();
}

async function loadDisco() {
  const st = S;
  st.discoLoading = true;
  if (st.disco) setRefetching(slot('disco'), true); else renderDisco();
  const params = { artist_name: st.name };
  if (st.info?.artist_id) params.artist_id = st.info.artist_id;
  try {
    const data = await api.get('/api/artist/discography', { params, signal: st.ctrl.signal, timeoutMs: 45000 });
    if (S !== st) return;
    st.disco = data;
    st.discoErr = null;
  } catch (err) {
    if (isAbort(err) || S !== st) return;
    st.discoErr = err;
    // Cooling down: try once more by itself when the wait is short.
    if (err.isRateLimited && st.discoRetries < 2 && (err.retryAfter ?? 30) <= 120) {
      st.discoRetries += 1;
      later(() => loadDisco(), ((err.retryAfter ?? 30) + 1) * 1000);
    }
  }
  st.discoLoading = false;
  setRefetching(slot('disco'), false);
  renderDisco();
  renderTops();   // top albums link to their release once the discography is known
  renderJump();
}

async function loadWatchlistState() {
  const st = S;
  try {
    const data = await api.get('/api/research', { params: { status: 'active', entity_type: 'artist' }, signal: st.ctrl.signal });
    if (S !== st) return;
    const n = st.name.trim().toLowerCase();
    st.watchlisted = (data?.items || []).some((it) => String(it.entity_name || '').trim().toLowerCase() === n);
  } catch { /* the button still works */ }
  if (S === st) renderHeroActions();
}

// ======================================================================= render: everything
// Only the sections that depend on what changed are rebuilt, so a slow artist-info arriving
// seconds later never resets the charts or steals focus from a list the user is in.
function renderAll({ stats = true, info = true } = {}) {
  if (!S) return;
  const st = S.stats;
  const ar = rootEl.querySelector('.ar');
  if (ar) {
    ar.dataset.state = st ? (st.found ? 'known' : 'new') : S.statsErr ? 'error' : 'loading';
    ar.classList.toggle('is-new', !!(st && !st.found));
  }
  renderHero();
  renderNotice();
  if (stats || (st && !st.found)) renderHistory(); else renderFacts();
  if (stats) { renderCharts(); renderTops(); renderDisco(); }
  renderUnheard();
  if (info) { renderSimilar(); renderAbout(); }
  renderJump();
}

// ======================================================================= hero
function renderHero() {
  const hero = slot('hero');
  if (!hero) return;
  const info = S.info || {};
  const name = displayName();
  viewCtx?.setTitle?.(name);

  const h1 = hero.querySelector('[data-part="name"]');
  if (h1 && h1.textContent !== name) h1.textContent = name;

  const img = httpUrl(info.artist_image);
  const kind = info.artist_image_kind || 'album';
  const art = hero.querySelector('[data-part="art"]');
  if (art && art.dataset.src !== img) {
    art.dataset.src = img;
    art.classList.toggle('is-cover', !!img && kind !== 'artist');
    mount(art, img ? html`<img src="${img}" alt="" decoding="async">` : initialsAvatar(name));
    const imgEl = art.querySelector('img');
    if (imgEl) imgEl.addEventListener('error', () => { art.dataset.src = ''; mount(art, initialsAvatar(name)); }, { once: true });
    const bd = hero.querySelector('[data-part="backdrop"]');
    if (bd) mount(bd, img ? html`<img src="${img}" alt="" decoding="async">` : '');
  }

  const eyebrow = hero.querySelector('[data-part="eyebrow"]');
  if (eyebrow) mount(eyebrow, S.stats?.hidden ? html`Artist <span class="ar-dot">·</span> <span class="ar-hidden-tag">${icon('eye')}Hidden from stats</span>` : 'Artist');

  const meta = hero.querySelector('[data-part="meta"]');
  if (meta) {
    const bits = [];
    const listeners = info.stats?.listeners;
    if (Number(listeners) > 0) bits.push(html`<span class="ar-meta-item">${icon('user')}<span><strong>${fmt.compact(listeners)}</strong> listeners on Last.fm</span>${infoTip(DEF.listeners, { label: 'Last.fm listeners' })}</span>`);
    const st = S.stats;
    if (st?.found && st.rank) bits.push(html`<span class="ar-meta-item">${icon('insights')}<span><strong>#${fmt.num(st.rank)}</strong> in your library</span></span>`);
    else if (st && !st.found) bits.push(html`<span class="ar-meta-item">${icon('sparkle')}<span>New to you</span></span>`);
    if (!bits.length && S.infoLoading) bits.push(html`<span class="ar-meta-loading">Loading artist details…</span>`);
    mount(meta, bits);
  }

  const tagsEl = hero.querySelector('[data-part="tags"]');
  if (tagsEl) {
    const tags = [...new Set([...(info.lastfm_tags || []), ...(info.spotify_genres || [])].map((t) => String(t).trim()).filter(Boolean).map((t) => t.toLowerCase()))].slice(0, 6);
    mount(tagsEl, tags.length ? html`<ul class="ar-tag-list" aria-label="Genres and tags">${tags.map((t) => html`<li class="chip">${t}</li>`)}</ul>` : '');
  }
  renderHeroActions();
  renderNowPlaying(store.status);
}

function renderHeroActions() {
  const hero = slot('hero');
  if (!hero || !S) return;
  const name = displayName();
  const fav = isFavorite();
  const favBtn = hero.querySelector('[data-part="fav"]');
  if (favBtn) {
    favBtn.setAttribute('aria-pressed', fav ? 'true' : 'false');
    const label = fav ? 'Favorite' : 'Favorite';
    mount(favBtn, html`${starIcon(fav)}<span>${label}</span>`);
    favBtn.dataset.tip = fav ? `Remove ${name} from your favorite artists` : `Add ${name} to your favorite artists (their new releases show up in your release radar)`;
  }
  const w = hero.querySelector('[data-part="watch"]');
  if (w) {
    w.setAttribute('aria-pressed', S.watchlisted ? 'true' : 'false');
    mount(w, html`${icon(S.watchlisted ? 'check' : 'bookmark')}<span>${S.watchlisted ? 'On your watchlist' : 'Save to watchlist'}</span>`);
  }
  const play = hero.querySelector('[data-part="play"]');
  if (play) {
    const pick = playPick();
    play.disabled = !pick;
    // Nothing to play once everything has loaded: drop the button instead of showing it dead.
    play.hidden = !pick && !S.infoLoading && !!S.stats;
    play.dataset.tip = pick ? (pick.mine ? `Play ${pick.name}, your most played song by them` : `Play ${pick.name}, their most popular track`) : 'Nothing to play yet';
  }
}

function playPick() {
  const st = S?.stats;
  if (st?.found && st.top_tracks?.length) {
    const t = st.top_tracks[0];
    return { name: t.name, id: t.spotify_track_id, mine: true };
  }
  const t = (S?.info?.top_tracks || [])[0];
  if (t) return { name: t.name, uri: t.uri, id: t.id, mine: false };
  return null;
}

function renderNowPlaying(status) {
  const hero = slot('hero');
  if (!hero || !S) return;
  const el = hero.querySelector('[data-part="nowplaying"]');
  const t = status?.current_track;
  const key = displayName().trim().toLowerCase();
  const alt = S.name.trim().toLowerCase();
  const byThem = !!t && (t.artist_list || []).some((a) => { const n = String(a?.name || '').trim().toLowerCase(); return n === key || n === alt; });
  const playingId = byThem ? t.id : null;
  if (el) {
    if (byThem) {
      el.hidden = false;
      const txt = `${status.is_playing ? 'Playing now' : 'Paused'}: ${t.name}`;
      if (el.dataset.txt !== txt) {
        el.dataset.txt = txt;
        mount(el, html`<span class="ar-eq${status.is_playing ? ' is-on' : ''}" aria-hidden="true"><i></i><i></i><i></i></span><span class="truncate">${status.is_playing ? 'Playing now' : 'Paused'}: <strong>${t.name}</strong></span>`);
      }
    } else if (!el.hidden) {
      el.hidden = true;
      el.dataset.txt = '';
    }
  }
  // Mark the playing song in "Your top tracks".
  const cur = byThem ? fold(t.name) : '';
  rootEl?.querySelectorAll('.ar-tracks .bl-item').forEach((row) => {
    const on = !!cur && (row.dataset.id === playingId || row.dataset.fold === cur);
    row.classList.toggle('is-playing', on);
  });
}

function renderNotice() {
  const el = slot('notice');
  if (!el) return;
  const parts = [];
  const st = S.stats;
  if (st?.hidden) {
    parts.push(notice({
      tone: 'info', icon: 'eye', className: 'ar-banner',
      body: html`<strong>${displayName()} is hidden from your stats.</strong> Their plays stay in your history, but they're left out of rankings, top lists and reports.`,
      actions: html`<button type="button" class="btn btn-secondary btn-sm" data-action="ar-unhide">Show in stats again</button>`,
    }));
  }
  // The static web demo says what an artist page leaves out there (see static/js/demo/).
  const demoNote = st?.demo_note || S.info?.demo_note;
  if (demoNote) parts.push(notice({ tone: 'quiet', icon: 'info', className: 'ar-banner', body: demoNote }));
  if (S.infoErr) {
    const e = S.infoErr;
    const msg = e.status === 401
      ? 'Spotify isn’t connected, so their photo, popular tracks, similar artists and bio can’t load. Your own history below still works.'
      : e.isRateLimited
        ? `Spotify is cooling down${e.retryAfter ? ` (about ${fmt.duration(e.retryAfter, { unit: 's' })})` : ''}. Your own history below still works.`
        : 'Their photo, popular tracks, similar artists and bio didn’t load. Your own history below still works.';
    parts.push(notice({
      tone: 'warning', icon: e.isRateLimited ? 'hourglass' : 'alertCircle', className: 'ar-banner', role: 'status',
      body: msg,
      actions: e.status === 401 ? html`<a class="btn btn-secondary btn-sm" href="/login">Connect Spotify</a>` : html`<button type="button" class="btn btn-secondary btn-sm" data-action="ar-retry-info">${icon('refresh')}Try again</button>`,
    }));
  } else if (S.info?.lastfm_unavailable) {
    parts.push(notice({
      tone: 'quiet', icon: 'wifiOff', className: 'ar-banner',
      body: 'Last.fm isn’t answering right now, so their bio, tags and similar artists are missing. Your own history still works.',
      actions: html`<button type="button" class="btn btn-secondary btn-sm" data-action="ar-retry-info">${icon('refresh')}Try again</button>`,
    }));
  } else if (S.info?.spotify_limited) {
    parts.push(notice({
      tone: 'quiet', icon: 'hourglass', className: 'ar-banner',
      body: 'Spotify search is cooling down, so some images are missing. Play buttons still work: tracks are looked up when you press play.',
    }));
  }
  mount(el, parts);
}

// ======================================================================= in-page navigation
function renderJump() {
  const el = slot('jump');
  if (!el || !S) return;
  const st = S.stats;
  const items = [];
  if (st?.found) items.push(['ar-sec-history', 'Your history'], ['ar-sec-tops', 'Top tracks & albums']);
  const tt = S.info?.top_tracks || [];
  if (tt.length) items.push(['ar-sec-unheard', st && !st.found ? 'Popular tracks' : 'Not heard yet']);
  items.push(['ar-sec-disco', 'Discography']);
  if ((S.info?.related || []).length) items.push(['ar-sec-similar', 'Similar artists']);
  if (S.info?.bio || S.info?.bio_full) items.push(['ar-sec-about', 'About']);
  const sig = items.map((i) => i[0]).join('|');
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  mount(el, items.length > 2 ? html`<ul class="ar-jump-list">${items.map(([id, label]) => html`<li><button type="button" class="chip chip-lg ar-jump-chip" data-action="ar-jump" data-target="${id}">${label}</button></li>`)}</ul>` : '');
}

// ======================================================================= your history
function factsHtml() {
  const st = S.stats;
  if (!st?.found) return '';
  const liked = Number(S.info?.listen_stats?.spotify_liked_count || 0);
  const cleared = Number(st.backlog?.cleared_count || 0);
  const facts = [];
  if (liked > 0) facts.push(html`<li>${icon('heartFilled')}<span><strong>${fmt.num(liked)}</strong> of their songs ${liked === 1 ? 'is' : 'are'} in your Liked Songs</span></li>`);
  if (cleared > 0) facts.push(html`<li>${icon('clear')}<span><strong>${fmt.num(cleared)}</strong> of their tracks ${cleared === 1 ? 'was' : 'were'} cleared from your backlog</span></li>`);
  return facts.length ? html`<ul class="ar-facts" aria-label="More about you and ${displayName()}">${facts}</ul>` : '';
}

function renderFacts() {
  const el = slot('history')?.querySelector('[data-part="facts"]');
  if (el) mount(el, factsHtml());
}

function renderHistory() {
  const el = slot('history');
  if (!el) return;
  const st = S.stats;
  if (!st) {
    if (S.statsErr) {
      const notReady = S.statsErr.code === 'history_not_ready';
      mount(el, html`<section class="section">${sectionHeader({ title: 'Your history', id: 'ar-sec-history' })}
        <div class="card">${notReady
          ? loadingState('Your listening history is still being prepared. This page fills in by itself in a moment.', { compact: true })
          : errorState(S.statsErr, { title: 'Your plays didn’t load', body: `${S.statsErr.message} Their Spotify and Last.fm details below still work.`, retry: () => loadStats(), compact: true })}</div></section>`);
    } else {
      mount(el, historySkeleton());
    }
    return;
  }
  const name = displayName();
  if (!st.found) {
    const pick = playPick();
    const unknownEverywhere = !S.infoLoading && !pick && !(S.info?.bio || S.info?.bio_full || (S.info?.related || []).length);
    const body = pick
      ? 'Nothing by them is in your listening history. Start with their most popular tracks below: anything you play shows up on this page.'
      : unknownEverywhere && S.info?.demo
        ? 'Nothing by them is in this listening history. Check the spelling, or search for them.'
      : unknownEverywhere
        ? 'Nothing by them is in your listening history, and Spotify and Last.fm had nothing under this exact name either. Check the spelling, or search for them.'
        : 'Nothing by them is in your listening history yet. Anything you play shows up on this page.';
    mount(el, html`<section class="section ar-new" aria-labelledby="ar-sec-history">
      <div class="card ar-new-card">
        <div class="ar-new-icon">${icon(unknownEverywhere ? 'search' : 'sparkle')}</div>
        <div class="ar-new-text">
          <h2 class="section-title" id="ar-sec-history" tabindex="-1">You haven't played ${name} yet</h2>
          <p class="section-desc">${body}</p>
        </div>
        ${pick ? html`<button type="button" class="btn btn-primary" data-action="ar-play-top">${icon('play')}Play their top track</button>`
          : unknownEverywhere ? html`<a class="btn btn-secondary" href="${router.href('search', {}, { q: name })}">${icon('search')}Search for “${name}”</a>` : ''}
      </div>
    </section>`);
    return;
  }

  const now = Date.now();
  const firstHint = st.first_is_history_start
    ? 'Before your history began'
    : `${ago(st.first_ts, now)}`;
  const spanDays = st.first_ts ? Math.max(1, Math.floor((now - st.first_ts) / DAY) + 1) : 0;
  const daysPct = spanDays ? Math.round((st.days_listened / spanDays) * 100) : null;
  const streak = st.longest_streak;
  const peak = st.peak_month;
  const split = st.split || {};

  const tiles = [
    statTile({
      label: 'First heard', value: st.first_is_history_start ? `${monthYear(st.first_ts)}` : monthYear(st.first_ts),
      hint: st.first_is_history_start ? 'Before your history began' : `${longDate(st.first_ts)} · ${firstHint}`,
      info: st.first_is_history_start ? `${DEF.first} It is within a month of the start of your history, so you probably knew them before that.` : DEF.first,
    }),
    statTile({ label: 'Last heard', value: ago(st.last_ts, now), hint: longDate(st.last_ts), info: DEF.last }),
    statTile({ label: 'Days listened', value: fmt.num(st.days_listened), hint: daysPct == null ? '' : daysPct < 1 ? `Under 1% of days since ${monthYear(st.first_ts)}` : `${daysPct}% of days since ${monthYear(st.first_ts)}`, info: DEF.days }),
    statTile({ label: 'Longest streak', value: streak ? fmt.plural(streak.days, 'day') : '—', hint: streak ? (streak.days > 1 ? dayRange(streak.start, streak.end) : fmt.date(streak.start, { year: 'always' })) : 'No days in a row yet', info: DEF.streak }),
    statTile({ label: 'Peak month', value: peak ? fmt.month(peak.ym, { short: true }) : '—', hint: peak ? fmt.plural(peak.plays, 'play') : '', info: DEF.peak }),
    statTile({ label: 'Songs heard', value: fmt.num(st.songs), hint: `${fmt.plural(st.recordings, 'recording')} · ${fmt.plural(st.albums, 'album')}`, info: DEF.songs }),
  ];


  mount(el, html`<section class="section ar-history" aria-labelledby="ar-sec-history">
    ${sectionHeader({
      title: 'Your history', id: 'ar-sec-history', desc: `Every play of ${name} in your listening history: Last.fm scrobbles plus what this app heard.`,
      actions: html`<a class="btn btn-ghost btn-sm" href="${router.href('library', { tab: 'recent' }, { artist: st.name || name })}">See all plays${icon('chevronRight')}</a>`,
    })}
    <div class="ar-history-grid">
      <div class="card ar-plays">
        <div class="ar-plays-main">
          <div class="stat-label"><span>Plays</span>${infoTip(DEF.plays, { label: 'Plays' })}</div>
          <div class="hero-figure ar-plays-figure">${fmt.num(st.plays)}</div>
        </div>
        <div class="ar-plays-side">
        <div class="ar-rankline">
          ${st.hidden
            ? html`<span>Hidden from rankings</span>`
            : html`<span><strong>#${fmt.num(st.rank)}</strong> of ${fmt.num(st.total_artists)} artists</span>${infoTip(DEF.rank, { label: 'Rank' })}`}
        </div>
        ${!st.hidden ? html`<div class="ar-share">
          <div class="ar-share-head"><span>${Number(st.share_pct) < 0.1 ? 'Less than 0.1%' : fmt.pct(st.share_pct, { digits: st.share_pct < 10 ? 1 : 0 })} of all your plays</span>${infoTip(DEF.share, { label: 'Share of your plays' })}</div>
          <div class="ar-share-track" aria-hidden="true"><span style="width:${Math.max(0.6, Math.min(100, Number(st.share_pct) || 0)).toFixed(2)}%"></span></div>
        </div>` : ''}
        <div class="ar-sources">
          <span>${fmt.num(split.lastfm)} from Last.fm</span><span class="ar-dot" aria-hidden="true">·</span><span>${fmt.num(split.app)} from this app</span>${infoTip(`${DEF.sources} ${fmt.num(split.heard_in_app)} plays in total were heard in this app.`, { label: 'Sources' })}
        </div>
        </div>
      </div>
      <div class="stat-grid ar-stats">${tiles}</div>
    </div>
    <div data-part="facts">${factsHtml()}</div>
  </section>`);
}

// ======================================================================= charts
function renderCharts() {
  const el = slot('charts');
  if (!el) return;
  const st = S.stats;
  const charts = viewCtx?.charts;
  destroyCharts();
  if (!st?.found || !charts) { mount(el, ''); return; }
  const years = (st.plays_by_year || []).map((p) => ({ key: String(p.year), label: String(p.year), value: p.plays }));
  const peakYear = years.reduce((b, p) => (p.value > (b?.value ?? -1) ? p : b), null);
  const months = (st.plays_by_month || []).map((p) => {
    const d = toDate(p.ym);
    const short = d ? d.toLocaleDateString('en-US', { month: 'short' }) : p.ym;
    return { key: p.ym, label: d && d.getMonth() === 0 ? String(d.getFullYear()) : short, fullLabel: fmt.month(p.ym), value: p.plays };
  });
  const monthTotal = months.reduce((a, p) => a + p.value, 0);
  const busiest = months.reduce((b, p) => (p.value > (b?.value ?? -1) ? p : b), null);
  const firstM = months[0]; const lastM = months[months.length - 1];
  const name = displayName();

  mount(el, html`<section class="section" aria-labelledby="ar-sec-time">
    ${sectionHeader({ title: 'Listening over time', id: 'ar-sec-time', desc: `How often you played ${name}: every year of your history, and month by month for the last two years.` })}
    <div class="ar-grid-2">
      <div class="card ar-chart-card" data-chart="years"></div>
      <div class="card ar-chart-card" data-chart="months"></div>
    </div>
  </section>`);

  const yFig = charts.yearBars(years, {
    title: 'Plays per year',
    subtitle: yearsSubtitle(years),
    valueLabel: 'plays', height: 200, highlightKey: peakYear?.key, tableToggle: true,
    caption: peakYear && peakYear.value ? `Most plays in ${peakYear.label}: ${fmt.num(peakYear.value)}` : '',
  });
  const mFig = charts.columns(months, {
    title: 'Plays per month',
    subtitle: firstM ? `${fmt.month(firstM.key, { short: true })} – ${fmt.month(lastM.key, { short: true })}` : '',
    valueLabel: 'plays', height: 200, tableToggle: true, labelHeader: 'Month',
    caption: monthTotal ? `${fmt.plural(monthTotal, 'play')} in the last 24 months · busiest: ${busiest.fullLabel} (${fmt.num(busiest.value)})` : 'No plays in the last 24 months',
  });
  el.querySelector('[data-chart="years"]')?.replaceChildren(yFig);
  el.querySelector('[data-chart="months"]')?.replaceChildren(mFig);
  S.charts.push(yFig, mFig);
}

// ======================================================================= top tracks + albums
/** "2021–2026 (this year so far)", or one year on its own ("2026 so far") when they're the same. */
function yearsSubtitle(years) {
  if (!years.length) return '';
  const first = years[0].label;
  const last = years[years.length - 1].label;
  const running = last === String(new Date().getFullYear());
  if (first === last) return running ? `${last} so far` : String(last);
  return `${first}–${last}${running ? ' (this year so far)' : ''}`;
}

function releaseForAlbum(albumName) {
  const rels = S.disco?.albums || [];
  if (!rels.length) return null;
  const f = fold(albumName);
  if (!f) return null;
  const rank = { album: 0, ep: 1, single: 2, compilation: 3, live: 4 };
  const matches = rels.filter((r) => !r.is_variant && (fold(r.canonical_name) === f || fold(r.name) === f));
  matches.sort((a, b) => (rank[a.album_class] ?? 9) - (rank[b.album_class] ?? 9));
  return matches[0] || null;
}

function renderTops() {
  const el = slot('tops');
  if (!el || !S) return;
  const st = S.stats;
  if (!st?.found) { mount(el, ''); return; }
  const name = displayName();
  const tracks = st.top_tracks || [];
  const albums = st.top_albums || [];
  const shownT = S.showAllTracks ? tracks : tracks.slice(0, SHOW_TRACKS);
  const shownA = S.showAllAlbums ? albums : albums.slice(0, SHOW_TRACKS);

  // The same ranked-list look as Insights: rank · cover · title / sub · bar + plays · action.
  const trackItems = shownT.map((t, i) => ({
    key: t.song_key, rank: i + 1, name: t.name, artist: name, plays: t.plays, spotify_track_id: t.spotify_track_id,
    image: httpUrl(t.image) || null, href: null,
    sub: [t.album, t.variants > 1 ? `${t.variants} versions` : ''].filter(Boolean).join(' · '),
    // read by renderNowPlaying to mark the song playing now
    attrs: { 'data-id': t.spotify_track_id || '', 'data-fold': fold(t.name) },
  }));
  const albumItems = shownA.map((a, i) => {
    const rel = releaseForAlbum(a.name);
    const relArt = rel?.images?.length ? httpUrl(rel.images[rel.images.length - 1]?.url || rel.images[0]?.url) : '';
    return {
      key: a.album_key, rank: i + 1, name: a.name, plays: a.plays, image: httpUrl(a.image) || relArt || null, href: null,
      sub: `${fmt.plural(a.tracks_heard, 'song')} heard`,
      trailing: rel ? html`<button type="button" class="btn btn-icon btn-sm" data-action="ar-open-release" data-id="${rel.id}" aria-label="Show ${a.name} in the discography" data-tip="Show in discography">${icon('chevronRight')}</button>` : '',
    };
  });

  mount(el, html`<section class="section" aria-labelledby="ar-sec-tops">
    <h2 class="sr-only" id="ar-sec-tops" tabindex="-1">Your top tracks and albums</h2>
    <div class="ar-grid-2 ar-tops">
      <div class="card ar-tracks">
        ${sectionHeader({ title: 'Your top tracks', info: DEF.topTracks, desc: `Your most played songs by ${name}, all time`, level: 3 })}
        ${trackItems.length ? html`<div class="ar-rank">${rankList(trackItems, { kind: 'tracks', compare: false, label: `Your top tracks by ${name}` })}</div>` : emptyState({ title: 'No songs yet', compact: true })}
        ${tracks.length > SHOW_TRACKS ? html`<button type="button" class="btn btn-ghost btn-sm ar-more-btn" data-action="ar-more-tracks" aria-expanded="${S.showAllTracks ? 'true' : 'false'}">${icon(S.showAllTracks ? 'chevronUp' : 'chevronDown')}${S.showAllTracks ? 'Show top 10' : `Show top ${tracks.length}`}</button>` : ''}
      </div>
      <div class="card ar-albums">
        ${sectionHeader({ title: 'Your top albums', info: DEF.topAlbums, desc: `Albums you played most, all time`, level: 3 })}
        ${albumItems.length ? html`<div class="ar-rank">${rankList(albumItems, { kind: 'albums', compare: false, label: `Your top albums by ${name}` })}</div>` : emptyState({ title: 'No album info', body: 'Your plays of this artist carry no album names.', compact: true, icon: 'disc' })}
        ${albums.length > SHOW_TRACKS ? html`<button type="button" class="btn btn-ghost btn-sm ar-more-btn" data-action="ar-more-albums" aria-expanded="${S.showAllAlbums ? 'true' : 'false'}">${icon(S.showAllAlbums ? 'chevronUp' : 'chevronDown')}${S.showAllAlbums ? 'Show top 10' : `Show top ${albums.length}`}</button>` : ''}
      </div>
    </div>
  </section>`);
  renderNowPlaying(store.status);
}

// ======================================================================= popular tracks not heard yet
function renderUnheard() {
  const el = slot('unheard');
  if (!el || !S) return;
  const st = S.stats;
  const isNew = st && !st.found;
  const name = displayName();
  const title = isNew ? `Popular tracks by ${name}` : 'Popular tracks you haven’t played';
  const fromLastfm = (S.info?.top_tracks || []).length > 0 && (S.info.top_tracks).every((t) => t.source === 'lastfm');
  const head = sectionHeader({
    title, id: 'ar-sec-unheard', info: DEF.unheard,
    desc: isNew
      ? `Their most played tracks on ${fromLastfm ? 'Last.fm' : 'Spotify'}, a good place to start.`
      : `Their most played tracks on ${fromLastfm ? 'Last.fm' : 'Spotify'} that aren’t in your history yet.`,
  });
  if (S.infoLoading && !S.info) {
    mount(el, html`<section class="section" aria-labelledby="ar-sec-unheard">${head}<div class="card">${loadingState('Loading their popular tracks…', { compact: true })}</div></section>`);
    return;
  }
  const all = S.info?.top_tracks || [];
  if (!all.length) { mount(el, ''); return; }
  const list = isNew ? all : (S.info?.unheard_top_tracks || all.filter((t) => !t.my_plays));
  if (!list.length) {
    mount(el, html`<section class="section" aria-labelledby="ar-sec-unheard">${head}
      <div class="card ar-allheard">${icon('checkCircle')}<div><strong>You've played all ${fmt.num(all.length)} of their most popular tracks.</strong>
      <span class="muted">Looking for more? Releases you haven't heard are marked in the discography below.</span></div></div>
    </section>`);
    return;
  }
  const rows = list.map((t) => {
    const artistName = t.artist_list?.[0]?.name || name;
    const meta = t.duration_ms ? fmt.clock(t.duration_ms) : '';
    const save = html`<button type="button" class="btn btn-icon btn-sm" data-action="ar-watch-track" data-name="${t.name}" data-id="${t.id || ''}" data-image="${httpUrl(t.image)}" aria-label="Save ${t.name} to your watchlist" data-tip="Save to watchlist">${icon('bookmark')}</button>`;
    return trackRow({ image: httpUrl(t.image) || null, name: t.name, artist: artistName, album: t.album || '', uri: t.uri || (t.id ? `spotify:track:${t.id}` : ''), meta, actions: save, sub: t.album ? html`<span>${t.album}</span>` : '' });
  });
  mount(el, html`<section class="section" aria-labelledby="ar-sec-unheard">${head}
    <div class="card ar-unheard-card"><div class="list ar-unheard" role="list">${rows}</div></div>
  </section>`);
}

// ======================================================================= discography
const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'album', label: 'Albums', test: (r) => r.album_class === 'album' },
  { id: 'ep', label: 'EPs', test: (r) => r.album_class === 'ep' },
  { id: 'single', label: 'Singles', test: (r) => r.album_class === 'single' },
  { id: 'other', label: 'Live & compilations', test: (r) => r.album_class === 'live' || r.album_class === 'compilation' },
];
const CLASS_LABEL = { album: 'Album', ep: 'EP', single: 'Single', live: 'Live', compilation: 'Compilation' };

function renderDisco() {
  const el = slot('disco');
  if (!el || !S) return;
  const name = displayName();
  const d = S.disco;
  const head = (extra) => sectionHeader({ title: 'Discography', id: 'ar-sec-disco', desc: `Their releases on Spotify, and how much of each you've heard.`, actions: extra });
  if (!d) {
    if (S.discoLoading) {
      mount(el, html`<section class="section" aria-labelledby="ar-sec-disco">${head()}<div class="card">${loadingState('Loading their releases from Spotify…', { compact: true })}</div></section>`);
      return;
    }
    const e = S.discoErr;
    let body;
    if (e?.isRateLimited) {
      const when = e.retryAfter ? new Date(Date.now() + e.retryAfter * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
      body = errorState(e, { title: 'Spotify is cooling down', body: `Their releases can load again ${when ? `around ${when}` : 'in a moment'}${S.discoRetries ? ' — this page will retry by itself' : ''}. Everything else on this page still works.`, retry: () => loadDisco(), compact: true });
    } else if (e?.code === 'demo_unavailable') {
      body = emptyState({ title: 'Not part of the demo', body: e.message, icon: 'disc', compact: true });
    } else if (e?.status === 404 || e?.code === 'artist_not_found') {
      body = emptyState({ title: `${name} wasn't found on Spotify`, body: 'Without a Spotify match there is no catalog to show. Everything else on this page still works.', icon: 'search', compact: true });
    } else if (e?.status === 401) {
      body = emptyState({ title: 'Connect Spotify to see their releases', body: 'The discography comes from Spotify.', action: { label: 'Connect Spotify', href: '/login' }, compact: true, icon: 'lock' });
    } else {
      body = errorState(e, { title: 'Their releases didn’t load', body: `${e?.message || 'Something went wrong.'} Everything else on this page still works.`, retry: () => loadDisco(), compact: true });
    }
    mount(el, html`<section class="section" aria-labelledby="ar-sec-disco">${head()}<div class="card">${body}</div></section>`);
    return;
  }

  const all = (d.albums || []).filter((r) => !r.is_variant);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.test).length]));
  const f = FILTERS.find((x) => x.id === S.filter) || FILTERS[0];
  let list = all.filter(f.test);
  if (S.unheardOnly) list = list.filter((r) => !r.heard_tracks);
  const total = list.length;
  const shown = S.showAllReleases ? list : list.slice(0, SHOW_RELEASES);
  const covered = Number(d.catalog_tracks_heard || 0);
  const catalog = Number(d.catalog_tracks_total || 0);
  const pct = catalog ? Math.min(100, Math.round((covered / catalog) * 100)) : 0;
  const unheardReleases = all.filter((r) => !r.heard_tracks).length;

  const filterItems = FILTERS.filter((x) => x.id === 'all' || counts[x.id] > 0).map((x) => ({ id: x.id, label: `${x.label} ${counts[x.id]}` }));

  const summary = catalog
    ? html`<div class="ar-cover">
        <div class="ar-cover-head">
          <div><span class="ar-cover-figure">${pct}%</span> <span class="ar-cover-label">of their album and EP tracks heard</span>${infoTip(DEF.coverage, { label: 'Catalog heard' })}</div>
          <div class="ar-cover-sub">${fmt.num(covered)} of ${fmt.num(catalog)} tracks · ${albumsStarted(Number(d.explored_albums) || 0, Number(d.total_albums) || 0)}</div>
        </div>
        <div class="ar-cover-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
      </div>`
    : '';

  mount(el, html`<section class="section" aria-labelledby="ar-sec-disco">
    ${head()}
    ${d._stale_notice ? html`<p class="ar-note">${icon('hourglass')}<span>Spotify is cooling down, so this is the saved copy of their discography. Heard progress is up to date.</span></p>` : ''}
    <div class="card ar-disco">
      ${summary}
      <div class="ar-disco-filters">
        <div class="ar-seg" data-part="disco-filter">${segmented({ items: filterItems, selected: f.id, label: 'Release type' })}</div>
        <button type="button" class="chip chip-lg ar-unheard-toggle" data-action="ar-unheard-only" aria-pressed="${S.unheardOnly ? 'true' : 'false'}">${S.unheardOnly ? icon('check') : ''}Not heard yet${unheardReleases ? html` <span class="ar-chip-count">${unheardReleases}</span>` : ''}</button>
      </div>
      ${shown.length
        ? html`<ul class="ar-releases" role="list">${shown.map(releaseRow)}</ul>`
        : emptyState({ title: S.unheardOnly ? 'You’ve started every release here' : 'No releases of this type', body: S.unheardOnly ? 'Every release in this filter has at least one track you played.' : 'Try another filter.', compact: true, icon: 'disc' })}
      ${total > SHOW_RELEASES ? html`<button type="button" class="btn btn-ghost btn-sm ar-more-btn" data-action="ar-more-releases" aria-expanded="${S.showAllReleases ? 'true' : 'false'}">${icon(S.showAllReleases ? 'chevronUp' : 'chevronDown')}${S.showAllReleases ? 'Show fewer' : `Show all ${fmt.num(total)} releases`}</button>` : ''}
    </div>
  </section>`);
  const seg = el.querySelector('[data-part="disco-filter"]');
  if (seg) {
    bindChoiceGroup(seg, (value) => {
      S.filter = value;
      S.showAllReleases = false;
      renderDisco();
      el.querySelector('[data-part="disco-filter"] [role="radio"][aria-checked="true"]')?.focus();
    });
  }
}

function albumsStarted(started, total) {
  if (total <= 0) return 'no albums or EPs yet';
  if (total === 1) return started ? 'their one album or EP started' : 'their one album or EP not started yet';
  if (started >= total) return `all ${fmt.num(total)} albums and EPs started`;
  return `${fmt.num(started)} of ${fmt.num(total)} albums and EPs started`;
}

function releaseRow(r) {
  const art = r.images?.length ? httpUrl((r.images[r.images.length - 1] || r.images[0]).url) : '';
  const total = Number(r.total_tracks || 0);
  const heard = Number(r.heard_tracks || 0);
  const pct = total ? Math.min(100, Math.round((heard / total) * 100)) : 0;
  const state = S.releases.get(r.id) || {};
  const open = !!state.open;
  const panelId = `ar-rel-${r.id}`;
  const status = heard === 0 ? 'Not heard yet' : heard >= total ? 'All heard' : `${heard} of ${total} heard`;
  return html`<li class="ar-rel${open ? ' is-open' : ''}${heard === 0 ? ' is-unheard' : ''}" data-id="${r.id}">
    <button type="button" class="ar-rel-head" data-action="ar-toggle-release" data-id="${r.id}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${panelId}">
      ${art ? html`<img class="ar-rel-art" src="${art}" alt="" loading="lazy" decoding="async">` : html`<span class="ar-rel-art ar-rel-art-ph" aria-hidden="true">${icon('disc')}</span>`}
      <span class="ar-rel-main">
        <span class="ar-rel-title">${r.canonical_name || r.name}</span>
        <span class="ar-rel-sub">${r.release_year || '—'} · ${CLASS_LABEL[r.album_class] || 'Release'} · ${fmt.plural(total, 'track')}</span>
      </span>
      <span class="ar-rel-progress" data-heard="${heard === 0 ? 'none' : heard >= total ? 'all' : 'some'}">
        <span class="ar-rel-status">${heard >= total && total ? icon('checkCircle') : ''}${status}</span>
        <span class="ar-rel-meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
      </span>
      <span class="ar-rel-chev" aria-hidden="true">${icon('chevronDown')}</span>
    </button>
    <div class="ar-rel-panel" id="${panelId}" ${open ? '' : raw('hidden')}>${open ? releasePanel(r) : ''}</div>
  </li>`;
}

function releasePanel(r) {
  const state = S.releases.get(r.id) || {};
  if (state.loading && !state.data) return loadingState('Loading the tracklist…', { compact: true });
  if (state.err && !state.data) {
    const e = state.err;
    return errorState(e, { title: e.isRateLimited ? 'Spotify is cooling down' : 'The tracklist didn’t load', compact: true, retry: () => loadRelease(r.id, { force: true }) });
  }
  const data = state.data;
  if (!data) return '';
  const tracks = data.tracks || [];
  const albumUri = r.uri || `spotify:album:${r.id}`;
  const firstUnheard = tracks.find((t) => !t.heard && t.uri);
  const first = tracks.find((t) => t.uri);
  const multiDisc = new Set(tracks.map((t) => t.disc_number || 1)).size > 1;
  return html`
    <div class="ar-rel-actions">
      ${first ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="ar-play-album" data-uri="${first.uri}" data-context="${albumUri}" data-name="${r.canonical_name || r.name}">${icon('play')}Play release</button>` : ''}
      ${firstUnheard && firstUnheard !== first ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="ar-play-album" data-uri="${firstUnheard.uri}" data-context="${albumUri}" data-name="${firstUnheard.name}">${icon('sparkle')}Play first track you haven't heard</button>` : ''}
      ${data._stale_notice ? html`<span class="muted small">${icon('hourglass')} Saved copy (Spotify is cooling down)</span>` : ''}
    </div>
    <ol class="ar-tl" aria-label="Tracklist of ${r.canonical_name || r.name}">
      ${tracks.map((t) => html`<li class="ar-tl-row${t.heard ? ' is-heard' : ''}">
        <span class="ar-tl-num">${multiDisc ? `${t.disc_number}-${t.track_number}` : t.track_number}</span>
        ${t.uri ? html`<button type="button" class="btn btn-icon btn-sm ar-tl-play" data-action="ar-play-album" data-uri="${t.uri}" data-context="${albumUri}" data-name="${t.name}" aria-label="Play ${t.name}" data-tip="Play">${icon('play')}</button>` : html`<span class="row-action-slot" aria-hidden="true"></span>`}
        <span class="ar-tl-title">${t.name}</span>
        <span class="ar-tl-heard">${t.heard ? html`${icon('check')}<span>${fmt.plural(t.my_plays, 'play')}</span>` : html`<span class="muted">Not heard</span>`}</span>
        <span class="ar-tl-dur">${t.duration_ms ? fmt.clock(t.duration_ms) : ''}</span>
      </li>`)}
    </ol>`;
}

async function loadRelease(id, { force = false } = {}) {
  const st = S;
  const cur = st.releases.get(id) || {};
  if (cur.loading || (cur.data && !force)) return;
  st.releases.set(id, { ...cur, open: true, loading: true, err: null });
  refreshRelease(id);
  try {
    const data = await api.get('/api/artist/discography/release', { params: { album_id: id, artist_name: st.name }, signal: st.ctrl.signal, timeoutMs: 30000 });
    if (S !== st) return;
    st.releases.set(id, { ...st.releases.get(id), loading: false, data });
  } catch (err) {
    if (isAbort(err) || S !== st) return;
    st.releases.set(id, { ...st.releases.get(id), loading: false, err });
  }
  refreshRelease(id);
}

function refreshRelease(id) {
  const li = rootEl?.querySelector(`.ar-rel[data-id="${CSS.escape(id)}"]`);
  const r = (S.disco?.albums || []).find((x) => x.id === id);
  if (!li || !r) return;
  const state = S.releases.get(id) || {};
  const open = !!state.open;
  li.classList.toggle('is-open', open);
  const btn = li.querySelector('.ar-rel-head');
  btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  const panel = li.querySelector('.ar-rel-panel');
  if (panel) {
    panel.hidden = !open;
    mount(panel, open ? releasePanel(r) : '');
  }
}

// ======================================================================= similar artists
function renderSimilar() {
  const el = slot('similar');
  if (!el || !S) return;
  const head = sectionHeader({ title: 'Similar artists', id: 'ar-sec-similar', info: DEF.similar, desc: 'Artists their listeners also play, with how much you already know them.' });
  if (S.infoLoading && !S.info) {
    mount(el, html`<section class="section" aria-labelledby="ar-sec-similar">${head}<div class="card">${loadingState('Finding similar artists on Last.fm…', { compact: true })}</div></section>`);
    return;
  }
  const rel = (S.info?.related || []).filter((r) => r && r.name);
  if (!rel.length) { mount(el, ''); return; }
  const known = rel.filter((r) => Number(r.my_plays) > 0).length;
  const shownRel = S.showAllSimilar ? rel : rel.slice(0, SHOW_SIMILAR);
  mount(el, html`<section class="section" aria-labelledby="ar-sec-similar">
    ${sectionHeader({ title: 'Similar artists', id: 'ar-sec-similar', info: DEF.similar, desc: `${known ? `You already listen to ${known} of these ${rel.length}.` : `All ${rel.length} are new to you.`} Most similar first.` })}
    <ul class="ar-sim-grid" role="list">
      ${shownRel.map((r) => {
        const img = httpUrl(r.image);
        const mine = Number(r.my_plays) || 0;
        const match = r.match != null ? Math.round(Number(r.match) * 100) : null;
        return html`<li><a class="ar-sim" href="${artistHref(r.name)}">
          <span class="ar-sim-art">${img ? html`<img src="${img}" alt="" loading="lazy" decoding="async">` : initialsAvatar(r.name, 'ar-initials-sm')}</span>
          <span class="ar-sim-name">${r.name}</span>
          ${match != null ? html`<span class="ar-sim-match"><span class="ar-sim-meter" aria-hidden="true"><span style="width:${Math.max(4, match)}%"></span></span><span>${match}% similar</span></span>` : ''}
          ${mine ? html`<span class="ar-sim-you">You: <strong>${fmt.plural(mine, 'play')}</strong></span>` : html`<span class="chip chip-accent ar-sim-new">${icon('sparkle')}New to you</span>`}
        </a></li>`;
      })}
    </ul>
    ${rel.length > SHOW_SIMILAR ? html`<button type="button" class="btn btn-ghost btn-sm ar-more-btn" data-action="ar-more-similar" aria-expanded="${S.showAllSimilar ? 'true' : 'false'}">${icon(S.showAllSimilar ? 'chevronUp' : 'chevronDown')}${S.showAllSimilar ? 'Show fewer' : `Show all ${rel.length}`}</button>` : ''}
  </section>`);
}

// ======================================================================= about
function renderAbout() {
  const el = slot('about');
  if (!el || !S) return;
  if (S.infoLoading && !S.info) { mount(el, ''); return; }
  const info = S.info || {};
  const full = cleanBio(info.bio_full || info.bio);
  const lfm = httpUrl(info.lastfm_url);
  if (!full) { mount(el, ''); return; }
  const paras = full.split(/\n{2,}|\r\n\r\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const long = full.length > 700 || paras.length > 3;
  const open = S.bioOpen || !long;
  const shown = open ? paras : paras.slice(0, 2);
  const facts = [];
  if (Number(info.stats?.listeners) > 0) facts.push(['Listeners on Last.fm', fmt.num(info.stats.listeners), DEF.listeners]);
  if (Number(info.stats?.playcount) > 0) facts.push(['Plays on Last.fm', fmt.compact(info.stats.playcount), 'Scrobbles of this artist by everyone on Last.fm, all time.']);
  if (Number(info.spotify_followers) > 0) facts.push(['Followers on Spotify', fmt.num(info.spotify_followers), 'People following this artist on Spotify.']);
  const mine = S.stats?.found ? S.stats.plays : 0;
  if (mine && Number(info.stats?.playcount) > mine) {
    const every = Math.round(Number(info.stats.playcount) / mine);
    facts.push(['Your part of their Last.fm plays', `1 in ${fmt.compact(every)}`, `Of every ${fmt.num(every)} times anyone played them on Last.fm, one was you (your ${fmt.num(mine)} plays against ${fmt.num(info.stats.playcount)} in total).`]);
  }
  const sp = httpUrl(info.spotify_url);
  mount(el, html`<section class="section" aria-labelledby="ar-sec-about">
    ${sectionHeader({ title: 'About', id: 'ar-sec-about', desc: 'Biography from Last.fm, written by its community.' })}
    <div class="card ar-about">
      <div class="ar-about-main">
        <div class="ar-bio${open ? '' : ' is-clamped'}" id="ar-bio">${shown.map((p) => html`<p>${p}</p>`)}</div>
        ${long ? html`<div class="ar-about-foot"><button type="button" class="btn btn-ghost btn-sm" data-action="ar-bio" aria-expanded="${open ? 'true' : 'false'}" aria-controls="ar-bio">${icon(open ? 'chevronUp' : 'chevronDown')}${open ? 'Show less' : 'Read more'}</button></div>` : ''}
      </div>
      <aside class="ar-about-side" aria-label="${displayName()} in numbers">
        ${facts.length ? html`<dl class="ar-dl">${facts.map(([k, v, def]) => html`<div><dt>${k}${infoTip(def, { label: k })}</dt><dd>${v}</dd></div>`)}</dl>` : ''}
        <div class="ar-links">
          ${lfm ? html`<a class="btn btn-secondary btn-sm" href="${lfm}" target="_blank" rel="noopener noreferrer">${icon('external')}Last.fm</a>` : ''}
          ${sp ? html`<a class="btn btn-secondary btn-sm" href="${sp}" target="_blank" rel="noopener noreferrer">${icon('external')}Spotify</a>` : ''}
        </div>
      </aside>
    </div>
  </section>`);
}

// ======================================================================= actions
async function playInContext(uri, contextUri, name) {
  try {
    await api.post('/api/play-track', { uri, context_uri: contextUri });
    toast(html`Playing <strong>${name}</strong>`, { kind: 'success', icon: 'play', timeoutMs: 3000 });
    store.refreshSoon(700);
  } catch (err) {
    const msg = String(err?.message || '');
    const text = /no active device|NO_ACTIVE_DEVICE|device not found/i.test(msg)
      ? 'No active Spotify device. Start playing in Spotify, then try again.'
      : err?.isRateLimited ? err.message : `Couldn't start playback${msg ? `: ${msg}` : '.'}`;
    toast(text, { kind: 'error' });
  }
}

async function toggleFavorite(btn) {
  const name = displayName();
  const was = isFavorite();
  const next = !was;
  await withBusy(btn, async () => {
    try {
      const st = S;
      const r = await api.post('/api/favorites', { action: next ? 'add' : 'remove', artist: name });
      const now = !!r?.is_favorite;
      const list = [...(store.status?.favorite_artists || [])].filter((n) => n !== name.trim().toLowerCase());
      if (now) list.push(name.trim().toLowerCase());
      // Still on this artist's page? (the request can outlive a navigation)
      if (S && S === st) { S.favOverride = now; renderHeroActions(); }
      store.patch({ favorite_artists: list });
      toast(now
        ? html`<strong>${name}</strong> is now a favorite. Their new releases show up in your release radar.`
        : html`Removed <strong>${name}</strong> from favorites. They won't be re-added automatically.`, {
        kind: 'success', icon: 'checkCircle',
        action: { label: 'Undo', onClick: () => undoFavorite(name, was) },
      });
      store.refreshSoon(800);
    } catch (err) { toastError(err, 'Couldn’t update your favorites.'); }
  });
}

async function undoFavorite(name, value) {
  try {
    const r = await api.post('/api/favorites', { action: value ? 'add' : 'remove', artist: name });
    if (S && displayName() === name) { S.favOverride = !!r?.is_favorite; renderHeroActions(); }
    const list = [...(store.status?.favorite_artists || [])].filter((n) => n !== name.trim().toLowerCase());
    if (r?.is_favorite) list.push(name.trim().toLowerCase());
    store.patch({ favorite_artists: list });
    store.refreshSoon(800);
  } catch (err) { toastError(err); }
}

async function setHidden(hidden) {
  const name = displayName();
  if (hidden) {
    const ok = await confirmDialog({
      title: `Hide ${name} from your stats?`,
      body: html`<p>They'll be left out of your rankings, top lists and reports, which is handy for podcasts, audiobooks and background noise.</p><p>Nothing is deleted: their plays stay in your history, this page keeps working, and you can show them again at any time.</p>`,
      confirmLabel: 'Hide from stats',
    });
    if (!ok) return;
  }
  try {
    await api.post(`/api/v2/artist/${encodeURIComponent(S.name)}/hide`, { hidden });
    toast(hidden ? html`<strong>${name}</strong> is hidden from your stats.` : html`<strong>${name}</strong> is back in your stats.`, {
      kind: 'success', icon: hidden ? 'eye' : 'checkCircle',
      action: { label: 'Undo', onClick: () => quietHide(name, !hidden) },
    });
    await loadStats({ refetch: true });
  } catch (err) { toastError(err, 'Couldn’t update this artist.'); }
}

async function quietHide(name, hidden) {
  try {
    await api.post(`/api/v2/artist/${encodeURIComponent(name)}/hide`, { hidden });
    if (S && (S.name === name || displayName() === name)) await loadStats({ refetch: true });
  } catch (err) { toastError(err); }
}

function openMore(btn) {
  const info = S.info || {};
  const name = displayName();
  const sp = httpUrl(info.spotify_url);
  const lfm = httpUrl(info.lastfm_url) || `https://www.last.fm/music/${encodeURIComponent(name).replace(/%20/g, '+')}`;
  const hidden = !!S.stats?.hidden;
  const items = [];
  if (sp) items.push({ label: 'Open in Spotify', icon: 'external', href: sp, external: true });
  items.push({ label: 'Open on Last.fm', icon: 'external', href: lfm, external: true });
  items.push({ label: 'All your artists', icon: 'artists', href: '#/artists' });
  if (S.stats?.found || hidden) {
    items.push({ separator: true });
    items.push(hidden
      ? { label: 'Show in stats again', icon: 'eye', onSelect: () => setHidden(false) }
      : { label: 'Hide from stats…', icon: 'eye', hint: 'podcasts, noise', onSelect: () => setHidden(true) });
  }
  menu(btn, items, { label: `More actions for ${name}` });
}

// "Save to watchlist": the shared dialog (same reasons + note as everywhere else).
async function openWatchlist(entity) {
  const forName = S?.name;
  const r = await openWatchlistDialog(entity);
  if (entity.entity_type === 'artist' && r && S && S.name === forName) { S.watchlisted = true; renderHeroActions(); }
}

function jumpTo(id) {
  const target = rootEl?.querySelector(`#${CSS.escape(id)}`);
  if (!target) return;
  const section = target.closest('section') || target;
  section.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function bindActions(root) {
  return actions(root, {
    'ar-play-top': () => {
      const p = playPick();
      if (!p) return undefined;
      return playTrack({ uri: p.uri, id: p.id, artist: displayName(), name: p.name });
    },
    'ar-fav': (ds, el) => toggleFavorite(el),
    'ar-watch': () => {
      if (S.watchlisted) {
        toast(html`<strong>${displayName()}</strong> is already on your watchlist.`, { kind: 'info', action: { label: 'View', onClick: () => router.navigate('/library/watchlist') } });
        return undefined;
      }
      return openWatchlist({ entity_type: 'artist', entity_id: S.info?.artist_id || null, entity_name: displayName(), image: httpUrl(S.info?.artist_image_small || S.info?.artist_image) || null });
    },
    'ar-watch-track': (ds) => openWatchlist({ entity_type: 'track', entity_id: ds.id || null, entity_name: ds.name, subtitle: displayName(), image: ds.image || null }),
    'ar-more': (ds, el) => openMore(el),
    'ar-unhide': () => setHidden(false),
    'ar-retry-info': (ds, el) => withBusy(el, async () => { S.infoErr = null; S.infoLoading = true; renderAll({ stats: false, info: true }); await loadInfo(); }),
    'ar-jump': (ds) => jumpTo(ds.target),
    'ar-more-tracks': () => { S.showAllTracks = !S.showAllTracks; renderTops(); rootEl.querySelector('[data-action="ar-more-tracks"]')?.focus(); },
    'ar-more-albums': () => { S.showAllAlbums = !S.showAllAlbums; renderTops(); rootEl.querySelector('[data-action="ar-more-albums"]')?.focus(); },
    'ar-more-releases': () => { S.showAllReleases = !S.showAllReleases; renderDisco(); rootEl.querySelector('[data-action="ar-more-releases"]')?.focus(); },
    'ar-unheard-only': () => { S.unheardOnly = !S.unheardOnly; S.showAllReleases = false; renderDisco(); rootEl.querySelector('[data-action="ar-unheard-only"]')?.focus(); },
    'ar-toggle-release': (ds) => {
      const cur = S.releases.get(ds.id) || {};
      const open = !cur.open;
      S.releases.set(ds.id, { ...cur, open });
      if (open && !cur.data) loadRelease(ds.id); else refreshRelease(ds.id);
    },
    'ar-open-release': (ds) => openRelease(ds.id),
    'ar-play-album': (ds) => playInContext(ds.uri, ds.context, ds.name),
    'ar-more-similar': () => { S.showAllSimilar = !S.showAllSimilar; renderSimilar(); rootEl.querySelector('[data-action="ar-more-similar"]')?.focus(); },
    'ar-bio': () => { S.bioOpen = !S.bioOpen; renderAbout(); rootEl.querySelector('[data-action="ar-bio"]')?.focus(); },
  });
}

// From "Your top albums": show that release in the discography, opened.
function openRelease(id) {
  const r = (S.disco?.albums || []).find((x) => x.id === id);
  if (!r) return;
  const f = FILTERS.find((x) => x.id === S.filter);
  const visible = (!f || f.test(r)) && (!S.unheardOnly || !r.heard_tracks);
  if (!visible) { S.filter = 'all'; S.unheardOnly = false; }
  const list = (S.disco.albums || []).filter((x) => !x.is_variant).filter((x) => (FILTERS.find((y) => y.id === S.filter) || FILTERS[0]).test(x));
  if (list.slice(0, SHOW_RELEASES).every((x) => x.id !== id)) S.showAllReleases = true;
  S.releases.set(id, { ...(S.releases.get(id) || {}), open: true });
  renderDisco();
  if (!S.releases.get(id).data) loadRelease(id);
  const li = rootEl.querySelector(`.ar-rel[data-id="${CSS.escape(id)}"]`);
  if (li) {
    li.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    li.querySelector('.ar-rel-head')?.focus({ preventScroll: true });
    li.classList.add('is-flash');
    setTimeout(() => li.classList.remove('is-flash'), 1600);
  }
}

// ======================================================================= lifecycle
function start(name) {
  S = newState(name);
  renderShell();
  renderJump();
  load();
}

function stop() {
  if (!S) return;
  try { S.ctrl.abort(); } catch { /* ignore */ }
  S.timers.forEach((t) => clearTimeout(t));
  destroyCharts();
  S = null;
}

export default {
  id: 'artist',
  title: 'Artist',
  mount(root, params, ctx) {
    rootEl = root;
    viewCtx = ctx;
    offActions = bindActions(root);
    const name = String(params?.name || '').trim();
    if (!name) {
      mount(root, emptyState({ title: 'Which artist?', body: 'Open an artist from search, the player, or your artists list.', icon: 'artists', action: { label: 'Browse your artists', href: '#/artists' } }));
      return;
    }
    start(name);
  },
  update(params, ctx) {
    viewCtx = ctx;
    const name = String(params?.name || '').trim();
    if (S && name === S.name) return;
    stop();
    if (!name) { mount(rootEl, emptyState({ title: 'Which artist?', icon: 'artists', action: { label: 'Browse your artists', href: '#/artists' } })); return; }
    start(name);
    rootEl.querySelector('h1')?.focus({ preventScroll: true });
  },
  unmount() {
    stop();
    if (offActions) { offActions(); offActions = null; }
    rootEl = null;
    viewCtx = null;
  },
  onStatus(status, { changed } = {}) {
    if (!S) return;
    if (!changed || changed.has('favorite_artists')) {
      // The server has caught up with our optimistic value.
      if (S.favOverride != null && Array.isArray(status.favorite_artists)) {
        const has = status.favorite_artists.includes(displayName().trim().toLowerCase());
        if (has === S.favOverride) S.favOverride = null;
      }
      renderHeroActions();
    }
    if (!changed || changed.has('current_track') || changed.has('is_playing')) renderNowPlaying(status);
  },
};

// Exposed for headless checks.
export const __test = { fold, cleanBio, ago };

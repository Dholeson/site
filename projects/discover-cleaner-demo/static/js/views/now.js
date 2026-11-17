// Now view (#/now, the default route): what is playing and what happens to it (the backlog
// "fate"), the actions that change that fate, lyrics, "you and this artist", today's numbers,
// the backlog card (size, this week, pace, auto-clear + threshold), recent clears with undo, and
// catch-up for tracks already heard elsewhere.
//
// Rendering is per panel. Each panel remembers a signature of what it was drawn from and only
// re-renders when that changes; the countdown ring, fate sentence and lyric highlight tick in
// place every 250 ms from store.sinceObserved() (the same clock as the player bar), so focus,
// hover and scroll positions survive the 3 s status polls.
//
// Actions reuse components/player.js (like, keep, clearNow, undo, next, openAddToPlaylist) so the
// keyboard shortcuts, the player bar and this page behave and announce identically.
import { api, isAbort } from '../core/api.js';
import store from '../core/store.js';
import {
  html, raw, mount, icon, fmt, toast, menu, thumb, artistLinks, artistHref, infoTip,
  loadingState, emptyState, errorState, reportError, withBusy, setRefetching, debounce, toDate, trackRow, initialsAvatar, notice,
} from '../core/ui.js';
import player from '../components/player.js';
import { saveTrackToWatchlist } from '../components/watchlist-dialog.js';
import { openCatchUpDialog } from '../components/catchup-dialog.js';

const TICK_MS = 250;
const IN_BACKLOG = new Set(['in_backlog', 'kept', 'clearing_paused', 'queued']);
const LYRICS_KEY = 'dc.now.lyricsOpen';
const CLEARED_PREVIEW = 5;
const INSIGHTS_TTL_MS = 60e3;
const INSIGHTS_MIN_GAP_MS = 20e3;
const CATCHUP_TTL_MS = 5 * 60e3;
const ARTIST_TTL_MS = 5 * 60e3;
const WAIT_OUT_MS = 20e3;           // enrichment (lyrics / Last.fm) that hasn't arrived by then is "not available"
const THRESHOLD_MIN = 5;
const THRESHOLD_MAX = 120;
const BACKLOG_INSIGHTS_HREF = '#/insights/backlog';

const DEF = {
  plays_today: 'Plays in your listening history since midnight: Last.fm scrobbles plus plays this app recorded. Hidden (non-music) artists are left out.',
  cleared_today: "Different tracks removed from your backlog since midnight: automatically after the listen threshold, with Clear now, Like, or catch-up. Clears you undid don't count.",
  heard_in_app: "Different tracks this app saw you play for 30 seconds or more since midnight, the same rule that makes a play count. Quick skips aren't counted. The track playing now counts once it reaches 30 seconds.",
  liked_today: 'Tracks you saved to Liked Songs from this app since midnight.',
  backlog_total: 'Tracks in your backlog playlist right now. It shrinks as tracks are cleared and grows when you add tracks in Spotify.',
  artist_plays: 'Every play of this artist in your history: Last.fm scrobbles plus plays this app recorded.',
  artist_rank: "Where this artist sits among everyone you've played, by number of plays.",
  artist_first: 'Your earliest recorded play of this artist.',
  artist_last: 'Your most recent recorded play of this artist (the current play counts once it is recorded).',
  lyrics_timing: "Shifts which line is highlighted. If the highlight runs behind the singer, press + to show lines earlier; press − if it runs ahead.",
};

// Module-scope caches survive navigating away and back (the view remounts).
const cache = {
  insights: null, insightsAt: 0,
  catchup: null, catchupAt: 0,
  artists: new Map(),       // lower-cased name -> {at, data}
  tints: new Map(),         // image url -> 'r,g,b' | null
};

let V = null;                // per-mount state (null while unmounted)

// ======================================================================= helpers
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function secs(n) {
  const v = Math.max(0, Math.round(num(n)));
  if (v < 60) return `${v} s`;
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

function primaryArtist(t) {
  if (!t) return '';
  if (Array.isArray(t.artist_list) && t.artist_list[0]?.name) return t.artist_list[0].name;
  return String(t.artists || '').split(', ')[0] || '';
}

function plName(name) {
  return name ? `“${name}”` : 'your backlog';
}

function timeOfDay(ms) {
  const d = toDate(ms);
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
}

function undoable(e) {
  return !!e && !e.undone && e.seq != null && (!e.undo_expires_ms || e.undo_expires_ms > Date.now());
}

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** Same derivation as the player bar, so both always tell the same story. */
function fateOf(s, t) {
  if (!t) return { state: 'idle' };
  const f = s.current_fate;
  if (f && typeof f === 'object' && f.state && (!f.track_id || f.track_id === t.id)) return f;
  const listened = num(s.current_listened);
  const thr = num(s.threshold_seconds);
  if (s.current_in_playlist) {
    if (s.auto_clean && s.auto_clean.enabled === false) return { state: 'clearing_paused', track_id: t.id, listened_s: listened, effective_threshold_s: thr };
    return { state: 'in_backlog', track_id: t.id, listened_s: listened, effective_threshold_s: thr, clears_in_s: Math.max(0, thr - listened) };
  }
  const rc = Array.isArray(s.recently_cleared) ? s.recently_cleared.find((e) => e && e.track_id === t.id && !e.undone) : null;
  if (rc) return { state: 'cleared', track_id: t.id };
  if (s.backlog ? s.backlog.complete === false : s.playlist_track_ids_loaded === false) return { state: 'syncing', track_id: t.id };
  return { state: 'not_in_backlog', track_id: t.id };
}

function buildModel(s) {
  const t = s && s.current_track && s.current_track.id ? s.current_track : null;
  const fate = fateOf(s || {}, t);
  const cleared = Array.isArray(s?.recently_cleared) ? s.recently_cleared : [];
  return {
    t,
    fate,
    playing: !!s?.is_playing,
    liked: !!s?.current_is_liked,
    inBacklog: IN_BACKLOG.has(fate.state),
    playlistName: s?.backlog?.name || s?.playlist_name || '',
    signedOut: !!s && s.auth_ready === false && !t,
    threshold: num(fate.effective_threshold_s ?? s?.threshold_seconds),
    entry: t ? cleared.find((e) => e && e.track_id === t.id && !e.undone) || null : null,
    duration: num(t?.duration_ms || s?.duration_ms),
  };
}

function progressNow() {
  const s = V.status;
  const m = V.model;
  const base = num(s?.progress_ms);
  const add = m?.playing ? store.sinceObserved() : 0;
  return m?.duration ? Math.min(m.duration, base + add) : base + add;
}

/** Seconds until the current track clears (null when unknown / not counting down). */
function remainingS() {
  const m = V.model;
  const f = m?.fate;
  if (!f || f.state !== 'in_backlog') return null;
  let base = f.clears_in_s == null ? NaN : Number(f.clears_in_s);
  if (!Number.isFinite(base)) {
    const thr = Number(f.effective_threshold_s ?? V.status?.threshold_seconds);
    const heard = Number(f.listened_s ?? V.status?.current_listened);
    if (!Number.isFinite(thr) || !Number.isFinite(heard) || thr <= 0) return null;
    base = Math.max(0, thr - heard);
  }
  const add = m.playing ? store.sinceObserved() / 1000 : 0;
  return Math.max(0, base - add);
}

function focusKeyIn(el) {
  const a = document.activeElement;
  if (!a || !el.contains(a)) return null;
  if (a.dataset.now) return `now:${a.dataset.now}:${a.dataset.seq || a.dataset.delta || ''}`;
  if (a.id) return `id:${a.id}`;
  return null;
}

function restoreFocus(el, key) {
  if (!key) return;
  let target = null;
  if (key.startsWith('id:')) target = el.querySelector(`#${CSS.escape(key.slice(3))}`);
  else {
    const [, name, extra] = key.split(':');
    const sel = `[data-now="${CSS.escape(name)}"]`;
    target = (extra && el.querySelector(`${sel}[data-seq="${CSS.escape(extra)}"], ${sel}[data-delta="${CSS.escape(extra)}"]`)) || el.querySelector(sel);
  }
  // The control went away (e.g. Undo after undoing): keep focus inside the panel, not on <body>.
  if (!target || target.disabled) target = el.querySelector('[data-now]:not([aria-disabled="true"]):not([disabled]), a[href], button:not([disabled])');
  if (target) target.focus({ preventScroll: true });
}

/** Re-render a panel keeping keyboard focus on the equivalent control. */
function repaint(el, content) {
  if (!el) return;
  const key = focusKeyIn(el);
  mount(el, content);
  restoreFocus(el, key);
}

/** "15 min ago" / "3 hr ago": relTime that fits a small tile. */
function shortRel(ms) {
  return fmt.relTime(ms).replace(/ minutes?/, ' min').replace(/ hours?/, ' hr');
}

/** "3 days ago" / "7 weeks ago" / "5 months ago" / "2 years ago" (never a bare date). */
function agoText(ms) {
  const d = toDate(ms);
  if (!d) return '';
  const days = (Date.now() - d.getTime()) / 86400e3;
  if (days < 1) return fmt.relTime(d);
  if (days < 14) return fmt.plural(Math.round(days), 'day') + ' ago';
  if (days < 60) return fmt.plural(Math.round(days / 7), 'week') + ' ago';
  if (days < 730) return fmt.plural(Math.round(days / 30.44), 'month') + ' ago';
  return fmt.plural(Math.round(days / 365.25), 'year') + ' ago';
}

function relSpan(ms) {
  return html`<span data-rel="${ms}">${fmt.relTime(ms)}</span>`;
}

// ======================================================================= hero
function eqBars(playing) {
  return html`<span class="now-eq${playing ? ' is-playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

function ringMarkup(kind, frac, center) {
  const pct = Math.max(0, Math.min(1, num(frac))) * 100;
  return html`<div class="fate-ring" data-kind="${kind}" aria-hidden="true">
    <svg class="fate-ring-svg" viewBox="0 0 64 64" focusable="false">
      <circle class="fate-ring-track" cx="32" cy="32" r="27"/>
      <circle class="fate-ring-fill" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="${pct.toFixed(2)} 100" transform="rotate(-90 32 32)"${pct <= 0 ? raw(' visibility="hidden"') : ''}/>
    </svg>
    <span class="fate-ring-center">${center}</span>
  </div>`;
}

function clearedSub(e) {
  const when = relSpan(e.ts_ms);
  switch (e.reason) {
    case 'threshold': return html`After ${secs(e.listened_s)} of listening · ${when}`;
    case 'like': return html`You liked it, so it left the backlog · ${when}`;
    case 'routed': return html`Moved to another playlist · ${when}`;
    case 'catch-up': return html`Cleared because you'd already heard it · ${when}`;
    default: return html`You cleared it · ${when}`;
  }
}

function fateMarkup(m, s) {
  const f = m.fate;
  const pl = plName(m.playlistName);
  const thr = m.threshold;
  let ring;
  let title;
  let sub = '';
  let cta = '';
  switch (f.state) {
    case 'in_backlog':
      ring = ringMarkup('in_backlog', 0, html`<span class="fate-ring-num" data-fate-num></span>`);
      title = html`<span data-fate-title>Clears from ${pl} after ${secs(thr)} of listening</span>`;
      sub = html`Tracks are cleared after ${secs(thr)} of listening<span data-fate-heard></span>. Keep it to hear it again later.`;
      break;
    case 'cleared': {
      const e = m.entry;
      ring = ringMarkup('cleared', 1, icon('check'));
      title = html`Cleared from ${pl}`;
      sub = e ? clearedSub(e) : 'Removed from your backlog during this play.';
      if (undoable(e)) {
        cta = html`<button type="button" class="btn btn-secondary btn-sm" data-now="undo" data-seq="${e.seq}" aria-keyshortcuts="u" data-tip="${`Put it back in ${pl} (U). Undo works for 30 minutes.`}">${icon('undo')}Undo<kbd aria-hidden="true">U</kbd></button>`;
      }
      break;
    }
    case 'kept':
      ring = ringMarkup('kept', 1, icon('keep'));
      if (f.reason === 'auto_clean_resumed') {
        // The listener pressed Resume, not Keep: say why this play stays.
        title = 'Auto-clear is back on';
        sub = html`This play passed ${secs(thr)} while auto-clear was paused, so it stays in ${pl}. It can clear the next time it plays.`;
      } else if (f.reason === 'added_during_play') {
        title = 'Added to your backlog during this play';
        sub = "Only tracks already in the backlog when they start are cleared, so this one stays for now. It can clear the next time it plays.";
      } else {
        title = 'Keeping this one in your backlog';
        sub = "It won't be cleared during this play. It can still clear the next time it plays.";
      }
      cta = html`<button type="button" class="btn btn-secondary btn-sm" data-now="clear-anyway" data-tip="Remove it from your backlog now and keep listening">Clear anyway</button>`;
      break;
    case 'clearing_paused':
      ring = ringMarkup('paused', 0, icon('pauseCircle'));
      title = 'Auto-clear is paused';
      sub = html`This track stays in ${pl}. Turn auto-clear back on to clear tracks as you listen.`;
      cta = html`<button type="button" class="btn btn-secondary btn-sm" data-now="resume-auto">${icon('play')}Resume</button>`;
      break;
    case 'queued':
      ring = ringMarkup('queued', 1, icon('hourglass'));
      title = "Couldn't clear yet — Spotify is busy";
      sub = "The removal is saved and retried automatically. There's nothing you need to do.";
      break;
    case 'syncing': {
      const p = s?.backlog?.progress || {};
      const frac = num(p.total) ? num(p.loaded) / num(p.total) : 0;
      ring = ringMarkup('syncing', frac, icon('refresh'));
      title = html`Checking your backlog <span class="num" data-fate-sync>${syncCount(s)}</span>…`;
      sub = 'Nothing is cleared until this finishes.';
      break;
    }
    default:
      ring = ringMarkup('none', 0, icon('disc'));
      title = 'Not in your backlog — nothing will be cleared';
      sub = html`Only tracks in ${pl} are cleared as you listen.`;
  }
  return html`<div class="now-fate" data-state="${f.state}">
    ${ring}
    <div class="fate-text"><p class="fate-title">${title}</p><p class="fate-sub">${sub}</p></div>
    ${cta ? html`<div class="fate-cta">${cta}</div>` : ''}
  </div>
  <p class="sr-only" aria-live="polite" data-fate-live></p>`;
}

function syncCount(s) {
  const p = s?.backlog?.progress || {};
  return num(p.total) ? `(${fmt.num(p.loaded)} / ${fmt.num(p.total)})` : '';
}

function actionsMarkup(m) {
  const st = m.fate.state;
  const kept = st === 'kept';
  const keepOn = kept || st === 'in_backlog';
  const clearOn = m.inBacklog;
  const pl = plName(m.playlistName);
  // Already liked + in the backlog: the button only clears, so it must not promise a like.
  const likeLabel = m.inBacklog ? (m.liked ? 'Liked · Clear' : 'Like & clear') : m.liked ? 'Liked' : 'Like';
  const likeTip = m.inBacklog
    ? (m.liked ? `Already in your Liked Songs: this clears it from ${pl} (L)` : `Save to Liked Songs and clear it from ${pl} (L)`)
    : m.liked ? 'Already in your Liked Songs' : 'Save to your Liked Songs (L)';
  const keepTip = kept
    ? 'Kept for this play. Press again to let it clear as usual (K)'
    : st === 'in_backlog' ? "Don't auto-clear it during this play (K)"
      : st === 'syncing' ? 'Available once your backlog has loaded' : 'Only tracks in your backlog can be kept';
  const clearTip = clearOn
    ? `Remove it from ${pl} now and skip to the next track (C)`
    : st === 'syncing' ? 'Available once your backlog has loaded' : st === 'cleared' ? 'Already cleared' : 'This track is not in your backlog';
  let note;
  if (m.inBacklog && m.liked) note = html`It's already in your Liked Songs. <strong>Liked · Clear</strong> only removes it from your backlog; <strong>Clear now</strong> also plays the next track.`;
  else if (m.inBacklog) note = html`<strong>Like</strong> saves it to Liked Songs and clears it from your backlog. <strong>Clear now</strong> removes it and plays the next track.`;
  else if (st === 'syncing') note = 'Keep and Clear now work once your backlog has finished loading.';
  else note = m.liked ? 'This track is in your Liked Songs.' : html`<strong>Like</strong> saves it to your Liked Songs.`;
  const dis = (on) => (on ? '' : raw(' aria-disabled="true"'));
  return html`<div class="now-actions" role="group" aria-label="Actions for this track">
      <button type="button" class="btn ${m.liked && !m.inBacklog ? 'btn-secondary is-liked' : 'btn-primary'} now-act" data-now="like" data-tip="${likeTip}" aria-keyshortcuts="l">${icon(m.liked ? 'heartFilled' : 'heart')}<span>${likeLabel}</span><kbd aria-hidden="true">L</kbd></button>
      <button type="button" class="btn btn-secondary now-act" data-now="keep" aria-pressed="${kept ? 'true' : 'false'}" data-tip="${keepTip}" aria-keyshortcuts="k"${dis(keepOn)}>${icon('keep')}<span>${kept ? 'Kept' : 'Keep in backlog'}</span><kbd aria-hidden="true">K</kbd></button>
      <button type="button" class="btn btn-secondary now-act" data-now="clear" data-tip="${clearTip}" aria-keyshortcuts="c"${dis(clearOn)}>${icon('clear')}<span>Clear now</span><kbd aria-hidden="true">C</kbd></button>
      <button type="button" class="btn btn-ghost now-act" data-now="next" data-tip="Skip to the next track (N)" aria-keyshortcuts="n">${icon('next')}<span>Next</span></button>
      <button type="button" class="btn btn-icon now-more" data-now="more" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for this track" data-tip="More">${icon('more')}</button>
    </div>
    <p class="now-actions-note">${note}</p>`;
}

function noticeMarkup(s) {
  const ss = s?.spotify_status;
  if (!ss || !['rate_limited', 'app_not_registered'].includes(ss.state)) return '';
  const until = ss.until_ms ? timeOfDay(ss.until_ms) : '';
  const text = ss.state === 'rate_limited'
    ? `Spotify asked the app to pause${until ? ` until ${until}` : ''}. What's playing and auto-clear may lag until then; your history and insights still work.`
    : ss.message || 'Spotify rejected this account for the app.';
  return notice({ tone: 'warning', icon: 'hourglass', compact: true, role: 'note', className: 'now-notice', body: text });
}

function idleMarkup(m, s) {
  if (m.signedOut) {
    return html`<div class="now-hero-top">
      <div class="now-art-wrap"><span class="thumb now-art thumb-ph" aria-hidden="true">${icon('music')}</span></div>
      <div class="now-hero-body">
        <h1 class="now-title" id="now-title" tabindex="-1">Spotify isn't connected</h1>
        <p class="now-idle-sub">Connect Spotify to see what's playing and clear your backlog as you listen. Your history, insights and artist pages work without it.</p>
        <div class="now-idle-actions"><a class="btn btn-primary btn-lg" href="/login">Connect Spotify</a></div>
      </div>
    </div>`;
  }
  const b = s?.backlog || {};
  const total = isNum(b.total) ? Number(b.total) : null;
  const thr = num(s?.threshold_seconds);
  const hasBacklog = !!(b.playlist_id || s?.playlist_name);
  const autoOff = s?.auto_clean?.enabled === false;
  return html`<div class="now-hero-top">
      <div class="now-art-wrap"><span class="thumb now-art thumb-ph" aria-hidden="true">${icon('music')}</span></div>
      <div class="now-hero-body">
        <h1 class="now-title" id="now-title" tabindex="-1">Nothing playing</h1>
        <p class="now-idle-sub">${hasBacklog ? 'Start your backlog from here, or play' : 'Play'} anything in Spotify on your phone, computer or speaker. It shows up here within a few seconds.</p>
        ${hasBacklog ? html`<div class="now-idle-actions">
          <button type="button" class="btn btn-primary btn-lg" data-now="play-backlog">${icon('play')}Play your backlog</button>
          <button type="button" class="btn btn-secondary btn-lg" data-now="shuffle-backlog">${icon('shuffle')}Shuffle</button>
        </div>
        <p class="now-idle-note">${total != null ? `${fmt.plural(total, 'track')} in ${plName(m.playlistName)}` : plName(m.playlistName)}${autoOff ? ' · auto-clear is paused' : thr ? ` · each clears after ${secs(thr)} of listening` : ''}</p>`
          : html`<div class="now-idle-actions"><a class="btn btn-secondary" href="#/settings?section=backlog">${icon('backlog')}Choose a backlog playlist</a></div>`}
      </div>
    </div>`;
}

function heroMarkup() {
  const s = V.status;
  const m = V.model;
  if (!s) {
    return html`<div class="now-hero-top">
      <div class="now-art-wrap"><span class="thumb now-art skeleton" aria-hidden="true"></span></div>
      <div class="now-hero-body">
        <p class="now-eyebrow">Now playing</p>
        <h1 class="now-title" id="now-title" tabindex="-1">Connecting…</h1>
        <p class="now-idle-sub">Checking what's playing on Spotify.</p>
      </div>
    </div>`;
  }
  if (!m.t) return html`${idleMarkup(m, s)}${noticeMarkup(s)}`;
  const t = m.t;
  const chips = [];
  if (m.inBacklog) chips.push(html`<span class="chip chip-outline" data-tip="${`In ${plName(m.playlistName)}`}">${icon('backlog')}In backlog</span>`);
  if (m.liked) chips.push(html`<span class="chip chip-accent">${icon('heartFilled')}Liked</span>`);
  if (m.fate.state === 'kept') chips.push(html`<span class="chip now-chip-kept">${icon('keep')}Kept</span>`);
  return html`<div class="now-hero-top">
      <div class="now-art-wrap">${thumb(t.image, { className: 'now-art', alt: '' })}</div>
      <div class="now-hero-body">
        <p class="now-eyebrow">${eqBars(m.playing)}<span>${m.playing ? 'Now playing' : 'Paused'}</span></p>
        <h1 class="now-title" id="now-title" tabindex="-1">${t.name || 'Unknown track'}</h1>
        <p class="now-artists">${artistLinks(t.artist_list?.length ? t.artist_list : t.artists, { max: 6 })}</p>
        ${t.album ? html`<p class="now-album"><span class="sr-only">Album: </span>${t.album}</p>` : ''}
        ${chips.length ? html`<div class="now-chips">${chips}</div>` : ''}
      </div>
    </div>
    ${fateMarkup(m, s)}
    ${actionsMarkup(m)}
    ${noticeMarkup(s)}`;
}

function heroSignature() {
  const s = V.status;
  const m = V.model;
  if (!s) return 'none';
  const t = m.t;
  const ss = s.spotify_status || {};
  return JSON.stringify([
    t?.id, t?.name, t?.image, t?.album, (t?.artist_list || []).map((a) => a?.name), t?.artists,
    m.playing, m.liked, m.fate.state, m.inBacklog, m.playlistName, m.signedOut, m.threshold,
    m.entry ? [m.entry.seq, m.entry.reason, undoable(m.entry)] : null,
    ['rate_limited', 'app_not_registered'].includes(ss.state) ? [ss.state, ss.until_ms] : null,
    t ? null : [s.backlog?.total, s.backlog?.playlist_id, s.auto_clean?.enabled],
  ]);
}

const FATE_LIVE = {
  in_backlog: 'In your backlog. It clears after the listen threshold.',
  cleared: 'Cleared from your backlog.',
  kept: 'Kept in your backlog for this play.',
  clearing_paused: 'Auto-clear is paused.',
  queued: "Couldn't clear yet; retrying automatically.",
  syncing: 'Checking your backlog.',
  not_in_backlog: 'Not in your backlog.',
};

function renderHero() {
  const el = V.refs.hero;
  const sig = heroSignature();
  if (sig === V.sig.hero) { updateHeroLive(); return; }
  const prevFate = V.lastFateState;
  V.sig.hero = sig;
  repaint(el, heroMarkup());
  el.dataset.state = V.model?.t ? V.model.fate.state : 'idle';
  V.heroRefs = {
    ringFill: el.querySelector('.fate-ring-fill'),
    num: el.querySelector('[data-fate-num]'),
    title: el.querySelector('[data-fate-title]'),
    heard: el.querySelector('[data-fate-heard]'),
    sync: el.querySelector('[data-fate-sync]'),
    live: el.querySelector('[data-fate-live]'),
    key: '',
  };
  const state = V.model?.t ? V.model.fate.state : 'idle';
  // Announce fate changes for the same track only (a new track is announced by its title).
  if (V.heroRefs.live && prevFate && prevFate.trackId === V.model?.t?.id && prevFate.state !== state && FATE_LIVE[state]) {
    V.heroRefs.live.textContent = FATE_LIVE[state];
  }
  V.lastFateState = { trackId: V.model?.t?.id || null, state };
  applyTint(V.model?.t?.image || null);
  updateHeroLive();
}

function updateHeroLive() {
  const r = V.heroRefs;
  if (!r) return;
  if (r.sync) {
    const txt = syncCount(V.status);
    if (r.sync.textContent !== txt) r.sync.textContent = txt;
  }
  tickFate();
}

function tickFate() {
  const r = V.heroRefs;
  const m = V.model;
  if (!r || !m?.t || m.fate.state !== 'in_backlog') return;
  const thr = m.threshold;
  const rem = remainingS();
  const pl = plName(m.playlistName);
  if (rem == null || !thr) {
    const key = 'unknown';
    if (r.key !== key) {
      r.key = key;
      if (r.title) r.title.textContent = `Clears from ${pl} once you've listened for ${secs(thr)}`;
      if (r.num) r.num.textContent = '';
      if (r.heard) r.heard.textContent = '';
    }
    return;
  }
  const heard = Math.max(0, Math.min(thr, thr - rem));
  const frac = thr ? heard / thr : 0;
  if (r.ringFill) {
    r.ringFill.setAttribute('stroke-dasharray', `${(frac * 100).toFixed(2)} 100`);
    if (frac > 0) r.ringFill.removeAttribute('visibility'); else r.ringFill.setAttribute('visibility', 'hidden');
  }
  const whole = Math.ceil(rem);
  const key = `${whole}|${m.playing}`;
  if (r.key === key) return;
  r.key = key;
  if (r.num) {
    if (whole > 0) {
      const small = document.createElement('small');
      small.textContent = 's';
      r.num.replaceChildren(document.createTextNode(String(whole)), small);
    } else {
      r.num.textContent = '…';
    }
  }
  if (r.heard) r.heard.textContent = heard >= 1 ? ` · you've heard ${secs(Math.floor(heard))}` : '';
  if (!r.title) return;
  if (whole > 0) {
    const strong = document.createElement('strong');
    strong.textContent = secs(whole);
    r.title.replaceChildren(
      document.createTextNode(m.playing ? `Clears from ${pl} in ` : `Clears from ${pl} after `),
      strong,
      document.createTextNode(m.playing ? '' : ' more listening'),
    );
  } else {
    r.title.textContent = m.playing ? `Clearing from ${pl} now…` : `Clears from ${pl} when playback resumes`;
  }
}

// Album-art tint for the hero background (Spotify-style). The CDN sends CORS headers, so the
// cover can be sampled on a canvas; any failure just leaves the neutral surface.
function applyTint(url) {
  const el = V.refs.hero;
  const set = (rgb) => {
    if (!V || V.refs.hero !== el) return;
    if (rgb) el.style.setProperty('--now-tint', `rgb(${rgb})`);
    else el.style.removeProperty('--now-tint');
    el.classList.toggle('has-tint', !!rgb);
  };
  if (!url || !/^https:\/\//i.test(url)) { set(null); return; }
  if (cache.tints.has(url)) { set(cache.tints.get(url)); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => {
    let rgb = null;
    try {
      const c = document.createElement('canvas');
      c.width = 24; c.height = 24;
      const ctx2 = c.getContext('2d', { willReadFrequently: true });
      ctx2.drawImage(img, 0, 0, 24, 24);
      const d = ctx2.getImageData(0, 0, 24, 24).data;
      let r = 0; let g = 0; let b = 0; let w = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const weight = 1 + ((mx - mn) / 255) * 4;   // favour colourful pixels over grey/black
        r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; w += weight;
      }
      r /= w; g /= w; b /= w;
      // Clamp brightness so white text keeps its contrast on the tinted surface.
      const peak = Math.max(r, g, b, 1);
      const scale = Math.min(1, 150 / peak);
      rgb = [r, g, b].map((v) => Math.round(v * scale)).join(',');
    } catch { rgb = null; }
    cache.tints.set(url, rgb);
    if (V && V.model?.t?.image === url) set(rgb);
  };
  img.onerror = () => { cache.tints.set(url, null); };
  img.src = url;
}

// ======================================================================= hero actions
function currentTrack() {
  return V?.model?.t || null;
}

async function clearAnyway(btn) {
  const t = currentTrack();
  if (!t) return;
  await withBusy(btn, async () => {
    try {
      const r = await api.post('/api/v2/backlog/clear', { track_id: t.id, skip: false });
      if (r?.cleared) {
        player.markSeen(r.cleared.seq);
        player.announceCleared(r.cleared);
      }
      store.refreshSoon(300);
    } catch (err) {
      if (isAbort(err)) return;
      if (err.status === 409 && err.code === 'track_changed') toast('The track changed before that went through, so nothing was cleared.', { kind: 'warning' });
      else toast(err.message || "Couldn't clear this track.", { kind: err.status === 409 || err.status === 503 ? 'warning' : 'error' });
    }
  });
}

async function setAutoClean(enabled, btn) {
  const prev = V.status?.auto_clean?.enabled !== false;
  store.patch({ auto_clean: { enabled } });
  const run = async () => {
    try {
      const r = await api.post('/api/v2/backlog/auto-clean', { enabled });
      const on = typeof r?.enabled === 'boolean' ? r.enabled : enabled;
      store.patch({ auto_clean: { enabled: on } });
      const thr = num(V?.status?.threshold_seconds);
      if (on) toast(`Auto-clear is on. Backlog tracks clear after ${secs(thr)} of listening.`, { kind: 'success', icon: 'checkCircle', key: 'auto-clean' });
      else {
        toast('Auto-clear is paused. Tracks stay in your backlog while you listen.', {
          kind: 'info', icon: 'pauseCircle', key: 'auto-clean',
          action: { label: 'Turn on', onClick: () => setAutoClean(true) },
        });
      }
      store.refreshSoon(400);
    } catch (err) {
      if (isAbort(err)) return;
      store.patch({ auto_clean: { enabled: prev } });
      toast(err.message || "Couldn't change auto-clear.", { kind: 'error' });
    }
  };
  if (btn) await withBusy(btn, run); else await run();
}

async function playBacklog(shuffle, btn) {
  await withBusy(btn, async () => {
    try {
      const r = await api.post('/api/v2/backlog/play', { shuffle }, { timeoutMs: 20000 });
      const name = r?.name || V?.model?.playlistName || '';
      toast(html`Playing ${plName(name)}${shuffle ? ' on shuffle' : ''}`, { kind: 'success', icon: 'play', timeoutMs: 3500 });
      store.refreshSoon(600);
      store.refreshSoon(2000);
    } catch (err) {
      if (isAbort(err)) return;
      const soft = err.status === 409 || err.status === 503 || err.isRateLimited;
      toast(err.message || "Couldn't start playback.", { kind: soft ? 'warning' : 'error' });
    }
  });
}

function openMore(btn) {
  const t = currentTrack();
  if (!t) return;
  const artist = primaryArtist(t);
  const url = /^https:\/\/open\.spotify\.com\//i.test(String(t.url || '')) ? t.url : '';
  const items = [
    { label: 'Add to playlist…', icon: 'listPlus', onSelect: () => player.openAddToPlaylist() },
    { label: 'Save to watchlist…', icon: 'bookmark', onSelect: () => saveTrackToWatchlist(t) },
  ];
  if (artist) items.push({ label: `Open ${artist}`, icon: 'artists', href: artistHref(artist) });
  if (url) {
    items.push({ separator: true });
    items.push({ label: 'Open in Spotify', icon: 'external', href: url, external: true });
    items.push({
      label: 'Copy Spotify link',
      icon: 'link',
      onSelect: async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copied.', { kind: 'success', icon: 'link', timeoutMs: 2500 });
        } catch {
          toast("Couldn't copy the link. Your browser blocked the clipboard.", { kind: 'warning' });
        }
      },
    });
  }
  menu(btn, items, { placement: 'bottom-end', label: 'More actions' });
}

function onHeroAction(name, el) {
  const m = V.model;
  const disabled = el.getAttribute('aria-disabled') === 'true';
  switch (name) {
    case 'like': return withBusy(el, () => player.like());
    case 'keep':
      if (disabled) {
        toast(m?.fate.state === 'syncing' ? 'Keep works once your backlog has finished loading.' : 'Only tracks in your backlog can be kept.', { kind: 'info' });
        return undefined;
      }
      return withBusy(el, () => player.keep());
    case 'clear':
      if (disabled) {
        toast(m?.fate.state === 'syncing' ? 'Clear now works once your backlog has finished loading.' : m?.fate.state === 'cleared' ? 'This track is already cleared.' : 'This track is not in your backlog.', { kind: 'info' });
        return undefined;
      }
      return withBusy(el, () => player.clearNow());
    case 'next': return withBusy(el, () => player.next());
    case 'more': openMore(el); return undefined;
    case 'undo': return withBusy(el, () => player.undo(Number(el.dataset.seq)));
    case 'clear-anyway': return clearAnyway(el);
    case 'resume-auto': return setAutoClean(true, el);
    case 'play-backlog': return playBacklog(false, el);
    case 'shuffle-backlog': return playBacklog(true, el);
    default: return undefined;
  }
}

// ======================================================================= lyrics
function lyricsState() {
  const s = V.status;
  const t = V.model?.t;
  const L = s?.current_lyrics;
  if (!s) return { kind: 'loading' };
  if (!t) return { kind: 'none' };
  if (!L || typeof L !== 'object') return { kind: V.waitedOut.lyrics === t.id ? 'unavailable' : 'loading' };
  if (L.demo) return { kind: 'demo' };   // the static web demo has no lyrics service
  if (!L.found) return { kind: L.error ? 'error' : 'missing' };
  if (L.synced && Array.isArray(L.lines) && L.lines.length) return { kind: 'synced', lines: L.lines, source: L.source };
  if (L.plain) return { kind: 'plain', text: String(L.plain), source: L.source };
  return { kind: 'missing' };
}

function offsetLabel(ms) {
  const v = Math.round(num(ms) / 100) / 10;
  if (!v) return '0.0 s';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} s`;
}

function lyricsMarkup(ls) {
  const open = V.lyricsOpen;
  let body;
  let chip = '';
  let controls = '';
  // Non-lyric states are one quiet line: an empty lyrics card shouldn't push the page down.
  const note = (iconName, title, text) => html`<p class="lyr-note">${iconName === 'spinner' ? html`<span class="spinner spinner-sm" aria-hidden="true"></span>` : icon(iconName)}<span><strong>${title}</strong> ${text}</span></p>`;
  switch (ls.kind) {
    case 'none':
      body = note('music', 'Nothing playing.', 'Lyrics show up here while a track plays.');
      break;
    case 'loading':
      body = html`<div role="status">${note('spinner', 'Looking for lyrics…', '')}</div>`;
      break;
    case 'unavailable':
      body = note('music', "Lyrics aren't available right now.", 'They usually appear a few seconds after a track starts.');
      break;
    case 'error':
      body = note('wifiOff', "Couldn't reach the lyrics service.", "Lyrics come from LRCLIB, which didn't answer. The next track will try again.");
      break;
    case 'missing':
      body = note('music', 'No lyrics found.', "LRCLIB doesn't have lyrics for this track — common for instrumentals and very new releases.");
      break;
    case 'demo':
      body = note('music', 'Lyrics aren’t part of the demo.', 'They come from LRCLIB, which the demo doesn’t call. In the app, synced lyrics scroll along with the song here.');
      break;
    case 'synced': {
      chip = html`<span class="chip lyr-chip">Synced</span>`;
      const off = V.lyrOffset;
      controls = html`<div class="lyr-offset" role="group" aria-label="Lyrics timing">
        <span class="lyr-offset-label">Timing${infoTip(DEF.lyrics_timing, { label: 'Lyrics timing' })}</span>
        <button type="button" class="btn btn-icon btn-sm" data-now="lyr-offset" data-delta="-100" aria-label="Show lines 0.1 seconds later" data-tip="Lines 0.1 s later">${icon('minus')}</button>
        <output class="lyr-offset-val num" data-lyr-offset aria-live="polite">${offsetLabel(off)}</output>
        <button type="button" class="btn btn-icon btn-sm" data-now="lyr-offset" data-delta="100" aria-label="Show lines 0.1 seconds earlier" data-tip="Lines 0.1 s earlier">${icon('plus')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-now="lyr-offset" data-delta="reset"${off ? '' : raw(' aria-disabled="true"')}>Reset</button>
      </div>`;
      body = html`<div class="lyr-scroll" data-lyr-scroll tabindex="0" role="region" aria-label="Synced lyrics. The current line is highlighted; click a line to jump there.">
        <div class="lyr-pad" aria-hidden="true"></div>
        ${ls.lines.map((ln, i) => html`<p class="lyr-line" data-i="${i}" data-ts="${num(ln.ts_ms)}">${String(ln.text || '').trim() || '♪'}</p>`)}
        <div class="lyr-pad" aria-hidden="true"></div>
      </div>
      <p class="lyr-source">Lyrics from LRCLIB · click a line to jump to it</p>`;
      break;
    }
    case 'plain':
    default: {
      const paras = String(ls.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      chip = html`<span class="chip lyr-chip lyr-chip-plain">Not synced</span>`;
      body = html`<div class="lyr-scroll lyr-plain" tabindex="0" role="region" aria-label="Lyrics">
        ${paras.map((p) => html`<p>${p}</p>`)}
      </div>
      <p class="lyr-source">Lyrics from LRCLIB</p>`;
    }
  }
  return html`<div class="now-card-head lyr-head">
      <h2 class="card-title now-card-title" id="now-lyrics-h">
        <button type="button" class="lyr-toggle" data-now="lyrics-toggle" aria-expanded="${open ? 'true' : 'false'}" aria-controls="now-lyrics-body">
          <span>Lyrics</span>${icon(open ? 'chevronUp' : 'chevronDown', { className: 'lyr-chevron' })}
        </button>
      </h2>
      ${chip}
      <span class="spacer"></span>
      ${open ? controls : ''}
    </div>
    <div class="lyr-body" id="now-lyrics-body"${open ? '' : raw(' hidden')}>${body}</div>`;
}

function renderLyrics() {
  const ls = lyricsState();
  const L = V.status?.current_lyrics;
  const sig = JSON.stringify([V.model?.t?.id, ls.kind, L?.lines?.length || 0, (L?.plain || '').length, V.lyricsOpen]);
  if (sig === V.sig.lyrics) { updateOffsetLabel(); return; }
  V.sig.lyrics = sig;
  const el = V.refs.lyrics;
  // No lyrics card while nothing plays; the hero already says so.
  el.hidden = !!V.status && !V.model?.t;
  repaint(el, lyricsMarkup(ls));
  el.classList.toggle('is-collapsed', !V.lyricsOpen);
  const scroller = el.querySelector('[data-lyr-scroll]');
  V.lyr = { kind: ls.kind, lines: ls.lines || [], scroller, els: scroller ? [...scroller.querySelectorAll('.lyr-line')] : [], active: -1 };
  if (scroller) {
    const hold = () => { V.lyrUserUntil = Date.now() + 5000; };
    scroller.addEventListener('wheel', hold, { passive: true });
    scroller.addEventListener('touchmove', hold, { passive: true });
    scroller.addEventListener('keydown', (ev) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(ev.key)) hold(); });
    scroller.addEventListener('click', (ev) => {
      const line = ev.target instanceof Element ? ev.target.closest('.lyr-line') : null;
      if (line) seekToLine(line);
    });
  }
  tickLyrics(true);
}

function updateOffsetLabel() {
  const out = V.refs.lyrics?.querySelector('[data-lyr-offset]');
  if (out) {
    const txt = offsetLabel(V.lyrOffset);
    if (out.textContent !== txt) out.textContent = txt;
  }
  const reset = V.refs.lyrics?.querySelector('[data-now="lyr-offset"][data-delta="reset"]');
  if (reset) {
    if (V.lyrOffset) reset.removeAttribute('aria-disabled'); else reset.setAttribute('aria-disabled', 'true');
  }
}

function tickLyrics(force = false) {
  const lz = V.lyr;
  if (!lz || lz.kind !== 'synced' || !lz.els.length || !V.lyricsOpen) return;
  const pos = progressNow() + num(V.lyrOffset);
  // Binary search: last line whose timestamp has passed.
  let lo = 0; let hi = lz.lines.length - 1; let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (num(lz.lines[mid].ts_ms) <= pos) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx === lz.active && !force) return;
  const prev = lz.active;
  lz.els.forEach((p, i) => {
    if (prev === -1 || force || (i >= Math.min(prev, idx) && i <= Math.max(prev, idx))) {
      p.classList.toggle('is-past', i < idx);
      p.classList.toggle('is-active', i === idx);
      if (i === idx) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
    }
  });
  lz.active = idx;
  if (Date.now() < (V.lyrUserUntil || 0)) return;
  const sc = lz.scroller;
  const target = lz.els[Math.max(0, idx)];
  if (!sc || !target || sc.offsetParent === null) return;
  const top = target.offsetTop - sc.clientHeight / 2 + target.offsetHeight / 2;
  sc.scrollTo({ top: Math.max(0, top), behavior: force || reducedMotion() ? 'auto' : 'smooth' });
}

async function seekToLine(line) {
  const m = V.model;
  if (!m?.t || !m.duration) return;
  const target = Math.max(0, Math.min(m.duration - 1000, num(line.dataset.ts) - num(V.lyrOffset)));
  V.lyrUserUntil = 0;
  try {
    await api.post('/api/seek', { position_ms: Math.round(target) });
    store.patch({ progress_ms: Math.round(target) });
    store.refreshSoon(900);
  } catch (err) {
    if (!isAbort(err)) toast(err.message || "Couldn't jump to that line.", { kind: 'error' });
  }
}

// The value is captured when the button is pressed, so a save still lands (with the right value)
// if the view unmounts before the debounce fires.
const postOffset = debounce(async (value) => {
  try {
    const r = await api.post('/api/lyrics-offset', { offset_ms: value });
    // A newer press may have happened while this was in flight: its own save follows, so
    // don't let this older answer snap the value back.
    if (V && Math.round(V.lyrOffset) === value) {
      V.lyrOffsetPendingUntil = 0;
      store.patch({ lyrics_offset_ms: num(r?.lyrics_offset_ms ?? value) });
    }
  } catch (err) {
    if (!V || Math.round(V.lyrOffset) !== value) return;
    V.lyrOffsetPendingUntil = 0;
    V.lyrOffset = num(V.status?.lyrics_offset_ms);
    updateOffsetLabel();
    if (!isAbort(err)) toast(err.message || "Couldn't save the lyrics timing.", { kind: 'error' });
  }
}, 450);

function changeOffset(delta) {
  if (delta === 'reset') V.lyrOffset = 0;
  else V.lyrOffset = Math.max(-10000, Math.min(10000, num(V.lyrOffset) + Number(delta)));
  V.lyrOffsetPendingUntil = Date.now() + 5000;
  updateOffsetLabel();
  tickLyrics(true);
  postOffset(Math.round(V.lyrOffset));
}

function toggleLyrics() {
  V.lyricsOpen = !V.lyricsOpen;
  storageSet(LYRICS_KEY, V.lyricsOpen ? '1' : '0');
  renderLyrics();
  V.refs.lyrics.querySelector('[data-now="lyrics-toggle"]')?.focus({ preventScroll: true });
}

// ======================================================================= artist snapshot
function artistInfoFor(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  const info = V.status?.current_artist_info;
  if (info && typeof info === 'object' && String(info.name || '').trim().toLowerCase() === key) {
    V.lastInfo = { key, info };
    return info;
  }
  // Enrichment resets on every track change; keep showing what we had for the same artist.
  return V.lastInfo && V.lastInfo.key === key ? V.lastInfo.info : null;
}

function cleanBio(text) {
  let s = String(text || '').replace(/<a\b[^>]*>.*?<\/a>/gi, '').replace(/<[^>]+>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  s = s.replace(/\s*Read more on Last\.fm\.?\s*$/i, '').replace(/\s+/g, ' ').trim();
  return s;
}

function excerpt(text, max = 300) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > max * 0.55) return cut.slice(0, stop + 1);
  const word = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max);
  return `${word.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

function avatar(name, image, size = 40) {
  if (image && /^https:\/\//i.test(image)) return thumb(image, { round: true, size, alt: '' });
  return initialsAvatar(name, { size, className: 'now-avatar' });
}

function fact(label, value, sub, info) {
  return html`<div class="now-fact">
    <dt class="now-fact-label"><span>${label}</span>${info ? infoTip(info, { label }) : ''}</dt>
    <dd class="now-fact-value">${value}</dd>
    ${sub ? html`<dd class="now-fact-sub">${sub}</dd>` : ''}
  </div>`;
}

function artistMarkup() {
  const t = V.model?.t;
  if (!V.status) {
    return html`<div class="now-card-head"><div><h2 class="card-title" id="now-artist-h">You and this artist</h2></div></div>
      <div class="art-loading" aria-busy="true"><span class="skeleton now-skel now-skel-line"></span><span class="skeleton now-skel now-skel-line short"></span></div>`;
  }
  if (!t) {
    // Nothing playing: the artist panel becomes "jump back in" with this week's favourites.
    const top = (Array.isArray(V.status?.weekly_top) ? V.status.weekly_top : []).filter((x) => x && x.name).slice(0, 6);
    return html`<div class="now-card-head"><div><h2 class="card-title" id="now-artist-h">Your top tracks, last 7 days</h2>
      <p class="card-desc">From your Last.fm scrobbles. Press play to jump back in.</p></div>
      <a class="btn btn-ghost btn-sm" href="#/insights?period=week">Your week${icon('chevronRight')}</a></div>
      <div class="list week-top" role="list">${top.map((x, i) => trackRow({
        // Last.fm gives one artist string per track ("Tyler, The Creator" must not be split).
        rank: i + 1, name: x.name, artist: String(x.artists || ''),
        uri: x.id ? `spotify:track:${x.id}` : undefined, meta: fmt.plural(num(x.playcount), 'play'),
      }))}</div>`;
  }
  const name = primaryArtist(t);
  const A = V.art;
  const info = artistInfoFor(name);
  const st = A.name === name ? A.stats : null;
  const head = html`<div class="now-card-head">
      <div class="art-head">
        ${avatar(name, info?.artist_image, 44)}
        <div class="art-head-text"><h2 class="card-title" id="now-artist-h">You and ${name}</h2>
        <p class="card-desc">Across your Last.fm history and this app.</p></div>
      </div>
      <a class="btn btn-secondary btn-sm" href="${artistHref(name)}">Open artist page${icon('chevronRight')}</a>
    </div>`;

  let facts;
  if (A.name === name && A.error) {
    facts = errorState(A.error, { title: "Couldn't load your history with this artist", compact: true, retry: () => loadArtist(name, { force: true }) });
  } else if (!st) {
    facts = html`<dl class="now-facts is-loading" aria-busy="true">
      ${['Your plays', 'Rank', 'First heard', 'Last heard'].map((l) => fact(l, html`<span class="skeleton now-skel"></span>`))}</dl>`;
  } else if (!st.found || !num(st.plays)) {
    facts = html`<div class="art-new">
      <span class="chip chip-accent">${icon('sparkle')}New to you</span>
      <p>You haven't played ${name} before — not in your Last.fm history or in this app. This play will be the first.</p>
    </div>`;
  } else {
    const first = st.first_ts;
    const firstSub = st.first_is_history_start ? 'Your history starts here, so maybe earlier' : agoText(first);
    // The ledger records a play once it's done, so while this track plays "last heard" is usually
    // an earlier play: say so instead of implying the artist hasn't been heard since.
    const playStart = Date.now() - progressNow();
    const lastBefore = num(st.last_ts) < playStart - 30e3;
    const recent = Date.now() - num(st.last_ts) < 20 * 3600e3;
    const lastMain = recent ? shortRel(st.last_ts) : fmt.date(st.last_ts, { year: 'always' });
    const lastSub = [recent ? '' : agoText(st.last_ts), lastBefore ? 'before this play' : ''].filter(Boolean).join(' · ');
    facts = html`<dl class="now-facts">
      ${fact('Your plays', fmt.num(st.plays), isNum(st.share_pct) ? `${fmt.pct(st.share_pct, { digits: st.share_pct < 1 ? 2 : 1 })} of all your plays` : '', DEF.artist_plays)}
      ${fact('Rank', st.rank ? `#${fmt.num(st.rank)}` : '—', st.total_artists ? `of ${fmt.num(st.total_artists)} artists` : '', DEF.artist_rank)}
      ${fact('First heard', fmt.date(first, { year: 'always' }), firstSub, DEF.artist_first)}
      ${fact('Last heard', lastMain, lastSub, DEF.artist_last)}
    </dl>
    <div class="art-trend" data-art-spark></div>`;
  }

  let details;
  if (info) {
    const bio = cleanBio(info.bio);
    const tags = (Array.isArray(info.lastfm_tags) ? info.lastfm_tags : []).filter(Boolean).slice(0, 5);
    const related = (Array.isArray(info.related) ? info.related : []).filter((r) => r && r.name).slice(0, 5);
    const showPlays = info.my_plays_available !== false;
    details = html`
      ${bio || tags.length ? html`<div class="art-about">
        ${bio ? html`<p class="art-bio">${excerpt(bio)} <a class="link-accent" href="${artistHref(name)}">Read more</a></p>` : ''}
        ${tags.length ? html`<ul class="art-tags" role="list" aria-label="Tags from Last.fm">${tags.map((tg) => html`<li class="chip">${tg}</li>`)}</ul>` : ''}
      </div>` : ''}
      ${related.length ? html`<div class="art-similar">
        <h3 class="now-subhead">Similar artists</h3>
        <ul class="sim-list" role="list">
          ${related.map((r) => {
            const mine = num(r.my_plays);
            return html`<li><a class="sim-item" href="${artistHref(r.name)}">
              ${avatar(r.name, r.image, 36)}
              <span class="sim-name truncate">${r.name}</span>
              ${showPlays ? (mine ? html`<span class="sim-plays">${fmt.plural(mine, 'play')}</span>` : html`<span class="sim-plays sim-new">New to you</span>`) : ''}
            </a></li>`;
          })}
        </ul>
      </div>` : ''}`;
    if (info.demo && !bio && !tags.length && !related.length) {
      details = html`<p class="art-note">${icon('info')}Bio, tags and similar artists come from Last.fm and aren't part of the demo.</p>`;
    }
  } else if (V.waitedOut.artist === name) {
    details = html`<p class="art-note">${icon('info')}Bio, tags and similar artists from Last.fm aren't available right now.</p>`;
  } else {
    details = html`<div class="art-loading" aria-busy="true"><span class="skeleton now-skel now-skel-line"></span><span class="skeleton now-skel now-skel-line short"></span><span class="sr-only">Loading details from Last.fm…</span></div>`;
  }
  return html`${head}${facts}${details}`;
}

function renderArtist() {
  const t = V.model?.t;
  const name = primaryArtist(t);
  const info = artistInfoFor(name);
  const A = V.art;
  const idleTop = !t && V.status ? (V.status.weekly_top || []).map((x) => [x?.name, x?.playcount]) : null;
  V.refs.artist.hidden = !!V.status && !t && !(idleTop && idleTop.length);
  const sig = JSON.stringify([
    idleTop, name, A.name === name ? [!!A.stats, A.error ? A.error.message : null, A.stats?.plays, A.stats?.last_ts] : null,
    info ? [info.bio ? info.bio.length : 0, (info.lastfm_tags || []).length, (info.related || []).map((r) => [r?.name, r?.my_plays]), info.artist_image] : null,
    V.waitedOut.artist === name,
  ]);
  if (sig === V.sig.artist) return;
  V.sig.artist = sig;
  destroyChart('artSpark');
  repaint(V.refs.artist, artistMarkup());
  const host = V.refs.artist.querySelector('[data-art-spark]');
  const st = A.name === name ? A.stats : null;
  if (host && st && Array.isArray(st.plays_by_month) && st.plays_by_month.length && V.ctx.charts?.sparkline) {
    const pts = st.plays_by_month.map((p) => ({ label: fmt.month(p.ym, { short: true }), value: num(p.plays) }));
    const fig = V.ctx.charts.sparkline(pts, {
      width: 'auto', height: 44, area: true, zero: true, valueLabel: 'plays',
      ariaLabel: `Your plays of ${name} per month, last 24 months`,
    });
    const cap = document.createElement('p');
    cap.className = 'art-trend-cap';
    const peak = pts.reduce((a, b) => (b.value > a.value ? b : a), pts[0]);
    cap.textContent = peak.value ? `Plays per month, last 24 months · busiest: ${peak.label} (${fmt.plural(peak.value, 'play')})` : 'No plays in the last 24 months';
    host.replaceChildren(fig, cap);
    V.charts.artSpark = fig;
  } else if (host) {
    host.remove();
  }
}

async function loadArtist(name, { force = false } = {}) {
  if (!name) return;
  const key = name.trim().toLowerCase();
  const hit = cache.artists.get(key);
  if (!force && hit && Date.now() - hit.at < ARTIST_TTL_MS) {
    V.art = { name, stats: hit.data };
    renderArtist();
    return;
  }
  V.art = { name, loading: true };
  renderArtist();
  const signal = V.signal;
  try {
    const d = await api.get(`/api/v2/artist/${encodeURIComponent(name)}/stats`, { signal, timeoutMs: 15000 });
    cache.artists.set(key, { at: Date.now(), data: d });
    if (cache.artists.size > 60) cache.artists.delete(cache.artists.keys().next().value);
    if (!V || V.art.name !== name) return;
    V.art = { name, stats: d };
  } catch (err) {
    if (isAbort(err) || !V || V.art.name !== name) return;
    V.art = { name, error: err };
  }
  renderArtist();
}

// ======================================================================= today
function renderToday() {
  const d = V.status?.today;
  const sig = JSON.stringify(d || null);
  if (sig === V.sig.today) return;
  V.sig.today = sig;
  const val = (v) => (isNum(v) ? fmt.num(v) : '—');
  const tiles = [
    { label: 'Plays', value: val(d?.plays_today), info: DEF.plays_today },
    { label: 'Cleared', value: val(d?.cleared_today), info: DEF.cleared_today, sub: isNum(d?.cleared_7d) ? `${fmt.num(d.cleared_7d)} in 7 days` : '' },
    { label: 'Heard in app', value: val(d?.heard_in_app), info: DEF.heard_in_app, sub: isNum(d?.heard_in_app_7d) ? `${fmt.num(d.heard_in_app_7d)} in 7 days` : '' },
    { label: 'Liked', value: val(d?.liked_today), info: DEF.liked_today },
  ];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  repaint(V.refs.today, html`<div class="today-head"><h2 class="today-title" id="now-today-h">Today</h2><span class="today-date">${today}</span></div>
    <dl class="today-grid">
      ${tiles.map((tile) => html`<div class="today-tile">
        <dt class="today-label"><span>${tile.label}</span>${infoTip(tile.info, { label: `${tile.label} today` })}</dt>
        <dd class="today-value">${tile.value}</dd>
        ${tile.sub ? html`<dd class="today-sub">${tile.sub}</dd>` : ''}
      </div>`)}
    </dl>`);
}

// ======================================================================= backlog card
function flowCell(label, value, tone, sr) {
  return html`<div class="bl-flow-cell">
    <dt>${label}</dt>
    <dd class="bl-flow-value ${tone}"><span class="sr-only">${sr} </span>${value}</dd>
  </div>`;
}

// Counts are plain numbers (as on Insights); only the net change carries a sign and a colour.
function flowCells(cleared, added, net) {
  const netTone = net > 0 ? 'delta-down' : net < 0 ? 'delta-up' : 'delta-flat';
  return html`
    ${flowCell('Cleared', fmt.num(cleared || 0), '', '')}
    ${flowCell('Added', fmt.num(added || 0), '', '')}
    ${flowCell('Net change', fmt.signed(net), netTone, net > 0 ? 'grew by' : net < 0 ? 'shrank by' : '')}`;
}

/**
 * "This week" for the backlog. Cleared is always exact for the window; added and net need the
 * backlog size on the window's first day, which only exists if the app was running then. When
 * it wasn't, the API leaves them empty and offers the closest measurable span ("measured"),
 * which is labelled with its own dates — never passed off as "this week".
 */
/** Clears that happened after the backlog numbers were fetched. Insights refetch at most every
 *  20 s, so without this "Last 7 days" lags the live Today card right after a clear. */
function clearsSinceInsights() {
  const since = num(V?.ins?.at);
  if (!since) return 0;
  const list = Array.isArray(V?.status?.recently_cleared) ? V.status.recently_cleared : [];
  return list.filter((e) => e && !e.undone && num(e.ts_ms) > since).length;
}

function windowMarkup(insData) {
  const extra = clearsSinceInsights();
  const bump = (x) => (x && extra ? { ...x, cleared: num(x.cleared) + extra, net: isNum(x.net) ? num(x.net) - extra : x.net } : x);
  const raw = insData?.windows?.last_7;
  const w = raw ? { ...bump(raw), measured: bump(raw.measured) } : raw;
  const ins = insData;
  if (!w) return '';
  const defs = ins.definitions || {};
  const days = num(w.days) || 7;
  const tip = [defs.windows, defs.inflow].filter(Boolean).join(' ') || 'Tracks cleared from and added to the backlog over this window.';
  const known = isNum(w.inflow) && isNum(w.net);
  // Older API shape: the window itself was silently widened to the last snapshot.
  const widened = known && w.exact === false && w.start_day && w.requested_start_day && w.start_day !== w.requested_start_day;
  const label = widened ? `Since ${fmt.date(w.start_day)}` : days === 7 ? 'Last 7 days' : `Last ${days} days`;
  const head = html`<div class="bl-window-head"><h3 class="now-subhead">${label}</h3>${infoTip(tip, { label })}</div>`;
  if (known) {
    return html`<div class="bl-window">${head}
      <dl class="bl-flow">${flowCells(num(w.cleared), num(w.inflow), num(w.net))}</dl>
      ${widened ? html`<p class="bl-window-note">No backlog size was recorded exactly a week ago, so this covers the ${fmt.plural(days, 'day')} since ${fmt.date(w.start_day, { year: 'always' })}.</p>` : ''}
    </div>`;
  }
  const mz = w.measured;
  const mKnown = mz && isNum(mz.inflow) && isNum(mz.net) && mz.start_day;
  return html`<div class="bl-window">${head}
    <dl class="bl-flow bl-flow-single">${flowCell('Cleared', fmt.num(num(w.cleared)), '', '')}</dl>
    <p class="bl-window-note">Added and net change for these ${fmt.plural(days, 'day')} aren't known: the app wasn't running on ${fmt.date(w.requested_start_day || w.start_day)} to record the backlog size.</p>
    ${mKnown ? html`<div class="bl-measured">
      <div class="bl-window-head"><h3 class="now-subhead">Since ${fmt.date(mz.start_day)}</h3><span class="bl-measured-days">${fmt.plural(num(mz.days), 'day')}</span></div>
      <dl class="bl-flow bl-flow-sm">${flowCells(num(mz.cleared), num(mz.inflow), num(mz.net))}</dl>
    </div>` : ''}
  </div>`;
}

function paceSentence(ins, total) {
  const p = ins?.pace;
  if (!p) return '';
  const net = num(p.net_per_week);
  const cleared = num(p.cleared_per_week);
  if (!num(total)) return 'Your backlog is empty. New tracks you add in Spotify will show up here.';
  if (!cleared && !num(p.inflow_per_week)) return 'No clearing recorded yet. Listen to tracks from your backlog and they clear as you go.';
  if (p.growing || net > 0) {
    const per = Math.max(1, Math.round(net));
    const need = p.needed_per_day_12w;
    return `Growing by about ${fmt.plural(per, 'track')} a week${isNum(need) ? ` — clear ${fmt.num(Math.ceil(num(need)))} a day to empty it in 12 weeks` : ''}.`;
  }
  if (p.empty_by_day) {
    const weeks = num(p.weeks_to_empty);
    return `At this pace it's empty by ${fmt.date(p.empty_by_day, { year: 'auto' })}${weeks ? ` (about ${fmt.plural(Math.round(weeks), 'week')})` : ''}.`;
  }
  return `Holding steady: about ${fmt.plural(Math.round(cleared), 'track')} cleared a week, as many as arrive.`;
}

function trajectoryPoints(ins) {
  const tr = Array.isArray(ins?.trajectory) ? ins.trajectory.filter((p) => p && p.day && isNum(p.total)) : [];
  if (tr.length < 2) return [];
  // Daily points from the first snapshot to the last. Days the app wasn't running have no
  // snapshot: they carry the last known size forward and say so in the tooltip.
  const byDay = new Map(tr.map((p) => [p.day, num(p.total)]));
  const start = toDate(tr[0].day);
  const end = toDate(tr[tr.length - 1].day);
  const out = [];
  let last = num(tr[0].total);
  for (let d = new Date(start); d <= end && out.length < 800; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const known = byDay.has(key);
    if (known) last = byDay.get(key);
    out.push({ label: known ? fmt.date(key, { year: 'always' }) : `${fmt.date(key, { year: 'always' })} (not recorded; last known size)`, value: last });
  }
  return out;
}

function syncLineMarkup(s) {
  const b = s?.backlog;
  if (!b) return '';
  const pending = num(b.pending_removals);
  const pendingTxt = pending ? ` · ${fmt.plural(pending, 'clear')} waiting for Spotify` : '';
  if (b.error) return html`<span class="bl-sync-icon is-warn">${icon('alert')}</span><span>Couldn't check the playlist with Spotify, so this is the last known list${pendingTxt}.</span>`;
  if (b.loading || b.complete === false) {
    const p = b.progress || {};
    return html`<span class="spinner spinner-sm" aria-hidden="true"></span><span>Loading your backlog… ${num(p.total) ? `${fmt.num(p.loaded)} of ${fmt.num(p.total)}` : ''}</span>`;
  }
  const at = b.synced_at_ms || b.checked_at_ms;
  return html`<span class="bl-sync-icon is-ok">${icon('checkCircle')}</span><span>Up to date${at ? html` · checked ${relSpan(at)}` : ''}${pendingTxt}</span>`;
}

function ruleText(thr, enabled) {
  return enabled
    ? `Tracks are cleared after ${secs(thr)} of listening.`
    : 'Auto-clear is off: nothing is removed while you listen. Clear now and Like still work.';
}

function backlogMarkup() {
  const s = V.status;
  const b = s?.backlog || {};
  const I = V.ins;
  const ins = I.data;
  const total = isNum(b.total) ? Number(b.total) : ins?.current_total;
  const enabled = s?.auto_clean?.enabled !== false;
  const thr = Math.round(num(s?.threshold_seconds) || 15);
  // While the user is mid-change (not saved yet) a repaint keeps their value, not the server's.
  const sliderVal = Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, V.thrDirty && V.thrValue != null ? V.thrValue : thr));
  const defs = ins?.definitions || {};
  let insightsPart;
  if (ins) {
    const pts = trajectoryPoints(ins);
    insightsPart = html`
      ${windowMarkup(ins)}
      <p class="bl-pace">${paceSentence(ins, total)}${defs.pace ? infoTip(`${defs.pace}${ins.pace?.basis_days ? ` Based on the last ${ins.pace.basis_days} days.` : ''}`, { label: 'Pace' }) : ''}</p>
      ${pts.length ? html`<div class="bl-trend"><div data-bl-spark></div><p class="bl-trend-cap">Backlog size since ${fmt.date(ins.trajectory[0].day, { year: 'always' })}</p></div>` : ''}`;
  } else if (I.error) {
    insightsPart = errorState(I.error, { title: "Couldn't load this week's numbers", compact: true, retry: () => loadInsights({ force: true }) });
  } else {
    insightsPart = html`<div class="bl-window is-loading" aria-busy="true"><span class="skeleton now-skel now-skel-line"></span><span class="skeleton now-skel now-skel-line short"></span><span class="sr-only">Loading this week's numbers…</span></div>`;
  }
  const hasBacklog = !!(b.playlist_id || s?.playlist_name);
  if (s && !hasBacklog) {
    return html`<div class="now-card-head"><div><h2 class="card-title" id="now-backlog-h">Your backlog</h2></div></div>
      ${emptyState({ icon: 'backlog', title: 'No backlog playlist yet', body: 'Pick the "to listen" playlist in Settings. Its tracks clear automatically once you have heard them.', action: { label: 'Choose a playlist', href: '#/settings?section=backlog' }, compact: true })}`;
  }
  return html`<div class="now-card-head">
      <div class="bl-head-text"><h2 class="card-title" id="now-backlog-h">Your backlog</h2>
        <p class="card-desc truncate" data-bl-name>${b.name || s?.playlist_name || ''}</p></div>
      <a class="btn btn-ghost btn-sm" href="#/library/backlog">View list</a>
    </div>
    <div class="bl-hero">
      <span class="hero-figure" data-bl-total>${isNum(total) ? fmt.num(total) : '—'}</span>
      <span class="bl-hero-unit">tracks left${infoTip(DEF.backlog_total, { label: 'Tracks left' })}</span>
    </div>
    <p class="bl-sync" data-bl-sync>${syncLineMarkup(s)}</p>
    <div class="bl-insights" data-bl-insights>${insightsPart}</div>
    <div class="bl-controls">
      <div class="bl-setting">
        <div class="bl-setting-text">
          <span class="bl-setting-label" id="now-ac-label">Auto-clear</span>
          <span class="bl-setting-desc" id="now-ac-desc" data-bl-ac-desc>${enabled ? 'On — tracks leave the backlog as you listen' : 'Paused — tracks stay while you listen'}</span>
        </div>
        <button type="button" class="now-switch" role="switch" aria-checked="${enabled ? 'true' : 'false'}" aria-labelledby="now-ac-label" aria-describedby="now-ac-desc" data-now="auto-clean"><span class="now-switch-thumb" aria-hidden="true"></span></button>
      </div>
      <div class="bl-threshold${enabled ? '' : ' is-off'}" data-bl-threshold>
        <div class="bl-threshold-row">
          <label for="now-threshold" class="bl-setting-label">Clear after</label>
          <output class="bl-threshold-val num" for="now-threshold" data-bl-thr-val>${secs(sliderVal)}</output>
        </div>
        <input type="range" id="now-threshold" class="now-range" min="${THRESHOLD_MIN}" max="${THRESHOLD_MAX}" step="1" value="${sliderVal}" aria-describedby="now-thr-rule" aria-valuetext="${secs(sliderVal)}">
        <div class="bl-range-scale" aria-hidden="true"><span>${THRESHOLD_MIN} s</span><span>${secs(THRESHOLD_MAX)}</span></div>
        <p class="bl-rule" id="now-thr-rule" data-bl-rule>${ruleText(thr, enabled)}</p>
      </div>
    </div>
    <a class="bl-link link-accent" href="${BACKLOG_INSIGHTS_HREF}">Backlog insights${icon('arrowRight')}</a>`;
}

function renderBacklog() {
  const s = V.status;
  const b = s?.backlog || {};
  const I = V.ins;
  const sig = JSON.stringify([!!s, b.playlist_id || s?.playlist_name || null, b.name, I.at || 0, I.error ? I.error.message : null]);
  if (sig !== V.sig.backlog) {
    V.sig.backlog = sig;
    destroyChart('blSpark');
    repaint(V.refs.backlog, backlogMarkup());
    const host = V.refs.backlog.querySelector('[data-bl-spark]');
    const pts = trajectoryPoints(I.data);
    if (host && pts.length && V.ctx.charts?.sparkline) {
      const fig = V.ctx.charts.sparkline(pts, {
        width: 'auto', height: 48, area: true, valueLabel: 'tracks',
        ariaLabel: 'Backlog size per day',
      });
      host.replaceChildren(fig);
      V.charts.blSpark = fig;
    }
    wireThreshold();
  }
  updateBacklogLive();
}

function updateBacklogLive() {
  const el = V.refs.backlog;
  const s = V.status;
  if (!el || !s) return;
  const b = s.backlog || {};
  const totalEl = el.querySelector('[data-bl-total]');
  const total = isNum(b.total) ? fmt.num(b.total) : null;
  if (totalEl && total && totalEl.textContent !== total) totalEl.textContent = total;
  const syncEl = el.querySelector('[data-bl-sync]');
  if (syncEl) {
    const key = JSON.stringify([b.error, b.loading, b.complete, b.progress, b.synced_at_ms || b.checked_at_ms, b.pending_removals]);
    if (syncEl.dataset.key !== key) { syncEl.dataset.key = key; mount(syncEl, syncLineMarkup(s)); }
  }
  const enabled = s.auto_clean?.enabled !== false;
  const sw = el.querySelector('.now-switch');
  if (sw && sw.getAttribute('aria-checked') !== String(enabled)) sw.setAttribute('aria-checked', String(enabled));
  const acDesc = el.querySelector('[data-bl-ac-desc]');
  const acTxt = enabled ? 'On — tracks leave the backlog as you listen' : 'Paused — tracks stay while you listen';
  if (acDesc && acDesc.textContent !== acTxt) acDesc.textContent = acTxt;
  el.querySelector('[data-bl-threshold]')?.classList.toggle('is-off', !enabled);
  const range = el.querySelector('#now-threshold');
  const thr = Math.round(num(s.threshold_seconds) || 15);
  if (range && !V.thrDirty) {
    const v = String(Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, thr)));
    if (range.value !== v) range.value = v;
    paintThreshold(Number(v), enabled, thr);
  } else if (range) {
    paintThreshold(Number(range.value), enabled);
  }
}

function paintThreshold(v, enabled, actual) {
  const el = V.refs.backlog;
  const range = el.querySelector('#now-threshold');
  if (range) {
    range.style.setProperty('--fill', `${((v - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * 100}%`);
    range.setAttribute('aria-valuetext', secs(v));
  }
  const out = el.querySelector('[data-bl-thr-val]');
  if (out && out.textContent !== secs(v)) out.textContent = secs(v);
  const rule = el.querySelector('[data-bl-rule]');
  const txt = ruleText(actual ?? v, enabled);
  if (rule && rule.textContent !== txt) rule.textContent = txt;
}

const postThreshold = debounce(async (seconds) => {
  try {
    const r = await api.post('/api/threshold', { seconds });
    const v = num(r?.threshold_seconds ?? seconds);
    // Still dirty if the user moved the slider again while this save was in flight.
    if (V && V.thrValue === seconds) V.thrDirty = false;
    store.patch({ threshold_seconds: v });
    toast(`Backlog tracks now clear after ${secs(v)} of listening.`, { kind: 'success', icon: 'clock', key: 'threshold', timeoutMs: 3000 });
    store.refreshSoon(400);
  } catch (err) {
    if (V) { V.thrDirty = false; updateBacklogLive(); }
    if (!isAbort(err)) toast(err.message || "Couldn't save the listening threshold.", { kind: 'error' });
  }
}, 500);

function wireThreshold() {
  const range = V.refs.backlog.querySelector('#now-threshold');
  if (!range) return;
  const enabled = () => V.status?.auto_clean?.enabled !== false;
  const mark = () => { V.thrDirty = true; V.thrValue = Number(range.value); paintThreshold(V.thrValue, enabled()); };
  range.addEventListener('input', mark);
  range.addEventListener('change', () => { mark(); postThreshold(V.thrValue); });
}

async function loadInsights({ force = false } = {}) {
  if (!V) return;
  const fresh = cache.insights && Date.now() - cache.insightsAt < INSIGHTS_TTL_MS;
  if (!force && fresh) {
    V.ins = { data: cache.insights, at: cache.insightsAt };
    renderBacklog();
    return;
  }
  if (V.insLoading) return;
  V.insLoading = true;
  V.insLastFetch = Date.now();
  const part = V.refs.backlog?.querySelector('[data-bl-insights]');
  if (V.ins.data) setRefetching(part, true);
  const signal = V.signal;
  try {
    const d = await api.get('/api/v2/backlog/insights', { signal, timeoutMs: 20000 });
    cache.insights = d;
    cache.insightsAt = Date.now();
    if (!V) return;
    V.ins = { data: d, at: cache.insightsAt };
  } catch (err) {
    if (isAbort(err) || !V) return;
    V.ins = { data: V.ins.data, at: V.ins.at, error: V.ins.data ? null : err };
    if (V.ins.data) reportError(err);
  } finally {
    if (V) {
      V.insLoading = false;
      setRefetching(V.refs.backlog?.querySelector('[data-bl-insights]'), false);
    }
  }
  renderBacklog();
}

function scheduleInsights() {
  if (!V) return;
  clearTimeout(V.insTimer);
  const wait = Math.max(3000, INSIGHTS_MIN_GAP_MS - (Date.now() - (V.insLastFetch || 0)));
  V.insTimer = setTimeout(() => loadInsights({ force: true }), wait);
}

// ======================================================================= recently cleared
function reasonText(e) {
  switch (e.reason) {
    case 'threshold': return isNum(e.listened_s) && num(e.listened_s) > 0 ? `after ${secs(e.listened_s)}` : 'after listening';
    case 'like': return 'liked';
    case 'routed': return 'moved to a playlist';
    case 'catch-up': return 'heard elsewhere';
    default: return 'cleared manually';
  }
}

function clearedMarkup() {
  const list = (Array.isArray(V.status?.recently_cleared) ? V.status.recently_cleared : []).filter((e) => e && e.track_id);
  const head = html`<div class="now-card-head"><div><h2 class="card-title" id="now-cleared-h">Recently cleared</h2>
    <p class="card-desc">Undo puts a track back for up to 30 minutes.</p></div></div>`;
  if (!list.length) {
    return html`${head}${emptyState({ icon: 'clear', title: 'Nothing cleared yet', body: 'Tracks you clear show up here — with undo for 30 minutes.', compact: true })}`;
  }
  const shown = V.clearedAll ? list : list.slice(0, CLEARED_PREVIEW);
  return html`${head}
    <ul class="rc-list" role="list">
      ${shown.map((e) => {
        const isNew = V.seenCleared && !V.seenCleared.has(e.seq);
        const can = undoable(e);
        return html`<li class="rc-row${isNew ? ' is-new' : ''}${e.undone ? ' is-undone' : ''}" data-seq="${e.seq}">
          ${thumb(e.image, { alt: '' })}
          <div class="rc-main">
            <div class="rc-title truncate">${e.name || 'Unknown track'}</div>
            <div class="rc-sub truncate">${artistLinks(e.artist_list?.length ? e.artist_list : e.artists, { max: 2 })}</div>
            <div class="rc-meta">${e.reason === 'like' ? icon('heartFilled', { className: 'rc-like' }) : ''}<span>${e.undone ? 'restored' : reasonText(e)}</span><span aria-hidden="true">·</span>${relSpan(e.ts_ms)}</div>
          </div>
          ${can ? html`<button type="button" class="btn btn-secondary btn-sm rc-undo" data-now="undo" data-seq="${e.seq}" aria-label="${`Undo clearing ${e.name || 'this track'}`}">${icon('undo')}Undo</button>`
            : e.undone ? html`<span class="rc-state">${icon('undo')}Restored</span>` : ''}
        </li>`;
      })}
    </ul>
    ${list.length > CLEARED_PREVIEW ? html`<button type="button" class="btn btn-ghost btn-sm rc-more" data-now="cleared-more" aria-expanded="${V.clearedAll ? 'true' : 'false'}">${V.clearedAll ? 'Show fewer' : `Show all ${list.length}`}${icon(V.clearedAll ? 'chevronUp' : 'chevronDown')}</button>` : ''}`;
}

function renderCleared({ force = false } = {}) {
  const list = Array.isArray(V.status?.recently_cleared) ? V.status.recently_cleared : [];
  const sig = JSON.stringify([list.map((e) => [e?.seq, e?.undone, undoable(e)]), V.clearedAll, !!V.status]);
  if (sig === V.sig.cleared && !force) return;
  V.sig.cleared = sig;
  if (!V.status) {
    mount(V.refs.cleared, html`<div class="now-card-head"><div><h2 class="card-title" id="now-cleared-h">Recently cleared</h2></div></div>${loadingState('Loading…', { compact: true })}`);
    return;
  }
  repaint(V.refs.cleared, clearedMarkup());
  if (!V.seenCleared) V.seenCleared = new Set();
  list.forEach((e) => { if (e && e.seq != null) V.seenCleared.add(e.seq); });
}

// ======================================================================= catch-up
function catchupCandidates() {
  const cands = Array.isArray(V.cu?.candidates) ? V.cu.candidates : [];
  const gone = new Set((V.status?.recently_cleared || []).filter((e) => e && !e.undone).map((e) => e.track_id));
  return cands.filter((c) => c && c.id && !gone.has(c.id));
}

function renderCatchUp() {
  const el = V.refs.catchup;
  const cands = catchupCandidates();
  const sig = JSON.stringify(cands.map((c) => c.id));
  if (sig === V.sig.catchup) return;
  V.sig.catchup = sig;
  if (!cands.length) {
    if (el.contains(document.activeElement)) V.refs.backlog.querySelector('.now-switch')?.focus({ preventScroll: true });
    el.hidden = true;
    mount(el, '');
    return;
  }
  el.hidden = false;
  const n = cands.length;
  repaint(el, html`<div class="cu-row">
    <span class="cu-icon" aria-hidden="true">${icon('sparkle')}</span>
    <div class="cu-text">
      <h2 class="card-title" id="now-catchup-h">Catch up</h2>
      <p><strong>${fmt.plural(n, 'track')}</strong> you already heard elsewhere ${n === 1 ? 'is' : 'are'} still in your backlog.</p>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" data-now="catchup">Review</button>
  </div>`);
}

async function loadCatchUp({ force = false } = {}) {
  if (!V || !V.status || V.status.auth_ready === false) return;
  const fresh = cache.catchupAt && Date.now() - cache.catchupAt < CATCHUP_TTL_MS;
  if (!force && fresh) { V.cu = cache.catchup; renderCatchUp(); return; }
  if (V.cuLoading) return;
  V.cuLoading = true;
  const signal = V.signal;
  try {
    const d = await api.get('/api/v2/backlog/catch-up', { signal, timeoutMs: 20000 });
    cache.catchup = d;
    cache.catchupAt = Date.now();
    if (!V) return;
    V.cu = d;
  } catch (err) {
    if (isAbort(err) || !V) return;
    // Optional panel: when Spotify is cooling down it just stays hidden until the next try.
    cache.catchupAt = Date.now() - CATCHUP_TTL_MS + 60e3;
  } finally {
    if (V) V.cuLoading = false;
  }
  if (V) renderCatchUp();
}

async function openCatchUp() {
  const cands = catchupCandidates();
  if (!cands.length) return;
  const { cleared } = await openCatchUpDialog({ candidates: cands });
  if (!cleared) return;
  cache.catchupAt = 0;
  if (V) loadCatchUp({ force: true });
}

// ======================================================================= ticking + timers
function tick() {
  if (!V) return;
  tickFate();
  tickLyrics();
}

function syncTicker() {
  const need = !!(V && V.model?.t && V.model.playing && !document.hidden);
  if (need && !V.ticker) V.ticker = setInterval(tick, TICK_MS);
  else if (!need && V?.ticker) { clearInterval(V.ticker); V.ticker = null; }
}

function refreshRelTimes() {
  if (!V) return;
  V.root.querySelectorAll('[data-rel]').forEach((n) => {
    const txt = fmt.relTime(Number(n.dataset.rel));
    if (n.textContent !== txt) n.textContent = txt;
  });
  // Undo windows expire: let the panels drop their Undo buttons.
  renderCleared();
  renderHero();
}

function checkWaitOuts() {
  const t = V.model?.t;
  if (!t) return;
  const since = Date.now() - (V.trackSince || Date.now());
  if (since < WAIT_OUT_MS) return;
  let changed = false;
  if (!V.status?.current_lyrics && V.waitedOut.lyrics !== t.id) { V.waitedOut.lyrics = t.id; changed = true; }
  const name = primaryArtist(t);
  if (!artistInfoFor(name) && V.waitedOut.artist !== name) { V.waitedOut.artist = name; changed = true; }
  if (changed) { renderLyrics(); renderArtist(); }
}

function destroyChart(key) {
  const fig = V?.charts?.[key];
  if (fig?.chart?.destroy) { try { fig.chart.destroy(); } catch (err) { reportError(err); } }
  if (V?.charts) V.charts[key] = null;
}

// ======================================================================= status
function onStatus(s, info = {}) {
  if (!V) return;
  const prev = V.status;
  V.status = s;
  const prevTrack = V.model?.t?.id || null;
  V.model = buildModel(s);
  const trackId = V.model.t?.id || null;
  if (trackId !== prevTrack) {
    V.trackSince = Date.now();
    V.lyrUserUntil = 0;
  }
  if (!(V.lyrOffsetPendingUntil > Date.now())) V.lyrOffset = num(s.lyrics_offset_ms);

  renderHero();
  renderLyrics();
  const name = primaryArtist(V.model.t);
  if (name && V.art.name !== name) loadArtist(name);
  else renderArtist();
  renderToday();
  renderBacklog();
  renderCleared();
  renderCatchUp();

  const changed = info.changed;
  const totalNow = s.backlog?.total;
  if (prev && totalNow !== prev.backlog?.total) scheduleInsights();
  const completeNow = s.backlog?.complete !== false;
  if (!V.cuRequested && completeNow && s.auth_ready !== false) { V.cuRequested = true; loadCatchUp(); }
  else if (prev && prev.backlog?.complete === false && completeNow) loadCatchUp({ force: true });
  if (changed && changed.has('recently_cleared') && V.cu) renderCatchUp();
  syncTicker();
  tick();
}

// ======================================================================= view
export default {
  id: 'now',
  title: 'Now',

  mount(root, params, ctx) {
    V = {
      root, ctx, signal: ctx.signal,
      status: null, model: null,
      sig: {}, refs: {}, heroRefs: null, charts: {},
      art: { name: null }, ins: { data: null }, cu: null,
      waitedOut: { lyrics: null, artist: null },
      lyricsOpen: storageGet(LYRICS_KEY) !== '0',
      lyrOffset: 0, lyrOffsetPendingUntil: 0, lyrUserUntil: 0, lyr: null,
      clearedAll: false, seenCleared: null,
      ticker: null, timers: [], offs: [], thrDirty: false,
      trackSince: Date.now(),
    };
    mount(root, html`<div class="now-wrap">
      <div class="now">
        <section class="card now-hero" data-panel="hero" aria-labelledby="now-title"></section>
        <div class="now-left">
          <section class="card now-lyrics" data-panel="lyrics" aria-labelledby="now-lyrics-h"></section>
          <section class="card now-artist" data-panel="artist" aria-labelledby="now-artist-h"></section>
        </div>
        <div class="now-right">
          <section class="now-today" data-panel="today" aria-labelledby="now-today-h"></section>
          <section class="card now-backlog" data-panel="backlog" aria-labelledby="now-backlog-h"></section>
          <section class="card now-cleared" data-panel="cleared" aria-labelledby="now-cleared-h"></section>
          <section class="card now-catchup" data-panel="catchup" aria-labelledby="now-catchup-h" hidden></section>
        </div>
      </div>
    </div>`);
    const q = (p) => root.querySelector(`[data-panel="${p}"]`);
    V.refs = { hero: q('hero'), lyrics: q('lyrics'), artist: q('artist'), today: q('today'), backlog: q('backlog'), cleared: q('cleared'), catchup: q('catchup') };
    V.model = buildModel(null);

    // One delegated handler for every control on the page (no inline handlers).
    const onClick = (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest('[data-now]') : null;
      if (!el || !root.contains(el) || el.disabled) return;
      const name = el.dataset.now;
      try {
        let r;
        if (V.refs.hero.contains(el) && name !== 'undo') r = onHeroAction(name, el);
        else if (name === 'undo') r = withBusy(el, () => player.undo(Number(el.dataset.seq)));
        else if (name === 'lyrics-toggle') toggleLyrics();
        else if (name === 'lyr-offset') { if (el.getAttribute('aria-disabled') !== 'true') changeOffset(el.dataset.delta); }
        else if (name === 'auto-clean') r = setAutoClean(el.getAttribute('aria-checked') !== 'true', el);
        else if (name === 'catchup') r = openCatchUp();
        else if (name === 'cleared-more') { V.clearedAll = !V.clearedAll; renderCleared(); }
        if (r && typeof r.catch === 'function') r.catch(reportError);
      } catch (err) { reportError(err); }
    };
    root.addEventListener('click', onClick);
    V.offs.push(() => root.removeEventListener('click', onClick));
    const onVis = () => { syncTicker(); if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    V.offs.push(() => document.removeEventListener('visibilitychange', onVis));
    V.timers.push(setInterval(refreshRelTimes, 30000));
    V.timers.push(setInterval(() => { if (V) checkWaitOuts(); }, 4000));
    V.timers.push(setInterval(() => { if (V && !document.hidden) loadInsights({ force: true }); }, 5 * 60e3));
    V.timers.push(setInterval(() => { if (V && !document.hidden) loadCatchUp(); }, CATCHUP_TTL_MS + 5000));

    renderHero();
    renderLyrics();
    renderArtist();
    renderToday();
    renderBacklog();
    renderCleared();
    loadInsights();
  },

  onStatus(status, info) {
    onStatus(status, info);
  },

  unmount() {
    if (!V) return;
    const v = V;
    if (v.ticker) clearInterval(v.ticker);
    v.timers.forEach((t) => clearInterval(t));
    clearTimeout(v.insTimer);
    v.offs.forEach((off) => { try { off(); } catch { /* ignore */ } });
    Object.keys(v.charts).forEach((k) => destroyChart(k));
    V = null;
  },
};

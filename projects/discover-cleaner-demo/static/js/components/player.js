// Persistent player bar: what is playing, what will happen to it (the backlog "fate"), and the
// actions that change that fate (Like, Keep, Clear now, Undo) plus transport and seek.
//
// Structure re-renders only when something structural changes (track, play state, liked, fate
// state); progress, the threshold marker and the countdown tick in place every 250 ms, so focus
// and hover inside the bar survive status polls.
//
// Fate comes from status.current_fate {state, track_id, listened_s, effective_threshold_s, clears_in_s};
// when the server does not send it yet, it is derived from current_in_playlist, current_listened and
// threshold_seconds. Clears (manual or automatic) are announced from status.recently_cleared (new
// seq values) with an Undo action.
import { api, isAbort } from '../core/api.js';
import store from '../core/store.js';
import router from '../core/router.js';
import {
  html, raw, mount, icon, fmt, toast, menu, openDialog, thumb, artistLinks, artistHref,
  loadingState, errorState, emptyState, reportError, safeUrl, debounce,
} from '../core/ui.js';
import { saveTrackToWatchlist } from './watchlist-dialog.js';

const IN_BACKLOG_STATES = new Set(['in_backlog', 'kept', 'clearing_paused', 'queued']);
// Not 'syncing': while membership is unknown the server refuses clears (409 backlog_syncing).
const CLEARABLE_STATES = new Set(['in_backlog', 'kept', 'clearing_paused', 'queued']);
const TICK_MS = 250;
const OPTIMISTIC_MS = 4500;
const SEEK_STEP_MS = 5000;

let el = null;
let refs = {};
let st = null;
let m = null;               // current view model
let renderSig = '';
let ticker = null;
let optimistic = null;      // {value, until, trackId}: play/pause the server has not caught up with yet
let likePending = null;     // {trackId, until}: Like pressed; /api/like can take seconds, show it at once
let seekPreview = null;     // ms while dragging / keyboard-seeking
let dragging = false;
const busy = new Set();
const seenSeqs = new Set();
let seenInit = false;
const seenLegacy = new Set();
let legacyInit = false;
let lastFateText = '';

// ======================================================================= model
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function primaryArtist(t) {
  if (!t) return '';
  if (Array.isArray(t.artist_list) && t.artist_list[0]?.name) return t.artist_list[0].name;
  return String(t.artists || '').split(', ')[0] || '';
}

function computeFate(s, t) {
  if (!t) return { state: 'idle' };
  const f = s.current_fate;
  if (f && typeof f === 'object' && f.state && (!f.track_id || f.track_id === t.id)) return f;
  const listened = num(s.current_listened);
  const thr = num(s.threshold_seconds);
  if (s.current_in_playlist) {
    if (s.auto_clean && s.auto_clean.enabled === false) {
      return { state: 'clearing_paused', track_id: t.id, listened_s: listened, effective_threshold_s: thr };
    }
    return { state: 'in_backlog', track_id: t.id, listened_s: listened, effective_threshold_s: thr, clears_in_s: Math.max(0, thr - listened) };
  }
  const rc = Array.isArray(s.recently_cleared) ? s.recently_cleared.find((e) => e && e.track_id === t.id && !e.undone) : null;
  if (rc) return { state: 'cleared', track_id: t.id };
  const rr = Array.isArray(s.recently_removed) ? s.recently_removed[0] : null;
  if (rr && rr.track && rr.track.id === t.id) return { state: 'cleared', track_id: t.id };
  const syncing = s.backlog ? (s.backlog.complete === false) : s.playlist_track_ids_loaded === false;
  if (syncing) return { state: 'syncing', track_id: t.id };
  return { state: 'not_in_backlog', track_id: t.id };
}

function effectivePlaying(s, t) {
  if (optimistic) {
    if (Date.now() < optimistic.until && optimistic.trackId === (t?.id || null)) return optimistic.value;
    optimistic = null;
  }
  return !!s?.is_playing;
}

function undoEntryFor(s, t) {
  if (!t || !Array.isArray(s?.recently_cleared)) return null;
  const now = Date.now();
  return s.recently_cleared.find((e) => e && e.track_id === t.id && !e.undone && (!e.undo_expires_ms || e.undo_expires_ms > now)) || null;
}

function buildModel(s) {
  const t = s && s.current_track && s.current_track.id ? s.current_track : null;
  const fate = computeFate(s || {}, t);
  const playlistName = s?.backlog?.name || s?.playlist_name || '';
  return {
    t,
    playing: effectivePlaying(s, t),
    fate,
    duration: num(t?.duration_ms || s?.duration_ms),
    liked: !!s?.current_is_liked || !!(likePending && t && likePending.trackId === t.id && Date.now() < likePending.until),
    inBacklog: IN_BACKLOG_STATES.has(fate.state),
    clearable: CLEARABLE_STATES.has(fate.state),
    playlistName,
    signedOut: !!s && s.auth_ready === false && !t,
    undo: undoEntryFor(s, t),
  };
}

function progressNow() {
  if (seekPreview != null) return seekPreview;
  const base = num(st?.progress_ms);
  const add = m?.playing ? store.sinceObserved() : 0;
  return m?.duration ? Math.min(m.duration, base + add) : base + add;
}

function remainingS() {
  const f = m?.fate;
  if (!f || f.state !== 'in_backlog') return null;
  let base = f.clears_in_s == null ? NaN : Number(f.clears_in_s);
  if (!Number.isFinite(base)) {
    // No countdown from the server: derive it from the threshold and what was heard so far.
    const thr = Number(f.effective_threshold_s ?? st?.threshold_seconds);
    const heard = Number(f.listened_s ?? st?.current_listened);
    if (!Number.isFinite(thr) || !Number.isFinite(heard) || thr <= 0) return null;
    base = Math.max(0, thr - heard);
  }
  const add = m.playing ? store.sinceObserved() / 1000 : 0;
  return Math.max(0, base - add);
}

// ======================================================================= render
function signature(model) {
  const t = model.t;
  return JSON.stringify([
    t?.id, t?.name, t?.artists, t?.image, (t?.artist_list || []).map((a) => a?.name),
    model.playing, model.liked, model.fate.state, model.inBacklog, model.clearable, model.signedOut,
    model.undo?.seq ?? null, model.playlistName, model.duration,
  ]);
}

function fateMarkup(model) {
  const f = model.fate;
  const pl = model.playlistName ? `“${model.playlistName}”` : 'your backlog';
  const thr = num(f.effective_threshold_s ?? st?.threshold_seconds);
  switch (f.state) {
    case 'in_backlog':
      return html`<div class="pl-fate" data-state="in_backlog" data-tip="${`After ${fmt.duration(thr, { unit: 's' })} of listening this track is removed from ${pl}. Keep stops that for this play.`}">${icon('clock')}<span data-fate-text></span></div>`;
    case 'kept':
      return html`<div class="pl-fate" data-state="kept" data-tip="${`Stays in ${pl}. It can still be cleared the next time it plays.`}">${icon('keep')}<span>Kept · won't be cleared this play</span></div>`;
    case 'cleared':
      return html`<div class="pl-fate" data-state="cleared">${icon('checkCircle')}<span>Cleared from backlog</span>${model.undo ? html`<button type="button" class="fate-undo" data-pl="undo" data-seq="${model.undo.seq}">Undo</button>` : ''}</div>`;
    case 'clearing_paused':
      return html`<div class="pl-fate" data-state="clearing_paused" data-tip="Auto-clear is turned off. Turn it back on in Settings.">${icon('pauseCircle')}<span>Auto-clear paused · stays in backlog</span></div>`;
    case 'queued':
      return html`<div class="pl-fate" data-state="queued" data-tip="Spotify is busy. The removal is saved and retried automatically.">${icon('hourglass')}<span>Clear queued · waiting for Spotify</span></div>`;
    case 'syncing':
      return html`<div class="pl-fate" data-state="syncing" data-tip="The backlog list is still loading. Nothing is removed until it is known.">${icon('refresh')}<span>Checking your backlog…</span></div>`;
    case 'not_in_backlog':
      return html`<div class="pl-fate" data-state="not_in_backlog">${icon('disc')}<span>Not in your backlog</span></div>`;
    default:
      return html`<div class="pl-fate" data-state="idle"></div>`;
  }
}

function render(model) {
  const t = model.t;
  const dur = model.duration;
  if (!t) {
    mount(el, html`
      <div class="pl-now">
        ${thumb(null, { className: 'pl-art', iconName: 'music' })}
        <div class="pl-meta">
          ${model.signedOut
            ? html`<div class="pl-idle-title">Spotify isn't connected</div><div class="pl-idle-sub"><a class="link-accent" href="/login">Connect Spotify</a> to see what's playing.</div>`
            : html`<div class="pl-idle-title">Nothing playing</div><div class="pl-idle-sub truncate">Play something in Spotify and it shows up here.</div>`}
        </div>
      </div>
      <div class="pl-center">
        <div class="pl-transport">
          <button type="button" class="btn btn-icon pl-prev" data-pl="prev" aria-label="Previous track" disabled>${icon('prev')}</button>
          <button type="button" class="pl-play" data-pl="toggle" aria-label="Play" data-tip="Resume playback (Space)" ${model.signedOut ? raw('disabled') : ''}>${icon('play')}</button>
          <button type="button" class="btn btn-icon pl-next" data-pl="next" aria-label="Next track" disabled>${icon('next')}</button>
        </div>
        <div class="pl-progress-row">
          <span class="pl-time pl-time-cur">0:00</span>
          <div class="progress" role="slider" aria-label="Seek" aria-disabled="true" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="-1">
            <div class="progress-track"><div class="progress-fill"></div></div>
          </div>
          <span class="pl-time pl-time-dur">0:00</span>
        </div>
        <div class="pl-fate" data-state="idle"></div>
      </div>
      <div class="pl-actions">
        <button type="button" class="pl-action" disabled><span>${icon('heart')}</span><span class="pl-action-label">Like</span></button>
        <button type="button" class="pl-action" disabled>${icon('keep')}<span class="pl-action-label">Keep</span></button>
        <button type="button" class="pl-action pl-action-clear" disabled>${icon('clear')}<span class="pl-action-label">Clear now</span></button>
        <button type="button" class="pl-action pl-action-more" aria-label="More actions" disabled>${icon('more')}</button>
      </div>`);
    cacheRefs();
    return;
  }
  const artist = primaryArtist(t);
  const kept = model.fate.state === 'kept';
  const likeTip = model.liked
    ? (model.inBacklog ? 'In your Liked Songs. Like again to clear it from the backlog (L)' : 'In your Liked Songs')
    : (model.inBacklog ? 'Save to Liked Songs and clear from backlog (L)' : 'Save to Liked Songs (L)');
  const keepTip = kept ? 'Kept for this play. Press again to let it clear (K)' : model.fate.state === 'in_backlog' ? "Keep in backlog: don't auto-clear this play (K)" : 'Only backlog tracks can be kept';
  const keepEnabled = kept || model.fate.state === 'in_backlog';
  const clearTip = model.clearable ? 'Remove from backlog now and skip (C)' : model.fate.state === 'syncing' ? 'Available once the backlog has loaded' : 'Not in your backlog';
  mount(el, html`
    <div class="pl-now">
      <a class="pl-art-link" href="${artistHref(artist)}" tabindex="-1" aria-hidden="true">${thumb(t.image, { className: 'pl-art', alt: '' })}</a>
      <div class="pl-meta">
        <a class="pl-title truncate" href="${artistHref(artist)}" data-tip="${`Open ${artist}`}">${t.name || 'Unknown track'}</a>
        <div class="pl-artists truncate">${artistLinks(t.artist_list?.length ? t.artist_list : t.artists)}</div>
        ${model.inBacklog || model.liked ? html`<div class="pl-chips">
          ${model.inBacklog ? html`<span class="chip chip-outline" data-tip="${model.playlistName ? `In “${model.playlistName}”` : 'In your backlog playlist'}">${icon('backlog')}In backlog</span>` : ''}
          ${model.liked ? html`<span class="chip chip-accent">${icon('heartFilled')}Liked</span>` : ''}
        </div>` : ''}
      </div>
    </div>
    <div class="pl-center">
      <div class="pl-transport">
        <button type="button" class="btn btn-icon pl-prev" data-pl="prev" aria-label="Previous track" data-tip="Previous (P)">${icon('prev')}</button>
        <button type="button" class="pl-play" data-pl="toggle" aria-label="${model.playing ? 'Pause' : 'Play'}" data-tip="${model.playing ? 'Pause (Space)' : 'Play (Space)'}">${icon(model.playing ? 'pause' : 'play')}</button>
        <button type="button" class="btn btn-icon pl-next" data-pl="next" aria-label="Next track" data-tip="Next (N)">${icon('next')}</button>
      </div>
      <div class="pl-progress-row">
        <span class="pl-time pl-time-cur" aria-hidden="true">0:00</span>
        <div class="progress" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${Math.round(dur / 1000)}" aria-valuenow="0" aria-valuetext="0:00 of ${fmt.clock(dur)}">
          <div class="progress-track"><div class="progress-fill"></div><div class="progress-window"></div></div>
          <div class="progress-marker" hidden data-tip="Clears from your backlog here if you keep listening"></div>
          <div class="progress-thumb"></div>
        </div>
        <span class="pl-time pl-time-dur" aria-hidden="true">${fmt.clock(dur)}</span>
      </div>
      ${fateMarkup(model)}
    </div>
    <div class="pl-actions">
      <button type="button" class="pl-action" data-pl="like" aria-pressed="${model.liked ? 'true' : 'false'}" data-tip="${likeTip}">${icon(model.liked ? 'heartFilled' : 'heart')}<span class="pl-action-label">${model.liked ? 'Liked' : 'Like'}</span></button>
      <button type="button" class="pl-action" data-pl="keep" aria-pressed="${kept ? 'true' : 'false'}" data-tip="${keepTip}" ${keepEnabled ? '' : raw('disabled')}>${icon('keep')}<span class="pl-action-label">${kept ? 'Kept' : 'Keep'}</span></button>
      <button type="button" class="pl-action pl-action-clear" data-pl="clear" data-tip="${clearTip}" ${model.clearable ? '' : raw('disabled')}>${icon('clear')}<span class="pl-action-label">Clear now</span></button>
      <button type="button" class="pl-action pl-action-more" data-pl="more" aria-haspopup="menu" aria-expanded="false" aria-label="More actions" data-tip="More">${icon('more')}</button>
    </div>`);
  cacheRefs();
}

function cacheRefs() {
  refs = {
    slider: el.querySelector('.progress'),
    track: el.querySelector('.progress-track'),
    fill: el.querySelector('.progress-fill'),
    win: el.querySelector('.progress-window'),
    marker: el.querySelector('.progress-marker'),
    thumb: el.querySelector('.progress-thumb'),
    cur: el.querySelector('.pl-time-cur'),
    fateText: el.querySelector('[data-fate-text]'),
  };
  lastFateText = '';
  refs.lastSecond = -1;
}

// ======================================================================= ticking
function tick() {
  if (!m || !m.t || !refs.fill) return;
  const dur = m.duration;
  const pos = progressNow();
  const frac = dur ? Math.max(0, Math.min(1, pos / dur)) : 0;
  const pct = `${(frac * 100).toFixed(3)}%`;
  refs.fill.style.width = pct;
  // Clamped so the 12px thumb never pokes past the bar's ends (it reached the viewport edge on phones).
  if (refs.thumb) refs.thumb.style.left = `clamp(6px, ${pct}, calc(100% - 6px))`;
  const sec = Math.floor(pos / 1000);
  if (sec !== refs.lastSecond) {
    refs.lastSecond = sec;
    if (refs.cur) refs.cur.textContent = fmt.clock(pos);
    if (refs.slider) {
      refs.slider.setAttribute('aria-valuenow', String(sec));
      refs.slider.setAttribute('aria-valuetext', `${fmt.clock(pos)} of ${fmt.clock(dur)}`);
    }
  }
  const rem = remainingS();
  if (rem != null && dur && refs.marker) {
    const markerFrac = Math.min(0.995, Math.max(frac, (pos + rem * 1000) / dur));
    refs.marker.hidden = rem <= 0;
    refs.marker.style.left = `${(markerFrac * 100).toFixed(3)}%`;
    if (refs.win) {
      refs.win.style.left = pct;
      refs.win.style.width = `${Math.max(0, (markerFrac - frac) * 100).toFixed(3)}%`;
    }
  } else {
    if (refs.marker) refs.marker.hidden = true;
    if (refs.win) refs.win.style.width = '0';
  }
  if (refs.fateText && m.fate.state === 'in_backlog' && rem == null) {
    if (lastFateText !== 'unknown') { lastFateText = 'unknown'; refs.fateText.textContent = 'In your backlog · clears once you have listened long enough'; }
  } else if (refs.fateText && m.fate.state === 'in_backlog') {
    const r = rem;
    const count = fmt.duration(Math.ceil(r), { unit: 's' });
    const key = `${r > 0}|${m.playing}|${count}`;
    if (key !== lastFateText) {
      lastFateText = key;
      if (r > 0) {
        const strong = document.createElement('strong');
        strong.textContent = count;
        refs.fateText.replaceChildren(
          document.createTextNode(m.playing ? 'Clears from backlog in ' : 'Clears from backlog after '),
          strong,
          document.createTextNode(m.playing ? '' : ' more listening'),
        );
      } else {
        refs.fateText.textContent = m.playing ? 'Clearing from backlog…' : 'Clears from backlog when playback resumes';
      }
    }
  }
}

function syncTicker() {
  const need = !!(m && m.t && (m.playing || seekPreview != null || dragging));
  if (need && !ticker) ticker = setInterval(tick, TICK_MS);
  else if (!need && ticker) { clearInterval(ticker); ticker = null; }
}

// ======================================================================= status
function onStatus(status, info = {}) {
  st = status;
  const next = buildModel(status);
  if (m && m.t && next.t && m.t.id !== next.t.id) { seekPreview = null; optimistic = null; next.playing = !!status.is_playing; }
  m = next;
  const sig = signature(m);
  if (sig !== renderSig) {
    const active = document.activeElement;
    const focusKey = active && el.contains(active) ? (active.dataset.pl || (active.classList.contains('progress') ? 'seek' : null)) : null;
    renderSig = sig;
    render(m);
    if (focusKey) {
      const again = focusKey === 'seek' ? el.querySelector('.progress') : el.querySelector(`[data-pl="${focusKey}"]`);
      if (again && !again.disabled) again.focus({ preventScroll: true });
    }
  }
  tick();
  syncTicker();
  if (!info.changed || info.changed.has('recently_cleared') || info.changed.has('recently_removed')) announceClears(status);
}

// ======================================================================= clears + undo
function clearedVerb(reason) {
  switch (reason) {
    case 'threshold': return 'Auto-cleared';
    case 'like': return 'Liked and cleared';
    case 'routed': return 'Moved';
    case 'catch-up': return 'Cleared (catch-up)';
    default: return 'Cleared';
  }
}

function backlogLabel() {
  const name = st?.backlog?.name || st?.playlist_name;
  return name ? `“${name}”` : 'your backlog';
}

/** Toast for a clear with an Undo action (while it can still be undone). */
export function announceCleared(entry) {
  if (!entry) return;
  // Views that clear a track themselves announce it right away; the next status poll must not
  // announce the same clear again (it would restart the toast's timer).
  if (entry.seq != null) seenSeqs.add(entry.seq);
  const canUndo = !entry.undone && entry.seq != null && (!entry.undo_expires_ms || entry.undo_expires_ms > Date.now());
  const heard = Number(entry.listened_s);
  toast(html`${clearedVerb(entry.reason)} <strong>${entry.name || 'track'}</strong> from ${backlogLabel()}`, {
    kind: 'success',
    key: `track:${entry.track_id || entry.seq}`,
    icon: entry.reason === 'like' ? 'heartFilled' : 'checkCircle',
    detail: entry.reason === 'threshold' && Number.isFinite(heard) && heard > 0 ? `After ${fmt.duration(heard, { unit: 's' })} of listening` : undefined,
    action: canUndo ? { label: 'Undo', onClick: () => undo(entry.seq) } : undefined,
    timeoutMs: canUndo ? 10000 : 5000,
  });
}

function announceClears(status) {
  const list = status.recently_cleared;
  if (Array.isArray(list)) {
    if (!seenInit) {
      list.forEach((e) => e && e.seq != null && seenSeqs.add(e.seq));
      seenInit = true;
      return;
    }
    const fresh = list.filter((e) => e && e.seq != null && !seenSeqs.has(e.seq));
    fresh.forEach((e) => seenSeqs.add(e.seq));
    if (seenSeqs.size > 300) { const keep = [...seenSeqs].slice(-150); seenSeqs.clear(); keep.forEach((s) => seenSeqs.add(s)); }
    // Catch-up clears come in bulk from a button press; whoever pressed it shows one summary
    // toast, so a poll that lands mid-request must not add a toast per track. Clears of the
    // track that is playing need no toast at all: the player bar (and Now) already say
    // "Cleared from backlog · Undo", and a toast per track covered whatever page was open.
    const playing = status.current_track?.id || null;
    fresh.filter((e) => !e.undone && e.reason !== 'catch-up' && !(playing && e.track_id === playing))
      .reverse().slice(-3).forEach(announceCleared);
    return;
  }
  // Older servers: recently_removed (no seq, no undo) — announce without Undo.
  const legacy = Array.isArray(status.recently_removed) ? status.recently_removed : null;
  if (!legacy) return;
  const idOf = (e) => `${e?.track?.id || ''}@${e?.ts || ''}`;
  if (!legacyInit) { legacy.forEach((e) => seenLegacy.add(idOf(e))); legacyInit = true; return; }
  const fresh = legacy.filter((e) => e && e.track && !seenLegacy.has(idOf(e)));
  fresh.forEach((e) => seenLegacy.add(idOf(e)));
  fresh.reverse().slice(-3).forEach((e) => {
    announceCleared({ track_id: e.track.id, name: e.track.name, reason: e.reason === 'like' ? 'like' : e.reason === 'threshold' ? 'threshold' : 'manual', listened_s: e.listened, undone: true });
  });
}

/**
 * Mark clears as already announced (the caller showed its own toast, e.g. a catch-up summary),
 * so the next status poll doesn't toast them again.
 */
export function markSeen(seqs) {
  (Array.isArray(seqs) ? seqs : [seqs]).forEach((s) => { if (s != null) seenSeqs.add(s); });
}

/** Undo a clear by seq (POST /api/v2/backlog/undo). */
export async function undo(seq) {
  if (seq == null || busy.has(`undo:${seq}`)) return;
  busy.add(`undo:${seq}`);
  try {
    const r = await api.post('/api/v2/backlog/undo', { seq: Number(seq) });
    const name = r?.restored?.name;
    toast(html`Restored ${name ? html`<strong>${name}</strong>` : 'the track'} to ${backlogLabel()}`, { kind: 'success', icon: 'undo', key: r?.restored?.track_id ? `track:${r.restored.track_id}` : undefined });
    store.refreshSoon(300);
  } catch (err) {
    if (isAbort(err)) return;
    if (err.status === 404 && err.code === 'not_found') toast("Undo isn't available on this server yet.", { kind: 'warning' });
    else toast(err.message || "Couldn't undo that clear.", { kind: err.status === 409 || err.status === 410 ? 'warning' : 'error' });
  } finally {
    busy.delete(`undo:${seq}`);
  }
}

/** Undo the newest clear that can still be undone (keyboard: U). */
export function undoLast() {
  const list = Array.isArray(st?.recently_cleared) ? st.recently_cleared : [];
  const now = Date.now();
  const e = list.find((x) => x && !x.undone && x.seq != null && (!x.undo_expires_ms || x.undo_expires_ms > now));
  if (!e) { toast('Nothing to undo.', { kind: 'info' }); return; }
  undo(e.seq);
}

// ======================================================================= actions
async function run(name, fn) {
  if (busy.has(name)) return;
  busy.add(name);
  const btn = el.querySelector(`[data-pl="${name}"]`);
  btn?.classList.add('is-busy');
  try { await fn(); } catch (err) { if (!isAbort(err)) reportError(err); }
  finally {
    busy.delete(name);
    el.querySelector(`[data-pl="${name}"]`)?.classList.remove('is-busy');
  }
}

// Only the explicit track_changed 409 means "you acted on a stale track"; other 409s
// (backlog_syncing, already_undone, ...) carry their own message.
const isTrackChanged = (err) => err?.status === 409 && (err.code === 'track_changed' || err.code === 'conflict');

function trackChangedToast(what) {
  toast(`The track changed before ${what} went through, so nothing happened. Try again.`, { kind: 'warning' });
}

export function toggle() {
  return run('toggle', async () => {
    const t = m?.t || null;
    const next = !(m?.playing);
    optimistic = { value: next, until: Date.now() + OPTIMISTIC_MS, trackId: t?.id || null };
    store.patch({ is_playing: next });
    try {
      const r = await api.post('/api/playback/toggle', {});
      if (r && typeof r.is_playing === 'boolean') {
        optimistic = { value: r.is_playing, until: Date.now() + OPTIMISTIC_MS, trackId: t?.id || null };
        store.patch({ is_playing: r.is_playing });
      }
    } catch (err) {
      optimistic = null;
      store.patch({ is_playing: !next });
      toast(playbackMessage(err), { kind: 'error' });
    }
    store.refreshSoon(1500);
  });
}

function playbackMessage(err) {
  const msg = String(err?.message || '');
  if (/no active device|NO_ACTIVE_DEVICE|device not found/i.test(msg)) return 'No active Spotify device. Start playing in Spotify, then try again.';
  if (err?.isRateLimited) return err.message;
  if (err?.status === 401) return 'Spotify is not connected.';
  return msg ? `Playback control failed: ${msg}` : 'Playback control failed.';
}

/** Start a track (search results, list rows): POST /api/play-track {uri}. */
export async function playUri(uri, name) {
  if (!uri) return;
  try {
    await api.post('/api/play-track', { uri });
    if (name) toast(html`Playing <strong>${name}</strong>`, { kind: 'success', icon: 'play', timeoutMs: 3000 });
    store.refreshSoon(700);
  } catch (err) {
    toast(playbackMessage(err).replace('Playback control failed', "Couldn't start playback"), { kind: 'error' });
  }
}

/**
 * Play a track from history rows that may lack a Spotify id: uses uri/id when known, otherwise
 * looks it up with GET /api/v2/resolve?artist=&track= and plays the match (toast when not found).
 */
export async function playTrack({ uri, id, artist, name } = {}) {
  const known = uri || (id ? `spotify:track:${id}` : '');
  if (known) return playUri(known, name);
  if (!artist || !name) return undefined;
  try {
    const r = await api.get('/api/v2/resolve', { params: { artist, track: name }, timeoutMs: 15000 });
    const t = r?.track;
    if (!t || !(t.uri || t.id)) {
      toast(html`<strong>${name}</strong> wasn't found on Spotify.`, { kind: 'warning', icon: 'search' });
      return undefined;
    }
    return playUri(t.uri || `spotify:track:${t.id}`, t.name || name);
  } catch (err) {
    if (isAbort(err)) return undefined;
    toast(err.message || "Couldn't look that track up on Spotify.", { kind: err.isRateLimited ? 'warning' : 'error' });
    return undefined;
  }
}

function skip(action) {
  return run(action, async () => {
    try {
      await api.post(`/api/playback/${action}`, {});
    } catch (err) {
      toast(playbackMessage(err), { kind: 'error' });
    }
    store.refreshSoon(500);
  });
}
export const next = () => skip('next');
export const prev = () => skip('prev');

export function like() {
  const t = m?.t;
  if (!t) return undefined;
  if (m.liked && !m.inBacklog) { toast('Already in your Liked Songs.', { kind: 'info', icon: 'heartFilled' }); return undefined; }
  return run('like', async () => {
    const wasInBacklog = m.inBacklog;
    likePending = { trackId: t.id, until: Date.now() + 20000 };
    if (st) onStatus(st, {});
    try {
      const r = await api.post('/api/like', { track_id: t.id }, { timeoutMs: 30000 });
      if (store.status?.current_track?.id === t.id) store.patch({ current_is_liked: true });
      const auto = Array.isArray(r?.auto_liked) && r.auto_liked.length ? ` Also followed ${r.auto_liked.join(', ')}.` : '';
      // Older servers only said in the message text whether the backlog copy was removed.
      const cleared = typeof r?.removed === 'boolean' ? r.removed : wasInBacklog && /removed/i.test(String(r?.message || ''));
      if (r?.already_liked) {
        // Nothing was liked: it was already in Liked Songs, so this only cleared it.
        toast(cleared
          ? html`Cleared <strong>${t.name}</strong> from your backlog · it was already in your Liked Songs`
          : html`<strong>${t.name}</strong> is already in your Liked Songs${r?.queued ? ' · it clears from your backlog once Spotify allows' : ''}`,
        { kind: 'success', icon: 'heartFilled', key: `track:${t.id}` });
      } else {
        const note = cleared ? ' and cleared it from your backlog' : (r?.queued ? ' · it clears from your backlog once Spotify allows' : '');
        toast(html`Liked <strong>${t.name}</strong>${note}${auto}`, { kind: 'success', icon: 'heartFilled', key: `track:${t.id}` });
      }
      store.refreshSoon(400);
    } catch (err) {
      likePending = null;
      if (st) onStatus(st, {});
      if (isTrackChanged(err)) trackChangedToast('Like');
      else toast(err.message || "Couldn't like this track.", { kind: 'error' });
    }
  });
}

export function keep() {
  const t = m?.t;
  if (!t) return undefined;
  // Keep toggles: pressing it again while kept lets this play clear as usual.
  const unkeep = m.fate.state === 'kept';
  if (!unkeep && m.fate.state !== 'in_backlog') { toast('Only tracks in your backlog can be kept.', { kind: 'info' }); return undefined; }
  return run('keep', async () => {
    try {
      const r = await api.post('/api/v2/backlog/keep', { track_id: t.id, kept: !unkeep });
      if (r?.current_fate) store.patch({ current_fate: r.current_fate });
      if (unkeep) toast(html`<strong>${t.name}</strong> will clear from your backlog as usual`, { kind: 'info', icon: 'clock', key: `track:${t.id}` });
      else toast(html`Keeping <strong>${t.name}</strong> · it won't be cleared this play`, { kind: 'success', icon: 'keep', key: `track:${t.id}` });
      store.refreshSoon(400);
    } catch (err) {
      if (isTrackChanged(err)) trackChangedToast('Keep');
      else if (err.status === 404 && err.code === 'not_found') toast("Keep isn't available on this server yet.", { kind: 'warning' });
      else toast(err.message || "Couldn't keep this track.", { kind: 'error' });
    }
  });
}

export function clearNow() {
  const t = m?.t;
  if (!t) return undefined;
  if (!m.clearable) { toast('This track is not in your backlog.', { kind: 'info' }); return undefined; }
  return run('clear', async () => {
    try {
      const r = await api.post('/api/v2/backlog/clear', { track_id: t.id, skip: true });
      const entry = r?.cleared;
      if (entry?.seq != null) seenSeqs.add(entry.seq);
      announceCleared(entry || { track_id: t.id, name: t.name, reason: 'manual', undone: true });
      store.refreshSoon(500);
    } catch (err) {
      if (isTrackChanged(err)) { trackChangedToast('Clear'); return; }
      if (err.status === 404 && err.code === 'not_found') {
        // Server without the v2 backlog API: fall back to the legacy clear-and-skip route.
        try {
          const r2 = await api.post('/api/skip-remove', { track_id: t.id });
          toast(r2?.message || 'Cleared and skipped.', { kind: 'success', icon: 'checkCircle' });
          store.refreshSoon(500);
        } catch (err2) {
          if (isTrackChanged(err2)) trackChangedToast('Clear');
          else toast(err2.message || "Couldn't clear this track.", { kind: 'error' });
        }
        return;
      }
      // 409 backlog_syncing / 503 spotify_busy (clear queued) are temporary, not failures.
      toast(err.message || "Couldn't clear this track.", { kind: err.status === 409 || err.status === 503 ? 'warning' : 'error' });
      if (err.status === 503) store.refreshSoon(800);
    }
  });
}

function openMore(btn) {
  const t = m?.t;
  if (!t) return;
  const artist = primaryArtist(t);
  const items = [
    { label: 'Add to playlist…', icon: 'listPlus', onSelect: () => openAddToPlaylist() },
    { label: 'Save to watchlist…', icon: 'bookmark', onSelect: () => saveTrackToWatchlist(t) },
    { label: artist ? `Open ${artist}` : 'Open artist', icon: 'artists', onSelect: () => router.navigate(router.href('artist', { name: artist })) },
  ];
  const url = safeUrl(t.url, '');
  if (url && /^https:/i.test(url)) items.push({ label: 'Open in Spotify', icon: 'external', href: url, external: true });
  items.push({ separator: true }, { label: 'Keyboard shortcuts', icon: 'keyboard', hint: '?', onSelect: () => document.dispatchEvent(new CustomEvent('app:shortcuts')) });
  menu(btn, items, { placement: 'top-end', label: 'More actions' });
}

// ======================================================================= add to playlist
const RECENT_KEY = 'dc.recentPlaylists';
function recentTargets() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => typeof x === 'string').slice(0, 3); } catch { return []; }
}
function rememberTarget(id) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentTargets().filter((x) => x !== id)].slice(0, 3))); } catch { /* storage unavailable */ }
}

export function openAddToPlaylist() {
  const t = m?.t;
  if (!t) return;
  const snap = { id: t.id, name: t.name, artists: t.artist_list?.length ? t.artist_list : t.artists, image: t.image, inBacklog: m.inBacklog };
  const d = openDialog({
    title: 'Add to playlist',
    body: html`
      <div class="picker-track">${thumb(snap.image)}<div class="row-main"><div class="row-title truncate">${snap.name}</div><div class="row-sub truncate">${artistLinks(snap.artists)}</div></div></div>
      <div class="field picker-filter">
        <label class="sr-only" for="atp-filter">Filter playlists</label>
        <input class="input" id="atp-filter" type="search" placeholder="Filter your playlists" autocomplete="off">
      </div>
      ${snap.inBacklog ? html`<label class="check picker-check"><input type="checkbox" id="atp-remove"> Also clear it from your backlog</label>` : ''}
      <div class="picker-list" role="list" aria-live="polite">${loadingState('Loading your playlists…', { compact: true })}</div>`,
  });
  const listEl = d.body.querySelector('.picker-list');
  const filterEl = d.body.querySelector('#atp-filter');
  let playlists = null;
  const ctrl = new AbortController();
  d.done.then(() => ctrl.abort());

  const renderList = () => {
    if (!playlists) return;
    const q = filterEl.value.trim().toLowerCase();
    const recent = recentTargets();
    const rows = playlists
      .filter((p) => !q || String(p.name || '').toLowerCase().includes(q))
      .sort((a, b) => (recent.indexOf(a.id) + 1 || 99) - (recent.indexOf(b.id) + 1 || 99));
    if (!rows.length) {
      mount(listEl, emptyState({ title: q ? 'No playlists match' : 'No playlists you can add to', body: q ? 'Try a different name.' : 'Only playlists you own or collaborate on are listed.', compact: true, icon: 'listPlus' }));
      return;
    }
    mount(listEl, rows.map((p) => html`<div role="listitem"><button type="button" class="picker-item" data-pid="${p.id}" data-pname="${p.name}">
      ${thumb(p.image, { iconName: 'music' })}
      <span class="row-main"><span class="row-title truncate">${p.name}</span><span class="row-sub">${fmt.plural(p.tracks, 'track')}${recent.includes(p.id) ? ' · recently used' : ''}</span></span>
      <span class="muted">${icon('plus')}</span></button></div>`));
  };

  const load = async () => {
    mount(listEl, loadingState('Loading your playlists…', { compact: true }));
    try {
      const r = await api.get('/api/playlists', { signal: ctrl.signal, timeoutMs: 20000 });
      const active = r?.active_id || st?.backlog?.playlist_id;
      playlists = (r?.playlists || []).filter((p) => p && p.id && p.id !== active);
      renderList();
    } catch (err) {
      if (isAbort(err)) return;
      mount(listEl, errorState(err, { retry: load, compact: true, title: err.isRateLimited ? 'Spotify is cooling down' : "Couldn't load your playlists" }));
    }
  };
  filterEl.addEventListener('input', debounce(renderList, 120));
  listEl.addEventListener('click', async (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('[data-pid]') : null;
    if (!b || b.disabled) return;
    const removeEl = d.body.querySelector('#atp-remove');
    const alsoRemove = !!(removeEl && removeEl.checked);
    listEl.querySelectorAll('[data-pid]').forEach((x) => { x.disabled = true; });
    b.classList.add('is-busy');
    try {
      const r = await api.post('/api/add-to-playlist', {
        playlist_id: b.dataset.pid, track_id: snap.id, remove_from_backlog: alsoRemove, also_remove: alsoRemove,
      });
      rememberTarget(b.dataset.pid);
      d.close('added');
      toast(html`Added <strong>${snap.name}</strong> to “${b.dataset.pname}”${alsoRemove ? ' and cleared it from your backlog' : ''}`, { kind: 'success', icon: 'listPlus', detail: undefined });
      if (r && r.cleared && r.cleared.seq != null) seenSeqs.add(r.cleared.seq);
      store.refreshSoon(500);
    } catch (err) {
      listEl.querySelectorAll('[data-pid]').forEach((x) => { x.disabled = false; });
      b.classList.remove('is-busy');
      if (isTrackChanged(err)) { d.close('changed'); toast('The track changed before it was added, so nothing was added.', { kind: 'warning' }); }
      else toast(err.message || "Couldn't add to that playlist.", { kind: 'error' });
    }
  });
  load();
}

// ======================================================================= seek
function fracFromEvent(ev) {
  const r = (refs.track || refs.slider).getBoundingClientRect();
  return r.width ? Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) : 0;
}

async function commitSeek(pos) {
  if (!m?.t || !m.duration) { seekPreview = null; return; }
  const target = Math.round(Math.max(0, Math.min(m.duration - 1000, pos)));
  seekPreview = target;
  tick();
  try {
    await api.post('/api/seek', { position_ms: target });
    store.patch({ progress_ms: target });
  } catch (err) {
    toast(playbackMessage(err), { kind: 'error' });
  } finally {
    seekPreview = null;
    tick();
    syncTicker();
    store.refreshSoon(900);
  }
}
const commitSeekSoon = debounce((pos) => { commitSeek(pos); }, 450);

function bind() {
  el.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('[data-pl]') : null;
    if (!b || b.disabled || !el.contains(b)) return;
    const a = b.dataset.pl;
    if (a === 'toggle') toggle();
    else if (a === 'next') next();
    else if (a === 'prev') prev();
    else if (a === 'like') like();
    else if (a === 'keep') keep();
    else if (a === 'clear') clearNow();
    else if (a === 'undo') undo(Number(b.dataset.seq));
    else if (a === 'more') openMore(b);
  });
  el.addEventListener('pointerdown', (ev) => {
    const s = ev.target instanceof Element ? ev.target.closest('.progress') : null;
    if (!s || s.getAttribute('aria-disabled') === 'true' || !m?.t || !m.duration || ev.button !== 0) return;
    dragging = true;
    try { s.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    seekPreview = fracFromEvent(ev) * m.duration;
    tick();
    syncTicker();
  });
  el.addEventListener('pointermove', (ev) => {
    if (!dragging || !m?.duration) return;
    seekPreview = fracFromEvent(ev) * m.duration;
    tick();
  });
  const endDrag = (ev, commit) => {
    if (!dragging) return;
    dragging = false;
    if (commit && m?.duration) commitSeek(fracFromEvent(ev) * m.duration);
    else { seekPreview = null; tick(); syncTicker(); }
  };
  el.addEventListener('pointerup', (ev) => endDrag(ev, true));
  el.addEventListener('pointercancel', (ev) => endDrag(ev, false));
  el.addEventListener('keydown', (ev) => {
    const s = ev.target instanceof Element ? ev.target.closest('.progress') : null;
    if (!s || !m?.t || !m.duration) return;
    const base = seekPreview != null ? seekPreview : progressNow();
    let pos = null;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') pos = base + SEEK_STEP_MS;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') pos = base - SEEK_STEP_MS;
    else if (ev.key === 'PageUp') pos = base + 3 * SEEK_STEP_MS;
    else if (ev.key === 'PageDown') pos = base - 3 * SEEK_STEP_MS;
    else if (ev.key === 'Home') pos = 0;
    else if (ev.key === 'End') pos = m.duration - 3000;
    if (pos == null) return;
    ev.preventDefault();
    ev.stopPropagation();
    seekPreview = Math.max(0, Math.min(m.duration - 1000, pos));
    tick();
    syncTicker();
    commitSeekSoon(seekPreview);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ticker) { clearInterval(ticker); ticker = null; } else syncTicker(); });
}

// ======================================================================= init
export function initPlayer(root) {
  el = root;
  if (!el) return;
  mount(el, html`<div class="pl-now"><span class="thumb pl-art skeleton"></span><div class="pl-meta"><div class="pl-idle-sub">Connecting…</div></div></div>`);
  bind();
  store.on('status', (s, info) => onStatus(s, info));
  if (store.status) onStatus(store.status, {});
}

export const player = { initPlayer, toggle, next, prev, like, keep, clearNow, undo, undoLast, openAddToPlaylist, announceCleared, markSeen, playUri, playTrack };
export default player;

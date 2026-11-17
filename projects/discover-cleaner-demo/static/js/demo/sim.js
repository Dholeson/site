// Web demo only: the simulated Spotify player and backlog behind /api/status and the playback /
// backlog routes. It follows the server's rules (src/services/clearing.py): a track that was in
// the backlog when its play started clears once, after min(threshold, 80% of the track) of real
// listening; Keep, the Auto-clear switch and Undo win; Undo puts it back at its old position.
//
// Each simulated track plays SIM_SECONDS (45 s), so a visitor sees a full countdown -> clear ->
// next track quickly. State is per tab (sessionStorage) and survives reloads; reset() starts over.
// Responses copy the shapes the real server returned during the build (fixtures/live.json).
import { load } from './fixtures.js';
import { fold, clone, localDay, hms, rng, shuffle, HttpError } from './util.js';

const CFG = (window.APP_CONFIG && window.APP_CONFIG.webDemo) || {};
const SIM_MS = Math.max(20, Number(CFG.simSeconds) || 45) * 1000;
const STORE_KEY = `dc.webdemo.v1.${CFG.version || 'dev'}`;
const UNDO_WINDOW_MS = 30 * 60e3;
const HEARD_MIN_S = 30;           // a play counts once 30 s were heard (the ledger's rule)
const MAX_CATCH_UP = 6;           // tracks fast-forwarded after the tab slept, at most
const SEED = 20261004;

let live = null;                  // fixtures/live.json
let items = new Map();            // track id -> backlog row (as the server listed it)
let S = null;                     // the mutable simulation state (persisted)
let infoById = null;              // artist-info fixtures, by artist key (for current_artist_info)
let ready = null;
let saveTimer = 0;

const now = () => Date.now();

// ---------------------------------------------------------------------------- state
function freshState() {
  const rows = live.backlog.items;
  const rand = rng(SEED);
  // Start with tracks that have cover art and an artist with a full page, so the first minutes
  // show the app at its best; the rest of the backlog follows in a fixed shuffled order.
  // (not already liked, so Like does something visible).
  const good = rows.filter((r) => r.image && r.artist_list?.length && !likedFixture?.has(r.id));
  const rest = rows.filter((r) => !good.includes(r));
  const queue = [...shuffle(good, rand), ...shuffle(rest, rand)].map((r) => r.id);
  const st = live.status;
  const t = now();
  return {
    v: 1,
    backlog: rows.map((r) => r.id),          // current playlist order
    queue,                                   // play order (the playlist, shuffled)
    qi: 0,
    cur: null,
    recent: [],                              // recently cleared, newest first
    seq: Math.floor(t / 1000),
    removalSeq: Number(st.backlog?.removal_seq) || 0,
    autoClean: st.auto_clean?.enabled !== false,
    threshold: Number(st.threshold_seconds) || 15,
    liked: [],                               // tracks liked in this demo session (newest first)
    favorites: [...(st.favorite_artists || [])],
    lyricsOffset: Number(st.lyrics_offset_ms) || 0,
    stats: { ...(st.stats || {}) },
    today: { ...(st.today || {}) },
    plays: [],                               // plays heard in this session (Recent plays)
    playId: -1,
    startedAt: t,
  };
}

function trackFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    uri: r.uri || `spotify:track:${r.id}`,
    name: r.name || '',
    artists: r.artists || (r.artist_list || []).map((a) => a.name).join(', '),
    artist_list: (r.artist_list || []).map((a) => ({ id: a.id ?? null, name: a.name })),
    album: r.album || '',
    album_id: r.album_id ?? null,
    image: r.image || null,
    url: r.id && !String(r.id).startsWith('demo') ? `https://open.spotify.com/track/${r.id}` : null,
    duration_ms: SIM_MS,
    genres: Array.isArray(r.genres) ? r.genres.slice(0, 5) : [],
  };
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { /* storage off: state lasts for this page */ }
  }, 50);
}

function restore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    if (!st || st.v !== 1 || !Array.isArray(st.backlog)) return null;
    // Restored tracks that are not in the fixture (played from history) live in st.extra.
    return st;
  } catch { return null; }
}

export function reset() {
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

export function init() {
  if (!ready) {
    ready = (async () => {
      live = await load('live.json');
      await likedIds();
      items = new Map(live.backlog.items.map((r) => [r.id, r]));
      S = restore() || freshState();
      S.extra = S.extra || {};
      for (const [id, r] of Object.entries(S.extra)) if (!items.has(id)) items.set(id, r);
      if (!S.cur) startTrack(S.queue[0], { at: now() - 2500 });
      tick();
      save();
    })();
  }
  return ready;
}

export function liveFixture() { return live; }

// ---------------------------------------------------------------------------- playback
function inBacklog(id) { return !!id && S.backlog.includes(id); }

function progressMs(c = S.cur, t = now()) {
  if (!c) return 0;
  return Math.min(SIM_MS, c.pos + (c.playing ? Math.max(0, t - c.since) : 0));
}

function listenedMs(c = S.cur, t = now()) {
  if (!c) return 0;
  return c.heard + (c.playing ? Math.max(0, Math.min(t, c.since + (SIM_MS - c.pos)) - c.since) : 0);
}

function effThresholdS() {
  return Math.min(S.threshold, 0.8 * (SIM_MS / 1000));
}

function startTrack(id, { at = now(), row = null } = {}) {
  const r = row || items.get(id);
  if (!r) return;
  if (row && !items.has(id)) { items.set(id, row); S.extra[id] = row; }
  S.cur = {
    id,
    pos: 0,
    heard: 0,
    since: at,
    started: at,
    playing: true,
    member: inBacklog(id),     // membership when the play started decides auto-clear
    cleared: null,             // reason once cleared during this play
    kept: null,                // 'keep' | 'auto_clean_resumed'
    logged: false,
  };
}

function finishPlay(c, endAt) {
  if (!c || c.logged) return;
  c.logged = true;
  const heardS = listenedMs(c, endAt) / 1000;
  if (heardS < HEARD_MIN_S) return;
  const r = items.get(c.id);
  if (!r) return;
  const artist = r.artist_list?.[0]?.name || String(r.artists || '').split(', ')[0] || '';
  S.plays.unshift({
    id: S.playId--,
    ts_ms: c.started,
    day: localDay(c.started),
    source: 'live',
    artist,
    artist_key: fold(artist),
    track: r.name || '',
    album: r.album || '',
    spotify_track_id: String(c.id).startsWith('demo') ? null : c.id,
    listened_s: Math.round(heardS * 10) / 10,
    is_backlog: !!c.member,
    bulk: false,
    song_key: `${fold(artist)}|${fold(r.name)}`,
    hidden: false,
    image: r.image || null,
  });
  S.plays = S.plays.slice(0, 200);
  S.today.plays_today = (S.today.plays_today || 0) + 1;
  S.today.heard_in_app = (S.today.heard_in_app || 0) + 1;
  S.today.heard_in_app_7d = (S.today.heard_in_app_7d || 0) + 1;
}

function nextQueued(fromIndex, step = 1) {
  const n = S.queue.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (((fromIndex + step * k) % n) + n) % n;
    if (inBacklog(S.queue[i])) return i;
  }
  return -1;
}

function advance(endAt, step = 1) {
  if (S.cur) finishPlay(S.cur, endAt);
  // A track played from outside the backlog returns to the backlog queue where it left off.
  const i = nextQueued(S.qi, step);
  if (i < 0) { S.cur = null; return; }
  S.qi = i;
  startTrack(S.queue[i], { at: endAt });
}

/** Bring the simulation up to now: auto-clears that came due, tracks that ended. */
export function tick() {
  if (!S) return;
  let guard = 0;
  const t = now();
  // Asleep for a long time (closed laptop, background tab): don't replay hours of tracks.
  if (S.cur && S.cur.playing && t - S.cur.since > SIM_MS * (MAX_CATCH_UP + 1)) {
    S.cur.pos = 0;
    S.cur.heard = 0;
    S.cur.since = t - 1000;
    S.cur.started = t - 1000;
  }
  while (S.cur && guard < MAX_CATCH_UP + 2) {
    guard += 1;
    const c = S.cur;
    autoClearIfDue(c, t);
    if (!c.playing) break;
    const endAt = c.since + (SIM_MS - c.pos);
    if (endAt > t) break;
    advance(endAt);
  }
  expireUndo(t);
  save();
}

function autoClearIfDue(c, t) {
  if (!c || !c.playing || c.cleared || c.kept || !c.member || !S.autoClean || !inBacklog(c.id)) return;
  const eff = effThresholdS() * 1000;
  // When did listening cross the threshold? (listening runs with progress while playing)
  const crossAt = c.since + (eff - c.heard);
  const trackEnd = c.since + (SIM_MS - c.pos);
  if (c.heard >= eff || (crossAt <= t && crossAt <= trackEnd)) {
    const at = Math.max(c.since, Math.min(crossAt, t));
    clearTracks([c.id], 'threshold', { at, listenedS: Math.round((Math.max(c.heard, eff) / 1000 + 0.4) * 10) / 10 });
  }
}

function expireUndo(t) {
  // Entries stay listed; undo_expires_ms tells the UI when Undo is gone.
  S.recent = S.recent.filter((e) => t - e.ts_ms < 6 * 3600e3).slice(0, 50);
}

// ---------------------------------------------------------------------------- clearing
function clearTracks(ids, reason, { at = now(), listenedS = null } = {}) {
  const out = [];
  for (const id of ids) {
    const pos = S.backlog.indexOf(id);
    if (pos < 0) continue;
    const r = items.get(id) || {};
    S.backlog.splice(pos, 1);
    S.removalSeq += 1;
    const entry = {
      ...clone(live.templates.clear.cleared),
      seq: ++S.seq,
      track_id: id,
      uri: r.uri || `spotify:track:${id}`,
      name: r.name || '',
      artists: r.artists || '',
      artist_list: (r.artist_list || []).map((a) => ({ id: a.id ?? null, name: a.name })),
      image: r.image || null,
      reason,
      listened_s: listenedS,
      ts_ms: Math.round(at),
      position: pos,
      playlist_id: live.backlog.meta.playlist_id,
      added_at: r.added_at || null,
      album: r.album || '',
      album_id: r.album_id ?? null,
      duration_ms: r.duration_ms || 0,
      undone: false,
      undo_expires_ms: Math.round(at) + UNDO_WINDOW_MS,
    };
    S.recent.unshift(entry);
    if (S.cur && S.cur.id === id) S.cur.cleared = reason;
    bump('removed', 1);
    S.today.cleared_today = (S.today.cleared_today || 0) + 1;
    S.today.cleared_7d = (S.today.cleared_7d || 0) + 1;
    out.push(entry);
  }
  save();
  return out;
}

function bump(kind, n) {
  const s = S.stats;
  s[`${kind}_total`] = Math.max(0, (Number(s[`${kind}_total`]) || 0) + n);
  s[`${kind}_today`] = Math.max(0, (Number(s[`${kind}_today`]) || 0) + n);
}

// ---------------------------------------------------------------------------- status
function fate() {
  const c = S.cur;
  const base = { state: 'idle', track_id: c ? c.id : null, listened_s: 0, effective_threshold_s: Math.round(effThresholdS() * 10) / 10, clears_in_s: null, reason: null };
  if (!c) return base;
  const heard = listenedMs(c) / 1000;
  base.listened_s = Math.round(heard * 10) / 10;
  if (c.cleared) base.state = 'cleared';
  else if (!inBacklog(c.id)) base.state = 'not_in_backlog';
  else if (!S.autoClean) base.state = 'clearing_paused';
  else if (c.kept) { base.state = 'kept'; base.reason = c.kept; }
  else if (!c.member) { base.state = 'kept'; base.reason = 'added_during_play'; }
  else {
    base.state = 'in_backlog';
    base.clears_in_s = Math.round(Math.max(0, effThresholdS() - heard) * 10) / 10;
  }
  return base;
}

function backlogStatus() {
  const b = clone(live.status.backlog) || {};
  const total = S.backlog.length;
  b.total = total;
  b.known = total;
  b.complete = true;
  b.loading = false;
  b.removal_seq = S.removalSeq;
  b.pending_removals = 0;
  b.progress = { loaded: total, total };
  b.duration_ms = S.backlog.reduce((sum, id) => sum + (Number(items.get(id)?.duration_ms) || 0), 0);
  b.checked_at_ms = now();
  return b;
}

async function artistInfoFor(track) {
  const name = track?.artist_list?.[0]?.name;
  if (!name) return null;
  if (!infoById) {
    try {
      const [infos, index] = await Promise.all([load('artist-info.json'), load('artists.json')]);
      infoById = new Map();
      const col = index.columns.indexOf('info');
      const kcol = index.columns.indexOf('key');
      for (const row of index.rows) if (row[col]) infoById.set(row[kcol], infos[String(row[col])]);
    } catch { infoById = new Map(); }
  }
  const info = infoById.get(fold(name));
  return info ? { ...info, name } : { name, demo: true, bio: null, lastfm_tags: [], related: [], my_plays_available: true };
}

export async function status() {
  await init();
  tick();
  const c = S.cur;
  const r = c ? items.get(c.id) : null;
  const track = trackFromRow(r);
  const st = clone(live.status);
  const t = now();
  const day = localDay(t);
  if (S.today.day !== day) {                // the demo ran past midnight
    S.today = { ...S.today, day, plays_today: 0, cleared_today: 0, liked_today: 0 };
    S.stats = { ...S.stats, day, removed_today: 0, liked_today: 0, added_today: 0 };
  }
  const info = track ? await artistInfoFor(track) : null;
  const backlog = backlogStatus();
  Object.assign(st, {
    auth_ready: true,
    current_track: track,
    current_listened: c ? Math.round(listenedMs(c) / 100) / 10 : 0,
    current_in_playlist: !!(c && inBacklog(c.id)),
    current_is_liked: !!(c && isLiked(c.id)),
    current_artist_info: info,
    current_lyrics: track ? { found: false, synced: false, lines: [], plain: null, source: 'demo', demo: true } : null,
    is_playing: !!(c && c.playing),
    progress_ms: c ? Math.round(progressMs(c)) : 0,
    duration_ms: track ? track.duration_ms : 0,
    current_fate: fate(),
    backlog,
    playlist_total: backlog.total,
    playlist_loaded_count: backlog.known,
    playlist_track_ids_loaded: true,
    playlist_duration_ms: backlog.duration_ms,
    recently_cleared: clone(S.recent.slice(0, 10)),
    auto_clean: { enabled: S.autoClean },
    threshold_seconds: S.threshold,
    stats: { ...S.stats },
    today: { ...S.today },
    favorite_artists: [...S.favorites].sort(),
    lyrics_offset_ms: S.lyricsOffset,
    last_poll: hms(t),
    error: null,
    timeline: [],
  });
  return st;
}

// ---------------------------------------------------------------------------- likes
let likedFixture = null;
async function likedIds() {
  if (!likedFixture) {
    const lk = await load('library/liked.json');
    likedFixture = new Set((lk.tracks || []).map((x) => x.id));
  }
  return likedFixture;
}
function isLiked(id) {
  return S.liked.some((x) => x.id === id) || !!likedFixture?.has(id);
}
export function likedAdded() { return S ? clone(S.liked) : []; }

// ---------------------------------------------------------------------------- actions
function requireCurrent(trackId) {
  if (!S.cur || (trackId && S.cur.id !== trackId)) {
    throw new HttpError(409, 'track_changed', 'The track changed; nothing happened.', { current_track_id: S.cur ? S.cur.id : null });
  }
  return S.cur;
}

function pause(c, t = now()) {
  if (!c.playing) return;
  c.heard = listenedMs(c, t);
  c.pos = progressMs(c, t);
  c.playing = false;
}

function resume(c, t = now()) {
  if (c.playing) return;
  c.since = t;
  c.playing = true;
}

export async function toggle() {
  await init(); tick();
  const c = S.cur;
  if (!c) { advance(now()); save(); return { ok: true, is_playing: true }; }
  if (c.playing) pause(c); else resume(c);
  save();
  return { ok: true, is_playing: c.playing };
}

export async function skip(action) {
  await init(); tick();
  advance(now(), action === 'prev' ? -1 : 1);
  save();
  return { ok: true, is_playing: true };
}

export async function seek(positionMs) {
  await init(); tick();
  const c = S.cur;
  if (!c) throw new HttpError(409, 'nothing_playing', 'Nothing is playing.');
  const t = now();
  const pos = Math.max(0, Math.min(SIM_MS - 500, Number(positionMs) || 0));
  c.heard = listenedMs(c, t);         // seeking forward adds no listening time
  c.pos = pos;
  c.since = t;
  save();
  return { ok: true, position_ms: pos };
}

/** Play any track: a backlog row by id, or a row the caller describes (history, search...). */
export async function playTrack(id, row = null) {
  await init(); tick();
  const t = now();
  if (S.cur) finishPlay(S.cur, t);
  const qi = S.queue.indexOf(id);
  if (qi >= 0) S.qi = qi;
  startTrack(id, { at: t, row: items.has(id) ? null : row });
  save();
  return { ok: true, is_playing: true, context: 'track' };
}

export async function playBacklog(shuffled) {
  await init(); tick();
  const t = now();
  if (S.cur) finishPlay(S.cur, t);
  const ids = S.backlog;
  if (!ids.length) throw new HttpError(409, 'empty_backlog', 'Your backlog is empty: nothing to play.');
  const start = shuffled ? ids[Math.floor(Math.random() * ids.length)] : ids[0];
  S.qi = Math.max(0, S.queue.indexOf(start));
  startTrack(start, { at: t });
  save();
  const r = items.get(start) || {};
  return {
    playing: true, playlist_id: live.backlog.meta.playlist_id, name: live.backlog.meta.name, shuffle: !!shuffled,
    shuffle_state: !!shuffled, started_with: { track_id: start, name: r.name || '', artists: r.artists || '' },
  };
}

export async function keep(trackId, kept) {
  await init(); tick();
  const c = requireCurrent(trackId);
  if (kept) c.kept = 'keep';
  else { c.kept = null; if (!c.member && inBacklog(c.id)) c.member = true; }
  tick();
  save();
  return { current_fate: fate() };
}

export async function clear(trackId, skipAfter) {
  await init(); tick();
  if (!inBacklog(trackId)) throw new HttpError(404, 'not_in_backlog', "That track isn't in the backlog playlist.");
  const isCurrent = S.cur && S.cur.id === trackId;
  const listened = isCurrent ? Math.round(listenedMs() / 100) / 10 : null;
  const [entry] = clearTracks([trackId], 'manual', { listenedS: listened });
  let skipped = false;
  if (skipAfter && isCurrent) { advance(now()); skipped = true; }
  save();
  return { cleared: entry, skipped };
}

export async function undo(seq) {
  await init(); tick();
  const e = S.recent.find((x) => x.seq === Number(seq));
  if (!e) throw new HttpError(404, 'not_found', 'That clear is no longer in the recent list.');
  if (e.undone) throw new HttpError(409, 'already_undone', 'That track is already back in your backlog.');
  if (now() > e.undo_expires_ms) throw new HttpError(410, 'undo_expired', 'Undo is only possible for 30 minutes after a clear.');
  if (!inBacklog(e.track_id)) {
    const pos = Math.max(0, Math.min(Number(e.position) || 0, S.backlog.length));
    S.backlog.splice(pos, 0, e.track_id);
    S.removalSeq += 1;
  }
  e.undone = true;
  bump('removed', -1);
  S.today.cleared_today = Math.max(0, (S.today.cleared_today || 0) - 1);
  S.today.cleared_7d = Math.max(0, (S.today.cleared_7d || 0) - 1);
  if (S.cur && S.cur.id === e.track_id) {
    S.cur.cleared = null;
    S.cur.kept = 'keep';        // asked for it back: don't clear it again during this play
  }
  save();
  return { restored: clone(e) };
}

export async function setAutoClean(enabled) {
  await init(); tick();
  const c = S.cur;
  if (enabled && !S.autoClean && c && c.member && !c.cleared && inBacklog(c.id) && listenedMs(c) / 1000 >= effThresholdS()) {
    c.kept = 'auto_clean_resumed';  // the threshold passed while paused: this play stays
  }
  S.autoClean = !!enabled;
  tick();
  save();
  return { enabled: S.autoClean };
}

export async function setThreshold(seconds) {
  await init(); tick();
  S.threshold = Math.max(3, Math.min(600, Math.round(Number(seconds) || 15)));
  tick();
  save();
  return { threshold_seconds: S.threshold };
}

export async function setLyricsOffset(ms) {
  await init();
  S.lyricsOffset = Math.max(-10000, Math.min(10000, Math.round(Number(ms) || 0)));
  save();
  return { lyrics_offset_ms: S.lyricsOffset };
}

export async function like(trackId) {
  await init(); tick();
  const c = requireCurrent(trackId);
  await likedIds();
  const already = isLiked(c.id);
  const r = items.get(c.id) || {};
  if (!already) {
    const artist = r.artist_list?.[0]?.name || String(r.artists || '').split(', ')[0] || '';
    S.liked.unshift({
      id: c.id, uri: r.uri || `spotify:track:${c.id}`, name: r.name || '', artist, artists: r.artists || artist,
      album: r.album || '', image: r.image || null, duration_ms: r.duration_ms || 0, genres: [],
      liked_at: new Date(now()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
    bump('liked', 1);
    S.today.liked_today = (S.today.liked_today || 0) + 1;
  }
  let removed = false;
  if (inBacklog(c.id) && !c.cleared) {
    removed = clearTracks([c.id], 'like', { listenedS: Math.round(listenedMs() / 100) / 10 }).length > 0;
  }
  save();
  const message = already ? (removed ? 'Already liked - removed from discover playlist.' : 'Already in your Liked Songs.')
    : (removed ? 'Liked & removed from discover playlist.' : 'Liked.');
  return { message, auto_liked: [], liked: true, already_liked: already, removed, queued: false };
}

export async function favorite(action, artist) {
  await init();
  const key = fold(artist);
  const has = S.favorites.includes(key);
  const add = action === 'add' || (action === 'toggle' && !has);
  if (add && !has) S.favorites.push(key);
  if (!add) S.favorites = S.favorites.filter((x) => x !== key);
  save();
  return { message: `${add ? 'added' : 'removed'}: ${artist}`, is_favorite: add, opted_out: !add };
}

export async function favorites() {
  await init();
  return { artists: [...S.favorites].sort(), opt_outs: [] };
}

// ---------------------------------------------------------------------------- lists
export async function backlogRows() {
  await init(); tick();
  return S.backlog.map((id, position) => ({ position, row: items.get(id) })).filter((x) => x.row);
}

export async function backlogSummary(limit = 10) {
  await init(); tick();
  return { backlog: backlogStatus(), current_fate: fate(), recently_cleared: clone(S.recent.slice(0, limit)), auto_clean: { enabled: S.autoClean } };
}

export async function catchUpCandidates() {
  await init(); tick();
  // "Played elsewhere, still in the backlog": a few of the build's real candidates still here.
  const t = now();
  return (live.templates.catch_up.candidates || [])
    .filter((x) => inBacklog(x.id) && x.id !== S.cur?.id)
    .slice(0, 4)
    .map((x, i) => ({ ...x, played_at: new Date(t - (6 + i * 4) * 60e3).toISOString().replace(/\.\d{3}Z$/, '.000Z') }));
}

export async function catchUp(ids) {
  await init(); tick();
  const entries = clearTracks(ids.filter((id) => inBacklog(id)), 'catch-up');
  return { cleared: entries, skipped: ids.filter((id) => !entries.some((e) => e.track_id === id)) };
}

/** Net tracks cleared in this session (clears minus undos), for the backlog insights. */
export async function sessionClears() {
  await init(); tick();
  return S.recent.filter((e) => !e.undone).length;
}

export async function sessionPlays() {
  await init(); tick();
  return clone(S.plays);
}

/** Known track rows by id (backlog + anything played this session). */
export function trackRow(id) { return items.get(id) || null; }
export function allRows() { return [...items.values()]; }
export function simSeconds() { return SIM_MS / 1000; }

// Web demo only: the API, answered in the browser. core/api.js sends every request here (see
// setTransport) instead of the network; this module returns real Response objects with the
// server's JSON shapes, from the build's fixtures (fixtures/) and the playback simulator (sim.js).
//
// - Insights, artist pages, recent plays, library and settings: fixtures crawled from the real
//   server at build time (dev/build_web_demo.py), filtered / sorted / paged here like the server.
// - What's playing, the backlog, clearing, undo, likes, keep, auto-clear and the threshold: sim.js.
// - Changes that make no sense without your own Spotify/Last.fm (settings, playlists, imports,
//   the watchlist, hiding artists) answer 409 {"error": {"code": "demo_readonly", ...}}; the UI
//   shows that as a toast.
import { load } from './fixtures.js';
import * as sim from './sim.js';
import { fold, matchRank, cmpKeys, rowsOf, clone, HttpError, DEMO_READONLY } from './util.js';

const NOT_IN_DEMO = 'Not part of the demo.';
const DISCO_NOTE = 'Their discography comes from Spotify’s catalog, which the demo doesn’t call. Run Discover Cleaner with your own Spotify to see their releases and how much of each you’ve heard.';

let manifestP = null;
const manifest = () => (manifestP ||= window.fetch.call(window, new URL('fixtures/manifest.json', document.baseURI)).then((r) => r.json()));

// ---------------------------------------------------------------------------- artist index
let indexP = null;
function artistIndex() {
  if (!indexP) {
    indexP = load('artists.json').then((t) => {
      const rows = rowsOf(t).map((r) => ({ ...r, fold: fold(r.name) }));
      const byKey = new Map();
      const byFold = new Map();
      for (const r of rows) {
        byKey.set(r.key, r);
        if (!byFold.has(r.fold)) byFold.set(r.fold, r);
      }
      return { rows, byKey, byFold };
    });
  }
  return indexP;
}

async function findArtist(name) {
  const ix = await artistIndex();
  const f = fold(name);
  return ix.byKey.get(f) || ix.byFold.get(f) || null;
}

async function listArtists(q) {
  const ix = await artistIndex();
  const hiddenFilter = q.get('hidden') || 'include';
  const sort = q.get('sort') || 'plays';
  const limit = clampInt(q.get('limit'), 50, 1, 500);
  const offset = clampInt(q.get('offset'), 0, 0, 1e7);
  let items = ix.rows;
  const hiddenTotal = items.filter((a) => a.hidden).length;
  if (hiddenFilter === 'exclude') items = items.filter((a) => !a.hidden);
  else if (hiddenFilter === 'only') items = items.filter((a) => a.hidden);
  const fq = fold(q.get('q') || '');
  if (fq) items = items.filter((a) => a.key.includes(fq) || a.fold.includes(fq));
  const keyed = {
    recent: (a) => [-(a.last_ts || 0), a.key],
    first: (a) => [-(a.first_ts || 0), a.key],
    name: (a) => [a.fold, a.key],
    plays: (a) => [-a.plays, a.fold],
  }[sort] || ((a) => [-a.plays, a.fold]);
  items = [...items].sort((x, y) => cmpKeys(keyed(x), keyed(y)));
  return {
    total: items.length,
    hidden_total: hiddenTotal,
    max_plays: items.reduce((m, a) => Math.max(m, a.plays), 0),
    items: items.slice(offset, offset + limit).map((a) => ({
      key: a.key, name: a.name, plays: a.plays, rank: a.hidden ? null : a.rank,
      first_ts: a.first_ts, last_ts: a.last_ts, hidden: !!a.hidden,
    })),
  };
}

async function artistStats(name) {
  const a = await findArtist(name);
  const live = sim.liveFixture() || (await load('live.json'));
  if (!a) {
    const out = clone(live.artist_unknown) || { found: false };
    return { ...out, name: name.trim(), key: fold(name) };
  }
  if (a.stats) {
    const m = await manifest();
    const shard = await load(`artist/${Math.floor((a.stats - 1) / (m.artist_shard || 64))}.json`);
    const st = shard[String(a.stats)];
    if (st) return st;
  }
  // Not in the fixtures: a short page from the index, honest about what's missing.
  return {
    found: true, name: a.name, key: a.key, plays: a.plays, rank: a.rank, hidden: !!a.hidden,
    total_artists: (await artistIndex()).rows.filter((r) => !r.hidden).length,
    first_ts: a.first_ts, last_ts: a.last_ts, first_is_history_start: false,
    share_pct: null, days_listened: null, songs: null, recordings: null, albums: null,
    longest_streak: null, peak_month: null, split: null, backlog: { cleared_count: 0 }, liked_count: 0,
    plays_by_month: [], plays_by_year: [], top_tracks: [], top_albums: [],
    demo_note: `${a.name}’s full history isn’t included in the demo: only their total plays, rank and first and last listen.`,
  };
}

async function artistInfo(name) {
  const a = await findArtist(name);
  const display = a?.name || name.trim();
  let info = null;
  if (a?.info) info = (await load('artist-info.json'))[String(a.info)] || null;
  const hasLastfm = !!(info && (info.bio || (info.related || []).length || (info.lastfm_tags || []).length));
  const note = info
    ? (hasLastfm
      ? 'In the demo, the cover shown is from one of their albums, and their popular tracks and discography (from Spotify) aren’t included.'
      : 'In the demo, artist pages show your own history. Spotify’s catalog (photo, popular tracks, discography) and Last.fm’s bio and similar artists aren’t included; the cover shown is from one of their albums.')
    : 'In the demo, artist pages show your own history. Spotify’s catalog (photo, popular tracks, discography) and Last.fm’s bio and similar artists aren’t included for this artist.';
  return {
    name: display, bio: null, lastfm_tags: [], related: [], top_tracks: [], spotify_genres: [],
    my_plays_available: true, spotify_limited: false, ...(info ? clone(info) : {}), demo: true, demo_note: note,
  };
}

// ---------------------------------------------------------------------------- reports
function isoDay(y, m, d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

function periodStart(period, anchor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (period === 'year') return isoDay(y, 1, 1);
  if (period === 'month') return isoDay(y, mo, 1);
  const t = Date.UTC(y, mo - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7;   // Monday = 0 (ISO weeks)
  const s = new Date(t - dow * 86400e3);
  return isoDay(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate());
}

async function report(q) {
  const period = q.get('period') || 'month';
  const anchor = q.get('anchor') || '';
  const m = await manifest();
  if (!['week', 'month', 'year', 'all', 'last7', 'last30'].includes(period)) {
    throw new HttpError(400, 'bad_request', 'period must be one of: week, month, year, all, last7, last30.', { field: 'period' });
  }
  if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new HttpError(400, 'bad_request', 'anchor must be a date like 2026-04-15.', { field: 'anchor' });
  const today = new Date(Date.now());
  const todayIso = isoDay(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (anchor && anchor > todayIso) throw new HttpError(400, 'bad_request', "anchor can't be in the future.", { field: 'anchor' });
  let data;
  if (['all', 'last7', 'last30'].includes(period)) {
    data = clone(await load(`reports/${period}.json`));
  } else {
    const starts = m.reports[period] || [];
    let start = anchor ? periodStart(period, anchor) : starts[starts.length - 1];
    if (start < starts[0]) start = starts[0];
    if (start > starts[starts.length - 1]) start = starts[starts.length - 1];
    if (!starts.includes(start)) start = starts.filter((s) => s <= start).pop() || starts[0];
    data = clone(await load(`reports/${period}/${start}.json`));
    if (anchor && periodStart(period, anchor) === start) data.period.anchor = anchor;
  }
  if (!data.definitions) data.definitions = await load('reports/definitions.json');
  return data;
}

async function yearInMusic(q) {
  const m = await manifest();
  const year = Number(q.get('year') || new Date().getFullYear() - 1);
  if (!m.years.includes(year)) throw new HttpError(404, 'not_in_demo', `There are no plays from ${year} in the demo.`);
  return load(`insights/year/${year}.json`);
}

// ---------------------------------------------------------------------------- history + search
let historyP = null;
const historyRows = () => (historyP ||= load('library/history.json').then(rowsOf));

async function history(q) {
  const limit = clampInt(q.get('limit'), 50, 1, 200);
  const before = q.get('before_ms') ? Number(q.get('before_ms')) : null;
  const artist = q.get('artist') ? fold(q.get('artist')) : null;
  const text = (q.get('q') || '').trim().toLowerCase();
  const rows = [...(await sim.sessionPlays()), ...(await historyRows())];
  const ix = await artistIndex();
  const hidden = new Set(ix.rows.filter((r) => r.hidden).map((r) => r.key));
  let list = rows.filter((r) => (!artist || r.artist_key === artist)
    && (!text || [r.track, r.artist, r.album].some((v) => String(v || '').toLowerCase().includes(text))));
  list.sort((a, b) => b.ts_ms - a.ts_ms || b.id - a.id);
  if (before != null) list = list.filter((r) => r.ts_ms < before);
  let page = list.slice(0, limit);
  if (list.length > limit && page.length) {
    const lastTs = page[page.length - 1].ts_ms;
    page = page.concat(list.slice(limit).filter((r) => r.ts_ms === lastTs));
  }
  const more = list.length > page.length;
  return {
    items: page.map((r) => ({ ...r, hidden: hidden.has(r.artist_key) })),
    next_before_ms: more && page.length ? page[page.length - 1].ts_ms : null,
    // The fixture holds the most recent plays only: say so instead of "the start of your history".
    ...(more ? {} : { demo_end: `Older plays aren’t included in the demo, which carries the ${(await historyRows()).length.toLocaleString('en-US')} most recent. Insights and artist pages cover the whole history, back to 2021.` }),
  };
}

let libraryP = null;
const library = () => (libraryP ||= load('library/search.json'));

async function searchLocal(q) {
  const fq = fold(q.get('q') || '');
  const limit = clampInt(q.get('limit'), 8, 1, 50);
  if (!fq) return { artists: [], tracks: [], albums: [] };
  const ix = await artistIndex();
  const lib = await library();
  const arts = [];
  for (const a of ix.rows) {
    let r = matchRank(a.fold, fq);
    if (r == null && a.key.includes(fq)) r = 3;
    if (r != null) arts.push([r, -a.plays, a.key, a]);
  }
  arts.sort((x, y) => cmpKeys(x.slice(0, 3), y.slice(0, 3)));
  const nameOf = (k) => ix.byKey.get(k)?.name || k;
  const trs = [];
  for (const [name, aKey, plays, spId, sKey] of lib.tracks) {
    const r = matchRank(fold(name), fq);
    if (r != null) trs.push([r, -plays, name, aKey, plays, spId, sKey]);
  }
  trs.sort((x, y) => cmpKeys(x.slice(0, 3), y.slice(0, 3)));
  const als = [];
  for (const [name, aKey, plays, alKey] of lib.albums) {
    const r = matchRank(fold(name), fq);
    if (r != null) als.push([r, -plays, name, aKey, plays, alKey]);
  }
  als.sort((x, y) => cmpKeys(x.slice(0, 3), y.slice(0, 3)));
  return {
    artists: arts.slice(0, limit).map(([, , , a]) => ({ name: a.name, key: a.key, plays: a.plays })),
    tracks: trs.slice(0, limit).map((t) => ({ name: t[2], artist: nameOf(t[3]), artist_key: t[3], plays: t[4], spotify_track_id: t[5] || null, song_key: t[6] })),
    albums: als.slice(0, limit).map((a) => ({ name: a[2], artist: nameOf(a[3]), artist_key: a[3], plays: a[4], album_key: a[5] })),
  };
}

/** Tracks the simulated Spotify "has": the backlog, liked songs and anything played here. */
async function catalog() {
  await sim.init();
  const liked = (await load('library/liked.json')).tracks || [];
  const seen = new Map();
  for (const r of sim.allRows()) seen.set(r.id, r);
  for (const t of liked) {
    if (!seen.has(t.id)) {
      seen.set(t.id, { id: t.id, uri: t.uri, name: t.name, artists: t.artists || t.artist, artist_list: [{ id: null, name: t.artist }], album: t.album, image: t.image, duration_ms: t.duration_ms });
    }
  }
  return [...seen.values()];
}

async function spotifySearch(q) {
  const words = fold(q.get('q') || '').replace(/\b(artist|track|album):/g, ' ').replace(/"/g, ' ').split(' ').filter(Boolean);
  if (!words.length) return { tracks: [], artists: [] };
  const rows = (await catalog()).filter((r) => {
    const hay = fold(`${r.name} ${(r.artist_list || []).map((a) => a.name).join(' ')} ${r.artists || ''}`);
    return words.every((w) => hay.includes(w));
  });
  const tracks = rows.slice(0, 10).map((r) => ({
    album: r.album || '', album_id: null, artist_list: (r.artist_list || []).map((a) => ({ id: null, name: a.name })),
    artists: r.artists || '', duration_ms: r.duration_ms || 0, id: r.id, image: r.image || null, name: r.name, uri: r.uri || `spotify:track:${r.id}`,
  }));
  const artists = [];
  const seen = new Set();
  for (const r of rows) {
    for (const a of r.artist_list || []) {
      const k = fold(a.name);
      if (seen.has(k) || !words.every((w) => k.includes(w))) continue;
      seen.add(k);
      artists.push({ genres: [], id: null, image: r.image || null, name: a.name, url: '' });
    }
  }
  return { tracks, artists: artists.slice(0, 5) };
}

const resolved = new Map();   // pseudo ids of tracks played from history -> row

async function resolve(q) {
  const artist = (q.get('artist') || '').trim();
  const track = (q.get('track') || '').trim();
  if (!artist) throw new HttpError(400, 'invalid_artist', 'artist is required.', { field: 'artist' });
  const fa = fold(artist);
  const ft = fold(track);
  const rows = await catalog();
  let row = rows.find((r) => fold(r.name) === ft && (r.artist_list || []).some((a) => fold(a.name) === fa));
  if (!row && track) {
    // Not in the simulated catalog: play it anyway (the demo has no real Spotify to ask).
    const lib = await library();
    const hit = lib.tracks.find(([name, aKey]) => aKey === fa && fold(name) === ft);
    const hist = (await historyRows()).find((r) => r.artist_key === fa && fold(r.track) === ft);
    const id = hit?.[3] || hist?.spotify_track_id || `demo${Math.abs(hash(`${fa}|${ft}`)).toString(36)}`;
    row = { id, uri: `spotify:track:${id}`, name: hit?.[0] || hist?.track || track, artists: artist, artist_list: [{ id: null, name: artist }], album: hist?.album || '', image: hist?.image || null, duration_ms: 0 };
    resolved.set(id, row);
  }
  const t = row ? {
    id: row.id, uri: row.uri || `spotify:track:${row.id}`, name: row.name, artist_list: (row.artist_list || []).map((a) => ({ id: null, name: a.name })),
    album: row.album || '', image: row.image || null, image_large: row.image || null, duration_ms: row.duration_ms || 0,
    url: String(row.id).startsWith('demo') ? null : `https://open.spotify.com/track/${row.id}`, exact: true,
  } : null;
  return { track: t, artist: { id: null, name: artist, image: null, image_large: null, uri: null, url: null, exact: true } };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function playTrack(body) {
  const uri = String(body?.uri || '');
  const m = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri.trim());
  if (!m) throw new HttpError(400, 'bad_request', 'Missing or invalid track uri (expected spotify:track:<id>).');
  const id = m[1];
  await sim.init();
  let row = sim.trackRow(id) || resolved.get(id) || (await catalog()).find((r) => r.id === id);
  if (!row) {
    // A track from the history (artist pages, reports): name it from the local library.
    const lib = await library();
    const hit = lib.tracks.find((t) => t[3] === id);
    const hist = (await historyRows()).find((r) => r.spotify_track_id === id);
    const ix = await artistIndex();
    const artist = hit ? (ix.byKey.get(hit[1])?.name || hit[1]) : (hist?.artist || 'Unknown artist');
    row = { id, uri, name: hit?.[0] || hist?.track || 'Unknown track', artists: artist, artist_list: [{ id: null, name: artist }], album: hist?.album || '', image: hist?.image || null, duration_ms: 0 };
  }
  return sim.playTrack(id, row);
}

// ---------------------------------------------------------------------------- library
async function likedSongs(q) {
  const lk = await load('library/liked.json');
  await sim.init();
  const added = sim.likedAdded();
  const addedIds = new Set(added.map((t) => t.id));
  const all = [...added, ...(lk.tracks || []).filter((t) => !addedIds.has(t.id))];
  const limit = clampInt(q.get('limit'), 50, 1, 50);
  const offset = clampInt(q.get('offset'), 0, 0, 1e6);
  const page = all.slice(offset, offset + limit);
  return { limit, offset, total: all.length, tracks: page, next_offset: offset + page.length < all.length ? offset + page.length : null };
}

async function playCounts(body) {
  const counts = await load('library/track-counts.json');
  const lib = await library();
  const ix = await artistIndex();
  const tracks = (Array.isArray(body?.tracks) ? body.tracks : []).map((t) => {
    const k = `${String(t.artist || '').toLowerCase()}|${String(t.name || '').toLowerCase()}|${t.id || ''}`;
    if (k in counts) return counts[k];
    const fa = fold(t.artist);
    const ft = fold(t.name);
    const hit = lib.tracks.find(([name, aKey, , spId]) => (t.id && spId === t.id) || (aKey === fa && fold(name) === ft));
    return hit ? hit[2] : 0;
  });
  const artists = {};
  for (const a of Array.isArray(body?.artists) ? body.artists : []) {
    const r = ix.byKey.get(fold(a)) || ix.byFold.get(fold(a));
    artists[a] = r ? r.plays : 0;
  }
  return { tracks, artists };
}

async function research(q) {
  const r = await load('library/research.json');
  const status = q.get('status');
  const type = q.get('entity_type');
  const base = clone(status === 'active' ? r.active : r.all);
  if (type && Array.isArray(base.items)) base.items = base.items.filter((it) => it.entity_type === type);
  return base;
}

async function backlogTracks(q) {
  const live = sim.liveFixture() || (await load('live.json'));
  const offset = clampInt(q.get('offset'), 0, 0, 1e7);
  const limit = clampInt(q.get('limit'), 100, 1, 500);
  const text = (q.get('q') || '').trim();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (await sim.backlogRows()).filter(({ row }) => {
    if (!words.length) return true;
    const hay = `${row.name || ''} ${row.artists || ''} ${row.album || ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const summary = await sim.backlogSummary(0);
  return {
    playlist_id: live.backlog.meta.playlist_id, name: live.backlog.meta.name,
    total: summary.backlog.total, known: summary.backlog.known, complete: true, loading: false,
    removal_seq: summary.backlog.removal_seq, offset, limit, q: text, matched: rows.length,
    items: rows.slice(offset, offset + limit).map(({ position, row }) => ({ ...clone(row), position })),
  };
}

/** The build's backlog insights plus what was cleared in this session, so Now's backlog card
 *  and Insights -> Backlog agree with the live counts. */
async function backlogInsights() {
  const d = clone(await load('insights/backlog.json'));
  const n = await sim.sessionClears();
  const total = (await sim.backlogSummary(0)).backlog.total;
  d.current_total = total;
  for (const w of Object.values(d.windows || {})) {
    w.cleared = (w.cleared || 0) + n;
    w.end_total = total;
    if (w.net != null) w.net -= n;
    if (w.measured) {
      w.measured.cleared = (w.measured.cleared || 0) + n;
      w.measured.end_total = total;
      if (w.measured.net != null) w.measured.net -= n;
    }
  }
  const week = (d.weekly || []).find((x) => x.current);
  if (week) { week.cleared += n; week.end_total = total; }
  const last = (d.trajectory || [])[d.trajectory.length - 1];
  if (last) last.total = total;
  return d;
}

// ---------------------------------------------------------------------------- routing
function clampInt(raw, dflt, lo, hi) {
  if (raw == null || raw === '') return dflt;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new HttpError(400, 'bad_request', 'Expected a whole number.');
  return Math.max(lo, Math.min(hi, n));
}

const settingsPart = (k) => load('settings.json').then((s) => s[k]);

const GET = {
  '/api/status': () => sim.status(),
  '/api/v2/reports': (q) => report(q),
  '/api/v2/insights/overview': () => load('insights/overview.json'),
  '/api/v2/insights/year-in-music': (q) => yearInMusic(q),
  '/api/v2/backlog/insights': () => backlogInsights(),
  '/api/v2/artists': (q) => listArtists(q),
  '/api/artist-info': (q) => artistInfo(q.get('artist_name') || ''),
  '/api/artist/discography': () => { throw new HttpError(404, 'demo_unavailable', DISCO_NOTE); },
  '/api/artist/discography/release': () => { throw new HttpError(404, 'demo_unavailable', 'Track lists come from Spotify’s catalog, which the demo doesn’t call.'); },
  '/api/v2/history': (q) => history(q),
  '/api/v2/search/local': (q) => searchLocal(q),
  '/api/search': (q) => spotifySearch(q),
  '/api/v2/resolve': (q) => resolve(q),
  '/api/v2/backlog': (q) => sim.backlogSummary(clampInt(q.get('limit'), 10, 0, 50)),
  '/api/v2/backlog/tracks': (q) => backlogTracks(q),
  '/api/v2/backlog/catch-up': async () => ({ candidates: await sim.catchUpCandidates(), complete: true }),
  '/api/liked-songs': (q) => likedSongs(q),
  '/api/favorites': () => sim.favorites(),
  '/api/favorites/overview': () => load('library/favorites.json'),
  '/api/v2/watchlist': () => load('library/watchlist.json'),
  '/api/research': (q) => research(q),
  '/api/research/seed-tags': () => load('library/research.json').then((r) => r.seed_tags),
  '/api/settings': () => settingsPart('settings'),
  '/api/v2/data/health': () => settingsPart('health'),
  '/api/lastfm/import': () => settingsPart('lastfm_import'),
  '/api/spotify/import': () => settingsPart('spotify_import'),
  '/api/v2/setup': () => settingsPart('setup'),
  '/api/playlists': () => settingsPart('playlists'),
  '/api/dev/spotify-calls': () => settingsPart('spotify_calls'),
  '/api/dev/errors': () => settingsPart('dev_errors'),
  '/api/v2/data/lastfm/check': () => { throw new HttpError(409, 'demo_readonly', 'The demo has no Last.fm account to check.'); },
};

const POST = {
  '/api/client-state': () => ({ ok: true }),
  '/api/playback/toggle': () => sim.toggle(),
  '/api/playback/next': () => sim.skip('next'),
  '/api/playback/prev': () => sim.skip('prev'),
  '/api/seek': (b) => sim.seek(b?.position_ms),
  '/api/play-track': (b) => playTrack(b),
  '/api/v2/backlog/play': (b) => sim.playBacklog(!!b?.shuffle),
  '/api/like': (b) => sim.like(b?.track_id),
  '/api/v2/backlog/keep': (b) => sim.keep(b?.track_id, b?.kept !== false),
  '/api/v2/backlog/clear': (b) => sim.clear(String(b?.track_id || ''), !!b?.skip),
  '/api/skip-remove': async (b) => { await sim.clear(String(b?.track_id || ''), true); return { message: 'Cleared and skipped.', removed: true }; },
  '/api/v2/backlog/undo': (b) => sim.undo(b?.seq),
  '/api/v2/backlog/auto-clean': (b) => sim.setAutoClean(!!b?.enabled),
  '/api/v2/backlog/sync': async () => ({ backlog: (await sim.backlogSummary(0)).backlog }),
  '/api/v2/backlog/catch-up': (b) => sim.catchUp(Array.isArray(b?.track_ids) ? b.track_ids.map(String) : []),
  '/api/threshold': (b) => sim.setThreshold(b?.seconds ?? b?.threshold),
  '/api/lyrics-offset': (b) => sim.setLyricsOffset(b?.offset_ms),
  '/api/favorites': (b) => sim.favorite(String(b?.action || 'toggle').toLowerCase(), String(b?.artist || '')),
  '/api/v2/library/play-counts': (b) => playCounts(b),
};

async function route(method, url, body) {
  const path = url.pathname;
  const q = url.searchParams;
  if (method === 'GET') {
    const h = GET[path];
    if (h) return h(q);
    const m = /^\/api\/v2\/artist\/(.+)\/stats$/.exec(path);
    if (m) return artistStats(decodeURIComponent(m[1]));
    throw new HttpError(404, 'not_found', NOT_IN_DEMO);
  }
  const h = POST[path];
  if (h && method === 'POST') return h(body);
  // Everything else changes your own accounts or files (READONLY below and any other write).
  if (path.startsWith('/api/')) throw DEMO_READONLY();
  throw new HttpError(404, 'not_found', NOT_IN_DEMO);
}

// Writes the interface can send that the demo answers with 409 demo_readonly (besides the
// POST/PATCH twins of GET routes above: /api/settings, /api/research, /api/lastfm/import, ...).
// tests/test_web_demo.py checks that every API path in static/js is in GET, POST or here.
export const READONLY = [
  '/api/set-playlist', '/api/add-to-playlist', '/api/dev/clear-guard', '/api/research/<id>',
  '/api/v2/artist/<name>/hide',
];

// Album art lives on Spotify's image CDN. When the page can't load it (a stricter CSP, offline),
// main.js calls setImagesBlocked() and from then on responses carry no cover URLs, so the
// interface draws its own placeholders instead of broken images.
const ART = 'https://i.scdn.co/';
let imagesBlocked = false;
export function setImagesBlocked() { imagesBlocked = true; }
const noArt = (k, v) => (typeof v === 'string' && v.startsWith(ART) ? null : v);

function respond(status, data) {
  const body = JSON.stringify(data ?? null, imagesBlocked ? noArt : undefined);
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

/** fetch()-compatible transport for core/api.js: (url, init) -> Promise<Response>. */
export async function transport(input, init = {}) {
  const signal = init.signal;
  const abortErr = () => (signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
  if (signal?.aborted) throw abortErr();
  const url = new URL(String(input), document.baseURI);
  const method = String(init.method || 'GET').toUpperCase();
  let body = null;
  if (init.body != null) {
    try { body = JSON.parse(init.body); } catch { return respond(400, { error: { code: 'invalid_body', message: 'The request body must be a JSON object.' } }); }
  }
  const work = (async () => {
    try {
      return respond(200, await route(method, url, body));
    } catch (err) {
      if (err instanceof HttpError) return respond(err.status, err.body);
      if (err?.name === 'FixtureError' && err.status === 404) return respond(404, { error: { code: 'not_in_demo', message: 'That isn’t included in the demo.' } });
      console.error('demo API error', method, url.pathname, err);
      return respond(500, { error: { code: 'demo_error', message: err?.message || 'The demo hit an error.' } });
    }
  })();
  if (!signal) return work;
  return Promise.race([work, new Promise((_, reject) => signal.addEventListener('abort', () => reject(abortErr()), { once: true }))]);
}

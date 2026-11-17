// Search results (#/search?q=…): your library first (GET /api/v2/search/local — instant, offline)
// then Spotify (GET /api/search — may be cooling down). Spotify results are annotated with your
// own plays so you can tell what's new to you at a glance.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import {
  html, mount, icon, fmt, thumb, artistLink, artistLinks, actions, pageHeader, loadingState, emptyState, errorState,
  sectionHeader, initialsAvatar, notice,
} from '../core/ui.js';
import { playButton, moreButton, openTrackMenu, playCounts, coolingDownText } from './library-shared.js';

const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const PLAYS_DEF = 'Plays in your whole listening history (Last.fm scrobbles plus plays in the app).';

let root = null;
let off = [];
let ctrl = null;
let st = null;

function avatar(name, image, size = 56) {
  if (image) return thumb(image, { round: true, alt: '', size });
  return initialsAvatar(name, { size, className: 'srch-avatar' });
}

function pickTop(q, local, spotify) {
  const fq = fold(q);
  const la = local?.artists || [];
  const sa = spotify?.artists || [];
  const lt = local?.tracks || [];
  const exactLocal = la.find((a) => fold(a.name) === fq);
  if (exactLocal) return { type: 'artist', name: exactLocal.name, plays: exactLocal.plays, image: sa.find((s) => fold(s.name) === fold(exactLocal.name))?.image };
  const exactSp = sa.find((a) => fold(a.name) === fq);
  if (exactSp) return { type: 'artist', name: exactSp.name, plays: null, image: exactSp.image, spotify: true, genres: exactSp.genres };
  const exactTrack = lt.find((t) => fold(t.name) === fq);
  if (exactTrack) return { type: 'track', ...exactTrack };
  if (la[0]) return { type: 'artist', name: la[0].name, plays: la[0].plays, image: sa.find((s) => fold(s.name) === fold(la[0].name))?.image };
  if (lt[0]) return { type: 'track', ...lt[0] };
  if (sa[0]) return { type: 'artist', name: sa[0].name, plays: null, image: sa[0].image, spotify: true, genres: sa[0].genres };
  const stt = spotify?.tracks?.[0];
  if (stt) return { type: 'sptrack', ...stt };
  return null;
}

function topCard(top, spPlays, mine) {
  if (!top) return '';
  if (top.type === 'artist') {
    const plays = top.plays ?? spPlays.artists?.[top.name] ?? null;
    const facts = [];
    if (mine?.rank && mine?.total) facts.push(`#${fmt.num(mine.rank)} of ${fmt.num(mine.total)} artists you've played`);
    if (mine?.first_ts) facts.push(`first heard ${fmt.date(mine.first_ts, { year: 'always' })}`);
    return html`<a class="card srch-top" href="${router.href('artist', { name: top.name })}">
      ${avatar(top.name, top.image, 96)}
      <div class="srch-top-name">${top.name}</div>
      <div class="srch-top-meta"><span class="chip">Artist</span>${plays ? html`<span>${fmt.plural(plays, 'play')}</span>` : plays === 0 ? html`<span>New to you</span>` : ''}${top.genres?.length ? html`<span class="muted">${top.genres.slice(0, 2).join(', ')}</span>` : ''}</div>
      ${facts.length ? html`<div class="srch-top-facts">${facts.join(' · ')}</div>` : ''}
    </a>`;
  }
  const isSp = top.type === 'sptrack';
  const artist = isSp ? (top.artist_list?.[0]?.name || '') : top.artist;
  return html`<div class="card srch-top">
    ${thumb(top.image, { alt: '', size: 96 })}
    <div class="srch-top-name">${top.name}</div>
    <div class="srch-top-meta"><span class="chip">Song</span><span>${isSp ? artistLinks(top.artist_list || top.artists) : artistLink(artist)}</span>${!isSp && top.plays ? html`<span>${fmt.plural(top.plays, 'play')}</span>` : ''}</div>
    <div class="srch-top-actions">${isSp
      ? html`<button type="button" class="btn btn-primary" data-action="play-uri" data-uri="${top.uri}" data-name="${top.name}">${icon('play')}Play</button>`
      : top.spotify_track_id
        ? html`<button type="button" class="btn btn-primary" data-action="play-uri" data-uri="spotify:track:${top.spotify_track_id}" data-name="${top.name}">${icon('play')}Play</button>`
        : html`<button type="button" class="btn btn-primary" data-action="play-track" data-artist="${artist}" data-name="${top.name}">${icon('play')}Play</button>`}</div>
  </div>`;
}

function localTrackRow(t, i, prefix = 'lt') {
  const key = `${prefix}${i}`;
  return html`<div class="list-row lib-row srch-row" role="listitem" data-key="${key}">
    ${prefix === 'at' ? html`<span class="srch-rank num">${i + 1}</span>` : thumb(undefined, { alt: '' })}
    <div class="row-main"><div class="row-title">${t.name}</div><div class="row-sub">${artistLink(t.artist)}</div></div>
    <span class="row-meta">${fmt.plural(t.plays, 'play')}</span>
    <div class="row-actions">${playButton({ id: t.spotify_track_id, name: t.name, artist: t.artist })}${moreButton(`More actions for ${t.name}`, { key })}</div>
  </div>`;
}

function spTrackRow(t, i, plays) {
  const n = plays?.[i];
  return html`<div class="list-row lib-row srch-row" role="listitem" data-key="st${i}">
    ${thumb(t.image, { alt: '' })}
    <div class="row-main"><div class="row-title">${t.name}</div><div class="row-sub">${artistLinks(t.artist_list?.length ? t.artist_list : t.artists)}${t.album ? html`<span class="lib-album"> · ${t.album}</span>` : ''}</div></div>
    <span class="row-meta">${n == null ? '' : n > 0 ? html`<span class="srch-yours">${fmt.plural(n, 'play')}</span>` : html`<span class="srch-new">New to you</span>`}</span>
    <div class="row-actions">${playButton({ uri: t.uri, id: t.id, name: t.name })}${moreButton(`More actions for ${t.name}`, { key: `st${i}` })}</div>
  </div>`;
}

function render() {
  if (!root || !st) return;
  const { q } = st;
  const body = root.querySelector('[data-results]');
  if (!q) {
    mount(body, emptyState({ icon: 'search', title: 'Search your music', body: 'Type in the search box at the top (press / to jump there). Results cover your whole listening history and Spotify.' }));
    return;
  }
  if (st.localLoading && st.spLoading) { mount(body, loadingState(`Searching for “${q}”…`)); return; }
  const local = st.local || { artists: [], tracks: [], albums: [] };
  const sp = st.spotify || { tracks: [], artists: [] };
  const nothingLocal = !local.artists.length && !local.tracks.length && !local.albums.length;
  const nothingSp = !sp.tracks.length && !sp.artists.length;
  if (!st.localLoading && !st.spLoading && nothingLocal && nothingSp) {
    mount(body, html`${emptyState({ icon: 'search', title: `No results for “${q}”`, body: st.spError ? `Nothing in your history matches. ${spNote(st.spError)}` : 'Check the spelling, or try fewer words — an artist name alone works well.' })}`);
    return;
  }
  const top = pickTop(q, local, sp);
  const spPlays = st.spPlays || { tracks: [], artists: {} };
  const artistTop = top?.type === 'artist' && st.artistTop && fold(st.artistTop.name) === fold(top.name) && st.artistTop.tracks.length ? st.artistTop : null;
  const otherArtists = local.artists.filter((a) => !(top?.type === 'artist' && fold(a.name) === fold(top.name)));
  const matchedSongs = st.localLoading ? loadingState('Searching your history…', { compact: true })
    : st.localError ? errorState(st.localError, { compact: true, title: "Couldn't search your history", retry: () => runLocal() })
      : local.tracks.length ? html`<div class="list lib-list" role="list">${local.tracks.slice(0, artistTop ? 8 : 5).map(localTrackRow)}</div>`
        : html`<p class="muted srch-none">No song titles in your history match.</p>`;
  mount(body, html`
    <div class="srch-grid">
      <section class="srch-top-wrap" aria-labelledby="srch-top-h">
        <h2 class="section-title" id="srch-top-h">Top result</h2>
        ${top ? topCard(top, spPlays, artistTop) : st.localLoading || st.spLoading ? loadingState('Searching…', { compact: true }) : emptyState({ compact: true, icon: 'search', title: 'No top match' })}
      </section>
      <section aria-labelledby="srch-songs-h" class="srch-songs">
        ${artistTop
          ? html`${sectionHeader({ id: 'srch-songs-h', title: `Your top songs by ${artistTop.name}`, info: PLAYS_DEF })}
            <div class="list lib-list" role="list">${artistTop.tracks.map((t, i) => localTrackRow({ name: t.name, artist: artistTop.name, plays: t.plays, spotify_track_id: t.spotify_track_id }, i, 'at'))}</div>`
          : html`${sectionHeader({ id: 'srch-songs-h', title: 'Songs you’ve played', info: PLAYS_DEF })}${matchedSongs}`}
      </section>
    </div>
    ${artistTop && local.tracks.length ? html`<section class="section" aria-labelledby="srch-match-h">
      ${sectionHeader({ id: 'srch-match-h', title: 'Songs you’ve played', info: PLAYS_DEF })}${matchedSongs}
    </section>` : ''}
    ${otherArtists.length ? html`<section class="section" aria-labelledby="srch-artists-h">
      ${sectionHeader({ id: 'srch-artists-h', title: top?.type === 'artist' ? 'Other artists you’ve played' : 'Artists you’ve played', info: PLAYS_DEF })}
      <ul class="srch-artists" role="list">${otherArtists.map((a) => html`<li><a class="srch-artist" href="${router.href('artist', { name: a.name })}">
        ${avatar(a.name, sp.artists.find((s) => fold(s.name) === fold(a.name))?.image, 96)}
        <span class="srch-artist-name">${a.name}</span><span class="srch-artist-meta">${fmt.plural(a.plays, 'play')}</span></a></li>`)}</ul>
    </section>` : ''}
    ${local.albums.length ? html`<section class="section" aria-labelledby="srch-albums-h">
      ${sectionHeader({ id: 'srch-albums-h', title: 'Albums you’ve played', info: PLAYS_DEF })}
      <div class="list lib-list srch-albums" role="list">${local.albums.map((a) => html`<div class="list-row lib-row srch-row" role="listitem">
        ${thumb(undefined, { alt: '', iconName: 'disc' })}
        <div class="row-main"><div class="row-title">${a.name}</div><div class="row-sub">${artistLink(a.artist)}</div></div>
        <span class="row-meta">${fmt.plural(a.plays, 'play')}</span><span class="row-action-slot" aria-hidden="true"></span>
      </div>`)}</div>
    </section>` : ''}
    <section class="section srch-spotify" aria-labelledby="srch-sp-h">
      ${sectionHeader({ id: 'srch-sp-h', title: 'On Spotify', desc: 'Everything on Spotify, marked with your plays — “New to you” means it isn’t in your history yet.' })}
      ${st.spLoading ? loadingState('Asking Spotify…', { compact: true })
        : st.spError ? notice({
          tone: 'warning', icon: st.spError.isRateLimited ? 'hourglass' : 'alert', className: 'lib-notice', role: 'status',
          body: spNote(st.spError),
          actions: st.spError.isRateLimited ? '' : html`<button type="button" class="btn btn-secondary btn-sm" data-action="srch-retry-sp">${icon('refresh')}Try again</button>`,
        })
          : nothingSp ? html`<p class="muted srch-none">Spotify found nothing for “${q}”.</p>`
            : html`<div class="srch-sp-grid">
              <div>
                <h3 class="section-title section-title-sm srch-sub-h">Songs</h3>
                ${sp.tracks.length ? html`<div class="list lib-list" role="list">${sp.tracks.map((t, i) => spTrackRow(t, i, spPlays.tracks))}</div>` : html`<p class="muted srch-none">No songs.</p>`}
              </div>
              <div>
                <h3 class="section-title section-title-sm srch-sub-h">Artists</h3>
                ${sp.artists.length ? html`<ul class="srch-sp-artists" role="list">${sp.artists.map((a) => {
                  const n = spPlays.artists?.[a.name];
                  return html`<li><a class="list-row lib-row srch-sp-artist" href="${router.href('artist', { name: a.name })}">
                    ${avatar(a.name, a.image, 40)}
                    <span class="row-main"><span class="row-title">${a.name}</span><span class="row-sub">${a.genres?.length ? a.genres.slice(0, 2).join(', ') : 'Artist'}</span></span>
                    <span class="row-meta">${n == null ? '' : n > 0 ? html`<span class="srch-yours">${fmt.plural(n, 'play')}</span>` : html`<span class="srch-new">New to you</span>`}</span>
                  </a></li>`;
                })}</ul>` : html`<p class="muted srch-none">No artists.</p>`}
              </div>
            </div>`}
    </section>`);
}

function spNote(err) {
  if (!err) return '';
  if (err.isRateLimited) return `${coolingDownText(err)} Your library results still work.`;
  if (err.status === 401) return 'Connect Spotify in Settings to search Spotify too. Your library results still work.';
  return `Spotify search didn't work: ${err.message} Your library results still work.`;
}

async function runLocal() {
  const my = st;
  my.localLoading = true;
  my.localError = null;
  render();
  try {
    my.local = await api.get('/api/v2/search/local', { params: { q: my.q, limit: 12 }, signal: ctrl.signal, timeoutMs: 10000 });
  } catch (err) {
    if (isAbort(err)) return;
    my.localError = err;
  }
  if (my !== st) return;
  my.localLoading = false;
  render();
  // An artist you know as the likely top result: show your own top songs by them.
  const cand = my.local ? pickTop(my.q, my.local, null) : null;
  if (cand?.type === 'artist' && cand.plays > 0) {
    try {
      const r = await api.get(`/api/v2/artist/${encodeURIComponent(cand.name)}/stats`, { signal: ctrl.signal, timeoutMs: 10000 });
      if (my !== st) return;
      my.artistTop = { name: cand.name, tracks: (r?.top_tracks || []).slice(0, 5), rank: r?.rank, total: r?.total_artists, first_ts: r?.first_ts };
      render();
    } catch { /* optional */ }
  }
}

async function runSpotify() {
  const my = st;
  my.spLoading = true;
  my.spError = null;
  render();
  try {
    my.spotify = await api.get('/api/search', { params: { q: my.q, type: 'track,artist' }, signal: ctrl.signal, timeoutMs: 15000 });
  } catch (err) {
    if (isAbort(err)) return;
    my.spError = err;
  }
  if (my !== st) return;
  my.spLoading = false;
  render();
  const sp = my.spotify;
  if (sp && (sp.tracks?.length || sp.artists?.length)) {
    try {
      my.spPlays = await playCounts({
        tracks: (sp.tracks || []).map((t) => ({ id: t.id, name: t.name, artist: t.artist_list?.[0]?.name || (t.artists || '').split(', ')[0] })),
        artists: (sp.artists || []).map((a) => a.name),
      }, { signal: ctrl.signal });
      if (my === st) render();
    } catch { /* optional */ }
  }
}

function start(q) {
  if (ctrl) ctrl.abort();
  ctrl = new AbortController();
  st = { q, local: null, spotify: null, spPlays: null, localLoading: !!q, spLoading: !!q, localError: null, spError: null };
  const title = root.querySelector('.page-title');
  if (title) title.textContent = q ? `Results for “${q}”` : 'Search';
  render();
  if (!q) return;
  runLocal();
  runSpotify();
}

function rowTrack(key) {
  if (!st) return null;
  if (key.startsWith('lt')) {
    const t = st.local?.tracks?.[Number(key.slice(2))];
    return t ? { id: t.spotify_track_id, name: t.name, artist: t.artist } : null;
  }
  if (key.startsWith('at')) {
    const t = st.artistTop?.tracks?.[Number(key.slice(2))];
    return t ? { id: t.spotify_track_id, name: t.name, artist: st.artistTop.name } : null;
  }
  const t = st.spotify?.tracks?.[Number(key.slice(2))];
  return t ? { id: t.id, name: t.name, artist: t.artist_list?.[0]?.name || (t.artists || '').split(', ')[0], image: t.image } : null;
}

export default {
  id: 'search',
  title: 'Search',
  mount(el, params, ctx) {
    root = el;
    const q = String(params?.q || '').trim();
    mount(root, html`${pageHeader({ title: q ? `Results for “${q}”` : 'Search', desc: 'Your listening history first, then Spotify. Play anything, or open an artist to see your history with them.' })}
      <div class="srch-body" data-results></div>`);
    off.push(actions(root, {
      'srch-retry-sp': () => runSpotify(),
      'lib-more': (ds, btn) => { const t = rowTrack(ds.key); if (t) openTrackMenu(btn, t); },
    }));
    ctx?.setTitle?.(q ? `“${q}” · Search` : 'Search');
    start(q);
  },
  update(params, ctx) {
    const q = String(params?.q || '').trim();
    if (st && q === st.q) return;
    ctx?.setTitle?.(q ? `“${q}” · Search` : 'Search');
    start(q);
  },
  unmount() {
    if (ctrl) ctrl.abort();
    off.forEach((fn) => fn());
    off = [];
    root = null;
    st = null;
  },
};

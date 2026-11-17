// Helpers shared by the library tabs and the search results page.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import { html, raw, icon, fmt, artistLink, menu, toast, reportError, safeUrl, toDate, escapeHtml } from '../core/ui.js';
import { openWatchlistDialog } from '../components/watchlist-dialog.js';
import { playUri, playTrack } from '../components/player.js';

export const DASH = '—';

/** "4:12 PM" (local). */
export function timeOfDay(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : DASH;
}

/** Primary artist as a link + the rest of a joined credit as plain text (never split "Tyler, The Creator"). */
export function creditLinks(primary, joined) {
  const p = String(primary || '').trim();
  const all = String(joined || '').trim();
  if (!p) return all ? html`<span>${all}</span>` : '';
  const rest = all.startsWith(`${p}, `) ? all.slice(p.length + 2) : '';
  return html`${artistLink(p)}${rest ? html`<span class="lib-rest">, ${rest}</span>` : ''}`;
}

/** Play button for a row: a known uri plays directly; otherwise it is looked up on Spotify on click. */
export function playButton({ uri, id, name, artist, label } = {}) {
  const u = uri || (id ? `spotify:track:${id}` : '');
  const aria = label || `Play ${name || 'track'}`;
  if (u) return html`<button type="button" class="btn btn-icon btn-sm" data-action="play-uri" data-uri="${u}" data-name="${name || ''}" aria-label="${aria}" data-tip="Play">${icon('play')}</button>`;
  if (artist && name) return html`<button type="button" class="btn btn-icon btn-sm" data-action="play-track" data-artist="${artist}" data-name="${name}" aria-label="${aria}" data-tip="Find on Spotify and play">${icon('play')}</button>`;
  return html`<span class="row-action-slot" aria-hidden="true"></span>`;
}

export function moreButton(label, data = {}) {
  const attrs = Object.entries(data).map(([k, v]) => raw(` data-${k.replace(/[^a-z0-9-]/gi, '')}="${escapeHtml(v)}"`));
  return html`<button type="button" class="btn btn-icon btn-sm" data-action="lib-more"${attrs} aria-haspopup="menu" aria-expanded="false" aria-label="${label}" data-tip="More">${icon('more')}</button>`;
}

/**
 * Standard track menu: open artist, extra items, save to watchlist, open in Spotify.
 * t: {id, name, artist, artistLabel?, image?, url?}
 */
export function openTrackMenu(anchor, t, { extra = [], label } = {}) {
  const items = [];
  if (t.artist) items.push({ label: `Open ${t.artist}`, icon: 'artists', href: router.href('artist', { name: t.artist }) });
  items.push(...extra);
  items.push({
    label: 'Save to watchlist…',
    icon: 'bookmark',
    onSelect: () => openWatchlistDialog({ entity_type: 'track', entity_id: t.id || null, entity_name: t.name, subtitle: t.artist || '', image: t.image }),
  });
  const url = t.url || (t.id ? `https://open.spotify.com/track/${t.id}` : '');
  const safe = safeUrl(url, '');
  if (safe && /^https:/i.test(safe)) items.push({ separator: true }, { label: 'Open in Spotify', icon: 'external', href: safe, external: true });
  return menu(anchor, items, { label: label || `More actions for ${t.name}` });
}

// ======================================================================= play counts (local history)
const countCache = new Map();   // "artist|name|id" -> plays
const artistCountCache = new Map();

const trackKey = (t) => `${(t.artist || '').toLowerCase()}|${(t.name || '').toLowerCase()}|${t.id || ''}`;

/**
 * Your plays for tracks/artists that came from Spotify: POST /api/v2/library/play-counts.
 * Returns {tracks: number[] (same order), artists: {name: n}}; missing values are null when the
 * history is unavailable. Cached per session.
 */
export async function playCounts({ tracks = [], artists = [] } = {}, { signal } = {}) {
  const needT = tracks.filter((t) => !countCache.has(trackKey(t)));
  const needA = [...new Set(artists.filter((a) => a && !artistCountCache.has(a.toLowerCase())))];
  const chunks = [];
  for (let i = 0; i < Math.max(needT.length, needA.length); i += 500) {
    chunks.push({ tracks: needT.slice(i, i + 500), artists: needA.slice(i, i + 500) });
  }
  for (const c of chunks) {
    try {
      const r = await api.post('/api/v2/library/play-counts', {
        tracks: c.tracks.map((t) => ({ name: t.name || '', artist: t.artist || '', id: t.id || undefined })),
        artists: c.artists,
      }, { signal, timeoutMs: 15000 });
      c.tracks.forEach((t, i) => countCache.set(trackKey(t), Number(r?.tracks?.[i] ?? 0)));
      Object.entries(r?.artists || {}).forEach(([n, v]) => artistCountCache.set(n.toLowerCase(), Number(v) || 0));
    } catch (err) {
      if (isAbort(err)) throw err;
      if (err?.status !== 503) reportError(err);
      break;
    }
  }
  return {
    tracks: tracks.map((t) => (countCache.has(trackKey(t)) ? countCache.get(trackKey(t)) : null)),
    artists: Object.fromEntries(artists.map((a) => [a, artistCountCache.has(String(a).toLowerCase()) ? artistCountCache.get(String(a).toLowerCase()) : null])),
  };
}

/** "38 plays" / "Never played" / "" (unknown). */
export function playsLabel(n) {
  if (n == null) return '';
  return n > 0 ? fmt.plural(n, 'play') : 'Never played';
}

// ======================================================================= album playback
/** Play an album (release radar / watchlist): its first track, in the album's context. */
export async function playAlbum({ id, name, artist } = {}) {
  if (!id) return;
  try {
    const r = await api.get('/api/artist/discography/release', { params: { album_id: id, artist_name: artist || undefined }, timeoutMs: 15000 });
    const first = (r?.tracks || []).find((t) => t && (t.uri || t.id));
    if (!first) { toast(html`Couldn't find the tracks of <strong>${name || 'this release'}</strong>.`, { kind: 'warning' }); return; }
    const uri = first.uri || `spotify:track:${first.id}`;
    await api.post('/api/play-track', { uri, context_uri: `spotify:album:${id}` });
    toast(html`Playing <strong>${name || 'the album'}</strong>`, { kind: 'success', icon: 'play', timeoutMs: 3000 });
  } catch (err) {
    if (isAbort(err)) return;
    const msg = String(err?.message || '');
    toast(/no active device/i.test(msg) ? 'No active Spotify device. Start playing in Spotify, then try again.' : (msg || "Couldn't start playback."), { kind: err?.isRateLimited ? 'warning' : 'error' });
  }
}

export { playUri, playTrack, openWatchlistDialog };

/** Rate-limit sentence with the time it ends ("until 4:12 PM") when known. */
export function coolingDownText(err) {
  const s = Number(err?.retryAfter);
  if (Number.isFinite(s) && s > 0) {
    const until = new Date(Date.now() + s * 1000);
    return `Spotify is cooling down until about ${timeOfDay(until)}.`;
  }
  return 'Spotify is cooling down for a moment.';
}

/** Restore focus to an equivalent element after a list re-render (by row key + action). */
export function captureFocus(container) {
  const a = document.activeElement;
  if (!a || !container.contains(a)) return null;
  const row = a.closest('[data-key]');
  return row ? { key: row.dataset.key, action: a.dataset.action || null, tag: a.tagName } : null;
}

export function restoreFocus(container, saved) {
  if (!saved) return;
  const row = [...container.querySelectorAll('[data-key]')].find((r) => r.dataset.key === saved.key);
  if (!row) return;
  const el = (saved.action && row.querySelector(`[data-action="${saved.action}"]`)) || row.querySelector('a, button');
  el?.focus({ preventScroll: true });
}

/**
 * Re-render a list without the content jumping under the reader: the first visible row stays
 * where it was (rows added or removed above it shift the scroll position instead). At the very
 * top nothing is adjusted, so new rows there are seen arriving.
 */
export function keepScrollAnchor(container, renderFn) {
  const scroller = document.getElementById('view');
  if (!scroller || !container || scroller.scrollTop < 8) { renderFn(); return; }
  const sTop = scroller.getBoundingClientRect().top;
  const anchor = [...container.querySelectorAll('[data-key]')].find((r) => r.getBoundingClientRect().bottom > sTop + 1);
  const key = anchor?.dataset.key;
  const offset = anchor ? anchor.getBoundingClientRect().top - sTop : 0;
  renderFn();
  if (!key) return;
  const again = [...container.querySelectorAll('[data-key]')].find((r) => r.dataset.key === key);
  if (again) scroller.scrollTop += again.getBoundingClientRect().top - sTop - offset;
}

/** A search box for a toolbar (icon + input + clear). */
export function searchBox({ value = '', placeholder, label, name = 'q' } = {}) {
  return html`<div class="lib-search">
    ${icon('search')}
    <input class="input lib-search-input" type="search" name="${name}" value="${value}" placeholder="${placeholder}" aria-label="${label || placeholder}" autocomplete="off" spellcheck="false" enterkeyhint="search">
  </div>`;
}

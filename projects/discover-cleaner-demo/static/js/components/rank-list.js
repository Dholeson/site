// One ranked-list look for every "top N" list: Insights (Reports, Year in music, All time) and the
// artist page's top tracks and albums. Every row has the same anatomy:
//
//   rank (+ move) · cover · title / sub · bar with the value at its tip · change · action
//
// Covers come from the API (album art the app already stored); artists, and anything without art,
// get the same initials avatar as every other page. Values are printed next to every bar, so
// nothing is tooltip-only and the list reads as plain text for screen readers.
//
//   rankList(rows, { kind: 'tracks', compare, deltaLabel, max, limit, valueLabel, empty, label })
//   row: { rank, name, href?, sub?, artist?, image?, plays, prev_rank?, prev_plays?, badge?,
//          pct_change?, spotify_track_id?, trailing? (html: replaces the default play button),
//          key?, attrs? ({data-*: value} set on the <li>) }
//
// Styles: static/css/views/insights.css ("ranked lists"), shared by .view-insights and .view-artist.
import { html, raw, fmt, icon, artistHref, escapeHtml, nameHue } from '../core/ui.js';

/** A cover (img) or initials avatar; hue from the name so avatars aren't all the same gray. */
export function cover(src, label, { round = false, size = 40, className = '' } = {}) {
  const ok = typeof src === 'string' && /^https?:\/\//i.test(src);
  const cls = `ins-cover${round ? ' ins-cover--round' : ''}${className ? ` ${className}` : ''}`;
  if (ok) return html`<span class="${cls}" style="--s:${size}px" aria-hidden="true"><img src="${src}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
  // Same initials + tint as the artist placeholder on every other page (ui.initialsAvatar).
  return html`<span class="${cls} ins-cover--ph" style="--s:${size}px;--h:${nameHue(label)}" aria-hidden="true"><span>${fmt.initials(label)}</span></span>`;
}

/** Play button for a track row: Spotify id → play-uri; otherwise looked up on Spotify when pressed. */
export function playButton({ id, uri, artist, name, size = 'sm', label } = {}) {
  const u = uri || (id ? `spotify:track:${id}` : '');
  const aria = label || `Play ${name}${artist ? ` by ${artist}` : ''}`;
  if (u) return html`<button type="button" class="btn btn-icon btn-${size} ins-play" data-action="play-uri" data-uri="${u}" data-name="${name}" aria-label="${aria}" data-tip="Play">${icon('play')}</button>`;
  if (artist && name) return html`<button type="button" class="btn btn-icon btn-${size} ins-play" data-action="play-track" data-artist="${artist}" data-name="${name}" aria-label="${aria}" data-tip="Find on Spotify and play">${icon('play')}</button>`;
  return '';
}

/**
 * A change mark: arrow icon + signed value, coloured by direction (the same look as the stat
 * tiles' deltas). kind 'pct' → "+12%" (">999%" past that), 'rank' → "3" (places moved).
 * sr: the words a screen reader hears instead ("up 12% vs August").
 */
export function deltaMark(n, { kind = 'pct', sr = '', className = '' } = {}) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Number(n);
  const dir = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  let txt;
  if (kind === 'rank') txt = String(Math.abs(v));
  else if (Math.abs(v) >= 1000) txt = '>999%';
  else txt = fmt.signedPct(v);
  const tone = dir === 'up' ? 'delta-up' : dir === 'down' ? 'delta-down' : 'delta-flat';
  return html`<span class="delta-mark ${tone}${className ? ` ${className}` : ''}">${dir === 'flat' ? '' : icon(dir === 'up' ? 'arrowUp' : 'arrowDown')}<span aria-hidden="true">${txt}</span>${sr ? html`<span class="sr-only">${sr}</span>` : ''}</span>`;
}

const BADGE = {
  new_ever: { text: 'NEW', cls: 'bl-badge bl-badge--new', note: 'First time ever in your history' },
  re_entry: { text: 'BACK', cls: 'bl-badge', note: 'Back: played before, but hardly at all in the previous period' },
};

/**
 * Ranked list with bars. kind: 'artists' (round initials, name links to the artist) | 'albums' |
 * 'tracks' (a play button at the end). compare: show the change column (rank moves, % change,
 * NEW / BACK badges) when the rows carry it.
 */
export function rankList(items, { kind = 'artists', deltaLabel = 'vs the previous period', compare = true, max, limit, valueLabel = 'plays', empty = 'Nothing here yet.', label, className = '' } = {}) {
  const rows = (items || []).slice(0, limit || undefined);
  if (!rows.length) return html`<p class="ins-empty-line">${empty}</p>`;
  const top = Number(max) > 0 ? Number(max) : Math.max(1, ...rows.map((r) => Number(r.plays) || 0));
  const rankW = Math.max(1, ...rows.map((r) => String(r.rank ?? '').length));
  const valW = Math.max(...rows.map((r) => fmt.num(r.plays).length));
  const withImg = kind === 'artists' || rows.some((r) => r.image);
  // NEW (first time ever) is true without a comparison too; the other changes need one.
  const withDelta = rows.some((r) => (r.badge && (compare || r.badge === 'new_ever')) || (compare && r.pct_change != null));
  const withAct = kind === 'tracks' || rows.some((r) => r.trailing);
  const cls = `bl ins-top ins-top--${kind}${withImg ? '' : ' ins-top--noimg'}${withDelta ? '' : ' ins-top--nodelta'}${withAct ? ' ins-top--act' : ''}${className ? ` ${className}` : ''}`;
  return html`<ol class="${cls}" role="list"${label ? raw(` aria-label="${escapeHtml(label)}"`) : ''} style="--bl-rank-w:${rankW + 0.5}ch;--bl-val-w:calc(${valW}ch + 14px)">
    ${rows.map((r, i) => rankRow(r, i, { kind, deltaLabel, compare, top, withImg, withDelta, withAct, valueLabel }))}
  </ol>`;
}

function rankRow(r, i, { kind, deltaLabel, compare, top, withImg, withDelta, withAct, valueLabel }) {
  const plays = Number(r.plays) || 0;
  const pct = Math.max(0.01, Math.min(1, plays / top));
  const rank = r.rank ?? i + 1;
  const badge = r.badge && (compare || r.badge === 'new_ever') ? BADGE[r.badge] : null;
  let move = '';
  if (compare && !badge && r.prev_rank != null && r.prev_rank !== rank) {
    const diff = Number(r.prev_rank) - Number(rank);
    move = deltaMark(diff, { kind: 'rank', className: 'bl-move', sr: `, ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} from number ${r.prev_rank}` });
  }
  const unit = plays === 1 ? valueLabel.replace(/s$/, '') : valueLabel;
  let tip = `${fmt.num(plays)} ${unit}`;
  if (compare && r.prev_plays != null) tip += ` · ${fmt.num(r.prev_plays)} ${deltaLabel.replace(/^vs /, 'in ')}`;
  let delta = '';
  if (badge) {
    delta = html`<span class="${badge.cls}" data-tip="${badge.note}">${badge.text}</span><span class="sr-only"> (${badge.note})</span>`;
  } else if (compare && r.pct_change != null) {
    const n = Number(r.pct_change);
    const words = n > 0 ? 'up' : n < 0 ? 'down' : 'no change';
    delta = deltaMark(n, { className: 'bl-delta', sr: `${words} ${Math.abs(n) >= 1000 ? 'more than 999%' : `${Math.abs(n)}%`} ${deltaLabel}` });
  }
  const href = r.href !== undefined ? r.href : kind === 'artists' ? artistHref(r.name) : null;
  const nameHtml = href
    ? html`<a class="bl-label ins-top-name" href="${href}" title="${r.name}">${r.name}</a>`
    : html`<span class="bl-label ins-top-name" title="${r.name}">${r.name}</span>`;
  const sub = r.sub !== undefined ? r.sub
    : r.artist && kind !== 'artists' ? html`<a class="ins-top-artist" href="${artistHref(r.artist)}">${r.artist}</a>` : '';
  const img = withImg ? cover(r.image, r.name, { round: kind === 'artists' && !r.image }) : '';
  const action = r.trailing !== undefined ? r.trailing
    : kind === 'tracks' ? playButton({ id: r.spotify_track_id, artist: r.artist, name: r.name }) : '';
  const attrs = r.attrs ? raw(Object.entries(r.attrs).map(([k, v]) => ` ${escapeHtml(k)}="${escapeHtml(v ?? '')}"`).join('')) : '';
  return html`<li class="bl-item"${r.key != null ? html` data-key="${r.key}"` : ''}${attrs}>
    <div class="ins-top-row">
      <span class="bl-rank"><span class="sr-only">Rank </span>${rank}${move}</span>
      ${img}
      <span class="bl-main">
        <span class="bl-text">${nameHtml}${sub ? html`<span class="bl-sub">${sub}</span>` : ''}</span>
        <span class="bl-barline" data-tip="${tip}"><span class="bl-bar" aria-hidden="true" style="--pct:${pct.toFixed(4)}"></span><span class="bl-val">${fmt.num(plays)}<span class="sr-only"> ${unit}</span></span></span>
      </span>
      ${withDelta ? html`<span class="ins-top-delta">${delta}</span>` : ''}
      ${withAct ? html`<span class="ins-top-act">${action}</span>` : ''}
    </div>
  </li>`;
}

export default rankList;

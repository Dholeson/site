// Insights → Year in music tab (GET /api/v2/insights/year-in-music?year=): a summary card set for
// one year — big numbers, your top artist / track / album (covers from art the app already has),
// top fives, the shape of the year by month, and the facts worth sharing. Defaults to the last
// complete year; the year picker covers every year in your history.
import {
  html, mount, fmt, icon, infoTip, errorState, loadingState, segmented, bindChoiceGroup, actions, toast, artistHref, setRefetching,
} from '../core/ui.js';
import charts from '../core/charts.js';
import {
  cachedGet, peek, isAbort, putChart, destroyCharts, coverageBanner, dayText, rangeText, hourText, deltaChip, cover,
  playButton, topList, MONTHS,
} from './insights-common.js';

const PATH = '/api/v2/insights/year-in-music';
const OVERVIEW = '/api/v2/insights/overview';

let rememberedYear = null;
export function yearQuery() { return rememberedYear || undefined; }

export default function createYear({ api, router }) {
  let root = null;
  let ctrl = null;
  let data = null;
  let years = [];          // [{year, plays}] from the overview
  let year = null;
  let offActions = null;
  let offPicker = null;
  let seq = 0;

  const el = (name) => root?.querySelector(`[data-slot="${name}"]`);

  function defaultYear() {
    const now = new Date().getFullYear();
    const withPlays = years.filter((y) => y.plays > 0).map((y) => y.year);
    if (withPlays.includes(now - 1)) return now - 1;
    return withPlays.length ? Math.max(...withPlays) : now - 1;
  }

  async function loadYears() {
    try {
      const o = await cachedGet(api, OVERVIEW, {}, { signal: ctrl?.signal, maxAgeMs: 5 * 60000 });
      years = (o.plays_by_year || []).map((r) => ({ year: r.year, plays: r.plays }));
    } catch (err) {
      if (isAbort(err)) throw err;
      years = [];
    }
  }

  async function load() {
    const my = ++seq;
    ctrl?.abort();
    ctrl = new AbortController();
    const params = { year };
    const cached = peek(PATH, params);
    if (cached) render(cached.data);
    else if (data) setRefetching(el('body'), true);
    try {
      const d = await cachedGet(api, PATH, params, { signal: ctrl.signal, maxAgeMs: 5 * 60000 });
      if (my !== seq || !root) return;
      if (d !== data) render(d);
      else setRefetching(el('body'), false);
    } catch (err) {
      if (isAbort(err) || my !== seq || !root) return;
      setRefetching(el('body'), false);
      destroyCharts(el('body'));
      delete el('body').dataset.built;
      mount(el('body'), errorState(err, { title: `Couldn't load ${year}`, body: `${err.message} Other years, reports and playback still work.`, retry: () => load() }));
    }
  }

  function renderPicker() {
    const thisYear = new Date().getFullYear();
    const items = (years.length ? years : [{ year }]).map((y) => ({ id: String(y.year), label: y.year === thisYear ? `${y.year} so far` : String(y.year) }));
    mount(el('picker'), segmented({ items, selected: String(year), label: 'Year' }));
    revealSelected();
  }

  // on a phone the year row scrolls sideways: keep the chosen year in view
  function revealSelected() {
    const seg = el('picker')?.querySelector('.segmented');
    const on = seg?.querySelector('[aria-checked="true"]');
    if (!seg || !on || seg.scrollWidth <= seg.clientWidth) return;
    const x = on.getBoundingClientRect().left - seg.getBoundingClientRect().left + seg.scrollLeft;
    seg.scrollLeft = Math.max(0, x - seg.clientWidth / 2 + on.offsetWidth / 2);
  }

  function syncPicker() {
    el('picker')?.querySelectorAll('[role="radio"]').forEach((b) => {
      const on = b.dataset.value === String(year);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    revealSelected();
  }

  function render(d) {
    data = d;
    const body = el('body');
    setRefetching(body, false);
    if (!d.plays) {
      destroyCharts(body);
      delete body.dataset.built;
      mount(body, html`<div class="card ins-card"><p class="ins-empty-line">No plays in ${d.year}. Pick another year above.</p></div>`);
      return;
    }
    if (!body.dataset.built) build(body);
    const defs = d.definitions || {};
    mount(el('banner'), d.complete ? '' : html`<p class="ins-year-running">${icon('hourglass')}<span>${d.year} isn't over yet: these are the numbers so far.</span></p>`);
    mount(el('coverage'), coverageBanner(d.coverage));
    renderPoster(d, defs);
    renderPodium(d);
    renderTops(d);
    renderMonths(d);
    renderFacts(d, defs);
  }

  function build(body) {
    body.dataset.built = '1';
    mount(body, html`
      <div data-slot="coverage"></div>
      <section class="ins-poster" aria-labelledby="ins-yim-title" data-slot="poster"></section>
      <div class="ins-podium" data-slot="podium"></div>
      <div class="ins-grid-2">
        <section class="card ins-card" aria-labelledby="ins-yim-ta"><div class="ins-card-head"><div class="ins-card-heading"><h2 class="ins-card-title" id="ins-yim-ta">Top 5 artists</h2></div></div><div data-slot="top-artists"></div></section>
        <section class="card ins-card" aria-labelledby="ins-yim-tt"><div class="ins-card-head"><div class="ins-card-heading"><h2 class="ins-card-title" id="ins-yim-tt">Top 5 tracks</h2></div></div><div data-slot="top-tracks"></div></section>
      </div>
      <section class="card ins-card" aria-labelledby="ins-yim-months">
        <div class="ins-card-head"><div class="ins-card-heading">
          <h2 class="ins-card-title" id="ins-yim-months"><span>Your year, month by month</span>${infoTip("Plays in each month. Plays scrobbled in bulk are left out, because their dates aren't real.", { label: 'Month by month' })}</h2>
          <p class="ins-card-desc ins-sentence" data-slot="months-line"></p>
        </div></div>
        <div data-slot="months"></div>
      </section>
      <section class="ins-section" aria-labelledby="ins-yim-facts">
        <h2 class="ins-section-title" id="ins-yim-facts">The details</h2>
        <div class="ins-facts ins-facts--3" data-slot="facts"></div>
      </section>`);
  }

  function renderPoster(d, defs) {
    const cmp = d.pct_change != null && !d.coverage?.comparison_affected;
    const prev = d.prev_label || String(d.year - 1);
    mount(el('poster'), html`
      <div class="ins-poster-top">
        <div>
          <div class="ins-poster-eyebrow">Your year in music</div>
          <h2 class="ins-poster-year" id="ins-yim-title">${d.year}${d.complete ? '' : html`<span class="ins-poster-sofar">so far</span>`}</h2>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="ins-copy-yim">${icon('link')}Copy summary</button>
      </div>
      <div class="ins-poster-main">
        <div class="ins-poster-plays">
          <div class="ins-poster-label">Plays ${infoTip(defs.plays, { label: 'Plays' })}</div>
          <div class="hero-figure ins-hero-figure">${fmt.num(d.plays)}</div>
          <div class="ins-hero-delta">${cmp ? html`${deltaChip(d.pct_change)} <span class="ins-hero-vs">vs ${prev} · ${fmt.plural(d.prev_plays, 'play')}</span>` : html`<span class="ins-hero-vs">${d.prev_plays ? `${fmt.plural(d.prev_plays, 'play')} in ${prev}` : 'Your first year of history'}</span>`}</div>
        </div>
        <dl class="ins-poster-stats">
          <div><dt>Hours of music ${infoTip(defs.listening_time, { label: 'Hours of music' })}</dt><dd>≈ ${fmt.num(d.hours_est)}</dd><dd class="ins-ps-sub">${d.days ? `about ${fmt.num(d.hours_est / d.days, { digits: 1 })} h a day` : ''}</dd></div>
          <div><dt>Days with music ${infoTip(defs.active_days, { label: 'Days with music' })}</dt><dd>${fmt.num(d.active_days)}</dd><dd class="ins-ps-sub">of ${fmt.num(d.days)}${d.complete ? '' : ' so far'}</dd></div>
          <div><dt>Artists ${infoTip(`${defs.artists || ''} ${defs.pct_new || ''}`.trim(), { label: 'Artists' })}</dt><dd>${fmt.num(d.artists)}</dd><dd class="ins-ps-sub">${d.pct_new_artists != null ? `${fmt.pct(d.pct_new_artists)} new to you` : 'different artists'}</dd></div>
          <div><dt>Tracks ${infoTip(`${defs.tracks || ''} ${defs.pct_new || ''}`.trim(), { label: 'Tracks' })}</dt><dd>${fmt.num(d.tracks)}</dd><dd class="ins-ps-sub">${d.pct_new_tracks != null ? `${fmt.pct(d.pct_new_tracks)} new to you` : 'different tracks'}</dd></div>
        </dl>
      </div>`);
  }

  function renderPodium(d) {
    const a = d.top_artist;
    const t = d.top_track;
    const al = d.top_album;
    const item = (kind, art, title, sub, detail, extra) => html`<section class="ins-pod" aria-label="${kind}">
      <div class="ins-pod-art">${art}${extra || ''}</div>
      <div class="ins-pod-text">
        <div class="ins-pod-kind">${kind}</div>
        <div class="ins-pod-title">${title}</div>
        ${sub ? html`<div class="ins-pod-sub">${sub}</div>` : ''}
        <div class="ins-pod-detail">${detail}</div>
      </div>
    </section>`;
    // There is no artist photo: the top artist borrows their top album's (or song's) cover, shown
    // square like the other album art and labelled with where it comes from.
    const from = a?.image ? a.image_from : null;
    const artistArt = a && a.image
      ? html`${cover(a.image, a.name, { size: 112, className: 'ins-pod-cover ins-pod-cover--borrowed' })}<span class="ins-pod-badge" aria-hidden="true">${cover(null, a.name, { round: true, size: 36 })}</span>`
      : a ? cover(null, a.name, { round: true, size: 112, className: 'ins-pod-cover' }) : '';
    mount(el('podium'), [
      a ? item('Top artist', artistArt,
        html`<a href="${artistHref(a.name)}">${a.name}</a>`,
        from?.name ? html`<span class="ins-pod-artnote" title="${`Album art: ${from.name}`}">${icon('disc')}<span class="truncate">Cover: ${from.name}${from.kind === 'track' ? ' (song)' : ''}</span></span>` : '',
        `${fmt.plural(a.plays, 'play')}${d.top_artist_share_pct != null ? ` · ${fmt.pct(d.top_artist_share_pct)} of your year` : ''}`) : '',
      t ? item('Top track', cover(t.image, t.name, { size: 112, className: 'ins-pod-cover' }),
        html`<span title="${t.name}">${t.name}</span>`, html`<a href="${artistHref(t.artist)}">${t.artist}</a>`,
        fmt.plural(t.plays, 'play'),
        html`<span class="ins-pod-play">${playButton({ id: t.spotify_track_id, artist: t.artist, name: t.name, size: 'lg' })}</span>`) : '',
      al ? item('Top album', cover(al.image, al.name, { size: 112, className: 'ins-pod-cover' }),
        html`<span title="${al.name}">${al.name}</span>`, html`<a href="${artistHref(al.artist)}">${al.artist}</a>`,
        fmt.plural(al.plays, 'play')) : '',
    ]);
  }

  function renderTops(d) {
    // The same ranked list as Reports and the artist page (no change column: a year stands alone).
    mount(el('top-artists'), topList(d.top_artists, { kind: 'artists', compare: false, label: `Top artists of ${d.year}`, empty: 'No artists this year.' }));
    mount(el('top-tracks'), topList(d.top_tracks, { kind: 'tracks', compare: false, label: `Top songs of ${d.year}`, empty: 'No songs this year.' }));
  }

  function renderMonths(d) {
    const months = d.months || [];
    const pk = d.peak_month;
    const quiet = [...months].filter((m) => m.plays > 0).sort((a, b) => a.plays - b.plays)[0];
    mount(el('months-line'), pk
      ? html`<strong>${pk.label}</strong> was your biggest month, with ${fmt.plural(pk.plays, 'play')}${quiet && quiet.ym !== pk.ym ? html`; ${MONTHS[Number(quiet.ym.slice(5, 7)) - 1]} was the quietest (${fmt.num(quiet.plays)}).` : '.'} Select a month to open its report.`
      : 'No plays with real times this year.');
    const pts = months.map((m) => ({ key: m.ym, label: m.label, fullLabel: `${MONTHS[Number(m.ym.slice(5, 7)) - 1]} ${m.ym.slice(0, 4)}`, value: m.plays, note: 'Select to open this month' }));
    putChart(el('months'), charts.columns(pts, {
      title: 'Plays per month', subtitle: 'Bulk scrobbles left out', valueLabel: 'plays', labelHeader: 'Month', height: 200,
      highlightKey: pk?.ym, tableToggle: true,
      onSelect: (p) => router.navigate(router.href('insights', {}, { period: 'month', anchor: `${p.key ?? p.raw?.key}-01` })),
    }));
  }

  function renderFacts(d, defs) {
    const f = (iconName, label, value, detail, info) => html`<div class="ins-fact">
      <div class="ins-fact-head"><span class="ins-fact-icon">${icon(iconName)}</span><span class="ins-fact-label">${label}</span>${info ? infoTip(info, { label }) : ''}</div>
      <div class="ins-fact-value">${value}</div>
      ${detail ? html`<div class="ins-fact-detail">${detail}</div>` : ''}
    </div>`;
    const tna = d.top_new_artist;
    const mad = d.most_active_day;
    const bh = d.busiest_hour;
    const ls = d.longest_streak;
    mount(el('facts'), [
      f('sparkle', 'Top new artist', tna ? html`<a class="ins-fact-link" href="${artistHref(tna.name)}">${tna.name}</a>` : '—',
        tna ? `${fmt.plural(tna.plays, 'play')} in the year you found them` : (d.warmup ? 'Not shown in your first 90 days' : 'No new artists'), defs.top_new_artist),
      f('user', 'New artists', d.new_artists != null ? fmt.num(d.new_artists) : '—',
        d.pct_new_artists != null ? `${fmt.pct(d.pct_new_artists)} of the ${fmt.num(d.artists)} artists you played` : 'Not shown in your first 90 days', defs.new_artists),
      f('calendar', 'Most active day', mad ? dayText(mad.day, { weekday: true, year: 'always' }) : '—', mad ? fmt.plural(mad.plays, 'play') : '', defs.most_active_day),
      f('clock', 'Busiest hour', bh ? hourText(bh.hour, { range: true }) : '—', bh ? `${fmt.plural(bh.plays, 'play')} started in this hour` : '', defs.busiest_hour),
      f('sparkle', 'Longest streak', ls ? fmt.plural(ls.days, 'day') : '—', ls ? (ls.days > 1 ? `in a row, ${rangeText(ls.start, ls.end)}` : dayText(ls.start, { year: 'always' })) : '', defs.longest_streak),
      f('music', 'Tracks new to you', d.pct_new_tracks != null ? fmt.pct(d.pct_new_tracks) : '—', d.new_tracks != null ? `${fmt.num(d.new_tracks)} of ${fmt.num(d.tracks)} tracks you played` : 'Not shown in your first 90 days', defs.pct_new),
    ]);
  }

  function summaryText(d) {
    const lines = [`My ${d.year} in music${d.complete ? '' : ' (so far)'}`];
    lines.push(`${fmt.num(d.plays)} plays · about ${fmt.num(d.hours_est)} hours · ${fmt.num(d.active_days)} days with music`);
    if (d.top_artist) lines.push(`Top artist: ${d.top_artist.name} (${fmt.num(d.top_artist.plays)} plays)`);
    if (d.top_track) lines.push(`Top track: ${d.top_track.name} by ${d.top_track.artist} (${fmt.num(d.top_track.plays)} plays)`);
    if (d.top_album) lines.push(`Top album: ${d.top_album.name} by ${d.top_album.artist}`);
    if (d.top_new_artist) lines.push(`Best new find: ${d.top_new_artist.name}`);
    if (d.artists) lines.push(`${fmt.num(d.artists)} artists${d.pct_new_artists != null ? `, ${fmt.pct(d.pct_new_artists)} of them new to me` : ''}`);
    return lines.join('\n');
  }

  async function copySummary() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(summaryText(data));
      toast('Summary copied. Paste it anywhere.', { kind: 'success', icon: 'check' });
    } catch {
      toast("Couldn't copy to the clipboard in this browser.", { kind: 'warning' });
    }
  }

  function pickYear(params) {
    const y = Number(params?.year);
    return Number.isInteger(y) && y >= 1970 && y <= new Date().getFullYear() ? y : null;
  }

  async function start(params) {
    ctrl?.abort();
    ctrl = new AbortController();
    try { await loadYears(); } catch (err) { if (isAbort(err)) return; }
    if (!root) return;
    year = pickYear(params) || rememberedYear || defaultYear();
    rememberedYear = year;
    renderPicker();
    offPicker?.();
    offPicker = bindChoiceGroup(el('picker'), (value) => {
      router.navigate(router.href('insights', { tab: 'year', year: value }));
    });
    load();
  }

  return {
    mount(el0, params) {
      root = el0;
      mount(root, html`
        <div class="ins-year-bar">
          <div class="ins-year-picker" data-slot="picker"></div>
          <div data-slot="banner"></div>
        </div>
        <div class="ins-year" data-slot="body">${loadingState('Putting your year together…')}</div>`);
      offActions = actions(root, { 'ins-copy-yim': copySummary });
      start(params);
    },
    update(params) {
      const y = pickYear(params) || rememberedYear || defaultYear();
      if (y === year) return;
      year = y;
      rememberedYear = y;
      syncPicker();
      load();
    },
    unmount() {
      ctrl?.abort();
      offActions?.();
      offPicker?.();
      if (root) destroyCharts(root);
      root = null;
      data = null;
    },
  };
}

// Insights → Reports tab: Last.fm-Pro-style period reports (GET /api/v2/reports).
// One filter row scopes everything; its state lives in the URL (#/insights?period=month&anchor=…)
// so Back works and a report can be linked. Refetches keep the previous report on screen, dimmed.
import {
  html, mount, fmt, icon, infoTip, statTile, emptyState, errorState, segmented, bindChoiceGroup,
  actions, setRefetching, artistHref,
} from '../core/ui.js';
import charts from '../core/charts.js';
import {
  cachedGet, peek, prefetch, isAbort, upsertChart, destroyCharts, topList, coverageBanner,
  prevShort, pctChange, hoursParts, hoursText, dayText, rangeText, hourText, deltaChip, cover, WEEKDAYS, MONTHS,
} from './insights-common.js';

const PATH = '/api/v2/reports';
const PERIODS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
];
const UNIT = { week: 'week', month: 'month', year: 'year', all: 'all time' };
const LIMIT = 25;          // fetched once; "Show top 25" is then instant
const SHORT = 10;

// Remembered across tab switches and remounts so the Reports tab link returns to the same report.
const remembered = { period: 'month', anchor: '', expanded: false, kind: 'artists' };

export function reportsQuery() {
  return { period: remembered.period, anchor: remembered.anchor || undefined };
}

function normPeriod(p) {
  const v = String(p || '').toLowerCase();
  if (v === 'all-time' || v === 'alltime') return 'all';
  return PERIODS.some((x) => x.id === v) ? v : 'month';
}
const normAnchor = (a) => (/^\d{4}-\d{2}-\d{2}$/.test(String(a || '')) ? String(a) : '');

/** What the filter row says while a report is on its way (the API's own label replaces it). */
function provisionalLabel({ period, anchor }) {
  const d = anchor ? new Date(`${anchor}T12:00:00`) : new Date();
  if (period === 'all') return 'All time';
  if (period === 'year') return String(d.getFullYear());
  if (period === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return anchor ? `Week of ${dayText(anchor, { year: 'always' })}` : 'This week';
}

export function createReports({ api, router, store }) {
  let root = null;
  let ctrl = null;
  let data = null;
  let offActions = null;
  let offSeg = null;
  let offKind = null;
  let seq = 0;
  let playsSeen = null;
  let q = { period: remembered.period, anchor: remembered.anchor };

  const el = (name) => root?.querySelector(`[data-slot="${name}"]`);
  const hrefFor = (period, anchor) => router.href('insights', {}, { period, anchor: anchor || undefined });

  function go(period, anchor, { replace = false } = {}) {
    router.navigate(hrefFor(period, anchor), { replace });
  }

  function skeleton() {
    mount(root, html`
      <div class="ins-filter" role="group" aria-label="Report period">
        <div class="ins-filter-seg" data-slot="seg">${segmented({ items: PERIODS, selected: q.period, label: 'Report length' })}</div>
        <div class="ins-period">
          <button type="button" class="btn btn-icon btn-sm ins-period-step" data-action="ins-prev" aria-label="Previous period" disabled>${icon('chevronLeft')}</button>
          <div class="ins-period-label" data-slot="label" aria-live="polite"><span class="ins-period-name">${provisionalLabel(q)}</span></div>
          <button type="button" class="btn btn-icon btn-sm ins-period-step" data-action="ins-next" aria-label="Next period" disabled>${icon('chevronRight')}</button>
        </div>
        <div class="ins-filter-end">
          <button type="button" class="chip chip-accent ins-fresh" data-action="ins-refresh" data-slot="fresh" hidden>${icon('refresh')}<span>New plays · update</span></button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="ins-now" data-slot="now" hidden>Jump to now</button>
        </div>
      </div>
      <div data-slot="banner"></div>
      <div class="ins-report" data-slot="body"><div class="state" role="status"><div class="spinner" aria-hidden="true"></div><div class="state-body">Building your report…</div></div></div>`);
    offSeg = bindChoiceGroup(el('seg'), (value) => {
      // Switching length keeps you in the same stretch of time (March 2024 → 2024) unless it's "now".
      const p = data?.period;
      const anchor = p && !p.is_current && value !== 'all' ? (p.type === 'all' ? '' : p.anchor || p.start_day) : '';
      go(value, anchor);
    });
    offActions = actions(root, {
      'ins-prev': () => { const a = data?.period?.prev_anchor; if (a) go(q.period, a); },
      'ins-next': () => { const a = data?.period?.next_anchor; if (a) go(q.period, a); },
      'ins-now': () => go(q.period, ''),
      'ins-refresh': () => load({ force: true }),
      'ins-expand': (ds, btn) => {
        remembered.expanded = !remembered.expanded;
        btn.textContent = remembered.expanded ? 'Show top 10' : 'Show top 25';
        renderTop();
      },
      'ins-open-week': (ds) => go('week', ds.day),
    });
  }

  // ------------------------------------------------------------------ loading
  async function load({ force = false } = {}) {
    const my = ++seq;
    ctrl?.abort();
    ctrl = new AbortController();
    const params = { period: q.period, anchor: q.anchor || undefined, limit: LIMIT };
    const cached = peek(PATH, params);
    const body = el('body');
    if (cached && !force) {
      render(cached.data);
    } else {
      if (!force) mount(el('label'), html`<span class="ins-period-name">${provisionalLabel(q)}</span>`);
      if (data) {
        setRefetching(body, true);
        setRefetching(el('banner'), true);
      }
    }
    try {
      // Finished periods never change; running ones are refreshed after a minute.
      const fresh = await cachedGet(api, PATH, params, { signal: ctrl.signal, force, maxAgeMs: 60000 });
      if (my !== seq || !root) return;
      if (fresh !== data) render(fresh);   // a cache hit is already on screen
      else { setRefetching(el('body'), false); setRefetching(el('banner'), false); }
      prefetchNeighbours(fresh);
    } catch (err) {
      if (isAbort(err) || my !== seq || !root) return;
      setRefetching(body, false);
      setRefetching(el('banner'), false);
      if (cached && !force) return;          // keep showing the cached copy
      if (data && err.status !== 503) {
        // keep the last report visible; say what failed in place of the banner
        mount(el('banner'), errorState(err, { compact: true, title: "Couldn't load that report", retry: () => load({ force: true }) }));
        return;
      }
      data = null;
      destroyCharts(body);
      delete body.dataset.built;
      const notReady = err.code === 'history_not_ready';
      mount(body, errorState(err, {
        title: notReady ? 'Your history is still being built' : "Couldn't load this report",
        body: notReady ? 'Reports appear as soon as the play history is ready (usually within a minute). Playback and the backlog keep working.' : `${err.message} Playback, the backlog and the other tabs still work.`,
        retry: () => load({ force: true }),
      }));
      if (notReady) setTimeout(() => { if (my === seq && root && !data) load({ force: true }); }, 8000);
    }
  }

  function prefetchNeighbours(d) {
    const p = d.period;
    if (p.prev_anchor) prefetch(api, PATH, { period: p.type, anchor: p.prev_anchor, limit: LIMIT });
  }

  // ------------------------------------------------------------------ rendering
  function render(d) {
    data = d;
    playsSeen = store.status?.today?.plays_today ?? null;
    const fresh = el('fresh');
    if (fresh) fresh.hidden = true;
    renderFilter(d.period, d);
    mount(el('banner'), coverageBanner(d.coverage));
    setRefetching(el('banner'), false);
    const body = el('body');
    setRefetching(body, false);
    if (!d.totals.plays) {
      destroyCharts(body);
      delete body.dataset.built;
      mount(body, emptyState({
        icon: 'calendar',
        title: `No plays in ${d.period.label}`,
        body: d.period.is_current
          ? 'Nothing has been played or scrobbled yet in this period. Plays show up here as you listen.'
          : 'Nothing was played or scrobbled in this period. Try another one, or jump back to now.',
        action: d.period.is_current ? undefined : { label: 'Jump to now', action: 'ins-now' },
      }));
      return;
    }
    if (!body.dataset.built) buildSections(body);
    renderHero(d);
    renderKpis(d);
    renderTop();
    renderRhythm(d);
    renderFacts(d);
    renderDiscoveries(d);
  }

  function renderFilter(p, d) {
    const seg = el('seg');
    seg.querySelectorAll('[role="radio"]').forEach((b) => {
      const on = b.dataset.value === p.type;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    const unit = UNIT[p.type];
    const prevBtn = root.querySelector('[data-action="ins-prev"]');
    const nextBtn = root.querySelector('[data-action="ins-next"]');
    const isAll = p.type === 'all';
    prevBtn.hidden = isAll;
    nextBtn.hidden = isAll;
    // no previous-period figures means the previous period ends before your history begins
    const atStart = d?.totals?.prev_plays == null;
    prevBtn.disabled = !p.prev_anchor || atStart;
    nextBtn.disabled = !p.next_anchor;
    prevBtn.setAttribute('aria-label', atStart ? `Previous ${unit} (your history starts here)` : `Previous ${unit}`);
    nextBtn.setAttribute('aria-label', p.next_anchor ? `Next ${unit}` : `Next ${unit} (this is the latest)`);
    prevBtn.dataset.tip = atStart ? 'Your history starts here' : `Previous ${unit}`;
    nextBtn.dataset.tip = p.next_anchor ? `Next ${unit}` : 'This is the latest';
    let sub = '';
    if (isAll) sub = `since ${dayText(p.start_day, { year: 'always' })}`;
    else if (p.is_current && !p.complete) sub = 'so far';
    mount(el('label'), html`<span class="ins-period-name">${p.label}</span>${sub ? html`<span class="ins-period-sub">${sub}</span>` : ''}`);
    el('now').hidden = !!p.is_current || isAll;
  }

  function buildSections(body) {
    destroyCharts(body);
    body.dataset.built = '1';
    mount(body, html`
      <section class="card ins-hero" aria-labelledby="ins-hero-label">
        <div class="ins-hero-text" data-slot="hero"></div>
        <div class="ins-hero-chart" data-slot="series"></div>
      </section>
      <div class="stat-grid ins-kpis" data-slot="kpis"></div>
      <section class="card ins-card ins-tops" aria-labelledby="ins-top-title">
        <div class="ins-card-head">
          <div class="ins-card-heading">
            <h2 class="ins-card-title" id="ins-top-title"><span>Top artists, albums and tracks</span>${infoTip(data.definitions?.rank_change || 'Ranked by plays in this period.', { label: 'Top lists' })}</h2>
            <p class="ins-card-desc" data-slot="top-desc"></p>
          </div>
          <div class="ins-card-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="ins-expand">${remembered.expanded ? 'Show top 10' : 'Show top 25'}</button>
          </div>
        </div>
        <div class="ins-top-switch" data-slot="kind">${segmented({ items: [{ id: 'artists', label: 'Artists' }, { id: 'albums', label: 'Albums' }, { id: 'tracks', label: 'Tracks' }], selected: remembered.kind, label: 'Show top' })}</div>
        <div class="ins-top-cols" data-kind="${remembered.kind}">
          <div class="ins-top-col" data-col="artists"><h3 class="ins-col-title">Artists</h3><div data-slot="top-artists"></div></div>
          <div class="ins-top-col" data-col="albums"><h3 class="ins-col-title">Albums</h3><div data-slot="top-albums"></div></div>
          <div class="ins-top-col" data-col="tracks"><h3 class="ins-col-title">Tracks</h3><div data-slot="top-tracks"></div></div>
        </div>
      </section>
      <div class="ins-grid-2">
        <section class="card ins-card" aria-labelledby="ins-clock-title">
          <div class="ins-card-head"><div class="ins-card-heading">
            <h2 class="ins-card-title" id="ins-clock-title"><span>Listening clock</span>${infoTip(data.definitions?.clock || 'Plays by the hour they started.', { label: 'Listening clock' })}</h2>
            <p class="ins-card-desc ins-sentence" data-slot="clock-line"></p>
          </div></div>
          <div data-slot="clock"></div>
        </section>
        <section class="card ins-card" aria-labelledby="ins-week-title">
          <div class="ins-card-head"><div class="ins-card-heading">
            <h2 class="ins-card-title" id="ins-week-title"><span>Weekday rhythm</span>${infoTip(data.definitions?.weekday || 'Plays on each weekday.', { label: 'Weekday rhythm' })}</h2>
            <p class="ins-card-desc ins-sentence" data-slot="weekday-line"></p>
          </div></div>
          <div data-slot="weekday"></div>
        </section>
      </div>
      <section class="ins-section" aria-labelledby="ins-facts-title">
        <h2 class="ins-section-title" id="ins-facts-title">Quick facts</h2>
        <div class="ins-facts" data-slot="facts"></div>
      </section>
      <section class="card ins-card" aria-labelledby="ins-disc-title">
        <div class="ins-card-head"><div class="ins-card-heading">
          <h2 class="ins-card-title" id="ins-disc-title"><span>New to you</span>${infoTip(data.definitions?.discoveries || 'Artists first heard in this period.', { label: 'New to you' })}</h2>
          <p class="ins-card-desc" data-slot="disc-desc"></p>
        </div></div>
        <div data-slot="discoveries"></div>
      </section>`);
    offKind?.();
    offKind = bindChoiceGroup(el('kind'), (value) => {
      remembered.kind = value;
      root.querySelector('.ins-top-cols').dataset.kind = value;
    });
  }

  function compareState(d) {
    const t = d.totals;
    const p = d.period;
    if (p.type === 'all') return { ok: false, why: '' };
    if (d.coverage?.comparison_affected) return { ok: false, why: 'Change hidden until Last.fm catches up' };
    if (t.prev_plays == null) return { ok: false, why: 'Nothing to compare with: your history starts here' };
    if (t.prev_plays < 5) return { ok: false, why: `Only ${fmt.plural(t.prev_plays, 'play')} ${prevShort(p).replace(/^vs /, 'in ')}, too few to compare` };
    return { ok: true, why: '' };
  }

  function renderHero(d) {
    const t = d.totals;
    const p = d.period;
    const defs = d.definitions || {};
    const cmp = compareState(d);
    const vs = prevShort(p);
    const deltaLine = cmp.ok
      ? html`${deltaChip(t.pct_change)} <span class="ins-hero-vs">${vs} · ${fmt.plural(t.prev_plays, 'play')}</span>`
      : cmp.why ? html`<span class="ins-hero-vs">${cmp.why}</span>` : '';
    const sub = [
      html`≈ ${hoursText(t.listening_s_est)} of music ${infoTip(defs.listening_time, { label: 'Listening time' })}`,
      html`Music on ${fmt.num(t.active_days)} of ${fmt.plural(t.days_in_period, 'day')}${p.is_current && !p.complete && p.type !== 'all' ? ' so far' : ''}`,
    ];
    mount(el('hero'), html`
      <div class="ins-hero-label" id="ins-hero-label"><span>Plays</span>${infoTip(defs.plays, { label: 'Plays' })}<span class="ins-hero-period">${p.type === 'all' ? 'all time' : p.label}${p.is_current && !p.complete && p.type !== 'all' ? ' so far' : ''}</span></div>
      <div class="hero-figure ins-hero-figure">${fmt.num(t.plays)}</div>
      ${deltaLine ? html`<div class="ins-hero-delta">${deltaLine}</div>` : ''}
      <ul class="ins-hero-sub" role="list">${sub.map((x) => html`<li>${x}</li>`)}</ul>
      ${t.bulk_plays ? html`<p class="ins-hero-note"><span>${fmt.plural(t.bulk_plays, 'play')} in this period were scrobbled in bulk, so their times aren't real: they count in totals and top lists, not in the charts by day or hour. ${infoTip(defs.bulk_note, { label: 'Bulk scrobbles' })}</span></p>` : ''}
      ${p.warmup && p.type !== 'all' ? html`<p class="ins-hero-note"><span>“New” figures are hidden for the first 90 days of your history, when everything looks new. ${infoTip(defs.warmup, { label: 'New figures' })}</span></p>` : ''}`);

    // series: days of the week/month, months of the year, years of all time
    const gran = d.series.granularity;
    const drill = gran === 'year' ? 'year' : gran === 'month' ? 'month' : p.type === 'month' ? 'week' : null;
    let raw = d.series.points;
    if (p.warmup && gran !== 'year') {
      // the period where your history begins: leading empty days/months are before it, not silence
      const first = raw.findIndex((pt) => pt.plays > 0);
      if (first > 0) raw = raw.slice(first);
    }
    const pts = raw.map((pt) => {
      let label = pt.label;
      let full = pt.label;
      if (gran === 'day') {
        const dd = new Date(`${pt.key}T12:00:00`);
        label = p.type === 'week' ? dd.toLocaleDateString('en-US', { weekday: 'short' }) : String(dd.getDate());
        full = dd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      } else if (gran === 'month') {
        full = `${MONTHS[Number(pt.key.slice(5, 7)) - 1]} ${pt.key.slice(0, 4)}`;
      } else if (gran === 'year' && String(new Date().getFullYear()) === pt.key) {
        full = `${pt.key} (so far)`;
      }
      const note = drill === 'week' ? 'Select to open that week' : drill ? `Select to open ${full}` : '';
      return { key: pt.key, label, fullLabel: full, value: pt.plays, note };
    });
    const title = gran === 'day' ? 'Plays per day' : gran === 'month' ? 'Plays per month' : 'Plays per year';
    const onSelect = drill ? (pt) => {
      const k = String(pt.key ?? pt.raw?.key ?? '');
      if (drill === 'year') go('year', `${k}-01-01`);
      else if (drill === 'month') go('month', `${k}-01`);
      else go('week', k);
    } : null;
    const hint = drill === 'week' ? 'Select a day to open its week' : drill ? `Select a ${drill} to open it` : '';
    const subtitle = [hint, d.totals.bulk_plays ? 'bulk scrobbles left out' : ''].filter(Boolean).join(' · ').replace(/^b/, 'B');
    // update() swaps title, subtitle and click handling in place (keeps focus, no flash).
    upsertChart(el('series'), 'series', (v, o) => charts.columns(v, o), pts,
      { title, subtitle, valueLabel: 'plays', labelHeader: gran === 'day' ? 'Day' : gran === 'month' ? 'Month' : 'Year', height: 200, onSelect, tableToggle: true });
  }

  function renderKpis(d) {
    const t = d.totals;
    const defs = d.definitions || {};
    const cmp = compareState(d);
    const vs = cmp.ok ? prevShort(d.period) : '';
    const delta = (cur, prev) => (cmp.ok ? pctChange(cur, prev, 1) : null);
    const [hv, hu] = hoursParts(t.listening_s_est);
    const newHint = (pct) => (pct == null ? null : `${fmt.pct(pct)} new to you`);
    const tiles = [
      statTile({ label: 'Listening time', value: hv, unit: hu, delta: delta(t.listening_s_est, t.prev_listening_s_est), deltaLabel: vs, info: defs.listening_time }),
      statTile({ label: 'Artists', value: t.artists, delta: delta(t.artists, t.prev_artists), deltaLabel: vs, hint: newHint(t.pct_new_artists), info: `${defs.artists || ''} ${defs.pct_new || ''}`.trim() }),
      statTile({ label: 'Albums', value: t.albums, delta: delta(t.albums, t.prev_albums), deltaLabel: vs, hint: newHint(t.pct_new_albums), info: `${defs.albums || ''} ${defs.pct_new || ''}`.trim() }),
      statTile({ label: 'Tracks', value: t.tracks, delta: delta(t.tracks, t.prev_tracks), deltaLabel: vs, hint: newHint(t.pct_new_tracks), info: `${defs.tracks || ''} ${defs.pct_new || ''}`.trim() }),
      statTile({
        label: 'Plays per listening day',
        value: t.avg_plays_per_active_day == null ? '—' : fmt.num(t.avg_plays_per_active_day, { digits: t.avg_plays_per_active_day < 10 ? 1 : 0 }),
        delta: cmp.ok && t.prev_avg_plays_per_active_day ? pctChange(t.avg_plays_per_active_day, t.prev_avg_plays_per_active_day, 0.1) : null,
        deltaLabel: vs,
        hint: `On ${fmt.num(t.active_days)} of ${fmt.plural(t.days_in_period, 'day')}`,
        info: defs.avg_plays_per_active_day,
      }),
    ];
    mount(el('kpis'), tiles);
  }

  function renderTop() {
    if (!data || !root || !el('top-artists')) return;
    const d = data;
    const cmp = compareState(d);
    const limit = remembered.expanded ? LIMIT : SHORT;
    const label = d.period.type === 'all' ? 'all time' : d.period.label;
    mount(el('top-desc'), cmp.ok
      ? html`Ranked by plays in ${label} · changes ${prevShort(d.period)}`
      : html`Ranked by plays in ${label}${d.coverage?.comparison_affected ? ' · changes are hidden until Last.fm catches up' : ''}`);
    const opts = { deltaLabel: prevShort(d.period) || 'vs the previous period', compare: cmp.ok, limit };
    mount(el('top-artists'), topList(d.top.artists, { ...opts, kind: 'artists', label: `Top artists, ${label}`, empty: 'No artists in this period.' }));
    mount(el('top-albums'), topList(d.top.albums, { ...opts, kind: 'albums', label: `Top albums, ${label}`, empty: 'No albums in this period.' }));
    mount(el('top-tracks'), topList(d.top.tracks, { ...opts, kind: 'tracks', label: `Top tracks, ${label}`, empty: 'No tracks in this period.' }));
    const btn = root.querySelector('[data-action="ins-expand"]');
    const longest = Math.max(d.top.artists.length, d.top.albums.length, d.top.tracks.length);
    if (btn) btn.hidden = longest <= SHORT;
  }

  function renderRhythm(d) {
    const p = d.period;
    const bh = d.quick_facts.busiest_hour;
    const okPlays = d.clock.reduce((a, c) => a + (c.plays || 0), 0);
    mount(el('clock-line'), okPlays
      ? html`You listen most around <strong>${hourText(bh?.hour)}</strong>: ${fmt.plural(bh?.plays, 'play')} started between ${hourText(bh?.hour, { range: true })}.`
      : 'No plays with real times in this period.');
    upsertChart(el('clock'), 'clock', (v, o) => charts.clock(v, o), d.clock, { valueLabel: 'plays', height: 180, tableToggle: true, subtitle: 'Plays by the hour they started', showNote: false });

    const week = p.type === 'week';
    const vals = d.weekday.map((w) => ({ dow: w.dow, value: week ? w.plays : (w.per_active_day || 0) }));
    const best = [...d.weekday].sort((a, b) => ((week ? b.plays : b.per_active_day || 0) - (week ? a.plays : a.per_active_day || 0)))[0];
    let line = 'No plays with real times in this period.';
    if (okPlays && best) {
      line = week
        ? html`<strong>${WEEKDAYS[best.dow]}</strong> was your biggest day, with ${fmt.plural(best.plays, 'play')}.`
        : html`<strong>${WEEKDAYS[best.dow]}s</strong> are your biggest days: ${fmt.num(best.per_active_day, { digits: best.per_active_day < 10 ? 1 : 0 })} plays on a typical ${WEEKDAYS[best.dow]} you listened.`;
    }
    mount(el('weekday-line'), line);
    upsertChart(el('weekday'), week ? 'weekday-plays' : 'weekday-avg', (v, o) => charts.weekday(v, o), vals, {
      valueLabel: week ? 'plays' : 'plays per listening day', highlightPeak: true, height: 180, tableToggle: true,
      subtitle: week ? 'Plays each day' : 'Average plays on the days you listened',
    });
  }

  function renderFacts(d) {
    const qf = d.quick_facts;
    const defs = d.definitions || {};
    const tiles = [];
    const mad = qf.most_active_day;
    tiles.push(html`<div class="ins-fact">
      <div class="ins-fact-head"><span class="ins-fact-icon">${icon('calendar')}</span><span class="ins-fact-label">Most active day</span>${infoTip(defs.most_active_day, { label: 'Most active day' })}</div>
      <div class="ins-fact-value">${mad ? dayText(mad.day, { weekday: true, year: d.period.type === 'all' ? 'always' : 'auto' }) : '—'}</div>
      <div class="ins-fact-detail">${mad ? html`${fmt.plural(mad.plays, 'play')}${d.period.type !== 'week' ? html` · <button type="button" class="ins-link-btn" data-action="ins-open-week" data-day="${mad.day}">See that week</button>` : ''}` : 'No plays with real times'}</div>
    </div>`);
    const ls = qf.longest_streak;
    tiles.push(html`<div class="ins-fact">
      <div class="ins-fact-head"><span class="ins-fact-icon">${icon('sparkle')}</span><span class="ins-fact-label">Longest streak</span>${infoTip(defs.longest_streak, { label: 'Longest streak' })}</div>
      <div class="ins-fact-value">${ls ? fmt.plural(ls.days, 'day') : '—'}</div>
      <div class="ins-fact-detail">${ls ? (ls.days > 1 ? `in a row, ${rangeText(ls.start, ls.end)}` : dayText(ls.start, { year: 'always' })) : 'No listening days yet'}</div>
    </div>`);
    const tna = qf.top_new_artist;
    tiles.push(html`<div class="ins-fact">
      <div class="ins-fact-head"><span class="ins-fact-icon">${icon('user')}</span><span class="ins-fact-label">Top new artist</span>${infoTip(defs.top_new_artist, { label: 'Top new artist' })}</div>
      <div class="ins-fact-value">${tna ? html`<a class="ins-fact-link" href="${artistHref(tna.name)}">${tna.name}</a>` : '—'}</div>
      <div class="ins-fact-detail">${tna ? `${fmt.plural(tna.plays, 'play')}, first heard in this period` : d.period.warmup ? 'Not shown this early in your history' : 'No new artists in this period'}</div>
    </div>`);
    const bh = qf.busiest_hour;
    tiles.push(html`<div class="ins-fact">
      <div class="ins-fact-head"><span class="ins-fact-icon">${icon('clock')}</span><span class="ins-fact-label">Busiest hour</span>${infoTip(defs.busiest_hour, { label: 'Busiest hour' })}</div>
      <div class="ins-fact-value">${bh ? hourText(bh.hour, { range: true }) : '—'}</div>
      <div class="ins-fact-detail">${bh ? `${fmt.plural(bh.plays, 'play')} started in this hour` : 'No plays with real times'}</div>
    </div>`);
    mount(el('facts'), tiles);
  }

  function renderDiscoveries(d) {
    const list = d.discoveries || [];
    const t = d.totals;
    const label = d.period.type === 'all' ? 'your history' : d.period.label;
    if (d.period.type === 'all' || d.period.warmup) {
      mount(el('disc-desc'), d.period.type === 'all' ? 'Every artist is new at some point, so this list is for weeks, months and years.' : (d.definitions?.warmup || ''));
      mount(el('discoveries'), '');
      root.querySelector('#ins-disc-title')?.closest('section')?.setAttribute('hidden', '');
      return;
    }
    root.querySelector('#ins-disc-title')?.closest('section')?.removeAttribute('hidden');
    mount(el('disc-desc'), t.new_artists
      ? html`${fmt.plural(t.new_artists, 'artist')} you'd never played before ${label}${t.pct_plays_on_new_tracks != null ? html` · ${fmt.pct(t.pct_plays_on_new_tracks)} of your plays went to songs new to you${infoTip(d.definitions?.pct_plays_on_new_tracks, { label: 'Plays on new songs' })}` : ''}`
      : `No artists you hadn't played before ${label}.`);
    if (!list.length) {
      mount(el('discoveries'), html`<p class="ins-empty-line">When you play an artist for the first time, they show up here.</p>`);
      return;
    }
    mount(el('discoveries'), html`<ol class="ins-disc" role="list">${list.map((a) => html`<li class="ins-disc-item">
      ${cover(null, a.name, { round: true })}
      <div class="ins-disc-main"><a class="ins-disc-name" href="${artistHref(a.name)}">${a.name}</a><span class="ins-disc-sub">first played ${dayText(localDay(a.first_ts))}</span></div>
      <span class="ins-disc-plays">${fmt.num(a.plays)} <small>${a.plays === 1 ? 'play' : 'plays'}</small></span>
    </li>`)}</ol>`);
  }

  function localDay(ms) {
    const dt = new Date(Number(ms));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  return {
    mount(el0, params) {
      root = el0;
      q = { period: normPeriod(params.period || remembered.period), anchor: normAnchor(params.anchor) };
      if (!params.period && remembered.anchor && !params.anchor) q.anchor = remembered.anchor;
      remembered.period = q.period;
      remembered.anchor = q.anchor;
      skeleton();
      load();
      // Coming back through the bare #/insights link restores the last report: say so in the URL
      // too, so it stays linkable and Back/reload show the same report.
      if (!params.period && (q.period !== 'month' || q.anchor)) go(q.period, q.anchor, { replace: true });
    },
    update(params) {
      const next = { period: normPeriod(params.period || q.period), anchor: normAnchor(params.anchor) };
      if (next.period === q.period && next.anchor === q.anchor) return;
      q = next;
      remembered.period = q.period;
      remembered.anchor = q.anchor;
      load();
    },
    onStatus(status) {
      // A running report doesn't rebuild itself under the reader; offer an update instead.
      const n = status?.today?.plays_today;
      if (!data?.period?.is_current || n == null) return;
      if (playsSeen == null) { playsSeen = n; return; }
      if (n > playsSeen) { const f = el('fresh'); if (f) f.hidden = false; }
    },
    unmount() {
      ctrl?.abort();
      offActions?.();
      offSeg?.();
      offKind?.();
      if (root) destroyCharts(root);
      root = null;
      data = null;
    },
  };
}

export default createReports;

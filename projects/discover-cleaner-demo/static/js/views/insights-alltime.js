// Insights → All time tab (GET /api/v2/insights/overview): the long story of your listening —
// totals, plays per year (select a year → Year in music), streaks, how concentrated your taste is,
// discovery per year, best discoveries, one-week obsessions, artists worth rediscovering (with
// "Hide from stats" for podcasts and the like) and how your listening hours moved over the years.
import {
  html, mount, fmt, infoTip, meter, errorState, loadingState, actions, toast, toastError, artistHref, setRefetching,
} from '../core/ui.js';
import charts from '../core/charts.js';
import { gapBars } from './insights-charts.js';
import {
  cachedGet, peek, invalidate, isAbort, putChart, destroyCharts, topList, coverageBanner, dayText, rangeText, hourText,
  cover, playButton, card,
} from './insights-common.js';

const PATH = '/api/v2/insights/overview';

function localDay(ms) {
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthYear(ms) {
  return new Date(Number(ms)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function agoText(days) {
  const d = Number(days);
  if (!Number.isFinite(d)) return '';
  if (d < 60) return `${fmt.plural(d, 'day')} ago`;
  if (d < 730) return `${fmt.plural(Math.round(d / 30.4), 'month')} ago`;
  const y = d / 365.25;
  return `${y < 10 ? (Math.round(y * 2) / 2).toString().replace(/\.0$/, '') : Math.round(y)} years ago`;
}

export default function createAllTime({ api, router }) {
  let root = null;
  let ctrl = null;
  let data = null;
  let offActions = null;
  let refetchTimer = 0;
  const hidden = new Map();   // key -> rediscover row hidden in this session (kept for undo)

  const el = (name) => root?.querySelector(`[data-slot="${name}"]`);

  async function load({ force = false } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    const cached = peek(PATH, {});
    if (cached && !force) render(cached.data);
    else if (data) setRefetching(root, true);
    try {
      const d = await cachedGet(api, PATH, {}, { signal: ctrl.signal, force, maxAgeMs: 5 * 60000 });
      if (!root) return;
      if (d !== data) render(d);
      else setRefetching(root, false);
    } catch (err) {
      if (isAbort(err) || !root) return;
      setRefetching(root, false);
      if (data) { toastError(err); return; }
      delete root.dataset.built;
      const notReady = err.code === 'history_not_ready';
      mount(root, errorState(err, {
        title: notReady ? 'Your history is still being built' : "Couldn't load your all-time story",
        body: notReady ? 'This appears as soon as the play history is ready (usually within a minute). Playback and the backlog keep working.' : `${err.message} Playback, the backlog and the other tabs still work.`,
        retry: () => load({ force: true }),
      }));
      if (notReady) setTimeout(() => { if (root && !data) load({ force: true }); }, 8000);
    }
  }

  function render(d) {
    data = d;
    setRefetching(root, false);
    if (!root.dataset.built) build();
    const defs = d.definitions || {};
    mount(el('banner'), coverageBanner(d.coverage));
    renderHero(d, defs);
    renderYears(d, defs);
    renderStreaks(d, defs);
    renderConcentration(d, defs);
    const tops = (d.top_artists || []).map((a) => ({ ...a, sub: `${fmt.pct(a.share_pct, { digits: a.share_pct < 10 ? 1 : 0 })} of all plays` }));
    const topMax = tops[0]?.plays || 1;
    const half = (rows, label) => html`<div class="ins-top-col">${topList(rows, { kind: 'artists', compare: false, max: topMax, label, empty: 'No artists yet.' })}</div>`;
    mount(el('top'), tops.length > 10
      ? html`<div class="ins-top-split">${half(tops.slice(0, 10), 'Top artists of all time, 1 to 10')}${half(tops.slice(10, 20), 'Top artists of all time, 11 to 20')}</div>`
      : half(tops, 'Top artists of all time'));
    renderDiscovery(d, defs);
    renderBest(d);
    renderObsessions(d);
    renderRediscover(d);
    renderClock(d, defs);
  }

  function build() {
    root.dataset.built = '1';
    const defs = data?.definitions || {};
    mount(root, html`
      <div data-slot="banner"></div>
      <section class="card ins-hero ins-hero--alltime" aria-labelledby="ins-at-hero">
        <div class="ins-hero-text" data-slot="hero"></div>
        <dl class="ins-mini-stats" data-slot="hero-stats"></dl>
      </section>
      ${card({ id: 'ins-at-years', title: 'Plays per year', info: 'Every play in each calendar year, including bulk scrobbles. Select a year to open its Year in music.', desc: html`<span data-slot="years-line"></span>`, body: html`<div data-slot="years"></div>` })}
      <div class="ins-grid-2">
        ${card({ id: 'ins-at-streaks', title: 'Streaks', info: defs.streaks, body: html`<div data-slot="streaks"></div>` })}
        ${card({ id: 'ins-at-conc', title: 'How focused your taste is', info: defs.concentration, desc: html`<span data-slot="conc-line"></span>`, body: html`<div data-slot="conc"></div>` })}
      </div>
      ${card({ id: 'ins-at-top', title: 'Top artists of all time', info: defs.top_artists, desc: 'Ranked by every play in your history.', body: html`<div data-slot="top"></div>` })}
      ${card({ id: 'ins-at-disc', title: 'Discovery by year', info: defs.discovery_by_year, desc: html`<span data-slot="disc-line"></span>`, body: html`<div class="ins-grid-2 ins-grid-2--tight"><div data-slot="disc-new"></div><div data-slot="disc-back"></div></div>` })}
      <div class="ins-grid-2">
        ${card({ id: 'ins-at-best', title: 'Best discoveries', info: defs.best_discoveries, desc: 'Artists you found along the way who stuck: every play since you first heard them.', body: html`<div data-slot="best"></div>` })}
        ${card({ id: 'ins-at-obs', title: 'Obsessions', info: defs.obsessions, desc: 'The most you played one song in a single week.', body: html`<div data-slot="obsessions"></div>` })}
      </div>
      ${card({ id: 'ins-at-redis', title: 'Worth rediscovering', info: [defs.rediscover, defs.hidden_artists].filter(Boolean).join(' '), desc: "Artists you loved who have gone quiet. Press play to hear their most-played song. Not music (a podcast, comedy)? Hide it from your stats.", body: html`<div data-slot="rediscover"></div>` })}
      ${card({ id: 'ins-at-clock', title: 'When you listen, over the years', info: defs.clock_by_year, desc: html`<span data-slot="clock-line"></span>`, body: html`<div class="ins-clock-story"><div data-slot="clock"></div><div data-slot="clock-years"></div></div>` })}`);
  }

  function renderHero(d, defs) {
    const t = d.totals || {};
    const years = t.first_ts ? (Date.now() - t.first_ts) / (365.25 * 86400000) : 0;
    const span = years >= 1 ? `${fmt.num(years, { digits: years < 10 ? 1 : 0 }).replace(/\.0$/, '')} years` : fmt.plural(t.days_span, 'day');
    mount(el('hero'), html`
      <div class="ins-hero-label" id="ins-at-hero"><span>Plays</span>${infoTip(defs.plays, { label: 'Plays' })}<span class="ins-hero-period">all time</span></div>
      <div class="hero-figure ins-hero-figure">${fmt.num(t.plays)}</div>
      <p class="ins-hero-sub-line">Since ${dayText(localDay(t.first_ts), { year: 'always' })}: ${span} of listening</p>
      ${t.bulk_plays ? html`<p class="ins-hero-note"><span>${fmt.plural(t.bulk_plays, 'play')} were scrobbled in bulk, so their times aren't real. ${infoTip(defs.bulk_note, { label: 'Bulk scrobbles' })}</span></p>` : ''}`);
    const stat = (label, value, info) => html`<div class="ins-mini-stat"><dt>${label}${info ? infoTip(info, { label }) : ''}</dt><dd>${value}</dd></div>`;
    mount(el('hero-stats'), [
      stat('Listening time', `≈ ${fmt.num(t.hours_est)} h`, defs.hours_est ? `${defs.hours_est} ${defs.listening_time || ''}` : defs.listening_time),
      stat('Artists', fmt.num(t.artists), defs.artists),
      stat('Tracks', fmt.num(t.tracks), defs.tracks),
      stat('Albums', fmt.num(t.albums), defs.albums),
      stat('Days with music', `${fmt.num(t.active_days)}`, `${defs.active_days || ''} Out of ${fmt.num(t.days_span)} days since your first play.`),
      stat('Plays per listening day', fmt.num(t.plays && t.active_days ? (t.plays - (t.bulk_plays || 0)) / t.active_days : null, { digits: 0 }), `${defs.avg_plays_per_active_day || 'Plays per day, counting only the days you listened.'} Bulk scrobbles are left out: their dates aren't real.`),
    ]);
  }

  function renderYears(d) {
    const rows = d.plays_by_year || [];
    const thisYear = new Date().getFullYear();
    const complete = rows.filter((r) => r.complete !== false && r.year !== thisYear);
    const best = [...complete].sort((a, b) => b.plays - a.plays)[0];
    mount(el('years-line'), best
      ? html`Your biggest year was <strong>${best.year}</strong>, with ${fmt.plural(best.plays, 'play')}${best.top_artist ? html` (most of all <a class="ins-inline-link" href="${artistHref(best.top_artist.name)}">${best.top_artist.name}</a>)` : ''}. Select a year to open its Year in music.`
      : 'Select a year to open its Year in music.');
    const pts = rows.map((r) => ({
      key: r.year,
      label: String(r.year),
      fullLabel: r.year === thisYear ? `${r.year} (so far)` : String(r.year),
      value: r.plays,
      note: r.top_artist ? `Top artist: ${r.top_artist.name} (${fmt.num(r.top_artist.plays)})` : '',
    }));
    const slot = el('years');
    const cur = slot.querySelector('figure.chart');
    if (cur) cur.chart.update(pts);
    else {
      putChart(slot, charts.yearBars(pts, {
        ariaLabel: 'Plays per year', valueLabel: 'plays', height: 210, highlightKey: best?.year, tableToggle: true,
        onSelect: (p) => router.navigate(router.href('insights', { tab: 'year', year: p.key ?? p.raw?.key })),
      }));
    }
  }

  function renderStreaks(d) {
    const s = d.streaks || {};
    const t = d.totals || {};
    const lg = s.longest;
    const cur = s.current;
    mount(el('streaks'), html`
      <div class="ins-streaks">
        <div class="ins-streak">
          <div class="ins-streak-label">Longest streak</div>
          <div class="ins-streak-value">${lg ? fmt.plural(lg.days, 'day') : '—'}</div>
          <div class="ins-streak-detail">${lg ? `in a row, ${rangeText(lg.start, lg.end)}` : 'No listening days yet'}</div>
        </div>
        <div class="ins-streak">
          <div class="ins-streak-label">Current streak</div>
          <div class="ins-streak-value">${cur ? fmt.plural(cur.days, 'day') : 'None'}</div>
          <div class="ins-streak-detail">${cur ? (cur.includes_today ? `including today, since ${dayText(cur.start)}` : `through yesterday; listen today to keep it going`) : 'Play something today to start one.'}</div>
        </div>
      </div>
      ${lg && cur ? meter({ value: cur.days, max: lg.days, label: 'Current streak compared with your longest', valueLabel: `${fmt.num(cur.days)} of ${fmt.num(lg.days)} days`, tone: 'accent' }) : ''}
      ${t.active_days && t.days_span ? html`<p class="ins-foot">You've played music on <strong>${fmt.pct((100 * t.active_days) / t.days_span)}</strong> of days since ${dayText(localDay(t.first_ts), { year: 'always' })} (${fmt.num(t.active_days)} of ${fmt.num(t.days_span)}).</p>` : ''}`);
  }

  function renderConcentration(d) {
    const c = d.concentration || {};
    const top = (d.top_artists || [])[0];
    mount(el('conc-line'), c.top10_pct != null
      ? html`Your top 10 artists are <strong>${fmt.pct(c.top10_pct)}</strong> of everything you've played.`
      : 'Not enough plays yet.');
    const row = (label, pct) => meter({ value: pct || 0, max: 100, label, valueLabel: fmt.pct(pct, { digits: pct < 10 ? 1 : 0 }) });
    mount(el('conc'), html`<div class="ins-meters">
      ${row(top ? `#1: ${top.name}` : 'Your #1 artist', c.top1_pct)}
      ${row('Top 10 artists', c.top10_pct)}
      ${row('Top 50 artists', c.top50_pct)}
      ${c.top200_pct != null ? row('Top 200 artists', c.top200_pct) : ''}
    </div>
    ${c.one_play_artists != null ? html`<p class="ins-foot">${fmt.num(c.one_play_artists)} artists (${fmt.pct(c.one_play_artists_pct)}) got exactly one play: tried once, never again.</p>` : ''}`);
  }

  function renderDiscovery(d) {
    const rows = d.discovery_by_year || [];
    const best = [...rows].sort((a, b) => b.discovered - a.discovered)[0];
    const elig = rows.filter((r) => r.returned_pct != null && r.eligible);
    const totalElig = elig.reduce((a, r) => a + r.eligible, 0);
    const avgBack = totalElig ? elig.reduce((a, r) => a + r.returned_pct * r.eligible, 0) / totalElig : null;
    mount(el('disc-line'), best
      ? html`<strong>${best.year}</strong> was your most adventurous year: ${fmt.plural(best.discovered, 'new artist')} (${fmt.pct(best.pct_of_year_artists)} of the artists you played that year).${avgBack != null ? html` About <strong>${fmt.pct(avgBack)}</strong> of new finds get played again within six months.` : ''}`
      : 'Your first 90 days are left out, since everything is new at the start.');
    const thisYear = new Date().getFullYear();
    const newPts = rows.map((r) => ({ key: r.year, label: String(r.year), fullLabel: r.year === thisYear ? `${r.year} (so far)` : String(r.year), value: r.discovered, note: `${fmt.pct(r.pct_of_year_artists)} of the artists you played that year` }));
    const backPts = rows.map((r) => ({
      key: r.year, label: String(r.year), fullLabel: `Found in ${r.year}`,
      value: r.returned_pct,
      note: r.returned_pct == null ? 'Too recent: finds need six months before this can be told' : `Of ${fmt.num(r.eligible)} artists found early enough to tell`,
    }));
    putChart(el('disc-new'), charts.yearBars(newPts, { title: 'New artists per year', valueLabel: 'new artists', height: 190, tableToggle: true, labelHeader: 'Year' }));
    putChart(el('disc-back'), gapBars(backPts, {
      title: 'Share that came back', subtitle: 'Played again 30–180 days after the first listen', height: 190,
      labelHeader: 'Year', valueLabel: 'came back', missingText: 'Too recent to tell',
      formatValue: (v) => `${fmt.pct(v)} came back`, formatTick: (v) => `${v}%`,
    }));
  }

  function renderBest(d) {
    const list = d.best_discoveries || [];
    if (!list.length) { mount(el('best'), html`<p class="ins-empty-line">Artists you discover after your first 90 days show up here once they've stuck.</p>`); return; }
    mount(el('best'), html`<ol class="ins-rows" role="list">${list.slice(0, 8).map((a) => html`<li class="ins-row">
      ${cover(null, a.name, { round: true })}
      <div class="ins-row-main"><a class="ins-row-title" href="${artistHref(a.name)}">${a.name}</a><span class="ins-row-sub">Found ${monthYear(a.first_ts)}${a.rank ? ` · now #${fmt.num(a.rank)} of all time` : ''}</span></div>
      <span class="ins-row-meta">${fmt.num(a.plays)} <small>plays</small></span>
    </li>`)}</ol>`);
  }

  function renderObsessions(d) {
    const list = d.obsessions || [];
    if (!list.length) { mount(el('obsessions'), html`<p class="ins-empty-line">Play one song 15 times in a week and it shows up here.</p>`); return; }
    mount(el('obsessions'), html`<ol class="ins-rows" role="list">${list.slice(0, 8).map((o) => html`<li class="ins-row">
      ${cover(o.image, o.track)}
      <div class="ins-row-main"><span class="ins-row-title" title="${o.track}">${o.track}</span><span class="ins-row-sub"><a href="${artistHref(o.artist)}">${o.artist}</a> · week of ${dayText(o.peak7_start_day || localDay(o.peak7_start), { year: 'always' })}</span></div>
      <span class="ins-row-meta" data-tip="${`${fmt.num(o.lifetime)} plays in total`}"><strong>${fmt.num(o.peak7)}</strong> <small>in 7 days</small></span>
      <span class="ins-row-act">${playButton({ id: o.spotify_track_id, artist: o.artist, name: o.track })}</span>
    </li>`)}</ol>`);
  }

  function renderRediscover(d) {
    const list = (d.rediscover || []).filter((r) => !hidden.has(r.key));
    if (!list.length) {
      mount(el('rediscover'), html`<p class="ins-empty-line">Nobody's gone quiet: every artist you loved (40+ plays in a year) got a play in the last 90 days.</p>`);
      return;
    }
    mount(el('rediscover'), html`<ol class="ins-rows ins-rows--2" role="list">${list.map((r) => html`<li class="ins-row" data-key="${r.key}">
      ${cover(null, r.name, { round: true })}
      <div class="ins-row-main"><a class="ins-row-title" href="${artistHref(r.name)}">${r.name}</a><span class="ins-row-sub">Loved in ${r.peak_year} (${fmt.plural(r.peak_plays, 'play')}) · last played ${agoText(r.days_since)}</span></div>
      <span class="ins-row-act">
        ${r.top_song ? playButton({ id: r.top_song.spotify_track_id, artist: r.name, name: r.top_song.name, label: `Play ${r.top_song.name} by ${r.name}` }) : ''}
        <button type="button" class="btn btn-ghost btn-sm ins-hide-btn" data-action="ins-hide" data-name="${r.name}" data-key="${r.key}" aria-label="Hide ${r.name} from stats" data-tip="Not music? Leave it out of every report">Hide</button>
      </span>
    </li>`)}</ol>`);
  }

  function renderClock(d) {
    const rows = d.clock_by_year || [];
    const thisYear = new Date().getFullYear();
    const first = rows.find((r) => r.plays >= 500) || rows[0];
    // compare with the latest finished year: a running year (or one with a stalled sync) is lopsided
    const last = [...rows].reverse().find((r) => r.plays >= 500 && r.year < thisYear) || [...rows].reverse().find((r) => r.plays >= 500) || rows[rows.length - 1];
    let line = 'Plays by the hour they started, all years together.';
    if (first && last && first.year !== last.year) {
      const owl = (r) => r.night_pct >= 30;
      const moved = first.peak_hour !== last.peak_hour;
      line = html`In <strong>${first.year}</strong> ${fmt.pct(first.night_pct)} of your plays were between 10 PM and 4 AM${owl(first) ? ' (a night owl)' : ''}; by <strong>${last.year}</strong> it was ${fmt.pct(last.night_pct)}${moved ? html`, and your busiest hour had moved from ${hourText(first.peak_hour)} to <strong>${hourText(last.peak_hour)}</strong>` : ''}.`;
    }
    mount(el('clock-line'), line);
    const slot = el('clock');
    const cur = slot.querySelector('figure.chart');
    if (cur) cur.chart.update(d.clock || []);
    else putChart(slot, charts.clock(d.clock || [], { title: 'All years together', subtitle: 'Plays by the hour they started', valueLabel: 'plays', height: 190, tableToggle: true, showNote: false }));
    const maxNight = Math.max(40, ...rows.map((r) => r.night_pct || 0));
    mount(el('clock-years'), html`<table class="ins-clock-table">
      <caption class="sr-only">Busiest hour and night listening by year</caption>
      <thead><tr><th scope="col">Year</th><th scope="col">Busiest hour</th><th scope="col">Between 10 PM and 4 AM</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr>
        <th scope="row">${r.year}</th>
        <td>${hourText(r.peak_hour)}</td>
        <td><div class="ins-night"><span class="ins-night-track" aria-hidden="true"><span class="ins-night-fill" style="width:${Math.min(100, (r.night_pct / maxNight) * 100).toFixed(1)}%"></span></span><span class="ins-night-val">${fmt.pct(r.night_pct)}</span></div></td>
      </tr>`)}</tbody>
    </table>`);
  }

  // ------------------------------------------------------------------ actions
  async function hideArtist(ds, btn) {
    const { name, key } = ds;
    if (!name) return;
    const row = btn.closest('.ins-row');
    btn.disabled = true;
    try {
      await api.post(`/api/v2/artist/${encodeURIComponent(name)}/hide`, { hidden: true });
    } catch (err) {
      btn.disabled = false;
      toastError(err, `Couldn't hide ${name}.`);
      return;
    }
    hidden.set(key, (data?.rediscover || []).find((r) => r.key === key) || null);
    row?.classList.add('is-leaving');
    setTimeout(() => { if (data) renderRediscover(data); }, 180);
    invalidate('/api/v2/');
    scheduleRefetch((d) => !(d.rediscover || []).some((r) => r.key === key));
    toast(html`<strong>${name}</strong> is hidden from your stats.`, {
      kind: 'success',
      detail: 'Reports and insights leave them out. You can bring them back from their artist page.',
      action: { label: 'Undo', onClick: () => unhide(name, key) },
    });
  }

  async function unhide(name, key) {
    try {
      await api.post(`/api/v2/artist/${encodeURIComponent(name)}/hide`, { hidden: false });
      const saved = hidden.get(key);
      hidden.delete(key);
      invalidate('/api/v2/');
      toast(html`<strong>${name}</strong> is back in your stats.`, { kind: 'success' });
      // put the row straight back; the refetch below confirms it once the history catches up
      if (data && saved && !(data.rediscover || []).some((r) => r.key === key)) {
        data = { ...data, rediscover: [...data.rediscover, saved].sort((a, b) => b.peak_plays - a.peak_plays) };
      }
      if (data) renderRediscover(data);
      scheduleRefetch((d) => (d.rediscover || []).some((r) => r.key === key) || !saved);
    } catch (err) {
      toastError(err, `Couldn't restore ${name}.`);
    }
  }

  function scheduleRefetch(settled, tries = 6) {
    // the history rebuilds in the background after a hide; refresh quietly until it shows the change
    clearTimeout(refetchTimer);
    refetchTimer = setTimeout(async () => {
      if (!root) return;
      try {
        const d = await cachedGet(api, PATH, {}, { force: true });
        if (!root) return;
        if (!settled || settled(d) || tries <= 1) { render(d); return; }
      } catch (err) {
        if (isAbort(err)) return;
      }
      scheduleRefetch(settled, tries - 1);
    }, 1500);
  }

  return {
    mount(el0) {
      root = el0;
      mount(root, loadingState('Reading your whole history…'));
      offActions = actions(root, { 'ins-hide': hideArtist });
      load();
    },
    update() {},
    unmount() {
      ctrl?.abort();
      clearTimeout(refetchTimer);
      offActions?.();
      if (root) destroyCharts(root);
      root = null;
      data = null;
    },
  };
}

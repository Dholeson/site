// Insights → Backlog tab (GET /api/v2/backlog/insights): is the "to listen" playlist shrinking?
// Size over time, cleared vs added per week (two charts on one scale, never a dual axis), honest
// windows (a window the app didn't fully see says so and shows the span it can measure), pace and
// projection in plain sentences, how deeply cleared tracks were heard, hit rate by genre, kept rate.
// Live: the hero follows /api/status and the numbers refresh shortly after a clear.
import {
  html, mount, fmt, icon, infoTip, errorState, loadingState, emptyState, setRefetching, debounce,
} from '../core/ui.js';
import { timeLine, gapBars } from './insights-charts.js';
import { cachedGet, isAbort, putChart, destroyCharts, dayText, rangeText } from './insights-common.js';

const PATH = '/api/v2/backlog/insights';

function addDays(day, n) {
  const m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3] + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Rates in prose are whole tracks ("about 8 a week"), never "9.8 tracks".
const whole = (n) => (n == null ? '—' : n > 0 && n < 1 ? 'under 1' : fmt.num(Math.round(n)));
/** "+203" with an up/down icon (red when the backlog grew, green when it shrank), like every Insights delta. */
const netChange = (n) => (n == null ? '—' : html`<span class="ins-net ins-net--${n > 0 ? 'grew' : n < 0 ? 'shrank' : 'flat'}">${n ? icon(n > 0 ? 'arrowUp' : 'arrowDown') : ''}<span class="sr-only">${n > 0 ? 'grew by ' : n < 0 ? 'shrank by ' : ''}</span>${fmt.signed(n)}</span>`);

export default function createBacklog({ api, store }) {
  let root = null;
  let ctrl = null;
  let data = null;
  let lastSeq = null;
  let lastTotal = null;
  // Refresh after a clear, but never pull the page out from under keyboard focus: wait until
  // focus has left the numbers (the hero count still updates live from /api/status).
  const refetchSoon = debounce(() => {
    if (!root) return;
    const a = document.activeElement;
    if (a && a !== document.body && el('body')?.contains(a) && !a.closest('.ins-hero-text')) { refetchSoon(); return; }
    load({ quiet: true });
  }, 2500);

  const el = (name) => root?.querySelector(`[data-slot="${name}"]`);

  async function load({ quiet = false } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    if (data && !quiet) setRefetching(el('body'), true);
    try {
      const d = await cachedGet(api, PATH, {}, { signal: ctrl.signal, force: true });
      if (!root) return;
      render(d);
    } catch (err) {
      if (isAbort(err) || !root) return;
      setRefetching(el('body'), false);
      if (data) return;           // keep what's on screen; the next status change retries
      destroyCharts(root);
      delete el('body').dataset.built;
      mount(el('body'), errorState(err, { title: "Couldn't load backlog insights", body: `${err.message} Clearing keeps working as you listen.`, retry: () => load() }));
    }
  }

  function playlistName() {
    const s = store.status || {};
    return s.backlog?.name || s.playlist_name || 'your backlog';
  }

  function render(d) {
    data = d;
    const body = el('body');
    setRefetching(body, false);
    const s = store.status || {};
    if (d.current_total == null && !(d.trajectory || []).length) {
      destroyCharts(body);
      delete body.dataset.built;
      const noPlaylist = s.backlog && !s.backlog.playlist_id;
      mount(body, emptyState({
        icon: 'backlog',
        title: noPlaylist ? 'No backlog playlist yet' : "Your backlog hasn't been read yet",
        body: noPlaylist
          ? 'Pick the playlist you listen through in Settings. Its size, pace and cleared tracks show up here.'
          : 'Once the app has read your backlog playlist, its size and progress show up here. Leave the app running for a minute.',
        action: noPlaylist ? { label: 'Choose a playlist', href: '#/settings?section=backlog' } : undefined,
      }));
      return;
    }
    if (!body.dataset.built) build(body);
    const defs = d.definitions || {};
    renderHero(d, defs);
    renderWindows(d, defs);
    renderWeekly(d, defs);
    renderFunnel(d, defs);
    renderGenres(d, defs);
    renderKept(d, defs);
  }

  function build(body) {
    body.dataset.built = '1';
    const defs = data?.definitions || {};
    mount(body, html`
      <section class="card ins-hero ins-hero--backlog" aria-labelledby="ins-bl-hero">
        <div class="ins-hero-text" data-slot="hero"></div>
        <div class="ins-hero-chart" data-slot="trajectory"></div>
      </section>
      <section class="ins-section" aria-labelledby="ins-bl-win">
        <h2 class="ins-section-title" id="ins-bl-win">Cleared and added ${infoTip(defs.windows, { label: 'Windows' })}</h2>
        <div class="ins-windows" data-slot="windows"></div>
      </section>
      <section class="card ins-card" aria-labelledby="ins-bl-weekly">
        <div class="ins-card-head"><div class="ins-card-heading">
          <h2 class="ins-card-title" id="ins-bl-weekly"><span>Week by week</span>${infoTip(defs.weekly, { label: 'Week by week' })}</h2>
          <p class="ins-card-desc ins-sentence" data-slot="weekly-line"></p>
        </div></div>
        <div class="ins-grid-2 ins-grid-2--tight"><div data-slot="w-cleared"></div><div data-slot="w-added"></div></div>
      </section>
      <div class="ins-grid-2">
        <section class="card ins-card" aria-labelledby="ins-bl-funnel">
          <div class="ins-card-head"><div class="ins-card-heading">
            <h2 class="ins-card-title" id="ins-bl-funnel"><span>How much you heard before clearing</span>${infoTip(defs.funnel, { label: 'Listen depth' })}</h2>
            <p class="ins-card-desc ins-sentence" data-slot="funnel-line"></p>
          </div></div>
          <div data-slot="funnel"></div>
        </section>
        <section class="card ins-card" aria-labelledby="ins-bl-genre">
          <div class="ins-card-head"><div class="ins-card-heading">
            <h2 class="ins-card-title" id="ins-bl-genre"><span>Hit rate by genre</span>${infoTip(defs.by_genre, { label: 'Hit rate by genre' })}</h2>
            <p class="ins-card-desc ins-sentence" data-slot="genre-line"></p>
          </div></div>
          <div data-slot="genres"></div>
        </section>
      </div>
      <div data-slot="kept"></div>`);
  }

  function paceSentences(d) {
    const p = d.pace || {};
    const out = [];
    const total = d.current_total;
    if (total === 0) return [html`Your backlog is empty. Nice work.`];
    if (p.cleared_per_week == null) {
      out.push(html`The pace shows up after a week of use: the app needs a few days of backlog sizes to measure it.`);
      return out;
    }
    const basis = p.basis_days ? ` (averaged over the last ${fmt.plural(p.basis_days, 'day')})` : '';
    if (p.growing) {
      out.push(html`It's growing: about <strong>${whole(p.inflow_per_week)}</strong> tracks come in a week and you clear about <strong>${whole(p.cleared_per_week)} a week</strong>${basis}.`);
      if (p.needed_per_day_12w != null) out.push(html`Clear <strong>${fmt.num(Math.ceil(p.needed_per_day_12w))} a day</strong> to empty it in 12 weeks.`);
    } else if (p.empty_by_day) {
      out.push(html`At this pace it's empty by <strong>${dayText(p.empty_by_day, { year: 'always' })}</strong> (${fmt.plural(Math.ceil(p.weeks_to_empty), 'week')}): you clear about ${whole(p.cleared_per_week)} a week and about ${whole(p.inflow_per_week)} come in${basis}.`);
    }
    if (p.best_week && p.best_week.cleared) {
      const tail = p.at_best_week_pace ? html` Weeks like that would empty it by ${dayText(p.at_best_week_pace.empty_by_day, { year: 'always' })}.` : '';
      out.push(html`Your best week (from ${dayText(p.best_week.start)}) cleared ${fmt.plural(p.best_week.cleared, 'track')}.${tail}`);
    }
    return out;
  }

  function renderHero(d, defs) {
    const s = store.status || {};
    const b = s.backlog || {};
    const total = b.total ?? d.current_total;
    lastTotal = total;
    let sync = '';
    if (b.loading || b.complete === false) {
      const pr = b.progress || {};
      sync = html`<p class="ins-bl-sync">${icon('refresh')}<span>Reading the playlist${pr.total ? ` (${fmt.num(pr.loaded)} of ${fmt.num(pr.total)})` : ''}…</span></p>`;
    } else if (b.synced_at_ms) {
      sync = html`<p class="ins-bl-sync">${icon('check')}<span>Checked ${fmt.relTime(b.synced_at_ms)}</span></p>`;
    }
    mount(el('hero'), html`
      <div class="ins-hero-label" id="ins-bl-hero"><span>Tracks left</span><span class="ins-hero-period">in ${playlistName()}</span></div>
      <div class="hero-figure ins-hero-figure" data-slot="bl-total">${fmt.num(total)}</div>
      ${sync}
      <ul class="ins-pace" role="list">${paceSentences(d).map((x, i) => html`<li>${x}${i === 0 && defs.pace ? html` ${infoTip(defs.pace, { label: 'Pace' })}` : ''}</li>`)}</ul>
      ${s.auto_clean && s.auto_clean.enabled === false ? html`<p class="ins-hero-note"><span>Auto-clear is paused, so nothing is being cleared as you listen. Turn it back on from the player or Now.</span></p>` : ''}
      `);
    const traj = (d.trajectory || []).map((t) => ({ day: t.day, value: t.total }));
    const gaps = [];
    for (let i = 1; i < traj.length; i++) {
      const a = new Date(`${traj[i - 1].day}T12:00:00`); const b = new Date(`${traj[i].day}T12:00:00`);
      if ((b - a) / 86400000 > 3) gaps.push(rangeText(addDays(traj[i - 1].day, 1), addDays(traj[i].day, -1)));
    }
    const caption = gaps.length ? `Not recorded ${gaps.slice(-3).join(' and ')}: the app wasn't running.` : '';
    const slot = el('trajectory');
    const cur = slot.querySelector('figure.chart');
    const gap = (d.trajectory || []).length > 1;
    if (cur) cur.chart.update(traj, { caption });
    else {
      putChart(slot, timeLine(traj, {
        title: 'Backlog size', subtitle: gap ? 'At the end of each day the app ran' : 'Recorded each day the app runs',
        valueLabel: 'tracks', height: 230, caption,
      }));
    }
  }

  function windowCard(title, w, defs, { range } = {}) {
    if (!w) return '';
    const m = w.measured;
    const exact = w.exact;
    const main = (label, value, tone, info) => html`<div class="ins-win-stat"><dt>${label}${info ? infoTip(info, { label }) : ''}</dt><dd class="${tone || ''}">${value}</dd></div>`;
    let foot = '';
    if (!exact) {
      const since = m ? dayText(m.start_day, { year: 'auto' }) : null;
      foot = html`<div class="ins-win-foot">
        <p>${icon('info')}<span>The backlog size on ${dayText(w.start_day)} wasn't recorded (the app wasn't running), so tracks added in these ${w.days} days aren't known.</span></p>
        ${m ? html`<p class="ins-win-measured">Measurable since ${since} (${fmt.plural(m.days, 'day')}): <strong>${fmt.num(m.inflow)}</strong> added, backlog <strong>${netChange(m.net)}</strong></p>` : ''}
      </div>`;
    }
    return html`<section class="ins-win" aria-label="${title}">
      <div class="ins-win-head"><h3 class="ins-win-title">${title}</h3><span class="ins-win-range">${range}</span></div>
      <dl class="ins-win-stats">
        ${main('Cleared', fmt.num(w.cleared), 'is-cleared', defs.cleared)}
        ${main('Added', exact ? fmt.num(w.inflow) : 'Not known', exact ? '' : 'is-unknown', defs.inflow)}
        ${main('Change', exact ? netChange(w.net) : 'Not known', exact ? '' : 'is-unknown', defs.net)}
      </dl>
      ${foot}
    </section>`;
  }

  function renderWindows(d, defs) {
    const w = d.windows || {};
    const today = (d.trajectory || []).slice(-1)[0]?.day || null;
    const r = (win) => (win && today ? rangeText(addDays(win.start_day, 1), today) : '');
    mount(el('windows'), [
      windowCard('Last 7 days', w.last_7, defs, { range: r(w.last_7) }),
      windowCard('Last 30 days', w.last_30, defs, { range: r(w.last_30) }),
      w.since_start ? windowCard(`Since ${dayText(w.since_start.start_day, { year: 'auto' })}`, w.since_start, defs, { range: 'since the app started tracking' }) : '',
    ]);
  }

  function renderWeekly(d) {
    const weeks = d.weekly || [];
    const fmtWeek = (wk) => {
      const end = wk.current ? 'today' : dayText(wk.week_end);
      return `Week of ${dayText(wk.week_start, { year: 'auto' })}${wk.current ? ' (so far)' : ''} · to ${end}`;
    };
    const label = (wk, i) => {
      const dt = new Date(`${wk.week_start}T12:00:00`);
      const prev = i ? new Date(`${weeks[i - 1].week_start}T12:00:00`) : null;
      return !prev || prev.getMonth() !== dt.getMonth() ? dt.toLocaleDateString('en-US', { month: 'short' }) : '';
    };
    const cleared = weeks.map((wk, i) => ({ key: wk.week_start, label: label(wk, i), fullLabel: fmtWeek(wk), value: wk.cleared }));
    const added = weeks.map((wk, i) => ({
      key: wk.week_start, label: label(wk, i), fullLabel: fmtWeek(wk), value: wk.added,
      note: wk.added == null ? "The app wasn't running long enough that week to measure it" : wk.added_days < wk.days ? `Measured over ${wk.added_days} of ${wk.days} days` : '',
    }));
    const max = Math.max(1, ...weeks.map((wk) => Math.max(wk.cleared || 0, wk.added || 0)));
    const measured = weeks.filter((wk) => wk.added != null);
    const clearedSum = weeks.reduce((a, wk) => a + (wk.cleared || 0), 0);
    const off = weeks.length - measured.length;
    // No second "cleared since the start" total here (it disagreed with the card above): each
    // week counts its own different tracks, so a track cleared again in a later week counts twice.
    const ss = d.windows?.since_start;
    const again = ss && ss.cleared != null && clearedSum > ss.cleared;
    mount(el('weekly-line'), weeks.length
      ? html`${fmt.plural(weeks.length, 'calendar week')}, Monday to Sunday. Both charts use the same scale, so bars compare directly.${again ? ' A track cleared again in a later week counts in each of those weeks.' : ''}${off ? ` Hollow marks are weeks the app didn't see enough of to count what came in (${off} of ${weeks.length}).` : ''}`
      : 'Weekly figures appear after the app has been running for a while.');
    const c = el('w-cleared').querySelector('figure.chart');
    if (c) c.chart.update(cleared, { max });
    else putChart(el('w-cleared'), gapBars(cleared, { title: 'Cleared per week', valueLabel: 'tracks cleared', max, height: 170 }));
    const a = el('w-added').querySelector('figure.chart');
    if (a) a.chart.update(added, { max });
    else putChart(el('w-added'), gapBars(added, { title: 'Added per week', valueLabel: 'tracks added', max, height: 170, missingText: 'Not measured' }));
  }

  function renderFunnel(d, defs) {
    const f = d.funnel || {};
    const known = f.known || 0;
    if (!f.cleared_distinct) {
      mount(el('funnel-line'), 'Nothing has been cleared yet.');
      mount(el('funnel'), html`<p class="ins-empty-line">Once tracks are cleared as you listen, this shows how much of each you heard first.</p>`);
      return;
    }
    mount(el('funnel-line'), known
      ? html`You heard <strong>${fmt.pct(f.deep_pct)}</strong> of cleared tracks for 2 minutes or more. The typical cleared track got <strong>${fmt.duration(f.median_listen_s, { unit: 's' })}</strong>. ${infoTip(defs.median_listen_s, { label: 'Typical listen' })}`
      : 'No listening times are known for the cleared tracks yet.');
    const segs = [
      { id: 'deep', label: 'Deep', sub: '2 min or more', n: f.deep, pct: f.deep_pct, cls: 'seg-deep' },
      { id: 'partial', label: 'Partial', sub: '30 s to 2 min', n: f.partial, pct: f.partial_pct, cls: 'seg-partial' },
      { id: 'skip', label: 'Skip', sub: 'under 30 s', n: f.skip, pct: f.skip_pct, cls: 'seg-skip' },
    ];
    const reasons = Object.entries(f.by_reason || {});
    const REASON = { threshold: 'automatically after the listen threshold', manual: 'with Clear now', like: 'with Like', 'catch-up': 'by catch-up', routed: 'by moving them to another playlist', unknown: 'in other ways' };
    mount(el('funnel'), html`
      <div class="ins-stack" role="img" aria-label="${segs.map((s) => `${s.label}: ${fmt.pct(s.pct)}`).join(', ')}">
        ${segs.filter((s) => s.n).map((s) => html`<span class="ins-stack-seg ${s.cls}" style="flex-grow:${s.n}" data-tip="${`${s.label} (${s.sub}): ${fmt.plural(s.n, 'track')}, ${fmt.pct(s.pct)}`}"></span>`)}
      </div>
      <dl class="ins-stack-legend">${segs.map((s) => html`<div class="ins-stack-item">
        <dt><span class="ins-swatch ${s.cls}" aria-hidden="true"></span>${s.label} <span class="muted">· ${s.sub}</span></dt>
        <dd><strong>${fmt.pct(s.pct)}</strong> <span class="muted">${fmt.plural(s.n, 'track')}</span></dd>
      </div>`)}</dl>
      <p class="ins-foot">${fmt.plural(f.cleared_distinct, 'track')} cleared in all${f.unknown ? `; ${fmt.num(f.unknown)} without a recorded play aren't in the percentages` : ''}.${reasons.length ? ` Cleared ${reasons.map(([k, n]) => `${fmt.num(n)} ${REASON[k] || k}`).join(', ')}.` : ''}</p>`);
  }

  function renderGenres(d) {
    const rows = (d.by_genre || []).filter((g) => g.deep_pct != null);
    if (!rows.length) {
      mount(el('genre-line'), 'Needs at least 3 cleared tracks in a genre.');
      mount(el('genres'), html`<p class="ins-empty-line">As you clear more tracks, you'll see which genres you end up really listening to.</p>`);
      return;
    }
    const lead = rows.find((g) => g.known >= 5) || rows[0];
    // "does best" needs a real sample, or five lucky tracks win
    const best = [...rows].filter((g) => g.known >= 8).sort((a, b) => b.deep_pct - a.deep_pct)[0];
    mount(el('genre-line'), html`Your <strong>${lead.genre}</strong> picks land ${fmt.pct(lead.deep_pct)} of the time (a deep listen)${best && best.genre !== lead.genre ? html`; <strong>${best.genre}</strong> does best at ${fmt.pct(best.deep_pct)}` : ''}.`);
    const shown = rows.slice(0, 10);
    mount(el('genres'), html`<ol class="ins-genres" role="list">${shown.map((g) => html`<li class="ins-genre" data-tip="${`${fmt.num(g.deep)} of ${fmt.num(g.known)} cleared ${g.genre} tracks got 2 minutes or more (${fmt.num(g.cleared)} cleared in all)`}">
      <span class="ins-genre-name">${g.genre}</span>
      <span class="ins-genre-bar" aria-hidden="true"><span style="width:${Math.max(1, g.deep_pct).toFixed(1)}%"></span></span>
      <span class="ins-genre-pct">${fmt.pct(g.deep_pct)}</span>
      <span class="ins-genre-n">${fmt.num(g.deep)} of ${fmt.num(g.known)}</span>
    </li>`)}</ol>
    ${rows.length > shown.length ? html`<p class="ins-foot">Showing the ${shown.length} genres you've cleared the most; ${rows.length - shown.length} more have fewer tracks.</p>` : ''}`);
  }

  function renderKept(d, defs) {
    const k = d.kept || {};
    const f = d.funnel || {};
    if (!f.cleared_distinct) { mount(el('kept'), ''); return; }
    const body = k.known
      ? html`<strong>${fmt.pct(k.pct)}</strong> of the tracks you cleared are in your Liked Songs (${fmt.num(k.kept)} of ${fmt.num(f.cleared_distinct)}).`
      : html`${k.kept ? html`${fmt.plural(k.kept, 'cleared track')} ${k.kept === 1 ? 'was' : 'were'} liked in this app.` : 'None of the cleared tracks were liked in this app yet.'} A kept rate needs your Liked Songs, which the app hasn't synced yet.`;
    mount(el('kept'), html`<section class="card ins-card ins-kept" aria-labelledby="ins-bl-kept">
      <div class="ins-kept-icon">${icon('heart')}</div>
      <div><h2 class="ins-card-title" id="ins-bl-kept"><span>Kept after clearing</span>${infoTip(defs.kept, { label: 'Kept' })}</h2>
      <p class="ins-card-desc">${body}</p></div>
    </section>`);
  }

  return {
    mount(el0) {
      root = el0;
      mount(root, html`<div class="ins-report" data-slot="body">${loadingState('Measuring your backlog…')}</div>`);
      load();
    },
    update() {},
    onStatus(status) {
      const b = status?.backlog;
      if (!b) return;
      // hero number follows the live size at once; the rest refreshes shortly after a clear
      const totalEl = el('bl-total');
      if (totalEl && b.total != null && b.total !== lastTotal) {
        lastTotal = b.total;
        totalEl.textContent = fmt.num(b.total);
      }
      if (lastSeq != null && b.removal_seq !== lastSeq) refetchSoon();
      lastSeq = b.removal_seq;
    },
    unmount() {
      ctrl?.abort();
      refetchSoon.cancel();
      if (root) destroyCharts(root);
      root = null;
      data = null;
    },
  };
}

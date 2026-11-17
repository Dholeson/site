// Settings → History & data: what the local history contains and where it comes from (a
// coverage timeline per source), Last.fm sync with live progress, other imports, and storage.
import api, { isAbort } from '../core/api.js';
import { showTooltip as chartTip, hideTooltip as chartUntip } from '../core/charts.js';
import { html, raw, mount, icon, fmt, toast, confirmDialog, loadingState, errorState, infoTip, meter, withBusy, reportError, setRefetching } from '../core/ui.js';
import { notice, statusChip, relTime, fullDate, fmtBytes, daysSince } from './settings-ui.js';

const SOURCES = {
  lastfm: { label: 'Last.fm scrobbles', color: 'var(--series-1)', desc: 'Plays scrobbled to Last.fm from any device. A play this app also heard counts once, here.' },
  live: { label: 'Heard in this app', color: 'var(--series-2)', desc: 'Plays this app heard that Last.fm doesn’t have (yet). Once Last.fm has them they count as scrobbles instead.' },
  spotify_recent: { label: 'Spotify recently played', color: 'var(--series-3)', desc: 'Plays imported from Spotify’s recently played list that neither Last.fm nor this app recorded.' },
};
const MODE_COPY = {
  sync: { verb: 'Syncing new scrobbles', done: 'Last.fm sync finished' },
  backfill: { verb: 'Fetching older scrobbles', done: 'Older scrobbles fetched' },
  full: { verb: 'Re-importing all scrobbles', done: 'Last.fm re-import finished' },
};
const DAY = 86400e3;

export function createDataSection(env) {
  let el = null;
  let health = null;
  let healthErr = null;
  let lfm = null;          // GET /api/lastfm/import
  let spi = null;          // GET /api/spotify/import
  let pollTimer = null;
  let destroyed = false;
  const offs = [];

  // ------------------------------------------------------------------ fetch
  async function loadHealth({ quiet = false } = {}) {
    const card = el?.querySelector('[data-part="history"]');
    if (quiet && card) setRefetching(card, true);
    try {
      health = await api.get('/api/v2/data/health', { timeoutMs: 15000 });
      healthErr = null;
    } catch (err) {
      if (isAbort(err)) return;
      if (!health) healthErr = err;
    } finally {
      if (card) setRefetching(card, false);
    }
    if (!destroyed) { renderHistory(); renderStorage(); renderSync(); }
  }

  async function loadImports() {
    const [a, b] = await Promise.allSettled([
      api.get('/api/lastfm/import', { timeoutMs: 10000 }),
      api.get('/api/spotify/import', { timeoutMs: 10000 }),
    ]);
    const wasLfm = lfm?.running; const wasSpi = spi?.running;
    if (a.status === 'fulfilled') lfm = a.value;
    if (b.status === 'fulfilled') spi = b.value;
    if (destroyed) return;
    if (wasLfm && lfm && !lfm.running) finishedLastfm();
    if (wasSpi && spi && !spi.running) finishedSpotify();
    renderSync();
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (destroyed) return;
    if (lfm?.running || spi?.running) pollTimer = setTimeout(() => loadImports().catch(reportError), document.hidden ? 4000 : 1000);
  }

  function finishedLastfm() {
    const copy = MODE_COPY[lfm.mode] || MODE_COPY.sync;
    if (lfm.status === 'error') {
      toast(`Last.fm import stopped: ${lfm.error || 'unknown error'}`, { kind: 'error', detail: lfm.inserted ? `${fmt.plural(lfm.inserted, 'scrobble')} were added before it stopped.` : 'Nothing was lost; try again later.' });
    } else {
      toast(copy.done, { kind: 'success', icon: 'checkCircle', detail: lfm.inserted ? `${fmt.plural(lfm.inserted, 'new scrobble')} added to your history.` : 'No new scrobbles: your history is up to date.' });
    }
    loadHealth({ quiet: true });
  }

  function finishedSpotify() {
    if (spi.status === 'error') { toast(`Spotify import stopped: ${spi.error || 'unknown error'}`, { kind: 'error' }); return; }
    const bits = [];
    if (spi.imported_plays) bits.push(fmt.plural(spi.imported_plays, 'play'));
    if (spi.imported_artists) bits.push(fmt.plural(spi.imported_artists, 'artist'));
    if (spi.imported_liked) bits.push(fmt.plural(spi.imported_liked, 'liked song'));
    toast('Spotify import finished', { kind: 'success', detail: bits.length ? `Added ${bits.join(', ')}.` : 'Nothing new to add.' });
    loadHealth({ quiet: true });
  }

  // ------------------------------------------------------------------ history card
  function lanes() {
    const src = Array.isArray(health?.sources) ? health.sources.filter((s) => s.plays > 0 && s.first_ts) : [];
    return src.map((s, i) => ({ ...s, ...(SOURCES[s.source] || { label: s.source, color: `var(--series-${Math.min(8, i + 1)})`, desc: '' }) }));
  }

  function timeline(ls) {
    if (!ls.length) return '';
    const start = Math.min(...ls.map((l) => l.first_ts));
    const end = Math.max(Date.now(), ...ls.map((l) => l.last_ts || 0));
    const span = Math.max(DAY, end - start);
    const pos = (t) => ((t - start) / span) * 100;
    const y0 = new Date(start).getFullYear() + 1;
    const y1 = new Date(end).getFullYear();
    const years = [];
    for (let y = y0; y <= y1; y++) years.push({ y, p: pos(new Date(y, 0, 1).getTime()) });
    const grid = years.map((t) => html`<span class="st-tl-gridline" style="left:${t.p.toFixed(3)}%" aria-hidden="true"></span>`);
    const range = (l) => `${fmt.date(l.first_ts, { year: 'always' })} – ${daysSince(l.last_ts) <= 1 ? 'today' : fmt.date(l.last_ts, { year: 'always' })}`;
    return html`<figure class="st-tl" aria-labelledby="st-tl-cap">
      <figcaption class="sr-only" id="st-tl-cap">Where your listening history comes from, by date</figcaption>
      <div class="st-tl-plot">
        ${ls.map((l) => {
          const left = pos(l.first_ts);
          const width = Math.max(0.8, pos(l.last_ts || end) - left);
          return html`<div class="st-tl-lane">
            <div class="st-tl-label"><span class="st-tl-key" style="background:${raw(l.color)}" aria-hidden="true"></span><span class="st-tl-name">${l.label}</span>${l.desc ? infoTip(l.desc, { label: l.label }) : ''}
              <span class="st-tl-meta">${fmt.plural(l.plays, 'play')} · ${range(l)}</span></div>
            <div class="st-tl-track">${grid}<span class="st-tl-bar" tabindex="0" role="img" data-src="${l.source}"
              aria-label="${`${l.label}: ${fmt.plural(l.plays, 'play')}, ${range(l)}`}"
              style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%;background:${raw(l.color)}"></span></div>
          </div>`;
        })}
      </div>
      <div class="st-tl-axis" aria-hidden="true">${years.map((t) => html`<span style="left:${t.p.toFixed(3)}%">${t.y}</span>`)}</div>
      <div class="sr-only"><table><caption>Plays by source</caption>
        <thead><tr><th scope="col">Source</th><th scope="col">Plays</th><th scope="col">From</th><th scope="col">To</th></tr></thead>
        <tbody>${ls.map((l) => html`<tr><th scope="row">${l.label}</th><td>${fmt.num(l.plays)}</td><td>${fmt.date(l.first_ts, { year: 'always' })}</td><td>${fmt.date(l.last_ts, { year: 'always' })}</td></tr>`)}</tbody>
      </table></div>
    </figure>`;
  }

  function historyBody() {
    if (!health) return healthErr ? errorState(healthErr, { compact: true, retry: () => loadHealth() }) : loadingState('Reading your history…', { compact: true });
    const h = health;
    const ls = lanes();
    const lag = h.newest_lastfm_ts ? daysSince(h.newest_lastfm_ts) : null;
    const lfmLane = ls.find((l) => l.source === 'lastfm');
    const bulk = lfmLane?.bulk || 0;
    const parts = [];
    if (h.migration_error) parts.push(notice({ tone: 'critical', title: 'The history database needs attention', body: `${h.migration_error} Your data wasn't changed; reports may be incomplete.` }));
    if (!h.plays_ready) {
      parts.push(notice({ tone: 'info', title: h.plays_rebuilding ? 'Building your play history…' : 'Your play history is being prepared', body: 'Reports fill in as soon as this finishes (usually under a minute).' }));
    }
    parts.push(html`<div class="st-hist-hero">
      <div>
        <div class="st-hero-num">${fmt.num(h.plays_total)}</div>
        <div class="st-hero-label">plays in your history ${infoTip('Every play in your history: Last.fm scrobbles plus tracks heard in this app. A play that was both heard here and scrobbled counts once.', { label: 'Plays in your history' })}</div>
      </div>
      ${h.oldest_play_ts ? html`<div class="st-hist-span"><span class="st-eyebrow">Covers</span><strong>${fmt.date(h.oldest_play_ts, { year: 'always' })} – today</strong><span class="muted">${fmt.num((Date.now() - h.oldest_play_ts) / (365.25 * DAY), { digits: 1 })} years</span></div>` : ''}
    </div>`);
    parts.push(timeline(ls));
    if (bulk) {
      parts.push(html`<p class="st-foot-note">${icon('info')}<span>${fmt.num(bulk)} Last.fm plays were uploaded in batches by an offline device, so their exact times aren't known. They count as plays but are left out of time-of-day charts.</span></p>`);
    }
    if (!h.lastfm_configured) {
      parts.push(notice({ tone: 'info', title: 'Add Last.fm for your full history', body: 'Without it, your history only has what this app heard while it was running.', actions: html`<a class="btn btn-secondary btn-sm" href="#/settings?section=accounts">Set up Last.fm</a>` }));
    } else if (lag != null && lag >= 2) {
      parts.push(notice({
        tone: 'warning',
        title: `Last.fm is ${fmt.plural(lag, 'day')} behind`,
        body: `Your newest scrobble is from ${fmt.date(h.newest_lastfm_ts, { year: 'always' })}. Since then only plays heard in this app are counted, so listening on other devices is missing until Last.fm catches up.`,
        actions: html`<button type="button" class="btn btn-secondary btn-sm" data-st="sync" data-mode="sync" ${lfm?.running ? raw('disabled') : ''}>${icon('refresh')}Sync now</button>`,
      }));
    }
    return parts;
  }

  // ------------------------------------------------------------------ sync card
  function progressBlock(st, kind) {
    if (kind === 'lastfm') {
      const copy = MODE_COPY[st.mode] || MODE_COPY.sync;
      const phase = st.phase === 'backfill' ? 'Looking for older scrobbles' : st.phase === 'forward' ? 'Reading new scrobbles' : copy.verb;
      return html`<div class="st-progress" role="status" aria-live="polite">
        <div class="st-progress-head"><span class="spinner spinner-sm" aria-hidden="true"></span><strong>${phase}…</strong>
          <span class="muted">${fmt.plural(st.inserted || 0, 'new scrobble')} so far</span></div>
        ${st.pages_total ? meter({ value: st.pages_done || 0, max: st.pages_total, label: 'Pages read from Last.fm', valueLabel: `${fmt.num(st.pages_done || 0)} of ${fmt.num(st.pages_total)} pages` }) : ''}
      </div>`;
    }
    return html`<div class="st-progress" role="status" aria-live="polite">
      <div class="st-progress-head"><span class="spinner spinner-sm" aria-hidden="true"></span><strong>${st.step || 'Importing from Spotify'}</strong>
        <span class="muted">${fmt.plural(st.imported_plays || 0, 'play')} · ${fmt.plural(st.imported_liked || 0, 'liked song')} so far</span></div>
    </div>`;
  }

  function lastResultLine() {
    const r = lfm?.last_result || (lfm && lfm.status !== 'idle' && !lfm.running ? lfm : null);
    if (!r || !r.status) return '';
    if (r.status === 'error') return html`${statusChip('critical', 'Last run failed')}<span class="st-kv-note">${r.error || ''}</span>`;
    return html`${statusChip('good', 'Last run OK')}<span class="st-kv-note">${r.inserted ? `${fmt.plural(r.inserted, 'new scrobble')} added` : 'no new scrobbles'}</span>`;
  }

  function syncBody() {
    const configured = health?.lastfm_configured ?? lfm?.configured;
    const running = !!lfm?.running;
    const auto = health?.auto_sync_minutes ?? lfm?.auto_sync_minutes;
    const lastSync = health?.last_sync_at ?? lfm?.last_sync_at;
    const newest = health?.newest_lastfm_ts ?? lfm?.newest_scrobble_ts;
    const spRunning = !!spi?.running;
    return html`
      <div class="st-card-head">
        <div>
          <h3 class="st-card-title">Last.fm sync</h3>
          <p class="st-row-desc">${auto ? `Brings in new scrobbles on its own every ${auto} minutes, and whenever you press Sync now.` : 'Brings in new scrobbles when you press Sync now.'}</p>
        </div>
        <button type="button" class="btn btn-primary" data-st="sync" data-mode="sync" ${!configured || running ? raw('disabled') : ''}>${icon('refresh')}${running ? 'Syncing…' : 'Sync now'}</button>
      </div>
      ${!configured ? notice({ tone: 'info', compact: true, body: html`Add your Last.fm username and API key under <a class="link-accent" href="#/settings?section=accounts">Accounts</a> to sync.` }) : ''}
      ${running ? progressBlock(lfm, 'lastfm') : ''}
      <dl class="st-kv">
        <div><dt>Last synced ${infoTip('When a Last.fm sync last finished successfully.', { label: 'Last synced' })}</dt><dd>${relTime(lastSync, { fallback: 'Never' })}</dd></div>
        <div><dt>Newest scrobble ${infoTip('The most recent play Last.fm has for you. If this is old, Last.fm may not be receiving your plays.', { label: 'Newest scrobble' })}</dt><dd>${newest ? fullDate(newest) : 'None yet'}</dd></div>
        <div><dt>Automatic sync</dt><dd>${auto ? `Every ${auto} minutes` : 'Off'}</dd></div>
        ${lastResultLine() ? html`<div class="st-kv-wide"><dt>Result</dt><dd class="st-kv-flex">${lastResultLine()}</dd></div>` : ''}
      </dl>
      <details class="st-disclosure" data-part="more-imports" ${spRunning || (running && lfm?.mode !== 'sync') ? raw('open') : ''}>
        <summary><span class="st-disclosure-title">More import options</span><span class="st-disclosure-hint">Older scrobbles, a full re-import, or Spotify’s own history</span>${icon('chevronDown')}</summary>
        <div class="st-disclosure-body">
          <div class="st-row">
            <div class="st-row-text"><div class="st-row-title">Fetch older scrobbles</div>
              <p class="st-row-desc">Looks for scrobbles from before ${health?.oldest_play_ts ? fmt.date(health.oldest_play_ts, { year: 'always' }) : 'your oldest play'}. Only needed if your history looks cut off.</p></div>
            <div class="st-row-control"><button type="button" class="btn btn-secondary" data-st="sync" data-mode="backfill" ${!configured || running ? raw('disabled') : ''}>Fetch older</button></div>
          </div>
          <div class="st-row">
            <div class="st-row-text"><div class="st-row-title">Re-import everything from Last.fm</div>
              <p class="st-row-desc">Reads your whole Last.fm account again and adds anything missing. Nothing is deleted. Takes several minutes.</p></div>
            <div class="st-row-control"><button type="button" class="btn btn-secondary" data-st="sync" data-mode="full" ${!configured || running ? raw('disabled') : ''}>Re-import</button></div>
          </div>
          <div class="st-row">
            <div class="st-row-text"><div class="st-row-title">Import from Spotify</div>
              <p class="st-row-desc">Adds your last 50 Spotify plays, your top artists and your liked songs. Useful right after setting up the app.</p></div>
            <div class="st-row-control"><button type="button" class="btn btn-secondary" data-st="spotify-import" ${spRunning ? raw('disabled') : ''}>${spRunning ? 'Importing…' : 'Import'}</button></div>
          </div>
          ${spRunning ? progressBlock(spi, 'spotify') : ''}
        </div>
      </details>`;
  }

  // ------------------------------------------------------------------ storage card
  function storageBody() {
    if (!health) return loadingState('Loading…', { compact: true });
    const h = health;
    const files = Array.isArray(h.backup_files) ? h.backup_files : (h.backups || []).map((name) => ({ name }));
    const formatOk = h.schema_version != null && h.schema_version === (h.schema_version_expected ?? h.schema_version);
    return html`
      <div class="st-card-head"><div><h3 class="st-card-title">Storage</h3>
        <p class="st-row-desc">Everything is stored on this computer, in the app's folder.</p></div></div>
      <dl class="st-kv">
        <div><dt>Database size ${infoTip('The local database: your play history, backlog records and cached artist info.', { label: 'Database size' })}</dt><dd>${fmtBytes(h.db_size_bytes)}</dd></div>
        <div class="st-kv-wide"><dt>Play history ${infoTip('Your plays are organised into one fast table that the reports read. It is rebuilt automatically when the rules for counting plays change.', { label: 'Play history' })}</dt>
          <dd>${h.plays_rebuilding ? 'Rebuilding now…' : h.plays_built_at ? html`Built ${relTime(h.plays_built_at)}${h.plays_build_ms ? ` in ${fmt.num(h.plays_build_ms / 1000, { digits: 1 })} s` : ''}` : 'Not built yet'}</dd></div>
        <div><dt>Data format</dt><dd class="st-kv-flex">Version ${h.schema_version ?? '—'} ${formatOk ? statusChip('good', 'Current') : statusChip('warning', `Expected ${h.schema_version_expected}`)}</dd></div>
      </dl>
      <div class="st-backups">
        <div class="st-row-title">Backups ${infoTip('Copies of the database made automatically before the app upgrades how it stores data. Keep them until you are sure everything looks right.', { label: 'Backups' })}</div>
        ${files.length ? html`<ul class="st-backup-list" role="list">${files.map((f) => html`<li>
          <span class="st-backup-icon" aria-hidden="true">${icon('disc')}</span>
          <span class="st-backup-name truncate">${f.name}</span>
          <span class="st-backup-meta">${f.modified_ms ? fmt.date(f.modified_ms, { year: 'always' }) : ''}${f.size_bytes ? ` · ${fmtBytes(f.size_bytes)}` : ''}</span></li>`)}</ul>`
          : html`<p class="st-row-desc">No backups yet. One is made automatically before each data upgrade.</p>`}
      </div>`;
  }

  // ------------------------------------------------------------------ render
  function renderHistory() { const c = el?.querySelector('[data-part="history"]'); if (c) mount(c, historyBody()); }
  function renderStorage() { const c = el?.querySelector('[data-part="storage"]'); if (c) mount(c, storageBody()); }
  function renderSync() {
    const c = el?.querySelector('[data-part="sync"]');
    if (!c) return;
    const details = c.querySelector('[data-part="more-imports"]');
    const wasOpen = details ? details.open : null;
    const active = document.activeElement;
    const focusKey = c.contains(active) && active.dataset?.st ? `${active.dataset.st}:${active.dataset.mode || ''}` : null;
    mount(c, syncBody());
    const d2 = c.querySelector('[data-part="more-imports"]');
    if (d2 && wasOpen != null && !(spi?.running)) d2.open = wasOpen || d2.open;
    if (focusKey) {
      const [st, mode] = focusKey.split(':');
      const b = c.querySelector(`[data-st="${st}"]${mode ? `[data-mode="${mode}"]` : ''}`);
      (b && !b.disabled ? b : c.querySelector('.st-progress') || c).focus?.({ preventScroll: true });
    }
    // The history card's "Sync now" mirrors the running state too.
    el?.querySelectorAll('[data-part="history"] [data-st="sync"]').forEach((b) => { b.disabled = !!lfm?.running; });
  }

  // ------------------------------------------------------------------ actions
  async function startSync(btn, mode) {
    if (mode === 'full') {
      const ok = await confirmDialog({
        title: 'Re-import everything from Last.fm?',
        body: 'This reads your whole Last.fm account again, page by page, and adds anything missing. Nothing is deleted and plays you already have are skipped. It can take several minutes; you can keep using the app.',
        confirmLabel: 'Start re-import',
      });
      if (!ok) return;
    }
    await withBusy(btn, async () => {
      try {
        lfm = await api.post('/api/lastfm/import', { mode }, { timeoutMs: 15000 });
        lfm.running = true;
        toast(`${(MODE_COPY[mode] || MODE_COPY.sync).verb}…`, { kind: 'info', icon: 'refresh', key: 'st-lfm-sync', detail: 'You can keep using the app. Progress shows here.' });
      } catch (err) {
        if (isAbort(err)) return;
        if (err.status === 409) { lfm = err.data?.error?.status || lfm; toast('A Last.fm import is already running.', { kind: 'info' }); }
        else toast(err.message || "Couldn't start the sync.", { kind: 'error' });
      }
    });
    renderSync();
    schedulePoll();
  }

  async function startSpotifyImport(btn) {
    await withBusy(btn, async () => {
      try {
        spi = await api.post('/api/spotify/import', { seed_artist_likes: false }, { timeoutMs: 15000 });
        spi.running = true;
        toast('Importing from Spotify…', { kind: 'info', icon: 'refresh', key: 'st-sp-import' });
      } catch (err) {
        if (isAbort(err)) return;
        if (err.status === 409) toast('A Spotify import is already running.', { kind: 'info' });
        else toast(err.message || "Couldn't start the Spotify import.", { kind: err.isRateLimited ? 'warning' : 'error' });
      }
    });
    renderSync();
    schedulePoll();
  }

  // Timeline tooltips (hover + keyboard focus), via the shared chart tooltip.
  function tipFor(bar) {
    const l = lanes().find((x) => x.source === bar.dataset.src);
    if (!l) return;
    chartTip(bar.closest('.st-tl'), {
      value: fmt.plural(l.plays, 'play'),
      label: `${l.label} · ${fmt.date(l.first_ts, { year: 'always' })} – ${fmt.date(l.last_ts, { year: 'always' })}`,
      note: l.desc,
      color: getComputedStyle(bar).backgroundColor,
    }, { rect: bar.getBoundingClientRect() });
  }

  // ------------------------------------------------------------------ section API
  return {
    id: 'history',
    label: 'History & data',
    icon: 'calendar',
    title: 'History & data',
    desc: 'What your listening history contains, keeping it in sync with Last.fm, and where it is stored.',
    mount(root) {
      el = root;
      mount(el, html`
        <div class="card st-card" data-part="history">${historyBody()}</div>
        <div class="card st-card" data-part="sync">${syncBody()}</div>
        <div class="card st-card" data-part="storage">${storageBody()}</div>`);
      loadHealth();
      loadImports().catch(reportError);
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-st]') : null;
        if (!t || t.disabled) return;
        if (t.dataset.st === 'sync') startSync(t, t.dataset.mode || 'sync').catch(reportError);
        else if (t.dataset.st === 'spotify-import') startSpotifyImport(t).catch(reportError);
      });
      const over = (ev) => { const b = ev.target instanceof Element ? ev.target.closest('.st-tl-bar') : null; if (b) tipFor(b); };
      const out = (ev) => { const b = ev.target instanceof Element ? ev.target.closest('.st-tl-bar') : null; if (b) chartUntip(b.closest('.st-tl')); };
      el.addEventListener('pointerover', over);
      el.addEventListener('pointerout', out);
      el.addEventListener('focusin', over);
      el.addEventListener('focusout', out);
      // Visibility: poll faster again when the tab comes back.
      const onVis = () => { if (!document.hidden && (lfm?.running || spi?.running)) loadImports().catch(reportError); };
      document.addEventListener('visibilitychange', onVis);
      offs.push(() => document.removeEventListener('visibilitychange', onVis));
    },
    onStatus(s, changed) {
      // A live play moves "newest play"; refresh the numbers at most once a minute, quietly.
      if (!el || !health || !changed?.has('today')) return;
      const now = Date.now();
      if (now - (this._lastQuiet || 0) < 60000) return;
      this._lastQuiet = now;
      loadHealth({ quiet: true });
    },
    destroy() {
      destroyed = true;
      clearTimeout(pollTimer);
      offs.forEach((f) => f());
      el = null;
    },
  };
}

export default { createDataSection };

// Settings → Spotify connection: what the app's Spotify guard is doing right now in plain words
// (status.spotify_status), an early way out of a local cool-down, and developer diagnostics
// (recent Spotify requests and app errors) behind a disclosure.
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import { html, mount, icon, fmt, toast, confirmDialog, loadingState, errorState, withBusy, reportError } from '../core/ui.js';
import { notice, statusChip, relTime, clockTime, fullDate } from './settings-ui.js';

const COPY = {
  ok: { tone: 'good', icon: 'checkCircle', title: 'Spotify is connected and answering', body: 'Requests are spread out to stay well under Spotify’s limits. Nothing is paused.' },
  pacing: { tone: 'warning', icon: 'gauge', title: 'Pacing Spotify requests', body: 'Some lookups are waiting their turn so the app stays under Spotify’s limits. Playback and auto-clear keep working.' },
  protect: { tone: 'warning', icon: 'gauge', title: 'Only essential requests for now', body: 'Spotify rate-limited the app recently, so only playback, auto-clear and likes go through until it is safe.' },
  rate_limited: { tone: 'critical', icon: 'alertCircle', title: 'Spotify asked the app to pause', body: 'Nothing reaches Spotify until the pause ends. It recovers on its own and nothing is lost.' },
  app_not_registered: { tone: 'critical', icon: 'alert', title: 'Spotify rejected this app', body: 'Your account must be added under User Management in your Spotify developer app. Then sign in again.' },
  signed_out: { tone: 'warning', icon: 'link', title: 'Spotify is not connected', body: 'Sign in with Spotify so the app can see what you play and clear your backlog.' },
  unknown: { tone: 'muted', icon: 'clock', title: 'Checking Spotify…', body: 'Waiting for the first status update.' },
};
const OK_WORKING = ['Now playing and playback controls', 'Auto-clear from your backlog', 'Search and artist pages', 'Insights and your listening history'];
const COOLDOWN_STATES = new Set(['pacing', 'protect', 'rate_limited']);

function outcomeOf(o) {
  const v = String(o || '');
  if (['ok', 'cached', 'stale', 'hydrated'].includes(v)) return { tone: 'good', label: { ok: 'OK', cached: 'From cache', stale: 'Older cache', hydrated: 'Restored' }[v] };
  if (/429/.test(v)) return { tone: 'critical', label: 'Rate limited' };
  if (/403/.test(v)) return { tone: 'critical', label: 'Refused' };
  if (/blocked|skipped|inflight/.test(v)) return { tone: 'warning', label: 'Held back' };
  if (/error|http/.test(v)) return { tone: 'critical', label: 'Failed' };
  return { tone: 'muted', label: v || 'Unknown' };
}

const human = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
// Why the guard is holding back, in plain words (unknown reasons fall back to the raw code, humanised).
const reasonText = (r) => REASONS[r] || (/429|rate/i.test(String(r)) ? 'Spotify answered “too many requests”.' : human(r));
const REASONS = {
  search_backoff: 'Spotify search was rate limited, so searches wait a little.',
  local_budget: 'The app’s own per-minute request limit is reached.',
  app_registration: 'Spotify says this account isn’t allowed to use the app.',
};

export function createConnectionSection(env) {
  let el = null;
  let sig = '';
  let tick = null;
  let diag = null;        // {calls, errors, at}
  let diagErr = null;
  let diagLoading = false;
  let showAllCalls = false;

  const ssOf = (s) => (s?.spotify_status && s.spotify_status.state ? s.spotify_status : { state: s ? (s.auth_ready === false ? 'signed_out' : 'ok') : 'unknown' });

  function untilLine(ss) {
    const until = Number(ss.until_ms);
    if (!Number.isFinite(until) || until <= Date.now()) return '';
    const rem = until - Date.now();
    const left = rem >= 60000 ? fmt.duration(Math.ceil(rem / 60000) * 60000) : fmt.duration(rem);
    return html`<p class="st-conn-until">${icon('clock')}<span>Back to normal around <strong>${clockTime(until)}</strong> <span class="muted">(in <span data-part="left">${left}</span>)</span></span></p>`;
  }

  function statusCard(s) {
    const ss = ssOf(s);
    const c = COPY[ss.state] || COPY.ok;
    const serverLists = ss.state !== 'ok';
    const paused = serverLists && Array.isArray(ss.paused) ? ss.paused : [];
    const working = serverLists && Array.isArray(ss.working) && ss.working.length ? ss.working : (ss.state === 'ok' ? OK_WORKING : []);
    // The server's rate-limit line only repeats the title with a time the countdown shows better.
    const message = ss.state !== 'ok' && ss.state !== 'rate_limited' && ss.message && ss.message !== 'Spotify OK' ? ss.message : c.body;
    const canClear = COOLDOWN_STATES.has(ss.state) || !!ss.restored;
    return html`
      <div class="st-conn" data-tone="${c.tone}">
        <span class="st-conn-icon" aria-hidden="true">${icon(c.icon)}</span>
        <div class="st-conn-main">
          <h3 class="st-conn-title">${c.title}</h3>
          <p class="st-row-desc">${message}</p>
          ${untilLine(ss)}
          ${ss.reason && ss.state !== 'ok' ? html`<p class="st-conn-reason">Why: ${reasonText(ss.reason)}</p>` : ''}
        </div>
        ${ss.state === 'signed_out' ? html`<a class="btn btn-primary" href="/login">${icon('link')}Connect Spotify</a>` : ''}
      </div>
      ${ss.restored ? notice({ tone: 'info', compact: true, title: 'Re-checking a pause from last time', body: `Spotify asked the app to pause before it last closed. The app is checking whether that pause is over${ss.restored.until_ms ? ` (at the latest ${clockTime(ss.restored.until_ms)})` : ''}.` }) : ''}
      ${paused.length || working.length ? html`<div class="st-conn-lists">
        ${paused.length ? html`<div><h4 class="st-list-title">Paused</h4><ul class="st-check-list" data-tone="warning" role="list">${paused.map((p) => html`<li>${icon('pauseCircle')}<span>${p}</span></li>`)}</ul></div>` : ''}
        ${working.length ? html`<div><h4 class="st-list-title">${ss.state === 'ok' ? 'Working' : 'Still works'}</h4><ul class="st-check-list" data-tone="good" role="list">${working.map((w) => html`<li>${icon('check')}<span>${w}</span></li>`)}</ul></div>` : ''}
      </div>` : ''}
      ${canClear ? html`<div class="st-row st-conn-clear">
        <div class="st-row-text"><div class="st-row-title">End the pause early</div>
          <p class="st-row-desc">The app pauses itself when Spotify says “too many requests”. If you are sure Spotify is fine again, you can clear this pause. If Spotify is still limiting the app, it may block it for longer.</p></div>
        <div class="st-row-control"><button type="button" class="btn btn-secondary" data-st="clear-guard">${icon('refresh')}Clear local cooldown</button></div>
      </div>` : ''}`;
  }

  // ------------------------------------------------------------------ diagnostics
  function callsTable(calls) {
    const shown = showAllCalls ? calls : calls.slice(0, 25);
    const counts = calls.reduce((acc, c) => { const t = outcomeOf(c.outcome).tone; acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    const oldest = calls.length ? calls[calls.length - 1].ts_ms : null;
    return html`
      <div class="st-diag-head">
        <h4 class="st-list-title">Recent Spotify requests</h4>
        <p class="st-row-desc">${calls.length ? html`Last ${fmt.plural(calls.length, 'request')}${oldest ? html` since ${clockTime(oldest)}` : ''}:` : 'No requests recorded since the app started.'}
          ${counts.good ? statusChip('good', `${fmt.num(counts.good)} OK`) : ''}
          ${counts.warning ? statusChip('warning', `${fmt.num(counts.warning)} held back`) : ''}
          ${counts.critical ? statusChip('critical', `${fmt.num(counts.critical)} failed`) : ''}</p>
      </div>
      ${calls.length ? html`<div class="table-wrap st-diag-table"><table class="table">
        <thead><tr><th scope="col">Time</th><th scope="col">Request</th><th scope="col">Kind</th><th scope="col">Result</th><th scope="col" class="num">Took</th></tr></thead>
        <tbody>${shown.map((c) => {
          const o = outcomeOf(c.outcome);
          return html`<tr>
            <td class="num">${c.ts_ms ? new Date(c.ts_ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—'}</td>
            <td class="strong">${human(c.method)}${c.detail ? html`<div class="st-diag-detail">${String(c.detail)}</div>` : ''}</td>
            <td>${human(c.category)}</td>
            <td>${statusChip(o.tone, o.label)}</td>
            <td class="num">${c.elapsed_ms != null ? `${fmt.num(c.elapsed_ms)} ms` : '—'}</td></tr>`;
        })}</tbody></table></div>
        ${calls.length > 25 ? html`<button type="button" class="btn btn-ghost btn-sm" data-st="more-calls">${showAllCalls ? 'Show fewer' : `Show all ${fmt.num(calls.length)}`}</button>` : ''}` : ''}`;
  }

  function errorsList(errors) {
    return html`<div class="st-diag-head"><h4 class="st-list-title">Recent app errors</h4>
      <p class="st-row-desc">${errors.length ? `${fmt.plural(errors.length, 'error')} recorded since the app started, newest first.` : 'No errors recorded since the app started.'}</p></div>
      ${errors.length ? html`<ul class="st-err-list" role="list">${errors.slice(0, 30).map((e) => html`<li>
        <details class="st-err">
          <summary><span class="st-err-when">${e.ts ? relTime(e.ts) : ''}</span><span class="st-err-type">${e.type || 'Error'}</span>
            <span class="st-err-msg">${e.message || ''}</span>${icon('chevronDown')}</summary>
          <div class="st-err-body">
            ${e.context ? html`<p><strong>Where:</strong> ${e.context}</p>` : ''}
            ${e.ts ? html`<p><strong>When:</strong> ${fullDate(e.ts)}</p>` : ''}
            ${e.traceback ? html`<pre class="st-pre">${e.traceback}</pre>` : ''}
          </div>
        </details></li>`)}</ul>` : ''}`;
  }

  function diagBody() {
    if (diagLoading && !diag) return loadingState('Loading diagnostics…', { compact: true });
    if (diagErr && !diag) return errorState(diagErr, { compact: true, retry: () => loadDiag() });
    if (!diag) return '';
    return html`
      <div class="st-diag-actions">
        <span class="muted small">Updated ${relTime(diag.at)}</span>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-st="copy-diag">${icon('copy')}Copy as text</button>
        <button type="button" class="btn btn-secondary btn-sm" data-st="refresh-diag">${icon('refresh')}Refresh</button>
      </div>
      <div class="st-diag-block">${callsTable(diag.calls)}</div>
      <div class="st-diag-block">${errorsList(diag.errors)}</div>`;
  }

  async function loadDiag() {
    diagLoading = true;
    diagErr = null;
    const box = el?.querySelector('[data-part="diag"]');
    if (box && diag) box.classList.add('is-refetching');
    else if (box) mount(box, diagBody());
    try {
      const [c, e] = await Promise.all([
        api.get('/api/dev/spotify-calls', { timeoutMs: 10000 }),
        api.get('/api/dev/errors', { timeoutMs: 10000 }),
      ]);
      diag = { calls: Array.isArray(c?.calls) ? c.calls : [], errors: Array.isArray(e?.errors) ? e.errors : [], at: Date.now() };
    } catch (err) {
      if (!isAbort(err)) diagErr = err;
    } finally {
      diagLoading = false;
    }
    const b2 = el?.querySelector('[data-part="diag"]');
    if (b2) { b2.classList.remove('is-refetching'); mount(b2, diagBody()); }
  }

  async function copyDiag() {
    if (!diag) return;
    const ss = ssOf(store.status);
    const lines = [`Discover Cleaner diagnostics · ${new Date().toISOString()}`, `Spotify status: ${ss.state}${ss.reason ? ` (${ss.reason})` : ''}${ss.message ? ` · ${ss.message}` : ''}`, '', 'Recent Spotify requests:'];
    diag.calls.forEach((c) => lines.push(`${c.ts_ms ? new Date(c.ts_ms).toISOString() : '-'}  ${c.method}  ${c.category || ''}  ${c.outcome}${c.detail ? ` (${c.detail})` : ''}  ${c.elapsed_ms ?? '-'} ms`));
    lines.push('', 'Recent app errors:');
    diag.errors.forEach((e) => lines.push(`${e.ts ? new Date(e.ts).toISOString() : '-'}  ${e.type}  ${e.context || ''}  ${e.message || ''}`));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('Diagnostics copied', { kind: 'success', icon: 'check', timeoutMs: 2500, key: 'st-copy' });
    } catch {
      toast("Couldn't copy to the clipboard in this browser.", { kind: 'warning', key: 'st-copy' });
    }
  }

  async function clearGuard(btn) {
    const ss = ssOf(store.status);
    if (ss.state === 'rate_limited' || ss.state === 'protect') {
      const ok = await confirmDialog({
        title: 'Clear the Spotify pause?',
        body: 'Only do this if you are sure Spotify is answering again. If it is still limiting the app, Spotify may block it for longer.',
        confirmLabel: 'Clear the pause',
        danger: true,
      });
      if (!ok) return;
    }
    await withBusy(btn, async () => {
      try {
        await api.post('/api/dev/clear-guard', {});
        toast('Cleared the local cooldown', { kind: 'success', detail: 'Requests to Spotify resume now.' });
        await store.refresh();
      } catch (err) {
        if (!isAbort(err)) toast(err.message || "Couldn't clear the cooldown.", { kind: 'error' });
      }
    });
  }

  // ------------------------------------------------------------------ render + ticking
  const sigOf = (s) => { const ss = ssOf(s); return JSON.stringify([ss.state, ss.until_ms, ss.reason, ss.message, ss.paused, ss.working, !!ss.restored]); };

  function renderStatus() {
    const box = el?.querySelector('[data-part="status"]');
    if (!box) return;
    const s = store.status;
    sig = sigOf(s);
    const refocus = box.contains(document.activeElement) ? document.activeElement.dataset.st : null;
    mount(box, statusCard(s));
    if (refocus) box.querySelector(`[data-st="${refocus}"]`)?.focus({ preventScroll: true });
    scheduleTick();
  }

  function scheduleTick() {
    clearTimeout(tick);
    const until = Number(ssOf(store.status).until_ms);
    if (!Number.isFinite(until) || until <= Date.now()) return;
    const rem = until - Date.now();
    tick = setTimeout(() => {
      const left = el?.querySelector('[data-part="left"]');
      const r = until - Date.now();
      if (r <= 0) { store.refresh(); return; }
      if (left) left.textContent = r >= 60000 ? fmt.duration(Math.ceil(r / 60000) * 60000) : fmt.duration(r);
      scheduleTick();
    }, rem > 120000 ? 15000 : 1000);
  }

  return {
    id: 'connection',
    label: 'Spotify connection',
    icon: 'gauge',
    title: 'Spotify connection',
    desc: 'How the app is getting along with Spotify right now, and what that means for you.',
    mount(root) {
      el = root;
      mount(el, html`
        <div class="card st-card" data-part="status">${loadingState('Checking Spotify…', { compact: true })}</div>
        <details class="card st-card st-disclosure st-disclosure-card" data-part="diag-details">
          <summary><span class="st-disclosure-title">Diagnostics</span><span class="st-disclosure-hint">Recent Spotify requests and app errors, for troubleshooting</span>${icon('chevronDown')}</summary>
          <div class="st-disclosure-body" data-part="diag"></div>
        </details>`);
      if (store.status) renderStatus();
      el.querySelector('[data-part="diag-details"]').addEventListener('toggle', (ev) => {
        if (ev.target.open && !diag && !diagLoading) loadDiag();
      });
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-st]') : null;
        if (!t || t.disabled) return;
        const a = t.dataset.st;
        if (a === 'clear-guard') clearGuard(t).catch(reportError);
        else if (a === 'refresh-diag') loadDiag();
        else if (a === 'copy-diag') copyDiag();
        else if (a === 'more-calls') { showAllCalls = !showAllCalls; const b = el.querySelector('[data-part="diag"]'); mount(b, diagBody()); b.querySelector('[data-st="more-calls"]')?.focus(); }
      });
    },
    /** Open the diagnostics disclosure (deep link #/settings?section=diagnostics). */
    openDiagnostics() {
      const d = el?.querySelector('[data-part="diag-details"]');
      if (d && !d.open) d.open = true;
    },
    onStatus(s) {
      if (!el) return;
      if (sigOf(s) !== sig) renderStatus();
    },
    destroy() {
      clearTimeout(tick);
      el = null;
    },
  };
}

export default { createConnectionSection };

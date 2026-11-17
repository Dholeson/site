// Spotify connection pill in the top bar, driven by status.spotify_status
// {state, until_ms, reason, message, paused:[], working:[]} with a fallback to the legacy
// spotify_guard_* / spotify_search_backoff_* / auth_ready fields. Clicking it opens a popover that
// explains what is paused and what still works. signed_out renders a "Connect Spotify" link.
import store from '../core/store.js';
import { html, mount, icon, fmt, popover } from '../core/ui.js';

const COPY = {
  ok: {
    icon: 'checkCircle', long: 'Spotify connected', short: 'Connected', title: 'Spotify is connected',
    body: 'Requests are spread out to stay well under Spotify’s limits.',
    paused: [], working: ['Now playing and playback controls', 'Auto-clear from your backlog', 'Search and artist pages'],
  },
  pacing: {
    icon: 'gauge', long: 'Pacing requests', short: 'Pacing', title: 'Pacing Spotify requests',
    body: 'Spotify asked for fewer requests, so searches and artist lookups wait their turn.',
    paused: ['Search and artist details may be slower'], working: ['Now playing and playback controls', 'Auto-clear from your backlog', 'Insights and your listening history'],
  },
  protect: {
    icon: 'gauge', long: 'Essentials only', short: 'Essentials', title: 'Only essential Spotify requests',
    body: 'Spotify rate-limited this app recently, so only what keeps playback and clearing working goes through until it is safe.',
    paused: ['Spotify search', 'Artist details and discography from Spotify'], working: ['Now playing and playback controls', 'Auto-clear from your backlog', 'Insights and your listening history'],
  },
  rate_limited: {
    icon: 'alertCircle', long: 'Rate limited', short: 'Limited', title: 'Spotify is rate limiting this app',
    body: 'Spotify temporarily stopped answering this app. It recovers on its own and nothing is lost: plays are counted again as soon as it is back.',
    paused: ['Now playing and playback controls', 'Clearing tracks from your backlog', 'Spotify search and artist details'], working: ['Insights and your listening history', 'Last.fm artist info', 'Settings'],
  },
  app_not_registered: {
    icon: 'alert', long: 'Spotify app blocked', short: 'Blocked', title: 'Spotify rejected this app',
    body: 'Spotify refused this app’s requests. Check the app in the Spotify developer dashboard (your account must be added as a user).',
    paused: ['Everything that talks to Spotify'], working: ['Insights and your listening history', 'Last.fm artist info'],
  },
  signed_out: {
    icon: 'link', long: 'Connect Spotify', short: 'Connect', title: 'Spotify is not connected',
    body: 'Sign in with Spotify so the app can see what is playing.', paused: [], working: [],
  },
  unknown: {
    icon: 'clock', long: 'Checking Spotify…', short: 'Checking', title: 'Checking Spotify',
    body: 'Waiting for the first status update.', paused: [], working: [],
  },
};

let el = null;
let cur = null;
let pop = null;
let timer = null;

function legacy(s) {
  if (s.spotify_app_registration_block_remaining_s > 0) {
    return { state: 'app_not_registered', until_ms: s.spotify_app_registration_block_until_ms, message: s.spotify_app_registration_block_message };
  }
  if (s.spotify_guard_backoff_remaining_s > 0) {
    return { state: 'rate_limited', until_ms: s.spotify_guard_backoff_until_ms || (Date.now() + s.spotify_guard_backoff_remaining_s * 1000), reason: s.spotify_guard_reason };
  }
  if (s.spotify_guard_protect_remaining_s > 0) {
    return { state: 'protect', until_ms: s.spotify_guard_protect_until_ms || (Date.now() + s.spotify_guard_protect_remaining_s * 1000), reason: s.spotify_guard_protect_reason };
  }
  if (s.spotify_search_backoff_remaining_s > 0) {
    return { state: 'pacing', until_ms: s.spotify_search_backoff_until_ms || (Date.now() + s.spotify_search_backoff_remaining_s * 1000) };
  }
  if (s.auth_ready === false && !s.current_track) return { state: 'signed_out' };
  return { state: 'ok' };
}

function compute(s) {
  if (!s) return { state: 'unknown' };
  const ss = s.spotify_status;
  if (ss && typeof ss === 'object' && ss.state) return ss;
  return legacy(s);
}

function remainingMs(ss) {
  const until = Number(ss.until_ms);
  return Number.isFinite(until) && until > 0 ? Math.max(0, until - Date.now()) : 0;
}

function countdown(ms) {
  return ms >= 60000 ? fmt.duration(Math.ceil(ms / 60000) * 60000) : fmt.duration(ms);
}

function labelFor(ss) {
  const c = COPY[ss.state] || COPY.ok;
  const rem = remainingMs(ss);
  if (ss.state === 'rate_limited' && rem > 0) return { long: `Rate limited · ${countdown(rem)}`, short: countdown(rem) };
  return { long: c.long, short: c.short };
}

function render() {
  if (!el) return;
  const ss = cur || { state: 'unknown' };
  const c = COPY[ss.state] || COPY.ok;
  const { long, short } = labelFor(ss);
  if (ss.state === 'signed_out') {
    if (pop) { pop.close(); pop = null; }
    mount(el, html`<a class="status-pill" data-state="signed_out" href="/login">${icon(c.icon)}<span class="long">${long}</span><span class="short">${short}</span></a>`);
    return;
  }
  const existing = el.querySelector('button.status-pill');
  if (existing && existing.dataset.state === ss.state) {
    // Update in place so focus and an open popover survive.
    existing.querySelector('.long').textContent = long;
    existing.querySelector('.short').textContent = short;
    existing.setAttribute('aria-label', `${long}. Show Spotify connection details`);
    return;
  }
  if (pop) { pop.close(); pop = null; }
  mount(el, html`<button type="button" class="status-pill" data-state="${ss.state}" aria-haspopup="dialog" aria-expanded="false" aria-label="${`${long}. Show Spotify connection details`}">${icon(c.icon)}<span class="long">${long}</span><span class="short">${short}</span></button>`);
}

function popContent() {
  const ss = cur || { state: 'unknown' };
  const c = COPY[ss.state] || COPY.ok;
  // When all is well our own wording is clearer than the server's terse "Everything" list; for the
  // degraded states the server's lists are authoritative (it knows exactly what is paused).
  const serverLists = ss.state !== 'ok';
  const paused = serverLists && Array.isArray(ss.paused) && ss.paused.length ? ss.paused : c.paused;
  const working = serverLists && Array.isArray(ss.working) && ss.working.length ? ss.working : c.working;
  const message = ss.state !== 'ok' && ss.message ? ss.message : c.body;
  const rem = remainingMs(ss);
  const until = rem > 0 ? new Date(Date.now() + rem) : null;
  return html`<div class="status-pop">
    <h2>${icon(c.icon)}${c.title}</h2>
    <p>${message}</p>
    ${until ? html`<p>Back to normal around <strong>${until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong> (in ${countdown(rem)}).</p>` : ''}
    ${ss.reason && ss.state !== 'ok' ? html`<p class="muted small">Reason: ${ss.reason}</p>` : ''}
    ${paused.length ? html`<h3>Paused</h3><ul class="paused">${paused.map((p) => html`<li>${icon('pauseCircle')}<span>${p}</span></li>`)}</ul>` : ''}
    ${working.length ? html`<h3>${ss.state === 'ok' ? 'Working' : 'Still works'}</h3><ul class="working">${working.map((w) => html`<li>${icon('check')}<span>${w}</span></li>`)}</ul>` : ''}
  </div>`;
}

function schedule() {
  clearTimeout(timer);
  if (!cur) return;
  const rem = remainingMs(cur);
  if (rem <= 0) return;
  // Minute precision is enough for long waits; count seconds in the last two minutes.
  const every = rem > 120000 ? 15000 : 1000;
  timer = setTimeout(() => {
    render();
    if (pop) mount(pop.el, popContent());
    schedule();
  }, every);
}

export function initStatusPill(root) {
  el = root;
  if (!el) return;
  el.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('button.status-pill') : null;
    if (!b) return;
    pop = popover(b, popContent(), { placement: 'bottom-end', className: 'status-pop-wrap', label: 'Spotify connection', onClose: () => { pop = null; } });
  });
  const update = (s) => {
    const next = compute(s);
    const changed = JSON.stringify(next) !== JSON.stringify(cur);
    cur = next;
    if (changed) {
      render();
      if (pop) mount(pop.el, popContent());
    }
    schedule();
  };
  store.on('status', (s) => update(s));
  update(store.status);
}

export default { initStatusPill };

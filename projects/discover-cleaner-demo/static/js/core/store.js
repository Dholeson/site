// Status store: polls /api/status (APP_CONFIG.pollIntervalMs while the tab is visible, 15 s while
// hidden), tells the server whether the tab is visible/focused, and emits only when something changed.
//
//   const off = store.on('status', (status, { changed, prev }) => { if (changed.has('current_track')) … });
//   store.status            // latest payload (or null before the first poll)
//   store.refresh()         // poll now (coalesces with an in-flight poll); resolves to the status
//   store.patch({is_playing: false})   // optimistic local update, emitted like a poll result
//   store.on('connection', ({ ok, error }) => …)   // server reachable / unreachable transitions
//   store.sinceObserved()   // ms since progress_ms / current_listened / clears_in_s were true
//                           // (the server's last_poll time), for interpolating while playing
//
// changed = Set of top-level keys whose JSON differs from the previous emit.
import { api, isAbort } from './api.js';

const HIDDEN_INTERVAL_MS = 15000;
const MIN_INTERVAL_MS = 1000;
const STATUS_TIMEOUT_MS = 10000;

const listeners = new Map();
let status = null;
let serialized = {};
let inFlight = null;
let again = false;
let timer = null;
let started = false;
let failures = 0;
let connected = true;
let observedAt = 0;         // client ms when the current status was observed server-side (best estimate)
let clientStateSig = '';

function intervalMs() {
  const cfg = window.APP_CONFIG || {};
  const base = Math.max(MIN_INTERVAL_MS, Number(cfg.pollIntervalMs) || 3000);
  if (document.hidden) return HIDDEN_INTERVAL_MS;
  // Back off gently while the server is unreachable (3 s, 6 s, 12 s … max 30 s).
  return failures ? Math.min(30000, base * 2 ** Math.min(failures - 1, 4)) : base;
}

function emit(evt, ...args) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(...args); } catch (err) {
      (window.__errors ||= []).push({ message: String(err?.message || err), stack: err?.stack || '', ts: Date.now(), source: `store:${evt}` });
      if (document.body) document.body.dataset.jsErrors = String(window.__errors.length);
      console.error(err);
    }
  }
}

// The server stamps last_poll as local "HH:MM:SS" when it last read Spotify. progress_ms and
// current_listened are as of that moment, so interpolation should start there, not at receipt.
function pollTimeFrom(payload, receivedAt) {
  const lp = payload && payload.last_poll;
  if (typeof lp === 'string') {
    const m = lp.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m) {
      const d = new Date(receivedAt);
      d.setHours(+m[1], +m[2], +m[3], 500);
      let t = d.getTime();
      if (t - receivedAt > 12 * 3600e3) t -= 86400e3;       // just after midnight
      if (receivedAt - t > 12 * 3600e3) t += 86400e3;
      if (t <= receivedAt + 1000 && receivedAt - t <= 15000) return Math.min(t, receivedAt);
    }
  }
  return receivedAt;
}

function apply(payload, { receivedAt = Date.now(), local = false } = {}) {
  if (!payload || typeof payload !== 'object') return;
  const next = local ? { ...(status || {}), ...payload } : payload;
  const nextSer = {};
  const changed = new Set();
  const keys = new Set([...Object.keys(next), ...Object.keys(serialized)]);
  for (const k of keys) {
    let s;
    try { s = JSON.stringify(next[k]); } catch { s = String(Math.random()); }
    nextSer[k] = s;
    if (s !== serialized[k]) changed.add(k);
  }
  if (!local) observedAt = pollTimeFrom(next, receivedAt);
  else if (changed.has('progress_ms') || changed.has('is_playing')) observedAt = receivedAt;
  if (!changed.size && status) return;
  const prev = status;
  status = next;
  serialized = nextSer;
  emit('status', status, { changed, prev, local });
}

function schedule(delay = intervalMs()) {
  clearTimeout(timer);
  if (!started) return;
  timer = setTimeout(() => { refresh().catch(() => {}); }, delay);
}

function setConnected(ok, error) {
  if (ok === connected) return;
  connected = ok;
  emit('connection', { ok, error });
}

async function poll() {
  const receivedAt0 = Date.now();
  try {
    const data = await api.get('/api/status', { timeoutMs: STATUS_TIMEOUT_MS });
    failures = 0;
    setConnected(true);
    apply(data, { receivedAt: Math.round((receivedAt0 + Date.now()) / 2) });
    return status;
  } catch (err) {
    if (isAbort(err)) return status;
    failures += 1;
    // A single blip is normal (server restart); report after two misses in a row.
    if (failures >= 2) setConnected(false, err);
    emit('error', err);
    return status;
  }
}

/** Poll now. If a poll is running, one more runs right after it (so fresh changes are seen). */
export function refresh() {
  if (inFlight) { again = true; return inFlight; }
  clearTimeout(timer);
  inFlight = (async () => {
    let result;
    do {
      again = false;
      result = await poll();
    } while (again);
    return result;
  })().finally(() => {
    inFlight = null;
    schedule();
  });
  return inFlight;
}

/** Ask for a refresh after `ms` (e.g. give Spotify a moment after a skip). */
export function refreshSoon(ms = 600) {
  setTimeout(() => { refresh().catch(() => {}); }, ms);
}

function publishClientState() {
  const payload = { visible: !document.hidden, focused: typeof document.hasFocus === 'function' ? document.hasFocus() : true };
  const sig = JSON.stringify(payload);
  if (sig === clientStateSig) return;
  clientStateSig = sig;
  api.post('/api/client-state', payload, { timeoutMs: 5000, keepalive: true }).catch(() => {
    clientStateSig = ''; // retry on the next change
  });
}

function onVisibility() {
  publishClientState();
  if (!document.hidden) refresh().catch(() => {});
  else schedule();
}

export function start() {
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', publishClientState);
  window.addEventListener('blur', publishClientState);
  window.addEventListener('online', () => refresh().catch(() => {}));
  publishClientState();
  refresh().catch(() => {});
}

export function stop() {
  started = false;
  clearTimeout(timer);
}

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt)?.delete(fn);
}

export const store = {
  get status() { return status; },
  get connected() { return connected; },
  /** Client-clock ms at which status.progress_ms / current_listened were true. */
  get observedAt() { return observedAt; },
  on,
  refresh,
  refreshSoon,
  start,
  stop,
  patch(partial) { apply(partial, { local: true }); },
  /** ms elapsed since the status snapshot was taken (for interpolation while playing). */
  sinceObserved() { return observedAt ? Math.max(0, Date.now() - observedAt) : 0; },
};
export default store;

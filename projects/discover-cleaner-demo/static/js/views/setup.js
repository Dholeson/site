// First-run setup (#/setup; main.js also shows it in place of Now until setup is done).
//
// Steps:
//   connect   no Spotify app yet: what you need, how to create the app (with the exact Redirect
//             URI to copy), the Client ID + Secret form (+ optional Last.fm), then Connect Spotify.
//   playlist  connected, but no backlog playlist chosen: pick one with the Settings picker.
// Data: GET/POST /api/v2/setup (POST writes .env), /login for the Spotify sign-in.
// In the offline demo (--demo) setup is switched off and this page says so.
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import { html, mount, icon, toast, pageHeader, notice, loadingState, errorState, reportError, withBusy } from '../core/ui.js';
import { openPlaylistPicker } from '../components/settings-backlog.js';

const HEX32 = /^[0-9a-fA-F]{32}$/;
const LASTFM_USER = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;
const SETUP_CONNECTING = 'dc.setup.connecting';   // read by main.js (keeps this flow up until sign-in)

let V = null;

function stepFor(info, params) {
  if (info.demo) return 'demo';
  if (info.needs_credentials) return 'connect';
  if (!info.signed_in) return 'connect';
  if (info.needs_playlist) return 'playlist';
  return params.step === 'playlist' ? 'playlist' : 'done';
}

// ------------------------------------------------------------------ markup
function needsCard() {
  return html`<section class="card su-card" aria-labelledby="su-need">
    <h2 class="su-h2" id="su-need">What you need</h2>
    <ul class="su-needs" role="list">
      <li>${icon('check')}<span><strong>Spotify Premium.</strong> Spotify only lets Premium accounts create the developer app this needs.</span></li>
      <li>${icon('check')}<span><strong>Five minutes, once.</strong> You create a free Spotify app for yourself; nothing is shared with anyone.</span></li>
      <li>${icon('plus')}<span><strong>Optional: Last.fm.</strong> With a free API key your whole scrobble history is imported for reports and artist pages.</span></li>
    </ul>
  </section>`;
}

function createAppCard(info) {
  return html`<section class="card su-card" aria-labelledby="su-step1">
    <h2 class="su-h2" id="su-step1"><span class="su-num" aria-hidden="true">1</span>Create your Spotify app</h2>
    <ol class="su-steps">
      <li>Open the <a class="link link-accent" href="${info.dashboard_url}" target="_blank" rel="noopener noreferrer">Spotify developer dashboard ${icon('external')}</a> and log in.</li>
      <li>Click <strong>Create app</strong>. Any name and description work, for example “Discover Cleaner”.</li>
      <li>Under <strong>Redirect URIs</strong>, add exactly this address and click <strong>Add</strong>:
        <div class="su-copy">
          <code class="su-uri" id="su-uri">${info.redirect_uri}</code>
          <button type="button" class="btn btn-secondary btn-sm" data-su="copy" aria-describedby="su-uri">${icon('copy')}<span>Copy</span></button>
        </div>
      </li>
      <li>Under <strong>Which API/SDKs are you planning to use?</strong> tick <strong>Web API</strong>, accept the terms and click <strong>Save</strong>.</li>
      <li>In the app’s <strong>Settings</strong>, copy the <strong>Client ID</strong>, then click <strong>View client secret</strong> and copy that too.</li>
    </ol>
  </section>`;
}

function field({ id, name, label, help, type = 'text', placeholder = '', value = '', autocomplete = 'off' }) {
  return html`<div class="field su-field">
    <label class="field-label" for="${id}">${label}</label>
    <input class="input su-input" id="${id}" name="${name}" type="${type}" value="${value}" placeholder="${placeholder}"
      autocomplete="${autocomplete}" autocapitalize="off" spellcheck="false" aria-describedby="${id}-help">
    <p class="field-help" id="${id}-help">${help}</p>
    <p class="su-error" id="${id}-err" hidden></p>
  </div>`;
}

function keysCard(info) {
  const idSet = info.client_id_set;
  return html`<section class="card su-card" aria-labelledby="su-step2">
    <h2 class="su-h2" id="su-step2"><span class="su-num" aria-hidden="true">2</span>Paste your app’s keys</h2>
    <form class="su-form" data-su="form" novalidate>
      <div class="su-grid">
        ${field({ id: 'su-client-id', name: 'client_id', label: 'Client ID', help: idSet ? `Saved (${info.client_id_hint || 'set'}). Paste a new one to replace it.` : '32 characters, from your app’s Settings.', placeholder: idSet ? 'Keep the saved Client ID' : 'e.g. 3f2a…' })}
        ${field({ id: 'su-client-secret', name: 'client_secret', label: 'Client Secret', type: 'password', autocomplete: 'new-password', help: info.client_secret_set ? 'Saved. Paste a new one to replace it.' : 'Also 32 characters. It stays on this computer, in the .env file.', placeholder: info.client_secret_set ? 'Keep the saved secret' : 'View client secret, then copy' })}
      </div>
      <details class="su-lastfm" ${info.lastfm_api_key_set || info.lastfm_username ? 'open' : ''}>
        <summary>Last.fm <span class="su-optional">optional</span></summary>
        <p class="su-note">Imports your full listening history and adds artist bios, tags and similar artists. Get a key at <a class="link link-accent" href="${info.lastfm_api_url}" target="_blank" rel="noopener noreferrer">last.fm/api ${icon('external')}</a> (any application name works).</p>
        <div class="su-grid">
          ${field({ id: 'su-lfm-key', name: 'lastfm_api_key', label: 'Last.fm API key', type: 'password', autocomplete: 'new-password', help: info.lastfm_api_key_set ? 'Saved. Paste a new one to replace it.' : '32 characters.', placeholder: info.lastfm_api_key_set ? 'Keep the saved key' : '' })}
          ${field({ id: 'su-lfm-user', name: 'lastfm_username', label: 'Last.fm username', help: 'Whose scrobbles to import.', value: info.lastfm_username || '' })}
        </div>
      </details>
      <div class="su-form-foot">
        <button type="submit" class="btn btn-primary" data-su="save">${icon('check')}Save</button>
        <p class="su-note" data-part="saved" role="status" aria-live="polite"></p>
      </div>
    </form>
  </section>`;
}

function connectCard(info, saved) {
  const ready = !info.needs_credentials;
  return html`<section class="card su-card" aria-labelledby="su-step3" data-ready="${ready ? 'true' : 'false'}">
    <h2 class="su-h2" id="su-step3"><span class="su-num" aria-hidden="true">3</span>Connect Spotify</h2>
    <p class="su-text">${ready
      ? html`${saved ? html`<strong>Saved.</strong> ` : ''}Spotify asks you to allow access for your app, then sends you right back here.`
      : 'Save your app’s keys first.'}</p>
    <div class="su-actions">
      ${ready
        ? html`<a class="btn btn-primary btn-lg" href="${info.login_url}" data-su="connect">${icon('link')}Connect Spotify</a>`
        : html`<button type="button" class="btn btn-primary btn-lg" disabled>${icon('link')}Connect Spotify</button>`}
    </div>
    <p class="su-fine">Spotify says “INVALID_CLIENT: Invalid redirect URI”? The Redirect URI in the dashboard must match the one in step 1 exactly.
      “Active premium subscription required for the owner of the app”? The account that created the Spotify app needs Premium.</p>
    <p class="su-fine">Sharing with friends? Each person runs their own copy. A Spotify app in Development Mode works for up to 5 people you add under <strong>User Management</strong> in the dashboard (Spotify’s rule), or they create their own app.</p>
  </section>`;
}

function connectStep(info) {
  return html`
    ${pageHeader({ eyebrow: 'Setup', title: 'Connect your Spotify', desc: 'Discover Cleaner runs on your computer and talks to Spotify through a Spotify app of your own. Set it up once; everything after that happens in the app.' })}
    <div class="su-layout">
      <div class="su-main">
        ${createAppCard(info)}
        ${keysCard(info)}
        <div data-part="connect">${connectCard(info, V.saved)}</div>
      </div>
      <aside class="su-side">
        ${needsCard()}
        <section class="card su-card su-card-quiet" aria-labelledby="su-demo">
          <h2 class="su-h2" id="su-demo">Just looking?</h2>
          <p class="su-text">The offline demo runs the whole app on the author’s listening history with a simulated Spotify. No account needed: stop the app and start it with <code>--demo</code>.</p>
        </section>
      </aside>
    </div>`;
}

function playlistStep() {
  const thr = Math.round(Number(store.status?.threshold_seconds) || 30);
  return html`
    ${pageHeader({ eyebrow: 'Almost done', title: 'Pick your backlog playlist', desc: 'The playlist Discover Cleaner clears as you listen, for example the one you save your Discover Weekly finds to.' })}
    <section class="card su-card su-pick" aria-labelledby="su-pick-h">
      <span class="su-pick-art" aria-hidden="true">${icon('backlog')}</span>
      <div class="su-pick-body">
        <h2 class="su-h2" id="su-pick-h">Which playlist should shrink as you listen?</h2>
        <ul class="su-needs" role="list">
          <li>${icon('check')}<span>A track from it is removed once you’ve heard <strong>${thr} seconds</strong> of it. You can change that, or pause auto-clear, any time.</span></li>
          <li>${icon('check')}<span>Nothing outside this playlist is ever removed, and <strong>Undo</strong> puts a track back where it was.</span></li>
          <li>${icon('check')}<span>Only playlists you own or collaborate on can be cleared. No playlist yet? Make one in Spotify, add a few tracks, then pick it here.</span></li>
        </ul>
        <div class="su-actions"><button type="button" class="btn btn-primary btn-lg" data-su="pick">${icon('backlog')}Choose playlist</button></div>
      </div>
    </section>`;
}

function doneStep() {
  return html`
    ${pageHeader({ eyebrow: 'Setup', title: 'You’re all set', desc: 'Spotify is connected and your backlog playlist is chosen. Change either one later in Settings.' })}
    <div class="su-actions"><a class="btn btn-primary btn-lg" href="#/now">${icon('now')}Go to Now</a><a class="btn btn-secondary btn-lg" href="#/settings">${icon('settings')}Settings</a></div>`;
}

function demoStep() {
  return html`
    ${pageHeader({ eyebrow: 'Setup', title: 'Setup is off in the offline demo', desc: 'The demo plays through a simulated Spotify, so there is no Spotify app to connect.' })}
    ${notice({ tone: 'info', icon: 'wifiOff', title: 'Want to use it with your own Spotify?', body: html`Stop the demo and start the app without <code>--demo</code> (<code>run.bat</code> or <code>./run.sh</code>). The setup steps appear on the first start.` })}`;
}

function render() {
  const info = V.info;
  if (!info) { mount(V.root, loadingState('Loading setup…')); return; }
  const step = stepFor(info, V.params);
  V.step = step;
  V.ctx.setTitle({ playlist: 'Pick your backlog playlist', connect: 'Connect Spotify' }[step] || 'Setup');
  mount(V.root, step === 'demo' ? demoStep() : step === 'playlist' ? playlistStep() : step === 'done' ? doneStep() : connectStep(info));
}

// ------------------------------------------------------------------ actions
function showError(id, message) {
  const input = V.root.querySelector(`#${id}`);
  const err = V.root.querySelector(`#${id}-err`);
  if (!input || !err) return;
  if (!message) {
    err.hidden = true;
    err.textContent = '';
    input.removeAttribute('aria-invalid');
    input.setAttribute('aria-describedby', `${id}-help`);
    return;
  }
  err.hidden = false;
  err.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', `${id}-help ${id}-err`);
}

const FIELD_IDS = { client_id: 'su-client-id', client_secret: 'su-client-secret', lastfm_api_key: 'su-lfm-key', lastfm_username: 'su-lfm-user' };

function validate(values) {
  const info = V.info;
  const errors = {};
  if (!values.client_id && !info.client_id_set) errors.client_id = 'Paste your Spotify app’s Client ID.';
  else if (values.client_id && !HEX32.test(values.client_id)) errors.client_id = 'A Client ID is 32 characters, 0-9 and a-f. Copy it again from the dashboard.';
  if (!values.client_secret && !info.client_secret_set) errors.client_secret = 'Paste your Spotify app’s Client Secret.';
  else if (values.client_secret && !HEX32.test(values.client_secret)) errors.client_secret = 'A Client Secret is 32 characters, 0-9 and a-f. Click “View client secret” and copy it again.';
  else if (values.client_secret && values.client_secret === values.client_id) errors.client_secret = 'That’s the Client ID. Click “View client secret” and copy that.';
  if (values.lastfm_api_key && !HEX32.test(values.lastfm_api_key)) errors.lastfm_api_key = 'A Last.fm API key is 32 characters, 0-9 and a-f.';
  if (values.lastfm_username && !LASTFM_USER.test(values.lastfm_username)) errors.lastfm_username = 'Last.fm usernames are 2-15 letters, digits, - or _, starting with a letter.';
  if (values.lastfm_username && !values.lastfm_api_key && !info.lastfm_api_key_set && !errors.lastfm_username) errors.lastfm_api_key = 'Add a Last.fm API key too, or leave both Last.fm fields empty.';
  return errors;
}

function showErrors(errors) {
  Object.entries(FIELD_IDS).forEach(([name, id]) => showError(id, errors[name] || ''));
  const first = Object.keys(FIELD_IDS).find((k) => errors[k]);
  if (first) {
    if (first.startsWith('lastfm')) V.root.querySelector('.su-lastfm')?.setAttribute('open', '');
    V.root.querySelector(`#${FIELD_IDS[first]}`)?.focus();
  }
  return !first;
}

async function save(form) {
  const btn = form.querySelector('[data-su="save"]');
  const values = Object.fromEntries(Object.keys(FIELD_IDS).map((k) => [k, String(form.elements[k]?.value || '').trim()]));
  if (!showErrors(validate(values))) return;
  await withBusy(btn, async () => {
    try {
      const r = await api.post('/api/v2/setup', values, { signal: V.ctx.signal });
      try { sessionStorage.setItem(SETUP_CONNECTING, '1'); } catch { /* storage off: Now's own Connect button still works */ }
      V.saved = true;
      if (r?.setup) V.info = { ...V.info, ...r.setup };
      const status = form.querySelector('[data-part="saved"]');
      if (status) status.textContent = r?.saved?.length ? 'Saved to .env.' : 'Already saved.';
      ['client_secret', 'lastfm_api_key'].forEach((k) => { if (form.elements[k]) form.elements[k].value = ''; });
      mount(V.root.querySelector('[data-part="connect"]'), connectCard(V.info, true));
      V.root.querySelector('[data-su="connect"]')?.focus();
      store.refreshSoon(300);
    } catch (err) {
      if (isAbort(err)) return;
      const fields = err.data?.error?.fields;
      if (fields && typeof fields === 'object') showErrors(fields);
      else toast(err.message || 'Couldn’t save your keys.', { kind: 'error' });
    }
  });
}

async function copyUri(btn) {
  const text = V.info?.redirect_uri || '';
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall back below */ }
  if (!ok) {
    const sel = window.getSelection();
    const node = V.root.querySelector('#su-uri');
    if (sel && node) { const range = document.createRange(); range.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(range); }
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  const label = btn.querySelector('span');
  if (label) label.textContent = ok ? 'Copied' : 'Select and copy';
  toast(ok ? 'Redirect URI copied.' : 'Select the address and copy it.', { kind: ok ? 'success' : 'info', key: 'su-copy', timeoutMs: 2200 });
  setTimeout(() => { if (label?.isConnected) label.textContent = 'Copy'; }, 2400);
}

async function load() {
  try {
    V.info = await api.get('/api/v2/setup', { signal: V.ctx.signal });
    render();
  } catch (err) {
    if (isAbort(err)) return;
    mount(V.root, errorState(err, { title: 'Couldn’t load setup', retry: load }));
  }
}

export default {
  id: 'setup',
  title: 'Setup',
  async mount(root, params, ctx) {
    V = { root, params: params || {}, ctx, info: null, step: null, saved: false };
    render();
    root.addEventListener('click', (ev) => {
      const t = ev.target instanceof Element ? ev.target.closest('[data-su]') : null;
      if (!t) return;
      const a = t.dataset.su;
      if (a === 'copy') copyUri(t).catch(reportError);
      else if (a === 'pick') openPlaylistPicker(t).catch(reportError);
    }, { signal: ctx.signal });
    root.addEventListener('submit', (ev) => {
      const form = ev.target instanceof HTMLFormElement && ev.target.dataset.su === 'form' ? ev.target : null;
      if (!form) return;
      ev.preventDefault();
      save(form).catch(reportError);
    }, { signal: ctx.signal });
    root.addEventListener('input', (ev) => {
      const id = ev.target instanceof HTMLInputElement ? ev.target.id : '';
      if (id && Object.values(FIELD_IDS).includes(id)) showError(id, '');
    }, { signal: ctx.signal });
    await load();
  },
  update(params, ctx) {
    if (!V) return;
    V.params = params || {};
    V.ctx = ctx;
    render();
  },
  onStatus(s) {
    if (!V?.info || !s?.setup) return;
    const next = { ...V.info, demo: s.setup.demo, needs_credentials: s.setup.needs_credentials,
      needs_playlist: s.setup.needs_playlist, signed_in: V.info.signed_in || s.auth_ready === true };
    const changed = stepFor(next, V.params) !== V.step;
    V.info = next;
    if (changed) render();
  },
  unmount() { V = null; },
};

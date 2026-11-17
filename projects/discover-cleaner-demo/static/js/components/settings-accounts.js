// Settings → Accounts: the Spotify sign-in and app credentials, and the Last.fm username + API
// key with a real connection test (GET /api/v2/data/lastfm/check → Last.fm user.getInfo).
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import { html, raw, mount, icon, fmt, toast, confirmDialog, loadingState, errorState, withBusy, safeUrl, reportError } from '../core/ui.js';
import { notice, statusChip, setFieldError, settingsStore, secretPlaceholder, secretTyped } from './settings-ui.js';

// One Last.fm check per session is enough to show "Working"; Save and "Test connection" re-run it.
let lastfmCheck = null;   // {ok, user} | {ok:false, error}

const SPOTIFY_KEYS = ['SPOTIPY_CLIENT_ID', 'SPOTIPY_CLIENT_SECRET'];
const LASTFM_KEYS = ['LASTFM_USERNAME', 'LASTFM_API_KEY'];

function spotifyState(s) {
  const st = s?.spotify_status?.state;
  if (!s) return 'unknown';
  if (st === 'signed_out' || s.auth_ready === false) return 'signed_out';
  if (st === 'app_not_registered') return 'blocked';
  return 'connected';
}

export function createAccountsSection(env) {
  let el = null;
  let items = null;
  let loadErr = null;
  let spSig = '';
  let checking = false;
  const offs = [];

  // ------------------------------------------------------------------ fields
  function field({ key, label, type = 'text', item, help, readonly = false, copy = false, autocomplete = 'off' }) {
    const id = `st-f-${key}`;
    const secret = type === 'password';
    const value = secret ? '' : (item?.value ?? '');
    const helpId = help ? `${id}-help` : '';
    return html`<div class="st-field" data-key="${key}">
      <label class="st-field-label" for="${id}">${label}</label>
      <div class="st-field-control">
        <div class="st-input-wrap${secret ? ' has-reveal' : ''}${copy ? ' has-copy' : ''}">
          <input class="input${readonly ? ' st-input-readonly' : ''}" id="${id}" name="${key}" type="${secret ? 'password' : 'text'}"
            value="${value}" data-initial="${value}" autocomplete="${autocomplete}" spellcheck="false" autocapitalize="off"
            ${secret ? html`placeholder="${secretPlaceholder(item)}"` : ''}
            ${readonly ? raw('readonly') : ''} ${helpId ? raw(`aria-describedby="${helpId}"`) : ''}>
          ${secret ? html`<button type="button" class="st-input-btn" data-st="reveal" aria-label="Show ${label}" aria-pressed="false" data-tip="Show what you typed">${icon('eye')}</button>` : ''}
          ${copy ? html`<button type="button" class="st-input-btn" data-st="copy" data-copy="${value}" aria-label="Copy ${label}" data-tip="Copy">${icon('copy')}</button>` : ''}
        </div>
        ${help ? html`<p class="field-help" id="${helpId}">${help}</p>` : ''}
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ Spotify card
  function spotifyHead(s) {
    const state = spotifyState(s);
    const name = s?.user_display_name;
    let chip; let line; let action;
    if (state === 'signed_out') {
      chip = statusChip('warning', 'Not connected', 'link');
      line = 'Sign in with Spotify so the app can see what you play and clear your backlog.';
      action = html`<a class="btn btn-primary" href="/login">${icon('link')}Connect Spotify</a>`;
    } else if (state === 'blocked') {
      chip = statusChip('critical', 'Blocked by Spotify');
      line = s?.spotify_status?.message || 'Spotify refused this account for the app. Add it under User Management in the Spotify developer dashboard, then sign in again.';
      action = html`<a class="btn btn-secondary" href="/login">${icon('refresh')}Sign in again</a>`;
    } else if (state === 'connected') {
      chip = statusChip('good', 'Connected');
      line = name ? html`Signed in as <strong>${name}</strong>.` : 'Signed in.';
      action = html`<a class="btn btn-ghost" href="/login" data-tip="Use this if Spotify stopped answering, or to switch accounts">${icon('refresh')}Sign in again</a>`;
    } else {
      chip = statusChip('muted', 'Checking…', 'clock');
      line = 'Waiting for the first status update.';
      action = '';
    }
    return html`<div class="st-acct-head">
      <span class="st-acct-logo" data-brand="spotify" aria-hidden="true">${icon('music')}</span>
      <div class="st-acct-main">
        <div class="st-acct-title"><h3 class="st-card-title">Spotify</h3>${chip}</div>
        <p class="st-row-desc">${line}</p>
      </div>
      <div class="st-acct-actions">${action}</div>
    </div>`;
  }

  function spotifyForm() {
    if (!items) return loadErr ? errorState(loadErr, { compact: true, retry: () => load(true) }) : loadingState('Loading…', { compact: true });
    const needs = !items.SPOTIPY_CLIENT_ID?.has_value || !items.SPOTIPY_CLIENT_SECRET?.has_value;
    return html`<details class="st-disclosure" ${needs ? raw('open') : ''}>
      <summary><span class="st-disclosure-title">Spotify app details</span><span class="st-disclosure-hint">Client ID, secret and redirect URI from your Spotify developer app</span>${icon('chevronDown')}</summary>
      <div class="st-disclosure-body">
        <p class="st-row-desc">This app talks to Spotify through your own developer app. Find these at
          <a class="link-accent" href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">developer.spotify.com/dashboard${icon('external', { className: 'icon-inline' })}</a>.</p>
        <form class="st-form" data-form="spotify" novalidate>
          ${field({ key: 'SPOTIPY_CLIENT_ID', label: 'Client ID', item: items.SPOTIPY_CLIENT_ID })}
          ${field({ key: 'SPOTIPY_CLIENT_SECRET', label: 'Client secret', type: 'password', item: items.SPOTIPY_CLIENT_SECRET, autocomplete: 'new-password', help: 'Stored only on this computer, in the app’s .env file. It is never shown again.' })}
          ${field({ key: 'SPOTIPY_REDIRECT_URI', label: 'Redirect URI', item: items.SPOTIPY_REDIRECT_URI, readonly: true, copy: true, help: 'Add this exact address under Redirect URIs in your Spotify app’s settings.' })}
          <div class="st-form-foot">
            <p class="st-form-note">${icon('info')}<span>Changing these signs you out of Spotify. You'll connect again right after.</span></p>
            <button type="submit" class="btn btn-primary" data-save disabled>Save Spotify app</button>
          </div>
        </form>
      </div>
    </details>`;
  }

  // ------------------------------------------------------------------ Last.fm card
  function lastfmChip() {
    if (!items) return '';
    const configured = items.LASTFM_USERNAME?.has_value && items.LASTFM_API_KEY?.has_value;
    if (!configured) return statusChip('warning', 'Not set up', 'link');
    if (checking) return statusChip('busy', 'Testing…', 'refresh');
    if (lastfmCheck?.ok) return statusChip('good', 'Working');
    if (lastfmCheck && !lastfmCheck.ok) return statusChip('critical', lastfmCheck.error?.isRateLimited ? 'Busy' : 'Problem');
    return statusChip('muted', 'Set up', 'checkCircle');
  }

  function lastfmResult() {
    if (checking) return html`<div class="st-test" data-tone="busy">${loadingState('Asking Last.fm…', { compact: true })}</div>`;
    if (!lastfmCheck) return '';
    if (lastfmCheck.ok) {
      const u = lastfmCheck.user || {};
      const img = safeUrl(u.image, '');
      const since = u.registered_ts ? fmt.date(u.registered_ts, { year: 'always', month: 'short' }) : null;
      return html`<div class="st-test" data-tone="good" role="status">
        ${img && /^https:/i.test(img) ? html`<img class="st-test-avatar" src="${img}" alt="" loading="lazy">` : html`<span class="st-test-avatar st-test-avatar-ph" aria-hidden="true">${fmt.initials(u.name || '?')}</span>`}
        <div class="st-test-main">
          <div class="st-test-title">${icon('checkCircle')}<span>Connected as <strong>${u.name}</strong></span></div>
          <div class="st-row-desc">${u.playcount != null ? html`${fmt.num(u.playcount)} scrobbles on Last.fm` : 'Last.fm answered'}${since ? html` · scrobbling since ${since}` : ''}</div>
        </div>
        ${u.url ? html`<a class="btn btn-ghost btn-sm" href="${safeUrl(u.url)}" target="_blank" rel="noopener noreferrer">Open profile${icon('external')}</a>` : ''}
      </div>`;
    }
    const err = lastfmCheck.error || {};
    return notice({ tone: err.isRateLimited ? 'warning' : 'critical', compact: true, title: "Last.fm didn't accept the connection", body: `${err.message || 'Something went wrong.'} History you already have is safe; syncing new scrobbles waits until this works.` });
  }

  function lastfmCard() {
    return html`<div class="st-acct-head">
        <span class="st-acct-logo" data-brand="lastfm" aria-hidden="true">${icon('insights')}</span>
        <div class="st-acct-main">
          <div class="st-acct-title"><h3 class="st-card-title">Last.fm</h3><span data-part="lfm-chip">${lastfmChip()}</span></div>
          <p class="st-row-desc">Your scrobbles fill in your listening history: plays from before this app, and from other devices.</p>
        </div>
      </div>
      ${items ? html`<form class="st-form" data-form="lastfm" novalidate>
        ${field({ key: 'LASTFM_USERNAME', label: 'Username', item: items.LASTFM_USERNAME, autocomplete: 'username' })}
        ${field({ key: 'LASTFM_API_KEY', label: 'API key', type: 'password', item: items.LASTFM_API_KEY, autocomplete: 'new-password',
          help: html`Free from <a class="link-accent" href="https://www.last.fm/api/account/create" target="_blank" rel="noopener noreferrer">last.fm/api/account/create${icon('external', { className: 'icon-inline' })}</a>. Stored only on this computer.` })}
        <div class="st-form-foot">
          <div class="st-form-result" data-part="lfm-result" aria-live="polite">${lastfmResult()}</div>
          <div class="st-form-buttons">
            <button type="button" class="btn btn-secondary" data-st="lfm-test">Test connection</button>
            <button type="submit" class="btn btn-primary" data-save disabled>Save &amp; test</button>
          </div>
        </div>
      </form>` : (loadErr ? errorState(loadErr, { compact: true, retry: () => load(true) }) : loadingState('Loading…', { compact: true }))}`;
  }

  // ------------------------------------------------------------------ render
  function render() {
    const s = store.status;
    spSig = spSigOf(s);
    mount(el, html`
      <div class="card st-card st-acct" data-part="spotify">
        <div data-part="sp-head">${spotifyHead(s)}</div>
        <div data-part="sp-form">${spotifyForm()}</div>
      </div>
      <div class="card st-card st-acct" data-part="lastfm">${lastfmCard()}</div>`);
    updateDirty();
  }

  const spSigOf = (s) => JSON.stringify([spotifyState(s), s?.user_display_name, s?.spotify_status?.message]);

  function refreshLastfmStatus() {
    const chip = el?.querySelector('[data-part="lfm-chip"]');
    if (chip) mount(chip, lastfmChip());
    const res = el?.querySelector('[data-part="lfm-result"]');
    if (res) mount(res, lastfmResult());
  }

  // ------------------------------------------------------------------ data
  async function load(force = false) {
    loadErr = null;
    try {
      const cur = await settingsStore.load({ force });
      items = cur.byKey;
    } catch (err) {
      if (isAbort(err)) return;
      loadErr = err;
    }
    if (el) render();
    if (items && !lastfmCheck && items.LASTFM_USERNAME?.has_value && items.LASTFM_API_KEY?.has_value) testLastfm({ quiet: true });
  }

  /** Typed (unsaved) Last.fm values, so Test and Save check what is in the boxes. */
  function typedLastfm() {
    const out = {};
    const u = el?.querySelector('#st-f-LASTFM_USERNAME');
    const k = el?.querySelector('#st-f-LASTFM_API_KEY');
    if (u && u.value.trim() && u.value.trim() !== (u.dataset.initial || '').trim()) out.username = u.value.trim();
    if (k && secretTyped(k)) out.api_key = k.value.trim();
    return out;
  }

  /** Ask Last.fm (typed values first, else the saved ones). Resolves to the new lastfmCheck. */
  async function testLastfm({ quiet = false, button, typed = typedLastfm() } = {}) {
    if (checking) return lastfmCheck;
    checking = true;
    refreshLastfmStatus();
    ['LASTFM_USERNAME', 'LASTFM_API_KEY'].forEach((k) => setFieldError(el?.querySelector(`#st-f-${k}`), ''));
    try {
      const r = await withBusy(button, () => (Object.keys(typed).length
        ? api.post('/api/v2/data/lastfm/check', typed, { timeoutMs: 20000 })
        : api.get('/api/v2/data/lastfm/check', { timeoutMs: 20000 })));
      lastfmCheck = { ok: true, user: r?.user || {}, typed: Object.keys(typed).length > 0 };
      if (!quiet) toast(html`Last.fm is working: connected as <strong>${lastfmCheck.user.name || ''}</strong>`, { kind: 'success', key: 'st-lfm', detail: lastfmCheck.typed ? 'Not saved yet: press Save to keep these details.' : undefined });
    } catch (err) {
      if (isAbort(err)) { checking = false; return lastfmCheck; }
      lastfmCheck = { ok: false, error: err };
      const fieldKey = err.data?.error?.field;
      if (fieldKey && el) setFieldError(el.querySelector(`#st-f-${fieldKey}`), err.message);
    } finally {
      checking = false;
      refreshLastfmStatus();
    }
    return lastfmCheck;
  }

  // ------------------------------------------------------------------ dirty + save
  function formDirty(form) {
    if (!form) return false;
    return [...form.querySelectorAll('input[name]:not([readonly])')].some((i) => (i.type === 'password' ? secretTyped(i) : i.value.trim() !== (i.dataset.initial || '').trim()));
  }

  function updateDirty() {
    el?.querySelectorAll('form[data-form]').forEach((f) => {
      const b = f.querySelector('[data-save]');
      if (b) b.disabled = !formDirty(f);
    });
  }

  async function saveForm(form) {
    const kind = form.dataset.form;
    const keys = kind === 'spotify' ? SPOTIFY_KEYS : LASTFM_KEYS;
    const updates = {};
    for (const k of keys) {
      const input = form.querySelector(`[name="${k}"]`);
      if (!input) continue;
      setFieldError(input, '');
      if (input.type === 'password') { if (secretTyped(input)) updates[k] = input.value.trim(); }
      else if (input.value.trim() !== (input.dataset.initial || '').trim()) updates[k] = input.value.trim();
    }
    if (kind === 'lastfm' && 'LASTFM_USERNAME' in updates && !updates.LASTFM_USERNAME) {
      setFieldError(form.querySelector('[name="LASTFM_USERNAME"]'), 'Enter your Last.fm username.');
      return;
    }
    if (kind === 'spotify' && 'SPOTIPY_CLIENT_ID' in updates && !updates.SPOTIPY_CLIENT_ID) {
      setFieldError(form.querySelector('[name="SPOTIPY_CLIENT_ID"]'), 'The client ID can’t be empty. Copy it from your Spotify app.');
      return;
    }
    if (!Object.keys(updates).length) return;
    if (kind === 'spotify' && spotifyState(store.status) === 'connected') {
      const ok = await confirmDialog({
        title: 'Save new Spotify app details?',
        body: 'You’ll be signed out of Spotify and need to connect again. Until then, nothing is tracked or cleared.',
        confirmLabel: 'Save and sign out',
      });
      if (!ok) return;
    }
    const btn = form.querySelector('[data-save]');
    await withBusy(btn, async () => {
      let check = null;
      if (kind === 'lastfm') {
        // Test what was typed before saving it: a wrong key or username is never saved.
        const typed = {};
        if (updates.LASTFM_USERNAME) typed.username = updates.LASTFM_USERNAME;
        if (updates.LASTFM_API_KEY) typed.api_key = updates.LASTFM_API_KEY;
        check = await testLastfm({ quiet: true, typed });
        if (check && !check.ok && check.error?.data?.error?.field) {
          el?.querySelector(`#st-f-${check.error.data.error.field}`)?.focus();
          return;
        }
      }
      try {
        const r = await settingsStore.save(updates);
        items = settingsStore.current?.byKey || items;
        if (kind === 'spotify') {
          const signedOut = !!r?.cleared_spotify_cache || SPOTIFY_KEYS.some((k) => r?.saved?.includes(k));
          if (signedOut) {
            toast('Spotify app details saved', { kind: 'success', detail: 'Connect Spotify again to continue.', action: { label: 'Connect', onClick: () => { window.location.href = '/login'; } }, persistent: true, key: 'st-spotify-saved' });
          } else toast(r?.message || 'Nothing changed.', { kind: 'info' });
          store.refresh();
          render();
        } else {
          if (lastfmCheck?.ok) lastfmCheck = { ...lastfmCheck, typed: false };
          render();
          if (check?.ok) toast(html`Last.fm connected as <strong>${check.user?.name || ''}</strong>`, { kind: 'success', key: 'st-lfm', detail: 'Saved. New scrobbles sync from now on.' });
          else toast('Last.fm details saved', { kind: 'warning', key: 'st-lfm', detail: `Last.fm couldn't be reached to test them (${check?.error?.message || 'no answer'}). Try Test connection later.` });
        }
      } catch (err) {
        if (isAbort(err)) return;
        const key = err.data?.error?.field;
        const input = key ? form.querySelector(`[name="${key}"]`) : null;
        if (input) { setFieldError(input, err.message); input.focus(); }
        else toast(err.message || "Couldn't save.", { kind: 'error' });
      }
    });
  }

  async function copyText(btn) {
    const text = btn.dataset.copy || '';
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to the clipboard', { kind: 'success', icon: 'check', timeoutMs: 2000, key: 'st-copy' });
    } catch {
      const input = btn.parentElement?.querySelector('input');
      input?.focus();
      input?.select();
      toast('Press Ctrl+C to copy the selected address.', { kind: 'info', key: 'st-copy' });
    }
  }

  // ------------------------------------------------------------------ section API
  return {
    id: 'accounts',
    label: 'Accounts',
    icon: 'user',
    title: 'Accounts',
    desc: 'Spotify tracks what you play and clears your backlog. Last.fm fills in your listening history.',
    mount(root) {
      el = root;
      render();
      load(true);   // fresh on every visit: .env may have been edited by hand
      offs.push(settingsStore.on((cur) => {
        // Another section saved: refresh unless the user is typing here.
        items = cur.byKey;
        if (el && !el.contains(document.activeElement)) render();
      }));
      el.addEventListener('input', (ev) => {
        // Typing fixes the problem as far as the user can tell: drop the stale error.
        if (ev.target instanceof HTMLInputElement && ev.target.getAttribute('aria-invalid') === 'true') setFieldError(ev.target, '');
        updateDirty();
      });
      el.addEventListener('submit', (ev) => {
        const form = ev.target instanceof HTMLFormElement ? ev.target : null;
        if (!form) return;
        ev.preventDefault();
        saveForm(form).catch(reportError);
      });
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-st]') : null;
        if (!t || t.disabled) return;
        const a = t.dataset.st;
        if (a === 'reveal') {
          const input = t.parentElement.querySelector('input');
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          t.setAttribute('aria-pressed', show ? 'true' : 'false');
          t.dataset.tip = show ? 'Hide' : 'Show what you typed';
        } else if (a === 'copy') copyText(t);
        else if (a === 'lfm-test') testLastfm({ button: t });
      });
    },
    onStatus(s) {
      if (!el) return;
      const sig = spSigOf(s);
      if (sig === spSig) return;
      spSig = sig;
      const head = el.querySelector('[data-part="sp-head"]');
      if (head && !head.contains(document.activeElement)) mount(head, spotifyHead(s));
    },
    destroy() {
      offs.forEach((f) => f());
      el = null;
    },
  };
}

export default { createAccountsSection };

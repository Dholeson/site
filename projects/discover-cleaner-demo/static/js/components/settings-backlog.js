// Settings → Backlog & clearing: which playlist gets cleared (picker + pasted link), its sync
// state, the auto-clear switch, the clear-after threshold and catch-up.
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import {
  html, raw, mount, icon, fmt, toast, openDialog, confirmDialog, loadingState, emptyState, errorState,
  thumb, meter, infoTip, withBusy, debounce, safeUrl, reportError,
} from '../core/ui.js';
import { switchControl, setSwitch, switchOn, notice, relTime, secondsLabel, statusChip } from './settings-ui.js';
import { openCatchUpDialog } from './catchup-dialog.js';

const TH_MIN = 5;
const TH_MAX = 120;
const PRESETS = [10, 15, 30, 60];

// Playlists are only listed when the picker opens (it costs Spotify requests); remember them for
// the session so the card can show the cover and owner afterwards.
let playlistCache = null;

const q = (n) => (n ? `“${n}”` : 'your backlog');

/** Playlist ID from an ID, open.spotify.com link or spotify: URI (same rules as the server). */
export function parsePlaylistId(input) {
  const t = String(input || '').trim();
  if (/^[A-Za-z0-9]{22}$/.test(t)) return t;
  const m = t.match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

function signedOut(s) {
  return s?.spotify_status?.state === 'signed_out' || s?.auth_ready === false;
}

export function createBacklogSection(env) {
  let el = null;
  let thPending = null;          // value being saved: status polls must not snap the slider back
  let thDragging = false;
  let autoPending = null;
  let savedTimer = null;
  const offs = [];

  let plSig = '';
  let cuSig = '';
  const backlogOf = (s) => s?.backlog || {};
  // Only what the cards show: a poll that changes nothing visible must not re-render them.
  const plSigOf = (s) => {
    const b = backlogOf(s);
    return JSON.stringify([nameOf(s), b.playlist_id, b.total ?? s?.playlist_total, b.loading, b.complete, b.progress?.loaded,
      b.progress?.total, b.error, b.pending_removals, b.checked_at_ms || b.synced_at_ms, signedOut(s), playlistCache?.at]);
  };
  const cuSigOf = (s) => JSON.stringify([nameOf(s), signedOut(s)]);
  const nameOf = (s) => backlogOf(s).name || s?.playlist_name || '';

  // ------------------------------------------------------------------ playlist card
  function playlistMeta(s) {
    const b = backlogOf(s);
    const cached = playlistCache?.list?.find((p) => p.id === b.playlist_id);
    return { id: b.playlist_id, name: nameOf(s), total: b.total ?? s?.playlist_total, image: cached?.image, owner: cached?.owner, collaborative: cached?.collaborative };
  }

  function syncLine(s) {
    const b = backlogOf(s);
    if (signedOut(s)) {
      return notice({ tone: 'warning', compact: true, title: 'Spotify is not connected', body: 'Connect Spotify so the app can see what you play and clear it from this playlist.', actions: html`<a class="btn btn-primary btn-sm" href="/login">${icon('link')}Connect Spotify</a>` });
    }
    if (!b.playlist_id) {
      return notice({ tone: 'info', compact: true, title: 'No backlog playlist yet', body: 'Choose the playlist to clear as you listen. Nothing is removed until you do.' });
    }
    const parts = [];
    if (b.loading || b.complete === false) {
      const loaded = b.progress?.loaded ?? b.known ?? 0;
      const total = b.progress?.total ?? b.total ?? 0;
      parts.push(html`<div class="st-sync" data-tone="busy">
        <div class="st-sync-line">${statusChip('busy', 'Checking tracks', 'refresh')}<span>Nothing is cleared until this finishes.</span></div>
        ${total ? meter({ value: loaded, max: total, label: 'Tracks checked', valueLabel: `${fmt.num(loaded)} of ${fmt.num(total)}`, tone: 'data' }) : ''}
      </div>`);
    } else if (b.error) {
      parts.push(html`<div class="st-sync-line">${statusChip('warning', 'Check failed')}<span>${String(b.error)} · tracks already known still clear.</span></div>`);
    } else {
      const at = b.checked_at_ms || b.synced_at_ms;
      parts.push(html`<div class="st-sync-line">${statusChip('good', 'Up to date')}<span>Checked ${relTime(at, { fallback: 'just now' })}${infoTip('The app keeps a list of the tracks in this playlist so it knows what to clear. It re-checks the playlist regularly and whenever it changes.', { label: 'Up to date' })}</span></div>`);
    }
    if (Number(b.pending_removals) > 0) {
      parts.push(html`<div class="st-sync-line">${statusChip('muted', 'Waiting', 'clock')}<span>${fmt.plural(b.pending_removals, 'clear')} waiting for Spotify · they go through automatically.</span></div>`);
    }
    return parts;
  }

  function playlistCard(s) {
    const m = playlistMeta(s);
    const out = signedOut(s);
    const syncing = !!m.id && !!(backlogOf(s).loading || backlogOf(s).complete === false);
    const openUrl = m.id ? safeUrl(`https://open.spotify.com/playlist/${encodeURIComponent(m.id)}`, '') : '';
    return html`
      <div class="st-pl">
        ${m.image ? thumb(m.image, { className: 'st-pl-art' }) : html`<span class="st-pl-art st-pl-art-ph" aria-hidden="true">${icon('backlog')}</span>`}
        <div class="st-pl-main">
          <div class="st-eyebrow">Clearing from</div>
          <div class="st-pl-name">${m.name || (out || !m.id ? 'No playlist yet' : 'Loading…')}</div>
          <div class="st-pl-meta">${m.id && (m.total > 0 || (m.total === 0 && !syncing)) ? html`<span>${fmt.plural(m.total, 'track')} left</span>` : syncing ? html`<span>Counting tracks…</span>` : ''}${m.owner ? html`<span>· ${m.collaborative ? 'Collaborative' : `Owned by ${m.owner}`}</span>` : ''}</div>
        </div>
        <div class="st-pl-actions">
          <button type="button" class="btn btn-secondary" data-st="pick" ${out ? 'disabled' : ''}>${icon('backlog')}${m.id ? 'Change playlist' : 'Choose playlist'}</button>
          <button type="button" class="btn btn-icon" data-st="recheck" aria-label="Check the playlist for changes now" data-tip="Check for changes now" ${out ? 'disabled' : ''}>${icon('refresh')}</button>
          ${openUrl ? html`<a class="btn btn-icon" href="${openUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${m.name || 'playlist'} in Spotify" data-tip="Open in Spotify">${icon('external')}</a>` : ''}
        </div>
      </div>
      <div class="st-pl-sync" data-part="sync">${syncLine(s)}</div>`;
  }

  // ------------------------------------------------------------------ clearing card
  function explain(s, secs) {
    const on = autoPending ?? s?.auto_clean?.enabled !== false;
    const n = q(nameOf(s));
    if (!on) return html`<strong>Auto-clear is off.</strong> Nothing is removed on its own. You can still clear the current track with <kbd>C</kbd> or Clear in the player.`;
    return html`A track is cleared from ${n} once you've heard <strong>${secondsLabel(secs, { long: true })}</strong> of it. Skip it sooner and it stays in your backlog.`;
  }

  function rangeBounds(v) {
    return [Math.min(TH_MIN, v), Math.max(TH_MAX, v)];
  }

  function clearingCard(s) {
    const on = s?.auto_clean?.enabled !== false;
    const secs = Math.round(Number(s?.threshold_seconds) || 15);
    const [lo, hi] = rangeBounds(secs);
    const pct = ((secs - lo) / (hi - lo)) * 100;
    return html`
      <div class="st-row st-row-top">
        <div class="st-row-text">
          <div class="st-row-title" id="st-auto-label">Auto-clear tracks you've heard</div>
          <p class="st-row-desc" id="st-auto-desc">Removes a track from your backlog playlist after you've listened to enough of it, so the playlist shrinks as you listen.</p>
        </div>
        <div class="st-row-control">
          <span class="st-switch-state" data-part="auto-state" aria-hidden="true">${on ? 'On' : 'Off'}</span>
          ${switchControl({ id: 'st-auto', checked: on, labelledby: 'st-auto-label', describedby: 'st-auto-desc' })}
        </div>
      </div>
      <div class="st-row st-row-stack" data-part="th-row" data-off="${on ? 'false' : 'true'}">
        <div class="st-th-head">
          <label class="st-row-title" for="st-th">Clear after</label>
          ${infoTip('Seconds of this play actually heard (pauses and seeking ahead don’t count). The same rule applies on every device, as long as this app is running.', { label: 'Clear after' })}
          <span class="st-th-value" data-part="th-value" aria-hidden="true">${secondsLabel(secs)}</span>
          <span class="st-saved" data-part="th-saved" role="status" aria-live="polite"></span>
        </div>
        <input type="range" class="st-range" id="st-th" min="${lo}" max="${hi}" step="1" value="${secs}"
          style="--pct:${pct.toFixed(2)}%" aria-valuetext="${secondsLabel(secs, { long: true })}" aria-describedby="st-th-explain">
        <div class="st-range-scale" aria-hidden="true"><span>${secondsLabel(lo)}</span><span>${secondsLabel(hi)}</span></div>
        <div class="st-presets" role="group" aria-label="Quick picks">
          ${PRESETS.map((p) => html`<button type="button" class="chip chip-lg st-preset" data-st="preset" data-sec="${p}" aria-pressed="${p === secs ? 'true' : 'false'}">${secondsLabel(p)}</button>`)}
        </div>
        <p class="st-explain" id="st-th-explain" data-part="th-explain">${explain(s, secs)}</p>
      </div>`;
  }

  // ------------------------------------------------------------------ catch-up card
  function catchUpCard(s) {
    const out = signedOut(s);
    return html`<div class="st-row">
      <div class="st-row-text">
        <div class="st-row-title">Catch up on tracks you heard elsewhere</div>
        <p class="st-row-desc">Listened on another device while this app wasn't running? Check your last 50 Spotify plays and clear the ones still in ${q(nameOf(s))}.</p>
      </div>
      <div class="st-row-control"><button type="button" class="btn btn-secondary" data-st="catchup" ${out ? 'disabled' : ''}>${icon('clear')}Check recent plays</button></div>
    </div>`;
  }

  // ------------------------------------------------------------------ render
  function render() {
    const s = store.status;
    if (s) { plSig = plSigOf(s); cuSig = cuSigOf(s); }
    mount(el, html`
      <div class="card st-card" data-part="pl-card">${s ? playlistCard(s) : loadingState('Loading your backlog…', { compact: true })}</div>
      <div class="card st-card" data-part="clear-card">${s ? clearingCard(s) : ''}</div>
      <div class="card st-card" data-part="cu-card">${s ? catchUpCard(s) : ''}</div>`);
  }

  // ------------------------------------------------------------------ actions
  function setThresholdUi(secs, { fromUser = false } = {}) {
    const input = el.querySelector('#st-th');
    if (!input) return;
    const [lo, hi] = rangeBounds(secs);
    if (Number(input.min) !== lo || Number(input.max) !== hi) { input.min = String(lo); input.max = String(hi); }
    if (!fromUser) input.value = String(secs);
    input.style.setProperty('--pct', `${(((secs - lo) / (hi - lo)) * 100).toFixed(2)}%`);
    input.setAttribute('aria-valuetext', secondsLabel(secs, { long: true }));
    el.querySelector('[data-part="th-value"]').textContent = secondsLabel(secs);
    el.querySelectorAll('.st-preset').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.sec) === secs ? 'true' : 'false'));
    mount(el.querySelector('[data-part="th-explain"]'), explain(store.status, secs));
  }

  async function saveThreshold(secs) {
    thPending = secs;
    const saved = el.querySelector('[data-part="th-saved"]');
    saved.textContent = 'Saving…';
    saved.dataset.state = 'busy';
    try {
      const r = await api.post('/api/threshold', { seconds: secs });
      const v = Number(r?.threshold_seconds ?? secs);
      if (thPending !== secs) return;   // a newer value is on its way
      thPending = null;
      store.patch({ threshold_seconds: v });
      setThresholdUi(v);
      saved.textContent = 'Saved';
      saved.dataset.state = 'ok';
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { if (saved.isConnected) { saved.textContent = ''; delete saved.dataset.state; } }, 2200);
    } catch (err) {
      if (isAbort(err)) return;
      thPending = null;
      saved.textContent = '';
      delete saved.dataset.state;
      setThresholdUi(Math.round(Number(store.status?.threshold_seconds) || 15));
      toast(err.message || "Couldn't save the clear-after time.", { kind: 'error' });
    }
  }
  const saveThresholdSoon = debounce(saveThreshold, 350);

  async function toggleAuto(btn) {
    const next = !switchOn(btn);
    autoPending = next;
    setSwitch(btn, next);
    updateAutoUi();
    try {
      const r = await api.post('/api/v2/backlog/auto-clean', { enabled: next });
      const on = typeof r?.enabled === 'boolean' ? r.enabled : next;
      autoPending = null;
      store.patch({ auto_clean: { ...(store.status?.auto_clean || {}), enabled: on } });
      toast(on ? 'Auto-clear is on' : 'Auto-clear paused', {
        kind: on ? 'success' : 'info',
        icon: on ? 'checkCircle' : 'pauseCircle',
        key: 'st-auto-clean',
        detail: on ? `Tracks clear after ${secondsLabel(store.status?.threshold_seconds || 15, { long: true })} of listening.` : 'Tracks stay in your backlog until you clear them yourself.',
      });
      store.refreshSoon(400);
    } catch (err) {
      if (isAbort(err)) return;
      autoPending = null;
      setSwitch(btn, !next);
      updateAutoUi();
      toast(err.message || "Couldn't change auto-clear.", { kind: 'error' });
    }
  }

  function updateAutoUi() {
    const s = store.status;
    const on = autoPending ?? s?.auto_clean?.enabled !== false;
    const btn = el.querySelector('#st-auto');
    if (btn && autoPending == null) setSwitch(btn, on);
    const state = el.querySelector('[data-part="auto-state"]');
    if (state) state.textContent = on ? 'On' : 'Off';
    const row = el.querySelector('[data-part="th-row"]');
    if (row) row.dataset.off = on ? 'false' : 'true';
    const input = el.querySelector('#st-th');
    if (input) mount(el.querySelector('[data-part="th-explain"]'), explain(s, Number(input.value)));
  }

  async function recheck(btn) {
    await withBusy(btn, async () => {
      try {
        await api.post('/api/v2/backlog/sync', {});
        toast(`Checking ${q(nameOf(store.status))} for changes…`, { kind: 'info', icon: 'refresh', key: 'st-recheck' });
        store.refreshSoon(600);
      } catch (err) {
        if (!isAbort(err)) toast(err.message || "Couldn't start the check.", { kind: 'error' });
      }
    });
  }

  // ------------------------------------------------------------------ picker
  async function openPicker(opener) {
    const s = store.status;
    const currentId = backlogOf(s).playlist_id;
    const currentName = nameOf(s);
    const d = openDialog({
      title: 'Choose your backlog playlist',
      subtitle: 'Tracks are only ever removed from the playlist you pick. Only playlists you own or collaborate on can be cleared, so only those are listed.',
      wide: true,
      className: 'st-dialog st-picker',
      body: html`
        <div class="field">
          <label class="sr-only" for="st-pick-q">Search your playlists or paste a Spotify playlist link</label>
          <div class="st-input-icon">${icon('search')}<input class="input" id="st-pick-q" type="search" autocomplete="off" spellcheck="false"
            placeholder="Search your playlists or paste a link" aria-describedby="st-pick-help"></div>
          <p class="field-help" id="st-pick-help">Paste a link like open.spotify.com/playlist/… or spotify:playlist:… to use any playlist you can edit.</p>
        </div>
        <div class="st-pick-error" data-part="err" hidden></div>
        <div class="st-pick-list" data-part="list" aria-live="polite">${loadingState('Loading your playlists…', { compact: true })}</div>`,
      initialFocus: '#st-pick-q',
    });
    const ctrl = new AbortController();
    d.done.then(() => ctrl.abort());
    const listEl = d.body.querySelector('[data-part="list"]');
    const errEl = d.body.querySelector('[data-part="err"]');
    const input = d.body.querySelector('#st-pick-q');
    let lists = playlistCache?.list || null;
    let loadError = null;
    let busy = false;

    const itemHtml = (p, { pasted = false } = {}) => {
      const isCurrent = p.id === currentId;
      return html`<li><button type="button" class="st-pick-item" data-pid="${p.id}" data-pname="${p.name || ''}" ${isCurrent ? raw('aria-current="true"') : ''}>
        ${pasted ? html`<span class="thumb thumb-ph" aria-hidden="true">${icon('link')}</span>` : thumb(p.image, { alt: '' })}
        <span class="st-pick-main"><span class="st-pick-title truncate">${p.name || 'Pasted playlist'}</span>
          <span class="st-pick-sub truncate">${pasted ? `Playlist ID ${p.id}` : html`${p.tracks != null ? fmt.plural(p.tracks, 'track') : ''}${p.collaborative ? ' · collaborative' : p.owner ? ` · ${p.owner}` : ''}`}</span></span>
        ${isCurrent ? html`<span class="chip chip-accent">${icon('check')}Current</span>` : html`<span class="st-pick-go">${icon('chevronRight')}</span>`}
      </button></li>`;
    };

    const renderList = () => {
      const term = input.value.trim();
      const pasted = parsePlaylistId(term);
      const parts = [];
      if (pasted && !(lists || []).some((p) => p.id === pasted)) {
        parts.push(html`<div class="st-pick-group">From the link</div><ul class="st-pick-ul" role="list">${itemHtml({ id: pasted, name: '' }, { pasted: true })}</ul>`);
      }
      if (lists) {
        const needle = pasted ? '' : term.toLowerCase();
        const rows = lists.filter((p) => (pasted ? p.id === pasted : !needle || String(p.name || '').toLowerCase().includes(needle)));
        if (rows.length) parts.push(html`<div class="st-pick-group">Your playlists</div><ul class="st-pick-ul" role="list">${rows.map((p) => itemHtml(p))}</ul>`);
        else if (!pasted) parts.push(emptyState({ compact: true, icon: 'search', title: 'No playlists match', body: 'Try another name, or paste the playlist’s link.' }));
      } else if (loadError) {
        parts.push(errorState(loadError, {
          compact: true,
          title: loadError.isRateLimited || loadError.status === 503 ? 'Spotify is cooling down' : "Couldn't load your playlists",
          body: `${loadError.message || ''} You can still paste a playlist link above.`,
          retry: load,
        }));
      } else {
        parts.push(loadingState('Loading your playlists…', { compact: true }));
      }
      mount(listEl, parts);
    };

    async function load() {
      loadError = null;
      if (!lists) renderList();
      try {
        const r = await api.get('/api/playlists', { signal: ctrl.signal, timeoutMs: 25000 });
        lists = Array.isArray(r?.playlists) ? r.playlists : [];
        playlistCache = { list: lists, at: Date.now() };
        if (r?.warning) {
          mount(errEl, notice({ tone: 'warning', compact: true, body: r.warning }));
          errEl.hidden = false;
        }
        // The card can now show the cover and owner.
        const card = el?.querySelector('[data-part="pl-card"]');
        if (card && store.status) { plSig = plSigOf(store.status); mount(card, playlistCard(store.status)); }
      } catch (err) {
        if (isAbort(err)) return;
        if (!lists) loadError = err;
      }
      if (d.el.open) renderList();
    }

    async function choose(btn) {
      if (busy) return;
      const pid = btn.dataset.pid;
      if (!pid || pid === currentId) { if (pid === currentId) toast(`${q(currentName)} is already your backlog playlist.`, { kind: 'info' }); return; }
      const newName = btn.dataset.pname || '';
      const ok = !currentId || await confirmDialog({
        title: 'Switch backlog playlist?',
        body: html`<p>Switch the playlist that gets cleared from <strong>${q(currentName)}</strong> to <strong>${newName ? q(newName) : 'the pasted playlist'}</strong>?</p>
          <p class="st-confirm-note">From now on, tracks you listen to are cleared from the new playlist. Nothing is removed from ${q(currentName)}, and your listening history stays as it is.</p>`,
        confirmLabel: 'Switch playlist',
      });
      if (!ok || !d.el.open) return;
      busy = true;
      errEl.hidden = true;
      listEl.querySelectorAll('.st-pick-item').forEach((b) => { b.disabled = true; });
      btn.classList.add('is-busy');
      try {
        const r = await api.post('/api/set-playlist', { playlist_id: pid }, { timeoutMs: 25000 });
        const name = r?.playlist_name || newName;
        d.close('switched');
        toast(html`Now clearing from <strong>${q(name)}</strong>`, { kind: 'success', icon: 'backlog', detail: 'Checking its tracks now. Nothing is cleared until that finishes.' });
        if (r?.backlog) store.patch({ backlog: r.backlog, playlist_name: name });
        store.refresh();
      } catch (err) {
        if (isAbort(err)) return;
        busy = false;
        btn.classList.remove('is-busy');
        listEl.querySelectorAll('.st-pick-item').forEach((b) => { b.disabled = false; });
        mount(errEl, notice({ tone: err.isRateLimited || err.status === 503 ? 'warning' : 'critical', compact: true, title: "Couldn't switch playlists", body: `${err.message || 'Something went wrong.'} Your backlog is still ${q(currentName)}.` }));
        errEl.hidden = false;
        btn.focus();
      }
    }

    input.addEventListener('input', debounce(renderList, 100));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const first = listEl.querySelector('.st-pick-item:not([aria-current])');
        if (first) choose(first);
      } else if (ev.key === 'ArrowDown') {
        const first = listEl.querySelector('.st-pick-item');
        if (first) { ev.preventDefault(); first.focus(); }
      }
    });
    listEl.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      const items = [...listEl.querySelectorAll('.st-pick-item')];
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      ev.preventDefault();
      if (ev.key === 'ArrowUp' && i === 0) input.focus();
      else items[Math.max(0, Math.min(items.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))].focus();
    });
    listEl.addEventListener('click', (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest('.st-pick-item') : null;
      if (b && !b.disabled) choose(b).catch(reportError);
    });
    if (lists) renderList();
    load();
    await d.done;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ section API
  return {
    openPicker,
    id: 'backlog',
    label: 'Backlog & clearing',
    icon: 'backlog',
    title: 'Backlog & clearing',
    desc: 'Which playlist gets cleared, and when a track counts as heard.',
    mount(root) {
      el = root;
      render();
      offs.push(() => clearTimeout(savedTimer));
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-st], #st-auto') : null;
        if (!t || t.disabled) return;
        if (t.id === 'st-auto') { toggleAuto(t); return; }
        const a = t.dataset.st;
        if (a === 'pick') openPicker(t).catch(reportError);
        else if (a === 'recheck') recheck(t);
        else if (a === 'catchup') openCatchUpDialog({ button: t }).catch(reportError);
        else if (a === 'preset') {
          const v = Number(t.dataset.sec);
          setThresholdUi(v);
          saveThresholdSoon.cancel();
          saveThreshold(v);
        }
      });
      el.addEventListener('input', (ev) => {
        if (ev.target instanceof HTMLInputElement && ev.target.id === 'st-th') {
          thDragging = true;
          setThresholdUi(Number(ev.target.value), { fromUser: true });
        }
      });
      el.addEventListener('change', (ev) => {
        if (ev.target instanceof HTMLInputElement && ev.target.id === 'st-th') {
          thDragging = false;
          saveThresholdSoon(Number(ev.target.value));
        }
      });
      el.addEventListener('pointerup', () => { thDragging = false; });
    },
    onStatus(s, changed) {
      if (!el) return;
      if (!el.querySelector('#st-th')) { render(); return; }
      const has = (k) => !changed || changed.has(k);
      const active = document.activeElement;
      if (plSigOf(s) !== plSig) {
        plSig = plSigOf(s);
        const card = el.querySelector('[data-part="pl-card"]');
        const refocus = card.contains(active) ? active.dataset.st : null;
        mount(card, playlistCard(s));
        if (refocus) card.querySelector(`[data-st="${refocus}"]`)?.focus({ preventScroll: true });
      }
      if (cuSigOf(s) !== cuSig) {
        cuSig = cuSigOf(s);
        const cu = el.querySelector('[data-part="cu-card"]');
        const cuFocus = cu.contains(active);
        mount(cu, catchUpCard(s));
        if (cuFocus) cu.querySelector('[data-st="catchup"]')?.focus({ preventScroll: true });
      }
      if (has('auto_clean')) updateAutoUi();
      if (has('threshold_seconds') && thPending == null && !thDragging) {
        const v = Math.round(Number(s.threshold_seconds));
        const input = el.querySelector('#st-th');
        if (Number.isFinite(v) && input && Number(input.value) !== v && document.activeElement !== input) setThresholdUi(v);
      }
    },
    destroy() {
      offs.forEach((f) => f());
      saveThresholdSoon.cancel();
      el = null;
    },
  };
}

/** The playlist picker on its own (the first-run "Pick your backlog playlist" step uses it). */
export function openPlaylistPicker(opener) {
  return createBacklogSection().openPicker(opener);
}

export default { createBacklogSection, parsePlaylistId, openPlaylistPicker };

// Settings → Advanced: the remaining .env settings from GET /api/settings, rendered by type with
// the server's bounds, plain labels, "applies right away / needs a restart" notes, dirty tracking,
// a save bar, and per-field 400 errors.
import { isAbort } from '../core/api.js';
import { html, raw, mount, icon, fmt, toast, loadingState, errorState, withBusy, reportError } from '../core/ui.js';
import { notice, statusChip, switchControl, setSwitch, switchOn, setFieldError, settingsStore } from './settings-ui.js';

const ACCOUNT_KEYS = new Set(['SPOTIPY_CLIENT_ID', 'SPOTIPY_CLIENT_SECRET', 'SPOTIPY_REDIRECT_URI', 'LASTFM_API_KEY', 'LASTFM_USERNAME']);

const GROUPS = [
  { id: 'polling', title: 'How often to check Spotify', desc: 'Checking more often makes the player react faster, but uses more of Spotify’s request allowance.', keys: ['POLL_INTERVAL', 'POLL_INTERVAL_PAUSED'] },
  { id: 'favorites', title: 'Favorites', desc: 'Artists you like a lot are added to your Favorites in the Library automatically.', keys: ['AUTO_ARTIST_LIKE_THRESHOLD'] },
  { id: 'defaults', title: 'Starting values', desc: 'Only used on a fresh start, until you set these under Backlog & clearing.', keys: ['PLAYLIST_ID', 'DEFAULT_THRESHOLD', 'DISCOVER_WEEKLY_INFLOW'] },
  { id: 'developer', title: 'Developer options', desc: 'Leave these as they are unless you are working on the app itself.', keys: ['APP_DEBUG', 'APP_USE_RELOADER', 'SPOTIFY_EXTENDED_ENDPOINTS'] },
];

const FIELDS = {
  POLL_INTERVAL: { label: 'While music is playing', unit: 'seconds', help: 'How often the app asks Spotify what is playing.' },
  POLL_INTERVAL_PAUSED: { label: 'While paused or idle', unit: 'seconds', help: 'Slower checks save requests when nothing is playing.' },
  AUTO_ARTIST_LIKE_THRESHOLD: { label: 'Add an artist to Favorites after', unit: 'liked songs', help: 'When you have liked this many of an artist’s songs, they become a favorite. 0 turns this off.' },
  PLAYLIST_ID: { label: 'Backlog playlist', help: 'A playlist link or ID.', placeholder: 'open.spotify.com/playlist/…' },
  DEFAULT_THRESHOLD: { label: 'Clear after', unit: 'seconds', help: 'The first clear-after time, before you change it with the slider above.' },
  DISCOVER_WEEKLY_INFLOW: { label: 'New backlog tracks per week', unit: 'tracks', help: 'An estimate for the classic view’s backlog projections.' },
  APP_DEBUG: { label: 'Debug mode', help: 'Shows detailed errors in the server window.' },
  APP_USE_RELOADER: { label: 'Reload when the code changes', help: 'Leave off: it starts a second copy of the Spotify check.' },
  SPOTIFY_EXTENDED_ENDPOINTS: { label: 'Extended Spotify endpoints', help: 'Only for Spotify developer apps created before November 2024.' },
};

// Unsaved edits survive leaving the page (the router can't block navigation): they are put back
// the next time Settings opens, until saved or discarded.
let draft = null;

const labelOf = (item) => FIELDS[item.key]?.label || item.label || item.key;
const boolOn = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());
const numText = (v) => (v === '' || v == null ? '' : String(Number(v)));

export function createAdvancedSection(env) {
  let el = null;
  let items = null;
  let loadErr = null;
  const offs = [];

  // ------------------------------------------------------------------ fields
  function control(item) {
    const id = `st-a-${item.key}`;
    const help = `${id}-help`;
    if (item.type === 'bool') {
      return switchControl({ id, checked: boolOn(item.value), labelledby: `${id}-label`, describedby: help, name: item.key });
    }
    if (item.type === 'number') {
      const unit = FIELDS[item.key]?.unit;
      return html`<div class="st-num">
        <input class="input" id="${id}" name="${item.key}" type="number" inputmode="decimal"
          ${item.min != null ? raw(`min="${Number(item.min)}"`) : ''} ${item.max != null ? raw(`max="${Number(item.max)}"`) : ''}
          step="${item.step ?? 'any'}" value="${numText(item.value)}" data-initial="${numText(item.value)}"
          aria-describedby="${help}" ${item.readonly ? raw('readonly') : ''}>
        ${unit ? html`<span class="st-unit" aria-hidden="true">${unit}</span>` : ''}
      </div>`;
    }
    return html`<input class="input st-text" id="${id}" name="${item.key}" type="text" value="${item.value ?? ''}" data-initial="${item.value ?? ''}"
      autocomplete="off" spellcheck="false" aria-describedby="${help}" ${FIELDS[item.key]?.placeholder ? html`placeholder="${FIELDS[item.key].placeholder}"` : ''} ${item.readonly ? raw('readonly') : ''}>`;
  }

  function rangeHint(item) {
    if (item.type !== 'number' || item.min == null || item.max == null) return '';
    const unit = FIELDS[item.key]?.unit;
    return html` <span class="nowrap">${fmt.num(item.min, { digits: Number(item.min) % 1 ? 1 : 0 })}–${fmt.num(item.max)}${unit ? ` ${unit}` : ''}</span>.`;
  }

  function row(item) {
    const id = `st-a-${item.key}`;
    const f = FIELDS[item.key] || {};
    const applies = item.live
      ? html`<span class="st-applies">${icon('checkCircle')}Applies right away</span>`
      : html`<span class="st-applies" data-restart="true">${icon('refresh')}Needs a restart</span>`;
    return html`<div class="st-row st-adv-row" data-key="${item.key}">
      <div class="st-row-text">
        ${item.type === 'bool'
          ? html`<div class="st-row-title" id="${id}-label">${labelOf(item)}</div>`
          : html`<label class="st-row-title" for="${id}" id="${id}-label">${labelOf(item)}</label>`}
        <p class="st-row-desc" id="${id}-help">${f.help || item.help || ''}${rangeHint(item)}</p>
        <div class="st-adv-meta">${applies}${item.pending_restart ? statusChip('warning', 'Saved · restart to apply', 'refresh') : ''}</div>
      </div>
      <div class="st-row-control st-field">${control(item)}</div>
    </div>`;
  }

  function groups() {
    const list = settingsStore.current?.list || [];
    const known = new Set(GROUPS.flatMap((g) => g.keys));
    const out = GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => items[k]).filter(Boolean) }));
    const other = list.filter((i) => !ACCOUNT_KEYS.has(i.key) && !known.has(i.key));
    if (other.length) out.push({ id: 'other', title: 'Other', desc: '', items: other });
    return out.filter((g) => g.items.length);
  }

  function restartNotice() {
    const pending = (settingsStore.current?.restartPending || []).filter((k) => items?.[k]);
    if (!pending.length) return '';
    const names = pending.map((k) => labelOf(items[k]));
    return notice({
      tone: 'warning',
      title: 'Restart Discover Cleaner to finish applying changes',
      body: `Saved, but only used after a restart: ${names.join(', ')}. Close the app's server window and start it again.`,
    });
  }

  function body() {
    if (!items) return loadErr ? errorState(loadErr, { retry: () => load(true) }) : loadingState('Loading settings…', { compact: true });
    return html`
      <div data-part="restart">${restartNotice()}</div>
      <form class="st-adv-form" novalidate>
        ${groups().map((g) => html`<div class="card st-card st-adv-group" data-group="${g.id}">
          <div class="st-card-head"><div><h3 class="st-card-title">${g.title}</h3>${g.desc ? html`<p class="st-row-desc">${g.desc}</p>` : ''}</div></div>
          ${g.items.map(row)}
        </div>`)}
        <div class="st-savebar" data-part="savebar" hidden>
          <span class="st-savebar-text" role="status" aria-live="polite" data-part="dirty-count"></span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-st="discard">Discard</button>
          <button type="submit" class="btn btn-primary" data-st="save">Save changes</button>
        </div>
      </form>
      <p class="st-foot-note">${icon('lock')}<span>These live in the app's <code>.env</code> file${settingsStore.current?.envPath ? html` (<span class="st-path">${settingsStore.current.envPath}</span>)` : ''}. You can also edit it by hand while the app is closed.</span></p>`;
  }

  function render() {
    mount(el, body());
    if (draft && items) applyDraft();
    updateDirty();
  }

  function applyDraft() {
    for (const [key, v] of Object.entries(draft)) {
      const row = el.querySelector(`.st-adv-row[data-key="${CSS.escape(key)}"]`);
      if (!row) continue;
      const sw = row.querySelector('[role="switch"]');
      if (sw) setSwitch(sw, !!v);
      else { const input = row.querySelector('input'); if (input) input.value = String(v); }
    }
  }

  // ------------------------------------------------------------------ dirty + validation
  function changes() {
    const out = {};
    if (!el) return out;
    el.querySelectorAll('.st-adv-row').forEach((r) => {
      const key = r.dataset.key;
      const item = items?.[key];
      if (!item) return;
      if (item.type === 'bool') {
        const sw = r.querySelector('[role="switch"]');
        if (switchOn(sw) !== boolOn(item.value)) out[key] = switchOn(sw);
        return;
      }
      const input = r.querySelector('input');
      if (!input || input.readOnly) return;
      const v = input.value.trim();
      if (item.type === 'number') {
        if (v === '' && input.dataset.initial === '') return;
        if (v === '' || Number(v) !== Number(input.dataset.initial)) out[key] = v;
      } else if (v !== (input.dataset.initial || '').trim()) out[key] = v;
    });
    return out;
  }

  function validate(input, { show = true } = {}) {
    const key = input.name;
    const item = items?.[key];
    if (!item) return true;
    let msg = '';
    const v = input.value.trim();
    if (item.type === 'number') {
      const n = Number(v);
      const unit = FIELDS[key]?.unit ? ` ${FIELDS[key].unit}` : '';
      if (v === '' || input.validity?.badInput) msg = 'Enter a number.';
      else if (!Number.isFinite(n)) msg = 'Enter a number.';
      else if (item.num_type === 'int' && !Number.isInteger(n)) msg = 'Use a whole number.';
      else if ((item.min != null && n < Number(item.min)) || (item.max != null && n > Number(item.max))) msg = `Use a value from ${fmt.num(item.min, { digits: Number(item.min) % 1 ? 1 : 0 })} to ${fmt.num(item.max)}${unit}.`;
    } else if (key === 'PLAYLIST_ID' && v && !/^[A-Za-z0-9]{22}$/.test(v) && !/(open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/|spotify:playlist:)[A-Za-z0-9]{22}/.test(v)) {
      msg = 'Paste a Spotify playlist link, URI or 22-character ID.';
    }
    if (show) setFieldError(input, msg);
    return !msg;
  }

  function updateDirty() {
    const bar = el?.querySelector('[data-part="savebar"]');
    if (!bar) return;
    const n = Object.keys(changes()).length;
    bar.hidden = !n;
    // Toasts sit at the bottom centre too: lift them above the save bar while it shows.
    document.documentElement.style.setProperty('--toast-lift', n ? '64px' : '0px');
    const txt = el.querySelector('[data-part="dirty-count"]');
    if (txt) txt.textContent = n ? `${fmt.plural(n, 'unsaved change')}` : '';
    env.setDirty?.('advanced', n > 0);
  }

  async function save(btn) {
    const updates = changes();
    const keys = Object.keys(updates);
    if (!keys.length) return;
    let firstBad = null;
    el.querySelectorAll('.st-adv-row input[name]').forEach((i) => { if (keys.includes(i.name) && !validate(i) && !firstBad) firstBad = i; });
    if (firstBad) { firstBad.focus(); toast('Fix the highlighted setting first.', { kind: 'warning', key: 'st-adv' }); return; }
    await withBusy(btn, async () => {
      try {
        const r = await settingsStore.save(updates);
        draft = null;
        items = settingsStore.current?.byKey || items;
        const restart = (r?.restart_required || []).map((k) => labelOf(items[k] || { key: k }));
        const live = (r?.live_applied || []).length;
        render();
        toast(r?.saved?.length ? `Saved ${fmt.plural(r.saved.length, 'setting')}` : 'Nothing changed', {
          kind: r?.saved?.length ? 'success' : 'info',
          key: 'st-adv',
          detail: restart.length ? `Restart the app to apply: ${restart.join(', ')}.` : live ? 'Already in effect.' : undefined,
        });
      } catch (err) {
        if (isAbort(err)) return;
        const key = err.data?.error?.field;
        const input = key ? el.querySelector(`[name="${CSS.escape(key)}"]`) : null;
        if (input) {
          // The server names the field by its .env label; the row already says which one it is.
          const serverLabel = items?.[key]?.label || '';
          let msg = err.message || 'This value was not accepted.';
          if (serverLabel && msg.startsWith(serverLabel)) msg = msg.slice(serverLabel.length).trim().replace(/^\w/, (c) => c.toUpperCase());
          setFieldError(input, msg);
          input.focus();
          toast('Nothing was saved. Fix the highlighted setting and try again.', { kind: 'error', key: 'st-adv' });
        }
        else toast(err.message || "Couldn't save settings.", { kind: 'error', key: 'st-adv' });
      }
    });
  }

  function discard() {
    draft = null;
    render();
    toast('Changes discarded', { kind: 'info', key: 'st-adv', timeoutMs: 2500 });
  }

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
  }

  const onBeforeUnload = (ev) => {
    if (el && Object.keys(changes()).length) { ev.preventDefault(); ev.returnValue = ''; }
  };

  return {
    id: 'advanced',
    label: 'Advanced',
    icon: 'settings',
    title: 'Advanced',
    desc: 'Fine-tuning for how the app runs. The defaults work well for most people.',
    mount(root) {
      el = root;
      render();
      load();
      window.addEventListener('beforeunload', onBeforeUnload);
      offs.push(() => window.removeEventListener('beforeunload', onBeforeUnload));
      offs.push(settingsStore.on((cur) => {
        // Accounts saved: keep the user's unsaved edits here; only refresh a clean form.
        const clean = !Object.keys(changes()).length;
        items = cur.byKey;
        if (el && clean) render();
        else if (el) mount(el.querySelector('[data-part="restart"]'), restartNotice());
      }));
      el.addEventListener('input', (ev) => {
        const t = ev.target;
        if (t instanceof HTMLInputElement && t.getAttribute('aria-invalid') === 'true') validate(t);
        updateDirty();
      });
      el.addEventListener('change', (ev) => {
        if (ev.target instanceof HTMLInputElement && ev.target.name) validate(ev.target);
      });
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[role="switch"], [data-st]') : null;
        if (!t || t.disabled) return;
        if (t.getAttribute('role') === 'switch') { setSwitch(t, !switchOn(t)); updateDirty(); return; }
        if (t.dataset.st === 'discard') discard();
      });
      el.addEventListener('submit', (ev) => {
        ev.preventDefault();
        save(el.querySelector('[data-st="save"]')).catch(reportError);
      });
    },
    destroy() {
      document.documentElement.style.removeProperty('--toast-lift');
      const pending = el ? changes() : {};
      draft = Object.keys(pending).length ? pending : null;
      if (draft) {
        toast('You have unsaved Advanced settings', {
          kind: 'warning',
          key: 'st-adv-draft',
          detail: 'They are kept until you save or discard them.',
          action: { label: 'Review', onClick: () => env.ctx?.router?.navigate('#/settings?section=advanced') },
        });
      }
      offs.forEach((f) => f());
      env.setDirty?.('advanced', false);
      el = null;
    },
  };
}

export default { createAdvancedSection };

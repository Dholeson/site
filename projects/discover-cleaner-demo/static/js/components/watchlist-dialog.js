// "Save to watchlist" dialog — the watchlist is the old research queue (POST /api/research).
//
//   import { openWatchlistDialog } from '../components/watchlist-dialog.js';
//   const item = await openWatchlistDialog({ entity_type: 'track', entity_id: t.id, entity_name: t.name });
//
// entity_type: 'track' | 'artist' | 'album'; entity_id: Spotify id (optional); entity_name: required.
// Optional extras: subtitle (the artist for a track or album — shown as "by X" and saved with the
// item, so one without a Spotify id can still be played and linked; any other text for an artist,
// display only) and image (art url, display only).
// Resolves to the saved item, or null when the dialog was dismissed or saving failed (a toast says why).
// Fires a window 'app:watchlist-changed' event ({detail: {item}}) after a save so open lists can refresh.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import { html, mount, icon, thumb, artistThumb, toast, openDialog, reportError, withBusy } from '../core/ui.js';

const FALLBACK_TAGS = ['interesting vocals', 'guitar tone', 'atmosphere', 'production', 'lyrics', 'emotional pull',
  'revisit later', 'artist curiosity', 'album curiosity', 'unusual structure', 'sonic texture', 'era / period',
  'live version', 'cover / rendition'];
const KIND_LABEL = { track: 'Track', artist: 'Artist', album: 'Album' };
const KIND_ICON = { track: 'music', artist: 'user', album: 'disc' };
const MAX_REASON_LEN = 60;

let seedTags = null;       // cached for the session
let seedPromise = null;

function loadSeedTags() {
  if (seedTags) return Promise.resolve(seedTags);
  if (!seedPromise) {
    seedPromise = api.get('/api/research/seed-tags', { timeoutMs: 6000 })
      .then((r) => { seedTags = Array.isArray(r?.tags) && r.tags.length ? r.tags : FALLBACK_TAGS; return seedTags; })
      .catch(() => { seedPromise = null; return FALLBACK_TAGS; });
  }
  return seedPromise;
}

const chipFor = (tag, pressed = false) => html`<button type="button" class="chip chip-lg wl-reason" data-tag="${tag}" aria-pressed="${pressed ? 'true' : 'false'}">${pressed ? icon('check') : ''}${tag}</button>`;

function renderChips(box, tags, selected) {
  const all = [...tags, ...[...selected].filter((t) => !tags.includes(t))];
  mount(box, all.map((t) => chipFor(t, selected.has(t))));
}

/**
 * Open the dialog. Returns a Promise of the saved research item (or null).
 * @param {{entity_type: 'track'|'artist'|'album', entity_id?: string, entity_name: string, subtitle?: string, image?: string}} opts
 */
export async function openWatchlistDialog({ entity_type = 'track', entity_id = null, entity_name = '', subtitle = '', image = null } = {}) {
  const type = KIND_LABEL[entity_type] ? entity_type : 'track';
  const name = String(entity_name || '').trim();
  if (!name) {
    toast("There's nothing to save — no name was given.", { kind: 'warning' });
    return null;
  }
  const selected = new Set();
  let sub = String(subtitle || '').trim();
  if (sub.toLowerCase() === KIND_LABEL[type].toLowerCase()) sub = '';   // "Artist · Artist"
  // For a track or album the subtitle is its artist: saved with the item, not just shown.
  const artistName = type !== 'artist' && sub ? sub.replace(/^by\s+/i, '').trim() : '';
  if (sub && type !== 'artist' && !/^by\s/i.test(sub)) sub = `by ${sub}`;
  // An artist without a photo gets the same initials avatar as on every other page.
  const art = type === 'artist' ? artistThumb(image, name, { size: 48 }) : thumb(image, { iconName: KIND_ICON[type], size: 48 });
  const d = openDialog({
    title: 'Save to watchlist',
    subtitle: 'Keep it on your list to dig into later.',
    className: 'wl-dialog',
    body: html`
      <div class="wl-target">
        ${art}
        <div class="wl-target-text">
          <div class="wl-target-name">${name}</div>
          <div class="wl-target-sub">${KIND_LABEL[type]}${sub ? html` · ${sub}` : ''}</div>
        </div>
      </div>
      <fieldset class="wl-fieldset">
        <legend class="field-label">What caught your ear? <span class="muted">(optional)</span></legend>
        <div class="wl-reasons" data-reasons role="group" aria-label="Reasons">${[...Array(6)].map(() => html`<span class="chip chip-lg skeleton wl-chip-skel" aria-hidden="true"></span>`)}</div>
        <div class="wl-custom">
          <input class="input wl-custom-input" type="text" maxlength="${MAX_REASON_LEN}" placeholder="Add your own reason" aria-label="Add your own reason" data-custom>
          <button type="button" class="btn btn-secondary btn-sm" data-add-reason>${icon('plus')}Add</button>
        </div>
      </fieldset>
      <label class="field wl-note-field">
        <span class="field-label">Note <span class="muted">(optional)</span></span>
        <textarea class="input wl-note" rows="3" maxlength="1000" placeholder="e.g. Check the rest of this album" data-note></textarea>
      </label>
      <p class="wl-error" role="alert" data-error hidden></p>`,
  });
  const dlg = d.el;
  const box = dlg.querySelector('[data-reasons]');
  const custom = dlg.querySelector('[data-custom]');
  const note = dlg.querySelector('[data-note]');
  const errorEl = dlg.querySelector('[data-error]');
  let tags = FALLBACK_TAGS;

  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  mount(foot, html`<span class="wl-hint muted small"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save</span>
    <button type="button" class="btn btn-ghost" data-dialog-close>Cancel</button>
    <button type="button" class="btn btn-primary" data-save>${icon('bookmark')}Save to watchlist</button>`);
  dlg.appendChild(foot);
  const saveBtn = foot.querySelector('[data-save]');
  // One Enter saves as-is; Shift+Tab reaches the note and reasons.
  saveBtn.focus();

  loadSeedTags().then((t) => { tags = t; if (dlg.isConnected) renderChips(box, tags, selected); }).catch(reportError);

  const addCustom = () => {
    const v = custom.value.trim().slice(0, MAX_REASON_LEN);
    if (!v) { custom.focus(); return; }
    selected.add(v);
    custom.value = '';
    renderChips(box, tags, selected);
    custom.focus();
  };

  dlg.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (!t) return;
    const chip = t.closest('.wl-reason');
    if (chip) {
      const tag = chip.dataset.tag;
      if (selected.has(tag)) selected.delete(tag); else selected.add(tag);
      const on = selected.has(tag);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      mount(chip, html`${on ? icon('check') : ''}${tag}`);
      return;
    }
    if (t.closest('[data-add-reason]')) { addCustom(); return; }
    if (t.closest('[data-save]')) save();
  });
  custom.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !(ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); addCustom(); }
  });
  dlg.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); save(); }
  });

  let saved = null;
  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    errorEl.hidden = true;
    const startedAt = Date.now();
    const noteText = note.value.trim();
    try {
      await withBusy(saveBtn, async () => {
        const r = await api.post('/api/research', {
          entity_type: type,
          entity_id: entity_id || undefined,
          entity_name: name,
          artist_name: artistName || undefined,
          reasons: [...selected],
          note: noteText || undefined,
        });
        let item = r?.item || null;
        // Saving something already on the list merges reasons server-side but keeps the old note.
        const existed = item && Number(item.created_at) < startedAt - 5000;
        if (item && existed && noteText && item.note !== noteText) {
          const p = await api.patch(`/api/research/${item.id}`, { note: noteText });
          item = p?.item || item;
        }
        saved = item;
        d.close('saved');
        toast(existed ? html`<strong>${name}</strong> was already on your watchlist` : html`Saved <strong>${name}</strong> to your watchlist`, {
          kind: 'success',
          icon: 'bookmark',
          detail: existed ? (selected.size || noteText ? 'Your new reasons and note were added.' : undefined) : undefined,
          action: { label: 'View', onClick: () => router.navigate('/library/watchlist') },
        });
        try { window.dispatchEvent(new CustomEvent('app:watchlist-changed', { detail: { item } })); } catch { /* ignore */ }
      });
    } catch (err) {
      if (isAbort(err)) return;
      errorEl.textContent = err?.status === 503
        ? 'The watchlist needs the local database, which is not available right now.'
        : (err?.message || "Couldn't save to your watchlist. Try again.");
      errorEl.hidden = false;
    } finally {
      saving = false;
    }
  }

  await d.done;
  return saved;
}

/**
 * saveTrackToWatchlist({id, name, artist_list | artists | artist, image}) — the dialog for a track
 * object as the player, Now and search hand it around (artist taken from whichever field exists).
 */
export function saveTrackToWatchlist(track) {
  if (!track || !track.name) return Promise.resolve(null);
  const artist = track.artist
    || (Array.isArray(track.artist_list) && track.artist_list[0]?.name)
    || String(track.artists || '').split(', ')[0] || '';
  return openWatchlistDialog({
    entity_type: 'track', entity_id: track.id || null, entity_name: track.name,
    subtitle: artist, image: track.image || null,
  });
}

export default openWatchlistDialog;

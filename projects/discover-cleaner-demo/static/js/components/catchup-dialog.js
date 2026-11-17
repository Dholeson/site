// "Catch up" dialog, shared by Now, Library → Backlog and Settings so it looks and behaves the same
// everywhere: tracks you already heard somewhere else (Spotify's recently played list, last 50
// plays) that are still in the backlog. Pick which to clear → one request per 100 → a toast with a
// bulk Undo.
//
//   const { cleared } = await openCatchUpDialog({ candidates?, button? });
//   candidates: already-fetched [{id, name, artists, image, played_at}] (skips the lookup)
//   button: the opener, marked busy while nothing is on screen yet
// Resolves to {cleared: number, entries: [recently_cleared entries]} (0 when cancelled).
import api, { isAbort } from '../core/api.js';
import store from '../core/store.js';
import { html, mount, icon, fmt, toast, openDialog, thumb, loadingState, emptyState, errorState, reportError } from '../core/ui.js';
import { markSeen } from './player.js';

const CHUNK = 100;

function backlogName() {
  const s = store.status;
  const n = s?.backlog?.name || s?.playlist_name || '';
  return n ? `“${n}”` : 'your backlog';
}

function playedWhen(ts) {
  if (!ts) return '';
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  return Number.isFinite(t) ? `played ${fmt.relTime(t)}` : '';
}

async function undoAll(entries) {
  const seqs = entries.map((e) => e?.seq).filter((x) => x != null);
  let restored = 0;
  for (const seq of seqs) {
    try {
      await api.post('/api/v2/backlog/undo', { seq: Number(seq) });
      restored += 1;
    } catch (err) {
      if (!isAbort(err) && err.status !== 409 && err.status !== 410) reportError(err);
    }
  }
  store.refreshSoon(300);
  document.dispatchEvent(new CustomEvent('app:catchup', { detail: { restored } }));
  if (restored === seqs.length) toast(`Restored ${fmt.plural(restored, 'track')} to ${backlogName()}`, { kind: 'success', icon: 'undo', key: 'catchup' });
  else toast(`Restored ${fmt.num(restored)} of ${fmt.plural(seqs.length, 'track')}. The rest can no longer be undone.`, { kind: 'warning', icon: 'undo', key: 'catchup' });
}

export async function openCatchUpDialog({ candidates: given = null, button = null } = {}) {
  const d = openDialog({
    title: 'Clear tracks you already heard',
    subtitle: `From your last 50 plays on Spotify (another device, or while this app wasn't running) that are still in ${backlogName()}.`,
    wide: true,
    className: 'cu-dialog',
    body: loadingState('Checking what you played recently…', { compact: true }),
  });
  const dlg = d.el;
  const body = d.body;
  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  dlg.appendChild(foot);
  let candidates = [];
  let result = { cleared: 0, entries: [] };
  let busy = false;

  const boxes = () => [...body.querySelectorAll('input[type="checkbox"][data-id]')];
  const selectedIds = () => boxes().filter((c) => c.checked).map((c) => c.dataset.id);

  const paintFoot = () => {
    if (!candidates.length) {
      mount(foot, html`<button type="button" class="btn btn-secondary" data-dialog-close>Close</button>`);
      return;
    }
    const n = selectedIds().length;
    mount(foot, html`<button type="button" class="btn btn-ghost" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-cu-go ${n ? '' : html`disabled`}>${icon('clear')}${n ? `Clear ${fmt.plural(n, 'track')}` : 'Pick tracks to clear'}</button>`);
  };

  const syncCount = () => {
    const all = body.querySelector('[data-cu-all]');
    const list = boxes();
    const n = list.filter((c) => c.checked).length;
    if (all) { all.checked = n === list.length; all.indeterminate = n > 0 && n < list.length; }
    const count = body.querySelector('[data-cu-count]');
    if (count) count.textContent = `${fmt.num(n)} of ${fmt.num(list.length)} selected`;
    paintFoot();
  };

  const showList = () => {
    if (!candidates.length) {
      mount(body, emptyState({
        icon: 'checkCircle',
        compact: true,
        title: "You're all caught up",
        body: `None of your last 50 plays on Spotify are still waiting in ${backlogName()}.`,
      }));
      paintFoot();
      return;
    }
    mount(body, html`
      <p class="cu-error" role="alert" hidden></p>
      <div class="cu-tools">
        <label class="check"><input type="checkbox" data-cu-all checked> <span>Select all</span></label>
        <span class="cu-count" data-cu-count aria-live="polite"></span>
      </div>
      <ul class="cu-list" role="list">
        ${candidates.map((c) => html`<li><label class="cu-item">
          <input type="checkbox" data-id="${c.id}" checked>
          ${thumb(c.image, { alt: '' })}
          <span class="cu-main"><span class="cu-title">${c.name || 'Unknown track'}</span><span class="cu-sub">${c.artists || ''}</span></span>
          <span class="cu-when">${playedWhen(c.played_at)}</span>
        </label></li>`)}
      </ul>
      <p class="cu-foot">${icon('info')}<span>Cleared tracks only leave the playlist; they stay in your history. You can undo right after.</span></p>`);
    syncCount();
  };

  async function fetchCandidates() {
    mount(body, loadingState('Checking what you played recently…', { compact: true }));
    mount(foot, html`<button type="button" class="btn btn-ghost" data-dialog-close>Cancel</button>`);
    if (button) { button.classList.add('is-busy'); button.setAttribute('aria-busy', 'true'); }
    try {
      const r = await api.get('/api/v2/backlog/catch-up', { timeoutMs: 25000 });
      if (!dlg.isConnected) return;
      candidates = (Array.isArray(r?.candidates) ? r.candidates : []).filter((c) => c && c.id);
      showList();
    } catch (err) {
      if (isAbort(err) || !dlg.isConnected) return;
      const signedOut = err.status === 401;
      mount(body, errorState(err, {
        compact: true,
        title: signedOut ? 'Connect Spotify first' : err?.isRateLimited ? 'Spotify is cooling down' : "Couldn't check your recent plays",
        body: signedOut ? 'Catch up reads your recently played list on Spotify.' : `${err.message} Nothing was cleared.`,
        retry: signedOut ? undefined : fetchCandidates,
      }));
      mount(foot, html`<button type="button" class="btn btn-secondary" data-dialog-close>Close</button>`);
    } finally {
      if (button) { button.classList.remove('is-busy'); button.removeAttribute('aria-busy'); }
    }
  }

  dlg.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.matches('[data-cu-all]')) boxes().forEach((c) => { c.checked = t.checked; });
    syncCount();
  });

  dlg.addEventListener('click', async (ev) => {
    const go = ev.target instanceof Element ? ev.target.closest('[data-cu-go]') : null;
    if (!go || go.disabled || busy) return;
    const ids = selectedIds();
    if (!ids.length) return;
    busy = true;
    go.classList.add('is-busy');
    go.setAttribute('aria-busy', 'true');
    const entries = [];
    const skipped = [];
    let failure = null;
    for (let i = 0; i < ids.length; i += CHUNK) {
      try {
        const r = await api.post('/api/v2/backlog/catch-up', { track_ids: ids.slice(i, i + CHUNK) }, { timeoutMs: 30000 });
        (Array.isArray(r?.cleared) ? r.cleared : []).forEach((e) => entries.push(e));
        (Array.isArray(r?.skipped) ? r.skipped : []).forEach((e) => skipped.push(e));
      } catch (err) {
        if (isAbort(err)) return;
        failure = err;
        break;
      }
    }
    busy = false;
    // One summary toast here; the status poll must not add one per track.
    markSeen(entries.map((e) => e?.seq));
    if (!entries.length && failure) {
      // Nothing went through: keep the dialog open with the reason, so the choice isn't lost.
      go.classList.remove('is-busy');
      go.removeAttribute('aria-busy');
      const box = body.querySelector('.cu-error');
      if (box) { box.hidden = false; mount(box, html`${icon('alertCircle')}<span>${failure.message || "Couldn't clear those tracks."} Nothing was cleared.</span>`); }
      return;
    }
    result = { cleared: entries.length, entries };
    d.close('done');
    if (entries.length) {
      toast(html`Cleared <strong>${fmt.plural(entries.length, 'track')}</strong> you'd already heard`, {
        kind: 'success',
        icon: 'checkCircle',
        key: 'catchup',
        detail: failure ? `The rest didn't go through: ${failure.message}` : skipped.length ? `${fmt.plural(skipped.length, 'track')} had already left your backlog.` : undefined,
        action: { label: 'Undo', onClick: () => undoAll(entries) },
        timeoutMs: 12000,
      });
    } else {
      toast('Those tracks were already gone from your backlog.', { kind: 'info', key: 'catchup' });
    }
    store.refreshSoon(400);
    document.dispatchEvent(new CustomEvent('app:catchup', { detail: { cleared: entries.length } }));
  });

  if (Array.isArray(given)) {
    candidates = given.filter((c) => c && c.id);
    showList();
  } else {
    fetchCandidates();
  }
  await d.done;
  return result;
}

export default openCatchUpDialog;

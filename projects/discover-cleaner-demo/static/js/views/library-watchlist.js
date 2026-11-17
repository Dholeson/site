// Library → Watchlist (GET /api/v2/watchlist, PATCH /api/research/<id>): tracks, artists and
// albums you saved to dig into later. Status tabs Active · Done · Archived (?status= in the URL),
// reason chips, inline note/reason editing, and what you did since saving ("played 3 times since").
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import {
  html, mount, icon, fmt, thumb, artistLink, artistLinks, actions, loadingState, emptyState, errorState, tabs,
  bindChoiceGroup, toast, withBusy, menu, safeUrl, infoTip, artistThumb,
} from '../core/ui.js';
import { playAlbum } from './library-shared.js';

const STATUSES = [
  { id: 'active', api: 'active', label: 'Active' },
  { id: 'done', api: 'promoted', label: 'Done' },
  { id: 'archived', api: 'archived', label: 'Archived' },
];
const KIND = { track: 'Track', artist: 'Artist', album: 'Album' };
const KIND_ICON = { track: 'music', artist: 'user', album: 'disc' };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cache = new Map();   // status id -> {items, counts, seed_tags, stats_ready, fetchedAt}
let counts = null;
let seedTags = null;

export function createWatchlistTab({ setCount }) {
  let el = null;
  let off = [];
  let ctrl = null;
  let tabsOff = null;
  let editing = null;              // item id being edited
  const st = { status: 'active', loading: false, error: null };

  const statusDef = () => STATUSES.find((s) => s.id === st.status) || STATUSES[0];

  async function load({ quiet = false } = {}) {
    if (ctrl) ctrl.abort();
    const my = new AbortController();
    ctrl = my;
    const sid = st.status;
    st.loading = true;
    st.error = null;
    if (cache.has(sid) && !quiet) el?.querySelector('[data-list]')?.classList.add('is-refetching');
    if (!cache.has(sid)) render();
    try {
      const r = await api.get('/api/v2/watchlist', { params: { status: statusDef().api }, signal: my.signal, timeoutMs: 15000 });
      cache.set(sid, { items: r?.items || [], stats_ready: !!r?.stats_ready, fetchedAt: Date.now() });
      counts = r?.counts || counts;
      seedTags = r?.seed_tags || seedTags;
      if (counts) setCount('watchlist', counts.active ?? null);
    } catch (err) {
      if (isAbort(err)) return;
      st.error = err;
    } finally {
      if (my === ctrl) {
        st.loading = false;
        el?.querySelector('[data-list]')?.classList.remove('is-refetching');
        render();
      }
    }
  }

  // ---------------------------------------------------------------- render
  function paintTabs() {
    const slot = el.querySelector('[data-status-tabs]');
    const items = STATUSES.map((s) => ({ id: s.id, label: s.label, count: counts ? counts[s.api] ?? 0 : null, controls: 'wl-list' }));
    const sig = JSON.stringify([items, st.status]);
    if (slot.dataset.sig === sig) return;
    const hadFocus = slot.contains(document.activeElement);
    slot.dataset.sig = sig;
    tabsOff?.();
    mount(slot, tabs({ items, selected: st.status, label: 'Watchlist status' }));
    tabsOff = bindChoiceGroup(slot, (v) => router.setQuery({ status: v === 'active' ? null : v }));
    if (hadFocus) slot.querySelector('[aria-selected="true"]')?.focus();
  }

  function stats(it, statsReady) {
    if (!statsReady || it.plays == null) return '';
    const parts = [];
    if (it.entity_type === 'artist') {
      parts.push(it.plays ? `${fmt.plural(it.plays, 'play')} in your history` : 'Not in your history yet');
    } else {
      parts.push(it.plays ? `Played ${fmt.plural(it.plays, 'time')}` : 'Not played yet');
    }
    if (it.plays && it.created_at) parts.push(it.plays_since_saved ? `${fmt.num(it.plays_since_saved)} since you saved it` : 'none since you saved it');
    if (it.last_played_ts) parts.push(`last ${fmt.relTime(it.last_played_ts)}`);
    return parts.join(' · ');
  }

  function itemCard(it, statsReady) {
    const kind = it.entity_type in KIND ? it.entity_type : 'track';
    const artist = kind === 'artist' ? it.entity_name : it.artist;
    const sub = kind === 'artist' ? '' : html`${it.artist_list?.length ? html`by ${artistLinks(it.artist_list)}` : artist ? html`by ${artistLink(artist)}` : ''}${it.album && kind === 'track' ? html`<span class="lib-album"> · ${it.album}</span>` : ''}`;
    const line = stats(it, statsReady);
    const isEditing = editing === it.id;
    return html`<li class="lib-wl-item${isEditing ? ' is-editing' : ''}" data-wid="${it.id}">
      <div class="lib-wl-art">${kind === 'artist' ? artistThumb(it.image, it.entity_name) : thumb(it.image, { alt: '', iconName: KIND_ICON[kind] })}</div>
      <div class="lib-wl-main">
        <div class="lib-wl-kind">${icon(KIND_ICON[kind])}${KIND[kind]}<span aria-hidden="true"> · </span><span>saved ${fmt.relTime(it.created_at)}</span>${it.in_backlog ? html`<span class="lib-tag lib-tag-accent" data-tip="This track is still in your backlog playlist">In backlog</span>` : ''}</div>
        <h3 class="lib-wl-title">${kind === 'artist' ? html`<a href="${router.href('artist', { name: it.entity_name })}">${it.entity_name}</a>` : it.entity_name}</h3>
        ${sub ? html`<div class="lib-wl-sub">${sub}</div>` : ''}
        ${isEditing ? editor(it) : html`
          ${it.reasons?.length ? html`<ul class="lib-wl-reasons" role="list" aria-label="Reasons">${it.reasons.map((r) => html`<li class="chip">${r}</li>`)}</ul>` : ''}
          ${it.note ? html`<p class="lib-wl-note">${it.note}</p>` : ''}
          ${line ? html`<p class="lib-wl-stats">${icon('clock')}<span>${line}</span></p>` : ''}`}
      </div>
      <div class="lib-wl-actions">
        ${isEditing ? '' : actionsFor(it, kind)}
      </div>
    </li>`;
  }

  function actionsFor(it, kind) {
    const play = kind === 'track' && it.uri
      ? html`<button type="button" class="btn btn-icon btn-sm" data-action="play-uri" data-uri="${it.uri}" data-name="${it.entity_name}" aria-label="Play ${it.entity_name}" data-tip="Play">${icon('play')}</button>`
      : kind === 'track' && it.artist
        ? html`<button type="button" class="btn btn-icon btn-sm" data-action="play-track" data-artist="${it.artist}" data-name="${it.entity_name}" aria-label="Play ${it.entity_name}" data-tip="Find on Spotify and play">${icon('play')}</button>`
        : kind === 'album' && it.entity_id
          ? html`<button type="button" class="btn btn-icon btn-sm" data-action="wl-play-album" data-wid="${it.id}" aria-label="Play ${it.entity_name}" data-tip="Play album">${icon('play')}</button>`
          : '';
    const main = st.status === 'active'
      ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="wl-status" data-wid="${it.id}" data-to="promoted">${icon('check')}<span>Done</span></button>`
      : html`<button type="button" class="btn btn-secondary btn-sm" data-action="wl-status" data-wid="${it.id}" data-to="active">${icon('undo')}<span>Restore</span></button>`;
    return html`${play}${main}<button type="button" class="btn btn-icon btn-sm" data-action="wl-more" data-wid="${it.id}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${it.entity_name}" data-tip="More">${icon('more')}</button>`;
  }

  function editor(it) {
    const tags = [...new Set([...(seedTags || []), ...(it.reasons || [])])];
    const chosen = new Set(it.reasons || []);
    return html`<form class="lib-wl-editor" data-editor="${it.id}">
      <fieldset class="wl-fieldset">
        <legend class="field-label">Reasons</legend>
        <div class="wl-reasons">${tags.map((t) => html`<button type="button" class="chip wl-reason" data-tag="${t}" aria-pressed="${chosen.has(t) ? 'true' : 'false'}">${chosen.has(t) ? icon('check') : ''}${t}</button>`)}</div>
      </fieldset>
      <label class="field">
        <span class="field-label">Note</span>
        <textarea class="input wl-note" rows="3" maxlength="1000" placeholder="What do you want to check?" data-note>${it.note || ''}</textarea>
      </label>
      <div class="lib-wl-editor-foot">
        <span class="muted small"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> saves · <kbd>Esc</kbd> cancels</span>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-action="wl-edit-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
      </div>
    </form>`;
  }

  function render() {
    if (!el) return;
    paintTabs();
    const listEl = el.querySelector('[data-list]');
    const data = cache.get(st.status);
    if (!data) {
      if (st.error) {
        mount(listEl, errorState(st.error, {
          title: "Couldn't load your watchlist",
          body: st.error.status === 503 ? 'The watchlist needs the local database, which is not available right now. Your plays and backlog still work.' : `${st.error.message} Everything else still works.`,
          retry: () => load(),
        }));
      } else mount(listEl, loadingState('Loading your watchlist…'));
      return;
    }
    const items = data.items;
    if (!items.length) {
      const empty = {
        active: { icon: 'eye', title: 'Nothing on your watchlist', body: 'Save a track, artist or album you want to dig into — from the player’s ⋯ menu, an artist page, or any list’s ⋯ menu. It waits here with your reasons and notes.' },
        done: { icon: 'checkCircle', title: 'Nothing marked done yet', body: 'When you’ve checked something out, press Done on it and it moves here.' },
        archived: { icon: 'inbox', title: 'No archived items', body: 'Archive things you’ve lost interest in; you can restore them any time.' },
      }[st.status];
      mount(listEl, emptyState(empty));
      return;
    }
    const focusWid = document.activeElement?.closest?.('[data-wid]')?.dataset.wid;
    const focusAction = document.activeElement?.dataset?.action;
    mount(listEl, html`<ul class="lib-wl-list" role="list">${items.map((it) => itemCard(it, data.stats_ready))}</ul>`);
    if (editing != null) {
      const ta = listEl.querySelector(`[data-editor="${editing}"] [data-note]`);
      if (ta && !listEl.contains(document.activeElement)) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    } else if (focusWid) {
      const card = listEl.querySelector(`.lib-wl-item[data-wid="${CSS.escape(focusWid)}"]`);
      (card?.querySelector(`[data-action="${focusAction}"]`) || card?.querySelector('button, a'))?.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------- mutations
  const findItem = (wid) => cache.get(st.status)?.items.find((x) => String(x.id) === String(wid));

  async function patch(id, body) {
    const r = await api.patch(`/api/research/${id}`, body, { timeoutMs: 10000 });
    return r?.item || null;
  }

  function animateOut(wid) {
    return new Promise((resolve) => {
      const card = el?.querySelector(`.lib-wl-item[data-wid="${CSS.escape(String(wid))}"]`);
      if (!card || reduceMotion()) { resolve(); return; }
      card.style.height = `${card.offsetHeight}px`;
      card.classList.add('is-leaving');
      requestAnimationFrame(() => { card.style.height = '0px'; });
      setTimeout(resolve, 220);
    });
  }

  async function moveTo(wid, to, { undoable = true } = {}) {
    const it = findItem(wid);
    if (!it) return;
    const fromApi = statusDef().api;
    const name = it.entity_name;
    try {
      await patch(it.id, { status: to });
    } catch (err) {
      toast(err.message || "Couldn't update that item.", { kind: 'error' });
      return;
    }
    const idx = cache.get(st.status).items.indexOf(it);
    await animateOut(wid);
    const data = cache.get(st.status);
    if (data) data.items = data.items.filter((x) => x !== it);
    cache.delete(STATUSES.find((s) => s.api === to)?.id);
    if (counts) { counts[fromApi] = Math.max(0, (counts[fromApi] || 0) - 1); counts[to] = (counts[to] || 0) + 1; setCount('watchlist', counts.active); }
    render();
    const nextCard = el?.querySelectorAll('.lib-wl-item')[Math.min(idx, (data?.items.length || 1) - 1)];
    nextCard?.querySelector('[data-action="wl-status"]')?.focus({ preventScroll: true });
    if (!undoable) return;
    const verb = to === 'promoted' ? 'Marked done' : to === 'archived' ? 'Archived' : 'Restored';
    toast(html`${verb}: <strong>${name}</strong>`, {
      kind: 'success',
      icon: to === 'archived' ? 'inbox' : to === 'promoted' ? 'checkCircle' : 'undo',
      key: `wl:${it.id}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await patch(it.id, { status: fromApi });
            cache.delete(STATUSES.find((s) => s.api === to)?.id);
            if (counts) { counts[to] = Math.max(0, (counts[to] || 0) - 1); counts[fromApi] = (counts[fromApi] || 0) + 1; setCount('watchlist', counts.active); }
            if (el && statusDef().api === fromApi) load({ quiet: true }); else cache.delete(STATUSES.find((s) => s.api === fromApi)?.id);
            toast(html`Moved <strong>${name}</strong> back`, { kind: 'info', key: `wl:${it.id}` });
          } catch (err) {
            toast(err.message || "Couldn't undo that.", { kind: 'error' });
          }
        },
      },
    });
  }

  async function saveEdit(form) {
    const it = findItem(form.dataset.editor);
    if (!it) return;
    const reasons = [...form.querySelectorAll('.wl-reason[aria-pressed="true"]')].map((b) => b.dataset.tag);
    const note = form.querySelector('[data-note]').value;
    const btn = form.querySelector('[type="submit"]');
    try {
      const updated = await withBusy(btn, () => patch(it.id, { reasons, note }));
      Object.assign(it, { reasons: updated?.reasons ?? reasons, note: updated ? updated.note : (note.trim() || null) });
      editing = null;
      render();
      el.querySelector(`.lib-wl-item[data-wid="${it.id}"] [data-action="wl-more"]`)?.focus({ preventScroll: true });
      toast('Saved your changes', { kind: 'success', timeoutMs: 2500, key: `wl:${it.id}` });
    } catch (err) {
      toast(err.message || "Couldn't save your changes.", { kind: 'error' });
    }
  }

  function openMore(btn, wid) {
    const it = findItem(wid);
    if (!it) return;
    const kind = it.entity_type;
    const items = [
      { label: it.note || it.reasons?.length ? 'Edit reasons and note' : 'Add reasons or a note', icon: 'keep', onSelect: () => { editing = it.id; render(); } },
    ];
    const artist = kind === 'artist' ? it.entity_name : it.artist;
    if (artist) items.push({ label: `Open ${artist}`, icon: 'artists', href: router.href('artist', { name: artist }) });
    if (st.status === 'active') items.push({ label: 'Archive', icon: 'inbox', onSelect: () => moveTo(it.id, 'archived') });
    else if (st.status === 'done') items.push({ label: 'Archive', icon: 'inbox', onSelect: () => moveTo(it.id, 'archived') });
    else items.push({ label: 'Mark done', icon: 'check', onSelect: () => moveTo(it.id, 'promoted') });
    const url = safeUrl(it.url || (it.entity_id ? `https://open.spotify.com/${kind === 'artist' ? 'artist' : kind}/${it.entity_id}` : ''), '');
    if (url && /^https:/i.test(url)) items.push({ separator: true }, { label: 'Open in Spotify', icon: 'external', href: url, external: true });
    menu(btn, items, { label: `More actions for ${it.entity_name}` });
  }

  function wire() {
    off.push(actions(el, {
      'wl-status': (ds, btn) => withBusy(btn, () => moveTo(ds.wid, ds.to)),
      'wl-more': (ds, btn) => openMore(btn, ds.wid),
      'wl-play-album': (ds) => { const it = findItem(ds.wid); if (it) return playAlbum({ id: it.entity_id, name: it.entity_name, artist: it.artist }); return undefined; },
      'wl-edit-cancel': () => { const wid = editing; editing = null; render(); el.querySelector(`.lib-wl-item[data-wid="${wid}"] [data-action="wl-more"]`)?.focus({ preventScroll: true }); },
    }));
    const onClick = (ev) => {
      const chip = ev.target instanceof Element ? ev.target.closest('.lib-wl-editor .wl-reason') : null;
      if (!chip) return;
      const on = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      mount(chip, html`${on ? icon('check') : ''}${chip.dataset.tag}`);
    };
    const onSubmit = (ev) => {
      const form = ev.target instanceof Element ? ev.target.closest('[data-editor]') : null;
      if (!form) return;
      ev.preventDefault();
      saveEdit(form);
    };
    const onKey = (ev) => {
      const form = ev.target instanceof Element ? ev.target.closest('[data-editor]') : null;
      if (!form) return;
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); saveEdit(form); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); const wid = editing; editing = null; render(); el.querySelector(`.lib-wl-item[data-wid="${wid}"] [data-action="wl-more"]`)?.focus({ preventScroll: true }); }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('submit', onSubmit);
    el.addEventListener('keydown', onKey);
    const onChanged = () => { cache.clear(); load({ quiet: true }); };
    window.addEventListener('app:watchlist-changed', onChanged);
    off.push(() => {
      el?.removeEventListener('click', onClick);
      el?.removeEventListener('submit', onSubmit);
      el?.removeEventListener('keydown', onKey);
      window.removeEventListener('app:watchlist-changed', onChanged);
    });
  }

  const statusFrom = (params) => (STATUSES.some((s) => s.id === params?.status) ? params.status : 'active');

  return {
    mount(container, params) {
      el = container;
      st.status = statusFrom(params);
      mount(el, html`
        <div class="lib-toolbar lib-wl-toolbar">
          <div data-status-tabs class="lib-wl-tabs"></div>
          <p class="lib-summary">Things you saved to dig into later ${infoTip('Your watchlist (the old research queue). “Played … since you saved it” counts plays of that song or artist in your history after the day you saved it.', { label: 'Watchlist' })}</p>
        </div>
        <div class="lib-body" data-list id="wl-list" role="tabpanel" aria-label="Watchlist items"></div>`);
      wire();
      render();
      load({ quiet: cache.has(st.status) });
    },
    update(params) {
      const s = statusFrom(params);
      if (s === st.status) return;
      st.status = s;
      editing = null;
      render();
      load({ quiet: cache.has(s) });
    },
    unmount() {
      if (ctrl) ctrl.abort();
      tabsOff?.();
      off.forEach((fn) => fn());
      off = [];
      el = null;
      editing = null;
    },
  };
}

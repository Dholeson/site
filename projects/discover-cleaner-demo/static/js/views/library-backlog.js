// Library → Backlog (GET /api/v2/backlog/tracks): every track still waiting in the backlog
// playlist, server-side search, 100 per page. Clear a row (POST /api/v2/backlog/clear, skip:false)
// and it slides out with an Undo toast; the playing track is pinned on top with what will happen
// to it. Auto-clear switch and "Catch up" live in the header card.
import { api, isAbort } from '../core/api.js';
import router from '../core/router.js';
import store from '../core/store.js';
import {
  html, mount, icon, fmt, thumb, artistLinks, debounce, actions, loadingState, emptyState, errorState,
  infoTip, meter, toast, withBusy, notice,
} from '../core/ui.js';
import { announceCleared, keep as keepCurrent, clearNow as clearCurrent } from '../components/player.js';
import { openCatchUpDialog } from '../components/catchup-dialog.js';
import { playButton, moreButton, openTrackMenu, searchBox, captureFocus, restoreFocus, keepScrollAnchor } from './library-shared.js';

const PAGE = 100;
const REFRESH_CAP = 500;
const IN_BACKLOG = new Set(['in_backlog', 'kept', 'clearing_paused', 'queued']);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createBacklogTab() {
  let el = null;
  let rowsEl = null;
  let off = [];
  let ctrl = null;
  let seq = 0;
  let status = null;
  let ticker = null;
  let refreshTimer = null;
  let lastRemovalSeq = null;
  let lastTotal = null;
  let quietUntil = 0;              // our own clears bump removal_seq; don't refetch right away
  const pending = new Set();
  const st = { q: '', items: [], matched: 0, total: null, complete: true, loading: false, name: '', pid: null, loaded: false, error: null, fetching: false };

  // ---------------------------------------------------------------- data
  async function load({ reset = false, soft = false } = {}) {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const mySeq = ++seq;
    st.fetching = true;
    if (!soft) st.error = null;
    if (reset && st.loaded && !soft) rowsEl?.classList.add('is-refetching');
    paintMore();
    const offset = reset ? 0 : st.items.length;
    const limit = soft ? Math.min(REFRESH_CAP, Math.max(PAGE, st.items.length)) : PAGE;
    try {
      const r = await api.get('/api/v2/backlog/tracks', { params: { offset, limit, q: st.q || undefined }, signal: ctrl.signal, timeoutMs: 15000 });
      if (mySeq !== seq) return;
      const items = Array.isArray(r?.items) ? r.items : [];
      st.items = reset ? items : [...st.items, ...items.filter((it) => !st.items.some((x) => x.id === it.id && x.position === it.position))];
      Object.assign(st, { matched: r?.matched ?? items.length, total: r?.total ?? null, complete: r?.complete !== false, loading: !!r?.loading, name: r?.name || '', pid: r?.playlist_id || null, loaded: true, error: null });
    } catch (err) {
      if (isAbort(err) || mySeq !== seq) return;
      if (!soft) { st.error = err; if (reset) st.items = []; }
    } finally {
      if (mySeq === seq) {
        st.fetching = false;
        rowsEl?.classList.remove('is-refetching');
        if (soft && rowsEl) keepScrollAnchor(rowsEl, render); else render();
      }
    }
  }

  function scheduleRefresh(ms = 1000) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!el) return;
      const wait = quietUntil - Date.now();
      if (pending.size || wait > 0 || st.fetching) { scheduleRefresh(Math.max(600, wait)); return; }
      load({ reset: true, soft: true });
    }, ms);
  }

  // ---------------------------------------------------------------- render
  const currentId = () => status?.current_track?.id || null;

  function row(it) {
    const isCur = it.id && it.id === currentId();
    const artists = it.artist_list?.length ? it.artist_list : it.artists;
    const added = it.added_at ? fmt.date(it.added_at) : '—';
    return html`<div class="list-row lib-row lib-bl-row${isCur ? ' is-current' : ''}" role="listitem" data-key="${it.id || `pos${it.position}`}" data-id="${it.id || ''}">
      <span class="lib-pos num">${isCur ? html`<span class="lib-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">Playing now, </span>` : fmt.num((it.position ?? 0) + 1)}</span>
      ${thumb(it.image, { alt: '' })}
      <div class="row-main">
        <div class="row-title">${it.name || 'Unknown track'}</div>
        <div class="row-sub">${artistLinks(artists)}${it.album ? html`<span class="lib-album-inline"> · ${it.album}</span>` : ''}</div>
      </div>
      <span class="lib-bl-album truncate">${it.album || ''}</span>
      <span class="lib-bl-added" ${it.added_at ? html`data-tip="Added ${fmt.date(it.added_at, { year: 'always' })}"` : ''}>${added}</span>
      <span class="lib-bl-dur num">${it.duration_ms ? fmt.clock(it.duration_ms) : ''}</span>
      <div class="row-actions">
        ${it.uri || it.id ? playButton({ uri: it.uri, id: it.id, name: it.name, label: `Play ${it.name} (continues through your backlog)` }) : html`<span class="row-action-slot" aria-hidden="true"></span>`}
        ${it.id ? html`<button type="button" class="btn btn-secondary btn-sm lib-clear-btn" data-action="bl-clear" data-id="${it.id}" aria-label="Clear ${it.name} from your backlog">${icon('clear')}<span class="lib-clear-label">Clear</span></button>` : ''}
        ${moreButton(`More actions for ${it.name}`, { id: it.id || '', key: it.id || `pos${it.position}` })}
      </div>
    </div>`;
  }

  function render() {
    if (!el) return;
    paintHero();
    paintCurrent();
    paintNotice();
    paintSummary();
    paintMore();
    const saved = captureFocus(rowsEl);
    const table = el.querySelector('[data-table]');
    if (!st.loaded && !st.error) { mount(rowsEl, loadingState('Loading your backlog…')); table.classList.remove('has-rows'); return; }
    if (st.error && !st.items.length) {
      mount(rowsEl, errorState(st.error, { title: "Couldn't load your backlog", body: `${st.error.message} Clearing while you listen keeps working.`, retry: () => load({ reset: true }) }));
      table.classList.remove('has-rows');
      return;
    }
    if (!st.items.length) {
      table.classList.remove('has-rows');
      if (!st.pid) {
        mount(rowsEl, emptyState({ icon: 'backlog', title: 'No backlog playlist chosen', body: 'Pick the playlist you want to listen through in Settings. Tracks clear from it as you hear them.', action: { label: 'Choose a playlist', href: '#/settings?section=backlog' } }));
      } else if (st.q) {
        mount(rowsEl, emptyState({ icon: 'search', title: `Nothing in your backlog matches “${st.q}”`, body: 'Search looks at track, artist and album names.', action: { label: 'Clear search', action: 'bl-clear-search' } }));
      } else if (st.loading || !st.complete) {
        mount(rowsEl, loadingState('Loading your backlog from Spotify…'));
      } else {
        mount(rowsEl, html`<div class="lib-celebrate">${emptyState({ icon: 'sparkle', title: 'Backlog cleared!', body: `You've heard every track in “${st.name || 'your backlog'}”. New tracks added to the playlist will show up here.` })}</div>`);
      }
      return;
    }
    table.classList.add('has-rows');
    mount(rowsEl, st.items.map(row));
    restoreFocus(rowsEl, saved);
  }

  function paintHero() {
    const hero = el.querySelector('[data-hero]');
    if (!hero) return;
    const b = status?.backlog || {};
    const total = Number.isFinite(Number(b.total)) ? Number(b.total) : st.total;
    const name = b.name || st.name || status?.playlist_name || 'your backlog';
    const threshold = Number(status?.threshold_seconds) || null;
    const auto = status?.auto_clean ? !!status.auto_clean.enabled : true;
    const today = status?.today || {};
    const syncing = !!b.playlist_id && (b.loading || b.complete === false);   // no playlist chosen: nothing to load
    const progress = b.progress || {};
    let syncText;
    if (syncing) syncText = `Loading from Spotify · ${fmt.num(progress.loaded ?? b.known ?? 0)} of ${fmt.num(progress.total ?? total ?? 0)}`;
    else if (b.synced_at_ms) syncText = `Checked with Spotify ${fmt.relTime(b.synced_at_ms)}`;
    else syncText = '';
    const hours = Number(b.duration_ms) > 0 ? `≈ ${fmt.hours(Number(b.duration_ms) / 1000)} of music` : '';
    const sig = JSON.stringify([total, name, threshold, auto, today.cleared_today, today.cleared_7d, syncText, hours, !!b.playlist_id]);
    if (hero.dataset.sig === sig) return;
    hero.dataset.sig = sig;
    const def = `Tracks still in your backlog playlist. A track is cleared (removed from the playlist) once you've listened to it for ${threshold || 'N'} seconds with the app running, or when you clear it yourself.`;
    mount(hero, html`
      <div class="lib-bl-main">
        <div class="lib-bl-label"><span>Tracks left in <strong>${name}</strong></span>${infoTip(def, { label: 'Tracks left' })}</div>
        <div class="hero-figure num" data-total>${total == null ? '—' : fmt.num(total)}</div>
        <div class="lib-bl-sub">${[hours, syncText].filter(Boolean).join(' · ')}</div>
      </div>
      <dl class="lib-bl-stats">
        <div class="lib-mini"><dt>Cleared today ${infoTip('Tracks removed from your backlog today: auto-cleared after listening, cleared by hand, liked, or caught up.', { label: 'Cleared today' })}</dt><dd class="num">${fmt.num(today.cleared_today ?? null)}</dd></div>
        <div class="lib-mini"><dt>Last 7 days ${infoTip('Tracks removed from your backlog in the last 7 days, including today.', { label: 'Last 7 days' })}</dt><dd class="num">${fmt.num(today.cleared_7d ?? null)}</dd></div>
      </dl>
      <div class="lib-bl-side">
        <button type="button" class="lib-switch" role="switch" aria-checked="${auto ? 'true' : 'false'}" data-action="bl-autoclear" aria-describedby="bl-ac-text">
          <span class="lib-switch-track" aria-hidden="true"><span class="lib-switch-thumb"></span></span><span class="lib-switch-label">Auto-clear</span>
        </button>
        <p class="lib-bl-ac" id="bl-ac-text">${auto ? `Tracks clear after ${threshold || '—'} s of listening.` : 'Paused — nothing is cleared automatically.'}</p>
        <button type="button" class="btn btn-secondary btn-sm" data-action="bl-catchup" ${b.playlist_id || st.pid ? '' : html`disabled`}>${icon('refresh')}Catch up…</button>
      </div>`);
  }

  function fateLine(f, t) {
    const thr = Math.round(Number(f?.effective_threshold_s || status?.threshold_seconds || 0));
    switch (f?.state) {
      case 'in_backlog': {
        const left = remainingS(f);
        return { tone: 'warn', icon: 'clock', text: left > 0 ? html`Clears in <strong class="num" data-left>${fmt.num(Math.ceil(left))} s</strong> — after ${thr} s of listening` : html`Clearing now…` };
      }
      case 'kept': return { tone: 'info', icon: 'keep', text: 'Kept — it stays in your backlog this time' };
      case 'clearing_paused': return { tone: 'muted', icon: 'pauseCircle', text: 'Auto-clear is paused — it stays until you clear it' };
      case 'queued': return { tone: 'muted', icon: 'hourglass', text: 'Couldn’t clear yet (Spotify busy) — retrying automatically' };
      case 'cleared': return { tone: 'good', icon: 'checkCircle', text: 'Cleared from your backlog' };
      default: return null;
    }
  }

  function remainingS(f) {
    const base = Number(f?.clears_in_s);
    if (!Number.isFinite(base)) return 0;
    return status?.is_playing ? Math.max(0, base - store.sinceObserved() / 1000) : base;
  }

  function paintCurrent() {
    const slot = el.querySelector('[data-current]');
    if (!slot) return;
    const t = status?.current_track;
    const f = status?.current_fate;
    const show = t && f && f.track_id === t.id && (IN_BACKLOG.has(f.state) || f.state === 'cleared');
    if (!show) { slot.dataset.sig = ''; if (slot.firstChild) keepScrollAnchor(rowsEl, () => mount(slot, '')); syncTicker(false); return; }
    const entry = f.state === 'cleared' ? (status.recently_cleared || []).find((e) => e && e.track_id === t.id && !e.undone) : null;
    const line = fateLine(f, t);
    const sig = JSON.stringify([t.id, f.state, entry?.seq, !!status.is_playing, f.state === 'in_backlog' ? null : 0]);
    if (slot.dataset.sig !== sig) {
      slot.dataset.sig = sig;
      const artists = t.artist_list?.length ? t.artist_list : t.artists;
      keepScrollAnchor(rowsEl, () => mount(slot, html`<section class="lib-current" aria-label="Playing now from your backlog">
        ${thumb(t.image, { alt: '' })}
        <div class="lib-current-main">
          <div class="lib-current-eyebrow">${status.is_playing ? html`<span class="lib-eq" aria-hidden="true"><i></i><i></i><i></i></span>Playing now` : 'Paused'}${f.state === 'cleared' ? '' : ' · in your backlog'}</div>
          <div class="lib-current-title truncate">${t.name}</div>
          <div class="lib-current-sub truncate">${artistLinks(artists)}</div>
          <div class="lib-fate" data-tone="${line?.tone || 'muted'}">${line ? html`${icon(line.icon)}<span data-fate-text>${line.text}</span>` : ''}</div>
        </div>
        <div class="lib-current-actions">
          ${f.state === 'cleared'
            ? (entry ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="undo-clear" data-seq="${entry.seq}">${icon('undo')}Undo</button>` : '')
            : html`${f.state === 'in_backlog' || f.state === 'kept' ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="bl-keep" aria-pressed="${f.state === 'kept' ? 'true' : 'false'}">${icon('keep')}${f.state === 'kept' ? 'Kept' : 'Keep'}</button>` : ''}
              <button type="button" class="btn btn-secondary btn-sm" data-action="bl-clear-current">${icon('clear')}Clear now</button>`}
        </div>
      </section>`));
    } else if (f.state === 'in_backlog') {
      const txt = slot.querySelector('[data-fate-text]');
      if (txt && line) mount(txt, line.text);
    }
    syncTicker(f.state === 'in_backlog' && !!status.is_playing);
  }

  function syncTicker(on) {
    if (on && !ticker) {
      ticker = setInterval(() => {
        const f = status?.current_fate;
        const left = el?.querySelector('[data-left]');
        if (!left || f?.state !== 'in_backlog') return;
        const s = remainingS(f);
        const txt = s > 0 ? `${fmt.num(Math.ceil(s))} s` : '0 s';
        if (left.textContent !== txt) left.textContent = txt;
      }, 500);
    } else if (!on && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function paintNotice() {
    const slot = el.querySelector('[data-notice]');
    if (!slot) return;
    const b = status?.backlog || {};
    const syncing = (b.loading || b.complete === false) && b.playlist_id;
    if (!syncing) { mount(slot, ''); return; }
    const p = b.progress || {};
    const loaded = p.loaded ?? b.known ?? 0;
    const total = p.total ?? b.total ?? 0;
    mount(slot, notice({
      tone: 'info', icon: 'hourglass', className: 'lib-notice',
      title: 'Still loading your backlog from Spotify',
      body: html`The list fills in as it loads; nothing is cleared until it finishes.
        ${total ? meter({ value: loaded, max: total, label: 'Tracks loaded', valueLabel: `${fmt.num(loaded)} of ${fmt.num(total)}` }) : ''}`,
    }));
  }

  function paintSummary() {
    const s = el.querySelector('[data-summary]');
    if (!s) return;
    let text = '';
    if (st.loaded && !st.error) {
      if (st.q) text = `${fmt.num(st.matched)} of ${fmt.plural(st.total ?? st.matched, 'track')} match`;
      else if (st.items.length) text = `Showing ${fmt.num(st.items.length)} of ${fmt.plural(st.matched, 'track')}`;
    }
    if (s.textContent !== text) s.textContent = text;
  }

  function paintMore() {
    const more = el?.querySelector('[data-more]');
    if (!more) return;
    const remaining = st.matched - st.items.length;
    if (st.items.length && remaining > 0) {
      mount(more, html`<button type="button" class="btn btn-secondary ${st.fetching ? 'is-busy' : ''}" data-action="bl-more" aria-busy="${st.fetching ? 'true' : 'false'}">${icon('chevronDown')}Show ${fmt.num(Math.min(PAGE, remaining))} more</button>`);
    } else mount(more, '');
  }

  function markCurrentRows() {
    const cur = currentId();
    rowsEl?.querySelectorAll('.lib-bl-row').forEach((r) => {
      const isCur = !!cur && r.dataset.id === cur;
      if (r.classList.contains('is-current') !== isCur) {
        const it = st.items.find((x) => x.id === r.dataset.id);
        if (it) {
          const tmp = document.createElement('div');
          mount(tmp, row(it));
          r.replaceWith(tmp.firstElementChild);
        }
      }
    });
  }

  // ---------------------------------------------------------------- actions
  async function clearTrack(id, btn) {
    if (!id || pending.has(id)) return;
    const it = st.items.find((x) => x.id === id);
    const rowEl = rowsEl.querySelector(`.lib-bl-row[data-id="${CSS.escape(id)}"]`);
    pending.add(id);
    quietUntil = Date.now() + 2500;
    rowEl?.classList.add('is-clearing');
    try {
      const r = await withBusy(btn, () => api.post('/api/v2/backlog/clear', { track_id: id, skip: false }, { timeoutMs: 20000 }));
      removeRow(id, rowEl);
      announceCleared(r?.cleared || { track_id: id, name: it?.name, reason: 'manual', undone: true });
      store.refreshSoon(400);
    } catch (err) {
      rowEl?.classList.remove('is-clearing');
      if (isAbort(err)) return;
      if (err.status === 404 && err.code === 'not_in_backlog') {
        removeRow(id, rowEl);
        toast(`“${it?.name || 'That track'}” had already left your backlog.`, { kind: 'info' });
      } else if (err.status === 503 && err.data?.error?.queued) {
        rowEl?.classList.add('is-queued');
        toast(err.message || 'Spotify is busy; the clear is queued.', { kind: 'warning', icon: 'hourglass' });
      } else {
        toast(err.message || "Couldn't clear that track.", { kind: err.status === 409 || err.isRateLimited ? 'warning' : 'error' });
      }
    } finally {
      pending.delete(id);
    }
  }

  function removeRow(id, rowEl) {
    const idx = st.items.findIndex((x) => x.id === id);
    const hadFocus = rowEl && rowEl.contains(document.activeElement);
    const finish = () => {
      if (idx >= 0) {
        const pos = st.items[idx].position;
        st.items.splice(idx, 1);
        st.items.forEach((x) => { if (x.position > pos) x.position -= 1; });
      }
      st.matched = Math.max(0, st.matched - 1);
      if (st.total != null) st.total = Math.max(0, st.total - 1);
      if (!el) return;
      if (!st.items.length) { render(); return; }
      rowEl?.remove();
      // Positions after the removed row moved up by one.
      rowsEl.querySelectorAll('.lib-bl-row').forEach((r) => {
        const x = st.items.find((i) => i.id === r.dataset.id);
        const p = r.querySelector('.lib-pos');
        if (x && p && !r.classList.contains('is-current')) p.textContent = fmt.num(x.position + 1);
      });
      paintSummary();
      paintMore();
      if (hadFocus) {
        const next = rowsEl.querySelectorAll('.lib-bl-row')[Math.min(idx, st.items.length - 1)];
        (next?.querySelector('[data-action="bl-clear"]') || next?.querySelector('button'))?.focus({ preventScroll: false });
      }
    };
    if (!rowEl || reduceMotion()) { finish(); return; }
    rowEl.style.height = `${rowEl.offsetHeight}px`;
    rowEl.classList.add('is-leaving');
    requestAnimationFrame(() => { rowEl.style.height = '0px'; });
    setTimeout(finish, 220);
  }

  async function toggleAutoClear(btn) {
    const now = status?.auto_clean ? !!status.auto_clean.enabled : true;
    const next = !now;
    btn.setAttribute('aria-checked', next ? 'true' : 'false');
    store.patch({ auto_clean: { enabled: next } });
    try {
      const r = await api.post('/api/v2/backlog/auto-clean', { enabled: next });
      const on = r?.enabled ?? next;
      store.patch({ auto_clean: { enabled: on } });
      toast(on ? 'Auto-clear is on — tracks clear as you listen' : 'Auto-clear paused — nothing is cleared until you turn it back on', { kind: on ? 'success' : 'info', icon: on ? 'checkCircle' : 'pauseCircle', key: 'auto-clean' });
      store.refreshSoon(300);
    } catch (err) {
      store.patch({ auto_clean: { enabled: now } });
      toast(err.message || "Couldn't change auto-clear.", { kind: 'error' });
    }
  }

  const pushSearch = debounce((q) => router.setQuery({ q: q || null }), 250);

  function wire() {
    off.push(actions(el, {
      'bl-clear': (ds, btn) => clearTrack(ds.id, btn),
      'bl-more': (ds, btn) => withBusy(btn, () => load()),
      'bl-clear-search': () => { const i = el.querySelector('.lib-search-input'); if (i) i.value = ''; router.setQuery({ q: null }); },
      'bl-autoclear': (ds, btn) => toggleAutoClear(btn),
      'bl-catchup': async () => { const { cleared } = await openCatchUpDialog(); if (cleared) { quietUntil = 0; scheduleRefresh(500); } },
      'bl-keep': () => keepCurrent(),
      'bl-clear-current': () => clearCurrent(),
      'lib-more': (ds, btn) => {
        const it = st.items.find((x) => (x.id || `pos${x.position}`) === ds.key);
        if (!it) return;
        const primary = it.artist_list?.[0]?.name || (it.artists || '').split(', ')[0];
        const extra = (it.artist_list || []).slice(1, 4).filter((a) => a?.name).map((a) => ({ label: `Open ${a.name}`, icon: 'artists', href: router.href('artist', { name: a.name }) }));
        openTrackMenu(btn, { id: it.id, name: it.name, artist: primary, image: it.image }, { extra });
      },
    }));
    const input = el.querySelector('.lib-search-input');
    const onInput = () => pushSearch(input.value.trim());
    const onKey = (ev) => { if (ev.key === 'Escape' && input.value) { ev.stopPropagation(); input.value = ''; pushSearch.cancel(); router.setQuery({ q: null }); } };
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKey);
    off.push(() => { input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey); pushSearch.cancel(); });
  }

  return {
    mount(container, params) {
      el = container;
      st.q = (params?.q || '').trim();
      mount(el, html`
        <section class="card lib-bl-hero" data-hero aria-label="Backlog summary"></section>
        <div data-current></div>
        <div data-notice></div>
        <div class="lib-toolbar">
          ${searchBox({ value: st.q, placeholder: 'Search your backlog', label: 'Search your backlog by track, artist or album' })}
          <p class="lib-summary" data-summary aria-live="polite"></p>
        </div>
        <div class="lib-bl-table" data-table>
          <div class="lib-bl-head" aria-hidden="true"><span class="num">#</span><span></span><span>Title</span><span>Album</span><span>Added</span><span class="lib-bl-dur">${icon('clock')}</span><span></span></div>
          <div class="list lib-list" role="list" aria-label="Backlog tracks" data-rows></div>
        </div>
        <div class="lib-more" data-more></div>`);
      rowsEl = el.querySelector('[data-rows]');
      wire();
      render();
      load({ reset: true });
    },
    update(params) {
      const q = (params?.q || '').trim();
      if (q === st.q) return;
      st.q = q;
      const input = el?.querySelector('.lib-search-input');
      if (input && document.activeElement !== input) input.value = q;
      load({ reset: true });
    },
    onStatus(s, info = {}) {
      status = s;
      if (!el) return;
      const changed = info.changed || new Set();
      if (info.initial || ['backlog', 'auto_clean', 'threshold_seconds', 'today', 'playlist_name'].some((k) => changed.has(k))) paintHero();
      if (info.initial || ['current_track', 'current_fate', 'is_playing', 'recently_cleared', 'progress_ms'].some((k) => changed.has(k))) paintCurrent();
      if (info.initial || changed.has('backlog')) paintNotice();
      if (changed.has('current_track')) markCurrentRows();
      const b = s?.backlog || {};
      const rseq = b.removal_seq ?? null;
      const total = b.total ?? null;
      if (!info.initial && st.loaded && ((lastRemovalSeq != null && rseq !== lastRemovalSeq) || (lastTotal != null && total !== lastTotal))) scheduleRefresh();
      lastRemovalSeq = rseq;
      lastTotal = total;
    },
    unmount() {
      clearTimeout(refreshTimer);
      syncTicker(false);
      if (ctrl) ctrl.abort();
      off.forEach((fn) => fn());
      off = [];
      el = null;
      rowsEl = null;
    },
  };
}

// Styleguide (#/styleguide, not in the nav): every shared component in one place, for review and
// for wave-2 view authors to copy from. The CHARTS section is filled by core/charts.js
// (chartsDemo / window.__chartsDemo) when that module is available.
import {
  html, mount, icon, fmt, pageHeader, sectionHeader, statTile, meter, infoTip, tabs, segmented, bindChoiceGroup,
  trackRow, loadingState, emptyState, errorState, toast, confirmDialog, openDialog, menu, popover,
  actions, artistLink, thumb,
} from '../core/ui.js';
import { ApiError } from '../core/api.js';

const SWATCHES = [
  ['Surfaces', ['--page', '--surface-1', '--surface-2', '--surface-3', '--surface-4']],
  ['Text', ['--text', '--text-2', '--muted']],
  ['Brand and status', ['--accent', '--good', '--warning', '--serious', '--critical']],
  ['Chart series (fixed order)', ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8']],
];

const TYPE = [
  ['48', 'Hero figure', 'hero-figure'],
  ['32', 'Page title', 'sg-t32'],
  ['24', 'Large heading', 'sg-t24'],
  ['20', 'Section title', 'sg-t20'],
  ['16', 'Card title', 'sg-t16'],
  ['14', 'Body text', 'sg-t14'],
  ['13', 'Secondary text', 'sg-t13'],
  ['12', 'Captions and axis labels', 'sg-t12'],
];

const SAMPLE_TRACKS = [
  { rank: 1, name: 'Purple Reign', artist_list: [{ name: 'Dance Gavin Dance' }], album: 'Mothership', meta: fmt.plural(374, 'play'), uri: 'spotify:track:demo1' },
  { rank: 2, name: 'Chokehold', artist_list: [{ name: 'Sleep Token' }], album: 'Take Me Back to Eden', meta: fmt.plural(121, 'play'), uri: 'spotify:track:demo2' },
  { rank: 3, name: 'Earfquake', artist_list: [{ name: 'Tyler, The Creator' }], album: 'IGOR', meta: fmt.plural(37, 'play') },
  { rank: 4, name: 'A title long enough that it has to truncate cleanly instead of wrapping onto a second line', artist_list: [{ name: 'Woe, Is Me' }, { name: 'Andrés' }], album: 'Number[s]', meta: fmt.plural(1, 'play') },
];

function section(id, title, desc, body) {
  return html`<section class="section sg-section" id="sg-${id}" aria-labelledby="sg-${id}-h">
    ${sectionHeader({ title, desc, id: `sg-${id}-h` })}
    ${body}
  </section>`;
}

function markup() {
  return html`
    ${pageHeader({
      eyebrow: 'Design system',
      title: 'Styleguide',
      desc: 'Every shared component in one place. Views build from these; nothing here talks to the server.',
      actions: html`<a class="btn btn-secondary btn-sm" href="#/now">${icon('chevronLeft')}Back to Now</a>`,
    })}

    <nav class="sg-toc" aria-label="Styleguide sections">
      ${['Colors', 'Type', 'Buttons', 'Chips', 'Tabs', 'Stat tiles', 'Meters', 'Lists', 'Table', 'States', 'Feedback', 'Forms', 'Charts'].map((t) => html`<a class="chip" href="#/styleguide" data-action="jump" data-target="sg-${t.toLowerCase().replace(/\s+/g, '-')}">${t}</a>`)}
    </nav>

    ${section('colors', 'Colors', 'Tokens from static/css/tokens.css. Status colors always come with an icon and a label.', html`
      <div class="sg-swatch-groups">${SWATCHES.map(([label, vars]) => html`<div class="sg-swatch-group"><h3 class="sg-h3">${label}</h3><div class="sg-swatches">${vars.map((v) => html`<div class="sg-swatch"><span class="sg-chip" data-var="${v}"></span><code>${v}</code></div>`)}</div></div>`)}</div>`)}

    ${section('type', 'Type', 'One sans family. Sizes 12–48; weights 400/600/700. Tabular figures only in columns and axes.', html`
      <div class="card sg-type">${TYPE.map(([size, label, cls]) => html`<div class="sg-type-row"><span class="muted small tabular-nums">${size}px</span><span class="${cls}">${label}</span></div>`)}</div>`)}

    ${section('buttons', 'Buttons', 'Primary for the one main action on a surface; secondary and ghost for the rest; danger only for destructive actions.', html`
      <div class="card stack">
        <div class="btn-group">
          <button type="button" class="btn btn-primary" data-action="toast" data-kind="success">${icon('check')}Primary</button>
          <button type="button" class="btn btn-secondary">Secondary</button>
          <button type="button" class="btn btn-ghost">Ghost</button>
          <button type="button" class="btn btn-danger" data-action="confirm-danger">Delete…</button>
          <button type="button" class="btn btn-secondary" disabled>Disabled</button>
          <button type="button" class="btn btn-secondary btn-busy" aria-busy="true">Busy</button>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-primary btn-sm">Small</button>
          <button type="button" class="btn btn-secondary btn-sm">${icon('refresh')}Refresh</button>
          <button type="button" class="btn btn-secondary btn-lg">Large</button>
          <button type="button" class="btn btn-icon" aria-label="Like" data-tip="Like">${icon('heart')}</button>
          <button type="button" class="btn btn-icon" aria-label="Liked" aria-pressed="true" data-tip="Liked (pressed)">${icon('heartFilled')}</button>
          <button type="button" class="btn btn-icon btn-sm" aria-label="More" data-tip="More">${icon('more')}</button>
          <button type="button" class="pl-play sg-play" aria-label="Play" data-tip="The player's play button">${icon('play')}</button>
        </div>
      </div>`)}

    ${section('chips', 'Chips', 'Short labels and filters. Status chips carry an icon, never color alone.', html`
      <div class="card">
        <div class="row">
          <span class="chip">Default</span>
          <span class="chip chip-accent">${icon('heartFilled')}Liked</span>
          <span class="chip chip-outline">${icon('backlog')}In backlog</span>
          <span class="chip chip-good">${icon('checkCircle')}Synced</span>
          <span class="chip chip-warning">${icon('clock')}Clears in 7s</span>
          <span class="chip chip-serious">${icon('hourglass')}Queued</span>
          <span class="chip chip-critical">${icon('alertCircle')}Rate limited</span>
          <button type="button" class="chip" aria-pressed="true">Filter on</button>
          <button type="button" class="chip" aria-pressed="false">Filter off</button>
          <span class="chip chip-lg">Large chip</span>
        </div>
      </div>`)}

    ${section('tabs', 'Tabs and segmented control', 'Arrow keys move between options; tabs() can also render router links.', html`
      <div class="card stack">
        ${tabs({ label: 'Demo tabs', selected: 'artists', items: [{ id: 'artists', label: 'Artists', count: 259 }, { id: 'albums', label: 'Albums', count: 412 }, { id: 'tracks', label: 'Tracks', count: 1204 }] })}
        <p class="text-2 small" data-role="tab-out" aria-live="polite">Selected tab: artists</p>
        <div>${segmented({ label: 'Period', selected: 'month', items: [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' }] })}</div>
        <p class="text-2 small" data-role="seg-out" aria-live="polite">Selected period: month</p>
        ${tabs({ label: 'Link tabs', selected: 'recent', items: [{ id: 'recent', label: 'Recent', href: '#/library/recent' }, { id: 'backlog', label: 'Backlog', href: '#/library/backlog' }, { id: 'liked', label: 'Liked', href: '#/library/liked' }] })}
      </div>`)}

    ${section('stat-tiles', 'Stat tiles', 'Label in sentence case · value · signed change against a named period. The ⓘ explains what is counted.', html`
      <div class="stat-grid">
        ${statTile({ label: 'Plays', value: 661, delta: 12.4, deltaLabel: 'vs March', info: 'Every play in April 2026 from Last.fm scrobbles and plays heard in this app, counted once.' })}
        ${statTile({ label: 'Artists', value: 259, delta: -8, deltaLabel: 'vs March' })}
        ${statTile({ label: 'New artists', value: fmt.pct(14), delta: 0, deltaLabel: 'vs March', goodDirection: 'neutral', hint: 'Share of April artists heard for the first time' })}
        ${statTile({ label: 'Listening time', value: '42.5', unit: 'h', delta: 3, deltaFormat: 'num', deltaLabel: 'hours vs March', info: 'Estimated from track lengths.' })}
        ${statTile({ label: 'Backlog left', value: 1187, delta: -24, deltaFormat: 'num', deltaLabel: 'this week', goodDirection: 'down' })}
        ${statTile({ label: 'Longest streak', value: '58', unit: 'days', deltaLabel: 'Apr 25 – Jun 21, 2025' })}
      </div>
      <div class="card sg-hero">
        <div class="stat-label">Plays in 2025 ${infoTip('Canonical plays in 2025: Last.fm scrobbles plus in-app plays, each counted once.', { label: 'Plays in 2025' })}</div>
        <div class="hero-figure">${fmt.num(7374)}</div>
        <div class="stat-delta"><span class="delta delta-down">${icon('arrowDown')}<span class="sr-only">Down </span>${fmt.signedPct(-24)}</span><span>vs 2024 (${fmt.num(9734)})</span></div>
      </div>`)}

    ${section('meters', 'Meters', 'A fill on a lighter track of the same hue. Tone carries state; the label carries the number.', html`
      <div class="card sg-meters">
        ${meter({ label: 'Catalog heard', value: 42, max: 118, valueLabel: '42 of 118 tracks' })}
        ${meter({ label: 'Backlog cleared this month', value: 312, max: 480, tone: 'accent' })}
        ${meter({ label: 'Good', value: 80, max: 100, tone: 'good', valueLabel: '80%' })}
        ${meter({ label: 'Warning', value: 55, max: 100, tone: 'warning', valueLabel: '55%' })}
        ${meter({ label: 'Critical', value: 92, max: 100, tone: 'critical', valueLabel: '92%' })}
      </div>`)}

    ${section('lists', 'List rows', 'trackRow(): rank, art, title, artist links, meta and hover actions. Names with commas stay intact when artist_list is used.', html`
      <div class="card sg-list-card">
        ${sectionHeader({
          level: 3,
          title: 'Top tracks',
          desc: 'Plays in April 2026 · Last.fm scrobbles plus plays heard in this app',
          info: 'A play is one listen of a track, counted once even when both Last.fm and this app saw it.',
          actions: html`<a class="btn btn-ghost btn-sm" href="#/insights">See all${icon('chevronRight')}</a>`,
        })}
        <div class="list" role="list">${SAMPLE_TRACKS.map((t) => trackRow(t))}</div>
      </div>
      <div class="card sg-inline">
        <span>Inline artist links:</span> ${artistLink('Tyler, The Creator')} · ${artistLink("Guns N' Roses")} · ${artistLink('AC/DC')} · ${artistLink('x" onmouseover="alert(1)')}
      </div>`)}

    ${section('table', 'Table', 'Numbers right-aligned with tabular figures. The accessible twin of every chart uses this style.', html`
      <div class="card table-wrap">
        <table class="table">
          <caption class="sr-only">Top artists, April 2026</caption>
          <thead><tr><th scope="col" class="num">#</th><th scope="col">Artist</th><th scope="col" class="num">Plays</th><th scope="col" class="num">Change</th><th scope="col">First heard</th></tr></thead>
          <tbody>
            ${[['Dance Gavin Dance', 96, 5, '2021-08-02'], ['Sleep Token', 61, 38, '2023-01-14'], ['Linkin Park', 47, -12, '2021-08-03'], ['Andrés', 22, null, '2026-04-11']].map(([n, p, d, f], i) => html`<tr>
              <td class="num">${i + 1}</td><td class="strong">${artistLink(n)}</td><td class="num">${fmt.num(p)}</td>
              <td class="num ${d == null ? '' : d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : ''}">${d == null ? html`<span class="chip chip-accent">New</span>` : fmt.signedPct(d)}</td>
              <td>${fmt.date(f, { year: 'always' })}</td></tr>`)}
          </tbody>
        </table>
      </div>`)}

    ${section('states', 'Loading, empty and error', 'Empty states say how to fill them; errors say what happened and what still works.', html`
      <div class="sg-grid-3">
        <div class="card">${loadingState('Loading your report…', { compact: true })}</div>
        <div class="card">${emptyState({ title: 'No plays this week yet', body: 'Play something in Spotify and it will show up here within a minute.', action: { label: 'Go to Now', href: '#/now' }, compact: true, icon: 'now' })}</div>
        <div class="card" data-role="error-demo">${errorState(new ApiError({ status: 429, code: 'rate_limited', message: 'Spotify is cooling down. Try again in 2 min. Your history and insights still work.' }), { compact: true, retry: true })}</div>
      </div>`)}

    ${section('feedback', 'Feedback', 'Toasts (with Undo), persistent errors, dialogs, menus, popovers and tooltips. Esc closes the top-most overlay.', html`
      <div class="card stack">
        <div class="btn-group">
          <button type="button" class="btn btn-secondary" data-action="toast" data-kind="info">Info toast</button>
          <button type="button" class="btn btn-secondary" data-action="toast-undo">Toast with Undo</button>
          <button type="button" class="btn btn-secondary" data-action="toast" data-kind="warning">Warning toast</button>
          <button type="button" class="btn btn-secondary" data-action="toast-error">Persistent error</button>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-secondary" data-action="confirm">Confirm dialog</button>
          <button type="button" class="btn btn-secondary" data-action="dialog">Dialog</button>
          <button type="button" class="btn btn-secondary" data-action="menu" aria-haspopup="menu" aria-expanded="false">${icon('more')}Menu</button>
          <button type="button" class="btn btn-secondary" data-action="popover" aria-haspopup="dialog" aria-expanded="false">Popover</button>
          <button type="button" class="btn btn-secondary" data-action="show-shortcuts">${icon('keyboard')}Shortcut sheet</button>
        </div>
        <p class="text-2">Hover or focus for a tooltip: <button type="button" class="btn btn-ghost btn-sm" data-tip="Tooltips show on hover and keyboard focus, never as the only place a value lives.">Tooltip</button>
          · Definition tip: listening streak ${infoTip('Consecutive local days with at least one play. Today counts once you play something.', { label: 'listening streak' })}</p>
        <p class="text-2 small" data-role="feedback-out" aria-live="polite"></p>
      </div>`)}

    ${section('forms', 'Forms and keys', '', html`
      <div class="card sg-forms">
        <div class="field"><label class="field-label" for="sg-input">Playlist link or ID</label><input class="input" id="sg-input" placeholder="https://open.spotify.com/playlist/…"><span class="field-help">Paste a share link; the ID is extracted for you.</span></div>
        <label class="check"><input type="checkbox" checked> Auto-clear tracks after the threshold</label>
        <p class="text-2">Keys: <kbd>Space</kbd> <kbd>N</kbd> <kbd>P</kbd> <kbd>L</kbd> <kbd>C</kbd> <kbd>K</kbd> <kbd>U</kbd> <kbd>/</kbd> <kbd>?</kbd></p>
        <div class="row">${thumb(null)} ${thumb(null, { round: true, iconName: 'artists' })} <span class="muted small">Image placeholders</span></div>
      </div>`)}

    <!-- ============================== CHARTS ==============================
         Filled by core/charts.js (owned by the charts agent): chartsDemo(el) / window.__chartsDemo(el). -->
    ${section('charts', 'Charts', 'SVG charts from core/charts.js: hover and keyboard tooltips, table twins, reduced-opacity refetch state.', html`
      <div class="sg-charts" data-hook="charts" id="sg-charts-root">${loadingState('Loading charts…', { compact: true })}</div>`)}
  `;
}

let offActions = null;
let offTabs = null;

export default {
  id: 'styleguide',
  title: 'Styleguide',
  mount(root, params, ctx) {
    mount(root, markup());
    root.querySelectorAll('.sg-chip[data-var]').forEach((n) => { n.style.background = `var(${n.dataset.var})`; });
    const out = (role, text) => { const n = root.querySelector(`[data-role="${role}"]`); if (n) n.textContent = text; };

    offTabs = bindChoiceGroup(root, (value, el) => {
      if (el.getAttribute('role') === 'tab') out('tab-out', `Selected tab: ${value}`);
      else out('seg-out', `Selected period: ${value}`);
    });

    offActions = actions(root, {
      // Sample rows carry fake ids: keep their play buttons from reaching the global player handlers.
      'play-uri': (ds, el, ev) => { ev.stopPropagation(); toast(html`Would play <strong>${ds.name || ds.uri}</strong> (demo)`, { kind: 'info', icon: 'play' }); },
      'play-track': (ds, el, ev) => { ev.stopPropagation(); toast(html`Would look up <strong>${ds.name}</strong> by ${ds.artist} on Spotify, then play it (demo)`, { kind: 'info', icon: 'search' }); },
      jump: (ds) => { root.querySelector(`#${ds.target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      toast: (ds) => {
        const kind = ds.kind || 'info';
        const msg = { info: 'Backlog synced: 1,187 tracks.', success: 'Saved.', warning: 'Spotify is busy; the clear will be retried.' }[kind] || 'Hello.';
        toast(msg, { kind });
      },
      'toast-undo': () => {
        toast(html`Auto-cleared <strong>Purple Reign</strong> from “Discover Backlog”`, {
          kind: 'success',
          detail: 'After 15s of listening',
          action: { label: 'Undo', onClick: () => toast('Restored to your backlog.', { kind: 'success', icon: 'undo' }) },
        });
      },
      'toast-error': () => toast("Can't reach Spotify. Retrying…", { kind: 'error', persistent: true, detail: 'Your history and insights still work. This stays until you dismiss it.' }),
      confirm: async () => {
        const ok = await confirmDialog({ title: 'Switch backlog playlist?', body: 'Tracks you play for 15 s will be removed from “Graveyard” (0 tracks) instead of “Discover Backlog”.', confirmLabel: 'Switch playlist' });
        out('feedback-out', ok ? 'Confirmed.' : 'Cancelled.');
      },
      'confirm-danger': async () => {
        const ok = await confirmDialog({ title: 'Remove this artist from favorites?', body: 'You can add them back at any time.', confirmLabel: 'Remove', danger: true });
        out('feedback-out', ok ? 'Removed (demo).' : 'Kept.');
      },
      dialog: () => {
        openDialog({
          title: 'How auto-clear works',
          subtitle: 'A short explanation dialog',
          body: html`<p>When a track from your backlog playlist has played for the threshold (15 seconds by default), it is removed from the playlist. Press <kbd>K</kbd> to keep the current track, or <kbd>U</kbd> to undo the last clear.</p>`,
          actions: [{ label: 'Got it', kind: 'primary', value: 'ok' }],
        });
      },
      menu: (ds, el) => {
        menu(el, [
          { label: 'Add to playlist…', icon: 'listPlus', onSelect: () => out('feedback-out', 'Menu: add to playlist') },
          { label: 'Open artist', icon: 'artists', onSelect: () => out('feedback-out', 'Menu: open artist') },
          { label: 'Open in Spotify', icon: 'external', href: 'https://open.spotify.com/', external: true },
          { separator: true },
          { label: 'Remove from favorites', icon: 'close', danger: true, onSelect: () => out('feedback-out', 'Menu: remove') },
          { label: 'Disabled item', icon: 'lock', disabled: true },
        ], { placement: 'bottom-start', label: 'Demo menu' });
      },
      popover: (ds, el) => {
        popover(el, html`<div class="popover-pad sg-pop"><strong>Popover</strong><p class="text-2 small">Anchored panel that flips to stay on screen. Click outside or press Esc to close.</p><button type="button" class="btn btn-primary btn-sm" data-close>Done</button></div>`, { label: 'Demo popover' });
        const p = document.querySelector('.sg-pop');
        p?.querySelector('[data-close]')?.addEventListener('click', () => el.click());
      },
      retry: () => {
        const box = root.querySelector('[data-role="error-demo"]');
        if (box) {
          mount(box, loadingState('Retrying…', { compact: true }));
          setTimeout(() => { if (box.isConnected) mount(box, emptyState({ title: 'Loaded', body: 'The retry worked (demo).', compact: true, icon: 'checkCircle' })); }, 900);
        }
      },
    });

    // CHARTS hook: the charts module exports a demo that renders every chart type.
    const chartsRoot = root.querySelector('#sg-charts-root');
    const demo = ctx?.charts?.chartsDemo || window.__chartsDemo;
    if (typeof demo === 'function') {
      try { demo(chartsRoot); } catch (err) {
        mount(chartsRoot, errorState(err, { title: "Charts didn't render", compact: true }));
        throw err;
      }
    } else {
      mount(chartsRoot, emptyState({ title: 'Charts module not loaded', body: 'core/charts.js provides chartsDemo(); it renders here once available.', compact: true, icon: 'insights' }));
    }
  },
  unmount() {
    offActions?.();
    offTabs?.();
    offActions = null;
    offTabs = null;
  },
};

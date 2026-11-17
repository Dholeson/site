// Settings → Extras: the mini player window, the classic view, and the keyboard shortcuts.
import { html, mount, icon, toast } from '../core/ui.js';
import { SHEET } from './shortcuts.js';

// The everyday subset of the global shortcut sheet (same keys and wording); "?" opens all of them.
const PICK = new Set(['Space', 'N', 'L', 'C', 'K', 'U', '/', 'G S']);
const KEYS = SHEET.flatMap(([, rows]) => rows).filter(([keys]) => PICK.has(keys.join(' ')))
  .map(([keys, what]) => [keys, keys.join(' ') === 'G S' ? 'Go to Settings' : what]);

export function createExtrasSection() {
  let el = null;

  function openMini(btn) {
    // Must run inside the click: browsers only allow pop-ups the user asked for.
    const w = window.open('/widget', 'discover-cleaner-mini', 'popup=yes,width=440,height=112,resizable=yes');
    if (!w) {
      toast('Your browser blocked the mini player window', { kind: 'warning', detail: 'Allow pop-ups for this page, then try again.' });
      return;
    }
    try { w.focus(); } catch { /* ignore */ }
    btn.blur();
  }

  return {
    id: 'extras',
    label: 'Extras',
    icon: 'sparkle',
    title: 'Extras',
    desc: 'A small always-available player, the previous version of the app, and keyboard shortcuts.',
    mount(root) {
      el = root;
      mount(el, html`<div class="st-extras">
        <div class="card st-card st-extra">
          <span class="st-extra-icon" aria-hidden="true">${icon('now')}</span>
          <h3 class="st-card-title">Mini player</h3>
          <p class="st-row-desc">A small window with the current track, how close it is to clearing, and quick Like and Skip buttons. Keep it next to your other apps.</p>
          <button type="button" class="btn btn-secondary" data-st="mini">${icon('external')}Open mini player</button>
        </div>
        <div class="card st-card st-extra">
          <span class="st-extra-icon" aria-hidden="true">${icon('library')}</span>
          <h3 class="st-card-title">Classic view</h3>
          <p class="st-row-desc">The previous version of Discover Cleaner, kept as a fallback. It still works but isn't updated anymore.</p>
          <a class="btn btn-secondary" href="/classic">${icon('arrowRight')}Open classic view</a>
        </div>
        <div class="card st-card st-extra st-extra-keys">
          <span class="st-extra-icon" aria-hidden="true">${icon('keyboard')}</span>
          <h3 class="st-card-title">Keyboard shortcuts</h3>
          <dl class="st-keys">${KEYS.map(([keys, what]) => html`<div><dt>${keys.map((k, i) => html`${i ? html`<span class="muted small">then</span>` : ''}<kbd>${k}</kbd>`)}</dt><dd>${what}</dd></div>`)}</dl>
          <button type="button" class="btn btn-ghost btn-sm" data-action="show-shortcuts">${icon('keyboard')}All shortcuts <kbd>?</kbd></button>
        </div>
      </div>`);
      el.addEventListener('click', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-st="mini"]') : null;
        if (t) openMini(t);
      });
    },
    destroy() { el = null; },
  };
}

export default { createExtrasSection };

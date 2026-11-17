// Global keyboard shortcuts and the "?" shortcut sheet. Ignored while typing in a field, while a
// dialog is open, or with Ctrl/Cmd/Alt held. Space only toggles playback when focus is not on a
// control (so Space still presses the focused button).
import router from '../core/router.js';
import { html, openDialog } from '../core/ui.js';
import player from './player.js';
import { focusSearch } from './search.js';

const GO = { n: 'now', i: 'insights', a: 'artists', l: 'library', s: 'settings' };
let pendingG = 0;
let sheet = null;

// Exported so other pages (Settings → Extras) list the same keys and wording.
export const SHEET = [
  ['Playback', [
    [['Space'], 'Play or pause'],
    [['N'], 'Next track'],
    [['P'], 'Previous track'],
    [['←', '→'], 'Seek 5 seconds (when the progress bar is focused)'],
  ]],
  ['Backlog', [
    [['L'], 'Like (also clears it from the backlog)'],
    [['C'], 'Clear now and skip'],
    [['K'], "Keep: don't auto-clear this play (press again to undo)"],
    [['U'], 'Undo the last clear'],
  ]],
  ['Go to', [
    [['/'], 'Search'],
    [['G', 'N'], 'Now'],
    [['G', 'I'], 'Insights'],
    [['G', 'A'], 'Artists'],
    [['G', 'L'], 'Library'],
    [['G', 'S'], 'Settings'],
    [['?'], 'This list'],
    [['Esc'], 'Close menus and dialogs'],
  ]],
];

export function showShortcuts() {
  if (sheet) return;
  const body = html`${SHEET.map(([title, rows]) => html`<section class="shortcut-group"><h3>${title}</h3><dl class="shortcut-list">
    ${rows.map(([keys, what]) => html`<dt>${keys.map((k, i) => html`${i && keys.length === 2 && title === 'Go to' ? html`<span class="muted small">then</span>` : ''}<kbd>${k}</kbd>`)}</dt><dd>${what}</dd>`)}
  </dl></section>`)}`;
  sheet = openDialog({ title: 'Keyboard shortcuts', body, wide: true });
  sheet.done.then(() => { sheet = null; });
}

// Inputs that take no text: letters do nothing in them, so shortcuts keep working after using a
// slider or a checkbox (arrows and Space still belong to the control; see the Space rule below).
const NON_TEXT_INPUTS = ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'];
const TEXT_FIELD = `input:not(${NON_TEXT_INPUTS.map((t) => `[type="${t}"]`).join('):not(')}), textarea, select, [contenteditable=""], [contenteditable="true"]`;

function isTyping(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(TEXT_FIELD);
}

function onKey(ev) {
  if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (isTyping(ev.target)) return;
  if (document.querySelector('dialog[open]')) return;
  const k = ev.key;

  if (pendingG && Date.now() - pendingG < 1500) {
    pendingG = 0;
    const view = GO[k.toLowerCase()];
    if (view) { ev.preventDefault(); router.navigate(router.href(view)); }
    return;
  }
  pendingG = 0;

  if (k === ' ' || k === 'Spacebar') {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t && t.closest('button, a, input, [role="button"], [role="slider"], [role="switch"], [role="tab"], [role="radio"], [role="option"], summary')) return;
    ev.preventDefault();
    player.toggle();
    return;
  }
  switch (k) {
    case '?': ev.preventDefault(); showShortcuts(); return;
    case '/': ev.preventDefault(); focusSearch(); return;
    case 'g': case 'G': pendingG = Date.now(); return;
    case 'n': case 'N': ev.preventDefault(); player.next(); return;
    case 'p': case 'P': ev.preventDefault(); player.prev(); return;
    case 'l': case 'L': ev.preventDefault(); player.like(); return;
    case 'c': case 'C': ev.preventDefault(); player.clearNow(); return;
    case 'k': case 'K': ev.preventDefault(); player.keep(); return;
    case 'u': case 'U': ev.preventDefault(); player.undoLast(); return;
    default:
  }
}

export function initShortcuts() {
  document.addEventListener('keydown', onKey);
  document.addEventListener('app:shortcuts', () => showShortcuts());
}

export default { initShortcuts, showShortcuts, SHEET };

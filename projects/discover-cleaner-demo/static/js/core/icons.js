// Icon set: 24x24 stroke icons (2px, round joins) plus a few filled transport glyphs.
// icon(name) returns trusted markup (a raw() value) so it can be interpolated into html``.
import { raw } from './ui-safe.js';

const S = (d) => `<path d="${d}"/>`;

const PATHS = {
  now: S('M2 10v4') + S('M6 6v12') + S('M10 3v18') + S('M14 8v8') + S('M18 5v14') + S('M22 10v4'),
  insights: S('M3 20h18') + S('M7 16v-5') + S('M12 16V6') + S('M17 16v-8'),
  artists: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/>' + S('M5 11a7 7 0 0 0 14 0') + S('M12 18v3.5'),
  library: S('M4 4v16') + S('M8.5 7v13') + S('M13 7v13') + S('m16.5 7.2 4 12.6'),
  settings: S('M3 7h11') + S('M18 7h3') + '<circle cx="16" cy="7" r="2"/>' + S('M3 17h5') + S('M12 17h9') + '<circle cx="10" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/>' + S('m20 20-3.6-3.6'),
  play: '<path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 5.9v12.2a.9.9 0 0 0 1.38.76l9.2-6.1a.9.9 0 0 0 0-1.5l-9.2-6.1A.9.9 0 0 0 5 5.9Z" fill="currentColor" stroke="none"/><rect x="17" y="4.8" width="2.4" height="14.4" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M19 5.9v12.2a.9.9 0 0 1-1.38.76l-9.2-6.1a.9.9 0 0 1 0-1.5l9.2-6.1A.9.9 0 0 1 19 5.9Z" fill="currentColor" stroke="none"/><rect x="4.6" y="4.8" width="2.4" height="14.4" rx="1" fill="currentColor" stroke="none"/>',
  heart: S('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z'),
  heartFilled: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" fill="currentColor"/>',
  keep: S('M12 16.5V22') + S('M8.5 3h7l-1 6.2 3 3V14.5h-11V12.2l3-3Z'),
  // "check it off the list": the backlog is a list, clearing ticks a track off it
  clear: S('M3 6h13') + S('M3 12h8') + S('M3 18h6') + S('m13 17 3 3 5.5-6.5'),
  undo: S('M9 14 4 9l5-5') + S('M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  plus: S('M12 5v14') + S('M5 12h14'),
  listPlus: S('M3 6h13') + S('M3 12h9') + S('M3 18h7') + S('M18 13v8') + S('M14 17h8'),
  close: S('M18 6 6 18') + S('m6 6 12 12'),
  info: '<circle cx="12" cy="12" r="9"/>' + S('M12 16.5v-5') + S('M12 8h.01'),
  check: S('m5 12.5 4.5 4.5L19 7.5'),
  checkCircle: '<circle cx="12" cy="12" r="9"/>' + S('m8.3 12.2 2.6 2.6 4.8-5.3'),
  alert: S('M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z') + S('M12 9v4.5') + S('M12 17.2h.01'),
  alertCircle: '<circle cx="12" cy="12" r="9"/>' + S('M12 7.5v5.5') + S('M12 16.5h.01'),
  clock: '<circle cx="12" cy="12" r="9"/>' + S('M12 7v5l3.2 2'),
  hourglass: S('M6 3h12') + S('M6 21h12') + S('M7 3c0 5 5 6 5 9s-5 4-5 9') + S('M17 3c0 5-5 6-5 9s5 4 5 9'),
  gauge: S('m12 14 3.8-3.8') + S('M4.2 18.4a9 9 0 1 1 15.6 0'),
  pauseCircle: '<circle cx="12" cy="12" r="9"/>' + S('M10 9v6') + S('M14 9v6'),
  link: S('M10 13.5a4.8 4.8 0 0 0 7.2.5l2.9-2.9a4.8 4.8 0 0 0-6.8-6.8L11.6 6') + S('M14 10.5a4.8 4.8 0 0 0-7.2-.5l-2.9 2.9a4.8 4.8 0 0 0 6.8 6.8l1.7-1.7'),
  external: S('M14 4h6v6') + S('M20 4 11 13') + S('M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'),
  chevronDown: S('m6 9 6 6 6-6'),
  chevronUp: S('m6 15 6-6 6 6'),
  chevronRight: S('m9 6 6 6-6 6'),
  chevronLeft: S('m15 6-6 6 6 6'),
  arrowRight: S('M5 12h14') + S('m13 6 6 6-6 6'),
  arrowUp: S('M12 19V5') + S('m6 11 6-6 6 6'),
  arrowDown: S('M12 5v14') + S('m6 13 6 6 6-6'),
  music: S('M9 18V5l11-2v13') + '<circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/>',
  user: '<circle cx="12" cy="8" r="4"/>' + S('M4 21a8 8 0 0 1 16 0'),
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2.5"/>' + S('M6 9.5h.01') + S('M10 9.5h.01') + S('M14 9.5h.01') + S('M18 9.5h.01') + S('M8 14.5h8'),
  refresh: S('M20 11a8 8 0 0 0-14.8-4.2L4 8.5') + S('M4 4v4.5h4.5') + S('M4 13a8 8 0 0 0 14.8 4.2l1.2-1.7') + S('M20 20v-4.5h-4.5'),
  sparkle: S('M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9Z'),
  inbox: S('M3 13h5l1.5 3h5l1.5-3h5') + S('M5.6 5h12.8L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z'),
  backlog: S('M3 6h12') + S('M3 12h8') + S('M3 18h6') + S('M16 18V9.5l5-1.5') + '<circle cx="14" cy="18" r="2"/>',
  wifiOff: S('M2 2l20 20') + S('M8.5 16.4a5 5 0 0 1 7 0') + S('M5 12.9a10 10 0 0 1 5.2-2.8') + S('M19 12.9a10 10 0 0 0-2.3-1.7') + S('M12 20h.01'),
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/>' + S('M8 11V7a4 4 0 0 1 8 0v4'),
  filter: S('M3 5h18l-7 8.5V20l-4-2v-4.5Z'),
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/>' + S('M3 9.5h18') + S('M8 2.5v4') + S('M16 2.5v4'),
  eye: S('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z') + '<circle cx="12" cy="12" r="3"/>',
  palette: S('M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.5-4 3.5h-1.6a1.8 1.8 0 0 0-1.3 3.1A1.5 1.5 0 0 1 12 21Z') + S('M7.5 11.5h.01') + S('M10.5 7.5h.01') + S('M15 8h.01'),
  star: S('m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8Z'),
  starFilled: '<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8Z" fill="currentColor"/>',
  bookmark: S('M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z'),
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/>' + S('M5 15V6a2 2 0 0 1 2-2h9'),
  shuffle: S('M16 3h5v5') + S('M4 20 21 3') + S('M21 16v5h-5') + S('m15 15 6 6') + S('m4 4 5 5'),
  minus: S('M5 12h14'),
};

/**
 * icon(name, {size, className, label}) → trusted SVG markup for html``.
 * Decorative by default (aria-hidden); pass label to make it announce as an image.
 */
export function icon(name, { size, className = '', label } = {}) {
  const body = PATHS[name] || PATHS.music;
  const cls = `icon${size === 'sm' ? ' icon-sm' : size === 'lg' ? ' icon-lg' : ''}${className ? ' ' + className : ''}`;
  const a11y = label ? `role="img" aria-label="${String(label).replace(/[&<>"']/g, '')}"` : 'aria-hidden="true" focusable="false"';
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`);
}

export const ICON_NAMES = Object.keys(PATHS);

// Web demo entry (dist/web-demo/index.html loads this instead of ../main.js).
//
// 1. Route every API request to the in-browser mock (mock-api.js) — before the app makes any.
// 2. Show the demo banner.
// 3. Start the real app (../main.js), unchanged.
// The demo's clock (clock.js) and config (#app-config → window.APP_CONFIG.webDemo) are already
// in place: both are classic scripts that run before any module.
import { setTransport } from '../core/api.js';
import { transport, setImagesBlocked } from './mock-api.js';
import { reset, init as initSim } from './sim.js';
import { warm } from './fixtures.js';
import { initBanner } from './banner.js';

setTransport(transport);

// Album art comes from Spotify's image CDN. Where a site's CSP (or the network) blocks it, a
// cover that failed becomes an empty placeholder, and later responses leave covers out so the
// interface draws its own placeholders (remembered for this tab).
const NO_ART_KEY = 'dc.webdemo.noArt';
try { if (sessionStorage.getItem(NO_ART_KEY) === '1') setImagesBlocked(); } catch { /* storage off */ }
document.addEventListener('securitypolicyviolation', (ev) => {
  if (!/^https:\/\/i\.scdn\.co\b/.test(String(ev.blockedURI || ''))) return;
  setImagesBlocked();
  try { sessionStorage.setItem(NO_ART_KEY, '1'); } catch { /* storage off */ }
});
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement) || !img.getAttribute('src')) return;
  img.alt = '';
  img.removeAttribute('srcset');
  img.removeAttribute('src');          // no source, empty alt: no broken-image icon
  img.classList.add('demo-img-failed');
}, true);
warm('live.json', 'library/liked.json', 'artists.json', 'artist-info.json');
initSim().catch((err) => console.error('demo: simulator failed to start', err));
initBanner({
  onReset: () => {
    reset();
    try {
      for (const k of Object.keys(sessionStorage)) if (k.startsWith('dc.')) sessionStorage.removeItem(k);
    } catch { /* storage off */ }
    window.location.hash = '#/now';
    window.location.reload();
  },
});

import('../main.js').catch((err) => {
  (window.__errors ||= []).push({ message: `The demo didn't start: ${err?.message || err}`, ts: Date.now() });
  window.__syncJsErrors?.();
  throw err;
});

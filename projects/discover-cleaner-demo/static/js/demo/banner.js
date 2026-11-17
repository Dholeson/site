// Web demo only: the slim banner that says what this is ("real listening history, frozen; Spotify
// is simulated"), links to the project page and the source, and resets the demo. Dismissing it
// is remembered in this browser; the "Live demo" badge in the top bar brings it back.
const CFG = (window.APP_CONFIG && window.APP_CONFIG.webDemo) || {};
const HIDE_KEY = 'dc.webdemo.bannerHidden';

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

function frozenLabel() {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(CFG.frozenOn || '');
  if (!m) return 'frozen in time';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `frozen ${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function setHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(HIDE_KEY, '1');
    else localStorage.removeItem(HIDE_KEY);
  } catch { /* storage off: the choice lasts for this page */ }
}

function wasHidden() {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
}

export function initBanner({ onReset } = {}) {
  const who = CFG.user ? `${CFG.user}’s` : 'The author’s';
  const banner = el('div', { class: 'demo-banner', role: 'region', 'aria-label': 'About this demo', id: 'demo-banner' },
    el('p', { class: 'demo-banner-text' },
      el('strong', {}, 'Live demo'),
      ` — ${who} real listening history, ${frozenLabel()}. Spotify is simulated`,
      el('span', { class: 'demo-banner-more' }, `: each track plays ${CFG.simSeconds || 45} s and your changes stay in this tab`),
      '.'),
    el('div', { class: 'demo-banner-links' },
      el('a', { href: CFG.about || '../discover-cleaner' }, 'About this project'),
      el('a', { href: CFG.repo || 'https://github.com/Dholeson/spotify-discover-cleaner', target: '_blank', rel: 'noopener noreferrer' }, 'Source on GitHub'),
      el('button', { type: 'button', class: 'demo-banner-btn', 'data-demo': 'reset', title: 'Start the demo over: backlog, likes and settings as they were' }, 'Reset demo')),
    el('button', { type: 'button', class: 'demo-banner-close', 'data-demo': 'hide', 'aria-label': 'Hide this banner', title: 'Hide' }, '×'));

  const root = document.body;
  root.prepend(banner);
  const measure = () => document.documentElement.style.setProperty('--demo-banner-h', `${banner.hidden ? 0 : banner.offsetHeight}px`);
  const show = (on) => {
    banner.hidden = !on;
    root.classList.toggle('has-demo-banner', on);
    measure();
  };
  show(!wasHidden());
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(banner);
  window.addEventListener('resize', measure);

  banner.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('[data-demo]') : null;
    if (!b) return;
    if (b.dataset.demo === 'hide') {
      setHidden(true);
      show(false);
      document.getElementById('demo-badge')?.focus();
    } else if (b.dataset.demo === 'reset') {
      b.disabled = true;
      b.textContent = 'Resetting…';
      onReset?.();
    }
  });
  // The top bar's "Live demo" badge shows the banner again.
  document.addEventListener('click', (ev) => {
    const badge = ev.target instanceof Element ? ev.target.closest('#demo-badge') : null;
    if (!badge) return;
    setHidden(false);
    show(true);
    banner.querySelector('a')?.focus();
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target instanceof Element && ev.target.id === 'demo-badge') {
      ev.preventDefault();
      ev.target.click();
    }
  });
  return { show };
}

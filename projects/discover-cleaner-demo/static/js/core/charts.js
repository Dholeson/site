/**
 * Discover Cleaner v2 - core/charts.js
 *
 * Dependency-free chart builders. Every builder returns a <figure class="chart"> that:
 *  - sizes itself to its container (one shared ResizeObserver; it redraws when the width changes),
 *  - carries a <table> twin (visually hidden, or shown with the "Table" toggle) so no value is
 *    tooltip-only,
 *  - shows one shared position:fixed tooltip on pointer hover AND keyboard focus (value strong,
 *    label secondary, always written with textContent - labels are untrusted data),
 *  - exposes fig.chart = { update(data, opts?), setLoading(bool), showTable(bool), redraw(), destroy() }.
 *
 * Dataviz rules (SPEC "Chart rules" / dataviz skill): bars <= 24px with a 4px rounded data end,
 * square at the baseline, and a 2px surface gap; 2px lines; >= 8px markers with a 2px surface ring;
 * hairline solid grid; one axis; series-1 for a single series (no legend box - the title names it);
 * emphasis = one mark in series-1, the rest in --chart-muted; text only ever wears text tokens.
 * Hit targets are the full band (>= 24px wide whenever the layout has room; dense series snap to the
 * nearest band because bands are contiguous).
 *
 * Keyboard: each chart is ONE tab stop (roving tabindex). Arrow keys move between marks, Home/End
 * jump to the ends, Enter/Space call onSelect, Escape hides the tooltip. A 53-week calendar would
 * otherwise be 371 tab stops.
 *
 * No innerHTML anywhere: everything is built with createElement / textContent.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const FALLBACK_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const BAR_MAX = 24;      // px: a bar never fills its band; the leftover is air
const BAR_GAP = 2;       // px: surface gap between adjacent bars
const BAR_RADIUS = 4;    // px: rounded data end
const AXIS_PX = 12;      // tick / axis label size (smallest step of the type scale)
const NICE_EVERY = [1, 2, 3, 4, 5, 6, 7, 10, 12, 14, 15, 20, 25, 30, 50, 100, 200, 500, 1000];
const SEQ_STEPS = 5;     // calendar ramp: --seq-1 (low, near the surface) .. --seq-5 (high)
const LOCALE = 'en-US';  // matches core/ui.js formatters

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ============================================================================ small helpers

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function s(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, String(attrs[k]));
    }
  }
  if (parent) parent.appendChild(node);
  return node;
}

function svgText(parent, attrs, text) {
  const t = s('text', attrs, parent);
  t.textContent = String(text);
  return t;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const crisp = (v) => Math.round(v) + 0.5;           // 1px hairlines land on whole pixels
const pad2 = (n) => String(n).padStart(2, '0');
// Hours read the same as everywhere else in the app (ui.fmt.hour): "4 PM", not "16:00".
const hourPart = (h) => { const n = ((Number(h) % 24) + 24) % 24; return [n % 12 === 0 ? 12 : n % 12, n < 12 ? 'AM' : 'PM']; };
const hour12 = (h) => hourPart(h).join(' ');
const hourTick = (h) => { const [n, ap] = hourPart(h); return `${n}${ap === 'AM' ? 'a' : 'p'}`; };
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round12 = (v) => Number(v.toPrecision(12));   // 0.1 * 3 -> 0.3, not 0.30000000000000004

function capitalize(str) {
  const t = String(str || '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// ============================================================================ number formatting

const NF_CACHE = new Map();
function nf(maxFrac) {
  let f = NF_CACHE.get(maxFrac);
  if (!f) {
    // en-US like core/ui.js, so a chart never shows "1.560" beside a stat tile showing "1,560".
    f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFrac });
    NF_CACHE.set(maxFrac, f);
  }
  return f;
}

/** 1234 -> "1,234"; 4.26 -> "4.3"; 18.4 -> "18"; null -> "–". */
export function formatNumber(v) {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '–';
  if (Number.isInteger(n)) return nf(0).format(n);
  return nf(Math.abs(n) < 10 ? 1 : 0).format(n);
}

function unitFor(value, o) {
  const label = o.valueLabel;
  if (!label) return '';
  if (value === 1) {
    if (o.valueLabelOne) return o.valueLabelOne;
    // "plays" -> "play"; multi-word labels ("plays per day") are left alone.
    return /^[a-z]+s$/i.test(label) ? label.slice(0, -1) : label;
  }
  return label;
}

function valueText(value, o) {
  const text = o.formatValue(value);
  const unit = unitFor(value, o);
  return unit ? `${text} ${unit}` : text;
}

// ============================================================================ text measurement

let measureCtx = null;
function textWidth(text, px, weight, family) {
  const str = String(text ?? '');
  if (measureCtx === null) {
    try { measureCtx = document.createElement('canvas').getContext('2d') || false; } catch { measureCtx = false; }
  }
  if (!measureCtx) return str.length * px * 0.62;
  measureCtx.font = `${weight} ${px}px ${family}`;
  // +1px: canvas ignores tabular-nums, whose digits are a touch wider than proportional ones.
  return measureCtx.measureText(str).width + 1;
}

function fontFamilyOf(node) {
  try { return getComputedStyle(node).fontFamily || FALLBACK_FONT; } catch { return FALLBACK_FONT; }
}

// ============================================================================ scales

/**
 * Clean 0-based ticks: steps of 1/2/2.5/5 x 10^n (no 2.5 for integer data below 10), at most
 * 4 intervals (<= 5 ticks), the smallest step that fits so the tallest bar uses most of the plot.
 */
function niceScale(max, integer) {
  if (!(max > 0)) return { top: 1, ticks: [0] };
  const mults = [1, 2, 2.5, 5];
  let step = 0;
  for (let p = Math.floor(Math.log10(max / 4)) - 1; !step && p < 24; p++) {
    for (const m of mults) {
      const st = round12(m * 10 ** p);
      if (integer && (st < 1 || !Number.isInteger(st))) continue;
      if (Math.ceil(max / st - 1e-9) <= 4) { step = st; break; }
    }
  }
  const intervals = Math.max(1, Math.ceil(max / step - 1e-9));
  const ticks = [];
  for (let i = 0; i <= intervals; i++) ticks.push(round12(i * step));
  return { top: round12(intervals * step), ticks };
}

/** Rounded data end on top, square corners at the baseline. */
function columnPath(x, y, w, hgt, r) {
  const rr = Math.max(0, Math.min(r, w / 2, hgt));
  if (rr === 0) return `M${x},${y + hgt}V${y}H${x + w}V${y + hgt}Z`;
  return `M${x},${y + hgt}V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}H${x + w - rr}`
    + `A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + hgt}Z`;
}

/**
 * Sparse x labels that never collide: forced labels (peak / highlight) first, then every k-th
 * band where k is the smallest "nice" step that clears the widest label; greedy placement rejects
 * anything that would overlap an already placed label. Returns [{i, left, text, strong}].
 */
function placeXLabels({ labels, n, step, padL, W, family, every, tickSteps, forced }) {
  if (!n) return [];
  const widths = labels.map((t) => textWidth(t, AXIS_PX, 400, family));
  const widest = Math.max(...widths);
  let k = Math.max(1, Math.ceil((widest + 8) / step), every || 1);
  const steps = tickSteps || NICE_EVERY;
  k = steps.find((v) => v >= k) || k;
  const forcedSet = new Set(forced || []);
  const order = [...forcedSet];
  const half = Math.floor(k / 2);
  for (let i = 0; i < n; i += k) {
    if (forcedSet.has(i)) continue;
    // Drop regular ticks that crowd a forced label so "15 16 18" doesn't happen.
    if ([...forcedSet].some((f) => Math.abs(f - i) <= half)) continue;
    order.push(i);
  }
  const placed = [];
  for (const i of order) {
    const strong = forcedSet.has(i);
    const w = strong ? textWidth(labels[i], AXIS_PX, 600, family) : widths[i];
    const cx = padL + step * (i + 0.5);
    const left = clamp(cx - w / 2, 0, Math.max(0, W - w));
    const clash = placed.some((p) => left < p.left + p.w + 6 && p.left < left + w + 6);
    if (!clash) placed.push({ i, left, w, text: labels[i], strong });
  }
  return placed.sort((a, b) => a.i - b.i);
}

// ============================================================================ shared tooltip

let tip = null;

function ensureTip() {
  if (tip) return tip;
  const root = h('div', 'chart-tip');
  root.setAttribute('aria-hidden', 'true');   // marks carry the same text in aria-label
  const value = h('strong', 'chart-tip-value');
  const row = h('span', 'chart-tip-row');
  const key = h('span', 'chart-tip-key');
  const label = h('span', 'chart-tip-label');
  const note = h('span', 'chart-tip-note');
  row.append(key, label);
  root.append(value, row, note);
  document.body.appendChild(root);
  tip = { root, value, row, key, label, note, owner: null };

  const hideAll = () => hideTooltip();
  document.addEventListener('scroll', hideAll, { capture: true, passive: true });
  window.addEventListener('resize', hideAll, { passive: true });
  window.addEventListener('hashchange', hideAll);
  window.addEventListener('blur', hideAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideAll(); });
  // Touch: a tap outside the chart that owns the tooltip dismisses it.
  document.addEventListener('pointerdown', (e) => {
    if (tip.owner && !(tip.owner.contains && tip.owner.contains(e.target))) hideAll();
  }, { capture: true, passive: true });
  return tip;
}

/**
 * Show the shared chart tooltip.
 * @param {Element} owner   the chart (figure) that owns it; hideTooltip(owner) only hides its own.
 * @param {{value:string, label?:string, note?:string, color?:string}} content
 * @param {{x:number, y:number} | {rect: {left:number, top:number, width:number, bottom:number}}} anchor
 */
export function showTooltip(owner, content, anchor) {
  if (typeof document === 'undefined') return;
  const t = ensureTip();
  t.value.textContent = content.value ?? '';
  t.label.textContent = content.label ?? '';
  t.row.hidden = !content.label;
  t.note.textContent = content.note ?? '';
  t.note.hidden = !content.note;
  if (content.color) {
    t.key.hidden = false;
    t.key.style.setProperty('background', content.color);
  } else {
    t.key.hidden = true;
  }
  t.owner = owner;
  t.root.classList.add('is-visible');
  const w = t.root.offsetWidth;
  const hh = t.root.offsetHeight;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  let x;
  let y;
  if (anchor && anchor.rect) {
    const r = anchor.rect;
    x = r.left + r.width / 2 - w / 2;
    y = r.top - hh - 10;
    if (y < 8) y = r.bottom + 10;
  } else {
    const ax = anchor ? anchor.x : 0;
    const ay = anchor ? anchor.y : 0;
    x = ax - w / 2;
    y = ay - hh - 14;
    if (y < 8) y = ay + 20;
  }
  x = clamp(x, 8, Math.max(8, vw - w - 8));
  y = clamp(y, 8, Math.max(8, vh - hh - 8));
  t.root.style.setProperty('transform', `translate(${Math.round(x)}px, ${Math.round(y)}px)`);
}

/** Hide the tooltip (only if `owner` still owns it, when given). */
export function hideTooltip(owner) {
  if (!tip) return;
  if (owner && tip.owner !== owner) return;
  tip.root.classList.remove('is-visible');
  tip.owner = null;
}

function isFocusVisible(node) {
  try { return node.matches(':focus-visible'); } catch { return true; }
}

// ============================================================================ loading state

/**
 * Refetch state: keep the previous render, dimmed, instead of a skeleton flash.
 * Works on a chart figure or any container.
 */
export function setLoading(node, on = true) {
  if (!node) return;
  node.classList.toggle('is-loading', !!on);
  if (on) node.setAttribute('aria-busy', 'true');
  else node.removeAttribute('aria-busy');
}

// ============================================================================ sizing

/**
 * Call draw(width) whenever the plot's width changes. Drawing happens in the next animation frame,
 * outside the ResizeObserver delivery, so a draw that changes the plot's height can never trigger
 * the "ResizeObserver loop" error (which the shell counts as a JS error).
 * One observer per chart (not a shared module-level one): a view that drops a chart without calling
 * destroy() must not keep the detached figure alive through a long-lived observer.
 */
function observeWidth(plot, draw, fixedWidth) {
  let lastW = -1;
  let raf = 0;
  let dead = false;
  const run = () => { raf = 0; if (!dead && lastW > 0) draw(lastW); };
  const schedule = (width) => {
    const w = Math.floor(width);
    if (dead || w <= 0 || w === lastW) return;
    lastW = w;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };
  let ro = null;
  if (fixedWidth) {
    lastW = fixedWidth;
    draw(fixedWidth);
  } else if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) schedule(entry.contentRect.width);
    });
    ro.observe(plot);
  } else {
    // Very old engines: measure once attached, then follow window resizes.
    const measure = () => schedule(plot.clientWidth || 600);
    setTimeout(measure, 0);
    window.addEventListener('resize', measure, { passive: true });
  }
  return {
    width: () => lastW,
    redraw: () => { if (!dead && lastW > 0) draw(lastW); },
    destroy: () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    },
  };
}

// ============================================================================ figure shell

/**
 * <figure class="chart chart--kind">
 *   <figcaption class="chart-head"> title · subtitle · [Table] toggle </figcaption>   (optional)
 *   <div class="chart-plot"> svg </div>
 *   <p class="chart-note"> one-line callout </p>                                        (optional)
 *   <div class="chart-tablewrap chart-sr"> <table> twin </div>
 * </figure>
 */
function createShell(kind, o, { toggleDefault = true, tableHidden = false } = {}) {
  const fig = h('figure', `chart chart--${kind}`);
  fig.dataset.chart = kind;
  if (o.className) fig.classList.add(...String(o.className).split(/\s+/).filter(Boolean));
  const wantToggle = o.tableToggle ?? (toggleDefault && !!o.title);
  let toggle = null;
  if (o.title || o.subtitle || wantToggle) {
    const head = h('figcaption', 'chart-head');
    const titles = h('div', 'chart-titles');
    if (o.title) titles.append(h('span', 'chart-title', o.title));
    if (o.subtitle) titles.append(h('span', 'chart-sub', o.subtitle));
    head.append(titles);
    if (wantToggle) {
      toggle = h('button', 'chart-toggle', 'Table');
      toggle.type = 'button';
      toggle.setAttribute('aria-pressed', 'false');
      head.append(toggle);
    }
    fig.append(head);
  } else if (o.ariaLabel) {
    fig.setAttribute('aria-label', o.ariaLabel);
  }
  const plot = h('div', 'chart-plot');
  const note = h('p', 'chart-note');
  note.hidden = true;
  const tableWrap = h('div', 'chart-tablewrap');
  // SVG charts keep the table for screen readers; list charts are already readable text, so
  // their table only appears with the toggle.
  if (tableHidden) tableWrap.hidden = true;
  else tableWrap.classList.add('chart-sr');
  fig.append(plot, note, tableWrap);

  const showTable = (on) => {
    fig.classList.toggle('show-table', !!on);
    plot.hidden = !!on;
    if (tableHidden) tableWrap.hidden = !on;
    else tableWrap.classList.toggle('chart-sr', !on);
    if (toggle) {
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.textContent = on ? 'Chart' : 'Table';
    }
    hideTooltip(fig);
  };
  if (toggle) toggle.addEventListener('click', () => showTable(!fig.classList.contains('show-table')));
  // update(data, {title, subtitle}) refreshes the caption in place (no rebuild, focus kept).
  const setHead = (title, subtitle) => {
    const titles = fig.querySelector(':scope > .chart-head > .chart-titles');
    if (!titles) return;
    const put = (cls, text) => {
      let n = titles.querySelector(`.${cls}`);
      if (!text) { n?.remove(); return; }
      if (!n) { n = h('span', cls); if (cls === 'chart-title') titles.prepend(n); else titles.append(n); }
      if (n.textContent !== text) n.textContent = text;
    };
    if (title !== undefined) put('chart-title', title);
    if (subtitle !== undefined) put('chart-sub', subtitle);
  };
  return { fig, plot, note, tableWrap, showTable, setHead };
}

function setNote(note, text) {
  note.textContent = text || '';
  note.hidden = !text;
}

/** Fill the table twin. rows: [[rowHeader, ...cells]]; numeric columns right-aligned. */
function fillTable(wrap, caption, headers, rows, numericCols = []) {
  const table = h('table', 'chart-table');
  if (caption) table.append(h('caption', null, caption));
  const thead = h('thead');
  const hr = h('tr');
  headers.forEach((text, c) => {
    const th = h('th', numericCols.includes(c) ? 'num' : null, text);
    th.scope = 'col';
    hr.append(th);
  });
  thead.append(hr);
  const tbody = h('tbody');
  for (const row of rows) {
    const tr = h('tr');
    row.forEach((cell, c) => {
      const node = c === 0 ? h('th', null, cell) : h('td', numericCols.includes(c) ? 'num' : null, cell);
      if (c === 0) node.scope = 'row';
      tr.append(node);
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.replaceChildren(table);
}

// ============================================================================ interaction wiring

/**
 * Pointer + keyboard behaviour shared by the SVG charts. `m` is the live model a draw() fills:
 *   m.hits[]            focusable elements (data-i), roving tabindex
 *   m.count             number of marks
 *   m.anchor(i)         client rect the focus tooltip points at
 *   m.tip(i)            tooltip content
 *   m.lift(i, on)       hover emphasis on the painted mark
 *   m.ring(i, visible)  keyboard focus ring (i = -1 hides it)
 *   m.pick?(event)      coordinate hit-testing (calendar); default: closest [data-i]
 *   m.move?(i, key)     custom arrow-key mapping (calendar); default: linear
 *   m.select?(i)        click / Enter / Space
 */
function wireMarks(fig, plot, m) {
  let hover = -1;
  const idxFrom = (e) => {
    if (m.pick) return m.pick(e);
    const node = e.target && e.target.closest ? e.target.closest('[data-i]') : null;
    return node && plot.contains(node) ? Number(node.dataset.i) : -1;
  };
  const focusedIndex = () => {
    const a = document.activeElement;
    return a && plot.contains(a) && a.dataset && a.dataset.i != null ? Number(a.dataset.i) : -1;
  };
  const setHover = (i, anchor) => {
    if (hover !== i) {
      if (hover >= 0) m.lift(hover, false);
      hover = i;
      if (i >= 0) m.lift(i, true);
    }
    if (i >= 0) showTooltip(fig, m.tip(i), anchor || { rect: m.anchor(i) });
  };
  const clearHover = () => {
    if (hover >= 0) m.lift(hover, false);
    hover = -1;
    hideTooltip(fig);
  };
  m.setActive = (i) => {
    if (!m.hits.length) return;
    const next = clamp(i, 0, m.hits.length - 1);
    if (m.hits[m.active]) m.hits[m.active].setAttribute('tabindex', '-1');
    m.active = next;
    m.hits[next].setAttribute('tabindex', '0');
  };
  m.resetHover = () => { hover = -1; };

  const onPointer = (e) => {
    const i = idxFrom(e);
    if (i >= 0) setHover(i, { x: e.clientX, y: e.clientY });
    else if (focusedIndex() < 0) clearHover();
  };
  plot.addEventListener('pointermove', onPointer);
  plot.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') onPointer(e); });
  plot.addEventListener('pointerleave', () => {
    const f = focusedIndex();
    if (f >= 0 && isFocusVisible(document.activeElement)) setHover(f);
    else clearHover();
  });
  plot.addEventListener('focusin', (e) => {
    const node = e.target;
    if (!node || !node.dataset || node.dataset.i == null) return;
    const i = Number(node.dataset.i);
    m.setActive(i);
    const visible = isFocusVisible(node);
    m.ring(i, visible);
    if (visible) setHover(i);
  });
  plot.addEventListener('focusout', (e) => {
    if (e.relatedTarget && plot.contains(e.relatedTarget)) return;
    m.ring(-1, false);
    clearHover();
  });
  plot.addEventListener('keydown', (e) => {
    const cur = focusedIndex();
    if (cur < 0) return;
    let next = -1;
    if (m.move) next = m.move(cur, e.key);
    if (next < 0) {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': next = cur + 1; break;
        case 'ArrowLeft': case 'ArrowUp': next = cur - 1; break;
        case 'Home': next = 0; break;
        case 'End': next = m.count - 1; break;
        default: break;
      }
    }
    if (next >= 0 || ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();   // arrows must not scroll the page while a chart has focus
      if (next >= 0 && next < m.count && next !== cur) m.hits[next].focus({ preventScroll: !m.scrollIntoView });
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && m.select) {
      e.preventDefault();
      m.select(cur);
    } else if (e.key === 'Escape') {
      clearHover();
    }
  });
  plot.addEventListener('click', (e) => {
    if (!m.select) return;
    const i = idxFrom(e);
    if (i >= 0) m.select(i);
  });
  return { clearHover };
}

/** Before a redraw: remember whether a mark had keyboard focus so it can be restored. */
function focusSnapshot(plot) {
  const a = document.activeElement;
  if (a && plot.contains(a) && a.dataset && a.dataset.i != null) {
    return { i: Number(a.dataset.i), visible: isFocusVisible(a) };
  }
  return null;
}

function restoreFocus(m, snap) {
  if (!snap || !m.hits.length) return;
  const i = clamp(snap.i, 0, m.hits.length - 1);
  m.setActive(i);
  m.hits[i].focus({ preventScroll: true });
}

// ============================================================================ data normalising

function normPoints(points) {
  return (Array.isArray(points) ? points : []).map((p, i) => {
    const obj = p != null && typeof p === 'object' ? p : { value: p };
    const key = obj.key ?? obj.label ?? i;
    const label = String(obj.label ?? key);
    return {
      key,
      label,
      fullLabel: String(obj.fullLabel ?? obj.tip ?? label),
      note: obj.note ? String(obj.note) : '',
      value: toNum(obj.value ?? obj.plays ?? obj.count),
      raw: p,
    };
  });
}

// ============================================================================ columns

/**
 * The column engine behind columns / clock / weekday / yearBars.
 * extra.emphasis(data, o) -> Set of indices drawn in series-1 (the rest go --chart-muted).
 * extra.note(data, o)     -> one-line callout under the plot.
 */
function columnChart(kind, points, opts, extra = {}) {
  const o = {
    height: 180,
    title: '',
    valueLabel: '',
    formatValue: formatNumber,
    formatTick: null,
    labelPeak: true,
    highlightKey: null,
    xTickEvery: 0,
    tickSteps: null,
    onSelect: null,
    labelHeader: 'Label',
    emptyText: 'Nothing to show for this period',
    ...(extra.defaults || {}),
    ...(opts || {}),
  };
  let data = (extra.normalize || normPoints)(points, o);
  const { fig, plot, note, tableWrap, showTable, setHead } = createShell(kind, o);
  plot.style.setProperty('height', `${o.height}px`);

  const m = { hits: [], count: 0, active: -1, bars: [], geo: [], emph: new Set(), svg: null, focusRing: null };

  const emphasisOf = () => {
    if (extra.emphasis) return extra.emphasis(data, o);
    if (o.highlightKey != null) {
      const i = data.findIndex((d) => String(d.key) === String(o.highlightKey));
      if (i >= 0) return new Set([i]);
    }
    return new Set();
  };

  m.tip = (i) => {
    const d = data[i];
    const color = m.emph.size ? (m.emph.has(i) ? 'var(--series-1)' : 'var(--chart-muted)') : 'var(--series-1)';
    return { value: valueText(d.value, o), label: d.fullLabel, note: d.note, color };
  };
  m.anchor = (i) => {
    const g = m.geo[i];
    const r = m.svg.getBoundingClientRect();
    return { left: r.left + g.x, width: g.w, top: r.top + g.top, bottom: r.top + g.base };
  };
  m.lift = (i, on) => { if (m.bars[i]) m.bars[i].classList.toggle('is-active', on); };
  m.ring = (i, visible) => {
    if (!m.focusRing) return;
    if (i < 0 || !visible || !m.geo[i]) { m.focusRing.setAttribute('visibility', 'hidden'); return; }
    const g = m.geo[i];
    const hgt = Math.max(6, g.base - g.top);
    m.focusRing.setAttribute('x', g.x - 3);
    m.focusRing.setAttribute('y', g.base - hgt - 3);
    m.focusRing.setAttribute('width', g.w + 6);
    m.focusRing.setAttribute('height', hgt + 6);
    m.focusRing.setAttribute('visibility', 'visible');
  };
  const syncSelect = () => {
    fig.classList.toggle('chart--selectable', !!o.onSelect);
    m.select = o.onSelect ? (i) => o.onSelect(data[i].raw ?? data[i], i) : null;
  };
  syncSelect();
  wireMarks(fig, plot, m);

  function draw(W) {
    const snap = focusSnapshot(plot);
    const family = fontFamilyOf(fig);
    const H = o.height;
    const n = data.length;
    const vals = data.map((d) => d.value);
    const max = n ? Math.max(...vals) : 0;
    const integer = vals.every((v) => Number.isInteger(v));
    const scale = niceScale(max, integer);
    const fmtTick = typeof o.formatTick === 'function' ? o.formatTick : formatNumber;
    const tickLabels = scale.ticks.map((t) => fmtTick(t));
    const tickW = Math.max(0, ...tickLabels.map((t) => textWidth(t, AXIS_PX, 400, family)));
    m.emph = emphasisOf();

    // Direct labels, sparingly: the peak and any highlighted column.
    const caps = new Set();
    if (max > 0 && o.labelPeak) caps.add(vals.indexOf(max));
    for (const i of m.emph) if (vals[i] > 0) caps.add(i);

    const padL = Math.ceil(tickW) + 8;
    const padR = 2;
    const padT = caps.size ? 22 : 8;
    const axisBand = 24;
    const plotH = Math.max(24, H - padT - axisBand);
    const plotW = Math.max(n || 1, W - padL - padR);
    const step = n ? plotW / n : plotW;
    const barW = step >= 3 ? clamp(Math.floor(step - BAR_GAP), 1, BAR_MAX) : Math.max(1, step * 0.7);
    const base = padT + plotH;
    const yOf = (v) => base - (v / scale.top) * plotH;

    const root = s('svg', {
      class: 'chart-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`,
      role: 'group', 'aria-label': o.title || o.ariaLabel || extra.ariaDefault || 'Column chart',
    });

    // Grid + y ticks + baseline (recessive hairlines, never dashed).
    const gAxis = s('g', { 'aria-hidden': 'true' }, root);
    scale.ticks.forEach((t, k) => {
      const y = yOf(t);
      if (t > 0) s('line', { class: 'chart-grid', x1: padL, x2: W - padR, y1: crisp(y), y2: crisp(y) }, gAxis);
      svgText(gAxis, { class: 'chart-tick', x: padL - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, tickLabels[k]);
    });
    s('line', { class: 'chart-axis', x1: padL, x2: W - padR, y1: crisp(base), y2: crisp(base) }, gAxis);

    // Columns.
    const gBars = s('g', { 'aria-hidden': 'true' }, root);
    m.bars = [];
    m.geo = [];
    data.forEach((d, i) => {
      const cx = padL + step * (i + 0.5);
      const x = step >= 3 ? Math.round(cx - barW / 2) : cx - barW / 2;
      let top = base;
      let bar = null;
      if (d.value > 0) {
        const hgt = Math.max(2, base - yOf(d.value));
        top = base - hgt;
        let cls = 'chart-bar';
        if (m.emph.size) cls += m.emph.has(i) ? ' is-emph' : ' is-muted';
        bar = s('path', { class: cls, d: columnPath(x, top, barW, hgt, BAR_RADIUS) }, gBars);
      }
      m.bars[i] = bar;
      m.geo[i] = { cx, x, w: barW, top, base };
    });

    const gLabels = s('g', { 'aria-hidden': 'true' }, root);
    if (max <= 0) {
      svgText(gLabels, { class: 'chart-empty-text', x: padL + plotW / 2, y: padT + plotH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, o.emptyText);
    }

    // Value on the cap of the labelled columns; drop one that would collide with another.
    const capPlaced = [];
    for (const i of [...caps].sort((a, b) => vals[b] - vals[a])) {
      const text = o.formatValue(vals[i]);
      const w = textWidth(text, AXIS_PX, 600, family);
      const left = clamp(m.geo[i].cx - w / 2, 0, Math.max(0, W - w));
      const y = m.geo[i].top - 7;
      if (capPlaced.some((p) => left < p.left + p.w + 4 && p.left < left + w + 4 && Math.abs(p.y - y) < 14)) continue;
      capPlaced.push({ left, w, y });
      svgText(gLabels, { class: 'chart-cap', x: left, y }, text);
    }

    // Sparse x labels; the emphasised column's label is always shown, in a stronger ink.
    const xl = placeXLabels({
      labels: data.map((d) => d.label), n, step, padL, W, family,
      every: o.xTickEvery, tickSteps: o.tickSteps, forced: [...m.emph],
    });
    for (const l of xl) {
      svgText(gLabels, { class: `chart-xlabel${l.strong ? ' is-strong' : ''}`, x: l.left, y: H - 7 }, l.text);
    }

    // Hit bands: contiguous, full height, so the pointer snaps to the nearest column.
    const gHits = s('g', { class: 'chart-hits' }, root);
    m.hits = data.map((d, i) => s('rect', {
      class: 'chart-hit', 'data-i': i, x: padL + step * i, y: 0, width: step, height: H,
      tabindex: '-1', role: 'img', 'aria-label': `${d.fullLabel}: ${valueText(d.value, o)}`,
    }, gHits));
    m.count = n;
    m.focusRing = s('rect', { class: 'chart-focus', rx: 6, ry: 6, visibility: 'hidden' }, root);
    m.svg = root;
    m.resetHover();

    plot.replaceChildren(root);
    if (n) {
      // Tab lands on the highlighted column when there is one, else the first.
      const start = m.active >= 0 && m.active < n ? m.active : (m.emph.size ? [...m.emph][0] : 0);
      m.active = start;
      m.hits[start].setAttribute('tabindex', '0');
    }
    restoreFocus(m, snap);
  }

  const fillTwin = () => {
    fillTable(
      tableWrap,
      o.title || o.ariaLabel || extra.ariaDefault || '',
      [o.labelHeader, capitalize(o.valueLabel) || 'Value'],
      data.map((d) => [d.fullLabel, valueText(d.value, o)]),
      [1],
    );
    setNote(note, extra.note ? extra.note(data, o) : (o.caption || ''));
  };
  fillTwin();
  const sizer = observeWidth(plot, draw);

  fig.chart = {
    update(nextPoints, nextOpts) {
      if (nextOpts) {
        Object.assign(o, nextOpts);
        if ('title' in nextOpts || 'subtitle' in nextOpts) setHead(nextOpts.title, nextOpts.subtitle);
        if ('onSelect' in nextOpts) syncSelect();
      }
      data = (extra.normalize || normPoints)(nextPoints, o);
      if (m.active >= data.length) m.active = -1;
      fillTwin();
      setLoading(fig, false);
      sizer.redraw();
    },
    setLoading: (on) => setLoading(fig, on),
    showTable,
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

/**
 * Time-series columns.
 * @param {Array<{key, label, value, fullLabel?, note?}>} points  (`plays` is accepted for `value`)
 * @param {object} [opts]
 * @param {string} [opts.title]         names the series (a single series needs no legend)
 * @param {string} [opts.valueLabel]    unit for tooltips / table, e.g. "plays" ("1 play" handled)
 * @param {number} [opts.height=180]    total height INCLUDING the x-axis band
 * @param {*}      [opts.highlightKey]  emphasis form: that column in series-1, the rest muted
 * @param {(v:number)=>string} [opts.formatValue]
 * @param {number} [opts.xTickEvery]    minimum label spacing in bands (collisions are still avoided)
 * @param {(point, index)=>void} [opts.onSelect]  click / Enter on a column
 * @param {boolean} [opts.tableToggle]  show the Table/Chart toggle (default: when a title is given)
 */
export function columns(points, opts = {}) {
  return columnChart('columns', points, opts, { ariaDefault: 'Column chart' });
}

/** Plays per year (or any short category series) - the same column engine. */
export function yearBars(points, opts = {}) {
  return columnChart('years', points, opts, {
    ariaDefault: 'Plays per year',
    defaults: { labelHeader: 'Year', valueLabel: 'plays' },
  });
}

function peakSet(data) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (max <= 0) return new Set();
  const out = new Set();
  data.forEach((d, i) => { if (d.value === max) out.add(i); });
  return out;
}

function hourRange(hr) {
  const [a, ap] = hourPart(hr);
  const [b, bp] = hourPart(hr + 1);
  return ap === bp ? `${a}–${b} ${bp}` : `${a} ${ap}–${b} ${bp}`;
}

function normHours(values, o) {
  const arr = new Array(24).fill(0);
  (Array.isArray(values) ? values : []).forEach((v, i) => {
    if (v != null && typeof v === 'object') {
      const hr = Number(v.hour ?? i);
      if (hr >= 0 && hr < 24) arr[hr] = toNum(v.value ?? v.plays ?? v.count);
    } else if (i < 24) {
      arr[i] = toNum(v);
    }
  });
  const fmt = typeof o.formatHour === 'function' ? o.formatHour : hourTick;
  return arr.map((value, hr) => ({ key: hr, label: String(fmt(hr)), fullLabel: hourRange(hr), note: '', value, raw: { hour: hr, value } }));
}

function busiestNote(data, o) {
  const peaks = [...peakSet(data)];
  if (!peaks.length) return '';
  const val = valueText(data[peaks[0]].value, o);
  if (peaks.length === 1) return `Busiest hour: ${hourRange(peaks[0])} · ${val}`;
  return `Busiest hours: ${peaks.map((p) => hourRange(p)).join(', ')} · ${val} each`;
}

/**
 * Listening clock: 24 hourly columns (00-23), peak in series-1 and the rest muted (emphasis form),
 * the peak's hour label always shown and a "Busiest hour" callout under the plot.
 * @param {number[] | Array<{hour, plays}>} values
 * @param {{highlightPeak?: boolean, formatHour?: (h:number)=>string, valueLabel?: string, title?: string, height?: number}} [opts]
 */
export function clock(values, opts = {}) {
  const o = { highlightPeak: true, ...opts };
  return columnChart('clock', values, o, {
    ariaDefault: 'Plays by hour of day',
    normalize: normHours,
    defaults: { labelHeader: 'Hour', valueLabel: 'plays', tickSteps: [1, 2, 3, 4, 6, 12], xTickEvery: 3 },
    emphasis: (data, oo) => (oo.highlightPeak === false ? new Set() : peakSet(data)),
    note: (data, oo) => (oo.showNote === false ? '' : busiestNote(data, oo)),
  });
}

/**
 * Weekday rhythm: 7 columns, Monday first (API dow 0 = Monday).
 * @param {number[] | Array<{dow, plays}>} values
 * @param {{labels?: string[], fullLabels?: string[], highlightPeak?: boolean, valueLabel?: string}} [opts]
 */
export function weekday(values, opts = {}) {
  const normalize = (vals, o) => {
    const arr = new Array(7).fill(0);
    (Array.isArray(vals) ? vals : []).forEach((v, i) => {
      if (v != null && typeof v === 'object') {
        const dow = Number(v.dow ?? i);
        if (dow >= 0 && dow < 7) arr[dow] = toNum(v.value ?? v.plays ?? v.count);
      } else if (i < 7) {
        arr[i] = toNum(v);
      }
    });
    const labels = o.labels || WEEKDAY_SHORT;
    const full = o.fullLabels || (o.labels ? o.labels : WEEKDAY_LONG);
    return arr.map((value, i) => ({ key: i, label: String(labels[i] ?? i), fullLabel: String(full[i] ?? labels[i] ?? i), note: '', value, raw: { dow: i, value } }));
  };
  return columnChart('weekday', values, opts, {
    ariaDefault: 'Plays by day of the week',
    normalize,
    defaults: { labelHeader: 'Day', valueLabel: 'plays', highlightPeak: false },
    emphasis: (data, o) => (o.highlightPeak ? peakSet(data) : new Set()),
  });
}
export const weekdayBars = weekday;

// ============================================================================ radial clock

function polar(cx, cy, r, a) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function sectorPath(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = polar(cx, cy, r0, a0);
  const [x1, y1] = polar(cx, cy, r1, a0);
  const [x2, y2] = polar(cx, cy, r1, a1);
  const [x3, y3] = polar(cx, cy, r0, a1);
  return `M${x0},${y0}L${x1},${y1}A${r1},${r1} 0 0 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 0 0 ${x0},${y0}Z`;
}

/**
 * Radial listening clock (Last.fm style): 24 radial columns from an inner baseline circle,
 * midnight at the top, clockwise; peak in series-1, the rest muted; busiest hour in the middle.
 * The columnar clock() is the default - radial lengths are harder to compare precisely.
 */
export function clockRadial(values, opts = {}) {
  const o = {
    title: '', valueLabel: 'plays', formatValue: formatNumber, highlightPeak: false, maxSize: 320,
    ...opts,
  };
  let data = normHours(values, o);
  const { fig, plot, note, tableWrap, showTable } = createShell('clock-radial', o);
  const m = { hits: [], count: 24, active: 0, bars: [], geo: [], emph: new Set(), svg: null };

  m.tip = (i) => ({
    value: valueText(data[i].value, o),
    label: data[i].fullLabel,
    color: m.emph.size && !m.emph.has(i) ? 'var(--chart-muted)' : 'var(--series-1)',
  });
  m.anchor = (i) => {
    const r = m.svg.getBoundingClientRect();
    const g = m.geo[i];
    return { left: r.left + g.tx - 4, width: 8, top: r.top + g.ty, bottom: r.top + g.ty + 8 };
  };
  m.lift = (i, on) => { if (m.bars[i]) m.bars[i].classList.toggle('is-active', on); };
  m.ring = (i, visible) => {
    m.hits.forEach((node, k) => node.classList.toggle('is-focus', visible && k === i));
  };
  if (o.onSelect) {
    fig.classList.add('chart--selectable');
    m.select = (i) => o.onSelect(data[i].raw, i);
  }
  wireMarks(fig, plot, m);

  function draw(W) {
    const snap = focusSnapshot(plot);
    const size = Math.max(160, Math.min(W, o.maxSize));
    plot.style.setProperty('height', `${size}px`);
    const cx = W / 2;
    const cy = size / 2;
    const outer = size / 2 - 22;           // leave room for the hour labels
    const r0 = Math.round(size * 0.23);
    const len = outer - r0;
    const vals = data.map((d) => d.value);
    const max = Math.max(0, ...vals);
    m.emph = o.highlightPeak ? peakSet(data) : new Set();
    const band = (Math.PI * 2) / 24;
    const barW = clamp(Math.floor(r0 * band - BAR_GAP), 2, BAR_MAX);

    const root = s('svg', {
      class: 'chart-svg', width: W, height: size, viewBox: `0 0 ${W} ${size}`,
      role: 'group', 'aria-label': o.title || o.ariaLabel || 'Plays by hour of day',
    });
    // A faint full-length slot per hour instead of a baseline ring: quiet small hours then read as
    // low fills of their slot, not as a dashed circle.
    const gTrack = s('g', { 'aria-hidden': 'true' }, root);
    for (let i = 0; i < 24; i++) {
      s('path', {
        class: 'chart-track',
        d: columnPath(cx - barW / 2, cy - r0 - len, barW, len, BAR_RADIUS),
        transform: `rotate(${(i + 0.5) * 15} ${cx} ${cy})`,
      }, gTrack);
    }

    const gBars = s('g', { 'aria-hidden': 'true' }, root);
    m.bars = [];
    m.geo = [];
    data.forEach((d, i) => {
      const deg = (i + 0.5) * 15;            // centre of the hour band, 0 = midnight at the top
      const hgt = max > 0 && d.value > 0 ? Math.max(2, (d.value / max) * len) : 0;
      let bar = null;
      if (hgt > 0) {
        let cls = 'chart-bar';
        if (m.emph.size) cls += m.emph.has(i) ? ' is-emph' : ' is-muted';
        bar = s('path', {
          class: cls,
          d: columnPath(cx - barW / 2, cy - r0 - hgt, barW, hgt, BAR_RADIUS),
          transform: `rotate(${deg} ${cx} ${cy})`,
        }, gBars);
      }
      const a = (deg * Math.PI) / 180 - Math.PI / 2;
      const [tx, ty] = polar(cx, cy, r0 + hgt, a);
      m.bars[i] = bar;
      m.geo[i] = { tx, ty };
    });

    const gLabels = s('g', { 'aria-hidden': 'true' }, root);
    for (const hr of [0, 6, 12, 18]) {
      const a = ((hr * 15) * Math.PI) / 180 - Math.PI / 2;
      const [lx, ly] = polar(cx, cy, outer + 12, a);
      svgText(gLabels, { class: 'chart-xlabel', x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, hourTick(hr));
    }
    const peaks = [...peakSet(data)];
    if (peaks.length && max > 0) {
      svgText(gLabels, { class: 'chart-center-value', x: cx, y: cy - 6, 'text-anchor': 'middle' }, hour12(peaks[0]));
      svgText(gLabels, { class: 'chart-center-label', x: cx, y: cy + 12, 'text-anchor': 'middle' }, 'busiest hour');
    } else if (max <= 0) {
      svgText(gLabels, { class: 'chart-empty-text', x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, 'No plays');
    }

    const gHits = s('g', { class: 'chart-hits' }, root);
    m.hits = data.map((d, i) => {
      const a0 = i * band - Math.PI / 2;
      return s('path', {
        class: 'chart-hit chart-hit--sector', 'data-i': i,
        d: sectorPath(cx, cy, r0 - 4, outer + 4, a0, a0 + band),
        tabindex: '-1', role: 'img', 'aria-label': `${d.fullLabel}: ${valueText(d.value, o)}`,
      }, gHits);
    });
    m.count = 24;
    m.svg = root;
    m.resetHover();
    plot.replaceChildren(root);
    m.active = clamp(m.active, 0, 23);
    m.hits[m.active].setAttribute('tabindex', '0');
    restoreFocus(m, snap);
  }

  const fillTwin = () => {
    fillTable(tableWrap, o.title || 'Plays by hour of day', ['Hour', capitalize(o.valueLabel) || 'Value'],
      data.map((d) => [d.fullLabel, valueText(d.value, o)]), [1]);
    setNote(note, o.showNote === false ? '' : busiestNote(data, o));
  };
  fillTwin();
  plot.style.setProperty('height', `${o.maxSize}px`);
  const sizer = observeWidth(plot, draw);
  fig.chart = {
    update(next, nextOpts) {
      if (nextOpts) Object.assign(o, nextOpts);
      data = normHours(next, o);
      fillTwin();
      setLoading(fig, false);
      sizer.redraw();
    },
    setLoading: (on) => setLoading(fig, on),
    showTable,
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

// ============================================================================ sparkline

/**
 * Tiny trend line: 2px line, 8px end dot with a 2px surface ring; hover / arrow keys read points.
 * @param {Array<number | {label?, key?, value}>} values
 * @param {{width?: number|'auto', height?: number, labels?: string[], valueLabel?: string,
 *          formatValue?: Function, area?: boolean, zero?: boolean, ariaLabel?: string}} [opts]
 */
export function sparkline(values, opts = {}) {
  const o = {
    width: 120, height: 32, labels: null, valueLabel: '', formatValue: formatNumber,
    area: false, zero: false, title: '', ...opts,
  };
  const normalize = (vals) => (Array.isArray(vals) ? vals : []).map((v, i) => {
    const obj = v != null && typeof v === 'object' ? v : { value: v };
    const label = obj.fullLabel ?? obj.label ?? obj.key ?? (o.labels && o.labels[i]) ?? `Point ${i + 1}`;
    return { label: String(label), value: toNum(obj.value ?? obj.plays ?? obj.count) };
  });
  let data = normalize(values);
  const { fig, plot, tableWrap, showTable } = createShell('spark', { ...o, tableToggle: o.tableToggle ?? false });
  const fixed = o.width === 'auto' ? 0 : (Number(o.width) || 120);
  if (fixed) {
    fig.classList.add('chart--inline');
    plot.style.setProperty('width', `${fixed}px`);
  }
  plot.style.setProperty('height', `${o.height}px`);
  const st = { pts: [], svg: null, hoverDot: null, index: -1 };

  const summary = () => {
    if (!data.length) return `${o.ariaLabel || o.title || 'Trend'}: no data`;
    const first = data[0];
    const last = data[data.length - 1];
    const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
    return `${o.ariaLabel || o.title || 'Trend'}: ${data.length} points, from ${valueText(first.value, o)} (${first.label}) `
      + `to ${valueText(last.value, o)} (${last.label}); peak ${valueText(peak.value, o)} (${peak.label}). Use arrow keys to read each point.`;
  };

  const showPoint = (i, anchor) => {
    if (i < 0 || !st.pts[i]) return;
    st.index = i;
    const [px, py] = st.pts[i];
    st.hoverDot.setAttribute('cx', px);
    st.hoverDot.setAttribute('cy', py);
    st.hoverDot.setAttribute('visibility', 'visible');
    const r = st.svg.getBoundingClientRect();
    showTooltip(fig, { value: valueText(data[i].value, o), label: data[i].label, color: 'var(--series-1)' },
      anchor || { rect: { left: r.left + px - 4, width: 8, top: r.top + py - 4, bottom: r.top + py + 4 } });
  };
  const clear = () => {
    st.index = -1;
    if (st.hoverDot) st.hoverDot.setAttribute('visibility', 'hidden');
    hideTooltip(fig);
  };
  const nearest = (clientX) => {
    if (!st.pts.length || !st.svg) return -1;
    const x = clientX - st.svg.getBoundingClientRect().left;
    let best = 0;
    st.pts.forEach(([px], i) => { if (Math.abs(px - x) < Math.abs(st.pts[best][0] - x)) best = i; });
    return best;
  };
  plot.addEventListener('pointermove', (e) => { const i = nearest(e.clientX); if (i >= 0) showPoint(i, { x: e.clientX, y: e.clientY }); });
  plot.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { const i = nearest(e.clientX); if (i >= 0) showPoint(i, { x: e.clientX, y: e.clientY }); } });
  plot.addEventListener('pointerleave', () => {
    if (st.svg && document.activeElement === st.svg && isFocusVisible(st.svg)) showPoint(st.index >= 0 ? st.index : st.pts.length - 1);
    else clear();
  });
  plot.addEventListener('focusin', () => { if (st.svg && isFocusVisible(st.svg)) showPoint(st.pts.length - 1); });
  plot.addEventListener('focusout', clear);
  plot.addEventListener('keydown', (e) => {
    if (!st.pts.length) return;
    const cur = st.index >= 0 ? st.index : st.pts.length - 1;
    let next = -1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, cur - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(st.pts.length - 1, cur + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = st.pts.length - 1;
    else if (e.key === 'Escape') { clear(); return; }
    if (next >= 0) { e.preventDefault(); showPoint(next); }
  });

  function draw(W) {
    const hadFocus = st.svg && document.activeElement === st.svg;
    const H = o.height;
    const pad = 6;                             // 4px dot radius + 2px ring
    const n = data.length;
    const vals = data.map((d) => d.value);
    let lo = o.zero ? 0 : Math.min(...vals, Infinity);
    let hi = Math.max(...vals, -Infinity);
    if (!n) { lo = 0; hi = 1; }
    if (hi === lo) { lo -= 1; hi += 1; }
    const xOf = (i) => (n <= 1 ? W - pad : pad + ((W - 2 * pad) * i) / (n - 1));
    const yOf = (v) => pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo));
    st.pts = vals.map((v, i) => [xOf(i), yOf(v)]);

    const root = s('svg', {
      class: 'chart-svg chart-spark-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`,
      role: 'img', tabindex: '0', 'aria-label': summary(),
    });
    if (n > 1) {
      const line = st.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
      if (o.area) {
        const baseY = o.zero ? yOf(0) : H - pad;
        s('path', { class: 'chart-area', d: `${line}L${st.pts[n - 1][0].toFixed(1)},${baseY}L${st.pts[0][0].toFixed(1)},${baseY}Z` }, root);
      }
      s('path', { class: 'chart-line', d: line }, root);
    }
    if (n) {
      const [ex, ey] = st.pts[n - 1];
      s('circle', { class: 'chart-dot', cx: ex, cy: ey, r: 4 }, root);
    }
    st.hoverDot = s('circle', { class: 'chart-dot chart-dot--hover', r: 4, visibility: 'hidden' }, root);
    st.svg = root;
    st.index = -1;
    plot.replaceChildren(root);
    if (hadFocus) root.focus({ preventScroll: true });
  }

  const fillTwin = () => fillTable(tableWrap, o.title || o.ariaLabel || 'Trend', ['Point', capitalize(o.valueLabel) || 'Value'],
    data.map((d) => [d.label, valueText(d.value, o)]), [1]);
  fillTwin();
  const sizer = observeWidth(plot, draw, fixed);
  fig.chart = {
    update(next, nextOpts) {
      if (nextOpts) Object.assign(o, nextOpts);
      data = normalize(next);
      fillTwin();
      setLoading(fig, false);
      sizer.redraw();
    },
    setLoading: (on) => setLoading(fig, on),
    showTable,
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

// ============================================================================ calendar heatmap

function parseDay(iso) {
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!mt) return null;
  const d = new Date(Number(mt[1]), Number(mt[2]) - 1, Number(mt[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d, n) {
  // setDate keeps local midnight across DST changes (adding 86,400,000 ms would not).
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

const LONG_DAY = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  : null;
const MONTH_SHORT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat(LOCALE, { month: 'short' }) : null;

/**
 * Quantile bins over the non-zero days so one 118-play outlier doesn't wash every other day
 * into the palest step. Returns upper bounds (strictly increasing) for levels 1..k-1; level k is
 * everything above the last bound.
 */
function heatBins(values) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return { bounds: [], levels: 0, min: 0, max: 0 };
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * (nz.length - 1)))];
  const bounds = [];
  for (const p of [0.2, 0.4, 0.6, 0.8]) {
    const b = q(p);
    if (b < nz[nz.length - 1] && (!bounds.length || b > bounds[bounds.length - 1])) bounds.push(b);
  }
  return { bounds, levels: bounds.length + 1, min: nz[0], max: nz[nz.length - 1] };
}

function levelOf(v, bins) {
  if (!(v > 0) || !bins.levels) return 0;
  let k = 0;
  while (k < bins.bounds.length && v > bins.bounds[k]) k++;
  return k + 1;
}

/** Spread k used levels over the 5 ramp steps (1 level -> the middle, series-1 blue). */
function rampStep(level, levels) {
  if (level <= 0) return 0;
  if (levels <= 1) return 3;
  return Math.round(1 + ((level - 1) * (SEQ_STEPS - 1)) / (levels - 1));
}

/**
 * GitHub-style listening calendar: weeks as columns (Monday on top), a one-hue sequential blue
 * ramp (validated: dark surface, ordinal), month labels, a scale legend with the bin ranges.
 * @param {Array<{day:'YYYY-MM-DD', value}>} days   missing days count as 0
 * @param {{weeks?: number, end?: string, valueLabel?: string, formatValue?: Function,
 *          onSelect?: (day:{day, value}) => void, title?: string}} [opts]
 */
export function calendarHeat(days, opts = {}) {
  const o = {
    weeks: 53, end: null, valueLabel: 'plays', formatValue: formatNumber, title: '', legend: true,
    ...opts,
  };
  let cells = [];
  let bins = { bounds: [], levels: 0 };
  const { fig, plot, note, tableWrap, showTable } = createShell('calendar', o);
  const legend = h('div', 'chart-legend');
  legend.setAttribute('aria-hidden', 'true');   // the table caption carries the same ranges
  fig.insertBefore(legend, note);
  const m = { hits: [], count: 0, active: -1, svg: null, grid: null, step: 12, cell: 10, x0: 0, y0: 0, scrollIntoView: true };

  function build(list) {
    const map = new Map();
    let last = null;
    for (const d of Array.isArray(list) ? list : []) {
      const dt = parseDay(d && d.day);
      if (!dt) continue;
      const key = isoDay(dt);
      map.set(key, (map.get(key) || 0) + toNum(d.value ?? d.plays ?? d.count));
      if (!last || dt > last) last = dt;
    }
    const end = parseDay(o.end) || last || new Date();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const weeks = Math.max(1, Math.floor(Number(o.weeks) || 53));
    const endDow = (endDay.getDay() + 6) % 7;           // 0 = Monday
    const start = addDays(endDay, -endDow - (weeks - 1) * 7);
    const out = [];
    for (let d = start, i = 0; d <= endDay; d = addDays(d, 1), i++) {
      const key = isoDay(d);
      out.push({ i, date: d, day: key, value: map.get(key) || 0, col: Math.floor(i / 7), row: i % 7 });
    }
    cells = out;
    bins = heatBins(cells.map((c) => c.value));
    for (const c of cells) c.step = rampStep(levelOf(c.value, bins), bins.levels);
    m.weeks = weeks;
  }

  const rangeLabels = () => {
    // Human ranges per used level, e.g. ["1–4", "5–9", "10–16", "17+"].
    const out = [];
    const integer = cells.every((c) => Number.isInteger(c.value));
    let lo = bins.min;
    bins.bounds.forEach((b) => {
      out.push(lo === b ? formatNumber(b) : `${formatNumber(lo)}–${formatNumber(b)}`);
      lo = integer ? b + 1 : b;
    });
    if (bins.levels) out.push(lo >= bins.max ? formatNumber(bins.max) : `${formatNumber(lo)}+`);
    return out;
  };

  const tipFor = (i) => {
    const c = cells[i];
    const zero = !(c.value > 0);
    return {
      value: zero ? `No ${o.valueLabel || 'activity'}` : valueText(c.value, o),
      label: LONG_DAY ? LONG_DAY.format(c.date) : c.day,
      color: zero ? 'var(--chart-empty)' : `var(--seq-${c.step})`,
    };
  };
  m.tip = tipFor;
  m.anchor = (i) => {
    const c = cells[i];
    const r = m.grid.getBoundingClientRect();
    const left = r.left + c.col * m.step;
    const top = r.top + m.y0 + c.row * m.step;
    return { left, width: m.cell, top, bottom: top + m.cell };
  };
  m.lift = (i, on) => { if (m.hits[i]) m.hits[i].classList.toggle('is-active', on); };
  m.ring = (i, visible) => {
    if (!m.focusRing) return;
    if (i < 0 || !visible) { m.focusRing.setAttribute('visibility', 'hidden'); return; }
    const c = cells[i];
    m.focusRing.setAttribute('x', c.col * m.step - 2);
    m.focusRing.setAttribute('y', m.y0 + c.row * m.step - 2);
    m.focusRing.setAttribute('visibility', 'visible');
  };
  m.pick = (e) => {
    if (!m.grid) return -1;
    const r = m.grid.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left + 1) / m.step);
    const row = Math.floor((e.clientY - r.top - m.y0 + 1) / m.step);
    if (row < 0 || row > 6 || col < 0) return -1;
    const i = col * 7 + row;
    return i < cells.length ? i : -1;
  };
  m.move = (i, key) => {
    switch (key) {
      case 'ArrowUp': return i - 1 >= 0 ? i - 1 : i;
      case 'ArrowDown': return i + 1 < cells.length ? i + 1 : i;
      case 'ArrowLeft': return i - 7 >= 0 ? i - 7 : i;
      case 'ArrowRight': return i + 7 < cells.length ? i + 7 : i;
      default: return -1;
    }
  };
  if (o.onSelect) {
    fig.classList.add('chart--selectable');
    m.select = (i) => o.onSelect({ day: cells[i].day, value: cells[i].value }, i);
  }
  wireMarks(fig, plot, m);

  function draw(W) {
    const snap = focusSnapshot(plot);
    const family = fontFamilyOf(fig);
    const weeks = m.weeks;
    const dayLabelW = Math.ceil(Math.max(...['Mon', 'Wed', 'Fri'].map((t) => textWidth(t, AXIS_PX, 400, family)))) + 8;
    const avail = Math.max(0, W - dayLabelW);
    // 2px surface gap; cells 9-14px. Below 9px the grid scrolls sideways instead of shrinking.
    const step = clamp(Math.floor((avail + BAR_GAP) / weeks), 11, 16);
    const cell = step - BAR_GAP;
    const gridW = weeks * step - BAR_GAP;
    const monthH = 20;
    const H = monthH + 7 * step - BAR_GAP;
    Object.assign(m, { step, cell, y0: monthH });
    // Narrow screens keep every week and scroll sideways. The viewport is a whole number of weeks
    // wide so, scrolled to the end, no sliver of a half-hidden week shows at its left edge.
    const scrolls = weeks * step > avail;
    const visibleCols = scrolls ? Math.max(1, Math.floor(avail / step)) : weeks;

    const days = s('svg', { class: 'chart-svg chart-cal-days', width: dayLabelW, height: H, 'aria-hidden': 'true' });
    [[0, 'Mon'], [2, 'Wed'], [4, 'Fri']].forEach(([row, text]) => {
      svgText(days, { class: 'chart-tick', x: dayLabelW - 8, y: monthH + row * step + cell / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, text);
    });

    const grid = s('svg', {
      class: 'chart-svg chart-cal-grid', width: gridW + 2, height: H, viewBox: `0 0 ${gridW + 2} ${H}`,
      role: 'group', 'aria-label': o.title || o.ariaLabel || 'Listening calendar',
    });
    const gMonths = s('g', { 'aria-hidden': 'true' }, grid);
    let lastRight = -Infinity;
    for (let col = 0; col < weeks; col++) {
      const first = cells[col * 7];
      if (!first) break;
      const prev = col > 0 ? cells[(col - 1) * 7] : null;
      if (prev && prev.date.getMonth() === first.date.getMonth()) continue;
      const text = MONTH_SHORT ? MONTH_SHORT.format(first.date) : String(first.date.getMonth() + 1);
      const x = col * step;
      const w = textWidth(text, AXIS_PX, 400, family);
      if (x < lastRight + 6 || x + w > gridW + 2) continue;
      svgText(gMonths, { class: 'chart-xlabel', x, y: 12 }, text);
      lastRight = x + w;
    }
    const gCells = s('g', null, grid);
    m.hits = cells.map((c) => s('rect', {
      class: `chart-cell${c.step ? ` seq-${c.step}` : ''}`, 'data-i': c.i,
      x: c.col * step, y: monthH + c.row * step, width: cell, height: cell, rx: 2, ry: 2,
      tabindex: '-1', role: 'img', 'aria-label': `${tipFor(c.i).label}: ${tipFor(c.i).value}`,
    }, gCells));
    m.count = cells.length;
    m.focusRing = s('rect', { class: 'chart-focus', width: cell + 4, height: cell + 4, rx: 3, ry: 3, visibility: 'hidden' }, grid);
    m.grid = grid;
    m.svg = grid;
    m.resetHover();

    const scroller = h('div', `chart-cal-scroll${scrolls ? ' is-scrolling' : ''}`);
    if (scrolls) scroller.style.setProperty('width', `${visibleCols * step}px`);
    scroller.append(grid);
    const wrap = h('div', 'chart-cal');
    wrap.append(days, scroller);
    // Height follows the content: a scrolling grid adds room for its scrollbar (classic or overlay)
    // below the Sunday row instead of painting the scrollbar over it.
    plot.style.removeProperty('height');
    plot.replaceChildren(wrap);
    if (scrolls) scroller.scrollLeft = scroller.scrollWidth;   // most recent weeks in view
    // The legend ends where the visible grid ends, not at the far edge of a wide card.
    legend.style.setProperty('max-width', `${dayLabelW + visibleCols * step}px`);
    if (m.count) {
      if (m.active < 0 || m.active >= m.count) m.active = m.count - 1;   // start on the latest day
      m.hits[m.active].setAttribute('tabindex', '0');
    }
    restoreFocus(m, snap);
  }

  const fillTwin = () => {
    const ranges = rangeLabels();
    legend.replaceChildren();
    if (o.legend !== false) {
      // Swatches carry their numeric ranges, so no "Less … More" words (they wrap badly on phones).
      const swatch = (stepN, text) => {
        const item = h('span', 'chart-legend-item');
        const sw = h('span', `chart-legend-swatch${stepN ? ` seq-${stepN}` : ''}`);
        item.append(sw, h('span', 'chart-legend-text', text));
        legend.append(item);
      };
      swatch(0, '0');
      ranges.forEach((text, k) => swatch(rampStep(k + 1, bins.levels), text));
    }
    const listed = cells.filter((c) => c.value > 0);
    const unit = o.valueLabel || 'activity';
    const caption = `${o.title || 'Listening calendar'}. Days not listed had no ${unit}.`
      + (ranges.length ? ` Colour steps: ${ranges.join(', ')}.` : '');
    fillTable(tableWrap, caption, ['Day', capitalize(o.valueLabel) || 'Value'],
      listed.map((c) => [LONG_DAY ? LONG_DAY.format(c.date) : c.day, valueText(c.value, o)]), [1]);
    setNote(note, o.caption || '');
  };

  build(days);
  fillTwin();
  plot.style.setProperty('height', `${20 + 7 * 13}px`);
  const sizer = observeWidth(plot, draw);
  fig.chart = {
    update(next, nextOpts) {
      if (nextOpts) Object.assign(o, nextOpts);
      build(next);
      m.active = -1;
      fillTwin();
      setLoading(fig, false);
      sizer.redraw();
    },
    setLoading: (on) => setLoading(fig, on),
    showTable,
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

// ============================================================================ bar list

const SAFE_HREF = /^(#|\/(?!\/)|https?:\/\/|spotify:)/i;

function badgeText(badge) {
  if (!badge) return '';
  const b = String(badge).toLowerCase().replace(/[\s-]+/g, '_');
  if (b === 'new' || b === 'new_ever') return 'NEW';
  if (b === 're_entry' || b === 'reentry') return 'RE-ENTRY';
  return String(badge).toUpperCase();
}

function badgeNote(text) {
  if (text === 'NEW') return 'New: first time in your history';
  if (text === 'RE-ENTRY') return 'Back in your top list';
  return text;
}

function deltaParts(delta) {
  const n = Number(delta);
  if (delta == null || delta === '' || !Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const pct = abs >= 1000 ? '>999%' : `${nf(0).format(Math.round(abs))}%`;
  if (Math.round(abs) === 0) return { dir: 'flat', arrow: '', text: '0%', words: 'no change' };
  return n > 0
    ? { dir: 'up', arrow: '▲', text: pct, words: `up ${pct}` }
    : { dir: 'down', arrow: '▼', text: pct, words: `down ${pct}` };
}

function initials(label) {
  const words = String(label || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '♪';
  // first + last word, like ui.fmt.initials, so a name gets the same initials on every page
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/**
 * Ranked horizontal bars (Last.fm library style): rank · 40px image · label + sublabel · bar with
 * the value at its tip · change chip (▲ 12% / ▼ 8% / NEW / RE-ENTRY: text tokens + a small
 * coloured arrow). Rows are links when `href` is given (or carry data-* attributes from `data`
 * for the shell's delegated [data-action] handlers).
 *
 * @param {Array<{key, label, sublabel?, value, image?, href?, badge?, delta?, prevRank?, rank?,
 *                data?: object, note?: string}>} items   (`plays` accepted for `value`,
 *                `pct_change` for `delta`, `prev_rank` for `prevRank`)
 * @param {object} [opts]
 * @param {number} [opts.max]          scale maximum (share one scale across lists); default = largest value
 * @param {number} [opts.limit]        render at most this many rows
 * @param {(v:number)=>string} [opts.formatValue]
 * @param {string} [opts.valueLabel]   unit, e.g. "plays"
 * @param {boolean} [opts.showRank=true]
 * @param {string} [opts.deltaLabel]   names the comparison period, e.g. "vs March" (default "vs previous period")
 * @param {'square'|'round'} [opts.imageShape='square']  round suits artists
 * @param {*} [opts.highlightKey]      emphasis: that row's bar in series-1, the rest muted
 */
export function barList(items, opts = {}) {
  const o = {
    max: null, limit: null, formatValue: formatNumber, valueLabel: 'plays', showRank: true,
    deltaLabel: 'vs previous period', imageShape: 'square', highlightKey: null, title: '',
    emptyText: 'Nothing here yet', ...opts,
  };
  const { fig, plot, note, tableWrap, showTable } = createShell('barlist', o, { toggleDefault: false, tableHidden: true });
  let rowsData = [];

  const normalize = (list) => {
    const arr = (Array.isArray(list) ? list : []).map((it, i) => {
      const obj = it || {};
      return {
        key: obj.key ?? obj.label ?? i,
        label: String(obj.label ?? obj.name ?? ''),
        sublabel: obj.sublabel != null ? String(obj.sublabel) : '',
        value: toNum(obj.value ?? obj.plays ?? obj.count),
        image: obj.image || '',
        href: obj.href && SAFE_HREF.test(String(obj.href)) ? String(obj.href) : '',
        badge: badgeText(obj.badge),
        delta: deltaParts(obj.delta ?? obj.pct_change),
        rank: obj.rank ?? i + 1,
        prevRank: obj.prevRank ?? obj.prev_rank ?? null,
        data: obj.data && typeof obj.data === 'object' ? obj.data : null,
        note: obj.note ? String(obj.note) : '',
        raw: it,
      };
    });
    return o.limit ? arr.slice(0, o.limit) : arr;
  };

  const rankMove = (r) => {
    if (r.prevRank == null || r.badge) return null;
    const diff = Number(r.prevRank) - Number(r.rank);
    if (!Number.isFinite(diff) || diff === 0) return null;
    return diff > 0 ? { dir: 'up', text: `${diff}`, words: `up ${diff} from #${r.prevRank}` }
      : { dir: 'down', text: `${-diff}`, words: `down ${-diff} from #${r.prevRank}` };
  };

  const tipFor = (r) => {
    const bits = [];
    if (r.badge) bits.push(badgeNote(r.badge));
    else if (r.delta) bits.push(`${r.delta.arrow ? `${r.delta.arrow} ` : ''}${r.delta.text} ${o.deltaLabel}`);
    if (r.prevRank != null && !r.badge) bits.push(`was #${r.prevRank}`);
    if (r.note) bits.push(r.note);
    return {
      value: valueText(r.value, o),
      label: r.sublabel ? `${r.label} · ${r.sublabel}` : r.label,
      note: bits.join(' · '),
      color: o.highlightKey != null && String(r.key) !== String(o.highlightKey) ? 'var(--chart-muted)' : 'var(--series-1)',
    };
  };

  // Tooltip on the bar (hover) and on the row (keyboard focus).
  let hoverRow = null;
  plot.addEventListener('pointermove', (e) => {
    const line = e.target.closest ? e.target.closest('.bl-barline') : null;
    const li = line ? line.closest('[data-i]') : null;
    if (!li) { if (hoverRow) { hoverRow = null; hideTooltip(fig); } return; }
    hoverRow = li;
    showTooltip(fig, tipFor(rowsData[Number(li.dataset.i)]), { x: e.clientX, y: e.clientY });
  });
  plot.addEventListener('pointerleave', () => { hoverRow = null; hideTooltip(fig); });
  plot.addEventListener('focusin', (e) => {
    const li = e.target.closest ? e.target.closest('[data-i]') : null;
    if (!li || !isFocusVisible(e.target)) return;
    const bar = li.querySelector('.bl-bar');
    const r = (bar || li).getBoundingClientRect();
    showTooltip(fig, tipFor(rowsData[Number(li.dataset.i)]), { rect: { left: r.left, width: r.width, top: r.top, bottom: r.bottom } });
  });
  plot.addEventListener('focusout', (e) => { if (!plot.contains(e.relatedTarget)) hideTooltip(fig); });
  // data-action rows without an href are role=button: Enter/Space must activate them like a click.
  plot.addEventListener('keydown', (e) => {
    const row = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && row && row.matches && row.matches('div.bl-row[role="button"]')) {
      e.preventDefault();
      row.click();
    }
  });

  function render() {
    const family = fontFamilyOf(fig);
    const max = Number(o.max) > 0 ? Number(o.max) : Math.max(0, ...rowsData.map((r) => r.value));
    const valW = Math.max(24, ...rowsData.map((r) => textWidth(o.formatValue(r.value), 13, 400, family)));
    const hasImages = rowsData.some((r) => r.image);
    const hasDelta = rowsData.some((r) => r.delta || r.badge);
    const maxRankLen = Math.max(1, ...rowsData.map((r) => String(r.rank).length));

    if (!rowsData.length) {
      plot.replaceChildren(h('p', 'chart-empty', o.emptyText));
      return;
    }
    const list = h('ol', `bl${o.imageShape === 'round' ? ' bl--round' : ''}${o.showRank ? '' : ' bl--norank'}${hasImages ? '' : ' bl--noimg'}${hasDelta ? '' : ' bl--nodelta'}`);
    list.setAttribute('role', 'list');
    list.style.setProperty('--bl-val-w', `${Math.ceil(valW) + 10}px`);
    list.style.setProperty('--bl-rank-w', `${maxRankLen + 0.5}ch`);

    rowsData.forEach((r, i) => {
      const li = h('li', 'bl-item');
      li.dataset.i = String(i);
      const row = h(r.href ? 'a' : 'div', 'bl-row');
      if (r.href) row.setAttribute('href', r.href);
      if (r.data) {
        for (const [k, v] of Object.entries(r.data)) {
          if (v == null || !/^[a-z][a-z0-9-]*$/i.test(k)) continue;
          row.setAttribute(`data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, String(v));
        }
        if (!r.href && r.data.action) { row.setAttribute('role', 'button'); row.tabIndex = 0; }
      }

      if (o.showRank) {
        const rank = h('span', 'bl-rank');
        rank.append(h('span', 'chart-sr', 'Rank '), document.createTextNode(String(r.rank)));
        const mv = rankMove(r);
        if (mv) {
          const mvEl = h('span', `bl-move bl-move--${mv.dir}`);
          const arrow = h('span', 'bl-arrow', mv.dir === 'up' ? '▲' : '▼');
          arrow.setAttribute('aria-hidden', 'true');
          const txt = h('span', null, mv.text);
          txt.setAttribute('aria-hidden', 'true');
          mvEl.append(arrow, txt, h('span', 'chart-sr', `, ${mv.words}`));
          rank.append(mvEl);
        }
        row.append(rank);
      }

      if (hasImages) {
        const box = h('span', 'bl-img');
        box.setAttribute('aria-hidden', 'true');
        const fallback = () => { box.replaceChildren(h('span', 'bl-initials', initials(r.label))); };
        if (r.image) {
          const img = h('img');
          img.alt = '';
          img.width = 40;
          img.height = 40;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', fallback, { once: true });
          img.src = r.image;
          box.append(img);
        } else {
          fallback();
        }
        row.append(box);
      }

      const main = h('span', 'bl-main');
      const text = h('span', 'bl-text');
      const label = h('span', 'bl-label', r.label);
      label.title = r.label;   // full name when it is truncated
      text.append(label);
      if (r.sublabel) text.append(h('span', 'bl-sub', r.sublabel));
      const line = h('span', 'bl-barline');
      const bar = h('span', 'bl-bar');
      bar.setAttribute('aria-hidden', 'true');
      if (o.highlightKey != null && String(r.key) !== String(o.highlightKey)) bar.classList.add('is-muted');
      bar.style.setProperty('--pct', String(max > 0 ? Math.min(1, r.value / max) : 0));
      const val = h('span', 'bl-val', o.formatValue(r.value));
      const unit = unitFor(r.value, o);
      if (unit) val.append(h('span', 'chart-sr', ` ${unit}`));
      line.append(bar, val);
      main.append(text, line);
      row.append(main);

      if (hasDelta) {
        const cell = h('span', 'bl-delta');
        if (r.badge) {
          const b = h('span', `bl-badge${r.badge === 'NEW' ? ' bl-badge--new' : ''}`, r.badge);
          cell.append(b, h('span', 'chart-sr', ` (${badgeNote(r.badge)})`));
        } else if (r.delta) {
          cell.classList.add(`bl-delta--${r.delta.dir}`);
          if (r.delta.arrow) {
            const arrow = h('span', 'bl-arrow', r.delta.arrow);
            arrow.setAttribute('aria-hidden', 'true');
            cell.append(arrow);
          }
          const t = h('span', null, r.delta.text);
          t.setAttribute('aria-hidden', 'true');
          cell.append(t, h('span', 'chart-sr', `${r.delta.words} ${o.deltaLabel}`));
        }
        row.append(cell);
      }
      li.append(row);
      list.append(li);
    });
    plot.replaceChildren(list);
  }

  const fillTwin = () => {
    const headers = [];
    const numeric = [];
    if (o.showRank) headers.push('Rank');
    headers.push('Name');
    const withSub = rowsData.some((r) => r.sublabel);
    if (withSub) headers.push('Detail');
    numeric.push(headers.length);
    headers.push(capitalize(o.valueLabel) || 'Value');
    const withChange = rowsData.some((r) => r.delta || r.badge);
    if (withChange) headers.push(`Change ${o.deltaLabel}`);
    const withPrev = rowsData.some((r) => r.prevRank != null);
    if (withPrev) headers.push('Previous rank');
    const rows = rowsData.map((r) => {
      const row = [];
      if (o.showRank) row.push(String(r.rank));
      row.push(r.label);
      if (withSub) row.push(r.sublabel);
      row.push(valueText(r.value, o));
      if (withChange) row.push(r.badge || (r.delta ? `${r.delta.dir === 'down' ? '−' : r.delta.dir === 'up' ? '+' : ''}${r.delta.text}` : '–'));
      if (withPrev) row.push(r.prevRank != null ? `#${r.prevRank}` : '–');
      return row;
    });
    fillTable(tableWrap, o.title || o.ariaLabel || '', headers, rows, numeric);
    setNote(note, o.caption || '');
  };

  rowsData = normalize(items);
  render();
  fillTwin();
  fig.chart = {
    update(next, nextOpts) {
      if (nextOpts) Object.assign(o, nextOpts);
      rowsData = normalize(next);
      render();
      fillTwin();
      setLoading(fig, false);
    },
    setLoading: (on) => setLoading(fig, on),
    showTable,
    redraw: render,
    destroy() { hideTooltip(fig); },
  };
  return fig;
}

// ============================================================================ stylesheet

/** Load charts.css next to this module unless the page already links it. */
function ensureStyles() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[data-charts-css], link[href*="css/charts.css"]')) return;
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../css/charts.css', import.meta.url).href;
    link.dataset.chartsCss = '';
    document.head.appendChild(link);
  } catch { /* the page can still link charts.css itself */ }
}

// ============================================================================ demo (#/styleguide)

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoCover(hue) {
  // Tiny local SVG "cover" so the demo never hits the network.
  const svgSrc = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="hsl(${hue} 35% 30%)"/><circle cx="20" cy="20" r="11" fill="hsl(${hue} 45% 52%)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svgSrc)}`;
}

/**
 * Render every chart with realistic sample data (styleguide page / standalone demo).
 * @param {HTMLElement} el
 */
export function chartsDemo(el) {
  if (!el) return null;
  const rnd = mulberry32(20260925);
  const DAY_FMT = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });

  // Plays per day, August 2026: weekday evenings, busier weekends, one release-day spike.
  const month = [];
  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026, 7, d);
    const dow = (date.getDay() + 6) % 7;
    let v = Math.round(18 + rnd() * 22 + (dow >= 5 ? 14 : 0));
    if (d === 14) v = 96;
    if (d === 9 || d === 23) v = 0;
    month.push({ key: isoDay(date), label: String(d), fullLabel: DAY_FMT.format(date), value: v });
  }

  const years = [
    { key: 2021, label: '2021', value: 8120 },
    { key: 2022, label: '2022', value: 10450 },
    { key: 2023, label: '2023', value: 9002 },
    { key: 2024, label: '2024', value: 9734 },
    { key: 2025, label: '2025', value: 7374 },
    { key: 2026, label: '2026', fullLabel: '2026 (so far)', value: 5210 },
  ];

  const artists = [
    { key: 'dance gavin dance', label: 'Dance Gavin Dance', sublabel: 'Post-hardcore', value: 1560, delta: 5, prevRank: 1, image: demoCover(210) },
    { key: 'sleep token', label: 'Sleep Token', sublabel: 'Alt-metal', value: 842, delta: 38, prevRank: 4, image: demoCover(20) },
    { key: 'linkin park', label: 'Linkin Park', sublabel: 'Nu metal', value: 611, delta: 112, prevRank: 7 },
    { key: 'periphery', label: 'Periphery', sublabel: 'Progressive metal', value: 540, delta: -12, prevRank: 2, image: demoCover(150) },
    { key: 'trip lee', label: 'Trip Lee', sublabel: 'Christian hip hop', value: 402, badge: 'new_ever' },
    { key: 'andres', label: 'Andrés', sublabel: 'Singer-songwriter', value: 166, delta: -8, prevRank: 5, image: demoCover(280) },
    { key: 'woe is me', label: 'Woe, Is Me', sublabel: 'Metalcore', value: 54, badge: 're_entry' },
    { key: 'tyler the creator', label: 'Tyler, The Creator', sublabel: 'Hip hop', value: 37, delta: 0, prevRank: 8 },
  ].map((a) => ({ ...a, href: `#/artist/${encodeURIComponent(a.label)}` }));

  const tracks = [
    { key: 't1', label: 'Purple Reign', sublabel: 'Dance Gavin Dance', value: 88, delta: 12 },
    { key: 't2', label: 'Chokehold', sublabel: 'Sleep Token', value: 61, badge: 'new' },
    { key: 't3', label: 'Numb', sublabel: 'Linkin Park', value: 47, delta: -20 },
    { key: 't4', label: 'Summertime Gladness', sublabel: 'Dance Gavin Dance', value: 39, delta: 3 },
    { key: 't5', label: 'A Very Long Track Title That Has To Truncate Cleanly On Small Screens', sublabel: 'Periphery', value: 21, delta: -41 },
  ];

  // Listening clock peaking at 16:00; quiet small hours.
  const hourShape = [9, 5, 3, 2, 1, 1, 4, 12, 30, 44, 58, 71, 86, 94, 118, 176, 312, 241, 150, 122, 118, 96, 61, 28];
  // Plays per active day, Monday..Sunday, peaking Tuesday.
  const weekdayVals = [31.4, 44.8, 36.2, 33.9, 29.5, 26.1, 22.7];
  // Weekly plays, last 12 weeks.
  const weekly = [212, 240, 198, 260, 281, 245, 302, 276, 318, 290, 334, 312].map((v, i) => ({ label: `Week ${i + 1} of 12`, value: v }));

  // A year of daily plays ending on the day this was written; a quiet fortnight in March.
  const cal = [];
  const endDay = new Date(2026, 8, 25);
  for (let i = 364; i >= 0; i--) {
    const d = addDays(endDay, -i);
    const dow = (d.getDay() + 6) % 7;
    let v = rnd() < 0.12 ? 0 : Math.round(rnd() ** 1.6 * 55 + (dow >= 5 ? 10 : 2));
    if (d.getMonth() === 2 && d.getDate() >= 3 && d.getDate() <= 16) v = 0;
    if (d.getMonth() === 6 && d.getDate() === 1) v = 118;
    cal.push({ day: isoDay(d), value: v });
  }

  const root = h('div', 'charts-demo');
  const bar = h('div', 'charts-demo-bar');
  const dimBtn = h('button', 'chart-toggle', 'Dim charts (refetch state)');
  dimBtn.type = 'button';
  dimBtn.setAttribute('aria-pressed', 'false');
  bar.append(dimBtn);
  const grid = h('div', 'charts-demo-grid');
  const card = (title, sub, node, wide) => {
    const c = h('section', `charts-demo-card${wide ? ' is-wide' : ''}`);
    c.append(h('h3', 'charts-demo-title', title));
    if (sub) c.append(h('p', 'charts-demo-sub', sub));
    c.append(node);
    grid.append(c);
    return node;
  };

  const figs = [];
  figs.push(card('Plays per day', 'August 2026 · columns() · x labels thin out as the card narrows',
    columns(month, { title: 'Plays per day, August 2026', valueLabel: 'plays', labelHeader: 'Day' })));
  figs.push(card('Top artists', 'This year vs 2025 · barList() with rank moves, deltas and badges',
    barList(artists, { title: 'Top artists, 2026', valueLabel: 'plays', deltaLabel: 'vs 2025', imageShape: 'round', tableToggle: true })));
  figs.push(card('Listening clock', 'All of 2025 · clock() · busiest hour emphasised',
    clock(hourShape, { title: 'Plays by hour, 2025' })));
  figs.push(card('Listening clock (radial)', 'Optional clockRadial() - same data',
    clockRadial(hourShape, { title: 'Plays by hour, 2025 (radial)' })));
  figs.push(card('Weekday rhythm', 'Plays per active day · weekday()',
    weekday(weekdayVals, { title: 'Plays per active day, 2025', valueLabel: 'plays per active day', highlightPeak: true })));
  figs.push(card('Top tracks', 'barList() without images, custom delta label',
    barList(tracks, { valueLabel: 'plays', deltaLabel: 'vs August' })));
  figs.push(card('Plays per year', 'yearBars() · 2025 highlighted',
    yearBars(years, { title: 'Plays per year', highlightKey: 2025 })));

  const tile = h('div', 'charts-demo-tile');
  const tileText = h('div', 'charts-demo-tile-text');
  tileText.append(h('span', 'charts-demo-tile-label', 'Plays this week'), h('span', 'charts-demo-tile-value', '312'));
  const delta = h('span', 'charts-demo-tile-delta');
  const arrow = h('span', 'bl-arrow bl-arrow--down', '▼');
  arrow.setAttribute('aria-hidden', 'true');
  delta.append(arrow, document.createTextNode(' 7% vs last week'));
  tileText.append(delta);
  const spark = sparkline(weekly, { width: 132, height: 36, valueLabel: 'plays', ariaLabel: 'Weekly plays, last 12 weeks' });
  tile.append(tileText, spark);
  figs.push(spark);
  card('Sparkline', 'Stat tile trend · sparkline()', tile);

  figs.push(card('Listening calendar', 'Last 53 weeks · calendarHeat() · scrolls sideways on phones',
    calendarHeat(cal, { title: 'Plays per day, last 12 months', valueLabel: 'plays' }), true));

  dimBtn.addEventListener('click', () => {
    const on = dimBtn.getAttribute('aria-pressed') !== 'true';
    dimBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    figs.forEach((f) => setLoading(f, on));
  });

  root.append(bar, grid);
  el.replaceChildren(root);
  return root;
}

// ============================================================================ module init

ensureStyles();
if (typeof window !== 'undefined') window.__chartsDemo = chartsDemo;

const charts = {
  columns, barList, clock, clockRadial, weekday, weekdayBars, sparkline, calendarHeat, yearBars,
  setLoading, showTooltip, hideTooltip, formatNumber, chartsDemo,
};
export default charts;

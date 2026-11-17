// Two chart forms core/charts.js doesn't have, built to the same rules and look (they reuse the
// .chart-* classes from charts.css and the shared tooltip from core/charts.js):
//   timeLine(points, opts)  - a level over real time (backlog size): 2px line on a time axis; the
//                             line breaks where no value was recorded instead of inventing one.
//   gapBars(points, opts)   - weekly columns where a week can be "not measured" (null), drawn as
//                             a hollow baseline marker and said in the tooltip/table, never as 0.
// Both: hover + keyboard (one tab stop, arrows move, Home/End) tooltips, a Table toggle with a
// real <table> twin, fig.chart = {update, setLoading, destroy}. Text is set with textContent.
import { showTooltip, hideTooltip, setLoading } from '../core/charts.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const AXIS_PX = 12;
const DAY_MS = 86400000;
const BAR_MAX = 24;
const BAR_GAP = 2;
const BAR_RADIUS = 4;

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = String(text);
  return n;
}

function s(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}

function text(parent, attrs, str) {
  const t = s('text', attrs, parent);
  t.textContent = String(str);
  return t;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// "1 track added", not "1 tracks added": the unit's first word loses its plural s for exactly 1.
const unitFor = (v, label) => (Number(v) === 1 ? String(label).replace(/^(\w+?)s\b/, '$1') : label);
const crisp = (v) => Math.round(v) + 0.5;
const NF = new Intl.NumberFormat('en-US');
const fmtNum = (v) => (v == null || !Number.isFinite(Number(v)) ? '–' : NF.format(Math.round(Number(v))));

let ctx2d = null;
function textWidth(str, px = AXIS_PX, weight = 400) {
  if (ctx2d === null) {
    try { ctx2d = document.createElement('canvas').getContext('2d') || false; } catch { ctx2d = false; }
  }
  if (!ctx2d) return String(str).length * px * 0.62;
  ctx2d.font = `${weight} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  return ctx2d.measureText(String(str)).width + 1;
}

function parseDay(day) {
  const m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Nice ticks covering [lo, hi]; zero-based unless zero is far below the data (levels, not counts). */
function niceTicks(lo, hi, { zero = true, maxTicks = 4 } = {}) {
  if (zero) lo = Math.min(0, lo);
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / maxTicks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((st) => st >= raw && (st >= 1 || p < 1)) || 10 * p;
  const top = Math.ceil(hi / step - 1e-9) * step;
  const bottom = Math.floor(lo / step + 1e-9) * step;
  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo: bottom, hi: top, ticks };
}

function observe(plot, draw) {
  let lastW = -1;
  let raf = 0;
  let dead = false;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
    const w = Math.floor(entries[entries.length - 1].contentRect.width);
    if (dead || w <= 0 || w === lastW) return;
    lastW = w;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { raf = 0; if (!dead) draw(lastW); });
  }) : null;
  if (ro) ro.observe(plot);
  else setTimeout(() => { lastW = plot.clientWidth || 600; draw(lastW); }, 0);
  return {
    redraw: () => { if (!dead && lastW > 0) draw(lastW); },
    destroy: () => { dead = true; if (raf) cancelAnimationFrame(raf); ro?.disconnect(); },
  };
}

function shell(kind, o) {
  const fig = h('figure', `chart chart--${kind}`);
  fig.dataset.chart = kind;
  const head = h('figcaption', 'chart-head');
  const titles = h('div', 'chart-titles');
  if (o.title) titles.append(h('span', 'chart-title', o.title));
  if (o.subtitle) titles.append(h('span', 'chart-sub', o.subtitle));
  const toggle = h('button', 'chart-toggle', 'Table');
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'false');
  head.append(titles, toggle);
  const plot = h('div', 'chart-plot');
  plot.style.height = `${o.height}px`;
  const note = h('p', 'chart-note');
  note.hidden = true;
  const tableWrap = h('div', 'chart-tablewrap chart-sr');
  fig.append(head, plot, note, tableWrap);
  const showTable = (on) => {
    fig.classList.toggle('show-table', on);
    plot.hidden = on;
    tableWrap.classList.toggle('chart-sr', !on);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.textContent = on ? 'Chart' : 'Table';
    hideTooltip(fig);
  };
  toggle.addEventListener('click', () => showTable(!fig.classList.contains('show-table')));
  return { fig, plot, note, tableWrap };
}

function fillTable(wrap, caption, headers, rows) {
  const table = h('table', 'chart-table');
  if (caption) table.append(h('caption', null, caption));
  const thead = h('thead');
  const tr = h('tr');
  headers.forEach((t, i) => { const th = h('th', i ? 'num' : null, t); th.scope = 'col'; tr.append(th); });
  thead.append(tr);
  const tbody = h('tbody');
  rows.forEach((row) => {
    const r = h('tr');
    row.forEach((cell, i) => {
      const c = i ? h('td', 'num', cell) : h('th', null, cell);
      if (!i) c.scope = 'row';
      r.append(c);
    });
    tbody.append(r);
  });
  table.append(thead, tbody);
  wrap.replaceChildren(table);
}

/**
 * Roving-focus hit targets + hover for a list of marks.
 * m: {hits[], count, tip(i), anchor(i) -> rect, lift(i, on), ring(i, visible), pick?(e)}
 */
function wire(fig, plot, m) {
  let hover = -1;
  const idxFrom = (e) => {
    if (m.pick) return m.pick(e);
    const n = e.target?.closest?.('[data-i]');
    return n && plot.contains(n) ? Number(n.dataset.i) : -1;
  };
  const focused = () => {
    const a = document.activeElement;
    return a && plot.contains(a) && a.dataset?.i != null ? Number(a.dataset.i) : -1;
  };
  const set = (i, anchor) => {
    if (hover !== i) { if (hover >= 0) m.lift(hover, false); hover = i; if (i >= 0) m.lift(i, true); }
    if (i >= 0) showTooltip(fig, m.tip(i), anchor || { rect: m.anchor(i) });
  };
  const clear = () => { if (hover >= 0) m.lift(hover, false); hover = -1; hideTooltip(fig); };
  m.reset = () => { hover = -1; };
  plot.addEventListener('pointermove', (e) => { const i = idxFrom(e); if (i >= 0) set(i, { x: e.clientX, y: e.clientY }); else if (focused() < 0) clear(); });
  plot.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { const i = idxFrom(e); if (i >= 0) set(i, { x: e.clientX, y: e.clientY }); } });
  plot.addEventListener('pointerleave', () => { if (focused() < 0) clear(); });
  plot.addEventListener('focusin', (e) => {
    const n = e.target;
    if (n?.dataset?.i == null) return;
    const i = Number(n.dataset.i);
    m.hits.forEach((el, k) => el.setAttribute('tabindex', k === i ? '0' : '-1'));
    let visible = true;
    try { visible = n.matches(':focus-visible'); } catch { /* old engines */ }
    m.ring(i, visible);
    if (visible) set(i);
  });
  plot.addEventListener('focusout', (e) => { if (e.relatedTarget && plot.contains(e.relatedTarget)) return; m.ring(-1, false); clear(); });
  plot.addEventListener('keydown', (e) => {
    const cur = focused();
    if (cur < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = cur + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = cur - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = m.count - 1;
    else if (e.key === 'Escape') { clear(); return; }
    else return;
    e.preventDefault();
    next = clamp(next, 0, m.count - 1);
    if (next !== cur) m.hits[next]?.focus({ preventScroll: true });
  });
}

// ======================================================================= time line

/**
 * @param {Array<{day:'YYYY-MM-DD', value:number, note?:string}>} points  sorted by day
 * @param {{title?, subtitle?, height?, valueLabel?, gapDays?, formatDay?, caption?, emptyText?}} opts
 */
export function timeLine(points, opts = {}) {
  const o = { height: 220, valueLabel: 'tracks', gapDays: 3, emptyText: 'Nothing recorded yet', ...opts };
  const { fig, plot, note, tableWrap } = shell('timeline', o);
  const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  let data = [];
  const m = { hits: [], count: 0, geo: [], svg: null, ring: () => {}, lift: () => {} };

  const norm = (pts) => (pts || []).map((p) => ({ ...p, d: parseDay(p.day), value: Number(p.value) }))
    .filter((p) => p.d && Number.isFinite(p.value)).sort((a, b) => a.d - b.d);

  m.tip = (i) => {
    const p = data[i];
    return { value: `${fmtNum(p.value)} ${unitFor(p.value, o.valueLabel)}`, label: dayFmt.format(p.d), note: p.note || '', color: 'var(--series-1)' };
  };
  m.anchor = (i) => {
    const g = m.geo[i]; const r = m.svg.getBoundingClientRect();
    return { left: r.left + g.x - 4, width: 8, top: r.top + g.y - 4, bottom: r.top + g.y + 4 };
  };
  wire(fig, plot, m);

  function draw(W) {
    const H = o.height;
    const svg = s('svg', { class: 'chart-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': o.title || 'Line chart' });
    m.svg = svg;
    if (!data.length) {
      text(svg, { class: 'chart-empty-text', x: W / 2, y: H / 2, 'text-anchor': 'middle' }, o.emptyText);
      plot.replaceChildren(svg);
      m.hits = []; m.count = 0;
      return;
    }
    const vals = data.map((p) => p.value);
    const vmin = Math.min(...vals); const vmax = Math.max(...vals);
    // A level, not a count: start the axis near the data unless zero is close anyway.
    const zero = vmin <= (vmax - vmin) * 0.6;
    const sc = niceTicks(vmin, vmax, { zero });
    const tickLabels = sc.ticks.map(fmtNum);
    const padL = Math.ceil(Math.max(...tickLabels.map((t) => textWidth(t)))) + 10;
    const padR = 10; const padT = 12; const axisBand = 24;
    const plotW = Math.max(40, W - padL - padR);
    const plotH = Math.max(40, H - padT - axisBand);
    const base = padT + plotH;
    const t0 = data[0].d.getTime(); const t1 = data[data.length - 1].d.getTime();
    const span = Math.max(DAY_MS, t1 - t0);
    const xOf = (t) => (data.length === 1 ? padL + plotW / 2 : padL + ((t - t0) / span) * plotW);
    const yOf = (v) => base - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * plotH;

    const gAxis = s('g', { 'aria-hidden': 'true' }, svg);
    sc.ticks.forEach((t, k) => {
      const y = yOf(t);
      if (k > 0) s('line', { class: 'chart-grid', x1: padL, x2: W - padR, y1: crisp(y), y2: crisp(y) }, gAxis);
      text(gAxis, { class: 'chart-tick', x: padL - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, tickLabels[k]);
    });
    s('line', { class: 'chart-axis', x1: padL, x2: W - padR, y1: crisp(base), y2: crisp(base) }, gAxis);

    // x labels: month starts (or weekly days for short spans), placed without collisions
    const labels = [];
    const spanDays = span / DAY_MS;
    const first = new Date(data[0].d);
    if (spanDays > 50) {
      const d = new Date(first.getFullYear(), first.getMonth() + (first.getDate() > 1 ? 1 : 0), 1);
      while (d.getTime() <= t1) {
        const showYear = d.getMonth() === 0 || labels.length === 0;
        labels.push({ t: d.getTime(), text: d.toLocaleDateString('en-US', showYear ? { month: 'short', year: 'numeric' } : { month: 'short' }) });
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      const stepDays = spanDays > 20 ? 7 : spanDays > 8 ? 3 : 1;
      for (let t = t0; t <= t1 + 1; t += stepDays * DAY_MS) {
        const d = new Date(t);
        labels.push({ t, text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
      }
    }
    const placed = [];
    for (const l of labels) {
      const w = textWidth(l.text);
      const x = clamp(xOf(l.t) - w / 2, 0, W - w);
      if (placed.some((p) => x < p.x + p.w + 10 && p.x < x + w + 10)) continue;
      placed.push({ x, w });
      s('line', { class: 'chart-axis', x1: crisp(xOf(l.t)), x2: crisp(xOf(l.t)), y1: base, y2: base + 4 }, gAxis);
      text(gAxis, { class: 'chart-xlabel', x, y: H - 6 }, l.text);
    }

    // line segments, broken where nothing was recorded for more than gapDays
    m.geo = data.map((p) => ({ x: xOf(p.d.getTime()), y: yOf(p.value) }));
    const gLine = s('g', { 'aria-hidden': 'true' }, svg);
    let seg = [];
    const flush = () => {
      if (seg.length > 1) s('path', { class: 'chart-line', d: seg.map((g, k) => `${k ? 'L' : 'M'}${g.x.toFixed(1)},${g.y.toFixed(1)}`).join('') }, gLine);
      else if (seg.length === 1) s('circle', { class: 'chart-dot', cx: seg[0].x, cy: seg[0].y, r: 3 }, gLine);
      seg = [];
    };
    data.forEach((p, i) => {
      if (i && (p.d - data[i - 1].d) / DAY_MS > o.gapDays) flush();
      seg.push(m.geo[i]);
    });
    flush();
    const last = m.geo[m.geo.length - 1];
    s('circle', { class: 'chart-dot', cx: last.x, cy: last.y, r: 4 }, gLine);

    const hover = s('g', { class: 'ins-tl-hover', 'aria-hidden': 'true', visibility: 'hidden' }, svg);
    const vline = s('line', { class: 'chart-axis', y1: padT, y2: base }, hover);
    const hdot = s('circle', { class: 'chart-dot', r: 4 }, hover);
    const ring = s('circle', { class: 'chart-focus', r: 8, visibility: 'hidden' }, svg);
    m.lift = (i, on) => {
      if (!on || !m.geo[i]) { hover.setAttribute('visibility', 'hidden'); return; }
      const g = m.geo[i];
      vline.setAttribute('x1', crisp(g.x)); vline.setAttribute('x2', crisp(g.x));
      hdot.setAttribute('cx', g.x); hdot.setAttribute('cy', g.y);
      hover.setAttribute('visibility', 'visible');
    };
    m.ring = (i, visible) => {
      if (i < 0 || !visible || !m.geo[i]) { ring.setAttribute('visibility', 'hidden'); return; }
      ring.setAttribute('cx', m.geo[i].x); ring.setAttribute('cy', m.geo[i].y); ring.setAttribute('visibility', 'visible');
    };
    // hit bands: from midpoint to midpoint so the pointer snaps to the nearest recorded day
    const gHits = s('g', { class: 'chart-hits' }, svg);
    const activeBefore = m.hits.findIndex((el) => el.getAttribute('tabindex') === '0');
    m.hits = data.map((p, i) => {
      const x0 = i ? (m.geo[i - 1].x + m.geo[i].x) / 2 : padL;
      const x1 = i < data.length - 1 ? (m.geo[i].x + m.geo[i + 1].x) / 2 : W - padR;
      return s('rect', { class: 'chart-hit', 'data-i': i, x: x0, y: 0, width: Math.max(1, x1 - x0), height: H, tabindex: '-1', role: 'img', 'aria-label': `${dayFmt.format(p.d)}: ${fmtNum(p.value)} ${unitFor(p.value, o.valueLabel)}` }, gHits);
    });
    m.count = data.length;
    const start = activeBefore >= 0 && activeBefore < m.count ? activeBefore : m.count - 1;
    m.hits[start].setAttribute('tabindex', '0');
    m.reset?.();
    plot.replaceChildren(svg);
  }

  const fill = () => {
    fillTable(tableWrap, o.title || '', ['Day', o.valueLabel[0].toUpperCase() + o.valueLabel.slice(1)], data.map((p) => [dayFmt.format(p.d), fmtNum(p.value)]));
    note.textContent = o.caption || '';
    note.hidden = !o.caption;
  };
  data = norm(points);
  fill();
  const sizer = observe(plot, draw);
  fig.chart = {
    update(next, nextOpts) { if (nextOpts) Object.assign(o, nextOpts); data = norm(next); fill(); setLoading(fig, false); sizer.redraw(); },
    setLoading: (on) => setLoading(fig, on),
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

// ======================================================================= columns with gaps

/**
 * @param {Array<{key, label, fullLabel, value:number|null, note?:string}>} points  null = not measured
 * @param {{title?, subtitle?, height?, valueLabel?, max?, missingText?, caption?, labelHeader?}} opts
 */
export function gapBars(points, opts = {}) {
  const o = { height: 170, valueLabel: 'tracks', missingText: 'Not measured', labelHeader: 'Week', ...opts };
  const { fig, plot, note, tableWrap } = shell('gapbars', o);
  let data = [];
  const m = { hits: [], count: 0, geo: [], bars: [], svg: null, ring: () => {}, lift: () => {} };
  const norm = (pts) => (pts || []).map((p, i) => ({
    key: p.key ?? i, label: String(p.label ?? ''), fullLabel: String(p.fullLabel ?? p.label ?? ''),
    value: p.value == null || !Number.isFinite(Number(p.value)) ? null : Math.max(0, Number(p.value)), note: p.note || '',
  }));
  const valText = (v) => {
    if (v == null) return o.missingText;
    if (o.formatValue) return o.formatValue(v);
    return `${fmtNum(v)} ${unitFor(v, o.valueOne && v === 1 ? o.valueOne : o.valueLabel)}`;
  };

  m.tip = (i) => {
    const p = data[i];
    return { value: valText(p.value), label: p.fullLabel, note: p.note, color: p.value == null ? 'var(--chart-muted)' : 'var(--series-1)' };
  };
  m.anchor = (i) => {
    const g = m.geo[i]; const r = m.svg.getBoundingClientRect();
    return { left: r.left + g.x, width: g.w, top: r.top + g.top, bottom: r.top + g.base };
  };
  m.lift = (i, on) => { m.bars[i]?.classList.toggle('is-active', on); };
  wire(fig, plot, m);

  function draw(W) {
    const H = o.height;
    const svg = s('svg', { class: 'chart-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': o.title || 'Column chart' });
    m.svg = svg;
    const n = data.length;
    const vmax = Math.max(0, ...data.map((p) => p.value || 0), Number(o.max) || 0);
    const sc = niceTicks(0, vmax || 1);
    const tickLabels = sc.ticks.map(o.formatTick || fmtNum);
    const padL = Math.ceil(Math.max(...tickLabels.map((t) => textWidth(t)))) + 10;
    const padR = 2; const padT = 10; const axisBand = 24;
    const plotW = Math.max(n || 1, W - padL - padR);
    const plotH = Math.max(30, H - padT - axisBand);
    const base = padT + plotH;
    const step = n ? plotW / n : plotW;
    const barW = step >= 3 ? clamp(Math.floor(step - BAR_GAP), 1, BAR_MAX) : Math.max(1, step * 0.7);
    const yOf = (v) => base - (v / (sc.hi || 1)) * plotH;
    const gAxis = s('g', { 'aria-hidden': 'true' }, svg);
    sc.ticks.forEach((t, k) => {
      const y = yOf(t);
      if (k > 0) s('line', { class: 'chart-grid', x1: padL, x2: W - padR, y1: crisp(y), y2: crisp(y) }, gAxis);
      text(gAxis, { class: 'chart-tick', x: padL - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, tickLabels[k]);
    });
    s('line', { class: 'chart-axis', x1: padL, x2: W - padR, y1: crisp(base), y2: crisp(base) }, gAxis);
    const gBars = s('g', { 'aria-hidden': 'true' }, svg);
    m.bars = []; m.geo = [];
    data.forEach((p, i) => {
      const cx = padL + step * (i + 0.5);
      const x = Math.round(cx - barW / 2);
      let top = base;
      let bar = null;
      if (p.value == null) {
        // hollow marker on the baseline: "we don't know", visibly different from a real zero
        bar = s('rect', { class: 'ins-gap-mark', x: x + 0.5, y: base - 6.5, width: Math.max(1, barW - 1), height: 6, rx: 2 }, gBars);
        top = base - 8;
      } else if (p.value > 0) {
        const hgt = Math.max(2, base - yOf(p.value));
        top = base - hgt;
        const r = Math.max(0, Math.min(BAR_RADIUS, barW / 2, hgt));
        bar = s('path', { class: 'chart-bar', d: `M${x},${base}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + barW - r}A${r},${r} 0 0 1 ${x + barW},${top + r}V${base}Z` }, gBars);
      }
      m.bars[i] = bar;
      m.geo[i] = { x, w: barW, top, base, cx };
    });
    // sparse labels
    const gLab = s('g', { 'aria-hidden': 'true' }, svg);
    const placed = [];
    data.forEach((p, i) => {
      if (!p.label) return;
      const w = textWidth(p.label);
      const x = clamp(m.geo[i].cx - w / 2, 0, W - w);
      if (placed.some((q) => x < q.x + q.w + 10 && q.x < x + w + 10)) return;
      placed.push({ x, w });
      text(gLab, { class: 'chart-xlabel', x, y: H - 6 }, p.label);
    });
    const ring = s('rect', { class: 'chart-focus', rx: 6, ry: 6, visibility: 'hidden' }, svg);
    m.ring = (i, visible) => {
      const g = m.geo[i];
      if (i < 0 || !visible || !g) { ring.setAttribute('visibility', 'hidden'); return; }
      const hgt = Math.max(8, g.base - g.top);
      ring.setAttribute('x', g.x - 3); ring.setAttribute('y', g.base - hgt - 3);
      ring.setAttribute('width', g.w + 6); ring.setAttribute('height', hgt + 6);
      ring.setAttribute('visibility', 'visible');
    };
    const gHits = s('g', { class: 'chart-hits' }, svg);
    const activeBefore = m.hits.findIndex((el) => el.getAttribute('tabindex') === '0');
    m.hits = data.map((p, i) => s('rect', { class: 'chart-hit', 'data-i': i, x: padL + step * i, y: 0, width: step, height: H, tabindex: '-1', role: 'img', 'aria-label': `${p.fullLabel}: ${valText(p.value)}` }, gHits));
    m.count = n;
    if (n) m.hits[activeBefore >= 0 && activeBefore < n ? activeBefore : n - 1].setAttribute('tabindex', '0');
    m.reset?.();
    plot.replaceChildren(svg);
  }

  const fill = () => {
    fillTable(tableWrap, o.title || '', [o.labelHeader, o.valueLabel[0].toUpperCase() + o.valueLabel.slice(1)], data.map((p) => [p.fullLabel, valText(p.value)]));
    note.textContent = o.caption || '';
    note.hidden = !o.caption;
  };
  data = norm(points);
  fill();
  const sizer = observe(plot, draw);
  fig.chart = {
    update(next, nextOpts) { if (nextOpts) Object.assign(o, nextOpts); data = norm(next); fill(); setLoading(fig, false); sizer.redraw(); },
    setLoading: (on) => setLoading(fig, on),
    redraw: () => sizer.redraw(),
    destroy() { sizer.destroy(); hideTooltip(fig); },
  };
  return fig;
}

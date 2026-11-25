// Controller Drift Tester: the page.
//
// Reads the Gamepad API once per animation frame, plots each stick the
// controller has, and on "Measure rest" samples the sticks for SAMPLE_MS and
// reports each one's rest offset and jitter as numbers, with no grade. The
// arithmetic, the stick list per platform, the copyable reading line and the
// method prose are in drift-core.js; this file is the DOM and the canvas.
//
// Layout rule (spec §10.9): everything that appears when a pad connects or a
// measurement finishes goes after the plots, inside .drift-tool, which holds a
// full viewport. The status line above the plots only ever swaps one short
// line for another, so a connect never pushes the plots down. The readings
// blocks are there from load, for the sticks the plots show, reading "No
// controller yet" and "Not measured yet", so the tool's space is filled from
// the start (no blank band before a pad connects) and a connect only swaps
// their values; the controller's id line comes after them.
//
// The plot's colours come from site.css's custom properties. There are no
// colour values in this file. When the theme changes, assets/theme.js
// announces "dhole:theme", and the plots are redrawn from the tokens again.

import {
  BANDS, DEFAULT_PLATFORM, PLATFORMS, SAMPLE_MS, TRAIL_MAX,
  cleanPadId, formatAxis, formatDate, methodText, readingLine, sticksFor, summarise
} from "./drift-core.js";

const NOT_MEASURED = "Not measured yet";
const NO_PAD = "No controller yet";
const FEEDBACK_MS = 2000;
const STATUS = {
  waiting: "Waiting for a controller",
  connected: "Connected",
  measuring: `Measuring for ${SAMPLE_MS / 1000} seconds`
};
const NO_SAMPLES =
  `<strong>No readings came in during the ${SAMPLE_MS / 1000} seconds.</strong> ` +
  "Keep the controller connected, press a button on it, and try again.";
const UNSUPPORTED =
  "<strong>This browser can't read controllers.</strong> " +
  "Try a recent Chrome, Edge, Firefox or Safari.";

const state = {
  platform: DEFAULT_PLATFORM,
  padIndex: null,   // the pad the connect event named, when there was one
  pad: null,        // { index, id, axes } of the pad in use, or null
  lastAxes: 4,      // axes count of the last pad seen; sizes the plots between pads
  plotSticks: [],   // the sticks the plots currently show
  trails: new Map(),   // stick key -> [[x, y], ...]
  measured: new Map(), // stick key -> { summary, padId, date }
  sampling: null,      // { started, index, sticks, samples: Map } while measuring
  noSamples: false
};

const els = {};
let plots = [];     // [{ stick, canvas, ctx, size }]
let live = [];      // [{ index, x, y, lastX, lastY }] value cells updated every frame
let colours = null;
let dirty = true;   // the plots need drawing although no pad is moving them

export function initDriftTester() {
  for (const [k, id] of Object.entries({
    platform: "drift-platform", measure: "drift-measure", reset: "drift-reset", status: "drift-status",
    plots: "drift-plots", pad: "drift-pad", readings: "drift-readings", results: "drift-results",
    store: "drift-store", method: "drift-method"
  })) els[k] = document.getElementById(id);
  if (!els.plots) return;

  // Generated copy. drift-tester.html carries the same text for crawlers and
  // first paint (test/drift.test.js holds them equal), so these are no-ops.
  setText(els.method, methodText());
  setText(els.measure, `Measure rest (${SAMPLE_MS / 1000} s)`);

  colours = readColours();
  // The theme changed (assets/theme.js): read the tokens again and redraw.
  window.addEventListener("dhole:theme", () => { colours = readColours(); drawAll(); });
  state.platform = PLATFORMS[els.platform.value] ? els.platform.value : DEFAULT_PLATFORM;
  syncPlots();
  renderReadings();

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(refit).observe(els.plots);
  } else {
    window.addEventListener("resize", refit);
  }

  if (typeof navigator.getGamepads !== "function") {
    els.measure.disabled = true;
    els.results.innerHTML = `<p class="notice">${UNSUPPORTED}</p>`;
    els.results.hidden = false;
    drawAll();
    return;
  }

  // Pad ids are set in Red Hat Mono. Start loading it now so it is ready by
  // the time a pad connects (font-display: optional uses it only if it is).
  try { document.fonts.load('400 1em "Red Hat Mono"').catch(() => {}); } catch { /* no FontFaceSet */ }

  window.addEventListener("gamepadconnected", e => { state.padIndex = e.gamepad.index; });
  window.addEventListener("gamepaddisconnected", e => {
    if (state.padIndex === e.gamepad.index) state.padIndex = null;
  });
  els.platform.addEventListener("change", () => {
    state.platform = PLATFORMS[els.platform.value] ? els.platform.value : DEFAULT_PLATFORM;
    syncPlots();
    renderReadings();
    renderResults();
  });
  els.measure.addEventListener("click", startMeasure);
  els.reset.addEventListener("click", reset);

  requestAnimationFrame(frame);
}

// ---------- the pad ----------

function activePad() {
  let pads = [];
  try { pads = navigator.getGamepads() || []; } catch { return null; } // blocked by a permissions policy
  const named = state.padIndex !== null ? pads[state.padIndex] : null;
  if (named && named.connected !== false) return named;
  // The connect event can fire before this page loads; take the first pad.
  for (const p of pads) {
    if (p && p.connected !== false) { state.padIndex = p.index; return p; }
  }
  return null;
}

const currentSticks = () => (state.pad ? sticksFor(state.platform, state.pad.axes) : []);

function frame(now) {
  const pad = activePad();
  if (pad) {
    const axes = pad.axes ? pad.axes.length : 0;
    if (!state.pad || state.pad.index !== pad.index || state.pad.id !== pad.id || state.pad.axes !== axes) {
      connect(pad, axes);
    }
  } else if (state.pad) {
    disconnect();
  }

  if (state.sampling) sample(pad, now);

  if (pad) {
    for (const p of plots) {
      const x = axis(pad, p.stick.axes[0]);
      const y = axis(pad, p.stick.axes[1]);
      let trail = state.trails.get(p.stick.key);
      if (!trail) state.trails.set(p.stick.key, (trail = []));
      trail.push([x, y]);
      if (trail.length > TRAIL_MAX) trail.shift();
    }
    for (const cell of live) {
      const x = formatAxis(axis(pad, cell.axes[0]));
      const y = formatAxis(axis(pad, cell.axes[1]));
      if (x !== cell.lastX) cell.x.textContent = cell.lastX = x;
      if (y !== cell.lastY) cell.y.textContent = cell.lastY = y;
    }
  }
  if (pad || dirty) { drawAll(pad); dirty = false; }
  requestAnimationFrame(frame);
}

function axis(pad, i) {
  const v = pad.axes ? Number(pad.axes[i]) : NaN;
  return Number.isFinite(v) ? v : 0;
}

function connect(pad, axes) {
  // A different pad (or the same one reporting other axes) mid-measure
  // spoils that measurement, as a disconnect does.
  if (state.sampling) state.sampling.spoiled = true;
  state.pad = { index: pad.index, id: String(pad.id ?? ""), axes };
  state.lastAxes = axes;
  state.trails.clear();
  // Readings belong to the pad they were taken from.
  for (const [key, m] of state.measured) if (m.padId !== state.pad.id) state.measured.delete(key);
  setText(els.status, state.sampling ? STATUS.measuring : STATUS.connected);
  setText(els.pad.querySelector(".id"), cleanPadId(state.pad.id) || "No id given");
  els.pad.hidden = false;
  syncPlots();
  renderReadings();
  renderResults();
}

function disconnect() {
  state.pad = null;
  state.trails.clear();
  dirty = true;
  setText(els.status, STATUS.waiting);
  els.pad.hidden = true;
  renderReadings();
  renderResults();
}

// ---------- measuring ----------

function startMeasure() {
  const sticks = currentSticks();
  if (!state.pad || state.sampling || !sticks.length) return;
  state.measured.clear();
  state.noSamples = false;
  state.sampling = {
    started: performance.now(),
    index: state.pad.index,
    sticks,
    samples: new Map(sticks.map(s => [s.key, []]))
  };
  setText(els.status, STATUS.measuring);
  renderReadings();
  renderResults();
}

function sample(pad, now) {
  const s = state.sampling;
  // A pad that goes away mid-measure spoils the whole reading: a partial one
  // isn't a 2 s reading, and the line would say it was.
  if (!pad || pad.index !== s.index || s.spoiled) { finishMeasure(false); return; }
  const axes = pad.axes || [];
  for (const st of s.sticks) {
    const x = Number(axes[st.axes[0]]);
    const y = Number(axes[st.axes[1]]);
    if (Number.isFinite(x) && Number.isFinite(y)) s.samples.get(st.key).push([x, y]);
  }
  if (now - s.started >= SAMPLE_MS) finishMeasure(true);
}

function finishMeasure(complete) {
  const s = state.sampling;
  state.sampling = null;
  const date = formatDate(new Date());
  let any = false;
  if (complete && state.pad) {
    for (const st of s.sticks) {
      const summary = summarise(s.samples.get(st.key));
      if (!summary) continue;
      state.measured.set(st.key, { summary, padId: state.pad.id, date });
      any = true;
    }
  }
  state.noSamples = !any;
  setText(els.status, state.pad ? STATUS.connected : STATUS.waiting);
  renderReadings();
  renderResults();
}

function reset() {
  state.sampling = null;
  state.measured.clear();
  state.noSamples = false;
  state.trails.clear();
  setText(els.status, state.pad ? STATUS.connected : STATUS.waiting);
  renderReadings();
  renderResults();
  dirty = true;
}

// ---------- rendering ----------

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// The plots show the platform's sticks that the pad has. Between pads they
// keep the last pad's count, so unplugging doesn't reshuffle the page.
function syncPlots() {
  const sticks = sticksFor(state.platform, state.pad ? state.pad.axes : state.lastAxes);
  const same = sticks.length === plots.length && sticks.every((s, i) => s.key === plots[i].stick.key);
  const figures = [...els.plots.querySelectorAll("figure.plot")];
  if (sticks.length === figures.length) {
    // Reuse the figures: relabel in place.
    plots = sticks.map((stick, i) => {
      const fig = figures[i];
      setText(fig.querySelector("figcaption"), stick.label);
      const canvas = fig.querySelector("canvas");
      canvas.setAttribute("aria-label", `${stick.label} position`);
      const prev = plots[i] && plots[i].canvas === canvas ? plots[i] : null;
      return prev ? Object.assign(prev, { stick }) : { stick, canvas, ctx: canvas.getContext("2d"), size: 0 };
    });
  } else {
    plots = sticks.map(stick => {
      const canvas = el("canvas", { width: "358", height: "358", role: "img", "aria-label": `${stick.label} position` });
      const fig = el("figure", { class: "plot" });
      fig.append(el("figcaption", {}, stick.label), canvas);
      return { stick, canvas, ctx: canvas.getContext("2d"), size: 0 };
    });
    els.plots.replaceChildren(...plots.map(p => p.canvas.parentElement));
  }
  els.plots.dataset.count = String(plots.length);
  els.plots.hidden = plots.length === 0;
  for (const p of plots) fitCanvas(p);
  if (!same) dirty = true;
}

// One block per stick the pad has: an h3 and its rows. Never one for a stick
// the pad doesn't report. With no pad, one per stick the plots show, with X
// and Y reading "No controller yet": no number stands in for a reading.
function renderReadings() {
  const pad = state.pad;
  const sticks = pad ? currentSticks() : sticksFor(state.platform, state.lastAxes);
  live = [];
  const blocks = sticks.map(stick => {
    const m = state.measured.get(stick.key);
    const block = el("section", { class: "drift-stick" });
    const rows = el("dl", { class: "dl-rows" });
    const x = pad ? el("span", { class: "num" }, "0.000") : el("span", { class: "quiet" }, NO_PAD);
    const y = pad ? el("span", { class: "num" }, "0.000") : el("span", { class: "quiet" }, NO_PAD);
    const value = text => (m ? el("span", { class: "num" }, text) : el("span", { class: "quiet" }, NOT_MEASURED));
    for (const [label, node] of [
      ["X", x], ["Y", y],
      ["Rest offset", value(m && m.summary.offset.toFixed(3))],
      ["Jitter", value(m && m.summary.jitter.toFixed(3))],
      ["Samples", value(m && String(m.summary.n))]
    ]) {
      const dd = el("dd");
      dd.append(node);
      rows.append(el("dt", {}, label), dd);
    }
    block.append(el("h3", {}, stick.label), rows);
    if (pad) live.push({ axes: stick.axes, x, y, lastX: "0.000", lastY: "0.000" });
    return block;
  });
  const parts = [el("h2", { class: "visually-hidden" }, "Readings")];
  if (blocks.length) parts.push(...blocks);
  else parts.push(el("p", {}, "This controller doesn't report any sticks to the browser, so there is nothing to measure."));
  els.readings.replaceChildren(...parts);
  els.readings.dataset.count = String(blocks.length);
  els.readings.hidden = false;
  els.measure.disabled = !pad || !blocks.length || !!state.sampling;
}

// One line and one "Copy reading" button per measured stick, or the
// no-readings message. The store line follows, for the platforms it sells.
function renderResults() {
  els.measure.disabled = !state.pad || !!state.sampling || !currentSticks().length;
  const sticks = state.pad ? currentSticks() : sticksFor(state.platform, state.lastAxes);
  const done = sticks.filter(s => state.measured.has(s.key));

  if (state.noSamples) {
    els.results.replaceChildren(Object.assign(el("p", { class: "notice" }), { innerHTML: NO_SAMPLES }));
    els.results.hidden = false;
  } else if (done.length) {
    const list = el("ul", { class: "drift-lines" });
    done.forEach((stick, i) => {
      const m = state.measured.get(stick.key);
      const line = readingLine({
        label: stick.label, offset: m.summary.offset, jitter: m.summary.jitter,
        n: m.summary.n, padId: m.padId, date: m.date
      });
      const id = `drift-line-${i}`;
      // The date is kept on one line; the text is exactly the line copied.
      const p = el("p", { class: "drift-line", id });
      const cut = line.lastIndexOf(m.date);
      if (cut > 0) p.append(line.slice(0, cut), el("span", { class: "num" }, m.date), line.slice(cut + m.date.length));
      else p.textContent = line;
      const button = el("button", { type: "button", class: "btn", "aria-describedby": id }, "Copy reading");
      const said = el("span", { class: "visually-hidden", "aria-live": "polite" });
      button.addEventListener("click", () => copyReading(button, p, said));
      const li = el("li");
      li.append(p, button, said);
      list.append(li);
    });
    els.results.replaceChildren(list);
    els.results.hidden = false;
  } else {
    els.results.replaceChildren();
    els.results.hidden = true;
  }

  els.store.hidden = !(PLATFORMS[state.platform].stocked && done.length && !state.noSamples);
}

// ---------- Copy reading ----------

async function copyReading(button, p, said) {
  const text = p.textContent;
  let copied = false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch { /* no permission, or not a secure context: select it instead */ }
  if (!copied) {
    selectText(p);
    try { copied = document.execCommand("copy"); } catch { copied = false; }
  }
  feedback(button, said, copied ? "Copied" : "Selected",
    copied ? "Copied" : "The reading is selected, ready to copy.");
}

function selectText(node) {
  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* nothing to select with */ }
}

function feedback(button, said, label, message) {
  clearTimeout(button._timer);
  button.textContent = label;
  said.textContent = message;
  button._timer = setTimeout(() => {
    button.textContent = "Copy reading";
    said.textContent = "";
  }, FEEDBACK_MS);
}

// ---------- the plot ----------

function readColours() {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();
  return {
    rule: v("--rule-c"), edge: v("--edge"), graphite: v("--graphite"), ink: v("--ink"),
    font: `400 14px ${v("--font-text") || "sans-serif"}`
  };
}

// Sized in device pixels from the column the canvas sits in, so it is never
// wider than its column and never soft on a high-density screen.
function fitCanvas(p) {
  const size = p.canvas.clientWidth;
  if (!size) return;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(size * dpr);
  if (p.canvas.width !== px) p.canvas.width = px;
  if (p.canvas.height !== px) p.canvas.height = px;
  p.ctx.setTransform(px / size, 0, 0, px / size, 0, 0);
  p.size = size;
}

// A resize clears a canvas, so it is redrawn straight away rather than on the
// next frame.
function refit() {
  for (const p of plots) fitCanvas(p);
  drawAll();
}

function drawAll(pad = state.pad ? activePad() : null) {
  for (const p of plots) {
    const xy = pad ? [axis(pad, p.stick.axes[0]), axis(pad, p.stick.axes[1])] : null;
    draw(p, xy, pad ? state.trails.get(p.stick.key) : null);
  }
}

function draw(p, xy, trail) {
  const { ctx, size: w } = p;
  if (!w || !colours) return;
  const c = w / 2;
  const r = c - 8;
  const at = v => c + v * r;
  // Half-pixel offsets keep 1px lines crisp.
  const crisp = v => Math.round(v) + 0.5;
  ctx.clearRect(0, 0, w, w);

  // The 0.25 grid, across the stick's square of travel.
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.rule;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const q = crisp(at(i / 4));
    ctx.moveTo(q, at(-1)); ctx.lineTo(q, at(1));
    ctx.moveTo(at(-1), q); ctx.lineTo(at(1), q);
  }
  ctx.stroke();

  // Crosshair through centre.
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.round(c), at(-1)); ctx.lineTo(Math.round(c), at(1));
  ctx.moveTo(at(-1), Math.round(c)); ctx.lineTo(at(1), Math.round(c));
  ctx.stroke();

  // The edge of the stick's travel: 1 on the browser's scale.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colours.edge;
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();

  // The dashed ring at BANDS.deadzone, labelled with its value.
  const ring = r * BANDS.deadzone;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.graphite;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.arc(c, c, ring, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colours.graphite;
  ctx.font = colours.font;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText(String(BANDS.deadzone), c + ring * 0.71 + 4, c - ring * 0.71 - 2);

  if (!xy) return;

  // The trail: the last TRAIL_MAX positions, in ink at 55%.
  if (trail && trail.length > 1) {
    ctx.strokeStyle = colours.ink;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    trail.forEach(([tx, ty], i) => (i ? ctx.lineTo(at(tx), at(ty)) : ctx.moveTo(at(tx), at(ty))));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The stick now: an 8px ink dot. It never changes colour.
  ctx.fillStyle = colours.ink;
  ctx.beginPath(); ctx.arc(at(xy[0]), at(xy[1]), 4, 0, Math.PI * 2); ctx.fill();
}

// Controller Drift Tester
//
// Reads the Gamepad API and plots both analogue sticks live. The useful part
// is not the pretty dot -- it is the rest measurement: let go of the sticks,
// hit "Measure rest", and it samples for two seconds to report how far from
// centre the stick actually sits and how much it jitters. That is a number you
// can put in a listing.

const DEADZONE = 0.08;      // below this, most games ignore the stick entirely
const TRAIL_MAX = 90;
const SAMPLE_MS = 2000;

const state = {
  padIndex: null,
  trails: [[], []],
  peak: [0, 0],
  rest: [null, null],
  sampling: false
};

const els = {};

export function initDriftTester() {
  for (const id of [
    "status", "pad-name", "stage", "measure-btn", "reset-btn",
    "verdict", "no-support"
  ]) els[id] = document.getElementById(id);

  els.canvases = [document.getElementById("stick-0"), document.getElementById("stick-1")];
  els.readouts = [0, 1].map(i => ({
    x:    document.getElementById(`r${i}-x`),
    y:    document.getElementById(`r${i}-y`),
    mag:  document.getElementById(`r${i}-mag`),
    peak: document.getElementById(`r${i}-peak`),
    rest: document.getElementById(`r${i}-rest`)
  }));

  if (!("getGamepads" in navigator)) {
    els["no-support"].hidden = false;
    els.stage.hidden = true;
    return;
  }

  els.canvases.forEach(fitCanvas);
  window.addEventListener("resize", () => els.canvases.forEach(fitCanvas));

  window.addEventListener("gamepadconnected", e => { state.padIndex = e.gamepad.index; });
  window.addEventListener("gamepaddisconnected", e => {
    if (state.padIndex === e.gamepad.index) state.padIndex = null;
  });

  els["measure-btn"].addEventListener("click", measureRest);
  els["reset-btn"].addEventListener("click", reset);

  requestAnimationFrame(loop);
}

// Canvases must be sized in device pixels or the plot looks soft on any
// screen with a DPR above 1.
function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const size = cv.clientWidth;
  cv.width = size * dpr;
  cv.height = size * dpr;
  cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}

function activePad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (state.padIndex !== null && pads[state.padIndex]) return pads[state.padIndex];
  // Fall back to the first connected pad, so it works even if the connect
  // event fired before this page loaded.
  for (const p of pads) if (p) { state.padIndex = p.index; return p; }
  return null;
}

function loop() {
  const pad = activePad();

  if (!pad) {
    els.status.textContent = "Waiting for a controller";
    els.status.className = "status low";
    els["pad-name"].textContent = "Plug one in, then press any button on it — browsers hide gamepads until you do.";
    els["measure-btn"].disabled = true;
    els.canvases.forEach((cv, i) => draw(cv, 0, 0, i));
  } else {
    els.status.textContent = "Connected";
    els.status.className = "status in";
    els["pad-name"].textContent = pad.id;
    els["measure-btn"].disabled = state.sampling;

    for (let i = 0; i < 2; i++) {
      const x = pad.axes[i * 2] ?? 0;
      const y = pad.axes[i * 2 + 1] ?? 0;
      const mag = Math.hypot(x, y);

      if (mag > state.peak[i]) state.peak[i] = mag;

      const trail = state.trails[i];
      trail.push([x, y]);
      if (trail.length > TRAIL_MAX) trail.shift();

      draw(els.canvases[i], x, y, i);

      const r = els.readouts[i];
      r.x.textContent = x.toFixed(3);
      r.y.textContent = y.toFixed(3);
      r.mag.textContent = mag.toFixed(3);
      r.peak.textContent = state.peak[i].toFixed(3);
      r.rest.textContent = state.rest[i] === null ? "—" : state.rest[i].offset.toFixed(3);
    }
  }

  requestAnimationFrame(loop);
}

function draw(cv, x, y, idx) {
  const ctx = cv.getContext("2d");
  const w = cv.clientWidth;
  const c = w / 2;
  const r = w / 2 - 10;

  ctx.clearRect(0, 0, w, w);

  // Gate outline and crosshair
  ctx.strokeStyle = "#2a3040";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - r, c); ctx.lineTo(c + r, c);
  ctx.moveTo(c, c - r); ctx.lineTo(c, c + r);
  ctx.stroke();

  // Deadzone ring -- inside this, a game would read the stick as centred.
  ctx.strokeStyle = "#3b4459";
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.arc(c, c, r * DEADZONE * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Trail, oldest faintest
  const trail = state.trails[idx];
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  trail.forEach(([tx, ty], i) => {
    const px = c + tx * r, py = c + ty * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Current position
  const px = c + x * r, py = c + y * r;
  ctx.fillStyle = Math.hypot(x, y) > DEADZONE ? "#a78bfa" : "#34d399";
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
}

// Samples both sticks while (hopefully) untouched, then reports the mean
// distance from centre and the spread around it.
function measureRest() {
  const pad = activePad();
  if (!pad) return;

  state.sampling = true;
  els.verdict.innerHTML = `<div class="notice info">Measuring — hands off the sticks…</div>`;

  const samples = [[], []];
  const started = performance.now();

  (function sample() {
    const p = activePad();
    if (p) {
      for (let i = 0; i < 2; i++) {
        const x = p.axes[i * 2] ?? 0, y = p.axes[i * 2 + 1] ?? 0;
        samples[i].push(Math.hypot(x, y));
      }
    }
    if (performance.now() - started < SAMPLE_MS) return requestAnimationFrame(sample);

    for (let i = 0; i < 2; i++) {
      const s = samples[i];
      const offset = s.reduce((a, b) => a + b, 0) / (s.length || 1);
      const jitter = Math.max(...s) - Math.min(...s);
      state.rest[i] = { offset, jitter };
    }
    state.sampling = false;
    renderVerdict();
  })();
}

function renderVerdict() {
  const rows = ["Left stick", "Right stick"].map((label, i) => {
    const { offset, jitter } = state.rest[i];
    const v = classify(offset, jitter);
    return `<tr>
      <td>${label}</td>
      <td class="mono">${offset.toFixed(3)}</td>
      <td class="mono">${jitter.toFixed(3)}</td>
      <td class="status ${v.cls}">${v.text}</td>
    </tr>`;
  }).join("");

  els.verdict.innerHTML = `
    <table class="verdict-table">
      <thead><tr><th>Stick</th><th>Rest offset</th><th>Jitter</th><th>Verdict</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="dim" style="margin-top:.75rem">
      Rest offset is how far from centre the stick sits untouched. Jitter is the spread
      across the sample. Anything under ${DEADZONE} sits inside a typical game's deadzone
      and will not move your character on its own.
    </p>`;
}

function classify(offset, jitter) {
  if (offset < DEADZONE / 2 && jitter < 0.02) return { cls: "in",  text: "Good" };
  if (offset < DEADZONE)                      return { cls: "in",  text: "Within deadzone" };
  if (offset < DEADZONE * 2)                  return { cls: "low", text: "Slight drift" };
  return { cls: "out", text: "Significant drift" };
}

function reset() {
  state.trails = [[], []];
  state.peak = [0, 0];
  state.rest = [null, null];
  els.verdict.innerHTML = "";
}

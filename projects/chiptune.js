// Chiptune Sequencer
//
// Every sound here is generated at runtime from oscillators and a noise buffer.
// No samples, no audio library.
//
// Timing note: stepping the sequencer straight off setInterval drifts audibly,
// because timer callbacks are not sample-accurate and jitter under load. So the
// timer only acts as a *lookahead* -- it wakes up often and schedules any notes
// falling inside the next slice directly on the AudioContext clock, which is
// sample-accurate. This is the standard Web Audio scheduling pattern.

const STEPS = 16;

const TRACKS = [
  { name: "Lead",    freq: 523.25, type: "melodic", color: "#a78bfa" }, // C5
  { name: "Harmony", freq: 392.00, type: "melodic", color: "#22d3ee" }, // G4
  { name: "Alt",     freq: 329.63, type: "melodic", color: "#34d399" }, // E4
  { name: "Bass",    freq: 130.81, type: "bass",    color: "#fbbf24" }, // C3
  { name: "Snare",   freq: 0,      type: "noise",   color: "#f87171" },
  { name: "Hat",     freq: 0,      type: "hat",     color: "#98a1b3" }
];

const LOOKAHEAD_MS = 25;    // how often the timer wakes
const SCHEDULE_AHEAD = 0.1; // how far ahead (seconds) we schedule

const state = {
  pattern: TRACKS.map(() => new Array(STEPS).fill(false)),
  playing: false,
  tempo: 132,
  wave: "square",
  volume: 0.5,
  step: 0,
  nextNoteTime: 0,
  timer: null
};

let ctx = null;
let master = null;
let noiseBuffer = null;
const els = {};

export function initChiptune() {
  els.grid = document.getElementById("seq-grid");
  els.play = document.getElementById("play-btn");
  els.clear = document.getElementById("clear-btn");
  els.random = document.getElementById("random-btn");
  els.tempo = document.getElementById("tempo");
  els.tempoOut = document.getElementById("tempo-out");
  els.wave = document.getElementById("wave");
  els.volume = document.getElementById("volume");

  buildGrid();
  seedPattern();

  els.play.addEventListener("click", toggle);
  els.clear.addEventListener("click", clear);
  els.random.addEventListener("click", randomize);

  els.tempo.addEventListener("input", () => {
    state.tempo = Number(els.tempo.value);
    els.tempoOut.textContent = `${state.tempo} BPM`;
  });

  els.wave.addEventListener("change", () => { state.wave = els.wave.value; });

  els.volume.addEventListener("input", () => {
    state.volume = Number(els.volume.value) / 100;
    if (master) master.gain.value = state.volume;
  });

  // Stop the audio clock when the tab is hidden; nobody wants a rogue loop
  // playing from a background tab.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.playing) stop();
  });
}

function buildGrid() {
  els.grid.innerHTML = TRACKS.map((t, row) => `
    <div class="seq-row" style="--track-color:${t.color}">
      <span class="seq-label">${t.name}</span>
      ${Array.from({ length: STEPS }, (_, col) => `
        <button class="seq-cell${col % 4 === 0 ? " beat" : ""}"
                data-row="${row}" data-col="${col}"
                aria-pressed="false"
                aria-label="${t.name} step ${col + 1}"></button>
      `).join("")}
    </div>`).join("");

  els.grid.addEventListener("click", e => {
    const cell = e.target.closest(".seq-cell");
    if (!cell) return;
    const row = +cell.dataset.row, col = +cell.dataset.col;
    state.pattern[row][col] = !state.pattern[row][col];
    cell.setAttribute("aria-pressed", String(state.pattern[row][col]));
  });
}

function paintPattern() {
  els.grid.querySelectorAll(".seq-cell").forEach(cell => {
    cell.setAttribute("aria-pressed", String(state.pattern[+cell.dataset.row][+cell.dataset.col]));
  });
}

// Something listenable on arrival beats an empty grid.
function seedPattern() {
  const on = (row, cols) => cols.forEach(c => { state.pattern[row][c] = true; });
  on(0, [0, 6, 10]);           // lead
  on(1, [4, 12]);              // harmony
  on(2, [8, 14]);              // alt
  on(3, [0, 4, 8, 12]);        // bass on the beat
  on(4, [4, 12]);              // snare on 2 and 4
  on(5, [0, 2, 4, 6, 8, 10, 12, 14]); // steady hats
  paintPattern();
}

function ensureAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  master = ctx.createGain();
  master.gain.value = state.volume;
  master.connect(ctx.destination);

  // One second of white noise, reused for every percussion hit.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

async function toggle() {
  ensureAudio();
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === "suspended") await ctx.resume();
  state.playing ? stop() : start();
}

function start() {
  state.playing = true;
  state.step = 0;
  state.nextNoteTime = ctx.currentTime + 0.05;
  els.play.textContent = "Stop";
  els.play.classList.add("btn-primary");
  state.timer = setInterval(scheduler, LOOKAHEAD_MS);
}

function stop() {
  state.playing = false;
  clearInterval(state.timer);
  state.timer = null;
  els.play.textContent = "Play";
  els.play.classList.remove("btn-primary");
  els.grid.querySelectorAll(".playing").forEach(c => c.classList.remove("playing"));
}

// Schedule every note that falls inside the next slice, then get out of the way.
function scheduler() {
  while (state.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(state.step, state.nextNoteTime);
    highlight(state.step, state.nextNoteTime);

    // Sixteenth notes: a beat is 60/tempo, a step is a quarter of that.
    state.nextNoteTime += (60 / state.tempo) / 4;
    state.step = (state.step + 1) % STEPS;
  }
}

function scheduleStep(step, time) {
  TRACKS.forEach((track, row) => {
    if (!state.pattern[row][step]) return;
    if (track.type === "melodic") playTone(track.freq, time, 0.16, state.wave, 0.22);
    else if (track.type === "bass") playTone(track.freq, time, 0.22, "triangle", 0.34);
    else if (track.type === "noise") playNoise(time, 0.18, 1200, 0.30);
    else playNoise(time, 0.045, 7000, 0.16);
  });
}

function playTone(freq, time, dur, type, peak) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  // Short attack and exponential decay; ramping to zero would click.
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function playNoise(time, dur, cutoff, peak) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = cutoff;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  src.connect(filter).connect(gain).connect(master);
  src.start(time);
  src.stop(time + dur + 0.02);
}

// The audio is scheduled ahead of time, so the playhead has to be drawn on a
// delay to match what you are actually hearing.
function highlight(step, time) {
  const delay = Math.max(0, (time - ctx.currentTime) * 1000);
  setTimeout(() => {
    if (!state.playing) return;
    els.grid.querySelectorAll(".playing").forEach(c => c.classList.remove("playing"));
    els.grid.querySelectorAll(`.seq-cell[data-col="${step}"]`).forEach(c => c.classList.add("playing"));
  }, delay);
}

function clear() {
  state.pattern = TRACKS.map(() => new Array(STEPS).fill(false));
  paintPattern();
}

function randomize() {
  const density = [0.25, 0.18, 0.18, 0.4, 0.2, 0.55];
  state.pattern = TRACKS.map((_, row) =>
    Array.from({ length: STEPS }, () => Math.random() < density[row]));
  paintPattern();
}

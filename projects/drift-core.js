// Controller Drift Tester: the measuring, with no DOM. The page
// (drift-tester.js) and test/drift.test.js both import it.
//
// Scale: the Gamepad API reports each stick axis from -1 to 1, so the edge of
// a stick's travel is 1 and centre is 0. Every number this tester prints is on
// that scale. BANDS is the only scale constant: the plot's dashed ring and the
// "How this is measured" prose are both drawn from it, so they can't disagree.
// It holds no threshold for grading a stick. Games set their own deadzones,
// and the tester reports numbers without a grade.

export const BANDS = Object.freeze({ deadzone: 0.08 });

// How long Measure rest samples for.
export const SAMPLE_MS = 2000;

// How many recent positions the plot's trail keeps.
export const TRAIL_MAX = 90;

// The longest a reading line may be. RefurbOS details lines hold up to 200
// characters, and a reading is pasted into one.
export const READING_MAX = 200;

const stick = (label, axes) => Object.freeze({ label, axes: Object.freeze(axes), key: axes.join(",") });

// The platform picker. Each platform lists the sticks it can have, by the
// Gamepad API axes they arrive on. `stocked` marks the platforms the store
// sells, which get the "Need a controller?" line once a stick is measured.
export const PLATFORMS = Object.freeze({
  n64: Object.freeze({
    label: "Nintendo 64", stocked: true,
    sticks: Object.freeze([stick("Stick", [0, 1])])
  }),
  gamecube: Object.freeze({
    label: "GameCube", stocked: true,
    sticks: Object.freeze([stick("Control stick", [0, 1]), stick("C-stick", [2, 3])])
  }),
  other: Object.freeze({
    label: "Something else", stocked: false,
    sticks: Object.freeze([stick("Left stick", [0, 1]), stick("Right stick", [2, 3])])
  })
});
export const DEFAULT_PLATFORM = "other";

// The sticks this platform has that a pad with `axesCount` axes can report.
// A stick whose axes the pad doesn't have is left out, never shown as zero.
export function sticksFor(platform, axesCount) {
  const p = PLATFORMS[platform] || PLATFORMS[DEFAULT_PLATFORM];
  const n = Number.isInteger(axesCount) && axesCount > 0 ? axesCount : 0;
  return p.sticks.filter(s => s.axes.every(a => a < n));
}

// samples: [[x, y], ...] for one stick. Returns null when there is nothing to
// summarise. offset is the distance from centre to the mean position (the
// mean of the vectors, so noise around centre averages out instead of adding
// up). jitter is the root mean square distance of the samples from that mean
// position, which doesn't grow with the number of samples the way a
// max-minus-min spread does on a faster display.
export function summarise(samples) {
  if (!Array.isArray(samples)) return null;
  const pts = [];
  for (const s of samples) {
    if (!Array.isArray(s)) continue;
    const x = Number(s[0]);
    const y = Number(s[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
  }
  const n = pts.length;
  if (!n) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let ss = 0;
  for (const [x, y] of pts) ss += (x - mx) ** 2 + (y - my) ** 2;
  return { offset: Math.hypot(mx, my), jitter: Math.sqrt(ss / n), n, x: mx, y: my };
}

// A reading to three decimals, with a true minus sign, and never "-0.000".
export function formatAxis(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 0.0005) return "0.000";
  return n < 0 ? `−${(-n).toFixed(3)}` : n.toFixed(3);
}

const fixed3 = v => (Number.isFinite(v) && v >= 0.0005 ? v.toFixed(3) : "0.000");

// A pad's id as the browser gives it, made safe to print: whitespace runs
// become one space, and control and format characters (including bidi
// overrides that could reorder the line) are removed.
export function cleanPadId(id) {
  return String(id ?? "")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

// Shortens text to at most `room` UTF-16 units, ending in "…" when it had to
// cut. Cuts between code points, never inside one.
function fit(text, room) {
  if (text.length <= room) return text;
  if (room < 1) return "";
  let out = "";
  for (const ch of text) {
    if (out.length + ch.length > room - 1) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

// Local date as YYYY-MM-DD.
export function formatDate(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The line "Copy reading" copies, in the form a RefurbOS "Measured:" details
// line takes:
//   Measured: Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, <pad.id>, 2026-11-24)
// Always starts "Measured: " and is never longer than READING_MAX: a long
// pad id is cut to fit, ending in "…".
export function readingLine({ label, offset, jitter, n, padId, date }) {
  const when = date instanceof Date ? formatDate(date) : String(date ?? formatDate());
  const count = Number.isInteger(n) ? n : 0;
  const head = `Measured: ${label} rest offset ${fixed3(offset)}, jitter ${fixed3(jitter)} ` +
    `(${SAMPLE_MS / 1000} s, ${count} ${count === 1 ? "sample" : "samples"}, `;
  const tail = `, ${when})`;
  const pad = cleanPadId(padId) || "no controller id";
  return head + fit(pad, READING_MAX - head.length - tail.length) + tail;
}

// The "How this is measured" paragraph. The page writes it from here, and
// test/drift.test.js holds the copy in drift-tester.html equal to it.
export function methodText() {
  return `Measure rest samples each stick for ${SAMPLE_MS / 1000} seconds. ` +
    "Rest offset is the distance from centre to the stick's average resting position, " +
    "on the browser's scale where the edge of the stick's travel is 1. " +
    "Jitter is how far the readings spread around that position (root mean square). " +
    `The dashed ring is drawn at ${BANDS.deadzone}, a common size for a game's deadzone. ` +
    "Games set their own deadzones, so this page reports numbers without a grade. " +
    "The dot shows the stick's current position; the fading trail is only a guide.";
}

// A unit's record: the `details` lines RefurbOS pushes, read as labelled rows.
//
// RefurbOS writes up to 12 free-text lines per unit. A line that starts with
// one of the prefixes below (any letter case, after trimming) belongs to that
// row; anything else is a note. Nothing is dropped, so a record written
// before this format existed still shows every line, under Notes.
//
//   Works: Boots and plays 3 cartridges for 60 minutes.        -> Tested
//   Looks: Scuff on the right side, about 4 mm (photo 6).      -> Marks and wear
//   Region: NTSC                                               -> a note
//
// "(photo N)" points a line at photo N of the unit. References are optional:
// a record without any is complete, and the flaw summary then points at the
// Marks and wear row instead of a photo.
//
// Pure: no DOM, so the product page and node tests share it. linkRefs()
// returns HTML and escapes the text itself; everything else returns data.

import { esc } from "./esc.js";

// RefurbOS prefix -> the row label buyers see, in display order.
export const PREFIXES = Object.freeze([
  Object.freeze({ key: "works", prefix: "Works:", label: "Tested" }),
  Object.freeze({ key: "replaced", prefix: "Replaced:", label: "Replaced" }),
  Object.freeze({ key: "measured", prefix: "Measured:", label: "Measured" }),
  Object.freeze({ key: "looks", prefix: "Looks:", label: "Marks and wear" }),
  Object.freeze({ key: "box", prefix: "In the box:", label: "In the box" }),
  Object.freeze({ key: "missing", prefix: "Not included:", label: "Not included" }),
  Object.freeze({ key: "output", prefix: "Output:", label: "Video output" })
]);

const REF = /\(photo (\d{1,2})\)/gi;

// { rows: [{ key, label, lines[] }], notes: string[] }. Rows come in PREFIXES
// order and only when they have a line. A line whose prefix has nothing
// after it is kept, whole, as a note. Blank lines carry nothing and go.
export function parseRecord(details) {
  const byKey = new Map();
  const notes = [];
  for (const raw of Array.isArray(details) ? details : []) {
    if (typeof raw !== "string") continue;
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const match = PREFIXES.find(p => lower.startsWith(p.prefix.toLowerCase()));
    const rest = match ? line.slice(match.prefix.length).trim() : "";
    if (!match || !rest) { notes.push(line); continue; }
    if (!byKey.has(match.key)) byKey.set(match.key, []);
    byKey.get(match.key).push(rest);
  }
  const rows = PREFIXES.filter(p => byKey.has(p.key))
    .map(p => ({ key: p.key, label: p.label, lines: byKey.get(p.key) }));
  return { rows, notes };
}

// The photo numbers a line refers to, in the order written: "(photo 5)" -> 5.
export function refsIn(text) {
  return [...String(text ?? "").matchAll(REF)].map(m => Number(m[1]));
}

// [6] "photo 6"; [5,8] "photos 5 and 8"; [5,6,7] "photos 5 to 7";
// [2,3,4,7] "photos 2 to 4 and 7"; [2,5,8] "photos 2, 5 and 8".
// Duplicates count once; the numbers are read in ascending order.
export function photoPhrase(nums) {
  const list = [...new Set((nums || []).filter(n => Number.isInteger(n)))].sort((a, b) => a - b);
  if (!list.length) return "";
  if (list.length === 1) return `photo ${list[0]}`;
  const parts = [];
  for (let i = 0; i < list.length;) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    // Three or more in a row read as a range; two stay separate words.
    if (j - i >= 2) parts.push(`${list[i]} to ${list[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(list[k]));
    i = j + 1;
  }
  const words = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `photos ${words}`;
}

const marks = n => `${n} mark${n === 1 ? "" : "s"}`;

// The line under the price: how many marks the record lists, and where to
// see them. Only Looks lines count. It points at photos only when every
// Looks line names at least one photo and every photo it names exists;
// otherwise it points at the Marks and wear row, which lists them all.
//   { text: "3 marks, shown in photos 5 to 7", photo: 5 }
//   { text: "3 marks, listed under Marks and wear", photo: null }
// null when there are no Looks lines.
export function flawSummary(rows, imageCount) {
  const looks = (rows || []).find(r => r.key === "looks");
  const lines = looks ? looks.lines : [];
  if (!lines.length) return null;
  const count = Number.isInteger(imageCount) ? imageCount : 0;
  const perLine = lines.map(refsIn);
  const all = perLine.flat();
  const inRange = n => n >= 1 && n <= count;
  if (all.length && perLine.every(refs => refs.length > 0) && all.every(inRange)) {
    return { text: `${marks(lines.length)}, shown in ${photoPhrase(all)}`, photo: Math.min(...all) };
  }
  return { text: `${marks(lines.length)}, listed under Marks and wear`, photo: null };
}

// A record line as HTML: the text escaped first, then each "(photo N)" that
// names a real photo turned into a button that shows it. An N past the last
// photo stays plain text. The buttons carry data-photo for the page to wire.
// The brackets and the button share a .ref-group span that doesn't wrap: a
// button is an atomic inline, so the line could otherwise break between
// "(" and "photo 6".
export function linkRefs(text, imageCount) {
  return esc(text).replace(REF, (whole, digits) => {
    const n = Number(digits);
    if (!(n >= 1 && n <= imageCount)) return whole;
    return `<span class="ref-group">(<button class="ref" type="button" data-photo="${n}" aria-label="Show photo ${n} of ${imageCount}">photo ${n}</button>)</span>`;
  });
}

// A Measured line's readings ("0.018") in even-width figures. Takes HTML
// that has already been escaped (linkRefs output).
export const markReadings = html => html.replace(/\d+\.\d{3}/g, m => `<span class="num">${m}</span>`);

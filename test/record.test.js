// assets/record.js: how a unit's RefurbOS `details` lines become the product
// page's record rows, the photo phrases, the flaw summary under the price,
// and the escaped HTML of a line whose "(photo N)" references are buttons.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { harness } from "./support/harness.js";
import {
  PREFIXES, parseRecord, refsIn, photoPhrase, flawSummary, linkRefs, markReadings
} from "../assets/record.js";

const { section, test, run } = harness();

// The record example from the redesign spec (§15), fixture data only.
const PAD = "USB Gamepad (Vendor: 0079 Product: 0006)";
const SPEC_RECORD = [
  "Works: Boots and plays 3 cartridges for 60 minutes. All 4 controller ports read. Composite video and stereo audio checked.",
  "Replaced: Power supply filter capacitors (new, aftermarket).",
  `Measured: Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, ${PAD}, 2026-11-24)`,
  "Looks: Light yellowing on the lid (photo 5).",
  "Looks: Scuff on the right side, about 4 mm (photo 6).",
  "In the box: Console, 1 controller, Jumper Pak, power supply, composite AV cable.",
  "Not included: Expansion Pak, HDMI adapter, games.",
  "Output: Composite video only. Most modern TVs need an adapter."
];

section("parseRecord");

test("the spec's record: one row per prefix, in display order, with the labels buyers see", () => {
  const { rows, notes } = parseRecord(SPEC_RECORD);
  assert.deepEqual(rows.map(r => r.label),
    ["Tested", "Replaced", "Measured", "Marks and wear", "In the box", "Not included", "Video output"]);
  assert.deepEqual(rows.map(r => r.key), PREFIXES.map(p => p.key));
  assert.deepEqual(rows.find(r => r.key === "looks").lines,
    ["Light yellowing on the lid (photo 5).", "Scuff on the right side, about 4 mm (photo 6)."]);
  assert.deepEqual(rows.find(r => r.key === "works").lines, [SPEC_RECORD[0].slice("Works:".length).trim()]);
  assert.deepEqual(rows.find(r => r.key === "measured").lines,
    [`Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, ${PAD}, 2026-11-24)`]);
  assert.deepEqual(notes, []);
});

test("rows follow PREFIXES order whatever order the lines come in", () => {
  const { rows } = parseRecord([...SPEC_RECORD].reverse());
  assert.deepEqual(rows.map(r => r.label),
    ["Tested", "Replaced", "Measured", "Marks and wear", "In the box", "Not included", "Video output"]);
  // Two lines under one prefix keep their own order.
  assert.deepEqual(rows.find(r => r.key === "looks").lines,
    ["Scuff on the right side, about 4 mm (photo 6).", "Light yellowing on the lid (photo 5)."]);
});

test("unknown lines go to notes, whole and in order; nothing with content is dropped", () => {
  const details = [
    "Region: NTSC (North America)",
    "Works: Plays 4 cartridges.",
    "Cartridge slot cleaned, every contact reads",
    "Looks:",                       // a prefix with nothing after it
    "   ",                          // blank: carries nothing
    "Worksheet attached"            // starts like a prefix but isn't one
  ];
  const { rows, notes } = parseRecord(details);
  assert.deepEqual(rows, [{ key: "works", label: "Tested", lines: ["Plays 4 cartridges."] }]);
  assert.deepEqual(notes, ["Region: NTSC (North America)", "Cartridge slot cleaned, every contact reads", "Looks:", "Worksheet attached"]);
  const kept = rows.reduce((n, r) => n + r.lines.length, 0) + notes.length;
  assert.equal(kept, details.filter(d => d.trim()).length);
});

test("prefixes match in any letter case, after trimming", () => {
  const { rows, notes } = parseRecord(["  WORKS: boots", "in THE box: console", "looks:scuffed (photo 2)", "not Included: games"]);
  assert.deepEqual(rows.map(r => [r.label, r.lines]), [
    ["Tested", ["boots"]], ["Marks and wear", ["scuffed (photo 2)"]], ["In the box", ["console"]], ["Not included", ["games"]]
  ]);
  assert.deepEqual(notes, []);
});

test("no details, or not a list: an empty record", () => {
  assert.deepEqual(parseRecord([]), { rows: [], notes: [] });
  assert.deepEqual(parseRecord(undefined), { rows: [], notes: [] });
  assert.deepEqual(parseRecord("Works: x"), { rows: [], notes: [] });
  assert.deepEqual(parseRecord([null, 4, "Works: ok"]).rows, [{ key: "works", label: "Tested", lines: ["ok"] }]);
});

section("refsIn and photoPhrase");

test("refsIn reads every (photo N), in any case, one or two digits", () => {
  assert.deepEqual(refsIn("Light yellowing (photo 5) and a scuff (Photo 12)."), [5, 12]);
  assert.deepEqual(refsIn("photo 5 without brackets, (photo 123), (photos 4)"), []);
  assert.deepEqual(refsIn(""), []);
});

test("photoPhrase, the spec's cases", () => {
  assert.equal(photoPhrase([6]), "photo 6");
  assert.equal(photoPhrase([5, 8]), "photos 5 and 8");
  assert.equal(photoPhrase([5, 6, 7]), "photos 5 to 7");
  assert.equal(photoPhrase([2, 3, 4, 7]), "photos 2 to 4 and 7");
  assert.equal(photoPhrase([2, 5, 8]), "photos 2, 5 and 8");
});

test("photoPhrase: two in a row stay two words; duplicates and order don't matter", () => {
  assert.equal(photoPhrase([5, 6]), "photos 5 and 6");
  assert.equal(photoPhrase([7, 5, 6, 6]), "photos 5 to 7");
  assert.equal(photoPhrase([1, 2, 4, 5, 6, 8]), "photos 1, 2, 4 to 6 and 8");
  assert.equal(photoPhrase([]), "");
});

section("flawSummary");

const looks = (...lines) => [{ key: "looks", label: "Marks and wear", lines }];

test("every reference in range: the count and the photos, pointing at the first", () => {
  const { rows } = parseRecord([
    "Looks: Light yellowing on the lid (photo 5).",
    "Looks: Scuff on the right side (photo 6).",
    "Looks: Small chip on the slot cover (photo 7)."
  ]);
  assert.deepEqual(flawSummary(rows, 8), { text: "3 marks, shown in photos 5 to 7", photo: 5 });
  assert.deepEqual(flawSummary(looks("A scuff (photo 3)."), 4), { text: "1 mark, shown in photo 3", photo: 3 });
  assert.deepEqual(flawSummary(looks("Scuffs (photo 8) and (photo 2).", "Dent (photo 5)."), 8),
    { text: "2 marks, shown in photos 2, 5 and 8", photo: 2 });
});

test("a reference past the last photo: the count, listed under Marks and wear", () => {
  assert.deepEqual(flawSummary(looks("A mark (photo 1).", "A mark (photo 9)."), 2),
    { text: "2 marks, listed under Marks and wear", photo: null });
  assert.deepEqual(flawSummary(looks("A mark (photo 0)."), 2),
    { text: "1 mark, listed under Marks and wear", photo: null });
});

test("no references at all is a complete record: listed under Marks and wear", () => {
  assert.deepEqual(flawSummary(looks("Light yellowing on the lid.", "Scuff on the right side."), 8),
    { text: "2 marks, listed under Marks and wear", photo: null });
});

test("a Looks line with no reference beside ones with: listed, not 'shown in'", () => {
  // Saying "shown in photo 5" would claim the unreferenced mark is in it too.
  assert.deepEqual(flawSummary(looks("Yellowing (photo 5).", "A scuff somewhere."), 8),
    { text: "2 marks, listed under Marks and wear", photo: null });
});

test("only Looks lines count: a reference under Works isn't a mark", () => {
  const { rows } = parseRecord(["Works: label intact (photo 2)", "Looks: Scuff on the lid (photo 3)."]);
  assert.deepEqual(flawSummary(rows, 4), { text: "1 mark, shown in photo 3", photo: 3 });
  assert.equal(flawSummary(parseRecord(["Works: label intact (photo 2)"]).rows, 4), null);
});

test("no Looks lines: null", () => {
  assert.equal(flawSummary([], 8), null);
  assert.equal(flawSummary(parseRecord(SPEC_RECORD.filter(l => !l.startsWith("Looks:"))).rows, 8), null);
  assert.equal(flawSummary(looks(), 8), null);
});

section("linkRefs and markReadings: escaped first, then linked");

test("a reference in range becomes a button inside its brackets, kept on one line; one past the end stays text", () => {
  const html = linkRefs("Scuff (photo 6), dent (photo 9).", 8);
  assert.equal(html,
    'Scuff <span class="ref-group">(<button class="ref" type="button" data-photo="6" aria-label="Show photo 6 of 8">photo 6</button>)</span>, dent (photo 9).');
});

test("hostile Looks text is escaped before the references are replaced", () => {
  const { rows } = parseRecord([
    `Looks: <i>scratch</i> & "dent" on the lid (photo 1).`,
    `Looks: a mark near <script>alert(2)</script> (photo 9).`,
    `Looks: <img src=x onerror=alert(1)>(photo 2)<button>(photo 1)</button>`
  ]);
  const html = rows[0].lines.map(l => linkRefs(l, 2)).join("\n");
  assert.ok(!/<(i|script|img)\b/i.test(html), html);
  assert.ok(html.includes("&lt;i&gt;scratch&lt;/i&gt; &amp; &quot;dent&quot;"), html);
  assert.ok(html.includes("&lt;script&gt;alert(2)&lt;/script&gt; (photo 9)"), "out of range stays plain, escaped");
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;<span class="ref-group">('), html);
  // The only real tags are the reference buttons (and their no-wrap spans)
  // this function made.
  const tags = [...html.matchAll(/<(\/?)([a-z]+)\b([^>]*)>/gi)];
  assert.ok(tags.every(m => m[1] ? /^(button|span)$/i.test(m[2])
    : (m[2] === "button" && m[3].startsWith(' class="ref" type="button"')) || (m[2] === "span" && m[3] === ' class="ref-group"')),
  tags.map(m => m[0]).join(","));
  assert.equal((html.match(/<button class="ref"/g) || []).length, 3);
  // A "(photo N)" written inside hostile markup is linked as text, never as markup.
  assert.ok(html.includes('&lt;button&gt;<span class="ref-group">(<button class="ref" type="button" data-photo="1"'), html);
});

test("markReadings wraps three-decimal readings in .num and nothing else", () => {
  const html = markReadings(linkRefs("Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, pad 0079, 2026-11-24)", 8));
  assert.equal(html, 'Stick rest offset <span class="num">0.018</span>, jitter <span class="num">0.006</span> (2 s, 118 samples, pad 0079, 2026-11-24)');
});

await run();

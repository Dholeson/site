// Gate tests for the vendored Gen I parser under projects/gen1/parser/.
//
// That directory is a COMPILED COPY of server/src/parser/ in the `dex` repo
// (see scripts/sync-gen1.mjs). The dex repo has its own, larger suite. These
// tests exist to catch the things that can break *in the copy*:
//
//   1. the vendored modules still import each other correctly as browser ESM
//   2. the parser genuinely runs on a plain Uint8Array, not just a Node Buffer
//   3. a resync did not silently change what the offsets decode to
//
// (2) is the load-bearing claim of the whole browser port. If it ever fails,
// the demo page is broken no matter how green everything else is.
//
// Synthetic saves only — built here, byte by byte, with known values. No .sav
// binaries are committed to this repo.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { parseSave } from "../projects/gen1/parser/index.js";
import { encodeText } from "../projects/gen1/parser/charmap.js";
import { encodeBCD, MONEY_OFFSET, MONEY_BYTES } from "../projects/gen1/parser/bcd.js";
import { setBit, DEX_OWNED_OFFSET, DEX_SEEN_OFFSET } from "../projects/gen1/parser/bitfield.js";
import { writeChecksum, CHECKSUM_ADDR } from "../projects/gen1/parser/checksum.js";

const SAV_SIZE = 0x8000;
const PLAYER_NAME_OFFSET = 0x2598;
const RIVAL_NAME_OFFSET  = 0x25F6;
const NAME_FIELD_LEN     = 11;
const BADGE_OFFSET       = 0x2602;
const PIKACHU_HAPPY      = 0x271A;
const PT_HOURS   = 0x2CED;
const PT_MINUTES = 0x2CEF;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

// Build a structurally valid save with a correct checksum.
function makeSave({ player = "RED", rival = "BLUE", money = 3000,
                    badges = 0, hours = 5, minutes = 30,
                    owned = [], seen = [], yellow = false } = {}) {
  const buf = Buffer.alloc(SAV_SIZE, 0x00);
  encodeText(player, NAME_FIELD_LEN).copy(buf, PLAYER_NAME_OFFSET);
  encodeText(rival,  NAME_FIELD_LEN).copy(buf, RIVAL_NAME_OFFSET);
  encodeBCD(money, MONEY_BYTES).copy(buf, MONEY_OFFSET);
  buf[BADGE_OFFSET] = badges;
  buf[PT_HOURS]   = hours;
  buf[PT_MINUTES] = minutes;
  if (yellow) buf[PIKACHU_HAPPY] = 200;
  for (const dex of owned) setBit(buf, DEX_OWNED_OFFSET, dex, true);
  for (const dex of seen)  setBit(buf, DEX_SEEN_OFFSET,  dex, true);
  writeChecksum(buf);
  return buf;
}

console.log("\ngen I parser (vendored copy)\n");

// ── The claim the browser port rests on ────────────────────────────────────

test("read path never touches Buffer", () => {
  // The vendored modules also carry the WRITE side (encodeText, encodeBCD),
  // which allocates a Node Buffer and therefore throws in a browser. The demo
  // page only ever calls parseSave, so that dead code is harmless — but
  // "harmless" is an assumption, and this is the test that holds it.
  //
  // Deleting globalThis.Buffer is an exact stand-in for the browser: if
  // anything reachable from parseSave references it, this throws.
  const buf = makeSave({ player: "DHOLE", money: 54321, badges: 0x7F, owned: [1, 25] });
  const view = new Uint8Array(buf);

  const realBuffer = globalThis.Buffer;
  delete globalThis.Buffer;
  try {
    const save = parseSave(view);
    assert.equal(save.playerName, "DHOLE");
    assert.equal(save.money, 54321);
    assert.equal(save.badges.count, 7);
    assert.equal(save.pokedex.ownedCount, 2);
    assert.equal(save.boxes.length, 12);
  } finally {
    globalThis.Buffer = realBuffer;
  }
});

test("parses a plain Uint8Array identically to a Buffer", () => {
  const buf = makeSave({ player: "ASH", money: 12345, owned: [1, 4, 7] });
  const view = new Uint8Array(buf);            // no Buffer methods at all
  assert.ok(!Buffer.isBuffer(view), "test setup: view must not be a Buffer");

  const fromBuffer = parseSave(buf);
  const fromView   = parseSave(view);

  assert.equal(fromView.playerName, fromBuffer.playerName);
  assert.equal(fromView.money, fromBuffer.money);
  assert.equal(fromView.pokedex.ownedCount, fromBuffer.pokedex.ownedCount);
  assert.equal(fromView.checksum.valid, fromBuffer.checksum.valid);
  assert.deepEqual(fromView.badges, fromBuffer.badges);
});

// ── Size guard ─────────────────────────────────────────────────────────────

test("rejects a file that is not exactly 32 KB", () => {
  const short = parseSave(new Uint8Array(1024));
  assert.equal(short.valid, false);
  assert.match(short.error, /32768|32 KB/i);

  // A whole ROM dump is the usual mistake — must not be parsed as a save.
  const rom = parseSave(new Uint8Array(1024 * 1024));
  assert.equal(rom.valid, false);
});

// ── Field decoding ─────────────────────────────────────────────────────────

test("decodes trainer and rival names through the Gen I charmap", () => {
  const save = parseSave(new Uint8Array(makeSave({ player: "DHOLE", rival: "GARY" })));
  assert.equal(save.playerName, "DHOLE");
  assert.equal(save.rivalName, "GARY");
});

test("decodes money as binary-coded decimal", () => {
  // BCD is why 999999 is the cap and why a naive byte read gives nonsense.
  assert.equal(parseSave(new Uint8Array(makeSave({ money: 0 }))).money, 0);
  assert.equal(parseSave(new Uint8Array(makeSave({ money: 123456 }))).money, 123456);
  assert.equal(parseSave(new Uint8Array(makeSave({ money: 999999 }))).money, 999999);
});

test("maps badge bits to the right gyms", () => {
  // bit 0 = Boulder (Brock), bit 7 = Earth (Giovanni).
  const boulderOnly = parseSave(new Uint8Array(makeSave({ badges: 0b00000001 })));
  assert.equal(boulderOnly.badges.boulder, true);
  assert.equal(boulderOnly.badges.earth, false);
  assert.equal(boulderOnly.badges.count, 1);

  const earthOnly = parseSave(new Uint8Array(makeSave({ badges: 0b10000000 })));
  assert.equal(earthOnly.badges.earth, true);
  assert.equal(earthOnly.badges.boulder, false);

  const all = parseSave(new Uint8Array(makeSave({ badges: 0xFF })));
  assert.equal(all.badges.count, 8);
});

test("decodes the owned and seen dex bitfields independently", () => {
  // Seen is a superset in real play, but they are separate 19-byte fields and
  // the parser must not conflate them.
  const save = parseSave(new Uint8Array(makeSave({
    owned: [1, 25, 151],
    seen:  [1, 25, 151, 4, 7]
  })));
  assert.equal(save.pokedex.ownedCount, 3);
  assert.equal(save.pokedex.seenCount, 5);
  assert.equal(save.pokedex.owned[0], true);    // Bulbasaur, dex 1 → index 0
  assert.equal(save.pokedex.owned[24], true);   // Pikachu
  assert.equal(save.pokedex.owned[150], true);  // Mew
  assert.equal(save.pokedex.owned[3], false);   // Charmander seen, not owned
  assert.equal(save.pokedex.seen[3], true);
});

test("reports playtime, including the 255-hour cap", () => {
  const save = parseSave(new Uint8Array(makeSave({ hours: 255, minutes: 59 })));
  assert.equal(save.playtime.hours, 255);
  assert.equal(save.playtime.minutes, 59);
});

test("detects Yellow from the Pikachu happiness byte", () => {
  assert.equal(parseSave(new Uint8Array(makeSave({ yellow: true }))).version, "yellow");
  assert.equal(parseSave(new Uint8Array(makeSave({ yellow: false }))).version, "red_blue");
});

// ── Checksum ───────────────────────────────────────────────────────────────

test("accepts a save whose checksum matches", () => {
  const save = parseSave(new Uint8Array(makeSave()));
  assert.equal(save.checksum.valid, true);
  assert.equal(save.valid, true);
  assert.equal(save.error, undefined);
});

test("flags a bad checksum but still parses every field", () => {
  // A dying save battery corrupts bytes; the page needs to show what survived
  // rather than refusing outright, so partial data must still come back.
  const buf = makeSave({ player: "DHOLE", money: 4200, badges: 0x03 });
  buf[CHECKSUM_ADDR] = (buf[CHECKSUM_ADDR] + 1) & 0xFF;

  const save = parseSave(new Uint8Array(buf));
  assert.equal(save.checksum.valid, false);
  assert.equal(save.valid, false);
  assert.match(save.error, /checksum/i);
  assert.equal(save.playerName, "DHOLE");   // still readable
  assert.equal(save.money, 4200);
  assert.equal(save.badges.count, 2);
});

test("notices a single flipped bit anywhere in the checksummed block", () => {
  const buf = makeSave();
  buf[0x2700] ^= 0x01;   // inside 0x2598–0x3522, checksum not recomputed
  assert.equal(parseSave(new Uint8Array(buf)).checksum.valid, false);
});

// ── Boxes ──────────────────────────────────────────────────────────────────

test("returns all twelve boxes even when they are empty", () => {
  const save = parseSave(new Uint8Array(makeSave()));
  assert.equal(save.boxes.length, 12);
  assert.deepEqual(save.boxes.map(b => b.boxNumber), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(save.boxes.reduce((n, b) => n + b.count, 0), 0);
  assert.equal(save.party.length, 0);
});

console.log(`\n${passed} passed\n`);

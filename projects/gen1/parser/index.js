// Gen I save file parser — main entry point.
//
// Reads a 32 KB (0x8000 byte) .sav dump and returns a fully typed SaveState.
// This module is PURE — it never writes to the buffer or touches the filesystem.
//
// Save file layout (linear SRAM dump):
//   0x0000–0x1FFF  SRAM bank 0  (backup / misc)
//   0x2000–0x3FFF  SRAM bank 1  (main save: player, dex, party, etc.)
//   0x4000–0x5FFF  SRAM bank 2  (boxes 1–6)
//   0x6000–0x7FFF  SRAM bank 3  (boxes 7–12, Hall of Fame)
//
// All offsets below are absolute file offsets (0-based).
import { validateChecksum } from './checksum.js';
import { decodeText } from './charmap.js';
import { unpackOwned, unpackSeen, DEX_COUNT } from './bitfield.js';
import { decodeBCD, MONEY_OFFSET, MONEY_BYTES } from './bcd.js';
import { parseBoxPokemon, parsePartyPokemon, BOX_POKEMON_BYTES, PARTY_POKEMON_BYTES, NAME_BYTES } from './pokemon.js';
// ── Offsets ────────────────────────────────────────────────────────────────
const SAV_SIZE = 0x8000; // 32 KB
const PLAYER_NAME_OFFSET = 0x2598; // 11 bytes
const RIVAL_NAME_OFFSET = 0x25F6; // 11 bytes
const NAME_FIELD_LEN = 11;
const BADGE_OFFSET = 0x2602; // 1 byte; bit 0=Boulder … bit 7=Earth
const PIKACHU_HAPPY_OFFSET = 0x271A; // Yellow-only; non-zero → probably Yellow
// Playtime
const PT_HOURS_OFFSET = 0x2CED;
const PT_MINUTES_OFFSET = 0x2CEF;
const PT_SECONDS_OFFSET = 0x2CF0;
const PT_FRAMES_OFFSET = 0x2CF1;
// Current box index (0-based, 0–11).  wCurrentBoxNum in pret/pokered wram.asm.
const CURRENT_BOX_OFFSET = 0x284C; // 1 byte; low 7 bits = box index
// Party structure
//   0x2F2C: count byte (0–6)
//   0x2F2D: species list (7 bytes: 6 slots + 0xFF terminator)
//   0x2F34: 6 × 44-byte Pokémon data
//   0x2F34 + 6*44 = 0x2F34 + 0x198 = 0x30CC → wait, let me compute:
//   After species list ends at 0x2F34, party data starts at 0x2F34.
//   Actually: count(1) + species_list(7) = 8 bytes before party data.
//   Party data offset: 0x2F2C + 8 = 0x2F34
//   After 6 × 44 bytes (0x198): OT names start at 0x2F34 + 0x198 = 0x30CC
//   After 6 × 11 bytes (0x42):  nicknames start at 0x30CC + 0x42 = 0x310E
const PARTY_COUNT_OFFSET = 0x2F2C;
const PARTY_SPECIES_LIST = 0x2F2D; // 7 bytes (6 + terminator)
const PARTY_DATA_OFFSET = 0x2F34;
const PARTY_OT_NAMES = PARTY_DATA_OFFSET + 6 * PARTY_POKEMON_BYTES; // 0x30CC
const PARTY_NICKNAMES = PARTY_OT_NAMES + 6 * NAME_BYTES; // 0x310E
// Box layout
// Each box: count(1) + species_list(21: 20 entries + 0xFF) + 20×33 data + 20×11 OT + 20×11 nick
const BOX_POKEMON_COUNT = 20;
const BOX_COUNT_BYTES = 1;
const BOX_SPECIES_BYTES = BOX_POKEMON_COUNT + 1; // 20 entries + 0xFF terminator
const BOX_DATA_BYTES = BOX_POKEMON_COUNT * BOX_POKEMON_BYTES;
const BOX_OT_BYTES = BOX_POKEMON_COUNT * NAME_BYTES;
const BOX_NICK_BYTES = BOX_POKEMON_COUNT * NAME_BYTES;
const BOX_TOTAL_BYTES = BOX_COUNT_BYTES + BOX_SPECIES_BYTES + BOX_DATA_BYTES + BOX_OT_BYTES + BOX_NICK_BYTES;
// = 1 + 21 + 660 + 220 + 220 = 1122 = 0x462  ✓ (matches Bulbapedia current-box size)
const BOX_BANK_0_OFFSET = 0x4000; // banks 2: boxes 1–6
const BOX_BANK_1_OFFSET = 0x6000; // bank 3: boxes 7–12
const BOXES_PER_BANK = 6;
const TOTAL_BOXES = 12;
// ── Helpers ────────────────────────────────────────────────────────────────
function parseBadges(byte) {
    const b = (bit) => ((byte >> bit) & 1) === 1;
    const bits = [b(0), b(1), b(2), b(3), b(4), b(5), b(6), b(7)];
    return {
        boulder: bits[0], cascade: bits[1], thunder: bits[2], rainbow: bits[3],
        soul: bits[4], marsh: bits[5], volcano: bits[6], earth: bits[7],
        count: bits.filter(Boolean).length,
    };
}
function parseParty(buf) {
    const count = Math.min(buf[PARTY_COUNT_OFFSET], 6);
    const pokemon = [];
    for (let i = 0; i < count; i++) {
        const dataBase = PARTY_DATA_OFFSET + i * PARTY_POKEMON_BYTES;
        const nameBase = PARTY_OT_NAMES + i * NAME_BYTES;
        const nickBase = PARTY_NICKNAMES + i * NAME_BYTES;
        // Skip slot if species list says 0xFF (empty/terminator)
        if (buf[PARTY_SPECIES_LIST + i] === 0xFF)
            continue;
        pokemon.push(parsePartyPokemon(buf, dataBase, nameBase, nickBase));
    }
    return pokemon;
}
function parseBox(buf, boxFileOffset, boxNumber) {
    const count = Math.min(buf[boxFileOffset + BOX_COUNT_BYTES - 1], BOX_POKEMON_COUNT);
    const dataStart = boxFileOffset + BOX_COUNT_BYTES + BOX_SPECIES_BYTES;
    const otStart = dataStart + BOX_DATA_BYTES;
    const nickStart = otStart + BOX_OT_BYTES;
    const pokemon = [];
    for (let i = 0; i < count; i++) {
        const speciesByte = buf[boxFileOffset + BOX_COUNT_BYTES + i];
        if (speciesByte === 0xFF)
            break; // terminator
        const dataBase = dataStart + i * BOX_POKEMON_BYTES;
        const nameBase = otStart + i * NAME_BYTES;
        const nickBase = nickStart + i * NAME_BYTES;
        pokemon.push(parseBoxPokemon(buf, dataBase, nameBase, nickBase));
    }
    return { boxNumber, count: pokemon.length, pokemon };
}
function parseAllBoxes(buf) {
    const boxes = [];
    for (let i = 0; i < TOTAL_BOXES; i++) {
        const bankOffset = i < BOXES_PER_BANK ? BOX_BANK_0_OFFSET : BOX_BANK_1_OFFSET;
        const boxIndex = i < BOXES_PER_BANK ? i : i - BOXES_PER_BANK;
        const fileOffset = bankOffset + boxIndex * BOX_TOTAL_BYTES;
        boxes.push(parseBox(buf, fileOffset, i + 1));
    }
    return boxes;
}
// Yellow detection heuristic: Pikachu happiness byte exists only in Yellow.
// A non-zero value at 0x271A in an otherwise valid save strongly suggests Yellow.
// Red/Blue saves have this byte either 0x00 or arbitrary — checking for a
// plausible happiness range (1–255) is sufficient for a pre-select heuristic.
function detectVersion(buf) {
    const pikachuHappy = buf[PIKACHU_HAPPY_OFFSET];
    return pikachuHappy > 0 ? 'yellow' : 'red_blue';
}
// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Parse a Gen I .sav file buffer.
 *
 * Always returns a SaveState.  If the file is the wrong size or the checksum
 * is invalid, `valid` will be false and `error` will explain why.
 * A checksum failure does NOT prevent the rest of the fields from being
 * populated — we still parse everything so the caller can inspect partial data.
 */
export function parseSave(buf) {
    if (buf.length !== SAV_SIZE) {
        return {
            valid: false,
            error: `Expected ${SAV_SIZE} bytes (32 KB), got ${buf.length}`,
            checksum: { stored: 0, computed: 0, valid: false },
            version: 'unknown',
            playerName: '', rivalName: '', money: 0,
            playtime: { hours: 0, minutes: 0, seconds: 0, frames: 0 },
            badges: { boulder: false, cascade: false, thunder: false, rainbow: false,
                soul: false, marsh: false, volcano: false, earth: false, count: 0 },
            pokedex: { owned: new Array(DEX_COUNT).fill(false), seen: new Array(DEX_COUNT).fill(false),
                ownedCount: 0, seenCount: 0 },
            party: [], currentBoxIndex: 0, boxes: [],
        };
    }
    const checksum = validateChecksum(buf);
    const owned = unpackOwned(buf);
    const seen = unpackSeen(buf);
    return {
        valid: checksum.valid,
        error: checksum.valid ? undefined : `Checksum mismatch: stored 0x${checksum.stored.toString(16).padStart(2, '0')}, computed 0x${checksum.computed.toString(16).padStart(2, '0')}`,
        checksum,
        version: detectVersion(buf),
        playerName: decodeText(buf, PLAYER_NAME_OFFSET, NAME_FIELD_LEN),
        rivalName: decodeText(buf, RIVAL_NAME_OFFSET, NAME_FIELD_LEN),
        money: decodeBCD(buf, MONEY_OFFSET, MONEY_BYTES),
        playtime: {
            hours: buf[PT_HOURS_OFFSET],
            minutes: buf[PT_MINUTES_OFFSET],
            seconds: buf[PT_SECONDS_OFFSET],
            frames: buf[PT_FRAMES_OFFSET],
        },
        badges: parseBadges(buf[BADGE_OFFSET]),
        pokedex: {
            owned,
            seen,
            ownedCount: owned.filter(Boolean).length,
            seenCount: seen.filter(Boolean).length,
        },
        party: parseParty(buf),
        currentBoxIndex: buf[CURRENT_BOX_OFFSET] & 0x7F, // low 7 bits
        boxes: parseAllBoxes(buf),
    };
}

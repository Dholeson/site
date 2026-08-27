// Gen I Pokémon data structure parsing.
//
// Source: Bulbapedia "Pokémon data structure (Generation I)"
// https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_I)
//
// Two layouts:
//   Box Pokémon  — 33 bytes (0x00–0x20), stats omitted
//   Party Pokémon — 44 bytes (0x00–0x2B), includes live stats
//
// The box/party structure is preceded by a species list and followed by
// OT names and nicknames — those are parsed by the caller.
import { decodeText } from './charmap.js';
import { indexToDex } from './speciesIndex.js';
// Offsets within a single Pokémon data blob
const OFF_SPECIES = 0x00;
const OFF_CURRENT_HP = 0x01; // 2 bytes, big-endian
const OFF_LEVEL = 0x03;
const OFF_STATUS = 0x04;
const OFF_TYPE1 = 0x05;
const OFF_TYPE2 = 0x06;
const OFF_CATCH_RATE = 0x07;
const OFF_MOVE1 = 0x08;
const OFF_MOVE2 = 0x09;
const OFF_MOVE3 = 0x0A;
const OFF_MOVE4 = 0x0B;
const OFF_OT_ID = 0x0C; // 2 bytes, big-endian
const OFF_EXPERIENCE = 0x0E; // 3 bytes, big-endian
// 0x11–0x1A: stat experience (5 × 2 bytes) — not needed for P1
const OFF_IV_DATA = 0x1B; // 2 bytes
const OFF_MOVE1_PP = 0x1D;
const OFF_MOVE2_PP = 0x1E;
const OFF_MOVE3_PP = 0x1F;
const OFF_MOVE4_PP = 0x20;
// Party-only (offset 0x21+)
const OFF_LEVEL_PARTY = 0x21; // redundant level field recalculated on withdrawal
const OFF_MAX_HP = 0x22; // 2 bytes, big-endian
const OFF_ATTACK = 0x24; // 2 bytes, big-endian
const OFF_DEFENSE = 0x26;
const OFF_SPEED = 0x28;
const OFF_SPECIAL = 0x2A;
export const BOX_POKEMON_BYTES = 33; // 0x21 bytes
export const PARTY_POKEMON_BYTES = 44; // 0x2C bytes
export const NAME_BYTES = 11; // 10 chars + 0x50 terminator
function readUint16BE(buf, offset) {
    return (buf[offset] << 8) | buf[offset + 1];
}
function readUint24BE(buf, offset) {
    return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
}
/**
 * Parse a single box Pokémon from the data section of a box.
 *
 * @param dataBuf   The full save buffer (or a sub-buffer starting at the Pokémon data blob)
 * @param dataBase  Absolute offset in dataBuf where this Pokémon's 33-byte blob starts
 * @param nameBuf   Buffer region containing OT names or nicknames (11 bytes per slot)
 * @param nameBase  Absolute offset in nameBuf for this slot's OT name
 * @param nickBase  Absolute offset in nameBuf for this slot's nickname
 */
export function parseBoxPokemon(buf, dataBase, nameBase, nickBase) {
    const speciesIndex = buf[dataBase + OFF_SPECIES];
    return {
        speciesIndex,
        dexNumber: indexToDex(speciesIndex),
        level: buf[dataBase + OFF_LEVEL],
        currentHp: readUint16BE(buf, dataBase + OFF_CURRENT_HP),
        otId: readUint16BE(buf, dataBase + OFF_OT_ID),
        experience: readUint24BE(buf, dataBase + OFF_EXPERIENCE),
        otName: decodeText(buf, nameBase, NAME_BYTES),
        nickname: decodeText(buf, nickBase, NAME_BYTES),
    };
}
/**
 * Parse a party Pokémon (44-byte struct) from the save buffer.
 */
export function parsePartyPokemon(buf, dataBase, nameBase, nickBase) {
    const box = parseBoxPokemon(buf, dataBase, nameBase, nickBase);
    return {
        ...box,
        statusCondition: buf[dataBase + OFF_STATUS],
        maxHp: readUint16BE(buf, dataBase + OFF_MAX_HP),
        attack: readUint16BE(buf, dataBase + OFF_ATTACK),
        defense: readUint16BE(buf, dataBase + OFF_DEFENSE),
        speed: readUint16BE(buf, dataBase + OFF_SPEED),
        special: readUint16BE(buf, dataBase + OFF_SPECIAL),
        moves: [
            buf[dataBase + OFF_MOVE1], buf[dataBase + OFF_MOVE2],
            buf[dataBase + OFF_MOVE3], buf[dataBase + OFF_MOVE4],
        ],
        movePp: [
            buf[dataBase + OFF_MOVE1_PP] & 0x3F, // lower 6 bits = current PP
            buf[dataBase + OFF_MOVE2_PP] & 0x3F,
            buf[dataBase + OFF_MOVE3_PP] & 0x3F,
            buf[dataBase + OFF_MOVE4_PP] & 0x3F,
        ],
    };
}

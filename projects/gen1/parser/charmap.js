// Gen I character encoding decode table.
// Source: pret/pokered charmap.asm
// https://github.com/pret/pokered/blob/master/charmap.asm
//
// Gen I does NOT use ASCII.  0x50 is the string terminator.
// Unknown / unmapped bytes decode to '?'.
const CHAR_MAP = {
    0x50: '', // string terminator — stop decoding here
    0x7F: ' ', // space
    // Uppercase A–Z: 0x80–0x99
    0x80: 'A', 0x81: 'B', 0x82: 'C', 0x83: 'D', 0x84: 'E',
    0x85: 'F', 0x86: 'G', 0x87: 'H', 0x88: 'I', 0x89: 'J',
    0x8A: 'K', 0x8B: 'L', 0x8C: 'M', 0x8D: 'N', 0x8E: 'O',
    0x8F: 'P', 0x90: 'Q', 0x91: 'R', 0x92: 'S', 0x93: 'T',
    0x94: 'U', 0x95: 'V', 0x96: 'W', 0x97: 'X', 0x98: 'Y',
    0x99: 'Z',
    // Lowercase a–z: 0xA0–0xB9
    0xA0: 'a', 0xA1: 'b', 0xA2: 'c', 0xA3: 'd', 0xA4: 'e',
    0xA5: 'f', 0xA6: 'g', 0xA7: 'h', 0xA8: 'i', 0xA9: 'j',
    0xAA: 'k', 0xAB: 'l', 0xAC: 'm', 0xAD: 'n', 0xAE: 'o',
    0xAF: 'p', 0xB0: 'q', 0xB1: 'r', 0xB2: 's', 0xB3: 't',
    0xB4: 'u', 0xB5: 'v', 0xB6: 'w', 0xB7: 'x', 0xB8: 'y',
    0xB9: 'z',
    // Punctuation / special
    0xBA: 'é', // e-acute — used in "Pokémon"
    0xBB: "'d",
    0xBC: "'l",
    0xBD: "'s",
    0xBE: "'t",
    0xBF: "'v",
    0xE0: "'", // right single quote
    0xE1: 'PK', // Pokémon symbol (rendered as two chars for text)
    0xE2: 'MN',
    0xE3: '-',
    0xE6: '?',
    0xE7: '!',
    0xE8: '.',
    0xEF: '♂',
    0xF5: '♀',
    0xF6: '0', 0xF7: '1', 0xF8: '2', 0xF9: '3', 0xFA: '4',
    0xFB: '5', 0xFC: '6', 0xFD: '7', 0xFE: '8', 0xFF: '9',
};
/**
 * Decode a Gen I text field from a Buffer slice.
 * Stops at the terminator byte (0x50) or maxLength, whichever comes first.
 * Bytes not in the map are replaced with '?'.
 */
export function decodeText(buf, offset, maxLength) {
    let result = '';
    for (let i = 0; i < maxLength; i++) {
        const byte = buf[offset + i];
        if (byte === 0x50)
            break; // terminator
        const ch = CHAR_MAP[byte];
        if (ch === undefined) {
            result += '?';
        }
        else {
            result += ch;
        }
    }
    return result;
}
/**
 * Encode an ASCII string to Gen I text bytes, terminated with 0x50.
 * Used only for building test fixtures — NOT for modifying user saves.
 * Unsupported characters are encoded as 0x00.
 */
export function encodeText(text, fieldLength) {
    const buf = Buffer.alloc(fieldLength, 0x00);
    // Build reverse map on demand (fixture use only, not perf-sensitive)
    const reverseMap = {};
    for (const [byte, ch] of Object.entries(CHAR_MAP)) {
        if (ch.length === 1)
            reverseMap[ch] = Number(byte);
    }
    let i = 0;
    for (const ch of text) {
        if (i >= fieldLength - 1)
            break; // leave room for terminator
        buf[i++] = reverseMap[ch] ?? 0x00;
    }
    buf[i] = 0x50; // terminator
    return buf;
}

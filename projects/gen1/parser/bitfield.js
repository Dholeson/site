// Pokédex bitfield unpacking.
//
// Both the "owned" and "seen" fields are 19 bytes (0x13) = 152 bits.
// Bit index = dex_number - 1.
// Bit 0 of byte 0 = Bulbasaur (#1).  Bits 151–152 are padding and ignored.
//
// Source: Bulbapedia "Save data structure (Generation I)"
//   Owned: offset 0x25A3, 19 bytes
//   Seen:  offset 0x25B6, 19 bytes
const DEX_OWNED_OFFSET = 0x25A3;
const DEX_SEEN_OFFSET = 0x25B6;
const DEX_COUNT = 151;
export { DEX_OWNED_OFFSET, DEX_SEEN_OFFSET, DEX_COUNT };
/**
 * Unpack a 19-byte bitfield from the save buffer starting at `offset`.
 * Returns a boolean array of length `count` where index 0 = dex #1.
 */
export function unpackBitfield(buf, offset, count) {
    const result = new Array(count).fill(false);
    for (let dex = 1; dex <= count; dex++) {
        const bit = dex - 1;
        const byteIndex = Math.floor(bit / 8);
        const bitIndex = bit % 8;
        result[dex - 1] = ((buf[offset + byteIndex] >> bitIndex) & 1) === 1;
    }
    return result;
}
/**
 * Set or clear a single dex entry in a bitfield buffer slice.
 * Used ONLY for building test fixtures.
 */
export function setBit(buf, offset, dexNumber, value) {
    if (dexNumber < 1 || dexNumber > 151)
        return;
    const bit = dexNumber - 1;
    const byteIndex = Math.floor(bit / 8);
    const bitIndex = bit % 8;
    if (value) {
        buf[offset + byteIndex] |= (1 << bitIndex);
    }
    else {
        buf[offset + byteIndex] &= ~(1 << bitIndex);
    }
}
export function unpackOwned(buf) {
    return unpackBitfield(buf, DEX_OWNED_OFFSET, DEX_COUNT);
}
export function unpackSeen(buf) {
    return unpackBitfield(buf, DEX_SEEN_OFFSET, DEX_COUNT);
}

// Binary-Coded Decimal decode for Gen I money field.
//
// Money is stored as 3 bytes at 0x25F3, BCD-encoded, max 999999.
// Each byte stores two decimal digits: high nibble = tens, low nibble = ones.
// Byte layout: [hundreds-thousands | ten-thousands], [thousands | hundreds], [tens | ones]
// e.g. 999999 → 0x99 0x99 0x99
export const MONEY_OFFSET = 0x25F3;
export const MONEY_BYTES = 3;
/**
 * Decode a 3-byte BCD buffer slice to a JavaScript number.
 * Returns 0 if any nibble is out of the 0–9 range (corrupt data).
 */
export function decodeBCD(buf, offset, byteCount) {
    let result = 0;
    for (let i = 0; i < byteCount; i++) {
        const byte = buf[offset + i];
        const high = (byte >> 4) & 0x0F;
        const low = byte & 0x0F;
        if (high > 9 || low > 9)
            return 0; // corrupt / not BCD
        result = result * 100 + high * 10 + low;
    }
    return result;
}
/**
 * Encode a number (0–999999) to 3 BCD bytes.
 * Used ONLY for building test fixtures.
 */
export function encodeBCD(value, byteCount) {
    const buf = Buffer.alloc(byteCount, 0x00);
    let v = Math.max(0, Math.min(value, Math.pow(100, byteCount) - 1));
    for (let i = byteCount - 1; i >= 0; i--) {
        const pair = v % 100;
        buf[i] = ((Math.floor(pair / 10)) << 4) | (pair % 10);
        v = Math.floor(v / 100);
    }
    return buf;
}

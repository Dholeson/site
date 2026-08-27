// Gen I save file checksum.
//
// Algorithm (Bulbapedia / Rhydon):
//   Start with accumulator = 255.
//   Subtract every byte in the range 0x2598–0x3522 (inclusive).
//   Mask result to uint8.  Compare with byte stored at 0x3523.
//
// The subtraction wraps (uint8 arithmetic), so negative intermediates
// are fine — we mask with 0xFF at the end.
const CHECKSUM_START = 0x2598;
const CHECKSUM_END = 0x3522; // inclusive
const CHECKSUM_ADDR = 0x3523;
export { CHECKSUM_START, CHECKSUM_END, CHECKSUM_ADDR };
/**
 * Compute the checksum for a save buffer.
 * Does NOT modify the buffer.
 */
export function computeChecksum(buf) {
    let acc = 255;
    for (let i = CHECKSUM_START; i <= CHECKSUM_END; i++) {
        acc = (acc - buf[i]) & 0xFF;
    }
    return acc;
}
/**
 * Read the stored checksum byte and compare to computed value.
 */
export function validateChecksum(buf) {
    const stored = buf[CHECKSUM_ADDR];
    const computed = computeChecksum(buf);
    return { stored, computed, valid: stored === computed };
}
/**
 * Write a correct checksum into a buffer at 0x3523.
 * Used ONLY for building test fixtures — never called on user saves.
 */
export function writeChecksum(buf) {
    buf[CHECKSUM_ADDR] = computeChecksum(buf);
}

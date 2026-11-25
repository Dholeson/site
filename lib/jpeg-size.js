// A JPEG's pixel size, read from its header, for the link-preview tags
// (lib/seo.js productHead: og:image:width / og:image:height, and the generic
// card when photo 1 is too narrow for iMessage).
//
// jpegSize(bytes) walks the segments from SOI to the first frame header
// (SOF0 to SOF15, except C4 = DHT, C8 = JPG and CC = DAC, which share that
// range but aren't frames) and returns { width, height }, or null. It reads
// only headers, so the first 128 KiB of a photo (functions/product.js's
// ranged R2 read) is normally enough: every segment before the frame header
// is at most 64 KiB.
//
// The size is the one a viewer shows: an EXIF orientation of 5 to 8 (the
// camera was turned a quarter) swaps width and height. Only an Exif APP1
// segment before the frame header counts.
//
// Malformed, truncated or non-JPEG input returns null. It never throws: the
// callers are best effort, and a null leaves the preview as it was.
//
// No Node imports: this runs in the Workers runtime and in the tests.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const TEM = 0x01;

const isFrame = code => code >= 0xc0 && code <= 0xcf && code !== 0xc4 && code !== 0xc8 && code !== 0xcc;
// Markers with no length field after them: TEM and RST0 to RST7.
const isStandalone = code => code === TEM || (code >= 0xd0 && code <= 0xd7);

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

export function jpegSize(input) {
  try {
    const b = asBytes(input);
    if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== SOI) return null;
    const n = b.length;
    let i = 2;
    let orientation = 0;

    while (i < n) {
      // A marker: 0xFF, any number of 0xFF fill bytes, then its code.
      if (b[i] !== 0xff) return null;
      while (i < n && b[i] === 0xff) i++;
      if (i >= n) return null;
      const code = b[i++];
      if (isStandalone(code)) continue;
      // A stuffed 0x00 belongs inside scan data; a second SOI, the end of
      // the image or a scan before any frame header: not a JPEG to read.
      if (code === 0x00 || code === SOI || code === EOI || code === SOS) return null;

      if (i + 2 > n) return null;
      const length = (b[i] << 8) | b[i + 1];
      const end = i + length;
      if (length < 2 || end > n) return null;
      const start = i + 2;

      if (isFrame(code)) {
        // Precision (1), height (2), width (2), component count (1).
        if (length < 8) return null;
        const height = (b[start + 1] << 8) | b[start + 2];
        const width = (b[start + 3] << 8) | b[start + 4];
        // Height 0 means "given later in a DNL marker": not known here.
        if (!width || !height) return null;
        return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
      }
      if (code === APP1 && !orientation) orientation = exifOrientation(b, start, end);
      i = end;
    }
    return null;
  } catch {
    return null;
  }
}

// The Orientation tag (0x0112) of IFD0 in an Exif APP1 segment's payload
// b[start..end), or 0 when there is none or it can't be read. Every read is
// held inside the segment.
function exifOrientation(b, start, end) {
  // "Exif\0\0", then a TIFF header: II (little-endian) or MM, 42, IFD0's offset.
  const EXIF = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  if (end - start < EXIF.length + 8) return 0;
  for (let k = 0; k < EXIF.length; k++) if (b[start + k] !== EXIF[k]) return 0;
  const t = start + EXIF.length;
  let le;
  if (b[t] === 0x49 && b[t + 1] === 0x49) le = true;
  else if (b[t] === 0x4d && b[t + 1] === 0x4d) le = false;
  else return 0;

  const u16 = p => (p < start || p + 2 > end) ? -1
    : le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1];
  const u32 = p => (p < start || p + 4 > end) ? -1
    : le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) + b[p + 3] * 0x1000000
         : b[p] * 0x1000000 + ((b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]);

  if (u16(t + 2) !== 42) return 0;
  const offset = u32(t + 4);
  if (offset < 8) return 0;
  const ifd = t + offset;
  const count = u16(ifd);
  if (count < 0) return 0;
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > end) return 0;
    if (u16(entry) !== 0x0112) continue;
    // SHORT (type 3), one value, held in the first two bytes of the field.
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) return 0;
    const v = u16(entry + 8);
    return v >= 1 && v <= 8 ? v : 0;
  }
  return 0;
}

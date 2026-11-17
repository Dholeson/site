// Web demo only: small helpers shared by the mock API and the playback simulator. The text rules
// mirror the server's (src/persistence/plays.py fold(), src/services/artist_stats.py) so the
// mock filters, sorts and matches like the real app.

const QUOTES = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-' };

/** NFKC + quote/dash fold + case fold + whitespace collapse: the base of every key. */
export function fold(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[’‘“”–—]/g, (c) => QUOTES[c])
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** 0 exact, 1 prefix, 2 word start, 3 substring, null no match (artist_stats._match_rank). */
export function matchRank(folded, fq) {
  if (folded === fq) return 0;
  if (folded.startsWith(fq)) return 1;
  if (` ${folded}`.includes(` ${fq}`)) return 2;
  return folded.includes(fq) ? 3 : null;
}

/** Python-style comparison of strings / numbers for sort keys given as arrays. */
export function cmpKeys(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Rows of a {columns, rows} table as objects. */
export function rowsOf(table) {
  const cols = table?.columns || [];
  return (table?.rows || []).map((r) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
}

export const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Local "YYYY-MM-DD" of a timestamp (the demo clock's time zone is the visitor's). */
export function localDay(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function hms(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Deterministic PRNG (mulberry32) so every visitor gets the same play order. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The v2 error shape: {"error": {"code", "message", ...extra}}. */
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.body = { error: { code, message, ...extra } };
  }
}

export const DEMO_READONLY = () => new HttpError(409, 'demo_readonly', 'Not available in the demo.');

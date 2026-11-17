// Safe HTML primitives, shared by ui.js and icons.js (split out to avoid an import cycle).
//
// html`...` escapes EVERY interpolated value; the result is a SafeHtml value, which html``
// nests without re-escaping and mount() accepts. Arrays are joined. null/undefined/false/true
// render as nothing, so `${cond && html`...`}` works. raw(str) is the explicit opt-out for markup
// you built yourself from trusted constants — never pass API data through raw().

export class SafeHtml {
  constructor(str) { this.__html = str; }
  toString() { return this.__html; }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

export function raw(str) {
  return new SafeHtml(str == null ? '' : String(str));
}

export const isSafeHtml = (v) => v instanceof SafeHtml;

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof SafeHtml) return v.__html;
  if (Array.isArray(v)) return v.map(part).join('');
  return escapeHtml(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Serialise anything html`` accepts to a markup string (plain strings are escaped). */
export function toHtml(value) {
  return part(value);
}

/** Only http(s):, spotify:, in-app hash routes and same-origin paths survive; anything else becomes fallback. */
export function safeUrl(url, fallback = '#') {
  const s = String(url ?? '').trim();
  if (!s) return fallback;
  if (/^(https?:\/\/|spotify:)/i.test(s)) return s;
  if (s.startsWith('#') || (s.startsWith('/') && !s.startsWith('//'))) return s;
  return fallback;
}

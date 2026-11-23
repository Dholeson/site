// Small helpers shared by the store's Pages Functions (bench API, public store
// API, Stripe webhook, checkout). No Node imports: these run in the Workers
// runtime, and in the tests under plain node.

const encoder = new TextEncoder();

export function utf8(s) {
  return encoder.encode(String(s));
}

// Every error the store's APIs return is JSON { error: "<a sentence>" }, plus
// any extra fields the caller needs. Nothing from these endpoints is cached
// unless a route says otherwise.
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

export function methodNotAllowed(allowed) {
  return json({ error: `Use ${allowed.join(" or ")} for this endpoint.` }, 405, { Allow: allowed.join(", ") });
}

// Reads a request body into one Uint8Array, refusing anything over maxBytes
// without buffering it: a declared Content-Length over the cap is refused up
// front, and a body that runs past the cap while streaming is cancelled.
export async function readBody(request, maxBytes) {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    return { tooLarge: true };
  }
  if (!request.body) return { bytes: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* already closed */ }
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return { bytes };
}

// Parses a JSON body read with readBody. Invalid UTF-8 or invalid JSON -> null.
export function parseJson(bytes) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

// Constant-time comparison of two byte arrays. Different lengths never match
// (and are not compared). The Workers runtime provides
// crypto.subtle.timingSafeEqual; plain node does not, so the tests either
// install it or fall through to the XOR loop below, which also never exits
// early.
export function timingSafeEqualBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle && typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(a, b);
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function bytesToHex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}

// Lower- or upper-case hex of even length -> bytes; anything else -> null.
export function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(bytes) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

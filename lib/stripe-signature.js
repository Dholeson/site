// Verifies a Stripe webhook's Stripe-Signature header with Web Crypto.
//
// Header: "t=<unix seconds>,v1=<hex HMAC-SHA256>[,v1=...][,v0=...]". The
// signed payload is "<t>.<raw body bytes>", keyed with the endpoint's signing
// secret ("whsec_...", used as-is). Any v1 may match (Stripe sends two while a
// secret is being rolled). The timestamp must be within `toleranceSeconds` of
// now, either way, so a captured request can't be replayed later.

import { utf8, hexToBytes, timingSafeEqualBytes } from "./http.js";

export const TOLERANCE_SECONDS = 300;

export async function stripeSignatureFor(secret, timestamp, payloadBytes) {
  const key = await crypto.subtle.importKey(
    "raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prefix = utf8(`${timestamp}.`);
  const signed = new Uint8Array(prefix.length + payloadBytes.length);
  signed.set(prefix, 0);
  signed.set(payloadBytes, prefix.length);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
}

// Returns { ok: true } or { ok: false, reason }.
export async function verifyStripeSignature(payloadBytes, header, secret, {
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = TOLERANCE_SECONDS
} = {}) {
  if (!header) return { ok: false, reason: "Missing Stripe-Signature header." };

  let t = null;
  const v1 = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (name === "t") {
      if (t !== null || !/^\d{1,12}$/.test(value)) {
        return { ok: false, reason: "Malformed Stripe-Signature header." };
      }
      t = value;
    } else if (name === "v1") {
      v1.push(value);
    }
  }
  if (t === null || !v1.length) return { ok: false, reason: "Malformed Stripe-Signature header." };

  const expected = await stripeSignatureFor(secret, t, payloadBytes);
  let matched = false;
  for (const candidate of v1) {
    const got = hexToBytes(candidate);
    // Check every candidate, so the time taken doesn't say which one matched.
    if (got && timingSafeEqualBytes(got, expected)) matched = true;
  }
  if (!matched) return { ok: false, reason: "The Stripe signature doesn't match." };

  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) {
    return { ok: false, reason: "The Stripe signature's timestamp is outside the 5-minute tolerance." };
  }
  return { ok: true };
}

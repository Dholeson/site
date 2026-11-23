// Shared setup for the store tests: an env with a fresh D1 stand-in (every
// migration applied) and an in-memory R2, a way to call a Function's
// onRequest the way Pages does, test JPEGs, a listing body, and Stripe
// webhook signing.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createD1 } from "./d1-sqlite.js";
import { createR2 } from "./r2-memory.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MIGRATIONS = join(ROOT, "migrations");

export const TOKEN = "t".repeat(20) + "0123456789abcdef";          // 36 chars
export const WEBHOOK_SECRET = "whsec_test_0123456789abcdef0123456789";

export function makeEnv(overrides = {}) {
  return {
    DB: createD1(MIGRATIONS),
    STORE_IMAGES: createR2(),
    BENCH_TOKEN: TOKEN,
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    SITE_URL: "https://dhole.dev",
    SHIP_TO_COUNTRIES: "US",
    ENABLE_AUTOMATIC_TAX: "false",
    ...overrides
  };
}

// Calls a Pages Function the way Pages does: onRequest(context).
export async function call(onRequest, env, method, path, { body, headers = {}, token } = {}) {
  const h = new Headers(headers);
  if (token !== undefined && token !== null) h.set("Authorization", `Bearer ${token}`);
  let payload = body;
  if (body !== undefined && !(body instanceof Uint8Array) && typeof body !== "string") {
    payload = JSON.stringify(body);
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  }
  const request = new Request(`https://dhole.dev${path}`, { method, headers: h, body: payload });
  const res = await onRequest({ request, env, params: {}, data: {}, waitUntil() {}, next() {} });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { res, status: res.status, json, text };
}

// A byte string that starts like a JPEG (FF D8 FF), distinct per seed.
export function jpeg(seed = "a", size = 64) {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  const fill = new TextEncoder().encode(`jpeg:${seed}:`);
  for (let i = 4; i < size; i++) bytes[i] = fill[(i - 4) % fill.length];
  return bytes;
}

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const imageName = bytes => `${sha256(bytes)}.jpg`;

// Puts photos straight into the R2 stand-in (no API call).
export async function seedImages(env, ...seeds) {
  const names = [];
  for (const s of seeds) {
    const bytes = jpeg(s);
    const name = imageName(bytes);
    await env.STORE_IMAGES.put(`bench/${name}`, bytes, { httpMetadata: { contentType: "image/jpeg" } });
    names.push(name);
  }
  return names;
}

export function listingBody(id, images, overrides = {}) {
  return {
    inventory_id: id.toUpperCase(),
    name: "PlayStation 4 Slim 500GB — Jet Black",
    platform: "PlayStation 4",
    category: "console",
    condition: "refurbished",
    price_cents: 22900,
    shipping_class: "console",
    blurb: "Cleaned, repasted and tested.\nShips with a controller.",
    details: ["Firmware 11.00", "Includes: console, controller, HDMI, power cable"],
    images,
    ...overrides
  };
}

// Seeds the photos and PUTs a listing through the bench API.
export async function pushListing(bench, env, id, overrides = {}) {
  const images = overrides.images || await seedImages(env, `${id}-1`, `${id}-2`);
  return call(bench, env, "PUT", `/api/bench/listings/${id}`, {
    token: TOKEN,
    body: listingBody(id, images, overrides)
  });
}

export function row(env, id) {
  const r = env.DB.raw.prepare("SELECT * FROM store_listings WHERE id = ?").get(id);
  return r ? { ...r } : null;
}

export function sales(env) {
  return env.DB.raw.prepare("SELECT * FROM store_sales ORDER BY sale_id").all().map(r => ({ ...r }));
}

export const iso = ms => new Date(ms).toISOString();

// Puts a listing on hold directly, as a checkout would have.
export function holdDirect(env, id, session, untilMs) {
  env.DB.raw.prepare(
    "UPDATE store_listings SET status = 'reserved', reserved_session = ?, reserved_until = ? WHERE id = ?"
  ).run(session, iso(untilMs), id);
}

// ---------- Stripe ----------

export function stripeHeader(payload, { secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000), extra = [] } = {}) {
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return [`t=${t}`, ...extra, `v1=${sig}`].join(",");
}

export function sessionEvent(type, session, created = Math.floor(Date.now() / 1000)) {
  return { id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", type, created, data: { object: session } };
}

// Installs crypto.subtle.timingSafeEqual (the Workers API, absent in node)
// as a spy over node's timingSafeEqual. Returns the recorded calls and an
// uninstall function.
export function spyTimingSafeEqual() {
  const calls = [];
  const subtle = globalThis.crypto.subtle;
  const had = Object.prototype.hasOwnProperty.call(subtle, "timingSafeEqual");
  const before = subtle.timingSafeEqual;
  subtle.timingSafeEqual = (a, b) => {
    calls.push([a.byteLength, b.byteLength]);
    return timingSafeEqual(a, b);
  };
  return {
    calls,
    restore() {
      if (had) subtle.timingSafeEqual = before;
      else delete subtle.timingSafeEqual;
    }
  };
}

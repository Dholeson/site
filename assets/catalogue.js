// The storefront's catalogue: the hand-made items in data/products.js, plus
// the refurbished units the bench app pushes, fetched from
// /api/store/listings (same shape as a products.js entry, stock 1,
// source "bench").
//
// The fetch is an enhancement. If it fails (a plain static server, D1 down, a
// slow network) the store carries on with data/products.js alone. Bench ids
// ("ro-0042") are a namespace of their own: they are never looked up in
// products.js, whose ids never look like that.

import { products, findProduct } from "../data/products.js";

export const LISTINGS_ENDPOINT = "/api/store/listings";

const BENCH_ID = /^ro-\d+$/;
export const BENCH_LISTING_ID = /^ro-[0-9]{4,6}$/;
const IMAGE_PATH = /^\/api\/store\/img\/[0-9a-f]{64}\.jpg$/;

export const isBenchId = id => typeof id === "string" && BENCH_ID.test(id);

let bench = [];
let state = "idle";          // idle | loading | ok | failed
let pending = null;

const isText = v => typeof v === "string" && v.trim() !== "";

// Keep only listings that are safe to render and price for display. The
// server is the real check; this just means one odd row can't break the page.
function clean(l) {
  if (!l || typeof l !== "object") return null;
  if (typeof l.id !== "string" || !BENCH_LISTING_ID.test(l.id)) return null;
  if (![l.name, l.platform, l.condition, l.blurb].every(isText)) return null;
  if (!Number.isInteger(l.priceCents) || l.priceCents < 1) return null;
  if (l.category !== "console" && l.category !== "accessory") return null;
  if (l.shippingClass !== "console" && l.shippingClass !== "small") return null;
  const images = Array.isArray(l.images) ? l.images.filter(u => typeof u === "string" && IMAGE_PATH.test(u)) : [];
  if (!images.length) return null;
  return {
    id: l.id,
    name: l.name,
    platform: l.platform,
    category: l.category,
    condition: l.condition,
    priceCents: l.priceCents,
    stock: 1,
    shippingClass: l.shippingClass,
    image: images[0],
    images,
    blurb: l.blurb,
    details: Array.isArray(l.details) ? l.details.filter(d => typeof d === "string") : [],
    source: "bench"
  };
}

// Resolves to "ok" or "failed"; never rejects. One request per page load
// unless reloadBench() is called.
//
// The listings are cached for 30 s (functions/api/store), so a cached copy
// can miss a unit that just went on sale or just came back from a lapsed
// hold. fresh: true skips the browser cache for that request: the product
// page asks for it when the server says a unit is available but the cached
// list doesn't have it.
export function loadBench({ timeoutMs = 8000, fresh = false } = {}) {
  if (pending) return pending;
  state = "loading";
  pending = (async () => {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(LISTINGS_ENDPOINT, {
        headers: { Accept: "application/json" },
        cache: fresh ? "no-store" : "default",
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.listings)) throw new Error("unexpected response");
      bench = data.listings.map(clean).filter(Boolean);
      state = "ok";
    } catch {
      bench = [];
      state = "failed";
    } finally {
      if (timer) clearTimeout(timer);
    }
    return state;
  })();
  return pending;
}

// A new request, whatever the last one returned. opts go through to
// loadBench, so reloadBench({ fresh: true }) bypasses the cache.
export function reloadBench(opts) {
  pending = null;
  return loadBench(opts);
}

export function benchState() {
  return state;
}

// Bench units first: each is one of a kind.
export function allProducts() {
  return [...bench, ...products];
}

export function findAny(id) {
  if (isBenchId(id)) return bench.find(p => p.id === id) || null;
  return findProduct(id);
}

// Cart state.
//
// The cart deliberately stores ONLY { id, qty }. It never stores a price.
// Prices are looked up from the catalogue when rendering, and looked up again
// server-side by the Worker at checkout. That means a stale cart in someone's
// browser can never lock in an old price, and an edited cart in devtools can
// never buy a console for a dollar.
//
// Bench units (ids like "ro-0042") are one of a kind: their quantity is
// always 1. Their lines are kept even while the live listings haven't loaded,
// or when the unit has sold or is on hold, so the cart can say so rather than
// silently dropping them.

import { SHIPPING } from "../data/products.js";
import { findAny, isBenchId, BENCH_LISTING_ID, benchState } from "./catalogue.js";

const KEY = "dhole_store_cart_v1";

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    // Drop anything malformed or referring to a product that no longer exists.
    return raw
      .filter(l => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0)
      .filter(l => isBenchId(l.id) ? BENCH_LISTING_ID.test(l.id) : findAny(l.id))
      .map(l => ({ id: l.id, qty: isBenchId(l.id) ? 1 : l.qty }));
  } catch {
    return [];
  }
}

function write(lines) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  // Let every open page (and other tabs) refresh their badge.
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: lines }));
}

export function getCart() {
  return read();
}

export function countItems() {
  return read().reduce((n, l) => n + l.qty, 0);
}

export function inCart(id) {
  return read().some(l => l.id === id);
}

// Clamps to available stock and returns what actually happened so the UI can
// tell the customer "only 3 left" instead of silently ignoring them.
export function addToCart(id, qty = 1) {
  const product = findAny(id);
  if (!product) return { ok: false, reason: "not-found" };
  if (product.stock < 1) return { ok: false, reason: "out-of-stock" };

  const lines = read();
  const existing = lines.find(l => l.id === id);
  const wanted = (existing ? existing.qty : 0) + qty;
  const allowed = Math.min(wanted, product.stock);

  if (existing) existing.qty = allowed;
  else lines.push({ id, qty: allowed });

  write(lines);
  return { ok: true, clamped: allowed < wanted, qty: allowed, stock: product.stock };
}

export function setQty(id, qty) {
  const lines = read();
  const line = lines.find(l => l.id === id);
  if (!line) return;

  let max;
  if (isBenchId(id)) max = 1;
  else {
    const product = findAny(id);
    if (!product) return;
    max = product.stock;
  }

  const next = Math.max(0, Math.min(Math.floor(qty), max));
  if (next === 0) return removeFromCart(id);
  line.qty = next;
  write(lines);
}

export function removeFromCart(id) {
  write(read().filter(l => l.id !== id));
}

export function clearCart() {
  write([]);
}

// Resolves the cart into full line items with prices, for display only.
// A line whose product can't be shown is { id, qty, unavailable } with
// unavailable = "checking" (live listings still loading), "unreachable"
// (they failed to load) or "gone" (sold, withdrawn or on hold). Unavailable
// lines count toward nothing.
export function priceCart() {
  const lines = read();
  const items = [];
  const unavailable = [];
  for (const l of lines) {
    const p = findAny(l.id);
    if (p) {
      items.push({ ...p, qty: l.qty, lineTotalCents: p.priceCents * l.qty });
    } else {
      const s = benchState();
      unavailable.push({
        id: l.id,
        qty: l.qty,
        unavailable: s === "failed" ? "unreachable" : s === "ok" ? "gone" : "checking"
      });
    }
  }
  const subtotalCents = items.reduce((n, i) => n + i.lineTotalCents, 0);
  // Largest box in the order sets the rate; the checkout function decides
  // the real amount.
  const shipping = !items.length
    ? { label: "", short: "", cents: 0 }
    : items.some(i => i.shippingClass === "console") ? SHIPPING.console : SHIPPING.small;
  return {
    items,
    unavailable,
    subtotalCents,
    shippingCents: shipping.cents,
    // label is Stripe's wording (it names the dispatch promise); short is for
    // the cart's totals row, which states that promise elsewhere.
    shippingLabel: shipping.label,
    shippingShort: shipping.short ?? shipping.label,
    // Sales tax is calculated by Stripe at checkout, not here, so this total is
    // shown as "before tax" in the UI.
    totalCents: subtotalCents + shipping.cents
  };
}

// Keeps the header's cart link current on every page that includes it. The
// link is one text node, "Cart" or "Cart (3)": a separate count element
// would lose the space before it inside the flex nav.
export function mountCartBadge() {
  const paint = () => {
    const n = countItems();
    document.querySelectorAll("[data-cart-link]").forEach(el => {
      el.textContent = n > 0 ? `Cart (${n})` : "Cart";
    });
    // The previous header's count span, for a page still running a cached
    // copy of the old chrome.js. Remove after one release.
    document.querySelectorAll("[data-cart-count]").forEach(el => {
      el.textContent = n > 0 ? String(n) : "";
      el.style.display = n > 0 ? "inline-flex" : "none";
    });
  };
  window.addEventListener("cart:changed", paint);
  window.addEventListener("storage", e => { if (e.key === KEY) paint(); });
  paint();
}

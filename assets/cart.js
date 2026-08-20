// Cart state.
//
// The cart deliberately stores ONLY { id, qty }. It never stores a price.
// Prices are looked up from the catalogue when rendering, and looked up again
// server-side by the Worker at checkout. That means a stale cart in someone's
// browser can never lock in an old price, and an edited cart in devtools can
// never buy a console for a dollar.

import { findProduct, pickShipping } from "../data/products.js";

const KEY = "dhole_store_cart_v1";

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    // Drop anything malformed or referring to a product that no longer exists.
    return raw
      .filter(l => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0)
      .filter(l => findProduct(l.id))
      .map(l => ({ id: l.id, qty: l.qty }));
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

// Clamps to available stock and returns what actually happened so the UI can
// tell the customer "only 3 left" instead of silently ignoring them.
export function addToCart(id, qty = 1) {
  const product = findProduct(id);
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
  const product = findProduct(id);
  if (!product) return;
  const lines = read();
  const line = lines.find(l => l.id === id);
  if (!line) return;

  const next = Math.max(0, Math.min(Math.floor(qty), product.stock));
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
export function priceCart() {
  const lines = read();
  const items = lines.map(l => {
    const p = findProduct(l.id);
    return { ...p, qty: l.qty, lineTotalCents: p.priceCents * l.qty };
  });
  const subtotalCents = items.reduce((n, i) => n + i.lineTotalCents, 0);
  const shipping = items.length ? pickShipping(lines) : { label: "—", cents: 0 };
  return {
    items,
    subtotalCents,
    shippingCents: shipping.cents,
    shippingLabel: shipping.label,
    // Sales tax is calculated by Stripe at checkout, not here, so this total is
    // shown as "before tax" in the UI.
    totalCents: subtotalCents + shipping.cents
  };
}

// Keeps the header badge live on every page that includes it.
export function mountCartBadge() {
  const paint = () => {
    const n = countItems();
    document.querySelectorAll("[data-cart-count]").forEach(el => {
      el.textContent = n > 0 ? String(n) : "";
      el.style.display = n > 0 ? "inline-flex" : "none";
    });
  };
  window.addEventListener("cart:changed", paint);
  window.addEventListener("storage", e => { if (e.key === KEY) paint(); });
  paint();
}

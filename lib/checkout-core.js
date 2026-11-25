// Pure order-pricing logic, shared by the Pages Function and its tests.
//
// The whole reason this exists: on a static site the browser must never be the
// thing that decides a price. The storefront sends only product ids and
// quantities; this module looks each id up in the same catalogue the site
// renders from and prices the order server-side. Someone editing localStorage
// can change *what* they order, never *what it costs*.
//
// Two catalogues feed it. Hand-made items come from data/products.js. Bench
// units (ids like "ro-0042", pushed by RefurbOS) come from D1: the checkout
// Function reads them first and passes them in as `bench`, so this stays
// synchronous and pure. A bench id is never looked up in products.js.

import { products, SHIPPING } from "../data/products.js";
import { isBenchId, LISTING_ID } from "./store-db.js";

// Guardrails so a malformed or hostile body is rejected cheaply, before it
// ever costs us a Stripe call.
export const MAX_LINES = 20;
export const MAX_QTY_PER_LINE = 10;

// The bench ids a cart asks for, for the caller to load from D1 before
// pricing. Only well-formed listing ids; a cart too large to price asks for
// nothing (priceOrder refuses it without a database round trip).
export function benchIdsIn(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length > MAX_LINES) return [];
  const ids = rawLines
    .filter(l => l && isBenchId(l.id) && LISTING_ID.test(l.id))
    .map(l => l.id);
  return [...new Set(ids)];
}

// A bench unit can be bought when it is available, or held by a checkout
// whose hold has run out.
export function benchReachable(entry, now) {
  return entry.status === "available" ||
    (entry.status === "reserved" && !(entry.reservedUntil > now));
}

export function benchUnavailableMessage(entry, id) {
  const name = entry ? entry.product.name : id;
  if (entry && entry.status === "sold") return `${name} was just sold.`;
  // Neutral on whose checkout it is: the buyer may have started it
  // themselves and left Stripe (the cart then offers the way back to it).
  if (entry && entry.status === "reserved") {
    return `${name} is on hold in a checkout that hasn't finished (it may be yours). Holds end about half an hour after checkout starts.`;
  }
  return `${name} is no longer available.`;
}

// Returns either { error, status? } or { priced }. status is 409 when a bench
// unit is gone or held (the cart is fine, the stock moved), else the caller
// answers 400.
//
// bench: Map of listing id -> { product, status, reservedUntil }, from
// store-db.loadForCheckout. now: ISO time, to tell a live hold from an
// expired one.
export function priceOrder(rawLines, { bench = new Map(), now = new Date().toISOString() } = {}) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "Your cart is empty." };
  }
  if (rawLines.length > MAX_LINES) {
    return { error: "Too many different items in one order." };
  }

  const seen = new Set();
  const priced = [];

  for (const line of rawLines) {
    if (!line || typeof line.id !== "string") return { error: "Malformed cart." };

    // Collapse duplicate ids rather than letting them stack past stock limits.
    if (seen.has(line.id)) return { error: "Duplicate items in cart." };
    seen.add(line.id);

    if (isBenchId(line.id)) {
      // One unit is one listing: the price is D1's, the quantity is always 1.
      const entry = bench.get(line.id) || null;
      if (!entry) return { error: benchUnavailableMessage(null, line.id), status: 409 };
      if (Number(line.qty) !== 1) {
        return { error: `Invalid quantity for ${entry.product.name}: each refurbished unit is one of a kind.` };
      }
      if (!benchReachable(entry, now)) {
        return { error: benchUnavailableMessage(entry, line.id), status: 409 };
      }
      priced.push({ product: entry.product, qty: 1, bench: true });
      continue;
    }

    const product = products.find(p => p.id === line.id);
    if (!product) return { error: `"${line.id}" is no longer available.` };

    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { error: `Invalid quantity for ${product.name}.` };
    }
    if (product.stock < 1) return { error: `${product.name} is sold out.` };
    if (qty > product.stock) {
      return { error: `Only ${product.stock} of ${product.name} left in stock.` };
    }

    priced.push({ product, qty });
  }

  return { priced };
}

// Largest box in the order sets the rate, rather than charging per item.
export function shippingFor(priced) {
  const hasConsole = priced.some(l => l.product.shippingClass === "console");
  return hasConsole ? SHIPPING.console : SHIPPING.small;
}

// Stripe's API takes form-encoded bodies with bracketed nested keys, e.g.
// line_items[0][price_data][unit_amount]. Flatten a plain object into that.
export function toForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") toForm(item, `${path}[${i}]`, out);
        else out.append(`${path}[${i}]`, String(item));
      });
    } else if (typeof value === "object") {
      toForm(value, path, out);
    } else {
      out.append(path, String(value));
    }
  }
  return out;
}

// Builds the Stripe Checkout Session payload from an already-priced order.
//
// hold: { token, expiresAt } when the order has bench units. expiresAt (Unix
// seconds) is the same instant the units' hold ends, so Stripe can't take a
// payment for a unit after its hold has lapsed. The metadata tells the webhook
// which units this session paid for, and at what unit price.
export function buildSessionPayload(priced, { siteUrl, currency, automaticTax, shipToCountries, hold = null }) {
  const site = (siteUrl || "").replace(/\/$/, "");
  const shipping = shippingFor(priced);

  const payload = {
    mode: "payment",
    // The clean URLs: the .html form costs the buyer a 308 on the way back.
    success_url: `${site}/order-complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/checkout-cancelled`,
    line_items: priced.map(({ product, qty }) => ({
      quantity: qty,
      price_data: {
        currency,
        unit_amount: product.priceCents, // server-side price, always
        product_data: {
          name: product.name,
          description: `${product.platform} · ${product.condition}`,
          images: site ? [`${site}/${product.image.replace(/^\//, "")}`] : undefined
        }
      }
    })),
    shipping_address_collection: { allowed_countries: shipToCountries },
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: shipping.label,
        fixed_amount: { amount: shipping.cents, currency }
      }
    }],
    // Recorded on the payment so you can see what was ordered without
    // cross-referencing anything.
    metadata: { order: priced.map(l => `${l.product.id} x${l.qty}`).join(", ") }
  };

  const benchLines = priced.filter(l => l.bench);
  if (benchLines.length) {
    if (!hold || !hold.token || !Number.isInteger(hold.expiresAt)) {
      throw new Error("An order with bench units needs a hold before it reaches Stripe.");
    }
    payload.expires_at = hold.expiresAt;
    payload.metadata.bench_ids = benchLines.map(l => l.product.id).join(",");
    payload.metadata.bench_amounts = benchLines.map(l => l.product.priceCents).join(",");
    payload.metadata.bench_hold = hold.token;
  }

  // Stripe Tax is opt-in: it errors unless you have configured an origin
  // address and tax registrations, so it stays off until switched on.
  if (automaticTax) payload.automatic_tax = { enabled: true };

  return payload;
}

// Pure order-pricing logic, shared by the Pages Function and its tests.
//
// The whole reason this exists: on a static site the browser must never be the
// thing that decides a price. The storefront sends only product ids and
// quantities; this module looks each id up in the same catalogue the site
// renders from and prices the order server-side. Someone editing localStorage
// can change *what* they order, never *what it costs*.

import { products, SHIPPING } from "../data/products.js";

// Guardrails so a malformed or hostile body is rejected cheaply, before it
// ever costs us a Stripe call.
export const MAX_LINES = 20;
export const MAX_QTY_PER_LINE = 10;

// Returns either { error } or { priced }.
export function priceOrder(rawLines) {
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
export function buildSessionPayload(priced, { siteUrl, currency, automaticTax, shipToCountries }) {
  const site = (siteUrl || "").replace(/\/$/, "");
  const shipping = shippingFor(priced);

  const payload = {
    mode: "payment",
    success_url: `${site}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/checkout-cancelled.html`,
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

  // Stripe Tax is opt-in: it errors unless you have configured an origin
  // address and tax registrations, so it stays off until switched on.
  if (automaticTax) payload.automatic_tax = { enabled: true };

  return payload;
}

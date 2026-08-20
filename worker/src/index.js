// Checkout Worker — creates Stripe Checkout Sessions for the dhole.dev store.
//
// The whole reason this exists on a static site: the browser must never be the
// thing that decides a price. The storefront sends only product ids and
// quantities. This Worker looks each id up in the same catalogue file the site
// renders from, prices the order itself, and hands Stripe the result. Someone
// editing localStorage or replaying the request can change *what* they order,
// never *what it costs*.
//
// The Stripe secret key lives in a Worker secret and never reaches the browser.

import { products, CURRENCY, SHIPPING } from "../../data/products.js";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

// Guardrails on request shape, so a malformed or hostile body is rejected
// cheaply before it ever costs us a Stripe call.
const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;

function corsHeaders(origin, allowed) {
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  // Only reflect an origin we actually trust; no wildcard.
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

// Stripe's API takes form-encoded bodies with bracketed nested keys, e.g.
// line_items[0][price_data][unit_amount]. Flatten a plain object into that.
function toForm(obj, prefix = "", out = new URLSearchParams()) {
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

// Validates the requested lines against the catalogue and returns either an
// error string or the priced, trusted order.
function priceOrder(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "Your cart is empty." };
  }
  if (rawLines.length > MAX_LINES) {
    return { error: "Too many different items in one order." };
  }

  const seen = new Set();
  const priced = [];

  for (const line of rawLines) {
    if (!line || typeof line.id !== "string") {
      return { error: "Malformed cart." };
    }
    // Collapse duplicate ids rather than letting them stack past stock limits.
    if (seen.has(line.id)) {
      return { error: "Duplicate items in cart." };
    }
    seen.add(line.id);

    const product = products.find(p => p.id === line.id);
    if (!product) {
      return { error: `"${line.id}" is no longer available.` };
    }

    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { error: `Invalid quantity for ${product.name}.` };
    }
    if (product.stock < 1) {
      return { error: `${product.name} is sold out.` };
    }
    if (qty > product.stock) {
      return { error: `Only ${product.stock} of ${product.name} left in stock.` };
    }

    priced.push({ product, qty });
  }

  return { priced };
}

function shippingFor(priced) {
  const hasConsole = priced.some(l => l.product.shippingClass === "console");
  return hasConsole ? SHIPPING.console : SHIPPING.small;
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, cors);
    }
    // A browser request from an origin we did not allow gets nothing back.
    if (origin && !allowed.includes(origin)) {
      return json({ error: "Origin not allowed." }, 403, cors);
    }
    if (!env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is not set on this Worker.");
      return json({ error: "Checkout is not configured." }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request." }, 400, cors);
    }

    const { error, priced } = priceOrder(body?.lines);
    if (error) return json({ error }, 400, cors);

    const site = (env.SITE_URL || "").replace(/\/$/, "");
    const shipping = shippingFor(priced);

    const payload = {
      mode: "payment",
      success_url: `${site}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/checkout-cancelled.html`,
      line_items: priced.map(({ product, qty }) => ({
        quantity: qty,
        price_data: {
          currency: CURRENCY,
          unit_amount: product.priceCents, // server-side price, always
          product_data: {
            name: product.name,
            description: `${product.platform} · ${product.condition}`,
            images: site ? [`${site}/${product.image}`] : undefined
          }
        }
      })),
      shipping_address_collection: {
        allowed_countries: (env.SHIP_TO_COUNTRIES || "US")
          .split(",").map(s => s.trim()).filter(Boolean)
      },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: shipping.label,
          fixed_amount: { amount: shipping.cents, currency: CURRENCY }
        }
      }],
      // Recorded on the payment so you can see what was ordered without
      // cross-referencing anything.
      metadata: {
        order: priced.map(l => `${l.product.id} x${l.qty}`).join(", ")
      }
    };

    // Stripe Tax is opt-in: it errors unless you have configured an origin
    // address and tax registrations, so it stays off until you switch it on.
    if (String(env.ENABLE_AUTOMATIC_TAX) === "true") {
      payload.automatic_tax = { enabled: true };
    }

    try {
      const res = await fetch(STRIPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: toForm(payload).toString()
      });

      const session = await res.json();

      if (!res.ok) {
        // Log the real reason for us; return something safe to the customer.
        console.error("Stripe error:", JSON.stringify(session));
        return json({ error: "Payment provider rejected the order." }, 502, cors);
      }

      return json({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("Checkout failed:", err && err.message);
      return json({ error: "Could not reach the payment provider." }, 502, cors);
    }
  }
};

// Exported for the test script.
export const __test = { priceOrder, toForm, shippingFor };

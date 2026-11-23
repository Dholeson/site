// POST /api/checkout — creates a Stripe Checkout Session.
//
// This runs as a Cloudflare Pages Function, which means it is served from the
// same origin as the site itself (dhole.dev/api/checkout). That removes CORS
// from the picture entirely and means there is no separate Worker to deploy or
// keep in sync -- `wrangler pages deploy` ships the site and this together.
//
// The Stripe secret key lives in a Pages environment secret and never reaches
// the browser.
//
// Bench units (ids like "ro-0042", pushed by RefurbOS into D1) are priced from
// D1 and held before Stripe is called: every bench unit in the order, or none.
// The hold ends when the Stripe session expires; the Stripe webhook
// (functions/api/stripe/webhook.js) turns it into a sale or releases it. If
// Stripe refuses or can't be reached, the hold is released here.

import { CURRENCY } from "../../data/products.js";
import {
  priceOrder, buildSessionPayload, toForm, benchIdsIn, benchReachable, benchUnavailableMessage
} from "../../lib/checkout-core.js";
import {
  loadForCheckout, reserveUnits, attachSession, releaseHolds, nowIso, HOLD_SECONDS
} from "../../lib/store-db.js";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function release(db, token) {
  try {
    await releaseHolds(db, [token]);
  } catch (err) {
    // The hold still lapses on its own at reserved_until.
    console.error("Could not release a checkout hold:", err && err.message);
  }
}

// A single handler for every method, rather than exporting both onRequestPost
// and a generic onRequest and relying on which one Pages gives precedence to.
export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (!env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set for this Pages project.");
    return json({ error: "Checkout is not configured." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const lines = body?.lines;

  // Bench units are priced from D1, never from the cart.
  const benchIds = benchIdsIn(lines);
  let bench = new Map();
  if (benchIds.length) {
    if (!env.DB) {
      console.error("The DB (D1) binding is missing; bench units can't be sold.");
      return json({ error: "Live stock can't be checked right now. Please try again later." }, 503);
    }
    try {
      bench = await loadForCheckout(env.DB, benchIds);
    } catch (err) {
      console.error("Loading bench stock failed:", err && err.message);
      return json({ error: "Live stock can't be checked right now. Please try again later." }, 503);
    }
  }

  const startedMs = Date.now();
  const now = nowIso(startedMs);
  const { error, status, priced } = priceOrder(lines, { bench, now });
  if (error) return json({ error }, status || 400);

  // Hold every bench unit in the order, all or none, before Stripe is asked.
  const held = priced.filter(l => l.bench).map(l => l.product.id);
  let hold = null;
  if (held.length) {
    const expiresAt = Math.ceil(startedMs / 1000) + HOLD_SECONDS;
    hold = { token: `hold_${crypto.randomUUID()}`, expiresAt, until: nowIso(expiresAt * 1000) };
    let ok;
    try {
      ok = await reserveUnits(env.DB, held, hold.token, hold.until, now);
    } catch (err) {
      console.error("Reserving bench stock failed:", err && err.message);
      return json({ error: "Live stock can't be checked right now. Please try again later." }, 503);
    }
    if (!ok) {
      // Someone else got there first. Say which unit, from a fresh read.
      let fresh = bench;
      try { fresh = await loadForCheckout(env.DB, held); } catch { /* fall back to the first read */ }
      const gone = held.filter(id => !fresh.get(id) || !benchReachable(fresh.get(id), nowIso()));
      const first = gone[0] ?? held[0];
      return json({
        error: benchUnavailableMessage(fresh.get(first) ?? bench.get(first), first),
        unavailable: gone.length ? gone : held
      }, 409);
    }
  }

  // Same-origin by construction, but fall back to the request's own origin so
  // preview deployments build correct return URLs too.
  const siteUrl = env.SITE_URL || new URL(request.url).origin;

  const payload = buildSessionPayload(priced, {
    siteUrl,
    currency: CURRENCY,
    automaticTax: String(env.ENABLE_AUTOMATIC_TAX) === "true",
    shipToCountries: (env.SHIP_TO_COUNTRIES || "US")
      .split(",").map(s => s.trim()).filter(Boolean),
    hold
  });

  try {
    const res = await fetch(STRIPE_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: toForm(payload).toString()
    });

    const session = await res.json().catch(() => null);

    if (!res.ok || !session || typeof session.url !== "string") {
      // Log the real reason for us; return something safe to the customer.
      console.error("Stripe error:", JSON.stringify(session));
      if (hold) await release(env.DB, hold.token);
      return json({ error: "Payment provider rejected the order." }, 502);
    }

    if (hold && typeof session.id === "string" && session.id.startsWith("cs_")) {
      try {
        await attachSession(env.DB, hold.token, session.id);
      } catch (err) {
        // Still held under the token, which the webhook also knows (metadata
        // bench_hold), and it lapses at reserved_until regardless.
        console.error("Could not record the session on the hold:", err && err.message);
      }
    }

    return json({ url: session.url }, 200);
  } catch (err) {
    console.error("Checkout failed:", err && err.message);
    if (hold) await release(env.DB, hold.token);
    return json({ error: "Could not reach the payment provider." }, 502);
  }
}

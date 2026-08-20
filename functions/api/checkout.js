// POST /api/checkout — creates a Stripe Checkout Session.
//
// This runs as a Cloudflare Pages Function, which means it is served from the
// same origin as the site itself (dhole.dev/api/checkout). That removes CORS
// from the picture entirely and means there is no separate Worker to deploy or
// keep in sync -- `wrangler pages deploy` ships the site and this together.
//
// The Stripe secret key lives in a Pages environment secret and never reaches
// the browser.

import { CURRENCY } from "../../data/products.js";
import { priceOrder, buildSessionPayload, toForm } from "../../lib/checkout-core.js";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
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

  const { error, priced } = priceOrder(body?.lines);
  if (error) return json({ error }, 400);

  // Same-origin by construction, but fall back to the request's own origin so
  // preview deployments build correct return URLs too.
  const siteUrl = env.SITE_URL || new URL(request.url).origin;

  const payload = buildSessionPayload(priced, {
    siteUrl,
    currency: CURRENCY,
    automaticTax: String(env.ENABLE_AUTOMATIC_TAX) === "true",
    shipToCountries: (env.SHIP_TO_COUNTRIES || "US")
      .split(",").map(s => s.trim()).filter(Boolean)
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

    const session = await res.json();

    if (!res.ok) {
      // Log the real reason for us; return something safe to the customer.
      console.error("Stripe error:", JSON.stringify(session));
      return json({ error: "Payment provider rejected the order." }, 502);
    }

    return json({ url: session.url }, 200);
  } catch (err) {
    console.error("Checkout failed:", err && err.message);
    return json({ error: "Could not reach the payment provider." }, 502);
  }
}

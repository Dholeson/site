// POST /api/stripe/webhook — Stripe tells the store how each Checkout Session
// ended, and bench units become sales or go back on sale.
//
// Set up in the Stripe dashboard (SETUP.md, "Live bench stock"): endpoint
// <site>/api/stripe/webhook, events checkout.session.completed and
// checkout.session.expired, signing secret in the Pages secret
// STRIPE_WEBHOOK_SECRET.
//
//   checkout.session.completed, payment_status "paid":
//     each bench unit in the session's metadata (bench_ids) -> sold, plus one
//     store_sales row per unit, which RefurbOS pulls from
//     GET /api/bench/sales. Idempotent on (session, unit), so a redelivery
//     changes nothing. A unit withdrawn meanwhile is still recorded: the money
//     was taken, and the owner must see it.
//   checkout.session.expired:
//     release the units that session was holding.
//   anything else: 200, ignored.
//
// Answers 400 to anything whose signature doesn't verify, and 503 while the
// secret is unset. Any other failure is a 500, so Stripe retries it.

import { json, methodNotAllowed, readBody, parseJson } from "../../../lib/http.js";
import { verifyStripeSignature } from "../../../lib/stripe-signature.js";
import { LISTING_ID, recordSales, releaseHolds, nowIso } from "../../../lib/store-db.js";
import { CURRENCY } from "../../../data/products.js";

const MAX_EVENT_BYTES = 1_000_000;

const str = v => (typeof v === "string" && v !== "" ? v : null);
const cents = v => (Number.isInteger(v) && v >= 0 ? v : null);

function benchUnits(session) {
  const md = session.metadata || {};
  const ids = String(md.bench_ids || "").split(",").map(s => s.trim()).filter(Boolean);
  const amounts = String(md.bench_amounts || "").split(",").map(s => s.trim());
  const units = [];
  const seen = new Set();
  ids.forEach((id, i) => {
    if (!LISTING_ID.test(id) || seen.has(id)) {
      console.error(`Ignoring a malformed bench id in session ${session.id}: ${id}`);
      return;
    }
    seen.add(id);
    const amount = /^\d+$/.test(amounts[i] || "") ? Number(amounts[i]) : null;
    units.push({ listingId: id, amountCents: amount });
  });
  return units;
}

function shipTo(session) {
  const sd = (session.collected_information && session.collected_information.shipping_details)
    || session.shipping_details || null;
  if (!sd || !sd.address) return null;
  const a = sd.address;
  return {
    name: str(sd.name),
    line1: str(a.line1),
    line2: str(a.line2),
    city: str(a.city),
    state: str(a.state),
    postal_code: str(a.postal_code),
    country: str(a.country)
  };
}

async function completed(env, event, session) {
  const units = benchUnits(session);
  if (!units.length) return json({ received: true }, 200);

  if (session.payment_status !== "paid") {
    // Delayed payment methods (bank debits) complete unpaid and settle later.
    // The contract only turns a paid session into a sale; the hold lapses.
    console.error(`Session ${session.id} completed with payment_status ${session.payment_status}; not recorded as a sale.`);
    return json({ received: true, ignored: "not paid" }, 200);
  }
  if (!env.DB) return json({ error: "The store database (D1 binding DB) is not configured." }, 503);

  // The amount is the line's unit_amount, which checkout wrote into the
  // metadata when it priced the order. Should it ever be missing, fall back to
  // the listing's price rather than lose the sale.
  for (const u of units) {
    if (u.amountCents === null) {
      const row = await env.DB.prepare("SELECT price_cents FROM store_listings WHERE id = ?1")
        .bind(u.listingId).first();
      u.amountCents = row ? row.price_cents : 0;
      console.error(`Session ${session.id}: no amount in metadata for ${u.listingId}; used ${u.amountCents}.`);
    }
  }

  const soldMs = Number.isInteger(event.created) ? event.created * 1000 : Date.now();
  const details = session.customer_details || {};
  const total = session.total_details || {};
  await recordSales(env.DB, {
    sessionId: session.id,
    units,
    shippingCents: cents(total.amount_shipping)
      ?? cents(session.shipping_cost && session.shipping_cost.amount_subtotal) ?? 0,
    currency: /^[a-z]{3}$/.test(session.currency || "") ? session.currency : CURRENCY,
    paymentIntent: typeof session.payment_intent === "string" && session.payment_intent.startsWith("pi_")
      ? session.payment_intent : null,
    buyerName: str(details.name),
    buyerEmail: str(details.email) ?? str(session.customer_email),
    shipTo: shipTo(session),
    soldAt: nowIso(soldMs)
  }, nowIso());

  return json({ received: true, units: units.map(u => u.listingId) }, 200);
}

async function expired(env, session) {
  const hold = str(session.metadata && session.metadata.bench_hold);
  if (!hold && !String((session.metadata && session.metadata.bench_ids) || "")) {
    return json({ received: true }, 200);
  }
  if (!env.DB) return json({ error: "The store database (D1 binding DB) is not configured." }, 503);
  // Held under the session id, or still under the hold token if recording the
  // session id failed. Units that sold or were re-held since don't match.
  const released = await releaseHolds(env.DB, [session.id, hold]);
  return json({ received: true, released }, 200);
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set for this Pages project.");
    return json({ error: "Stripe webhooks are not configured." }, 503);
  }

  const { bytes, tooLarge } = await readBody(request, MAX_EVENT_BYTES);
  if (tooLarge) return json({ error: "The event is too large." }, 413);

  const check = await verifyStripeSignature(bytes, request.headers.get("Stripe-Signature"), secret);
  if (!check.ok) return json({ error: check.reason }, 400);

  const event = parseJson(bytes);
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    return json({ error: "The event isn't valid JSON." }, 400);
  }

  const session = event.data && event.data.object;
  const isSession = session && typeof session === "object" &&
    typeof session.id === "string" && session.id.startsWith("cs_");

  try {
    if (event.type === "checkout.session.completed" && isSession) return await completed(env, event, session);
    if (event.type === "checkout.session.expired" && isSession) return await expired(env, session);
    return json({ received: true, ignored: event.type }, 200);
  } catch (err) {
    console.error(`Webhook ${event.type} failed:`, err && (err.stack || err.message));
    return json({ error: "The store couldn't record this event; Stripe will retry." }, 500);
  }
}

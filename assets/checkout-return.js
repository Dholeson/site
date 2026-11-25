// The way back to a checkout the buyer started and left.
//
// Starting a Stripe checkout holds every bench unit in it for about half an
// hour (functions/api/checkout.js). A buyer who leaves Stripe without paying
// would otherwise find their own units "on hold" and no way back to the one
// checkout that can still buy them. So the cart saves the Stripe URL just
// before redirecting, and the product, cart and checkout-cancelled pages
// offer "Return to your checkout" while it can still be live.
//
//   saveCheckout({ url, ids })   the cart, just before location.assign(url)
//   liveCheckout()               { url, ids, startedAt }, or null
//   clearCheckout()              /order-complete, once the order is paid
//
// A record counts only while its URL is Stripe's checkout and it is under 30
// minutes old (the hold lasts 31). Every localStorage access is wrapped: a
// private window or blocked storage just means there is no way back to offer.

const KEY = "dhole_checkout_v1";
const STRIPE = "https://checkout.stripe.com/";
const LIVE_MS = 30 * 60 * 1000;

export function saveCheckout({ url, ids } = {}) {
  try {
    const list = Array.isArray(ids) ? ids.filter(id => typeof id === "string") : [];
    localStorage.setItem(KEY, JSON.stringify({ url: String(url), ids: list, startedAt: Date.now() }));
  } catch { /* storage unavailable: nothing to come back to */ }
}

export function liveCheckout() {
  let record;
  try {
    record = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
  if (!record || typeof record !== "object") return null;
  const { url, ids, startedAt } = record;
  if (typeof url !== "string" || !url.startsWith(STRIPE)) return null;
  if (!Number.isFinite(startedAt)) return null;
  const age = Date.now() - startedAt;
  if (!(age >= 0 && age < LIVE_MS)) return null;
  return { url, ids: Array.isArray(ids) ? ids.filter(id => typeof id === "string") : [], startedAt };
}

export function clearCheckout() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing stored */ }
}

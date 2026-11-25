// The way back to a checkout the buyer started and left.
//
// Starting a Stripe checkout holds every bench unit in it for about half an
// hour (functions/api/checkout.js). A buyer who leaves Stripe without paying
// would otherwise find their own units "on hold" and no way back to the one
// checkout that can still buy them. So the cart saves the Stripe URL just
// before redirecting, and the product, cart and checkout-cancelled pages
// offer "Return to your checkout" while it can still be live.
//
//   saveCheckout({ url, ids, lines })   the cart, just before location.assign(url)
//   liveCheckout()               { url, ids, lines, startedAt }, or null
//   orderedLines(sessionId)      /order-complete: the cart lines that went to
//                                that checkout, or null when unknown
//   clearCheckout()              /order-complete, once the order is paid
//
// `ids` are the bench units the checkout holds; `lines` are every cart line
// that went to it (units and catalogue items), so /order-complete can take
// just those out of the cart and leave anything added since. Without
// `lines`, the held ids stand in for them.
//
// A record counts as live only while its URL is Stripe's checkout and it is
// under 30 minutes old (the hold lasts 31). Every localStorage access is
// wrapped: a private window or blocked storage just means there is no way
// back to offer.

const KEY = "dhole_checkout_v1";
const STRIPE = "https://checkout.stripe.com/";
const LIVE_MS = 30 * 60 * 1000;
// A Checkout Session can't outlive a day (Stripe's maximum), so an older
// record can't belong to the order that just completed.
const ORDER_MS = 24 * 60 * 60 * 1000;

const strings = list => (Array.isArray(list) ? list.filter(id => typeof id === "string") : []);

export function saveCheckout({ url, ids, lines } = {}) {
  try {
    const held = strings(ids);
    const all = Array.isArray(lines) ? strings(lines) : held;
    localStorage.setItem(KEY, JSON.stringify({ url: String(url), ids: held, lines: all, startedAt: Date.now() }));
  } catch { /* storage unavailable: nothing to come back to */ }
}

// The stored record if it is a Stripe checkout started no more than maxAge
// ago, else null.
function readRecord(maxAge) {
  let record;
  try {
    record = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
  if (!record || typeof record !== "object") return null;
  const { url, ids, lines, startedAt } = record;
  if (typeof url !== "string" || !url.startsWith(STRIPE)) return null;
  if (!Number.isFinite(startedAt)) return null;
  const age = Date.now() - startedAt;
  if (!(age >= 0 && age < maxAge)) return null;
  const held = strings(ids);
  return { url, ids: held, lines: Array.isArray(lines) ? strings(lines) : held, startedAt };
}

export function liveCheckout() {
  return readRecord(LIVE_MS);
}

// What /order-complete takes out of the cart: the lines of the saved
// checkout, at any age up to a day (Stripe's success redirect can land just
// after the 30 minutes). Stripe's checkout URL carries the session id, so
// when /order-complete names a session the record must be that one's.
// null means "not known": the caller empties the whole cart, as before.
export function orderedLines(sessionId) {
  const record = readRecord(ORDER_MS);
  if (!record) return null;
  if (typeof sessionId === "string" && sessionId && !record.url.includes(sessionId)) return null;
  return record.lines;
}

export function clearCheckout() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing stored */ }
}

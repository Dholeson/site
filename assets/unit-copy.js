// The words every page uses about a unit: its display id, its name with that
// id, the delivered-price line, the returns line and the link-preview
// description. One place, so the store card, the product page, the cart, the
// server-written <head> (lib/seo.js) and the tests all say the same thing.
//
// Pure: it imports data/products.js and nothing else, and never touches the
// DOM, so the browser, the Pages Functions and node tests can all load it.
// These return plain text; callers escape it before it reaches innerHTML.

import { CONDITION_LABELS, RETURNS, SHIPPING, formatMoney } from "../data/products.js";

// The dispatch promise, worded the same everywhere.
export const DISPATCH = "Ships within two business days.";

const BENCH_ID = /^ro-\d+$/;

const oneLine = s => String(s ?? "").replace(/\s+/g, " ").trim();
// "Refurbished." would end a sentence twice once a full stop is added.
const phrase = s => oneLine(s).replace(/[.\s]+$/, "");

// "ro-0042" -> "RO-0042": how buyers see and type a unit id.
export const displayId = id => oneLine(id).toUpperCase();

// A unit listed from RefurbOS (one unit, one listing), as opposed to a
// hand-made catalogue item from data/products.js.
export const isBench = p => Boolean(p) && (p.source === "bench" || (typeof p.id === "string" && BENCH_ID.test(p.id)));

// The flat rate this item ships at on its own.
export const shippingOf = p => (p && SHIPPING[p.shippingClass]) || SHIPPING.small;

const isConsole = p => (p && p.category ? p.category === "console" : shippingOf(p) === SHIPPING.console);

// "Nintendo 64, Charcoal (RO-0042)" for a bench unit; the plain name otherwise.
export function unitName(p) {
  const name = oneLine(p.name);
  return isBench(p) ? `${name} (${displayId(p.id)})` : name;
}

// "Nintendo 64, Charcoal (RO-0042): $159.00"
export const cardTitle = p => `${unitName(p)}: ${formatMoney(p.priceCents)}`;

// What it costs at the door. An accessory ships free in an order with a
// console (the biggest box sets the rate), so its line says so.
export function deliveredLine(p) {
  const ship = shippingOf(p);
  const head = `+ ${formatMoney(ship.cents)} shipping = ${formatMoney(p.priceCents + ship.cents)} delivered`;
  return ship === SHIPPING.console ? `${head}.` : `${head}, or no extra shipping in an order with a console.`;
}

// The stated returns term for this kind of item, or null when none is stated
// yet (pages then link to /shipping-returns alone).
export const returnsLine = p => (isConsole(p) ? RETURNS.console : RETURNS.accessory);

const conditionOf = p => (isBench(p) ? p.condition : (CONDITION_LABELS[p.condition] || p.condition));

// The link-preview and search description, unclipped (lib/seo.js clips it):
// "$159.00 + $18.00 shipping. Nintendo 64, unit RO-0042. Refurbished. <blurb>"
export function shareDescription(p) {
  const price = formatMoney(p.priceCents);
  const ship = formatMoney(shippingOf(p).cents);
  const unit = isBench(p) ? `, unit ${displayId(p.id)}` : "";
  return `${price} + ${ship} shipping. ${phrase(p.platform)}${unit}. ${phrase(conditionOf(p))}. ${oneLine(p.blurb)}`.trim();
}

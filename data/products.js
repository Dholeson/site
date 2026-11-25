// Single source of truth for the hand-typed catalogue.
//
// IMPORTANT: this file is imported by BOTH the browser storefront and the
// Cloudflare Worker that creates Stripe Checkout sessions. The Worker is the
// side that decides what a customer actually pays, so prices here are the real
// prices. Never let the browser send a price to checkout -- it only ever sends
// an id and a quantity.
//
// Money is always an integer number of cents. No floats, ever: 0.1 + 0.2 in
// JavaScript is not 0.3, and that turns into mischarged customers.
//
// WHAT BELONGS HERE: only new, interchangeable stock you actually have on the
// shelf (a cable, a cleaning kit), each with a real photo. Every used console,
// controller or memory card is a bench unit: refurbished and listed from
// RefurbOS with photos of that exact unit (stored in D1, see lib/store-db.js,
// ids like "ro-0042"). Never give a product here an id of that shape;
// test/checkout.test.js checks that, and that nothing here is used.
//
// The list is empty: the drawn placeholders the store launched with came off
// sale on 2026-11-25 (the tests keep them as stand-ins in
// test/support/catalogue-fixture.js). To add an item, copy this shape:
//   {
//     id: "av-cable-composite",          // lowercase, never "ro-<digits>"
//     name: "Composite AV Cable (Multi-Out)",
//     platform: "Multi-platform",
//     category: "accessory",             // or "console"
//     condition: "new",                  // only "new" belongs here
//     priceCents: 1200,
//     stock: 25,                          // drop it when one sells: stock doesn't count itself down
//     shippingClass: "small",            // or "console"
//     image: "assets/store/av-cable-1.jpg",   // a real photo, not a drawing
//     blurb: "One or two sentences.",
//     details: ["One fact per line"]
//   },

export const CURRENCY = "usd";

// Flat-rate shipping per class, in cents. The heaviest class in an order wins
// (lib/checkout-core.js shippingFor, mirrored for display in assets/cart.js)
// rather than summing, so a console plus three controllers ships as one
// console-sized box. Bench units carry the same classes.
// label goes to Stripe as the shipping rate's display_name (checkout page and receipts); short is for the cart and tables.
export const SHIPPING = {
  small:   { label: "Shipping (accessories), ships within two business days", short: "Shipping (accessories)", cents: 600 },
  console: { label: "Shipping (console box), ships within two business days", short: "Shipping (console box)", cents: 1800 }
};

// The returns terms, in one place. Pages render them from here; test/design.test.js fails if any page states another.
// null = no terms stated yet (pages link to /shipping-returns instead). Change only when the owner decides (R §8).
export const RETURNS = {
  console: "If a console doesn't power on, there's a 30-day return window.",
  accessory: null
};

// Mirrors ENABLE_AUTOMATIC_TAX in wrangler.toml (test/unit-copy.test.js holds them equal). true = the cart says "Total before tax".
export const AUTOMATIC_TAX = false;

export const products = [];

// ---- helpers shared by the browser and the Worker ----

export function findProduct(id) {
  return products.find(p => p.id === id) || null;
}

export function formatMoney(cents, currency = CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

export const CONDITION_LABELS = {
  "new": "New",
  "refurbished": "Refurbished",
  "used-good": "Used, good",
  "used-fair": "Used, fair"
};

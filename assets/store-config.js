// The one file you edit to turn payments on.
//
// Checkout runs as a Cloudflare Pages Function on this same site, so this is a
// same-origin path rather than a full URL -- no CORS, and it works unchanged on
// preview deployments too.
//
// Set this to "" to take the shop offline: the catalogue keeps working and the
// checkout button explains that payments are not switched on, rather than
// failing silently or taking an order that cannot be fulfilled.

export const CHECKOUT_ENDPOINT = "/api/checkout";

// Shown on the storefront and in the order confirmation.
export const STORE_NAME = "dhole.dev store";
export const SUPPORT_EMAIL = "";

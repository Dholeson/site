// The one file you edit to turn payments on.
//
// Set CHECKOUT_ENDPOINT to the URL of your deployed Cloudflare Worker (see
// STORE_SETUP.md). Until it is set, the storefront still works as a browsable
// catalogue and the checkout button explains that payments are not live yet --
// it never silently fails or takes an order it cannot fulfil.
//
// Example once deployed:
//   export const CHECKOUT_ENDPOINT = "https://dhole-store-checkout.<subdomain>.workers.dev/checkout";
// or, if you put the Worker on a route on your own domain:
//   export const CHECKOUT_ENDPOINT = "https://dhole.dev/api/checkout";

export const CHECKOUT_ENDPOINT = "";

// Shown on the storefront and in the order confirmation.
export const STORE_NAME = "dhole.dev store";
export const SUPPORT_EMAIL = "";

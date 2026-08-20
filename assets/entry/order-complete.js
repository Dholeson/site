// The cart is cleared only here -- never before redirecting to Stripe, because
// an abandoned checkout must leave the cart intact.
import { mountChrome } from "../chrome.js";
import { clearCart } from "../cart.js";
import { SUPPORT_EMAIL } from "../store-config.js";
import { esc } from "../esc.js";

mountChrome("store");
clearCart();
if (SUPPORT_EMAIL) {
  document.getElementById("support").innerHTML =
    `Questions about your order? Email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>.`;
}

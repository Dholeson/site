// The cart is cleared only here, never before redirecting to Stripe: a
// checkout left unpaid must leave the cart as it was. The saved way back to
// that checkout (assets/checkout-return.js) goes too, since it's paid.
import { mountChrome } from "../chrome.js";
import { clearCart } from "../cart.js";
import { clearCheckout } from "../checkout-return.js";

mountChrome("cart");
clearCart();
clearCheckout();

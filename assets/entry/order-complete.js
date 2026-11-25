// The cart is cleared only here, never before redirecting to Stripe: a
// checkout left unpaid must leave the cart as it was. Only the lines that
// went to the paid checkout come out (assets/checkout-return.js saved them):
// a unit added to the cart after that checkout started wasn't paid for, so
// it stays. With no record of that checkout, the whole cart goes, as it
// always did. The saved way back to that checkout goes too, since it's paid.
import { mountChrome } from "../chrome.js";
import { clearCart, removeFromCart } from "../cart.js";
import { clearCheckout, orderedLines } from "../checkout-return.js";

mountChrome("cart");
const paid = orderedLines(new URLSearchParams(location.search).get("session_id"));
if (paid) paid.forEach(id => removeFromCart(id));
else clearCart();
clearCheckout();

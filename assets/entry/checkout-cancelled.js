// Back from Stripe without paying. If that checkout can still be live, its
// units are held for it, so the way back to it comes first.
import { mountChrome } from "../chrome.js";
import { liveCheckout } from "../checkout-return.js";
import { esc } from "../esc.js";

mountChrome("cart");

const next = document.getElementById("cancel-next");
if (next) {
  const live = liveCheckout();
  next.innerHTML = live
    ? `<p>The units you were buying stay held for that checkout for about 30 minutes after you started it.</p>
       <a class="btn-buy" href="${esc(live.url)}">Return to your checkout</a>
       <div class="btn-row"><a class="btn" href="/cart">Back to the cart</a></div>`
    : `<p>Your cart is as you left it.</p>
       <div class="btn-row"><a class="btn" href="/cart">Back to the cart</a></div>`;
}

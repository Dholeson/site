// Back from Stripe without paying. If that checkout can still be live and
// holds units, they are held for it, so the way back to it comes first.
// The paragraph follows "Nothing was charged." at paragraph spacing and the
// buttons sit further down in .order-actions, as on /order-complete.
import { mountChrome } from "../chrome.js";
import { liveCheckout } from "../checkout-return.js";
import { esc } from "../esc.js";

mountChrome("cart");

const next = document.getElementById("cancel-next");
if (next) {
  const live = liveCheckout();
  next.innerHTML = live && live.ids.length
    ? `<p>The units you were buying stay held for that checkout for about 30 minutes after you started it.</p>
       <div class="order-actions">
         <a class="btn-buy" href="${esc(live.url)}">Return to your checkout</a>
         <div class="btn-row"><a class="btn" href="/cart">Back to the cart</a></div>
       </div>`
    : `<p>Your cart is as you left it.</p>
       <div class="btn-row order-actions"><a class="btn" href="/cart">Back to the cart</a></div>`;
}

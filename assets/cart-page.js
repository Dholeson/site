// The cart page, /cart (cart.html, spec §10.4).
//
// The cart holds only ids and quantities (assets/cart.js); prices come from
// the catalogue for display and from the server at checkout. The browser
// never sends a price.
//
// Render rule: a cart with any refurbished unit in it shows only "Checking
// your cart…" until the live listings settle, then everything at once, so
// no line, total or "$0.00" appears and then changes. A cart of catalogue
// items only renders straight away. Later repaints follow the visitor's own
// input (Remove, Qty).
//
// A unit the listings don't have is one of three things:
//   held for this visitor's own checkout (assets/checkout-return.js)
//   gone: sold, or held by a checkout that hasn't finished
//   unreachable: the listings didn't load
// An own hold turns the primary action into "Return to your checkout".

import { AUTOMATIC_TAX, RETURNS, formatMoney } from "../data/products.js";
import { CHECKOUT_ENDPOINT, SUPPORT_EMAIL } from "./store-config.js";
import { getCart, priceCart, removeFromCart, setQty } from "./cart.js";
import { isBenchId, loadBench, reloadBench } from "./catalogue.js";
import { displayId, isBench } from "./unit-copy.js";
import { liveCheckout, saveCheckout } from "./checkout-return.js";
import { esc } from "./esc.js";

const MAIL = esc(SUPPORT_EMAIL);
const productHref = id => `/product?id=${encodeURIComponent(id)}`;
const imageSrc = src => (/^(https:\/\/|\/(?!\/))/.test(src) ? src : `/${String(src).replace(/^\/+/, "")}`);
const idSpan = id => `<span class="id">${esc(displayId(id))}</span>`;

const EMPTY = `<div class="empty">
    <h2>Your cart is empty</h2>
    <div class="btn-row"><a class="btn" href="/store">Go to the store</a></div>
  </div>`;

function lineHtml(i) {
  const bench = isBench(i);
  const qtyId = `q-${i.id.replace(/[^a-z0-9-]/gi, "")}`;
  const qty = bench
    ? `<p class="quiet">One unit</p>`
    : `<p class="cart-qty"><label for="${esc(qtyId)}">Qty</label> <input type="number" id="${esc(qtyId)}" data-qty="${esc(i.id)}" inputmode="numeric" value="${i.qty}" min="1" max="${i.stock}"></p>`;
  const name = bench ? `${esc(i.name)} (${esc(displayId(i.id))})` : esc(i.name);
  return `<li class="cart-line">
      <img src="${esc(imageSrc(i.image))}" alt="" width="96" height="72">
      <div class="cart-line-body">
        <p class="cart-line-name"><a href="${esc(productHref(i.id))}">${esc(i.name)}</a>${bench ? ` ${idSpan(i.id)}` : ""}</p>
        ${qty}
        <button class="btn-text" type="button" data-remove="${esc(i.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
      <p class="cart-line-price num">${esc(formatMoney(i.lineTotalCents))}</p>
    </li>`;
}

function unavailableHtml(u, own) {
  const text = own
    ? `${idSpan(u.id)} is held for the checkout you started.`
    : u.unavailable === "unreachable"
      ? `Couldn't check ${idSpan(u.id)} just now. Refresh to try again.`
      : `${idSpan(u.id)} is no longer available. It sold, or it's on hold in a checkout that hasn't finished.`;
  return `<li class="cart-line cart-line--gone">
      <span class="cart-line-ph" aria-hidden="true"></span>
      <div class="cart-line-body">
        <p>${text}</p>
        <button class="btn-text" type="button" data-remove="${esc(u.id)}" aria-label="Remove ${esc(displayId(u.id))}">Remove</button>
      </div>
    </li>`;
}

// "Online checkout isn't switched on yet": the store-config switch is off,
// or the checkout Function says Stripe isn't configured.
function offNotice() {
  const first = getCart().find(l => isBenchId(l.id));
  const subject = first ? `Buying ${displayId(first.id)}` : "Buying from dhole.dev";
  const href = esc(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  return `<div class="notice" role="status"><strong>Online checkout isn't switched on yet, so nothing can be charged.</strong> ${first
    ? `To buy a unit now, email <a href="${href}">${MAIL}</a> with its id.`
    : `To buy now, email <a href="${href}">${MAIL}</a> with what's in your cart.`}</div>`;
}

const faultNotice = sentence => `<div class="notice notice--fault" role="alert"><strong>Couldn't start checkout.</strong> ${esc(sentence)} If this keeps happening, email <a href="mailto:${MAIL}">${MAIL}</a>.</div>`;

export function renderCart() {
  const main = document.getElementById("cart-main");
  if (!main) return;
  // A notice to show after the next paint (a 409 repaints the cart first).
  let carry = "";

  function paint() {
    const r = priceCart();
    const { items, unavailable } = r;
    if (!items.length && !unavailable.length) {
      main.innerHTML = EMPTY;
      return;
    }

    const live = liveCheckout();
    const ownIds = live ? live.ids : [];
    const isOwn = u => u.unavailable === "gone" && ownIds.includes(u.id);
    const own = live && unavailable.some(isOwn);
    const blocked = unavailable.filter(u => !isOwn(u));

    // In the order the visitor added them.
    const byId = new Map([...items, ...unavailable].map(x => [x.id, x]));
    const lines = getCart().map(l => byId.get(l.id)).filter(Boolean)
      .map(x => (x.unavailable ? unavailableHtml(x, isOwn(x)) : lineHtml(x))).join("");

    const hasConsole = items.some(i => i.category === "console");
    const rides = items.some(i => i.shippingClass === "console") && items.some(i => i.shippingClass === "small");
    // Totals only for lines that can be bought now, so nothing ever reads $0.00.
    const totals = items.length && !own
      ? `<table class="totals">
          <caption class="visually-hidden">Order total</caption>
          <tbody>
            <tr><th scope="row">Subtotal</th><td class="num">${esc(formatMoney(r.subtotalCents))}</td></tr>
            <tr><th scope="row">${esc(r.shippingShort || r.shippingLabel)}</th><td class="num">${esc(formatMoney(r.shippingCents))}</td></tr>
            <tr class="total"><th scope="row">${AUTOMATIC_TAX ? "Total before tax" : "Total"}</th><td class="num">${esc(formatMoney(r.totalCents))}</td></tr>
          </tbody>
        </table>
        ${rides ? `<p>Accessories ride in the console box, so shipping stays ${esc(formatMoney(r.shippingCents))}.</p>` : ""}`
      : "";

    const action = own
      ? `<a class="btn-buy" href="${esc(live.url)}">Return to your checkout</a>
         <p>To change the order, wait about 30 minutes for that checkout to expire, then check out again.</p>`
      : `<button class="btn-buy" type="button" data-checkout${blocked.length || !items.length ? " disabled" : ""}>Check out</button>
         ${blocked.length ? `<p>${blocked.length > 1 ? "Remove the unavailable units to check out." : "Remove the unavailable unit to check out."}</p>` : ""}`;

    main.innerHTML = `<div class="cart-layout">
        <div class="cart-lines-col">
          <ul class="cart-lines">${lines}</ul>
        </div>
        <div class="cart-summary">
          ${totals}
          <div class="cart-notice" data-notice>${carry}</div>
          <div class="cart-action">${action}</div>
          <div class="cart-facts">
            <p>Card payment on Stripe's checkout page. Your card details never reach this site.</p>
            <p>Ships within two business days, from the US, with tracking by email.</p>
            <p>${hasConsole && RETURNS.console ? `${esc(RETURNS.console)} ` : ""}<a href="/shipping-returns">Shipping and returns</a></p>
          </div>
        </div>
      </div>`;
    carry = "";
  }

  // Remove and Qty repaint; focus goes to the next Remove (or the empty
  // state's link) so a keyboard user doesn't lose their place.
  main.addEventListener("click", e => {
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      const all = [...main.querySelectorAll("[data-remove]")];
      const at = all.indexOf(remove);
      removeFromCart(remove.dataset.remove);
      paint();
      const left = [...main.querySelectorAll("[data-remove]")];
      const next = left[Math.min(at, left.length - 1)] || main.querySelector(".empty a");
      if (next) next.focus();
      return;
    }
    const go = e.target.closest("[data-checkout]");
    if (go && !go.disabled) checkout(go);
  });
  main.addEventListener("change", e => {
    const input = e.target.closest("[data-qty]");
    if (!input) return;
    setQty(input.dataset.qty, parseInt(input.value, 10) || 1);
    paint();
    const again = main.querySelector(`[data-qty="${CSS.escape(input.dataset.qty)}"]`);
    if (again) again.focus();
  });

  async function checkout(btn) {
    const notice = main.querySelector("[data-notice]");
    const lines = getCart();
    if (!CHECKOUT_ENDPOINT) {
      notice.innerHTML = offNotice();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Opening Stripe checkout…";
    notice.innerHTML = "";
    const restore = html => {
      btn.disabled = false;
      btn.textContent = "Check out";
      notice.innerHTML = html;
    };

    let res;
    let data;
    try {
      // Only ids and quantities cross the wire. The server prices the order.
      res = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: lines.map(l => ({ id: l.id, qty: l.qty })) })
      });
      data = await res.json().catch(() => ({}));
    } catch {
      return restore(faultNotice("The checkout couldn't be reached just now."));
    }
    data = data && typeof data === "object" ? data : {};

    if (data.code === "not_configured") return restore(offNotice());

    // A static host with no Pages Function answers 404 (no such file) or 405.
    if (res.status === 404 || res.status === 405) {
      return restore(faultNotice("The checkout isn't running on this copy of the site."));
    }

    // A unit was taken (sold, or held by a checkout) since this page loaded.
    // Fetch the listings fresh so the cart shows which, then repaint.
    if (res.status === 409) {
      const live = liveCheckout();
      const taken = Array.isArray(data.unavailable) ? data.unavailable : [];
      const mine = live && taken.length > 0 && taken.every(id => live.ids.includes(id));
      const sentence = typeof data.error === "string" && data.error ? data.error : "A unit in your cart was just taken.";
      carry = `<div class="notice notice--fault" role="alert"><strong>Couldn't start checkout.</strong> ${esc(sentence)}${mine
        ? ` <a href="${esc(live.url)}">Return to your checkout</a>` : ""}</div>`;
      await reloadBench({ fresh: true });
      paint();
      return;
    }

    if (!res.ok || typeof data.url !== "string") {
      return restore(faultNotice(typeof data.error === "string" && data.error ? data.error : `The checkout answered with an error (${res.status}).`));
    }

    // The way back, in case the buyer leaves Stripe without paying: their
    // units stay held for that checkout for about half an hour.
    const held = lines.filter(l => isBenchId(l.id)).map(l => l.id);
    if (held.length) saveCheckout({ url: data.url, ids: held });
    location.assign(data.url);
  }

  const hasUnits = () => getCart().some(l => isBenchId(l.id));
  if (hasUnits()) {
    main.innerHTML = `<p class="quiet">Checking your cart…</p>`;
    loadBench().then(paint);
  } else {
    paint();
  }

  // Back from Stripe with the browser's Back button, the page can come back
  // from the back/forward cache exactly as it was left: mid-redirect, with a
  // disabled "Opening Stripe checkout…". Ask the listings again, so units
  // held for that checkout show as the buyer's own, with the way back to it.
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    if (hasUnits()) reloadBench({ fresh: true }).then(paint);
    else paint();
  });
}

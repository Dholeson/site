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
// input (Remove, Qty, Check out).
//
// A unit the listings don't have is one of three things:
//   held for this visitor's own checkout (assets/checkout-return.js)
//   gone: sold, or held by a checkout that hasn't finished
//   unreachable: the listings didn't load
// An own hold turns the primary action into "Return to your checkout", and
// any other line says it isn't in that checkout; "Or remove" under it names
// every line that can't be bought (cartAction). A buyer back from Stripe
// gets the listings past the browser's 30-second cache, so their own held
// units never show as on sale.
//
// Checkout off: once the checkout Function answers code "not_configured"
// (or the store-config switch is off), the page stays that way: the notice,
// an "Email to buy" link carrying the units' ids where Check out was, and no
// line about paying on Stripe's page.
//
// Focus: Check out keeps focus while the request runs (aria-disabled, since
// disabling the focused button would drop focus to the body), and the notice
// the answer brings is focused, so a screen reader reads it and the keyboard
// carries on from there.

import { AUTOMATIC_TAX, RETURNS, formatMoney } from "../data/products.js";
import { CHECKOUT_ENDPOINT, SUPPORT_EMAIL } from "./store-config.js";
import { getCart, priceCart, removeFromCart, setQty } from "./cart.js";
import { isBenchId, loadBench, reloadBench } from "./catalogue.js";
import { displayId, isBench } from "./unit-copy.js";
import { liveCheckout, saveCheckout } from "./checkout-return.js";
import { esc } from "./esc.js";

const MAIL = esc(SUPPORT_EMAIL);
const mailto = subject => esc(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
const productHref = id => `/product?id=${encodeURIComponent(id)}`;
const imageSrc = src => (/^(https:\/\/|\/(?!\/))/.test(src) ? src : `/${String(src).replace(/^\/+/, "")}`);
const idSpan = id => `<span class="id">${esc(displayId(id))}</span>`;
// "RO-0042", "RO-0042 and RO-0043", "RO-0042, RO-0043 and RO-0044".
const idList = ids => {
  const spans = ids.map(idSpan);
  return spans.length < 2 ? spans.join("") : `${spans.slice(0, -1).join(", ")} and ${spans[spans.length - 1]}`;
};

const EMPTY = `<div class="empty">
    <h2>Your cart is empty</h2>
    <div class="btn-row"><a class="btn" href="/store">Go to the store</a></div>
  </div>`;

function lineHtml(i, note = "") {
  const bench = isBench(i);
  const qtyId = `q-${i.id.replace(/[^a-z0-9-]/gi, "")}`;
  const qty = bench
    ? `<p class="quiet">One unit</p>`
    : `<p class="cart-qty"><label for="${esc(qtyId)}">Qty</label> <input type="number" id="${esc(qtyId)}" data-qty="${esc(i.id)}" inputmode="numeric" value="${i.qty}" min="1" max="${i.stock}"></p>`;
  const name = bench ? `${esc(i.name)} (${esc(displayId(i.id))})` : esc(i.name);
  return `<li class="cart-line">
      <img src="${esc(imageSrc(i.image))}" alt="" width="96" height="72">
      <div class="cart-line-body">
        <div class="cart-line-head">
          <p class="cart-line-name"><a href="${esc(productHref(i.id))}">${esc(i.name)}</a>${bench ? ` ${idSpan(i.id)}` : ""}</p>
          <p class="cart-line-price num">${esc(formatMoney(i.lineTotalCents))}</p>
        </div>
        ${qty}
        ${note}
        <button class="btn-text" type="button" data-remove="${esc(i.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
    </li>`;
}

// No photo for a unit that can't be bought, and nothing in its place.
function unavailableHtml(u, own) {
  const text = own
    ? `${idSpan(u.id)} is held for the checkout you started.`
    : u.unavailable === "unreachable"
      ? `Couldn't check ${idSpan(u.id)} just now. Refresh to try again.`
      : `${idSpan(u.id)} is no longer available. It sold, or it's on hold in a checkout that hasn't finished.`;
  return `<li class="cart-line cart-line--gone">
      <div class="cart-line-body">
        <p>${text}</p>
        <button class="btn-text" type="button" data-remove="${esc(u.id)}" aria-label="Remove ${esc(displayId(u.id))}">Remove</button>
      </div>
    </li>`;
}

// Buying by email while checkout is off: the units' ids go in the subject.
function emailOrder(items) {
  const units = items.filter(isBench).map(i => displayId(i.id));
  return {
    units,
    onlyUnits: units.length > 0 && units.length === items.length,
    count: items.length,
    href: mailto(units.length ? `Buying ${units.join(", ")}` : "Buying from dhole.dev")
  };
}

// "Online checkout isn't switched on yet": the store-config switch is off,
// or the checkout Function says Stripe isn't configured.
function offNotice(order) {
  const link = `<a href="${order.href}">${MAIL}</a>`;
  const ask = order.onlyUnits && order.units.length === 1 ? `To buy a unit now, email ${link} with its id.`
    : order.onlyUnits ? `To buy these units now, email ${link} with their ids.`
      : `To buy now, email ${link} with what's in your cart.`;
  return `<div class="notice" role="status" tabindex="-1"><strong>Online checkout isn't switched on yet, so nothing can be charged.</strong> ${ask}</div>`;
}

// What stands where Check out was while checkout is off, as the product
// page's "Email to buy this unit" does.
function offAction(order) {
  const label = order.onlyUnits
    ? (order.count === 1 ? "Email to buy this unit" : "Email to buy these units")
    : (order.count === 1 ? "Email to buy this" : "Email to buy these");
  return `<a class="btn btn-wide" href="${order.href}">${label}</a>`;
}

// Lines held for the visitor's own checkout (assets/checkout-return.js), and
// those that can't be bought for any other reason.
function holds(unavailable, live) {
  const isOwn = u => Boolean(live) && u.unavailable === "gone" && live.ids.includes(u.id);
  return { isOwn, own: unavailable.some(isOwn), blocked: unavailable.filter(u => !isOwn(u)) };
}

// What goes under the totals. With units held for the visitor's own
// checkout it's the way back to that checkout, and "Or remove" names every
// line that can't be bought, held or gone: removing the held units alone
// would still leave a gone one, so the rest couldn't be checked out.
export function cartAction({ items, unavailable, live, off = false }) {
  const { own, blocked } = holds(unavailable, live);
  if (own) {
    return `<a class="btn-buy" href="${esc(live.url)}">Return to your checkout</a>
         <p>To change the order, wait about 30 minutes for that checkout to expire, then check out again.</p>
         ${items.length ? `<p>Or remove ${idList(unavailable.map(u => u.id))} to check out the rest.</p>` : ""}`;
  }
  if (off && items.length) return offAction(emailOrder(items));
  return `<button class="btn-buy" type="button" data-checkout${blocked.length || !items.length ? " disabled" : ""}>Check out</button>
         ${blocked.length ? `<p>${blocked.length > 1 ? "Remove the unavailable units to check out." : "Remove the unavailable unit to check out."}</p>` : ""}`;
}

const faultNotice = sentence => `<div class="notice notice--fault" role="alert" tabindex="-1"><strong>Couldn't start checkout.</strong> ${esc(sentence)} If this keeps happening, email <a href="mailto:${MAIL}">${MAIL}</a>.</div>`;

export function renderCart() {
  const main = document.getElementById("cart-main");
  if (!main) return;
  // A notice to show after the next paint (a 409 repaints the cart first).
  let carry = "";
  // Stripe isn't set up: known once the checkout has said so.
  let off = false;
  // A checkout request is on its way.
  let busy = false;

  function paint() {
    const r = priceCart();
    const { items, unavailable } = r;
    if (!items.length && !unavailable.length) {
      main.innerHTML = EMPTY;
      return;
    }

    const live = liveCheckout();
    const { isOwn, own } = holds(unavailable, live);
    // With an own hold, a line added since that checkout started isn't in it.
    const note = id => (own && !live.lines.includes(id) ? `<p>Not in the checkout you started.</p>` : "");

    // In the order the visitor added them.
    const byId = new Map([...items, ...unavailable].map(x => [x.id, x]));
    const lines = getCart().map(l => byId.get(l.id)).filter(Boolean)
      .map(x => (x.unavailable ? unavailableHtml(x, isOwn(x)) : lineHtml(x, note(x.id)))).join("");

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

    const order = emailOrder(items);
    const action = cartAction({ items, unavailable, live, off });

    main.innerHTML = `<div class="cart-layout">
        <div class="cart-lines-col">
          <ul class="cart-lines">${lines}</ul>
        </div>
        <div class="cart-summary">
          ${totals}
          <div class="cart-notice" data-notice>${off ? offNotice(order) : carry}</div>
          <div class="cart-action">${action}</div>
          <div class="cart-facts">
            ${off ? "" : `<p>Card payment on Stripe's checkout page. Your card details never reach this site.</p>`}
            <p>Ships within two business days, from the US, with tracking by email.</p>
            <p>${hasConsole && RETURNS.console ? `${esc(RETURNS.console)} ` : ""}<a href="/shipping-returns">Shipping and returns</a></p>
          </div>
        </div>
      </div>`;
    carry = "";
  }

  const focusNotice = () => {
    const n = main.querySelector("[data-notice] .notice");
    if (n) n.focus();
  };

  // Checkout is off: repaint in that state and say so.
  function switchOff() {
    off = true;
    paint();
    focusNotice();
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
    if (go && !go.disabled && go.getAttribute("aria-disabled") !== "true") checkout(go);
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
    if (busy) return;
    if (!CHECKOUT_ENDPOINT) return switchOff();
    const lines = getCart();

    busy = true;
    btn.setAttribute("aria-disabled", "true");
    btn.textContent = "Opening Stripe checkout…";
    const notice = main.querySelector("[data-notice]");
    if (notice) notice.innerHTML = "";
    // A Remove while the request ran repaints the summary: find it again.
    const restore = html => {
      busy = false;
      const now = main.querySelector("[data-checkout]");
      if (now) {
        now.removeAttribute("aria-disabled");
        now.textContent = "Check out";
      }
      const box = main.querySelector("[data-notice]");
      if (box) box.innerHTML = html;
      focusNotice();
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

    if (data.code === "not_configured") {
      busy = false;
      return switchOff();
    }

    // A static host with no Pages Function answers 404 (no such file) or 405.
    if (res.status === 404 || res.status === 405) {
      return restore(faultNotice("The checkout isn't running on this copy of the site."));
    }

    // A unit was taken (sold, or held by a checkout) since this page loaded.
    // Fetch the listings fresh so the cart shows which, then repaint. The
    // server names the units only when a hold raced; its usual 409 (a unit
    // already held or sold when the order was priced) names none, so the
    // fresh listings say which units are gone. When every one of them is
    // held for the buyer's own checkout, the notice offers the way back.
    if (res.status === 409) {
      const sentence = typeof data.error === "string" && data.error ? data.error : "A unit in your cart was just taken.";
      await reloadBench({ fresh: true });
      const gone = priceCart().unavailable.filter(u => u.unavailable === "gone").map(u => u.id);
      const taken = Array.isArray(data.unavailable) ? data.unavailable : gone;
      const live = liveCheckout();
      const mine = live && taken.length > 0 && taken.every(id => live.ids.includes(id));
      carry = `<div class="notice notice--fault" role="alert" tabindex="-1"><strong>Couldn't start checkout.</strong> ${esc(sentence)}${mine
        ? ` <a href="${esc(live.url)}">Return to your checkout</a>` : ""}</div>`;
      busy = false;
      paint();
      focusNotice();
      return;
    }

    if (!res.ok || typeof data.url !== "string") {
      return restore(faultNotice(typeof data.error === "string" && data.error ? data.error : `The checkout answered with an error (${res.status}).`));
    }

    // The way back, in case the buyer leaves Stripe without paying: their
    // units stay held for that checkout for about 30 minutes. Every line
    // is saved too, so /order-complete clears just what this order bought.
    const held = lines.filter(l => isBenchId(l.id)).map(l => l.id);
    saveCheckout({ url: data.url, ids: held, lines: lines.map(l => l.id) });
    location.assign(data.url);
  }

  const hasUnits = () => getCart().some(l => isBenchId(l.id));
  if (hasUnits()) {
    main.innerHTML = `<p class="quiet">Checking your cart…</p>`;
    // Back from Stripe, the listings in the browser's cache (30 s) can still
    // show the units that checkout holds as on sale: ask past the cache.
    (liveCheckout() ? reloadBench({ fresh: true }) : loadBench()).then(paint);
  } else {
    paint();
  }

  // Back from Stripe with the browser's Back button, the page can come back
  // from the back/forward cache exactly as it was left: mid-redirect, with a
  // busy "Opening Stripe checkout…". Ask the listings again, so units held
  // for that checkout show as the buyer's own, with the way back to it.
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    busy = false;
    if (hasUnits()) reloadBench({ fresh: true }).then(paint);
    else paint();
  });
}

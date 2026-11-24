// Storefront rendering: catalogue grid, product detail, and cart.
//
// The catalogue is data/products.js plus the bench's live units
// (assets/catalogue.js). Bench copy comes from the bench app rather than this
// repo, so every value goes through esc() before it reaches innerHTML.

import { formatMoney, CONDITION_LABELS, SHIPPING } from "../data/products.js";
import { CHECKOUT_ENDPOINT, SUPPORT_EMAIL } from "./store-config.js";
import { getCart, addToCart, setQty, removeFromCart, priceCart, inCart } from "./cart.js";
import { allProducts, findAny, isBenchId, loadBench, reloadBench } from "./catalogue.js";
import { esc } from "./esc.js";

const productHref = id => `/product?id=${encodeURIComponent(id)}`;

function stockClass(p) {
  if (p.stock < 1) return "out";
  if (p.source === "bench") return "in";
  if (p.stock <= 3) return "low";
  return "in";
}

function stockLabel(p) {
  if (p.stock < 1) return "Sold out";
  if (p.source === "bench") return "One of one: the unit in the photos";
  if (p.stock <= 3) return `Only ${p.stock} left`;
  return "In stock";
}

function chips(p) {
  return `<div class="chips">
    <span class="chip">${esc(p.platform)}</span>
    <span class="chip">${esc(CONDITION_LABELS[p.condition] || p.condition)}</span>
  </div>`;
}

function addedLabel(res, bench) {
  if (!res.clamped) return "Added ✓";
  return bench ? "Already in your cart" : `Only ${res.stock} available`;
}

// One catalogue card: the store grid and the product page's "goes with it"
// row both use it. Its button carries data-add for wireAdd().
function productCard(p) {
  return `
      <article class="card product-card">
        <a href="${productHref(p.id)}">
          <img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
        </a>
        <div class="card-body">
          <h3><a href="${productHref(p.id)}">${esc(p.name)}</a></h3>
          ${chips(p)}
          <div class="price">${formatMoney(p.priceCents)}</div>
          <div class="status ${stockClass(p)}">${esc(stockLabel(p))}</div>
          <button class="btn btn-primary btn-block" data-add="${esc(p.id)}"
                  style="margin-top:auto" ${p.stock < 1 ? "disabled" : ""}>
            ${p.stock < 1 ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </article>`;
}

function wireAdd(container) {
  container.addEventListener("click", e => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    const id = btn.dataset.add;
    const res = addToCart(id, 1);
    if (res.ok) {
      btn.textContent = addedLabel(res, isBenchId(id));
      setTimeout(() => { btn.textContent = "Add to cart"; }, 1200);
    }
  });
}

// ---------- catalogue ----------

export function renderStore() {
  const grid = document.getElementById("product-grid");
  const countEl = document.getElementById("result-count");
  const platformSel = document.getElementById("filter-platform");
  const categorySel = document.getElementById("filter-category");
  const sortSel = document.getElementById("filter-sort");
  const searchInput = document.getElementById("filter-search");
  const notice = document.getElementById("store-notice");

  // Built from the catalogue, so adding a product on a new platform does not
  // also mean remembering to edit a dropdown. Rebuilt once the live units
  // arrive, keeping whatever the visitor picked.
  function fillPlatforms() {
    const picked = platformSel.value;
    const platforms = [...new Set(allProducts().map(p => p.platform))].sort();
    platformSel.innerHTML = `<option value="all">All platforms</option>` +
      platforms.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
    platformSel.value = platforms.includes(picked) ? picked : "all";
  }

  function apply() {
    const q = searchInput.value.trim().toLowerCase();
    let list = allProducts().filter(p =>
      (platformSel.value === "all" || p.platform === platformSel.value) &&
      (categorySel.value === "all" || p.category === categorySel.value) &&
      (!q || `${p.name} ${p.platform} ${p.blurb}`.toLowerCase().includes(q))
    );

    if (sortSel.value === "price-asc")  list = [...list].sort((a, b) => a.priceCents - b.priceCents);
    if (sortSel.value === "price-desc") list = [...list].sort((a, b) => b.priceCents - a.priceCents);
    if (sortSel.value === "name")       list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    countEl.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state"><p>Nothing matches that filter.</p></div>`;
      return;
    }

    grid.innerHTML = list.map(productCard).join("");
  }

  wireAdd(grid);

  [platformSel, categorySel, sortSel].forEach(el => el.addEventListener("change", apply));
  searchInput.addEventListener("input", apply);
  fillPlatforms();
  apply();

  // The hand-made catalogue shows at once; the live units join it when they
  // arrive. If they can't be fetched, the page stays as it is.
  loadBench().then(state => {
    if (state === "ok") {
      fillPlatforms();
      apply();
    } else if (notice) {
      notice.innerHTML = `<div class="notice info">
        Some refurbished units couldn't be loaded just now. Refresh to try again.
      </div>`;
    }
  });
}

// ---------- product detail ----------

function notFound(main, title, text) {
  main.innerHTML = `
    <div class="empty-state">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <p><a class="btn" href="/store">Back to the store</a></p>
    </div>`;
}

function gallery(p) {
  const images = p.images && p.images.length ? p.images : [p.image];
  const main = `<img class="hero-img" id="gallery-main" src="${esc(images[0])}"
    alt="${esc(p.name)}${images.length > 1 ? `, photo 1 of ${images.length}` : ""}" />`;
  if (images.length < 2) return `<div class="gallery">${main}</div>`;
  return `<div class="gallery">
    ${main}
    <div class="gallery-thumbs" role="group" aria-label="Photos">
      ${images.map((src, i) => `
        <button type="button" class="gallery-thumb" data-photo="${i}"
                aria-label="Show photo ${i + 1} of ${images.length}" aria-pressed="${i === 0}">
          <img src="${esc(src)}" alt="" loading="lazy" />
        </button>`).join("")}
    </div>
  </div>`;
}

function mountGallery(main, p) {
  const images = p.images || [];
  const hero = main.querySelector("#gallery-main");
  main.querySelectorAll("[data-photo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.photo);
      if (!images[i]) return;
      hero.src = images[i];
      hero.alt = `${p.name}, photo ${i + 1} of ${images.length}`;
      main.querySelectorAll("[data-photo]").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
    });
  });
}

// What this item costs to ship, and what it does to an order's shipping.
// The order's largest box sets the rate (lib/checkout-core.js shippingFor),
// so an accessory in an order with a console adds nothing.
function shippingLine(p) {
  if (p.shippingClass === "console") {
    return `Shipping: ${formatMoney(SHIPPING.console.cents)} flat. Accessories in the same order ride in this box for nothing extra.`;
  }
  return `Shipping: ${formatMoney(SHIPPING.small.cents)} flat, or nothing extra in an order with a console.`;
}

// Up to three in-stock items for the same platform (or that fit every
// platform). A console's page shows only accessories, which is what its
// "ships in the console's box" note promises; an accessory's page shows
// consoles first.
function goesWith(p) {
  const fits = q => q.id !== p.id && q.stock > 0 &&
    (p.category !== "console" || q.category === "accessory") &&
    (q.platform === p.platform || q.platform === "Multi-platform" || p.platform === "Multi-platform");
  const rank = q => (q.category === "console") === (p.category === "console") ? 1 : 0;
  return allProducts().filter(fits).sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}

function paintRelated(el, p) {
  const list = goesWith(p);
  if (!list.length) { el.innerHTML = ""; return; }
  const isConsole = p.category === "console";
  el.innerHTML = `
    <div class="section-head"><h2>${isConsole ? "Goes with it" : `More for ${esc(p.platform)}`}</h2></div>
    ${isConsole ? `<p class="muted related-note">These ship in the console's box: adding them doesn't change the
      ${formatMoney(SHIPPING.console.cents)} shipping.</p>` : ""}
    <div class="grid">${list.map(productCard).join("")}</div>`;
}

function paintProduct(main, p) {
  // Same shape as the title functions/product.js writes on the server.
  document.title = `${p.name} — ${formatMoney(p.priceCents)} | dhole.dev`;
  const bench = p.source === "bench";
  // Bench units always have photos; a hand-made item gets the gallery once it
  // lists real ones in `images` (data/products.js).
  const hasPhotos = bench || (Array.isArray(p.images) && p.images.length > 0);
  const soldOut = p.stock < 1;
  const already = bench && inCart(p.id);

  main.innerHTML = `
    <div class="product-detail">
      ${hasPhotos ? gallery(p) : `<img class="hero-img" src="${esc(p.image)}" alt="${esc(p.name)}" />`}
      <div>
        <h1>${esc(p.name)}</h1>
        ${chips(p)}
        <p class="price" style="margin:1rem 0 .35rem">${formatMoney(p.priceCents)}</p>
        <p class="status ${stockClass(p)}">${esc(stockLabel(p))}</p>
        <p class="muted product-blurb">${esc(p.blurb)}</p>
        <ul class="spec-list">${p.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        ${bench ? "" : `
        <div class="qty-row">
          <label for="qty">Qty</label>
          <input type="number" id="qty" value="1" min="1" max="${p.stock}" ${soldOut ? "disabled" : ""} />
        </div>`}
        <button class="btn btn-primary${bench ? " bench-add" : ""}" id="add-btn" ${soldOut || already ? "disabled" : ""}>
          ${soldOut ? "Sold out" : already ? "In your cart" : "Add to cart"}
        </button>
        <p class="dim ship-line" style="margin-top:1rem">${esc(shippingLine(p))}</p>
        <p class="dim">Ships from the US within two business days, with tracking by email.
          <a href="/shipping-returns">Shipping &amp; returns</a></p>
      </div>
    </div>
    <section class="section related" id="related" aria-live="polite"></section>`;

  if (hasPhotos) mountGallery(main, p);

  // The hand-made catalogue is here already; live units join when they load.
  const related = main.querySelector("#related");
  wireAdd(related);
  paintRelated(related, p);
  loadBench().then(() => paintRelated(related, p));

  const addBtn = document.getElementById("add-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const qtyInput = document.getElementById("qty");
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      const res = addToCart(p.id, qty);
      if (!res.ok) return;
      if (bench) {
        addBtn.textContent = "In your cart";
        addBtn.disabled = true;
        return;
      }
      addBtn.textContent = addedLabel(res, false);
      setTimeout(() => { addBtn.textContent = "Add to cart"; }, 1400);
    });
  }
}

export function renderProduct() {
  const main = document.getElementById("product-main");
  const id = new URLSearchParams(location.search).get("id");

  if (id && isBenchId(id)) {
    // Holds the page's height while the unit loads, so the footer isn't on
    // screen to jump down when it arrives (a layout shift otherwise).
    main.innerHTML = `<p class="muted product-loading">Loading this unit…</p>`;
    loadBench().then(state => {
      const p = findAny(id);
      if (p) return paintProduct(main, p);
      if (state === "failed") {
        return notFound(main, "Couldn't load this unit", "The store's live stock didn't answer. Refresh to try again.");
      }
      notFound(main, "This unit is no longer available",
        "It has sold, or it's on hold while someone checks out. Holds last about half an hour.");
    });
    return;
  }

  const p = id ? findAny(id) : null;
  if (!p) return notFound(main, "Product not found", "That listing may have sold and been removed.");
  paintProduct(main, p);
}

// ---------- cart ----------

const UNAVAILABLE_TEXT = {
  checking: "Checking this unit…",
  unreachable: "Couldn't check this unit just now. Refresh to try again.",
  gone: "No longer available: it has sold, or it's on hold in someone else's checkout."
};

export function renderCart() {
  const main = document.getElementById("cart-main");
  // A message to show after the next repaint (a checkout refused because a
  // unit was just taken repaints the cart first).
  let carry = "";

  function paint() {
    const { items, unavailable, subtotalCents, shippingCents, shippingLabel, totalCents } = priceCart();

    if (!items.length && !unavailable.length) {
      main.innerHTML = `
        <div class="empty-state">
          <h2>Your cart is empty</h2>
          <p><a class="btn btn-primary" href="/store">Browse the store</a></p>
        </div>`;
      return;
    }

    const blocked = unavailable.length > 0 || !items.length;
    const blockedText = unavailable.some(u => u.unavailable === "checking")
      ? "Checking live stock…"
      : "Remove the unavailable item to check out.";

    main.innerHTML = `
      <div id="checkout-notice">${carry}</div>
      ${items.map(i => `
        <div class="cart-line">
          <img src="${esc(i.image)}" alt="${esc(i.name)}" />
          <div>
            <div class="line-title"><a href="${productHref(i.id)}">${esc(i.name)}</a></div>
            ${chips(i)}
            ${i.source === "bench"
              ? `<p class="dim cart-one-off">Qty 1: one of a kind</p>`
              : `<div class="qty-row" style="margin:.6rem 0 0">
                  <label for="q-${esc(i.id)}">Qty</label>
                  <input type="number" id="q-${esc(i.id)}" data-qty="${esc(i.id)}"
                         value="${i.qty}" min="1" max="${i.stock}" />
                </div>`}
          </div>
          <div class="line-right">
            <div class="price">${formatMoney(i.lineTotalCents)}</div>
            <button class="link-danger" data-remove="${esc(i.id)}">Remove</button>
          </div>
        </div>`).join("")}
      ${unavailable.map(u => `
        <div class="cart-line cart-line-unavailable">
          <div class="cart-line-placeholder" aria-hidden="true"></div>
          <div>
            <div class="line-title"><a href="${productHref(u.id)}">Refurbished unit ${esc(u.id)}</a></div>
            <p class="status ${u.unavailable === "checking" ? "low" : "out"}">${esc(UNAVAILABLE_TEXT[u.unavailable])}</p>
          </div>
          <div class="line-right">
            <button class="link-danger" data-remove="${esc(u.id)}">Remove</button>
          </div>
        </div>`).join("")}

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${formatMoney(subtotalCents)}</span></div>
        <div class="totals-row"><span>${esc(shippingLabel)}</span><span>${formatMoney(shippingCents)}</span></div>
        <div class="totals-row grand"><span>Total</span><span>${formatMoney(totalCents)}</span></div>
        ${unavailable.length ? `<p class="dim">${esc(blockedText)}</p>` : ""}
        <button class="btn btn-primary btn-block" id="checkout-btn" style="margin-top:.75rem"
                ${blocked ? "disabled" : ""}>Checkout</button>
      </div>`;
    carry = "";

    main.querySelectorAll("[data-qty]").forEach(input => {
      input.addEventListener("change", () => {
        setQty(input.dataset.qty, parseInt(input.value, 10) || 1);
        paint();
      });
    });
    main.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => { removeFromCart(btn.dataset.remove); paint(); });
    });
    document.getElementById("checkout-btn").addEventListener("click", checkout);
  }

  async function checkout() {
    const btn = document.getElementById("checkout-btn");
    const notice = document.getElementById("checkout-notice");

    // Be honest rather than throwing a network error at the customer.
    if (!CHECKOUT_ENDPOINT) {
      notice.innerHTML = `<div class="notice warn">
        <strong>Checkout is not connected yet.</strong>
        The catalogue is live, but payments are not switched on. See
        <code>SETUP.md</code> to deploy the site and set
        <code>CHECKOUT_ENDPOINT</code> in <code>assets/store-config.js</code>.
      </div>`;
      notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    btn.disabled = true;
    btn.textContent = "Redirecting to secure checkout…";
    notice.innerHTML = "";

    const failure = message => `<div class="notice error">
        <strong>Could not start checkout.</strong> ${esc(message)}
        ${SUPPORT_EMAIL ? ` If this keeps happening, email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>.` : ""}
      </div>`;

    try {
      // Only ids and quantities cross the wire. The Worker prices the order.
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: getCart().map(l => ({ id: l.id, qty: l.qty })) })
      });

      const data = await res.json().catch(() => ({}));

      // A static host with no Pages Function answers a POST to this path with
      // 404 (no such file) or 405 (files do not accept POST). Either way the
      // cause is the same, so say so instead of showing a bare status code.
      if (res.status === 404 || res.status === 405) {
        throw new Error("The checkout function is not deployed on this host.");
      }

      // A bench unit was taken (sold, or held by another checkout) since this
      // page loaded: refresh the live stock so the cart shows which one.
      if (res.status === 409) {
        carry = failure(data.error || "An item in your cart was just taken.");
        await reloadBench();
        paint();
        return;
      }

      if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`);

      location.href = data.url;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Checkout";
      notice.innerHTML = failure(err.message);
    }
  }

  paint();
  // Bench lines show as "checking" until the live listings arrive.
  if (getCart().some(l => isBenchId(l.id))) loadBench().then(paint);
}

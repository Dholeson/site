// Storefront rendering: catalogue grid, product detail, and cart.

import { products, findProduct, formatMoney, CONDITION_LABELS } from "../data/products.js";
import { CHECKOUT_ENDPOINT, SUPPORT_EMAIL } from "./store-config.js";
import { getCart, addToCart, setQty, removeFromCart, priceCart } from "./cart.js";
import { esc } from "./esc.js";

function stockClass(stock) {
  if (stock < 1) return "out";
  if (stock <= 3) return "low";
  return "in";
}

function stockLabel(stock) {
  if (stock < 1) return "Sold out";
  if (stock <= 3) return `Only ${stock} left`;
  return "In stock";
}

function chips(p) {
  return `<div class="chips">
    <span class="chip">${esc(p.platform)}</span>
    <span class="chip">${esc(CONDITION_LABELS[p.condition] || p.condition)}</span>
  </div>`;
}

// ---------- catalogue ----------

export function renderStore() {
  const grid = document.getElementById("product-grid");
  const countEl = document.getElementById("result-count");
  const platformSel = document.getElementById("filter-platform");
  const categorySel = document.getElementById("filter-category");
  const sortSel = document.getElementById("filter-sort");
  const searchInput = document.getElementById("filter-search");

  // Built from the catalogue, so adding a product on a new platform does not
  // also mean remembering to edit a dropdown.
  const platforms = [...new Set(products.map(p => p.platform))].sort();
  platformSel.insertAdjacentHTML("beforeend",
    platforms.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(""));

  function apply() {
    const q = searchInput.value.trim().toLowerCase();
    let list = products.filter(p =>
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

    grid.innerHTML = list.map(p => `
      <article class="card product-card">
        <a href="/product.html?id=${encodeURIComponent(p.id)}">
          <img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
        </a>
        <div class="card-body">
          <h3><a href="/product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
          ${chips(p)}
          <div class="price">${formatMoney(p.priceCents)}</div>
          <div class="status ${stockClass(p.stock)}">${stockLabel(p.stock)}</div>
          <button class="btn btn-primary btn-block" data-add="${esc(p.id)}"
                  style="margin-top:auto" ${p.stock < 1 ? "disabled" : ""}>
            ${p.stock < 1 ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </article>`).join("");
  }

  grid.addEventListener("click", e => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    const res = addToCart(btn.dataset.add, 1);
    if (res.ok) {
      btn.textContent = res.clamped ? `Only ${res.stock} available` : "Added ✓";
      setTimeout(() => { btn.textContent = "Add to cart"; }, 1200);
    }
  });

  [platformSel, categorySel, sortSel].forEach(el => el.addEventListener("change", apply));
  searchInput.addEventListener("input", apply);
  apply();
}

// ---------- product detail ----------

export function renderProduct() {
  const main = document.getElementById("product-main");
  const id = new URLSearchParams(location.search).get("id");
  const p = id ? findProduct(id) : null;

  if (!p) {
    main.innerHTML = `
      <div class="empty-state">
        <h2>Product not found</h2>
        <p>That listing may have sold and been removed.</p>
        <p><a class="btn" href="/store.html">Back to the store</a></p>
      </div>`;
    return;
  }

  document.title = `${p.name} — dhole.dev`;

  main.innerHTML = `
    <div class="product-detail">
      <img class="hero-img" src="${esc(p.image)}" alt="${esc(p.name)}" />
      <div>
        <h1>${esc(p.name)}</h1>
        ${chips(p)}
        <p class="price" style="margin:1rem 0 .35rem">${formatMoney(p.priceCents)}</p>
        <p class="status ${stockClass(p.stock)}">${stockLabel(p.stock)}</p>
        <p class="muted">${esc(p.blurb)}</p>
        <ul class="spec-list">${p.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        <div class="qty-row">
          <label for="qty">Qty</label>
          <input type="number" id="qty" value="1" min="1" max="${p.stock}" ${p.stock < 1 ? "disabled" : ""} />
        </div>
        <button class="btn btn-primary" id="add-btn" ${p.stock < 1 ? "disabled" : ""}>
          ${p.stock < 1 ? "Sold out" : "Add to cart"}
        </button>
        <p class="dim" style="margin-top:1rem">Ships from the US. Tracking emailed when it goes out.</p>
      </div>
    </div>`;

  const addBtn = document.getElementById("add-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const qty = Math.max(1, parseInt(document.getElementById("qty").value, 10) || 1);
      const res = addToCart(p.id, qty);
      if (res.ok) {
        addBtn.textContent = res.clamped ? `Only ${res.stock} available` : "Added ✓";
        setTimeout(() => { addBtn.textContent = "Add to cart"; }, 1400);
      }
    });
  }
}

// ---------- cart ----------

export function renderCart() {
  const main = document.getElementById("cart-main");

  function paint() {
    const { items, subtotalCents, shippingCents, shippingLabel, totalCents } = priceCart();

    if (!items.length) {
      main.innerHTML = `
        <div class="empty-state">
          <h2>Your cart is empty</h2>
          <p><a class="btn btn-primary" href="/store.html">Browse the store</a></p>
        </div>`;
      return;
    }

    main.innerHTML = `
      <div id="checkout-notice"></div>
      ${items.map(i => `
        <div class="cart-line">
          <img src="${esc(i.image)}" alt="${esc(i.name)}" />
          <div>
            <div class="line-title"><a href="/product.html?id=${encodeURIComponent(i.id)}">${esc(i.name)}</a></div>
            ${chips(i)}
            <div class="qty-row" style="margin:.6rem 0 0">
              <label for="q-${esc(i.id)}">Qty</label>
              <input type="number" id="q-${esc(i.id)}" data-qty="${esc(i.id)}"
                     value="${i.qty}" min="1" max="${i.stock}" />
            </div>
          </div>
          <div class="line-right">
            <div class="price">${formatMoney(i.lineTotalCents)}</div>
            <button class="link-danger" data-remove="${esc(i.id)}">Remove</button>
          </div>
        </div>`).join("")}

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${formatMoney(subtotalCents)}</span></div>
        <div class="totals-row"><span>${esc(shippingLabel)}</span><span>${formatMoney(shippingCents)}</span></div>
        <div class="totals-row grand"><span>Total</span><span>${formatMoney(totalCents)}</span></div>
        <p class="dim">Taxes, if applicable, are added at checkout.</p>
        <button class="btn btn-primary btn-block" id="checkout-btn" style="margin-top:.75rem">Checkout</button>
      </div>`;

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
      if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`);

      location.href = data.url;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Checkout";
      notice.innerHTML = `<div class="notice error">
        <strong>Could not start checkout.</strong> ${esc(err.message)}
        ${SUPPORT_EMAIL ? ` If this keeps happening, email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>.` : ""}
      </div>`;
    }
  }

  paint();
}

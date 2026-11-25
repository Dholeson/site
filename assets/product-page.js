// The product page, /product?id= (product.html, spec §10.3).
//
// One DOM order at every width: the unit's photos, then its file (name, id,
// condition, price, delivered total, flaw summary, the one primary action,
// terms), then the numbered photo index, the record, notes, a repeat of the
// buy action on phones, and "Also listed now". shop.css lays it out; nothing
// is reordered with CSS.
//
// Which body to show comes first from the server: functions/product.js
// writes <meta name="unit-status"> (available, reserved, sold, withdrawn,
// unknown) into the head, and it wins over a cached listing, so a unit on
// hold never offers Add to cart. <meta name="checkout" content="off"> means
// Stripe isn't set up, so the page offers "Email to buy this unit" instead.
//
// Bench copy comes from RefurbOS, so every value goes through esc() before it
// reaches innerHTML. Record lines are escaped before their "(photo N)"
// references become buttons (assets/record.js linkRefs).
//
// Layout shift: #product-main holds a viewport of height (shop.css) while the
// listings load, and the loading panel sits where the photos will. Content
// that arrives later (the "Listed now" cards on a sold unit, "Also listed
// now" on a catalogue item) is appended after everything else.

import { CONDITION_LABELS, formatMoney } from "../data/products.js";
import { SUPPORT_EMAIL } from "./store-config.js";
import { addToCart, inCart } from "./cart.js";
import { BENCH_LISTING_ID, allProducts, findAny, isBenchId, loadBench, reloadBench } from "./catalogue.js";
import { DISPATCH, cardTitle, deliveredLine, displayId, isBench, returnsLine } from "./unit-copy.js";
import { unitCard } from "./unit-card.js";
import { ownerBlock, questionLine } from "./owner-block.js";
import { flawSummary, linkRefs, markReadings, parseRecord, refsIn } from "./record.js";
import { liveCheckout } from "./checkout-return.js";
import { esc } from "./esc.js";

const MAIL = esc(SUPPORT_EMAIL);
const mailto = subject => esc(`mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`);
const idSpan = id => `<span class="id">${esc(displayId(id))}</span>`;
const isText = v => typeof v === "string" && v.trim() !== "";

// Bench photos are /api/store/img/<sha>.jpg; a catalogue image may be
// written relative to the site root.
const imageSrc = src => (/^(https:\/\/|\/(?!\/))/.test(src) ? src : `/${String(src).replace(/^\/+/, "")}`);
const imagesOf = p => (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).filter(isText).map(imageSrc);

const conditionOf = p => (isBench(p) ? p.condition : (CONDITION_LABELS[p.condition] || p.condition));

const metaContent = name => {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute("content") : null;
};

const LISTED_NOW = `<a class="btn" href="/store">See what's listed now</a>`;

// The request lines shown wherever there's nothing to list: a sold unit's
// page with an empty shelf here, and the empty store (assets/store.js).
export function requestHtml() {
  return `<p>Looking for a particular console or colour? Email me and I'll tell you if one is coming up.</p>
    <div class="btn-row"><a class="btn-ink" href="${mailto("Console request")}">Email a request</a></div>
    <p>Or write to <a href="mailto:${MAIL}">${MAIL}</a>.</p>`;
}

const CHEVRON = d => `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>`;
const PREV = CHEVRON("M12.5 4 6.5 10l6 6");
const NEXT = CHEVRON("M7.5 4l6 6-6 6");

// ---------- the bodies that aren't a unit for sale ----------

function stateBody(title, text, actions = LISTED_NOW) {
  return `<div class="unit-state">
    <h1>${title}</h1>
    <p>${text}</p>
    ${actions ? `<div class="btn-row">${actions}</div>` : ""}
  </div>`;
}

const loadingBody = id => `<div class="unit unit--pending">
    <div class="unit-gallery"><div class="shot shot--panel"><p>${BENCH_LISTING_ID.test(id)
      ? `Loading photos of ${idSpan(id)}…` : "Loading this listing…"}</p></div></div>
  </div>`;

const failedBody = () => `<div class="unit unit--pending">
    <div class="unit-gallery"><div class="shot shot--panel"><div class="panel-msg">
      <h1>Couldn't load this unit just now.</h1><p>Refresh to try again.</p>
    </div></div></div>
  </div>`;

const onHoldBody = id => stateBody("This unit is on hold",
  `${idSpan(id)} is in a checkout that hasn't finished. If it isn't paid for, it goes back on sale about 30 minutes after that checkout started.`);

// The buyer's own checkout holds it: send them back to it.
const ownHoldBody = (id, live) => `<div class="unit-state">
    <h1>This unit is in your checkout</h1>
    <p>You started paying for ${idSpan(id)} and didn't finish. It stays held for you for about 30 minutes after you started.</p>
    <a class="btn-buy" data-primary-action href="${esc(live.url)}">Return to your checkout</a>
    <a class="btn-text" href="/store">See what's listed now</a>
  </div>`;

const soldBody = id => `${stateBody("This unit has sold",
  `${idSpan(id)} sold. Each unit here is listed once, so this listing is closed.`, "")}
  <section class="unit-listed" id="listed-now"></section>`;

const withdrawnBody = id => stateBody("No longer listed", `${idSpan(id)} isn't for sale any more.`);
const unknownBody = () => stateBody("That listing isn't here any more", "It may have sold or been taken down.");
const notListedBody = () => stateBody("This unit isn't listed right now",
  "It may have sold, or be on hold in a checkout for about 30 minutes.");

// A sold unit's page: up to four units on sale now, or how to ask for one.
// Appended after the sold message once the listings settle.
async function fillListedNow(main, id) {
  await loadBench();
  const el = main.querySelector("#listed-now");
  if (!el) return;
  const live = allProducts().filter(q => isBench(q) && q.id !== id);
  el.innerHTML = live.length
    ? `<h2>Listed now</h2>
       <div class="unit-cards unit-cards--4">${live.slice(0, 4).map(q => unitCard(q)).join("")}</div>
       ${live.length > 4 ? `<p><a href="/store">All ${live.length} units in the store</a></p>` : ""}`
    : requestHtml();
}

// ---------- a unit for sale ----------

function galleryHtml(p, images) {
  const n = images.length;
  const who = isBench(p) ? displayId(p.id) : p.name;
  const shots = images.map((src, i) => `<figure class="shot"><img src="${esc(src)}" alt="${esc(`${p.name}, photo ${i + 1} of ${n}`)}" width="1200" height="900" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`).join("");
  // One photo: nothing to swipe, so the strip is a plain box inside the
  // named section, not a second region with the same name.
  if (n === 1) {
    return `<section class="unit-gallery" aria-label="${esc(`Photo of ${who}`)}">
      <div class="strip">${shots}</div>
    </section>`;
  }
  return `<section class="unit-gallery" aria-label="${esc(`Photos of ${who}`)}">
      <div class="strip" role="region" tabindex="0" aria-label="${esc(`Photos of ${who}. Swipe or use the arrow keys.`)}">${shots}</div>
      <div class="counter-row">
        <p class="counter num" aria-live="polite">Photo 1 of ${n}</p>
        <div class="pager">
          <button class="btn" type="button" data-step="-1" aria-label="Previous photo" aria-disabled="true">${PREV}</button><button class="btn" type="button" data-step="1" aria-label="Next photo">${NEXT}</button>
        </div>
      </div>
    </section>`;
}

const inCartLink = attr => `<a class="btn btn-wide"${attr} href="/cart">In your cart: view cart</a>`;

// The one money action (or what stands in for it). `first` marks the one in
// the buy block with [data-primary-action]; the repeat further down is the
// same element without it.
function primaryAction(p, { checkoutOff, inCartNow, first }) {
  const attr = first ? " data-primary-action" : "";
  const bench = isBench(p);
  if (checkoutOff) {
    const subject = bench ? `Buying ${displayId(p.id)}` : `Buying ${p.name}`;
    return `<a class="btn btn-wide"${attr} href="${mailto(subject)}">${bench ? "Email to buy this unit" : "Email to buy this"}</a>
      <p class="checkout-off">${bench
        ? `Online checkout isn't switched on yet. To buy this unit now, email ${MAIL} with its id.`
        : `Online checkout isn't switched on yet. To buy this now, email ${MAIL}.`}</p>`;
  }
  if (p.stock < 1) return `<button class="btn-buy" type="button"${attr} disabled>Add to cart</button>`;
  if (inCartNow) return inCartLink(attr);
  return `<button class="btn-buy" type="button"${attr} data-add>Add to cart</button>`;
}

// The buy block. Exported for test/shop-pages.test.js.
export function buyHtml(p, { flaws, checkoutOff, inCartNow }) {
  const bench = isBench(p);
  const title = bench ? `${esc(p.name)} ${idSpan(p.id)}` : esc(p.name);
  const photos = imagesOf(p).length;
  const claim = bench && photos
    ? `<p>${photos === 1 ? "This photo is" : "These photos are"} this unit, ${idSpan(p.id)}. You get this one.</p>`
    : "";
  const terms = returnsLine(p);
  const flawLine = !flaws ? "" : flaws.photo
    ? `<p class="flaws"><button class="btn-text" type="button" data-photo="${flaws.photo}">${esc(flaws.text)}</button></p>`
    : `<p class="flaws"><a class="btn-text" href="#marks">${esc(flaws.text)}</a></p>`;
  const stock = bench ? "" : `<p class="unit-stock">${p.stock > 0 ? "In stock" : "Out of stock"}</p>`;
  const qty = !bench && p.stock > 0 && !checkoutOff
    ? `<p class="qty"><label for="qty">Qty</label> <input type="number" id="qty" inputmode="numeric" min="1" max="${p.stock}" value="1"></p>`
    : "";
  return `<div class="unit-buy">
      <h1 class="unit-title">${title}</h1>
      <p class="unit-condition">${esc(conditionOf(p))}</p>
      ${stock}
      <p class="price num">${esc(formatMoney(p.priceCents))}</p>
      <p class="delivered">${esc(`${deliveredLine(p)} ${DISPATCH}`)}</p>
      ${flawLine}
      ${qty}
      ${primaryAction(p, { checkoutOff, inCartNow, first: true })}
      <div class="terms">
        <p>${terms ? `${esc(terms)} ` : ""}<a href="/shipping-returns">Shipping and returns</a></p>
        ${claim}
        ${questionLine({ unitId: bench ? p.id : null })}
      </div>
    </div>`;
}

function thumbsHtml(images) {
  const n = images.length;
  if (n < 2) return "";
  return `<section class="unit-thumbs">
      <h2>${n === 2 ? "Both photos" : `All ${n} photos`}</h2>
      <ol class="thumbs">${images.map((src, i) => `<li><button type="button" data-photo="${i + 1}" aria-label="Show photo ${i + 1} of ${n}"${i ? "" : ' aria-current="true"'}><img src="${esc(src)}" alt="" width="160" height="120" loading="lazy" decoding="async"><span class="n">${i + 1}</span></button></li>`).join("")}</ol>
    </section>`;
}

// One Looks line: a small button showing the first photo it names (with
// that photo's number under it), then the line with its references linked.
function looksLine(text, images) {
  const n = images.length;
  const first = refsIn(text).find(k => k >= 1 && k <= n);
  const thumb = first
    ? `<button class="look-thumb" type="button" data-photo="${first}" aria-label="Show photo ${first} of ${n}"><img src="${esc(images[first - 1])}" alt="" width="64" height="48" loading="lazy" decoding="async"><span class="n">${first}</span></button>`
    : "";
  return `<li${thumb ? "" : ' class="look-plain"'}>${thumb}<p>${linkRefs(text, n)}</p></li>`;
}

function recordLine(row, text, n) {
  if (row.key !== "measured") return `<p>${linkRefs(text, n)}</p>`;
  const how = /stick/i.test(text) ? ` <a href="/projects/drift-tester#method">How this was measured</a>` : "";
  return `<p>${markReadings(linkRefs(text, n))}${how}</p>`;
}

function recordHtml(rows, images) {
  if (!rows.length) return "";
  const n = images.length;
  return `<section class="unit-record" id="record">
      <h2>Record</h2>
      <dl class="dl-rows">${rows.map(r => `<div><dt>${esc(r.label)}</dt>${r.key === "looks"
        ? `<dd id="marks"><ul class="looks">${r.lines.map(l => looksLine(l, images)).join("")}</ul></dd>`
        : `<dd>${r.lines.map(l => recordLine(r, l, n)).join("")}</dd>`}</div>`).join("")}</dl>
    </section>`;
}

function notesHtml(p, notes, n) {
  const paras = String(p.blurb ?? "").split(/\n+/).map(s => s.trim()).filter(Boolean)
    .map(s => `<p>${esc(s)}</p>`).join("");
  const list = notes.length ? `<ul>${notes.map(l => `<li>${linkRefs(l, n)}</li>`).join("")}</ul>` : "";
  if (!paras && !list) return "";
  return `<section class="unit-notes"><h2>Notes</h2><div class="prose">${paras}${list}</div></section>`;
}

// Up to two other units on sale, the same platform first.
function alsoHtml(p) {
  const others = allProducts().filter(q => isBench(q) && q.id !== p.id && q.stock > 0);
  const pick = [...others.filter(q => q.platform === p.platform), ...others.filter(q => q.platform !== p.platform)].slice(0, 2);
  if (!pick.length) return "";
  return `<section class="unit-also">
      <h2>Also listed now</h2>
      <div class="unit-cards">${pick.map(q => unitCard(q, { compact: true })).join("")}</div>
    </section>`;
}

// The photo strip: scroll-snap does the swiping; the pager, arrow keys,
// thumbnails, record references and the flaw summary all pick a photo by
// number. Below 960px picking one also brings the photos into view; from
// 960px they are pinned beside the file, so the page doesn't move.
function mountGallery(main, n) {
  const gallery = main.querySelector(".unit-gallery");
  const strip = main.querySelector(".strip");
  if (!gallery || !strip) return;
  const shots = [...strip.querySelectorAll(".shot")];
  const counter = main.querySelector(".counter-row .counter");
  const prev = main.querySelector('.pager [data-step="-1"]');
  const next = main.querySelector('.pager [data-step="1"]');
  const thumbs = [...main.querySelectorAll(".thumbs [data-photo]")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 60em)");
  const behavior = () => (reduced.matches ? "auto" : "smooth");
  let current = 0;
  // While a picked photo scrolls into place, the photos it passes don't
  // count: the counter goes straight to the one picked.
  let target = null;
  let targetTimer = 0;

  function mark(i) {
    if (i === current) return;
    current = i;
    if (counter) counter.textContent = `Photo ${i + 1} of ${n}`;
    for (const b of thumbs) {
      if (Number(b.dataset.photo) === i + 1) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
    if (prev) prev.setAttribute("aria-disabled", String(i === 0));
    if (next) next.setAttribute("aria-disabled", String(i === n - 1));
  }

  function go(i, how = behavior()) {
    const k = Math.max(0, Math.min(n - 1, i));
    target = k;
    clearTimeout(targetTimer);
    targetTimer = setTimeout(() => { target = null; }, 1000);
    strip.scrollTo({ left: k * strip.clientWidth, behavior: how });
    mark(k);
  }

  if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
        const k = shots.indexOf(e.target);
        if (target !== null && k !== target) continue;
        if (k === target) target = null;
        mark(k);
      }
    }, { root: strip, threshold: 0.6 });
    shots.forEach(s => seen.observe(s));
    // A swipe or a drag is the visitor's own choice of photo.
    strip.addEventListener("pointerdown", () => { target = null; });
  }

  strip.addEventListener("keydown", e => {
    if (n < 2) return;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (step) { e.preventDefault(); go(current + step); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(n - 1); }
  });

  for (const b of [prev, next]) {
    if (!b) continue;
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      go(current + Number(b.dataset.step));
    });
  }

  // Thumbnails, record references, Looks thumbnails and the flaw summary.
  main.addEventListener("click", e => {
    const b = e.target.closest("button[data-photo]");
    if (!b || !main.contains(b)) return;
    const k = Number(b.dataset.photo);
    if (!(k >= 1 && k <= n)) return;
    go(k - 1);
    if (wide.matches) return;
    gallery.scrollIntoView({ block: "start", behavior: behavior() });
    // From the keyboard (a click with no pointer: detail 0), focus follows
    // to the photos now in view, so the next Tab or arrow key acts there and
    // not on the button scrolled away: the strip when it can be swiped, else
    // the one-photo section.
    if (e.detail === 0) {
      if (strip.tabIndex < 0) gallery.setAttribute("tabindex", "-1");
      (strip.tabIndex >= 0 ? strip : gallery).focus({ preventScroll: true });
    }
  });

  // Keep the same photo in view when the strip changes width.
  let width = strip.clientWidth;
  window.addEventListener("resize", () => {
    if (strip.clientWidth === width) return;
    width = strip.clientWidth;
    strip.scrollTo({ left: current * width, behavior: "auto" });
  });
}

// Add to cart swaps every money button on the page for a link to the cart,
// on the same tick the header's count changes, and says so to screen readers.
function wireBuy(main, p) {
  main.addEventListener("click", e => {
    const btn = e.target.closest("[data-add]");
    if (!btn || !main.contains(btn)) return;
    const qtyInput = main.querySelector("#qty");
    const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
    const res = addToCart(p.id, qty);
    const status = main.querySelector("[data-cart-status]");
    if (!res.ok) {
      if (status) status.textContent = res.reason === "out-of-stock" ? "This is out of stock." : "This listing couldn't be added. Refresh to try again.";
      return;
    }
    let focus = null;
    main.querySelectorAll(".btn-buy").forEach(b => {
      const tpl = document.createElement("template");
      tpl.innerHTML = inCartLink(b.hasAttribute("data-primary-action") ? " data-primary-action" : "");
      const link = tpl.content.firstElementChild;
      if (b === document.activeElement) focus = link;
      b.replaceWith(link);
    });
    if (qtyInput) qtyInput.closest(".qty").remove();
    if (focus) focus.focus();
    if (status) {
      const what = isBench(p) ? displayId(p.id) : p.name;
      status.textContent = res.clamped
        ? `Only ${res.stock} of ${what} available. Your cart has ${res.qty}.`
        : `${what} is in your cart.`;
    }
  });
}

function paintAvailable(main, p, { checkoutOff }) {
  document.title = `${cardTitle(p)} | dhole.dev`;
  const bench = isBench(p);
  const images = imagesOf(p);
  // A catalogue item has no record: its details are plain notes.
  const record = bench ? parseRecord(p.details) : { rows: [], notes: (p.details || []).filter(isText) };
  const flaws = bench ? flawSummary(record.rows, images.length) : null;
  const inCartNow = bench && inCart(p.id);
  const again = !inCartNow && record.rows.length && (p.stock > 0 || checkoutOff)
    ? `<div class="unit-again">
        <p class="price num">${esc(formatMoney(p.priceCents))}</p>
        <p class="delivered">${esc(`${deliveredLine(p)} ${DISPATCH}`)}</p>
        ${primaryAction(p, { checkoutOff, inCartNow, first: false })}
      </div>`
    : "";

  main.innerHTML = `<div class="unit">
      ${images.length ? galleryHtml(p, images) : ""}
      <div class="unit-file">
        ${buyHtml(p, { flaws, checkoutOff, inCartNow })}
        ${thumbsHtml(images)}
        ${recordHtml(record.rows, images)}
        ${notesHtml(p, record.notes, images.length)}
        ${again}
        ${ownerBlock({ heading: "Who you're buying from" })}
      </div>
    </div>
    ${alsoHtml(p)}
    <p class="visually-hidden" aria-live="polite" data-cart-status></p>`;

  if (images.length) mountGallery(main, images.length);
  wireBuy(main, p);
}

// ---------- which body ----------

export function renderProduct() {
  const main = document.getElementById("product-main");
  if (!main) return;
  const id = (new URLSearchParams(location.search).get("id") || "").trim();
  const status = metaContent("unit-status");
  const checkoutOff = metaContent("checkout") === "off";
  const paint = html => { main.innerHTML = html; };

  // 1-4: the server already knows. A held unit never offers Add to cart,
  // even while a cached listing still shows it.
  if (status === "reserved") {
    const live = liveCheckout();
    return paint(live && live.ids.includes(id) ? ownHoldBody(id, live) : onHoldBody(id));
  }
  if (status === "sold") {
    paint(soldBody(id));
    fillListedNow(main, id);
    return;
  }
  if (status === "withdrawn") return paint(withdrawnBody(id));
  if (status === "unknown" || !id) return paint(unknownBody());

  // 5: available, or no word from the server (it served the shell as it is).
  if (!isBenchId(id)) {
    // A catalogue item is in data/products.js already; other units join later.
    const p = findAny(id);
    if (!p) return paint(notListedBody());
    paintAvailable(main, p, { checkoutOff });
    loadBench().then(() => {
      const also = alsoHtml(p);
      const unit = main.querySelector(".unit");
      if (also && unit && !main.querySelector(".unit-also")) unit.insertAdjacentHTML("afterend", also);
    });
    return;
  }
  if (!BENCH_LISTING_ID.test(id)) return paint(unknownBody());

  paint(loadingBody(id));
  (async () => {
    let state = await loadBench();
    let p = findAny(id);
    // The listings are cached for 30 s; the server's word is newer.
    if (!p && status === "available") {
      state = await reloadBench({ fresh: true });
      p = findAny(id);
    }
    if (p) return paintAvailable(main, p, { checkoutOff });
    paint(state === "failed" ? failedBody() : notListedBody());
  })();
}

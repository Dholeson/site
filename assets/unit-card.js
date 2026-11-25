// One unit card: the store shelf, the homepage's "Listed now" and the product
// page's "Also listed now" all render cards through here and nowhere else
// (spec §8.8), so the card reads the same on every page.
//
//   <article class="unit-card">            (+ unit-card--compact)
//     <img class="unit-card-photo">        4:3 on the sweep, alt="" (the name is the link)
//     <div class="unit-card-head">         row 1: name (h3, the link) and price
//     <p class="unit-card-meta">           row 2: the id (or In stock / Out of stock) and shipping
//     <p class="unit-card-condition">      row 3: the condition
//
// The name's link is stretched over the whole card by CSS (a ::after with no
// background), so there is no separate button and nothing to hover-lift.
// Bench copy arrives from RefurbOS, so every value goes through esc().

import { CONDITION_LABELS, formatMoney } from "../data/products.js";
import { displayId, isBench, shippingOf } from "./unit-copy.js";
import { esc } from "./esc.js";

const productHref = id => `/product?id=${encodeURIComponent(id)}`;

// Bench photos are /api/store/img/<sha>.jpg; a catalogue image may be written
// relative to the site root. Either way the card works on any page's path.
const imageSrc = src => (/^(https:\/\/|\/(?!\/))/.test(src) ? src : `/${String(src).replace(/^\/+/, "")}`);

function stockText(p) {
  if (isBench(p)) return `<span class="id">${esc(displayId(p.id))}</span>`;
  return p.stock > 0 ? "In stock" : "Out of stock";
}

const conditionText = p => (isBench(p) ? p.condition : (CONDITION_LABELS[p.condition] || p.condition));

export function unitCard(p, { compact = false } = {}) {
  const [w, h] = compact ? [120, 90] : [400, 300];
  const photo = p.image
    ? `<img class="unit-card-photo" src="${esc(imageSrc(p.image))}" alt="" width="${w}" height="${h}" loading="lazy">`
    : "";
  const ship = formatMoney(shippingOf(p).cents);
  return `<article class="unit-card${compact ? " unit-card--compact" : ""}" data-unit="${esc(p.id)}">
  ${photo}
  <div class="unit-card-head">
    <h3 class="unit-card-name"><a href="${esc(productHref(p.id))}">${esc(p.name)}</a></h3>
    <p class="unit-card-price num">${esc(formatMoney(p.priceCents))}</p>
  </div>
  <p class="unit-card-meta">${stockText(p)} <span class="quiet">+ ${esc(ship)} shipping</span></p>
  <p class="unit-card-condition quiet">${esc(conditionText(p))}</p>
</article>`;
}

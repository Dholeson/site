// The store's shelf, /store (store.html, spec §10.2).
//
// The shelf is the bench's live units (assets/catalogue.js) plus anything in
// data/products.js, in the API's order: newest first. Used hardware is
// listed one unit at a time, so an empty shelf is a normal state, not an
// error: it says how to ask for a console instead.
//
// Layout shift: main.store holds a viewport of height and #shelf holds 480px
// in every state, and nothing static follows the shelf. #store-after (the
// question line, and the owner block once there's a name) is filled only
// after the listings settle, below everything else.
//
// renderProduct and renderCart now live in product-page.js and cart-page.js.
// They are re-exported here for one release, so a page still running a
// cached copy of an old entry module (which imported them from this file)
// keeps working.

import { allProducts, loadBench } from "./catalogue.js";
import { unitCard } from "./unit-card.js";
import { ownerBlock, questionLine } from "./owner-block.js";
import { isBench } from "./unit-copy.js";
import { requestHtml } from "./product-page.js";

export { renderProduct } from "./product-page.js";
export { renderCart } from "./cart-page.js";

const EMPTY = () => `<div class="empty shelf-empty">
    <div class="shelf-empty-main">
      <h2>Nothing on the shelf right now</h2>
      <p>Each console here is one specific unit. It goes up once it's been tested and photographed and comes down when it sells, so some weeks there's nothing here.</p>
      ${requestHtml()}
    </div>
    <div class="shelf-empty-side">
      <h3>Check your own controller</h3>
      <p>The drift tester measures where a controller's sticks rest, in your browser. Nothing is uploaded.</p>
      <div class="btn-row"><a class="btn" href="/projects/drift-tester">Open the drift tester</a></div>
      ${ownerBlock({ heading: "Who you're buying from" })}
    </div>
  </div>`;

const FAILED = () => `<div class="empty shelf-failed">
    <h2>The shelf didn't load</h2>
    <p>Refresh to try again.</p>
    ${requestHtml()}
  </div>`;

function countLine(list) {
  const n = list.length;
  // Units are one of a kind and come newest first; hand-made items follow them.
  if (list.every(isBench)) return n === 1 ? "1 unit listed." : `${n} units listed, newest first.`;
  return n === 1 ? "1 item listed." : `${n} items listed.`;
}

export function renderStore() {
  const shelf = document.getElementById("shelf");
  const after = document.getElementById("store-after");
  if (!shelf) return;

  loadBench().then(state => {
    const list = allProducts();
    if (!list.length) {
      shelf.innerHTML = state === "failed" ? FAILED() : EMPTY();
      return;
    }
    // The cards' names are h3s; this h2 gives them a section, as the empty
    // shelf's h2 does, for anyone moving through the page by heading.
    shelf.innerHTML = `<h2 class="visually-hidden">On the shelf</h2>
      <p class="shelf-count">${countLine(list)}</p>
      <div class="unit-cards">${list.map(p => unitCard(p)).join("")}</div>`;
    if (after) after.innerHTML = `${questionLine()}${ownerBlock({ heading: "Who you're buying from" })}`;
  });
}

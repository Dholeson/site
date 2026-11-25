// Homepage. Everything that is always true is static HTML in index.html: the
// head, the index rows (Store, one per tool, Portfolio) and the Lazy Sunday
// line. This module fills in the three things only the browser can know:
//
//   #owner         ownerBlock(), synchronously. It is "" until data/owner.js
//                  has a first name, so today nothing renders.
//   #shelf-status  what's on the shelf, in the Store row's slot, which CSS
//                  holds at two lines so the copy can change without moving
//                  anything (spec §10.1).
//   #listed-now    up to 4 live units, only when at least one is listed. It is
//                  the last thing in <main>, so filling it can only move
//                  content that is below it, and main.home is held at the
//                  viewport's height, so the footer starts below the fold.
//
// Bench copy arrives from RefurbOS: cards go through unitCard(), which escapes.

import { allProducts, loadBench } from "./catalogue.js";
import { unitCard } from "./unit-card.js";
import { ownerBlock } from "./owner-block.js";
import { SUPPORT_EMAIL } from "./store-config.js";
import { esc } from "./esc.js";

const MAX_CARDS = 4;
// Compact cards (a 120px photo beside the text) below 960px; from 960px,
// full cards in a 4-column row (.unit-cards--4).
const WIDE = "(min-width: 60em)";

const units = n => `${n} unit${n === 1 ? "" : "s"}`;

function statusHtml(state, n) {
  if (state !== "ok") return `Couldn't check the shelf just now. <a href="/store">Open the store</a>`;
  if (!n) {
    const mail = esc(SUPPORT_EMAIL);
    return `Nothing listed right now. Email a request: <a href="mailto:${mail}?subject=Console%20request">${mail}</a>`;
  }
  return `<a href="/store">${units(n)} listed now</a>`;
}

function listedHtml(list, { wide }) {
  const more = list.length > MAX_CARDS
    ? `<p class="listed-now-all"><a href="/store">All ${list.length} units in the store</a></p>`
    : "";
  return `<section class="listed-now" aria-labelledby="listed-now-title">
  <h2 id="listed-now-title">Listed now</h2>
  <div class="unit-cards${wide ? " unit-cards--4" : ""}">${list.slice(0, MAX_CARDS).map(p => unitCard(p, { compact: !wide })).join("")}</div>
  ${more}
</section>`;
}

// Resolves once the status line (and Listed now, if any) is painted.
export function renderHome() {
  const owner = document.getElementById("owner");
  if (owner) owner.innerHTML = ownerBlock({ heading: "Who runs dhole.dev" });

  const status = document.getElementById("shelf-status");
  const listed = document.getElementById("listed-now");
  return loadBench().then(state => {
    // Bench units first, newest first (the API's order), then any hand-made
    // item in stock.
    const live = state === "ok" ? allProducts().filter(p => p.stock > 0) : [];
    if (status) status.innerHTML = statusHtml(state, live.length);
    if (!listed || !live.length) return;

    const wide = typeof matchMedia === "function" ? matchMedia(WIDE) : null;
    const paint = () => { listed.innerHTML = listedHtml(live, { wide: Boolean(wide && wide.matches) }); };
    paint();
    if (wide && typeof wide.addEventListener === "function") wide.addEventListener("change", paint);
  });
}

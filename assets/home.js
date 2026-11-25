// Homepage. Everything that is always true is static HTML in index.html: the
// head, the index rows (Store, one per tool, Portfolio) and the Lazy Sunday
// line. This module fills in the four things only the browser can know:
//
//   #owner         ownerBlock(), synchronously. It is "" until data/owner.js
//                  has a first name, so today nothing renders.
//   #shelf-status  what's on the shelf, in the Store row's slot, which CSS
//                  holds at two lines so the copy can change without moving
//                  anything (spec §10.1). The same copy at every width.
//   #shelf-media   the newest (up to three) listed units' first photos, in
//                  the Store row's right-hand columns, only when a listed
//                  unit has a photo. It is always filled, whatever the
//                  width: CSS shows it from 60em only (assets/home.css), so
//                  a window resized across 60em needs no script, and its
//                  lazy images are never fetched where it is hidden. It is
//                  absolutely placed, so the row keeps the height its text
//                  gives it. With nothing listed, or the check failed, it
//                  keeps its hidden attribute and stays empty.
//   #listed-now    up to 4 live units, only when at least one is listed. It is
//                  the last thing in <main>, so filling it can only move
//                  content that is below it, and main.home is held at the
//                  viewport's height, so the footer starts below the fold.
//
// Bench copy arrives from RefurbOS: cards go through unitCard(), which
// escapes, and everything else here goes through esc().

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

// The newest units' first photos in the Store row's empty right-hand columns
// (CSS shows them from 60em only). Decorative: the status line counts the
// units and Listed now names each one, so alt="" inside a link that is out
// of the tab order and hidden from screen readers. The same URLs as the
// Listed now cards, so the browser fetches each photo once. Lazy, so a phone,
// where CSS hides the strip, never fetches them for it.
// The same path rule as unit-card.js's imageSrc (copied, not imported: no
// module gains a named export in this release).
const imageSrc = src => (/^(https:\/\/|\/(?!\/))/.test(src) ? src : `/${String(src).replace(/^\/+/, "")}`);
const strip = list => list.filter(p => p.image).slice(0, 3)
  .map(p => `<img src="${esc(imageSrc(p.image))}" alt="" loading="lazy" decoding="async" />`).join("");

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

    // Whatever the width: CSS decides where the strip shows.
    const media = document.getElementById("shelf-media");
    if (media && live.some(p => p.image)) {
      media.innerHTML = `<a class="shelf-strip" href="/store" tabindex="-1" aria-hidden="true">${strip(live)}</a>`;
      media.removeAttribute("hidden");
    }

    if (!listed || !live.length) return;

    const wide = typeof matchMedia === "function" ? matchMedia(WIDE) : null;
    const paint = () => { listed.innerHTML = listedHtml(live, { wide: Boolean(wide && wide.matches) }); };
    paint();
    if (wide && typeof wide.addEventListener === "function") wide.addEventListener("change", paint);
  });
}

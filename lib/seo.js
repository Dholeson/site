// What search engines and link previews see, for pages whose content is
// otherwise rendered in the browser.
//
// product.html draws the product with JavaScript. Google runs that, late; the
// crawlers behind link previews (iMessage, Discord, Slack, Facebook, X,
// Reddit) mostly don't run it at all. Most shop traffic arrives by a shared
// link, so the preview card IS the ad: functions/product.js uses this file to
// write each product's <head> on the server: title, description, canonical
// URL, Open Graph and X tags (a bench unit's real photo), and schema.org
// Product data for Google's product results. functions/case.js uses it the
// same way for each case study (case.html). functions/sitemap.xml.js uses it
// to list every page and product. test/seo.test.js covers all three.
//
// Two tags in a product head are for the page itself (assets/product-page.js):
//   <meta name="unit-status">   a bench unit's state as the server saw it:
//       available, reserved, sold or withdrawn; "unknown" on the not-found
//       head. It wins over a cached listing, so a held unit never offers
//       Add to cart.
//   <meta name="checkout" content="off">   Stripe isn't set up yet (no
//       STRIPE_SECRET_KEY), so the page offers "Email to buy this unit"
//       instead of Add to cart. Absent when checkout is on.
//
// The words about a unit (its name with the id, the card title, the share
// description) come from assets/unit-copy.js, so the head says what the
// product page, the store card and the cart say.
//
// No Node imports: this runs in the Workers runtime and in the tests.
// Money is integer cents; decimal() formats it without floating point.

import { CONDITION_LABELS, CURRENCY, SHIPPING } from "../data/products.js";
import { esc } from "../assets/esc.js";
import { cardTitle, displayId, isBench, shareDescription, unitName } from "../assets/unit-copy.js";

export const SITE_NAME = "dhole.dev";
export const DEFAULT_SITE_URL = "https://dhole.dev";
// The generic 1200x630 card (scripts/render-brand.mjs). Hand-made items'
// images are SVG illustrations, which link previews don't render, so they
// use this too, and so does a bench unit whose photo 1 is known to be under
// MIN_CARD_WIDTH.
export const FALLBACK_IMAGE = { path: "/assets/brand/og-site.png", width: 1200, height: 630 };
// What that card shows, for og:image:alt when it stands in for a photo.
const FALLBACK_ALT = "dhole.dev: refurbished retro consoles and controllers";
// iMessage shows a large preview only for an og:image at least this wide
// (Apple TN3156). A bench photo known to be narrower gives way to the
// generic card; one of unknown size is used as it is.
export const MIN_CARD_WIDTH = 900;
// Every case study shares the portfolio card.
export const CASE_IMAGE = { path: "/assets/brand/og-portfolio.png", width: 1200, height: 630 };
const CASE_ALT = "dhole.dev: product case studies";
// What each card in assets/brand/ shows, as its alt text: the Functions use
// these, and every static page that names a card in og:image gives the same
// words in og:image:alt and twitter:image:alt (X reads only the twitter
// one). test/seo.test.js holds the pages to this table.
export const CARD_ALT = Object.freeze({
  "/assets/brand/og-site.png": FALLBACK_ALT,
  "/assets/brand/og-tools.png": "dhole.dev/projects: tools that run in your browser",
  "/assets/brand/og-portfolio.png": CASE_ALT
});

// The pages the sitemap lists besides products, as their extensionless URLs
// (Cloudflare serves /store from store.html and 308-redirects store.html to
// /store, so the .html form is never the one to publish). test/seo.test.js
// checks that each one is a real file.
export const SITE_PAGES = [
  "/",
  "/store",
  "/shipping-returns",
  "/projects",
  "/projects/drift-tester",
  "/projects/chiptune",
  "/projects/discover-cleaner",
  "/portfolio"
];

// The same headers _headers' global rule gives every static page. Pages does
// not apply _headers to a Function's response, so functions/product.js and
// functions/case.js set these themselves; test/seo.test.js fails if they ever
// differ from _headers.
export const PAGE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), interest-cohort=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
};

// The *.pages.dev copies of the site (production and every branch preview)
// must never compete with dhole.dev in search. _headers says so for static
// files; Functions say it themselves with this.
export const isPagesDev = hostname => /\.pages\.dev$/i.test(String(hostname || ""));

export function siteUrl(env) {
  return String((env && env.SITE_URL) || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function shipToCountries(env) {
  const list = String((env && env.SHIP_TO_COUNTRIES) || "US")
    .split(",").map(c => c.trim().toUpperCase()).filter(c => /^[A-Z]{2}$/.test(c));
  return list.length ? list : ["US"];
}

export const productPath = id => `/product?id=${encodeURIComponent(id)}`;
export const casePath = id => `/case?id=${encodeURIComponent(id)}`;

// A unit's URL uses its listing id, lower-cased (/product?id=ro-0042), but
// every page shows the id upper-cased (RO-0042), so a hand-typed or pasted
// link may carry it that way. For such an id this is the lower-case one to
// redirect to (one canonical URL per unit); for anything else, null.
export function lowerBenchId(id) {
  if (typeof id !== "string" || !/^ro-[0-9]{4,6}$/i.test(id)) return null;
  const lower = id.toLowerCase();
  return lower === id ? null : lower;
}

// ---------- small formatters ----------

// 14500 -> "145.00", with integer arithmetic only.
export function decimal(cents) {
  const whole = (cents - (cents % 100)) / 100;
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}

// A JSON-LD body that can't end its <script> early: <, > and & become \u
// escapes (still the same JSON), and so do the two line separators JSON
// allows but some parsers don't.
export function jsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const oneLine = s => String(s ?? "").replace(/\s+/g, " ").trim();

// Cuts at a word boundary and adds an ellipsis, so a description never ends
// mid-word in a search result.
export function clip(s, max = 160) {
  const text = oneLine(s);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

export const conditionLabel = c => CONDITION_LABELS[c] || oneLine(c);

// Bench conditions are free text ("Refurbished", "Used, good", ...), so this
// reads them rather than matching a fixed list. Anything unrecognised is
// used: the safe claim for second-hand hardware.
export function itemCondition(condition) {
  const c = oneLine(condition).toLowerCase();
  if (/refurb/.test(c)) return "https://schema.org/RefurbishedCondition";
  if (/^(brand[\s-]+)?new\b/.test(c) && !/open[\s-]*box/.test(c)) return "https://schema.org/NewCondition";
  return "https://schema.org/UsedCondition";
}

// Open Graph's product:condition only knows these three words.
function ogCondition(condition) {
  const s = itemCondition(condition);
  if (s.endsWith("NewCondition")) return "new";
  if (s.endsWith("RefurbishedCondition")) return "refurbished";
  return "used";
}

// ---------- a product's state ----------

// in-stock | out-of-stock (hand-made, stock 0) | reserved (a bench unit in
// someone's checkout right now) | sold | withdrawn (both bench only).
export const STATES = ["in-stock", "out-of-stock", "reserved", "sold", "withdrawn"];

const AVAILABILITY = {
  "in-stock": "https://schema.org/InStock",
  "out-of-stock": "https://schema.org/OutOfStock",
  // A hold lasts about 30 minutes and then the unit is on sale again.
  "reserved": "https://schema.org/OutOfStock",
  "sold": "https://schema.org/SoldOut",
  "withdrawn": "https://schema.org/Discontinued"
};

// <meta name="unit-status"> for a bench unit in each state. A bench unit is
// never out of stock: it is one unit, on sale, held, sold or withdrawn.
const UNIT_STATUS = {
  "in-stock": "available",
  "reserved": "reserved",
  "sold": "sold",
  "withdrawn": "withdrawn"
};

// What the HTTP status should be. A sold or withdrawn bench unit is gone for
// good (a withdrawn one can come back, as a new 200), so search engines are
// told to drop it; the page still renders and says what happened.
export function statusFor(state) {
  if (state === "sold") return 410;
  if (state === "withdrawn") return 404;
  return 200;
}

// ---------- the product page's <head> ----------

// The card title: "Nintendo 64, Charcoal (RO-0042): $159.00". A unit that is
// gone keeps its name and id but loses the price, so a shared link to it
// never advertises something nobody can buy.
export function shareTitle(p, state = "in-stock") {
  if (state === "sold") return `Sold: ${unitName(p)}`;
  if (state === "withdrawn") return `No longer listed: ${unitName(p)}`;
  return cardTitle(p);
}

export const productTitle = (p, state = "in-stock") => `${shareTitle(p, state)} | ${SITE_NAME}`;

// Price and shipping first, because that is what a buyer looking at a
// preview card wants: "$159.00 + $18.00 shipping. Nintendo 64, unit RO-0042.
// Refurbished. <blurb>", clipped.
function describe(p, state) {
  if (state === "sold") return `This unit has sold. See what's listed now at ${SITE_NAME}.`;
  if (state === "withdrawn") return `This unit is no longer listed. See what's listed now at ${SITE_NAME}.`;
  const share = shareDescription(p);
  return clip(state === "out-of-stock" ? `Out of stock for now. ${share}` : share);
}

const isRaster = url => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);

// A { width, height } in whole pixels, or null for anything else.
const knownSize = s => s && Number.isInteger(s.width) && s.width > 0 && Number.isInteger(s.height) && s.height > 0
  ? { width: s.width, height: s.height }
  : null;

function imagesOf(p, site) {
  const list = Array.isArray(p.images) && p.images.length ? p.images : [p.image];
  return list.filter(Boolean).map(u => /^https?:\/\//.test(u) ? u : `${site}/${String(u).replace(/^\/+/, "")}`);
}

function shippingOf(p) {
  return SHIPPING[p.shippingClass] || SHIPPING.small;
}

export function productJsonLd(p, { site, state, shipTo }) {
  const url = `${site}${productPath(p.id)}`;
  const shipping = shippingOf(p);
  const currency = CURRENCY.toUpperCase();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": oneLine(p.name),
    "description": oneLine(p.blurb),
    "sku": p.id,
    "category": oneLine(p.platform),
    "image": imagesOf(p, site),
    "url": url,
    "offers": {
      "@type": "Offer",
      "url": url,
      "price": decimal(p.priceCents),
      "priceCurrency": currency,
      "availability": AVAILABILITY[state],
      "itemCondition": itemCondition(p.condition),
      "seller": { "@type": "Organization", "name": SITE_NAME, "url": `${site}/` },
      // Flat rate by box size; the order's largest box sets the rate
      // (lib/checkout-core.js shippingFor), so this is what this item costs
      // to ship on its own. No delivery time yet: transit time isn't known.
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": { "@type": "MonetaryAmount", "value": decimal(shipping.cents), "currency": currency },
        "shippingDestination": shipTo.map(c => ({ "@type": "DefinedRegion", "addressCountry": c }))
      }
    }
  };
}

export function breadcrumbJsonLd(p, site) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${site}/` },
      { "@type": "ListItem", "position": 2, "name": "Store", "item": `${site}/store` },
      { "@type": "ListItem", "position": 3, "name": oneLine(p.name), "item": `${site}${productPath(p.id)}` }
    ]
  };
}

const meta = (attr, key, value) => `<meta ${attr}="${key}" content="${esc(value)}" />`;
const script = value => `<script type="application/ld+json">${jsonLd(value)}</script>`;

// The tags that replace product.html's placeholder block. `state` is one of
// STATES; gone units (sold, withdrawn) get noindex and no Product data.
// `checkout: false` (functions/product.js passes it when STRIPE_SECRET_KEY is
// unset) adds the checkout-off meta; true or left out adds nothing.
// `photoSize` is the card photo's { width, height } when it is known
// (functions/product.js reads it from store_images): at least MIN_CARD_WIDTH
// wide, the photo goes out with its size; narrower, the generic card takes
// its place on og:image and twitter:image, with the card's size. Unknown or
// left out: the photo, with no size declared. The JSON-LD lists every photo
// either way.
export function productHead(p, { site = DEFAULT_SITE_URL, state = "in-stock", shipTo = ["US"], checkout, photoSize } = {}) {
  if (!STATES.includes(state)) throw new Error(`Unknown product state: ${state}`);
  const gone = state === "sold" || state === "withdrawn";
  const url = `${site}${productPath(p.id)}`;
  const card = shareTitle(p, state);
  const description = describe(p, state);
  const raster = imagesOf(p, site).find(isRaster);
  const rasterSize = raster ? knownSize(photoSize) : null;
  const photo = rasterSize && rasterSize.width < MIN_CARD_WIDTH ? undefined : raster;
  const image = photo || `${site}${FALLBACK_IMAGE.path}`;
  const cardSize = photo ? rasterSize : FALLBACK_IMAGE;
  const bench = isBench(p);
  const alt = !photo ? FALLBACK_ALT : bench ? `Photo 1 of ${displayId(p.id)}, ${oneLine(p.name)}` : oneLine(p.name);

  const tags = [
    `<title>${esc(`${card} | ${SITE_NAME}`)}</title>`,
    meta("name", "description", description),
    gone ? meta("name", "robots", "noindex") : `<link rel="canonical" href="${esc(url)}" />`
  ];
  if (bench && UNIT_STATUS[state]) tags.push(meta("name", "unit-status", UNIT_STATUS[state]));
  if (checkout === false) tags.push(meta("name", "checkout", "off"));
  tags.push(
    meta("property", "og:type", gone ? "website" : "product"),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:url", url),
    meta("property", "og:title", card),
    meta("property", "og:description", description),
    meta("property", "og:image", image),
    meta("property", "og:image:alt", alt)
  );
  if (cardSize) {
    tags.push(meta("property", "og:image:width", String(cardSize.width)));
    tags.push(meta("property", "og:image:height", String(cardSize.height)));
  }
  if (!gone) {
    tags.push(
      meta("property", "product:price:amount", decimal(p.priceCents)),
      meta("property", "product:price:currency", CURRENCY.toUpperCase()),
      meta("property", "product:availability", state === "in-stock" ? "in stock" : "out of stock"),
      meta("property", "product:condition", ogCondition(p.condition))
    );
  }
  tags.push(
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", card),
    meta("name", "twitter:description", description),
    meta("name", "twitter:image", image),
    meta("name", "twitter:image:alt", alt)
  );
  if (!gone) {
    tags.push(script(productJsonLd(p, { site, state, shipTo })));
    tags.push(script(breadcrumbJsonLd(p, site)));
  }
  return tags.join("\n  ");
}

// No such product (or a malformed id): the page still renders its "not
// found" message, and unit-status tells it which one without a fetch.
export function notFoundHead() {
  return [
    `<title>Not found | ${SITE_NAME}</title>`,
    meta("name", "description", "That listing isn't here any more. It may have sold."),
    meta("name", "robots", "noindex"),
    meta("name", "unit-status", "unknown")
  ].join("\n  ");
}

// ---------- the case-study page's <head> ----------

// One case study (a data/portfolio.js work entry, found with findWork, so an
// alias arrives here as its entry and the canonical names the main id).
export function caseHead(w, { site = DEFAULT_SITE_URL } = {}) {
  const url = `${site}${casePath(w.id)}`;
  const card = `${oneLine(w.title)}: case study`;
  const description = clip(w.pitch);
  const image = `${site}${CASE_IMAGE.path}`;
  return [
    `<title>${esc(`${card} | ${SITE_NAME}`)}</title>`,
    meta("name", "description", description),
    `<link rel="canonical" href="${esc(url)}" />`,
    meta("property", "og:type", "article"),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:url", url),
    meta("property", "og:title", card),
    meta("property", "og:description", description),
    meta("property", "og:image", image),
    meta("property", "og:image:width", String(CASE_IMAGE.width)),
    meta("property", "og:image:height", String(CASE_IMAGE.height)),
    meta("property", "og:image:alt", CASE_ALT),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", card),
    meta("name", "twitter:description", description),
    meta("name", "twitter:image", image),
    meta("name", "twitter:image:alt", CASE_ALT)
  ].join("\n  ");
}

// No case study with that id (or none given): the page renders its own
// "not found" message; search engines are told to drop the URL.
export function caseNotFoundHead() {
  return [
    `<title>Case study not found | ${SITE_NAME}</title>`,
    meta("name", "description", "There's no case study with that id. Every case study is listed on the portfolio page."),
    meta("name", "robots", "noindex")
  ].join("\n  ");
}

// product.html and case.html mark the block a Function may replace:
//   <!-- seo:start ... -->  ...  <!-- seo:end -->
// Throws if the markers are missing or doubled, so a broken shell is served
// as it is rather than mangled.
export const SEO_START = "<!-- seo:start";
export const SEO_END = "<!-- seo:end -->";

export function injectHead(html, tags) {
  const a = html.indexOf(SEO_START);
  const b = html.indexOf(SEO_END);
  if (a < 0 || b < a || html.indexOf(SEO_START, a + 1) >= 0 || html.indexOf(SEO_END, b + 1) >= 0) {
    throw new Error("The page's seo:start / seo:end markers are missing or repeated.");
  }
  return html.slice(0, a) + tags + html.slice(b + SEO_END.length);
}

// ---------- sitemap ----------

// bench: [{ id, images: ["/api/store/img/<sha>.jpg", ...], updatedAt }]
export function sitemapXml(site, { products = [], bench = [] } = {}) {
  const url = (loc, { lastmod, images = [] } = {}) => [
    "  <url>",
    `    <loc>${esc(loc)}</loc>`,
    lastmod ? `    <lastmod>${esc(lastmod)}</lastmod>` : null,
    ...images.map(i => `    <image:image><image:loc>${esc(i)}</image:loc></image:image>`),
    "  </url>"
  ].filter(Boolean).join("\n");

  const entries = [
    ...SITE_PAGES.map(p => url(`${site}${p}`)),
    ...bench.map(b => url(`${site}${productPath(b.id)}`, {
      lastmod: /^\d{4}-\d{2}-\d{2}/.test(b.updatedAt || "") ? b.updatedAt.slice(0, 10) : null,
      images: (b.images || []).map(i => `${site}/${String(i).replace(/^\/+/, "")}`)
    })),
    ...products.map(p => url(`${site}${productPath(p.id)}`))
  ];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    ...entries,
    `</urlset>`,
    ""
  ].join("\n");
}

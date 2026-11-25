// /product?id=<id> — the product page, with its <head> written on the server.
//
// product.html renders the product in the browser. This Function serves that
// same file with the placeholder block between <!-- seo:start --> and
// <!-- seo:end --> replaced by the product's own title, description,
// canonical URL, link-preview tags (a bench unit's real photo) and
// schema.org Product data (lib/seo.js), and with an honest status:
//
//   hand-made item (data/products.js)     200 (stock 0: still 200, out of stock)
//   bench unit on sale, or on hold        200
//   bench unit sold                       410, noindex
//   bench unit withdrawn                  404, noindex
//   no id, unknown or malformed id        404, noindex
//   a unit id not in lower case (RO-0042) 301 to the lower-case URL
//
// Pages show a unit's id upper-cased, so a hand-made link can carry it that
// way; the redirect comes first, needs no D1, and keeps one URL per unit.
//
// Every product head also says whether Stripe is set up: with no
// STRIPE_SECRET_KEY (the same test functions/api/checkout.js makes) it
// carries <meta name="checkout" content="off">, and the page offers "Email to
// buy this unit" instead of an Add to cart that could only fail. Setting the
// secret switches it off by itself. Bench heads carry <meta name="unit-status">.
//
// A bench unit's card photo declares its pixel size when store_images
// (migrations/1002_store_images.sql) knows it, and gives way to the generic
// card when it is under 900 px wide (lib/seo.js productHead). The bench API
// records each photo's size on upload; a photo with no row yet is read here
// once, from its first 128 KiB in R2, and recorded. Every step of that is
// best effort: whatever fails, the head is the one it was without sizes.
//
// It never makes the page worse than the static file: if D1 is unbound or
// fails, or the markers are missing, the shell goes out unchanged with 200.
// Old /product.html?id= links reach here through Cloudflare's own 308 to
// /product?id= (the query string survives it). _routes.json routes /product
// here; nothing else changes routing.
//
// _headers doesn't apply to a Function's response, so this sets the same
// security headers itself (lib/seo.js PAGE_HEADERS, which a test holds equal
// to _headers), plus X-Robots-Tag: noindex on *.pages.dev.

import { findProduct } from "../data/products.js";
import { jpegSize } from "../lib/jpeg-size.js";
import {
  IMAGE_NAME, LISTING_ID, effectiveStatus, getListing, imageKey, imageSize, isBenchId, nowIso,
  recordImageSize, toProduct
} from "../lib/store-db.js";
import {
  PAGE_HEADERS, injectHead, isPagesDev, lowerBenchId, notFoundHead, productHead, shipToCountries, siteUrl, statusFor
} from "../lib/seo.js";

const BENCH_STATE = { available: "in-stock", reserved: "reserved", sold: "sold", withdrawn: "withdrawn" };

// How much of a photo to read for its size: the frame header comes after the
// APP segments (EXIF, ICC profile), each at most 64 KiB.
const SIZE_PROBE_BYTES = 131072;

const logFailure = (what, err) => console.error(`${what} failed:`, err && (err.stack || err.message));

// Photo 1's { width, height } for the card, or null when it isn't known.
// Never throws. A failed lookup (no store_images table before 1002 is
// applied, or D1 trouble) is null, as before sizes existed; a photo with no
// row is read from R2 and its size recorded for next time.
async function photoSizeOf(row, env) {
  let name;
  try {
    name = JSON.parse(row.images)[0];
  } catch {
    return null;
  }
  if (typeof name !== "string" || !IMAGE_NAME.test(name)) return null;

  try {
    const known = await imageSize(env.DB, name);
    if (known) return known;
  } catch (err) {
    logFailure("Looking up a photo's size", err);
    return null;
  }

  if (!env.STORE_IMAGES) return null;
  let size;
  try {
    const obj = await env.STORE_IMAGES.get(imageKey(name), { range: { offset: 0, length: SIZE_PROBE_BYTES } });
    if (!obj) return null;
    size = jpegSize(new Uint8Array(await obj.arrayBuffer()));
  } catch (err) {
    logFailure("Reading a photo's size", err);
    return null;
  }
  if (!size) return null;
  try {
    await recordImageSize(env.DB, name, size);
  } catch (err) {
    logFailure("Recording a photo's size", err);
  }
  return size;
}

// { status, head } for the page, or null when it can't be known (no D1).
async function resolvePage(id, env) {
  const site = siteUrl(env);
  const shipTo = shipToCountries(env);
  const checkout = Boolean(env.STRIPE_SECRET_KEY);
  const missing = { status: 404, head: notFoundHead() };
  if (!id) return missing;

  if (isBenchId(id)) {
    if (!LISTING_ID.test(id)) return missing;
    if (!env.DB) return null;
    const row = await getListing(env.DB, id);
    if (!row) return missing;
    const state = BENCH_STATE[effectiveStatus(row, nowIso())];
    if (!state) return null;
    const photoSize = await photoSizeOf(row, env);
    return { status: statusFor(state), head: productHead(toProduct(row), { site, state, shipTo, checkout, photoSize }) };
  }

  const p = findProduct(id);
  if (!p) return missing;
  const state = p.stock > 0 ? "in-stock" : "out-of-stock";
  return { status: statusFor(state), head: productHead(p, { site, state, shipTo, checkout }) };
}

function headersFor(asset, hostname) {
  const h = new Headers(asset.headers);
  // The body changes, so the file's validators and length no longer apply.
  for (const name of ["ETag", "Last-Modified", "Content-Length"]) h.delete(name);
  for (const [name, value] of Object.entries(PAGE_HEADERS)) h.set(name, value);
  h.set("Content-Type", "text/html; charset=utf-8");
  // Stock changes by the minute; always check back.
  h.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (isPagesDev(hostname)) h.set("X-Robots-Tag", "noindex");
  return h;
}

// /product?id=RO-0042 -> /product?id=ro-0042, the rest of the query kept.
function lowerCaseRedirect(url, id) {
  const to = new URL(url);
  to.searchParams.set("id", id);
  const headers = new Headers(PAGE_HEADERS);
  headers.set("Location", `${to.pathname}${to.search}`);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (isPagesDev(url.hostname)) headers.set("X-Robots-Tag", "noindex");
  return new Response(null, { status: 301, headers });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "GET" || request.method === "HEAD") {
    const url = new URL(request.url);
    const lower = lowerBenchId(url.searchParams.get("id"));
    if (lower) return lowerCaseRedirect(url, lower);
  }
  const asset = await context.next();
  if (request.method !== "GET" && request.method !== "HEAD") return asset;
  if (!asset.ok || !/text\/html/i.test(asset.headers.get("Content-Type") || "")) return asset;

  const url = new URL(request.url);
  const headers = headersFor(asset, url.hostname);
  const head = request.method === "HEAD";
  const shell = head ? "" : await asset.text();
  const unchanged = () => new Response(head ? null : shell, { status: 200, headers });

  let page;
  try {
    page = await resolvePage(url.searchParams.get("id"), env || {});
  } catch (err) {
    console.error("Product page head failed:", err && (err.stack || err.message));
    return unchanged();
  }
  if (!page) return unchanged();
  if (head) return new Response(null, { status: page.status, headers });

  try {
    return new Response(injectHead(shell, page.head), { status: page.status, headers });
  } catch (err) {
    console.error("Product page head failed:", err && (err.stack || err.message));
    return unchanged();
  }
}

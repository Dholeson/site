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
import { LISTING_ID, effectiveStatus, getListing, isBenchId, nowIso, toProduct } from "../lib/store-db.js";
import {
  PAGE_HEADERS, injectHead, isPagesDev, notFoundHead, productHead, shipToCountries, siteUrl, statusFor
} from "../lib/seo.js";

const BENCH_STATE = { available: "in-stock", reserved: "reserved", sold: "sold", withdrawn: "withdrawn" };

// { status, head } for the page, or null when it can't be known (no D1).
async function resolvePage(id, env) {
  const site = siteUrl(env);
  const shipTo = shipToCountries(env);
  const missing = { status: 404, head: notFoundHead() };
  if (!id) return missing;

  if (isBenchId(id)) {
    if (!LISTING_ID.test(id)) return missing;
    if (!env.DB) return null;
    const row = await getListing(env.DB, id);
    if (!row) return missing;
    const state = BENCH_STATE[effectiveStatus(row, nowIso())];
    if (!state) return null;
    return { status: statusFor(state), head: productHead(toProduct(row), { site, state, shipTo }) };
  }

  const p = findProduct(id);
  if (!p) return missing;
  const state = p.stock > 0 ? "in-stock" : "out-of-stock";
  return { status: statusFor(state), head: productHead(p, { site, state, shipTo }) };
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

export async function onRequest(context) {
  const { request, env } = context;
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

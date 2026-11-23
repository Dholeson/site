// /api/store/* — the public, read-only side of the live bench stock.
//
//   GET /api/store/listings            bench units on sale, shaped like
//                                      data/products.js entries
//   GET /api/store/img/<sha256>.jpg    a listing photo, from R2
//
// Both are same-origin for the storefront, so the global CSP ('self' in
// img-src and connect-src) already covers them.
//
// Note: _headers rules don't apply to Function responses, so each response
// here sets its own caching and nosniff headers.

import { json, methodNotAllowed } from "../../../lib/http.js";
import { IMAGE_NAME, imageKey, nowIso, publicListings } from "../../../lib/store-db.js";

async function listings(env) {
  if (!env.DB) return json({ error: "The store's live stock isn't available right now." }, 503);
  // Only units a buyer can take now: available, or held by a checkout whose
  // hold has run out. No inventory ids, holds, timestamps or sales.
  const list = await publicListings(env.DB, nowIso());
  return json({ listings: list }, 200, { "Cache-Control": "public, max-age=30" });
}

async function image(env, name, method) {
  if (!IMAGE_NAME.test(name)) {
    return json({ error: "That isn't a store image name." }, 400);
  }
  if (!env.STORE_IMAGES) return json({ error: "Store images aren't available right now." }, 503);
  const obj = await env.STORE_IMAGES.get(imageKey(name));
  if (!obj) return json({ error: "No such image." }, 404);

  const headers = {
    "Content-Type": "image/jpeg",
    // The name is the SHA-256 of the bytes, so the content at a URL never changes.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff"
  };
  if (obj.httpEtag) headers.ETag = obj.httpEtag;
  if (Number.isInteger(obj.size)) headers["Content-Length"] = String(obj.size);
  if (method === "HEAD") {
    if (obj.body && typeof obj.body.cancel === "function") await obj.body.cancel();
    return new Response(null, { status: 200, headers });
  }
  return new Response(obj.body, { status: 200, headers });
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);

  const parts = new URL(request.url).pathname.replace(/^\/api\/store\/?/, "").split("/");
  try {
    if (parts.length === 1 && parts[0] === "listings") return await listings(env);
    if (parts.length === 2 && parts[0] === "img") return await image(env, parts[1], request.method);
    return json({ error: "Not found." }, 404);
  } catch (err) {
    console.error("Store API failed:", err && (err.stack || err.message));
    return json({ error: "The store hit an internal error." }, 500);
  }
}

// /api/bench/* — the authenticated API RefurbOS (the shop's bench app) uses to
// push refurbished units to the store and pull back the sales.
//
//   PUT  /api/bench/images/<sha256>.jpg      a listing photo, into R2
//   PUT  /api/bench/listings/<id>            create or update a listing
//   POST /api/bench/listings/<id>/withdraw   take a listing down
//   GET  /api/bench/listings                 every listing, newest first
//   GET  /api/bench/sales?after=<sale_id>    sales, 100 at a time, ascending
//
// Auth: "Authorization: Bearer <token>", compared in constant time against the
// Pages secret BENCH_TOKEN. Unset or shorter than 32 characters -> 503 for
// every request: this API is never open by default.
//
// Every error is JSON { error: "<a sentence>" }; RefurbOS shows it to the
// owner. The contract is described in CLAUDE.md ("Live bench stock").

import {
  json, methodNotAllowed, readBody, parseJson, timingSafeEqualBytes, sha256Hex, utf8
} from "../../../lib/http.js";
import {
  LISTING_ID, IMAGE_NAME, WITHDRAW_REASONS, imageKey, imageUrl, productUrl, nowIso,
  validateListing, upsertListing, withdrawListing, benchListings, salesAfter, effectiveStatus
} from "../../../lib/store-db.js";

const MIN_TOKEN_LENGTH = 32;
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_JSON_BYTES = 64 * 1024;

// Returns a Response to send instead of handling the request, or null when the
// caller holds the token.
function checkAuth(request, env) {
  // Surrounding whitespace is never part of a token, and `wrangler pages
  // secret put` keeps the trailing newline of a piped value.
  const expected = typeof env.BENCH_TOKEN === "string" ? env.BENCH_TOKEN.trim() : "";
  if (expected.length < MIN_TOKEN_LENGTH) {
    return json({ error: "Bench API is not configured." }, 503);
  }
  const header = request.headers.get("Authorization") || "";
  const m = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header);
  if (!m) {
    return json({ error: "Missing bench token. Send Authorization: Bearer <token>." }, 401,
      { "WWW-Authenticate": 'Bearer realm="bench"' });
  }
  if (!timingSafeEqualBytes(utf8(m[1]), utf8(expected))) {
    return json({ error: "The bench token is wrong." }, 401,
      { "WWW-Authenticate": 'Bearer realm="bench"' });
  }
  return null;
}

function needDb(env) {
  return env.DB ? null : json({ error: "The store database (D1 binding DB) is not configured." }, 503);
}

function needImages(env) {
  return env.STORE_IMAGES
    ? null
    : json({ error: "Image storage (R2 binding STORE_IMAGES) is not configured." }, 503);
}

function badId(id) {
  return json({ error: `"${id}" is not a listing id: expected "ro-" and 4 to 6 digits, like ro-0042.` }, 400);
}

// ---------- images ----------

async function putImage(request, env, name) {
  if (!IMAGE_NAME.test(name)) {
    return json({ error: "The image name must be the photo's SHA-256 in lower-case hex, then .jpg." }, 400);
  }
  const missing = needImages(env);
  if (missing) return missing;

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "image/jpeg") {
    return json({ error: "Send the photo as Content-Type: image/jpeg." }, 415);
  }

  const { bytes, tooLarge } = await readBody(request, MAX_IMAGE_BYTES);
  if (tooLarge) {
    return json({ error: `The photo is over ${MAX_IMAGE_BYTES.toLocaleString("en-US")} bytes.` }, 413);
  }

  const sha = name.slice(0, -".jpg".length);
  if ((await sha256Hex(bytes)) !== sha) {
    return json({ error: "The photo's SHA-256 doesn't match its name." }, 400);
  }
  if (!(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return json({ error: "That file isn't a JPEG (it doesn't start with FF D8 FF)." }, 415);
  }

  const key = imageKey(name);
  const body = { name, url: imageUrl(name) };
  // Content-addressed: an existing key already holds exactly these bytes.
  if (await env.STORE_IMAGES.head(key)) return json(body, 200);
  await env.STORE_IMAGES.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return json(body, 201);
}

// ---------- listings ----------

async function readJsonBody(request) {
  const { bytes, tooLarge } = await readBody(request, MAX_JSON_BYTES);
  if (tooLarge) return { response: json({ error: "The request body is too large." }, 413) };
  const body = parseJson(bytes);
  if (body === null) return { response: json({ error: "The body must be JSON.", field: "body" }, 400) };
  return { body };
}

async function putListing(request, env, id) {
  const missing = needDb(env) || needImages(env);
  if (missing) return missing;

  const { body, response } = await readJsonBody(request);
  if (response) return response;

  const v = validateListing(id, body);
  if (v.error) return json({ error: v.error, field: v.field }, 400);
  const { listing } = v;

  // Every photo must already be in R2, so the storefront never shows a hole.
  const heads = await Promise.all(listing.images.map(n => env.STORE_IMAGES.head(imageKey(n))));
  const absent = listing.images.filter((_, i) => !heads[i]);
  if (absent.length) {
    return json({
      error: `${absent.length === 1 ? "A photo hasn't" : `${absent.length} photos haven't`} been uploaded yet: ${absent.join(", ")}.`,
      field: "images",
      missing: absent
    }, 400);
  }

  const now = nowIso();
  const { row, sold } = await upsertListing(env.DB, listing, now);
  if (sold) {
    return json({
      error: `${sold.inventory_id} has already sold on dhole.dev, so it can't be listed again.`,
      status: "sold"
    }, 409);
  }
  return json({
    id: row.id,
    status: effectiveStatus(row, now),
    updated_at: row.updated_at,
    url: productUrl(row.id)
  }, 200);
}

async function withdraw(request, env, id) {
  const missing = needDb(env);
  if (missing) return missing;

  const { body, response } = await readJsonBody(request);
  if (response) return response;
  const reason = body && typeof body === "object" ? body.reason : undefined;
  if (!WITHDRAW_REASONS.includes(reason)) {
    return json({ error: `reason must be ${WITHDRAW_REASONS.map(r => `"${r}"`).join(" or ")}.`, field: "reason" }, 400);
  }

  const now = nowIso();
  const { row, changed } = await withdrawListing(env.DB, id, reason, now);
  if (!row) return json({ error: `There is no listing ${id} on the store.` }, 404);
  if (changed || row.status === "withdrawn") return json({ id, status: "withdrawn" }, 200);
  if (row.status === "sold") {
    return json({ error: `${row.inventory_id} has already sold on dhole.dev.`, status: "sold" }, 409);
  }
  // A live hold: a buyer is in Stripe Checkout right now.
  return json({
    error: `${row.inventory_id} is on hold in a buyer's checkout until ${row.reserved_until}. Try again after that.`,
    status: "reserved",
    reserved_until: row.reserved_until
  }, 409);
}

// ---------- the router ----------

export async function onRequest({ request, env }) {
  const denied = checkAuth(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/bench\/?/, "").split("/");
  const method = request.method;

  try {
    if (parts.length === 2 && parts[0] === "images") {
      if (method !== "PUT") return methodNotAllowed(["PUT"]);
      return await putImage(request, env, parts[1]);
    }

    if (parts.length === 1 && parts[0] === "listings") {
      if (method !== "GET") return methodNotAllowed(["GET"]);
      const missing = needDb(env);
      if (missing) return missing;
      return json({ listings: await benchListings(env.DB, nowIso()) }, 200);
    }

    if (parts.length === 2 && parts[0] === "listings") {
      if (method !== "PUT") return methodNotAllowed(["PUT"]);
      if (!LISTING_ID.test(parts[1])) return badId(parts[1]);
      return await putListing(request, env, parts[1]);
    }

    if (parts.length === 3 && parts[0] === "listings" && parts[2] === "withdraw") {
      if (method !== "POST") return methodNotAllowed(["POST"]);
      if (!LISTING_ID.test(parts[1])) return badId(parts[1]);
      return await withdraw(request, env, parts[1]);
    }

    if (parts.length === 1 && parts[0] === "sales") {
      if (method !== "GET") return methodNotAllowed(["GET"]);
      const missing = needDb(env);
      if (missing) return missing;
      const raw = url.searchParams.get("after");
      const after = raw === null || raw === "" ? 0 : Number(raw);
      if (!/^\d*$/.test(raw ?? "") || !Number.isSafeInteger(after)) {
        return json({ error: "after must be a sale_id: a whole number, 0 or more." }, 400);
      }
      return json(await salesAfter(env.DB, after), 200);
    }

    return json({ error: "There is no such bench endpoint." }, 404);
  } catch (err) {
    console.error("Bench API failed:", err && (err.stack || err.message));
    return json({ error: "The store hit an internal error. Try again shortly." }, 500);
  }
}

// /case?id=<id>: a case-study page, with its <head> written on the server.
//
// case.html renders the case study in the browser. Case-study links go out in
// job applications and get pasted into chats, whose link previews don't run
// JavaScript, so this Function serves that same file with the placeholder
// block between <!-- seo:start --> and <!-- seo:end --> replaced by the case
// study's own title, description, canonical URL and link-preview tags
// (lib/seo.js caseHead), and with an honest status:
//
//   known id                    200, canonical /case?id=<id>
//   an old id (an alias)        200, canonical names the current id
//   no id, or an unknown id     404, noindex (caseNotFoundHead)
//   non-GET/HEAD, or the asset not OK or not HTML    passed through untouched
//
// It never makes the page worse than the static file: if the markers are
// missing, or anything here throws (logged), the shell goes out unchanged
// with 200. Old /case.html?id= links reach here through Cloudflare's own 308
// to /case?id= (the query string survives it). _routes.json routes /case
// here. /case is not in the sitemap: the portfolio page links every case study.
//
// _headers doesn't apply to a Function's response, so this sets the same
// security headers itself (lib/seo.js PAGE_HEADERS, which a test holds equal
// to _headers), plus X-Robots-Tag: noindex on *.pages.dev.

import { findWork } from "../data/portfolio.js";
import { PAGE_HEADERS, caseHead, caseNotFoundHead, injectHead, isPagesDev, siteUrl } from "../lib/seo.js";

// { status, head } for the page.
function resolvePage(id, env) {
  const work = id ? findWork(id) : null;
  if (!work) return { status: 404, head: caseNotFoundHead() };
  return { status: 200, head: caseHead(work, { site: siteUrl(env) }) };
}

function headersFor(asset, hostname) {
  const h = new Headers(asset.headers);
  // The body changes, so the file's validators and length no longer apply.
  for (const name of ["ETag", "Last-Modified", "Content-Length"]) h.delete(name);
  for (const [name, value] of Object.entries(PAGE_HEADERS)) h.set(name, value);
  h.set("Content-Type", "text/html; charset=utf-8");
  // A deploy can change the copy; always check back.
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
    page = resolvePage(url.searchParams.get("id"), env || {});
  } catch (err) {
    console.error("Case page head failed:", err && (err.stack || err.message));
    return unchanged();
  }
  if (head) return new Response(null, { status: page.status, headers });

  try {
    return new Response(injectHead(shell, page.head), { status: page.status, headers });
  } catch (err) {
    console.error("Case page head failed:", err && (err.stack || err.message));
    return unchanged();
  }
}

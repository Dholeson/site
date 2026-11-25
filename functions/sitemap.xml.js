// /sitemap.xml — every page worth indexing, built per request so live bench
// units (with their photos, for Google Images) are listed the moment
// RefurbOS pushes them and dropped the moment they sell.
//
// Pages: lib/seo.js SITE_PAGES. Products: every data/products.js item, then
// every bench unit on sale or on hold. If D1 is unbound or fails, the
// sitemap still lists the pages and the hand-made catalogue.
//
// _routes.json routes /sitemap.xml here. robots.txt points at it.

import { products } from "../data/products.js";
import { sitemapListings } from "../lib/store-db.js";
import { isPagesDev, siteUrl, sitemapXml } from "../lib/seo.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Use GET or HEAD.", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  let bench = [];
  try {
    if (env && env.DB) bench = await sitemapListings(env.DB);
  } catch (err) {
    console.error("Sitemap: bench listings failed:", err && (err.stack || err.message));
  }

  const headers = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  };
  if (isPagesDev(new URL(request.url).hostname)) headers["X-Robots-Tag"] = "noindex";

  const xml = sitemapXml(siteUrl(env), { products, bench });
  return new Response(request.method === "HEAD" ? null : xml, { status: 200, headers });
}

// A small stand-in for Cloudflare Pages, for the dev scripts (check-layout,
// render-brand, capture-tools) and for looking at pages without wrangler.
// Several engineers can run it at once: it listens on 127.0.0.1, on a random
// port unless told otherwise.
//
//   import { start } from "./lib/static-server.mjs";
//   const { url, close } = await start({ port: 0, checkout: "on" });
//
//   node scripts/lib/static-server.mjs [--port 8080] [--checkout off]
//
// What it copies from Pages:
//   /foo           serves foo.html (or 308 to /foo/ when only foo/index.html exists)
//   /foo/          serves foo/index.html (or 308 to /foo when only foo.html exists)
//   /foo.html      308 to /foo, query kept; /foo/index.html 308 to /foo/
//   _redirects     exact and /* rules
//   unknown path   404.html with status 404
//   every HTML response carries lib/seo.js PAGE_HEADERS, so the real CSP applies
//
// The two page Functions are imitated from fixtures instead of D1:
//   /product?id=   product.html with its seo block written by lib/seo.js for a
//                  fixture unit (scripts/fixtures/listings.mjs) or a
//                  data/products.js item, else notFoundHead(); status as
//                  functions/product.js gives it. checkout: "off" passes
//                  checkout: false to productHead (no STRIPE_SECRET_KEY).
//                  A unit id not in lower case gets the same 301 to the
//                  lower-case URL (lib/seo.js lowerBenchId).
//   /case?id=      caseHead / caseNotFoundHead when lib/seo.js exports them;
//                  otherwise the shell as it is.
// There is no API: /api/* answers a JSON 404 (check-layout intercepts the
// listings and photo requests in the browser).
//
// '..' is refused after decoding, and nothing outside the repo is served.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as seo from "../../lib/seo.js";
import { findProduct } from "../../data/products.js";
import { fixtureById } from "../fixtures/listings.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = "https://dhole.dev";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};
export const typeOf = file => TYPES[extname(file).toLowerCase()] || "application/octet-stream";

async function isFile(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

// _redirects: "from to [status]" lines; exact paths and a trailing /* splat.
async function loadRedirects(root) {
  let text = "";
  try { text = await readFile(join(root, "_redirects"), "utf8"); } catch { return []; }
  return text.split("\n").map(l => l.replace(/#.*/, "").trim()).filter(Boolean).map(l => {
    const [from, to, status] = l.split(/\s+/);
    return { from, to, status: Number(status) || 302 };
  }).filter(r => r.from && r.to);
}

function matchRedirect(rules, path) {
  for (const r of rules) {
    if (r.from.endsWith("/*") ? path.startsWith(r.from.slice(0, -1)) : path === r.from) return r;
  }
  return null;
}

function send(res, status, headers, body, head) {
  res.writeHead(status, headers);
  res.end(head ? undefined : body);
}

function htmlHeaders(extra = {}) {
  return { ...seo.PAGE_HEADERS, "Content-Type": TYPES[".html"], "Cache-Control": "no-store", ...extra };
}

function redirect(res, location, status = 308) {
  send(res, status, { Location: location, "Cache-Control": "no-store", "Content-Length": "0" }, "");
}

// Replace the shell's seo block; a shell without markers goes out unchanged
// (as functions/product.js does).
function inject(shell, tags) {
  try { return seo.injectHead(shell, tags); } catch { return shell; }
}

function productPage(shell, id, checkout) {
  const opts = { site: SITE, shipTo: ["US"], checkout: checkout !== "off" };
  const fixture = id ? fixtureById(id) : null;
  if (fixture) {
    return { status: seo.statusFor(fixture.state), html: inject(shell, seo.productHead(fixture.product, { ...opts, state: fixture.state })) };
  }
  const item = id && !/^ro-\d+$/.test(id) ? findProduct(id) : null;
  if (item) {
    const state = item.stock > 0 ? "in-stock" : "out-of-stock";
    return { status: seo.statusFor(state), html: inject(shell, seo.productHead(item, { ...opts, state })) };
  }
  return { status: 404, html: inject(shell, seo.notFoundHead()) };
}

async function casePage(shell, id, root) {
  if (typeof seo.caseHead !== "function" || typeof seo.caseNotFoundHead !== "function") return { status: 200, html: shell };
  if (!shell.includes(seo.SEO_START)) return { status: 200, html: shell };
  const { findWork } = await import(pathToFileURL(join(root, "data", "portfolio.js")).href);
  const work = id && typeof findWork === "function" ? findWork(id) : null;
  if (work) return { status: 200, html: inject(shell, seo.caseHead(work, { site: SITE })) };
  return { status: 404, html: inject(shell, seo.caseNotFoundHead()) };
}

// { parts } (decoded path segments), or { status } when the path is not
// decodable (400) or tries to climb out of the root after decoding (403).
function segmentsOf(rawPath) {
  if (!rawPath.startsWith("/")) return { status: 400 };
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return { status: 400 }; }
  if (decoded.includes("\0")) return { status: 400 };
  const parts = decoded.split(/[/\\]/);
  if (parts.some(p => p === "..")) return { status: 403 };
  return { parts };
}

export async function start({ port = 0, checkout = "on", root = ROOT, host = "127.0.0.1", log = false } = {}) {
  const rules = await loadRedirects(root);
  const inRoot = p => p === root || p.startsWith(root + sep);

  const server = createServer(async (req, res) => {
    const head = req.method === "HEAD";
    try {
      if (req.method !== "GET" && !head) {
        return send(res, 405, { Allow: "GET, HEAD", "Content-Type": TYPES[".txt"] }, "Method not allowed.\n");
      }
      const raw = req.url || "/";
      const q = raw.indexOf("?");
      const rawPath = q < 0 ? raw : raw.slice(0, q);
      const search = q < 0 ? "" : raw.slice(q);
      const { parts, status } = segmentsOf(rawPath);
      if (!parts) {
        return send(res, status, { "Content-Type": TYPES[".txt"] }, status === 403 ? "Forbidden.\n" : "Bad path.\n", head);
      }
      const path = parts.join("/").replace(/\/{2,}/g, "/");
      const params = new URLSearchParams(search);
      if (log) console.log(req.method, raw);

      // Dotfiles (.dev.vars, .git, .wrangler) are never served here.
      if (parts.some(p => p.startsWith(".") && p !== "")) return notFound();

      if (path === "/api" || path.startsWith("/api/")) {
        return send(res, 404, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" },
          JSON.stringify({ error: "The static server has no API." }), head);
      }

      const rule = matchRedirect(rules, path);
      if (rule) return redirect(res, rule.to + search, rule.status);

      // /foo.html -> /foo and /foo/index.html -> /foo/, when the file exists.
      if (/\.html$/i.test(path) && await isFile(join(root, path))) {
        const clean = path.replace(/(^|\/)index\.html$/i, "$1").replace(/\.html$/i, "");
        return redirect(res, (clean || "/") + search);
      }

      if (path === "/product") {
        const lower = seo.lowerBenchId(params.get("id"));
        if (lower) {
          params.set("id", lower);
          return redirect(res, `/product?${params}`, 301);
        }
        const shell = await readFile(join(root, "product.html"), "utf8");
        const page = productPage(shell, params.get("id"), checkout);
        return send(res, page.status, htmlHeaders(), page.html, head);
      }
      if (path === "/case") {
        const shell = await readFile(join(root, "case.html"), "utf8");
        const page = await casePage(shell, params.get("id"), root);
        return send(res, page.status, htmlHeaders(), page.html, head);
      }

      const file = resolve(join(root, path));
      if (!inRoot(file)) return send(res, 403, { "Content-Type": TYPES[".txt"] }, "Forbidden.\n", head);

      if (path.endsWith("/")) {
        if (await isFile(join(file, "index.html"))) return serveFile(join(file, "index.html"));
        if (path !== "/" && await isFile(file.replace(/[/\\]+$/, "") + ".html")) return redirect(res, path.replace(/\/+$/, "") + search);
        return notFound();
      }
      if (await isFile(file)) return serveFile(file);
      if (await isFile(file + ".html")) return serveFile(file + ".html");
      if (await isFile(join(file, "index.html"))) return redirect(res, `${path}/${search}`);
      return notFound();
    } catch (err) {
      console.error("static-server:", err && (err.stack || err.message));
      if (!res.headersSent) send(res, 500, { "Content-Type": TYPES[".txt"] }, "Internal error.\n", head);
      else res.end();
    }

    async function serveFile(file) {
      const body = await readFile(file);
      const type = typeOf(file);
      const headers = type.startsWith("text/html")
        ? htmlHeaders()
        : { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      headers["Content-Length"] = String(body.length);
      return send(res, 200, headers, body, head);
    }

    async function notFound() {
      let body = "Not found.\n";
      let headers = { "Content-Type": TYPES[".txt"], "Cache-Control": "no-store" };
      try {
        body = await readFile(join(root, "404.html"));
        headers = htmlHeaders();
      } catch { /* no 404.html: plain text */ }
      return send(res, 404, headers, body, head);
    }
  });

  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => { server.off("error", fail); ok(); });
  });
  const actual = server.address().port;
  return {
    url: `http://${host}:${actual}`,
    port: actual,
    close: () => new Promise(ok => {
      server.close(() => ok());
      server.closeAllConnections();
    })
  };
}

// Run standalone: node scripts/lib/static-server.mjs [--port N] [--checkout on|off]
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const checkout = arg("--checkout") || "on";
  if (!["on", "off"].includes(checkout)) {
    console.error("--checkout must be on or off");
    process.exit(2);
  }
  const { url } = await start({ port: Number(arg("--port") || 0), checkout, log: process.argv.includes("--log") });
  console.log(`Static server on ${url} (checkout ${checkout}). Ctrl-C to stop.`);
}

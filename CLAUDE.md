# dhole.dev

Personal site with two halves: **browser-playable projects** and a **store for
refurbished retro consoles**. Static site plus a few Pages Functions (checkout,
the bench API, the public store API, the Stripe webhook, league-ify's API),
hosted on Cloudflare Pages, with one D1 database and one R2 bucket. Two more
Functions serve pages rather than APIs: `/product` (each product's `<head>`
written on the server) and `/sitemap.xml`.

Most shop traffic arrives by direct link rather than through the homepage.

## Commands

```bash
npm test                          # checkout + live-stock tests (D1 over node:sqlite), SEO + URL checks, Discover Cleaner and league-ify checks
npm run dev                       # wrangler pages dev . (Functions, local D1 + R2; see SETUP.md)
npm run sync:discover-cleaner     # re-vendor the Discover Cleaner demo (see below)
npx wrangler pages deploy .       # manual deploy (rarely needed)
```

There is no build step. Cloudflare Pages is connected to this repo: merging to
`main` deploys production automatically, and other branches get preview URLs
(`<branch>.dhole-dev.pages.dev`).

## Layout

| Path | What |
|---|---|
| `index.html` | Homepage hub |
| `projects.html`, `projects/` | Project index and the playable demos |
| `projects/discover-cleaner-demo/` | **Generated — don't edit.** The Discover Cleaner web demo, copied from the app's repo by `npm run sync:discover-cleaner` |
| `scripts/` | `sync-discover-cleaner.mjs`, the one vendoring script |
| `store.html`, `product.html`, `cart.html` | Shop. `/product?id=ro-0042` renders a bench unit with a photo gallery |
| `shipping-returns.html` | Shipping, returns, testing, payment and data: only what the code and catalogue already commit to |
| `functions/product.js` | Serves `product.html` with that product's `<head>` (title, canonical, link-preview tags, schema.org Product) and an honest status |
| `functions/sitemap.xml.js` | `/sitemap.xml`: pages, the hand-made catalogue, and live bench units with their photos |
| `lib/seo.js` | Head and sitemap builders, `SITE_PAGES`, and `PAGE_HEADERS` (the Function's copy of `_headers`' global rule) |
| `assets/home/` | Real interface views for the homepage's tool cards (desktop and phone crops) |
| `log.html` | Week-by-week build log |
| `portfolio.html`, `case.html` | Portfolio grid, and one templated case-study page (`case.html?id=`) for job applications |
| `data/portfolio.js` | Portfolio content — one block per project, drives both pages |
| `data/products.js` | Hand-made catalogue — prices, stock, copy (not bench units) |
| `data/projects.js` | Project list |
| `functions/api/checkout.js` | Stripe Checkout, as a Pages Function. Prices and holds bench units from D1 |
| `functions/api/bench/[[path]].js` | Bench API RefurbOS calls (Bearer `BENCH_TOKEN`): photos, listings, withdraw, sales |
| `functions/api/store/[[path]].js` | Public: `/api/store/listings` (live units, products.js shape) and `/api/store/img/<sha256>.jpg` (R2) |
| `functions/api/stripe/webhook.js` | Stripe webhook: completed → sales, expired → release holds |
| `lib/checkout-core.js` | Order pricing, shared with the tests |
| `lib/store-db.js` | Live bench stock in D1: validation, upsert, holds, sales |
| `lib/http.js`, `lib/stripe-signature.js` | JSON errors, capped body reads, constant-time compare; Stripe signature check (Web Crypto) |
| `assets/catalogue.js` | Browser: `products.js` + `/api/store/listings`, falls back to static-only |
| `migrations/1001_store.sql` | The site's own D1 tables (`store_listings`, `store_sales`). **Not vendored** |
| `test/support/` | Test stand-ins: D1 over `node:sqlite` (applies `migrations/`), in-memory R2, harness |
| `assets/entry/` | Per-page entry modules |
| `projects/league-ify/` | league-ify SPA — **built output, vendored** (see below) |
| `functions/api/league-ify/[[path]].js` | league-ify API (accounts + data), one bundled Pages Function — **vendored** |
| `migrations/0001_league_ify.sql` | league-ify's D1 tables (`documents`, `matches`, `lu_users`, `lu_sessions`) — **vendored** |

**league-ify is vendored, not written here.** Its source is the
`Dholeson/league-ify` repo. (Its migration's header still says its four tables
are the only schema in the database; `1001_store.sql` made that untrue. Fix
it upstream and re-vendor, not here.) Don't hand-edit `projects/league-ify/`, the
`[[path]].js` bundle or `migrations/0001_league_ify.sql` — rebuild from a
league-ify checkout with `node scripts/build-site.mjs <path-to-this-site>` and
commit the result. It needs `nodejs_compat` and the `DB` (D1) binding in
`wrangler.toml`. Apply the migration with `npx wrangler d1 migrations apply
dhole-workshop --local` (or `--remote`), not `d1 execute`.

## Conventions that will bite you

**Money is integer cents.** `14500` is $145.00. Never floats — they mischarge
people. `data/products.js` is the single source of truth and is imported by
*both* the browser and the checkout Function.

**The browser never sends a price.** It sends only product ids and quantities;
`lib/checkout-core.js` prices the order server-side. `test/checkout.test.js`
has a test asserting a client-supplied price is ignored. Do not "simplify" this
by trusting the cart.

**No inline `<script>` anywhere.** `_headers` ships a CSP with no
`unsafe-inline` for scripts. Every page loads an entry module from
`assets/entry/` instead. A new page with an inline script will be blocked at
runtime, silently, in production but not in a plain local file server. The one
exception is structured data, `<script type="application/ld+json">`: a data
block, never executed, so the CSP never applies (`test/seo.test.js` checks that
every inline script on the site's pages is one, and that it parses).

**Link to the clean URL.** Cloudflare serves `/store` from `store.html` and
308s `/store.html` to `/store`, so every internal link, canonical, `og:url`,
sitemap entry and `_redirects` target uses the extensionless form. The `.html`
form costs each click a redirect, and a canonical that redirects confuses
Google. Old `.html` links keep working through the 308 (query strings
survive it). `test/seo.test.js` fails on a `.html` link in any site page.

**The product page's `<head>` is written on the server.** Link previews
(iMessage, Discord, Facebook, X) don't run JavaScript, and most shop traffic
arrives by shared link, so `functions/product.js` fills `product.html`'s
`<!-- seo:start -->`…`<!-- seo:end -->` block per product: a bench unit's
first photo on the card, its own canonical, schema.org `Product` with price,
availability, condition and flat shipping. Status: 200 for anything on sale
(a hand-made item at stock 0 too, as out of stock), 410 for a sold bench
unit, 404 for a withdrawn or unknown one (both noindex). D1 down or markers
missing → the shell goes out unchanged. Never give `product.html` a
canonical of its own: it once pointed at the store, which told Google every
product was the store page. `_routes.json` sends `/product` and
`/sitemap.xml` to their Functions; `_headers` doesn't reach Function
responses, so the Function sets `lib/seo.js` `PAGE_HEADERS` itself. **Change
the global CSP in `_headers` and you must change `PAGE_HEADERS` too** (a test
holds them equal). `*.pages.dev` responses carry `X-Robots-Tag: noindex`
(`_headers` for static files, `isPagesDev` in Functions).

**Pages reserve the header.** Each page's `<body>` starts with an empty
`<header class="site-header"></header>`, which CSS holds at 61px and
`assets/chrome.js` fills, so nothing jumps when the script lands. Content
that arrives after first paint above static content holds its space too
(`.product-loading`, `#projects-grid:empty`). Measured layout shift is 0 on
the shop pages; keep it there.

**The global CSP allows Cloudflare Web Analytics' script, and nothing else
off-site.** Web Analytics is on for the Pages project, and Cloudflare injects
its beacon into every HTML page on the production domain (not on
`*.pages.dev` previews or `npm run dev`). The beacon is a script from
`https://static.cloudflareinsights.com`, so that host is in `script-src`.
Without it the CSP blocks the beacon and Web Analytics silently records
nothing. The beacon reports to `/cdn-cgi/rum` on dhole.dev itself (a
same-origin POST, so `connect-src 'self'` covers it). Don't add
`cloudflareinsights.com` to `connect-src`: that endpoint is only for sites
that aren't proxied through Cloudflare. If Web Analytics is ever turned off in
the dashboard, take the script host out of every rule. The tag Cloudflare
injects is an external script with a `data-cf-beacon` attribute, not an
inline script, so it doesn't need `unsafe-inline`.

**Two paths have their own CSP**, each for a vendored app whose images come
from a CDN:

- `/projects/discover-cleaner-demo/*` shows album covers from Spotify's image
  CDN, so its policy is the global one plus `https://i.scdn.co` in `img-src`.
- `/projects/league-ify/*` shows champion art from Riot's Data Dragon and
  fetches its `versions.json`, so its policy is the global one plus
  `https://ddragon.leagueoflegends.com` in `img-src` and `connect-src`.

Nothing else differs from the global policy (each restates the analytics
script host too, since it replaces the global header). In `_headers` each rule first
detaches the global header (`! Content-Security-Policy`) and then sets its
own. Without the detach, Cloudflare comma-joins the two values and the browser
enforces both, which blocks the images. A detach only removes what *earlier*
rules added, so these rules must stay below `/*`.
`test/discover-cleaner-demo.test.js` and `test/league-ify.test.js` check all
of this. Don't widen them, and don't add another exception without the same
reasoning.

**The Discover Cleaner demo is vendored, not written here.** It is built in
the app's repo (github.com/Dholeson/spotify-discover-cleaner,
`python dev/build_web_demo.py` → `dist/web-demo/`). `npm run
sync:discover-cleaner` replaces `projects/discover-cleaner-demo/` with that
build (pass a path to use another build), and `npm test` then checks the
copy. No executable inline scripts: its one `<script type="application/json">`
config block is data, which the CSP never runs. It also checks that every
referenced file is present, that the gzipped fixtures parse and match
`fixtures/manifest.json`, and the size budget. To change the demo, change the app and resync. Hand edits get
overwritten. The landing page that introduces it,
`projects/discover-cleaner.html`, is ordinary site code.

**Cloudflare strips `.html` itself.** `/foo.html` is 308-redirected to `/foo`,
and `/foo` serves `foo.html`. Never add a `_redirects` rule from `/foo` to
`/foo.html`: the two redirect into each other forever (this took
`/portfolio` down once). Test redirects with `npm run dev`, not a plain
file server, which doesn't do either.

**Live bench stock: D1 is the truth for bench units.** RefurbOS (the shop's
bench app, `Dholeson/command-center`) pushes each refurbished unit it lists
and pulls back the sales. One unit = one listing = stock 1, id = the
inventory id lower-cased (`RO-0042` → `ro-0042`, `^ro-[0-9]{4,6}$`). Any cart
id matching `^ro-\d+$` is a bench id and is never looked up in
`data/products.js` (a test keeps static ids out of that namespace).
`data/products.js` stays the truth for hand-made items. Status: `available` →
`reserved` (checkout holds it, all-or-none in one UPDATE, until
`reserved_until`, which equals the Stripe session's `expires_at`; a lapsed
hold counts as `available` everywhere) → `sold` (only by the webhook, final:
a re-push is a 409), or `withdrawn` by the bench (a re-push re-lists it). A
live hold refuses a withdraw with 409 + `reserved_until`. A completed session
records the sale even for a unit withdrawn meanwhile: the money was taken.
The browser still sends only ids and quantities; a bench line's price comes
from D1 and its quantity must be exactly 1. Sales go into `store_sales`
(idempotent on `stripe_session_id, listing_id`; `sale_id` only grows) for the
bench to page through. RefurbOS implements the other side of the same
contract, so endpoint shapes, status codes and error fields are an interface:
each Function's header comment lists its endpoints, and
`test/bench-api.test.js`, `store-public`, `store-checkout` and
`stripe-webhook` pin them. Change both sides together or not at all.

**Stock does not decrement itself, for hand-made items.** A static product's
stock is a number in `data/products.js`: two people buying the last one
minutes apart both succeed (`SETUP.md`). Bench units can't oversell that way;
the one remaining edge is a payment completing as its hold lapses while a
second buyer takes the unit, which records two sales that the bench flags as
"sold twice" for a refund.

**The bench API is never open by default.** `/api/bench/*` needs
`Authorization: Bearer <BENCH_TOKEN>` (a Pages secret), compared with
`crypto.subtle.timingSafeEqual` on equal-length buffers (different lengths
never match). Unset or under 32 characters → 503 for every request; auth runs
before routing. Surrounding whitespace in the secret is trimmed (`wrangler
pages secret put` keeps a piped value's newline). Every error from the store's
APIs is JSON `{ "error": "<a sentence>" }`, which RefurbOS shows the owner.

**Migrations: the site's own are numbered from 1001.** league-ify's build
copies its migrations into `migrations/` by name from 0001 and never clears
the folder; `1001_store.sql` and later site migrations can't collide with
it. Apply with `npx wrangler d1 migrations apply dhole-workshop --local` (or
`--remote`), never `d1 execute`. D1 refuses LIKE/GLOB patterns over 50 bytes,
at the first INSERT rather than at CREATE; the D1 stand-in enforces that.

**`_headers` doesn't apply to Function responses.** Each Function sets its own
`Cache-Control` (`/api/store/listings` 30 s, photos immutable, everything else
`no-store`) and `nosniff`. Photos and the listings fetch are same-origin, so
the global CSP covers them without any change.

**`.dev.vars` is gitignored but not deploy-ignored.** A manual `npx wrangler
pages deploy .` uploads every file in the folder except its own short ignore
list, so `.dev.vars` would be served publicly. Keep only local throwaway values
in it, and move it aside before a manual deploy.

## Testing

`npm test` covers the money path, the global CSP and both exceptions in `_headers`, the
product page's server-written head and the sitemap (`test/seo.test.js`: every
product state, hostile bench copy, D1 failures, clean URLs, robots.txt,
redirects, the `PAGE_HEADERS` mirror), the
vendored demo bundle, and the vendored league-ify build and its config
(`nodejs_compat`, the `DB` binding, the migration). The live-stock tests call
each Function's `onRequest` directly against `test/support/`: a D1 stand-in
over `node:sqlite` that applies every file in `migrations/` (real CHECKs,
upserts, the all-or-none hold), an in-memory R2, and a stubbed Stripe `fetch`
(`bench-api`, `store-public`, `store-checkout`, `stripe-webhook`). They need
Node 22.5+ for `node:sqlite`. The demo's bundle checks
skip, with a note, while `projects/discover-cleaner-demo/` is missing. There is also a Playwright suite that has
been run against the site (39 checks: both demos driven for real, cart totals,
mobile overflow, link previews) but it is not committed — reproduce it if you
change rendering. The bench-unit pages were checked the same way under
`wrangler pages dev` (390 px wide, real CSP, local D1 + R2): the merged grid,
the product gallery, escaped copy, a sold unit's page, a cart with a gone unit,
and the static-only fallback when `/api/store/listings` fails. On 2026-11-24
the SEO and homepage changes were checked the same way at 360, 390 and 1280 px:
no CSP errors, no horizontal overflow, Cart visible in the nav down to 360 px,
layout shift 0.000 on home, store, product and projects, text contrast
6.7–11:1, and the drift tester's "drifting stick?" link to the store.

## Outstanding — needs a browser or an account

These are why a local session is more useful than a cloud one:

1. **Stripe is not connected.** `SETUP.md` step 3 onward. Until
   `STRIPE_SECRET_KEY` is set as a Pages secret, checkout returns a clear
   "not configured" error rather than failing silently. Bench units still
   show on the store meanwhile. Live bench stock's Cloudflare side was set up
   on 2026-11-23 from the owner's PC: R2 bucket `dhole-store-images` created,
   `1001_store.sql` applied `--remote` (`store_listings` / `store_sales` exist
   in the live `dhole-workshop`), `BENCH_TOKEN` set as a Pages production
   secret, and RefurbOS's `.env` has the matching `STORE_URL` / `STORE_TOKEN`.
   Still to do: the Stripe webhook and `STRIPE_WEBHOOK_SECRET` once Stripe
   exists (`SETUP.md`, "Live bench stock"). The first Pages build of this
   branch failed ("Deploy failed") before the bucket existed; the binding
   needs the bucket to exist before a deploy.
2. **`SSL_ERROR_NO_CYPHER_OVERLAP`** was seen on a `*.pages.dev` preview URL in
   Firefox. Untriaged — most likely antivirus TLS scanning or a Firefox TLS
   setting, but nobody has actually loaded the production URL to check.
3. **Hand-made products' images are illustrations, not photographs.** Bench
   units carry the bench's real photos; the `data/products.js` items don't.
   Buyers of used hardware expect real photos. Swap before taking real money.
4. **Search and shop accounts aren't set up.** Verify dhole.dev in Google
   Search Console (a Domain property, via a TXT record in Cloudflare DNS),
   submit `/sitemap.xml`, and add the shop to Google Merchant Center (free
   listings) once Stripe is live. After the next production deploy, view the
   source of a `/product?id=` page and confirm Cloudflare injected the Web
   Analytics beacon into the Function's response as it does for static pages.
   `SETUP.md`, "Search and measurement".
5. **Policy gaps.** `SUPPORT_EMAIL` in `assets/store-config.js` is empty, so
   the site has no contact anywhere (Stripe and Merchant Center both expect
   one). The 30-day power-on window is stated for consoles store-wide (store
   strip, shipping page); hand-made consoles' details say it, bench units'
   don't necessarily. Accessories have no stated return terms.
6. **Delayed payment methods would lose bench sales.** A bank debit completes
   a Checkout Session with `payment_status: "unpaid"` and settles later; the
   webhook only records paid sessions (the contract), so keep such methods off
   in Stripe's payment-method settings while bench units are on sale.

## Deploying

`SETUP.md` is the full guide — DNS, Stripe, secrets, going live.

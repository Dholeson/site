# dhole.dev

Personal site: a **store for refurbished retro consoles**, **tools that run in
the browser** (called "Tools" in the nav; the URL stays `/projects`), and a
**portfolio** of product case studies. Static site plus a few Pages Functions
(checkout, the bench API, the public store API, the Stripe webhook,
league-ify's API), hosted on Cloudflare Pages, with one D1 database and one R2
bucket. Three more Functions serve pages rather than APIs: `/product` and
`/case` (each one's `<head>` written on the server) and `/sitemap.xml`.

Most shop traffic arrives by direct link rather than through the homepage.

## Commands

```bash
npm test                          # node test/run.mjs: every test/*.test.js (checkout + live stock over node:sqlite, SEO + URL checks, design guards, page checks, Discover Cleaner and league-ify checks)
npm run dev                       # wrangler pages dev . (Functions, local D1 + R2; see SETUP.md)
npm run check:layout              # Playwright layout check of every page (not in npm test; see Testing)
npm run sync:owner                # after editing data/owner.js or the portfolio profile (see Design system)
npm run capture:tools             # re-take the tool captures after a UI change: chiptune mid-playback in both themes (home, /projects, the portfolio's wide pair), Discover Cleaner phone crops. Needs sharp; edits no source file; up to 20 s of tries per frame
npm run render:brand              # re-render the link-preview cards and icon-180.png from scripts/brand/
npm run sync:discover-cleaner     # re-vendor the Discover Cleaner demo (see below)
npx wrangler pages deploy .       # manual deploy (rarely needed)
```

There is no build step. Cloudflare Pages is connected to this repo: merging to
`main` deploys production automatically, and other branches get preview URLs
(`<branch>.dhole-dev.pages.dev`). `.github/workflows/test.yml` runs `npm ci`
and `npm test` on every push and pull request, on the latest Node 22.
`test/run.mjs` finds every `test/*.test.js` itself, so a new test file runs
without being listed anywhere.

## Layout

| Path | What |
|---|---|
| `index.html` | Homepage: what the site is, then an index of rows (Store with a live status line, one row per tool, Portfolio). Live units come last, as "Listed now", only when there are some |
| `projects.html`, `projects/` | Tools index ("Tools" in the nav, `/projects` as the URL) and the tools themselves |
| `projects/drift-core.js` | The drift tester's pure maths: `BANDS` (its one scale constant), `summarise`, `sticksFor`, `readingLine` (the "Copy reading" line) |
| `projects/discover-cleaner-demo/` | **Generated — don't edit.** The Discover Cleaner web demo, copied from the app's repo by `npm run sync:discover-cleaner` |
| `scripts/` | `sync-discover-cleaner.mjs`, the one vendoring script, plus the dev scripts below. None of them is part of the site (`robots.txt` disallows `/scripts/`) |
| `scripts/sync-owner.mjs` | `npm run sync:owner`: writes `portfolio.html`'s owner block from `data/owner.js` and the portfolio profile, then runs `render-brand.mjs` |
| `scripts/render-brand.mjs`, `scripts/brand/` | `npm run render:brand`: the three link-preview cards and `icon-180.png`, rendered over HTTP from the HTML templates in `scripts/brand/` |
| `scripts/capture-tools.mjs` | `npm run capture:tools`: the chiptune sequencer mid-playback in light and dark (`assets/home/chiptune-playing*`, `assets/portfolio/chiptune-playing-wide*`), taken from the real page, and the Discover Cleaner phone crops (`assets/projects/discover-cleaner/*-phone.webp`, `assets/home/discover-cleaner-now-phone.webp`, `assets/portfolio/discover-cleaner-phone.webp`) |
| `scripts/check-layout.mjs`, `scripts/fixtures/` | `npm run check:layout`, and the listing fixtures it serves |
| `scripts/lib/` | `static-server.mjs` (a Pages stand-in for the dev scripts: clean URLs, `_redirects`, the real CSP, `/product` and `/case` heads from fixtures), `playwright.mjs` (finds Playwright), `owner-markup.mjs` |
| `store.html`, `product.html`, `cart.html` | Shop. `/product?id=ro-0042` renders a bench unit with a photo gallery |
| `assets/store.js`, `assets/product-page.js`, `assets/cart-page.js` | The shop pages' renderers. `store.js` still re-exports `renderProduct` and `renderCart` for cached copies (see Design system, caching) |
| `order-complete.html`, `checkout-cancelled.html` | Where Stripe returns the buyer (`/order-complete?session_id=`, `/checkout-cancelled`). noindex |
| `assets/unit-copy.js` | The words every page uses about a unit: `displayId`, `unitName`, `cardTitle`, `deliveredLine`, `returnsLine`, `shareDescription`, `DISPATCH`. Shared by the browser, `lib/seo.js` and the tests |
| `assets/unit-card.js` | `unitCard()`: the one unit card (store, home's "Listed now", the product page's "Also listed now") |
| `assets/owner-block.js` | `ownerBlock()` ("" until `OWNER.firstName` is set) and `questionLine()` |
| `assets/record.js` | Reads a unit's RefurbOS `details` lines into record rows by prefix (`Works:`, `Looks:`...), photo references and the flaw summary (SETUP.md, "Writing a unit's record") |
| `assets/checkout-return.js` | Saves the Stripe URL before redirecting, so a buyer who left can "Return to your checkout" while the hold lasts |
| `shipping-returns.html` | Shipping, returns, testing, payment and data: only what the code and catalogue already commit to |
| `404.html` | Not found |
| `functions/product.js` | Serves `product.html` with that product's `<head>` (title, canonical, link-preview tags, schema.org Product, the `unit-status` and `checkout` metas) and an honest status |
| `functions/case.js` | Serves `case.html` with that case study's `<head>`, or 404 |
| `functions/sitemap.xml.js` | `/sitemap.xml`: pages, the hand-made catalogue, and live bench units with their photos |
| `lib/seo.js` | Head and sitemap builders, `SITE_PAGES`, and `PAGE_HEADERS` (the Function's copy of `_headers`' global rule) |
| `assets/theme.js` | The theme head script: classic (not a module), in every page's `<head>` straight before `site.css`. Turns the stored choice (`localStorage` `dhole_theme_v1`) into `<html data-theme>` before first paint, keeps the `color-scheme` and dark `theme-color` metas in step, and exposes `window.dholeTheme` and the `dhole:theme` event (Design system, Two themes) |
| `assets/site.css` | The shared look: `@font-face`, every token (the light `:root` and the two screen-only dark blocks), base, header and footer (with the Theme choice), components, the theme-pair rules. The first stylesheet on every page |
| `assets/shop.css`, `assets/home.css`, `assets/tools.css`, `assets/drift.css`, `assets/portfolio.css`, `assets/info.css` | One area stylesheet per page group, linked after `site.css`. Colours and type sizes only from the tokens |
| `assets/fonts/` | Public Sans (variable) and Red Hat Mono 400, latin woff2, self-hosted, with their OFL licences |
| `assets/brand/` | `og-site.png`, `og-tools.png`, `og-portfolio.png` (1200×630 link-preview cards) and `icon.svg`, `icon-180.png`. Rendered by `npm run render:brand` |
| `assets/home/` | Real captures for the tool rows on home and `/projects` (desktop and phone crops). The chiptune sequencer mid-playback (`chiptune-playing.webp` 720×405, `chiptune-playing-phone.webp` 358×360, each with a `-dark` twin) and the Discover Cleaner phone crop are made by `npm run capture:tools` |
| `assets/portfolio/` | Portfolio screenshots. `chiptune-playing-wide.webp` and its `-dark` twin (1440×810) are made by `npm run capture:tools`. Phone crops and gallery views of the site's own tools are shared from `assets/home/` and `assets/projects/`, not copied |
| `log.html` | Week-by-week build log. Not in the nav or footer; kept until the owner decides |
| `portfolio.html`, `case.html` | Portfolio list, and one templated case-study page (`/case?id=`) for job applications |
| `data/portfolio.js` | Portfolio content, one block per project; drives both pages. A screenshot may have `imageDark` (its dark twin's paths) and the case page a `gallery` ("More views", further real views). Its `profile` (contact links) feeds `npm run sync:owner` |
| `data/owner.js` | Who runs the site: `fullName`, `firstName`, `place`, `about`, `benchPhoto`. All null today, and a null leaves no trace |
| `data/products.js` | Hand-typed catalogue, for new interchangeable stock only (cables, kits) with real photos. **Empty since 2026-11-25**: every used item is a bench unit. Tests use stand-ins from `test/support/catalogue-fixture.js`. Also the policy constants: `SHIPPING`, `RETURNS`, `AUTOMATIC_TAX` |
| `data/projects.js` | The tools list (title, tagline, description, `cta`, `builtWith`, optional real `shot`, with `shot.dark` for a capture of the site's own light interface). `/projects` renders it; home's tool rows are static HTML that `test/home.test.js` holds equal to it |
| `functions/api/checkout.js` | Stripe Checkout, as a Pages Function. Prices and holds bench units from D1 |
| `functions/api/bench/[[path]].js` | Bench API RefurbOS calls (Bearer `BENCH_TOKEN`): photos, listings, withdraw, sales |
| `functions/api/store/[[path]].js` | Public: `/api/store/listings` (live units, products.js shape) and `/api/store/img/<sha256>.jpg` (R2) |
| `functions/api/stripe/webhook.js` | Stripe webhook: completed → sales, expired → release holds |
| `lib/checkout-core.js` | Order pricing, shared with the tests |
| `lib/store-db.js` | Live bench stock in D1: validation, upsert, holds, sales, photo sizes |
| `lib/http.js`, `lib/stripe-signature.js` | JSON errors, capped body reads, constant-time compare; Stripe signature check (Web Crypto) |
| `lib/jpeg-size.js` | A JPEG's pixel size from its frame header (EXIF rotation applied), for link-preview cards |
| `assets/catalogue.js` | Browser: `products.js` + `/api/store/listings`, falls back to static-only |
| `migrations/1001_store.sql` | The site's own D1 tables (`store_listings`, `store_sales`). **Not vendored** |
| `migrations/1002_store_images.sql` | `store_images`: each bench photo's pixel size, so product previews can declare it. The site's own. **Not yet applied remotely** (Outstanding 1) |
| `test/run.mjs` | `npm test`: runs every `test/*.test.js`, each in its own Node process |
| `test/design.test.js` | The design guards (see Design system) |
| `test/theme-core.test.js` | `theme.js` run in `node:vm` (stored choice, blocked storage, other tabs, the back/forward cache), and the footer's Theme control in `chrome.js` |
| `test/theme.test.js` | What spans every page in both themes: each page's theme head (strict), the theme head through the server-written heads, theme pairs, the `--sweep`/`--panel` split, no colour-scheme `<source>`, drawing code on `dhole:theme`, no stand-in captures |
| `test/support/` | Test stand-ins: D1 over `node:sqlite` (applies `migrations/`), in-memory R2, harness |
| `.github/workflows/test.yml` | CI: `npm ci` and `npm test` on every push and pull request |
| `assets/entry/` | Per-page entry modules (the tools' are `projects/*.entry.js`) |
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
first photo on the card (with its pixel size when `store_images` knows it;
a photo under 900 px wide gives way to `og-site.png`, which iMessage shows
large), its own canonical, schema.org `Product` with price,
availability, condition and flat shipping. Status: 200 for anything on sale
(a hand-made item at stock 0 too, as out of stock), 410 for a sold bench
unit, 404 for a withdrawn or unknown one (both noindex). D1 down or markers
missing → the shell goes out unchanged. Never give `product.html` a
canonical of its own: it once pointed at the store, which told Google every
product was the store page. `_routes.json` sends `/product`, `/case` and
`/sitemap.xml` to their Functions; `_headers` doesn't reach Function
responses, so each Function sets `lib/seo.js` `PAGE_HEADERS` itself. **Change
the global CSP in `_headers` and you must change `PAGE_HEADERS` too** (a test
holds them equal). `*.pages.dev` responses carry `X-Robots-Tag: noindex`
(`_headers` for static files, `isPagesDev` in Functions). The product head
also carries two metas the page acts on, `unit-status` and `checkout` (see
Design system).

**`/case` is a Function too, for the same reason.** Case-study links go out in
job applications and get pasted into chats, so `functions/case.js` fills
`case.html`'s seo block per case study: its title ("Discover Cleaner: case
study | dhole.dev"), the pitch as description, its own canonical and `og:url` (an old
id, an alias, gets the current id's), `og:type` article and
`og-portfolio.png`. Status: 200 for a known id, 404 + noindex for a missing
or unknown one. Markers missing, or anything throws → the shell goes out
unchanged with 200. Same `PAGE_HEADERS`, `Cache-Control: public, max-age=0,
must-revalidate`, and noindex on `*.pages.dev`. `case.html` never gets a
canonical of its own either. `/case` stays out of the sitemap: the portfolio
links every case study. `test/case-head.test.js` runs the real `case.html`
through the Function; `test/seo.test.js` covers the head builder.

**Pages reserve the header.** Each page's `<body>` starts with an empty
`<header class="site-header"></header>`, which CSS holds at 61px and
`assets/chrome.js` fills, so nothing jumps when the script lands. Content
that arrives after first paint above static content holds its space too
(`#product-main`, `#tools:empty`, the store's `.shelf`; the full rule is under
Design system). Measured layout shift is 0.000 on every page
(`npm run check:layout`); keep it there.

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

## Design system

Since the 2026-11-25 redesign the site is neutral and photo-first, in two
themes on screen: light by default (a white page, near-black text), and dark
(graphite: a `#161616` page, off-white text) when the device prefers it or
the visitor chooses it in the footer. Print is always light. Neither has a
hue in the interface: unit photos sit on a neutral grey (`--sweep`), captures
of the tools on a 12 px `--panel` frame. Colour comes from photos of the
actual unit and captures of the actual tools. `test/design.test.js`,
`test/theme-core.test.js` and `test/theme.test.js` hold most of what
follows; `npm run check:layout` measures the rest. The themes' own rules are
under "Two themes", at the end of this section.

**The CSP didn't change.** `_headers` and `lib/seo.js` `PAGE_HEADERS` are
exactly what they were before the redesign. Both fonts are self-hosted under
`assets/fonts/`, which `font-src 'self'` already covers. Keep it that way: no
font CDN, no new host.

**Tokens live only in `assets/site.css` `:root` blocks**: the base `:root`
(light) and the two dark blocks (Two themes, below). Every colour is a custom
property there, beside the type scale, the spacing steps and the font stacks.
The area stylesheets and all JS never name a colour (guarded) and take type
sizes from the scale; code that draws (the drift plot) reads colours with
`getComputedStyle`, and draws again on `dhole:theme`. Each page links
`site.css` first, then its one area stylesheet. Contrast is computed from the
real values in every theme. `--sweep` (photo panels) has no edge pair, since
no bordered control sits on a photo, so retuning `--sweep` to the grey of real
photos never needs `--edge` darkened. Retuning `--panel` does: the guard fails
until `--edge` is at least 3:1 on both `--paper` and `--panel`.

**Money buttons are ink; amber is a three-value switch.** `.btn-buy` (Add to
cart, Check out, Return to your checkout) is the only filled, 52 px,
full-width button, coloured by `--buy-bg`, `--buy-bg-hover` and `--buy-fg`.
They default to ink. Retro plastic yellows, buyers judge that from the photos,
and a coloured block beside a photo shifts how the yellowing reads. The
comment in `:root` gives the three amber values (`--kapton`, `--kapton-dk`,
and `--kapton-fg` for the label); amber and its near-black label are the same
in both themes. Switch only after the owner has compared real units beside
both, in both themes. In dark, ink is the off-white, so the default money
button inverts by itself (Two themes). `--buy-*` and
`--kapton*` appear outside `:root` only in `.btn-buy` rules. `.btn-ink`
(44 px, inline, at most one per page) is for a main action that spends
nothing.

**Mono only through `.id`.** Public Sans is the only text face. Red Hat Mono,
for its slashed zero, sets identifiers only (unit ids like RO-0042, a
gamepad's `pad.id`), and only through the `.id` class (`.id--wrap` for long
ones): `--font-id` appears in no other rule. Prices and readings use `.num`,
tabular figures in Public Sans.

**No text under 16 px, and no heading larger than the h1.** Canvas labels are
the one exception to the floor; the money label is 17 px. Every h2 inside
`/product` is set at the h3 size (20 px) so none outgrows the unit's name. No
uppercase, no letter-spacing over 0.01em.

**`font-display: optional` on every `@font-face`.** Public Sans is 27 KB and
preloaded on every page, so it is nearly always ready inside the short block
period, and `optional` never swaps, so a late font can't shift the layout
(Android has none of the metric-matched local fallbacks, so `swap` would
shift there). The cost: a cold visit on a slow link may show that one page in
the fallback face; the next page has the font. Don't change it to `swap`.

**One DOM order on `/product`.** Photos, then the buy block (name and id,
condition, price, delivered total, flaw summary, the one
`[data-primary-action]`, terms), the numbered photo index, the record,
notes, the repeat buy, the owner block, "Also listed now": the same order at
every width, with no CSS `order` and no `display: contents`. From 960 px the
grid only places it. Keyboard, screen reader and phone all get one sequence.

**Late content replaces a held placeholder or is appended last.** Anything
that arrives after first paint either fills a slot whose size is already held
(`#product-main`, the store's `.shelf` at 480 px, `#tools:empty`,
`#pf-list:empty`, home's two-line `.index-status`, home's `#shelf-media`,
which is absolutely placed in its row) or goes after everything
else (home's `#owner` and `#listed-now`, the store's `#store-after`). Each
page whose content arrives late holds `main` at
`min-height: calc(100svh - var(--header-h))`, so the footer is never in the
first viewport while data loads. On a very tall screen a short page shows
space before the footer; that is the price of 0.000.

**Hairlines only on data rows.** `--rule` appears under the header, over the
footer, and on `.dl-rows`, table rows and cart lines. Everything else is
grouped by space: the guard forbids borders on `.index-row`, `.pf-row` and
`.unit-card`. Photo panels are square (radius 0) on `--sweep`, and captures
of the tools sit square on a 12 px `--panel` frame in both themes, so their
pictured buttons never look live; the 4 px `--radius` is for controls and
`.notice` only. A capture of a tool on this site is also a link to that tool
(`tabindex="-1"`, out of the tab order) on home, `/projects` and its case
page, so a click on a pictured control reaches the real one instead of
doing nothing. Screenshots of off-site work stay plain figures.

**The product head tells the page what it can offer.** `functions/product.js`
writes two metas into the seo block, because it already knows the unit's
state and whether Stripe is set up, and so no new public API was needed.
`<meta name="unit-status">` (`available`, `reserved`, `sold`, `withdrawn`;
`unknown` on the not-found head) is read before the page's own listings
fetch, so a cached listing can never show Add to cart for a unit the server
knows is held, sold or gone. `<meta name="checkout" content="off">` is on
every product head while `STRIPE_SECRET_KEY` is unset: the page offers "Email
to buy this unit" (a mailto carrying the unit id) instead of an Add to cart
that could only fail at the cart. Setting the secret removes it, with no
other change. On a plain static server, or with D1 down, neither meta is
written: Add to cart shows, and the cart explains that checkout is off when
`functions/api/checkout.js` answers `code: "not_configured"`.

**Policies come from `data/products.js` and nowhere else.** `RETURNS.console`
is the one returns sentence, rendered word for word on the product page
(under the buy action), in the cart and on `/shipping-returns`.
`RETURNS.accessory` is `null`, so accessories show only the "Shipping and
returns" link. `SHIPPING.<class>.label` goes to Stripe as the shipping rate's
`display_name` (its checkout page and receipt); `.short` labels the cart and
tables. `AUTOMATIC_TAX` mirrors `ENABLE_AUTOMATIC_TAX` in `wrangler.toml`
(`test/unit-copy.test.js` holds them equal); when true the cart says "Total
before tax". Change a term there; the guards fail on any other "N days"
phrase and on any $ amount on home, store or shipping that isn't a `SHIPPING`
rate.

**Copy rules.** No em dash, no trailing "→" or leading "←", no middot meta
strings, no eyebrow labels. Never "actually", "a reading rather than an
opinion" or "measured, not guessed". Dispatch is always "two business days".
Amounts in `formatMoney` form ("$18.00"). Buyers never see the word "bench".
Every request button or link has `support@dhole.dev` as visible text nearby,
for visitors whose mail link does nothing. Labels name their action or
destination ("Open the drift tester", never "Open it"). Nothing claims what
the data can't back: a missing owner name, photo or capture removes its
section, and nothing stands in for it. Sentence case, numbers as digits.

**The guards are in `test/design.test.js`.** They read site HTML, CSS and JS
statically (never the vendored apps, `scripts/` or `test/`) and name the file
and line of each failure:
- colour: hex only in `site.css` `:root` blocks (the base and the two dark
  blocks), no other colour values in site CSS, no quoted colour strings in
  site JS; in every theme, from the real token values: WCAG contrast (text
  4.5:1, edges 3:1), the APCA floor (Two themes), no hue (every resolved hex
  token R=G=B except `--kapton*` and `--fault`) and `--panel-dk` darker than
  `--panel`; the dark blocks one of each, screen only, identical and colour
  tokens only; every required token present (`--forced-off` beside
  `--forced-on`) and no retired one;
- effects: no shadows, blurs, gradients or clipped text; radius at most 4 px;
  no uppercase or small caps; letter-spacing at most 0.01em; no font size
  under 16 px; no `overflow-x` on html or body;
- tokens: every `@font-face` is `font-display: optional`; `--font-id` only in
  `.id`; `--buy-*` and `--kapton*` only in `.btn-buy`;
- structure: no borders on index rows, portfolio rows or unit cards; no
  `::before`/`::after` that paints a background; no `.eyebrow`;
- copy: the rules above;
- money: every $ on home, store and shipping is a `SHIPPING` rate, no
  "$18"-style amounts, no "N days" except `RETURNS.console`;
- heads: `site.css` first, the Public Sans preload and `icon.svg` on every
  page; the theme head all or nothing, in its order (leniently: a page with
  none of it passes with the old single `#ffffff` theme-color, the rule
  while the dark-mode build moved each package's pages; `theme.test.js` is
  the strict one); and a `<noscript>` notice at the top of `main` on every
  page JavaScript renders;
- files: both fonts and licences present; the retired stylesheets and brand
  files gone and unreferenced; the cards 1200×630 and `icon-180.png`
  180×180.

Two more test files guard the themes. `test/theme-core.test.js` runs
`theme.js` in `node:vm` against a stub page (the stored choice, junk, blocked
storage, `set()`, device changes, another tab, the back/forward cache) and
checks the footer control in `chrome.js`. `test/theme.test.js` holds what
spans every package: the theme head on every page, strictly (once each, five
consecutive lines, `theme.js` a plain classic script on the same `?v=` as
`site.css`, the only classic script in any head); the theme head after
`seo:end` in `product.html` and `case.html` and through `injectHead` with
every kind of server head; the `--sweep`/`--panel` split; every theme pair
(markup in site HTML and in what `projects-page.js` and `portfolio-page.js`
render from the data, and the `site.css` pair rules in exactly their media
contexts); no `prefers-color-scheme` in site HTML except the dark
`theme-color` meta, or in site JS strings except `theme.js`'s `DARK`; canvas
code listening for `dhole:theme`; and no stand-in capture names
(`drift-scripted`, `STUBPAD`, `stubbed-pad`, `PROTOTYPE`, "Scripted stick")
in any site file.

`test/portfolio.test.js` relaxes its image-path rule on purpose: `image` (the
wide screenshot) must be under `/assets/portfolio/`, but `imageMobile`,
`imageDark` and every `gallery` file may also be under `/assets/home/` or
`/assets/projects/`. Captures of the site's own tools are shared with home
and `/projects`, not copied, since identical bytes under two names would be
committed twice and split the browser cache. Each must still exist at its
stated size (a dark twin at its light file's).

Fix the page, not the guard. If a rule really has to change, change it in
the guard deliberately, with the reason in its comment.

**Re-run `npm run sync:owner` after editing `data/owner.js` or the portfolio
profile** (`profile` in `data/portfolio.js`). The portfolio's head is static
HTML between `<!-- owner:start -->` and `<!-- owner:end -->`, and
`test/portfolio.test.js` fails until it matches the generator. It then
re-renders the link-preview cards, so `og-portfolio.png` shows the name
(that step needs Playwright).

**Re-run `npm run capture:tools` after a tool's UI changes** (and after
re-vendoring the Discover Cleaner demo). It takes the chiptune sequencer from
the real page while it plays its own preloaded pattern, in light and then
dark (the context's `colorScheme`, nothing stored), as six WebPs:
`assets/home/chiptune-playing.webp` (720×405, a DPR 2 frame of the transport
and grid, scaled down), `assets/home/chiptune-playing-phone.webp` (358×360,
the 390 px layout, unscaled) and `assets/portfolio/chiptune-playing-wide.webp`
(1440×810, the same DPR 2 frame), each with its `-dark` twin. It refuses
unless Public Sans rendered, presses Play, and keeps a frame only if the
playhead is on step 5 (desktop) or step 7 (phone) both before and after the
screenshot, with the button reading Stop. Both themes take the same steps,
so a pair shows the same moment. It keeps trying for up to 20 s per frame
(the pattern comes round every 1.8 s); at 20 s it exits 1 naming the file
and the attempts, and writes nothing. It needs headless Chromium's
AudioContext: without it the playhead never moves and it fails the same way.
After writing, it reads each file's size and checks it against
`data/projects.js` (`shot`, `shot.dark`), `data/portfolio.js` (`image`,
`imageMobile`, `imageDark`) and `index.html`: a mismatch exits 1 and names
what to update, and a file nothing names yet is a printed note. It never
edits a page or a data file and has no PNG fallback, and it deletes the idle
pair it replaced (`chiptune.webp`, `chiptune-phone.webp`) and any
`chiptune*.png`. It also makes the Discover Cleaner phone crops, which stand in
below 60em for laptop captures too small to read at phone width:
`insights-report-phone`, `artist-phone` and `library-backlog-phone` in
`assets/projects/discover-cleaner/`, from the vendored demo at 390 px and
DPR 2, and two crops of the committed `now-phone.webp`:
`assets/home/discover-cleaner-now-phone.webp` (the home and `/projects` row)
and `assets/portfolio/discover-cleaner-phone.webp` (the portfolio's
`imageMobile`). Both parts encode with sharp, which comes with wrangler
(`npm install` brings it); if it is ever missing, `npm i --no-save sharp`,
kept out of the commit. No frame shows an album cover, since the demo loads
those from Spotify. Each
`<picture>` has one alt (and on `/projects/discover-cleaner` one caption)
for both of its files, so it names only what both show. Commit the images
and copy the sizes it prints into `projects/discover-cleaner.html`,
`data/projects.js`, `index.html` and `data/portfolio.js`:
`test/tools.test.js`, `test/home.test.js` and `test/portfolio.test.js` check
them against the files' headers. Shots are real captures only: a tool
without one gets a text-only row, and no scripted or stubbed capture ever
ships (`test/theme.test.js`). After changing a template in
`scripts/brand/`, run `npm run render:brand` the same way.

**Releases are cache-safe by hand.** `/assets/*` is cached for 600 s and
nothing is fingerprinted, so for up to ten minutes a returning visitor can
pair new HTML with old modules. So:
- every stylesheet `<link>`, entry-module `<script src>` and the
  `theme.js` `<script src>` in HTML carries the release's version, `?v=3`
  since dark mode, and an entry that imports an existing module whose
  behaviour changed imports it versioned (`../home.js?v=3`,
  `../projects-page.js?v=3`, `../portfolio-page.js?v=3`; `../store.js?v=2`
  stays, as `store.js` didn't change). Dark mode moved every page to `?v=3`
  because new HTML depends on new CSS: a `.for-dark` picture is hidden only
  by the new `site.css`, so new HTML must never meet an old copy. Old HTML
  with new CSS, for at most 600 s, gets the dark tokens by the device's
  preference, no Theme control and the old capture, which is harmless.
  `theme.test.js` holds `theme.js` and `site.css` on the same version;
- `modulepreload` hrefs stay unversioned (`test/seo.test.js` and
  `test/shop-pages.test.js` check that each is a real file);
- existing `/assets/*.js` modules keep every export they have
  (`assets/store.js` still re-exports `renderProduct` and `renderCart`);
- **new exports go only in new files or in `/data/*.js`**, which the browser
  always revalidates;
- a new option on an existing function must be safe for an old copy to
  ignore;
- `/assets/brand/*` is cached for seven days, so a changed card or icon gets
  a new file name.

**A new page** copies an existing page's head (icon, touch icon, the Public
Sans preload, the theme head's five lines exactly as in Two themes, ending in
`site.css?v=3`, its area stylesheet, its entry module; `test/theme.test.js`
fails on a page without them), starts its body with the empty header, puts
the `<noscript>` notice at the top of `main` if JavaScript renders its
content, and calls `mountChrome()` with its section: `"store"`, `"tools"`,
`"portfolio"`, `"cart"` or `""`.

**The home Store row shows listed units' first photos from 60em.**
`assets/home.js` fills `#shelf-media` with up to three units' first photos
whenever any listed unit has one, whatever the width; CSS shows the strip
only from 60em, and its images are lazy, so a phone never fetches them. It
never branches on `matchMedia`: a window resized across 60em shows or hides
it by CSS alone. The strip is decorative (alt "", out of the tab order,
hidden from screen readers), because the status line counts the units and
Listed now names each one, and it uses the same URLs as the Listed now cards,
so each photo is fetched once. It is absolutely placed in the row's 4-column
media slot, so the row keeps the height its text gives it. With that slot
after it, the Store text is 5 columns from 60em in every shelf state, the
empty shelf included (about 476 px instead of 576 at 1280, so its paragraph
wraps about one more line): that is the price of no layout shift when the
photos arrive. Don't keep it at 9 columns with a `:has()` rule while the
shelf is empty, or the text rewraps and the row moves the moment photos
land. Below 60em the row is unchanged.

### Two themes

**Both token sets.** The base `:root` is the light theme. Two blocks in
`site.css` hold the dark one, graphite: a `#161616` page, `#242424` panels,
`#e4e4e4` ink and `#b6b6b6` secondary text, every interface colour R=G=B and
nothing pure black or pure white.
- `:root:not([data-theme="light"])` inside
  `@media screen and (prefers-color-scheme: dark)`: the device prefers dark
  and the visitor hasn't chosen Light.
- `:root[data-theme="dark"]` inside `@media screen`: the visitor chose Dark,
  whatever the device.

There are two ways into dark, one through a media query and one through an
attribute, so the same values sit in two blocks; the guard holds them
identical, declaration for declaration, so the two ways can never drift
apart. Both selectors (0,2,0) beat the base `:root` (0,1,0); Light chosen on a
dark device matches neither, so the base applies. The blocks change only
colour tokens (`color-scheme`, paper, sweep, panel, panel-dk, pressed, ink,
graphite, rule-c, edge, fault), never a rule, size or font. `--sweep-ink`,
`--sweep-graphite` and `--buy-*` follow `--ink`, `--graphite` and `--paper`
by themselves, and `--kapton*` stay the same.

**Light chosen is `only light`.** Chrome's auto dark ("darken websites" on
Android) darkens a page that declares plain `light`, so a visitor who picked
Light in that browser got a machine-darkened page with the money button a
dark grey block on near-black (about 1.1:1, under Chromium's auto dark
emulation). `:root[data-theme="light"] { color-scheme: only light; }` in
`site.css`, and `theme.js`'s `"only light"` meta, opt out; the design guard
holds that rule to that one declaration. Match device and Dark declare
`dark` on a dark device, which auto dark already leaves alone. Chromium
computes the value as `light only`, which `check:layout` expects with
`--theme light`.

**Screen only, so print is always light.** Both dark blocks and the pair
rules sit in `@media screen …`, so printing and Save as PDF use the light
tokens whatever the device or the footer choice: a receipt
(`/order-complete`), a case study or `/shipping-returns` prints dark on
white. Why: a dark block in print turned body text into about `#909090` on
white paper (3.2:1), lighter than the secondary text. The design guard checks
each block's exact media context, `theme.test.js` the pair rules', and
`check:layout`'s print check every page in every run. The drift tester's
canvas is drawn with the screen's tokens, so printed with Dark chosen its
strokes are pale; it isn't a print target.

**`theme.js` and the head.** Every page's head has these five lines, where
the single `theme-color` used to be:

```html
  <meta name="color-scheme" content="light dark" />
  <meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" data-dark />
  <meta name="theme-color" content="#ffffff" />
  <script src="/assets/theme.js?v=3"></script>
  <link rel="stylesheet" href="/assets/site.css?v=3" />
```

- The dark `theme-color` (the phone browser's bar) comes first, because the
  first matching one wins; its content is the dark `--paper` (guarded).
- `theme.js` is a classic script (no `type`, `async` or `defer`; `script-src
  'self'` covers it, and nothing is inline). It reads `localStorage`
  `dhole_theme_v1` (`"light"`, `"dark"`, or absent to follow the device), sets
  `<html data-theme>` before `<body>` is parsed, so a visitor who chose never
  sees the other theme first, and narrows the two metas to the choice
  (`color-scheme` to `"dark"` or `"only light"`).
- It comes after the metas it rewrites and before every stylesheet: a
  classic script after a stylesheet waits for it, and one before doesn't
  (the preload scanner still finds `site.css` early). It is one
  render-blocking same-origin request on a cold first visit, cached 600 s;
  the only alternative under this CSP, a hashed inline script, would change
  the CSP.
- In `product.html` and `case.html` the five lines stay below
  `<!-- seo:end -->`. `functions/product.js` and `functions/case.js` replace
  everything inside that block, so a theme head there would pass on the
  static file and vanish in production. `test/theme.test.js` runs
  `injectHead` with each kind of server head to check.

**The back/forward cache.** A page restored from the back/forward cache was
frozen, so it missed any `storage` event: a visitor who picks Dark on page B
and presses Back would see page A in the old theme, with the old radio
checked. `theme.js` listens for `pageshow` with `persisted` and re-reads the
stored choice, applying and announcing it if it changed (and announcing anyway
while following the device, so drawing code catches a device switch made
while the page was cached). Blocked or throwing storage never resets the
page's own choice: it lives in a variable, and a failed read keeps it, so a
choice still applies to that page. Playwright launches Chromium with the
back/forward cache off (and re-enabling it headless gave a "masked" restore),
so no browser run exercises this: `test/theme-core.test.js` pins it case by
case in `node:vm`.

A Back that the back/forward cache can't serve (a `no-store` page such as
the 404, or a page the cache dropped) reloads the page, and the browser
then restores form state: the radio checked when the visitor left,
over the one `chrome.js` just rendered from `choice()`, with no `change`
event. Measured in Chromium: pick Dark on `/shipping-returns`, Light on the
next page, press Back, and the page was light with Dark checked, and
clicking Dark did nothing. So the radios are `autocomplete="off"` (which
stops the restore; Firefox documents the same use of it), and `chrome.js`
also re-checks them on every `pageshow`, persisted or not; either alone
fixed it in Chromium (`test/theme-core.test.js` pins both).

**The footer control.** `assets/chrome.js` renders a "Theme" fieldset of
three native radios, Match device, Light and Dark, between the footer links
and the footer's last line, and only when `window.dholeTheme` exists, so an
old cached page never offers a choice that can't work. Arrow keys move and
apply at once; each label is a 44 px target. The header is untouched, so Cart
at 320 px is exactly as before. In dark, Chrome draws unchecked native radios
as filled grey discs, which can read as disabled; accepted, since they are
native and accessible.

**`dhole:theme`, for code that draws.** `window.dholeTheme` is
`{ choice(), resolved(), set(choice) }`. Every change (a footer choice,
another tab's choice, the device switching while the page follows it, a
back/forward restore) dispatches `dhole:theme` on `window` with
`{ choice, resolved }`; a normal load doesn't. CSS follows by itself, a
canvas doesn't: code that draws reads the tokens at init and again on
`dhole:theme`, then redraws (the drift tester: `colours = readColours();
drawAll();`). Under forced colours the drift plot keeps its own palette
(`forced-color-adjust: none`), so its background always matches its strokes.
Without JavaScript `prefers-color-scheme` alone themes the page, the dark
`theme-color` keeps its media, and there is no control.

**Captures pair through `.for-light` and `.for-dark`.** A capture of the
site's own light interface (today only the chiptune sequencer) ships as two
sibling `<picture>`s, `.for-light` then `.for-dark`, with identical sizes on
every `<source>` and `<img>` and the same alt; the dark file is the light
name plus `-dark` (`check:layout` finds pairs by that name). Five rules in
`site.css`, on the same selectors and media as the dark tokens, show only the
current theme's twin, so a footer choice wins over the device. Both images
are `loading="lazy"`, even as a page's first capture, so the hidden twin is
never fetched. Never `<source media="(prefers-color-scheme: dark)">`: it
ignores the visitor's choice (guarded). Without JavaScript, browsers don't
lazy-load, so both twins download (one extra image on `/`, about 7 KB on a
phone and 20 KB on a desktop); accepted. Print shows the light twin, which
Chromium fetches when printing. A capture of a dark interface (Discover
Cleaner's) gets no twin.

**What never varies.** Unit photos are the unit: never dimmed, filtered,
tinted or swapped by theme. The link-preview cards and `icon.svg` are the
same in both themes.

**The `--sweep` / `--panel` split.**
- `--sweep` is only the background of unit-photo panels: `.strip`, `.shot`,
  `.unit-card-photo`, `.thumbs img`, `.cart-line img`, `.look-thumb img`,
  `.owner-photo` and `.shelf-strip img`. `--sweep-ink` and `--sweep-graphite`
  are only text colours on them (`.panel-msg`, `.shot`, `.unit-card-photo`).
- `--panel` is every other surface: capture frames, `.notice`, code, disabled
  buttons, the drift plot, the sequencer's cells.
- `--panel-dk` is the sequencer's beat cells, darker than `--panel` in both
  themes, because the page says "The darker squares mark each beat"
  (guarded).
- `--pressed` is a pressed or `aria-pressed` button (visible in both themes).

So `--sweep` can be set to the sampled corner grey of real photos (keep
R=G=B) without moving any tool. `test/theme.test.js` holds the split.

**The money button in dark.** `--buy-bg` is `--ink`, so in dark the money
button inverts by itself: an off-white fill with near-black text (14.23:1).
In dark, light-backdrop unit photos and that button are both bright blocks;
whether the button still leads is an owner decision once real photos exist
(Outstanding 7). If not, the options are a dark-only neutral `--buy-bg` one
step brighter, or a mid-grey photo backdrop. Never dim the photos.

**The APCA floor.** WCAG 2's ratio overstates light-on-dark contrast, so the
design guard also checks APCA Lc in every theme: at least 75 for body text
(ink on paper and panel, sweep-ink on sweep) and 60 for 16 px secondary text
(graphite on paper and panel, sweep-graphite on sweep). That is why dark
`--graphite` is `#b6b6b6`, `--fault` `#f49b90` and `--edge` `#7c7c7c`.

**The photo strip's two rings.** The product page's photo strip draws its
focus ring inside the panel, because the strip runs to the screen edges on
phones. One ink ring could vanish against a photo of the same brightness, so
there are two: ink at 0 to 2 px (the strip's outline) and `--paper` at 2 to
4 px (the photo's own outline). Ink and paper are at least 14:1 apart in
both themes, so one of them is at least 3:1 against any photo. Windows
contrast themes force every outline to one colour, so under
`@media (forced-colors: active)` the two take `--forced-on` (`CanvasText`)
and `--forced-off` (`Canvas`). `check:layout`'s ring check measures both.

## Testing

`npm test` (`test/run.mjs`) runs every `test/*.test.js`, each in its own Node
process, and CI runs it on every push and pull request. It covers the money
path, the global CSP and both exceptions in `_headers`, the
product page's server-written head and the sitemap (`test/seo.test.js`: every
product state, hostile bench copy, D1 failures, clean URLs, robots.txt,
redirects, the `PAGE_HEADERS` mirror), `/case` heads (`case-head`), photo
sizes for link previews (`image-size`), the design guards (`design`), the
two themes (`theme-core` for `theme.js` and the footer control, `theme` for
what spans every page; Design system, Two themes), the
shared unit copy and owner block (`unit-copy`), the record parser (`record`),
each page group (`shop-pages`, `home`, `tools`, `drift`, `portfolio`, `info`),
the vendored demo bundle, and the vendored league-ify build and its config
(`nodejs_compat`, the `DB` binding, the migration). The live-stock tests call
each Function's `onRequest` directly against `test/support/`: a D1 stand-in
over `node:sqlite` that applies every file in `migrations/` (real CHECKs,
upserts, the all-or-none hold), an in-memory R2, and a stubbed Stripe `fetch`
(`bench-api`, `store-public`, `store-checkout`, `stripe-webhook`). They need
Node 22.13+ (`node:sqlite` without a flag). The demo's bundle checks
skip, with a note, while `projects/discover-cleaner-demo/` is missing.

**`npm run check:layout` replaces the old, uncommitted Playwright suite.** It
is not part of `npm test` or CI because it needs a browser: run it before
merging anything that changes rendering. It serves the repo with
`scripts/lib/static-server.mjs` (random port, the real CSP, `/product` and
`/case` heads written from `scripts/fixtures/listings.mjs`) and loads every
page at 320, 360, 390 and 1280 px (plus 1440 for `/` and `/store`, 960 for the
product page and chiptune, and phone landscape, 844×390, for the product
page), with listings delayed 1 s. It checks: no horizontal overflow; a 61 px
header; layout shift 0.000; text at least 16 px; no heading larger than the
h1; text contrast at least 4.5:1; no CSP errors; the product page's
`[data-primary-action]` inside the first viewport at 360, 390, 960 and 1280
with a 120-character name (with `--units failed`, where the page has no buy
action by design, its "Couldn't load this unit just now." message instead);
the product page's photo panel and its counter row inside the first viewport
at every size, phone landscape included (photos); `/cart` never showing
"$0.00"; and the drift tester with a stubbed 60-character gamepad.

Every run, `--text-scale` included, also checks the themes, in this order
after the measurements above (layout shift first, at scroll 0):
- **theme**: html's computed `color-scheme` is the expected theme (`--theme`,
  or `--scheme` when the theme is `auto`; `light only` with `--theme light`);
  `html[data-theme]` is the
  `--theme` value (absent for auto); and the first `theme-color` meta that
  applies has body's background colour.
- **pairs**: every `assets/**/*-dark.webp` and its light partner make a
  pair. Image requests are recorded, the page is scrolled to the bottom, and
  no request may be for the other theme's twin; every shown twin's image is
  complete. Recording stops before print.
- **ring** (not with `--text-scale`): on `ro-9001` and `ro-9002` at 390×844
  and 1280×800, unless `--units failed`. Tab, focus the photo strip, read the
  two rings' colours from the page, and require them 3:1 apart and at their
  pixels in a 1×12 screenshot at the strip's top centre (0 to 1 the outer,
  2 to 3 the inner, within 8 per channel), with the photo at 8 px at least
  3:1 from one of them; then all of it again under
  `forcedColors: "active"`.
- **print**, last: `emulateMedia({ media: "print" })` with the device's
  scheme left as it is. html's `color-scheme` is light (`light only` with
  `--theme light`), body is white with
  `#1b1b1b` text, and every `.for-dark` is hidden and no `.for-light`.

Options: `--units 0,1,5,failed`, `--checkout off`, `--slow-fonts` (fonts 2 s
late; shift must stay 0), `--text-scale`, `--pages`, `--widths`, and for the
themes `--scheme light|dark` (the context's `colorScheme`, the device),
`--theme auto|light|dark` (an init script stores the footer choice before any
page script) and `--first-paint`. `--first-paint` measures only the first
frame, at 390×844 unless `--widths`: every `*.js` and `*.mjs` request except
`/assets/theme.js` is held back 4 s and the page opened with `waitUntil:
"commit"`; once the document isn't loading and body's background is opaque
(`site.css` applied), the header must still be empty (no module ran), body's
luminance under 0.05 for dark or over 0.9 for light with the h1 on the other
side of 0.5, the theme check above must hold, and on `/` only the expected
twin may show. `--text-scale`
makes text bigger or wider at 320, 360 and 390 px three ways: html
font-size 115%, WCAG 1.4.12 text spacing (line height 1.5, letter 0.12em,
word 0.16em, paragraphs 2em apart), and the browser's own text size at 200%.
For each it checks only that the page doesn't overflow and that Cart, with
its count, shows in full inside the header nav. Playwright isn't a
dependency of the site: install it yourself (the script's hint is
`npm i -D playwright && npx playwright install chromium`; keep that out of
the commit) or point `PLAYWRIGHT_MODULE` at an existing install:

```bash
PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run check:layout > layout.log 2>&1 &
```

A run is 100 to 300 page loads and takes a few minutes, so run it in the
background. `render:brand` and `capture:tools` find Playwright the same way.

On 2026-11-25, after dark mode, every page passed 1815 runs in 13 runs of the
script:
- 153 each as it is, `--scheme dark`, `--scheme light --theme dark`,
  `--scheme dark --theme light`, `--scheme dark --checkout off` and
  `--scheme dark --slow-fonts`; 99 each with `--scheme dark --units 1` and
  `--scheme dark --units failed`. Overflow 0, header 61 px, layout shift
  0.000 (slow fonts included), smallest text 16 px, headings ok, no CSP
  errors, fold and photos in view. Worst text contrast 6.66:1 in light and
  7.65:1 in dark, both `--graphite` on `--panel` on
  `/projects/discover-cleaner`. Theme and print ok in every run; pairs ok in
  every run (never the other theme's twin fetched, at most one twin shown);
  the ring ok in both passes ("ok / forced ok") in all 52 runs that have it.
- 315 each with `--text-scale` in light and with `--scheme dark`: overflow 0,
  Cart with its count in full in all 630, theme, pairs and print ok.
- 23 each with `--first-paint` and `--scheme light --theme dark`,
  `--scheme dark --theme light`, and `--scheme dark` (every page at
  390×844): all 69 already in the right theme with every module held back
  (body `#161616` for dark, `#ffffff` for light, the header still empty).

On 2026-11-26, after the verification fixes (`only light` for a chosen
Light, the footer radios after a reloading Back, the case page's capture
link and the wider "More views"), the same 13 runs passed again with the
same counts, plus `--scheme light --theme light` (153) and `--first-paint
--scheme light --theme light` (23): 2090 of 2090, html's `color-scheme`
`light only` wherever Light was chosen, print light in every run.

The same day, one-off Playwright checks (not committed): on
`/projects/drift-tester` with a stubbed pad, at 390 and 1280, each footer
choice redrew the plot (the canvas's own gridline pixel went between the
light and dark `--rule-c`, not only the CSS background); on `/` and
`/projects`, in all four device and choice combinations at 390 and 1280,
exactly one chiptune file was requested, the right one; with JavaScript off
on a dark device, `/` and `/projects/chiptune` were dark (`#161616`, the dark
`theme-color` keeping its media, `color-scheme` "light dark", only
`.for-dark` shown on `/`), and both twins downloaded on `/` as expected; and
`page.pdf()` of `/order-complete`, `/case?id=chiptune` and
`/shipping-returns` from a dark device with Dark chosen gave dark text on
white, with the light chiptune capture. Chromium loads every lazy image when
it prints, both twins included. One caution: reading styles under
`emulateMedia({ media: "print" })` before `page.pdf()` changed which
`<source>` Chromium had picked, and from a dark screen the case page then
printed an empty 12 px frame (3 runs of 3; the same steps from a light
screen printed the capture). The plain `page.pdf()` printed it every time.
Nobody has checked a real browser's print preview from a dark screen.

Measured in Chromium only: the image pairing (lazy images in a hidden
`<picture>` never fetched) and the first paint. Firefox and Safari should
skip a hidden lazy image too, but nobody has measured it; if one fetches
both, the cost is one extra 7 to 20 KB image on a page with a pair. The
back/forward-cache catch-up in `theme.js` is tested only in `node:vm`
(`test/theme-core.test.js`): Playwright runs Chromium with that cache off.

check:layout never touches a Function, D1 or R2. Look at changes to those
under `npm run dev`: on 2026-11-25 there, `/product?id=ro-0042` carried
`unit-status` `available` and `checkout` `off` and offered "Email to buy this
unit", the cart answered checkout with the "isn't switched on yet" notice,
and `/case?id=discover-cleaner` (and its old alias) got its own head and
canonical. Before the redesign the bench-unit pages were checked the same way
(390 px wide, real CSP, local D1 + R2): the merged grid, the product gallery,
escaped copy, a sold unit's page, a cart with a gone unit, and the
static-only fallback when `/api/store/listings` fails.

## Outstanding — needs a browser or an account

These are why a local session is more useful than a cloud one:

1. **Stripe is not connected.** `SETUP.md` step 3 onward. Until
   `STRIPE_SECRET_KEY` is set as a Pages secret, every product head carries
   `<meta name="checkout" content="off">` and the page offers "Email to buy
   this unit" by itself in place of Add to cart; a cart that still reaches
   checkout gets "Online checkout isn't switched on yet" (the checkout
   Function answers `code: "not_configured"`). Both stop by themselves once
   the secret is set and the site redeployed. Bench units still show on the
   store meanwhile. Stripe returns buyers to `/order-complete?session_id=`
   and `/checkout-cancelled`, and a buyer who cancels gets "Return to your
   checkout" while their hold lasts (`assets/checkout-return.js`). Possible
   follow-up, not built: expire the Stripe session on cancel, so the hold
   ends at once instead of after about 30 minutes. Live bench stock's Cloudflare side was set up
   on 2026-11-23 from the owner's PC: R2 bucket `dhole-store-images` created,
   `1001_store.sql` applied `--remote` (`store_listings` / `store_sales` exist
   in the live `dhole-workshop`), `BENCH_TOKEN` set as a Pages production
   secret, and RefurbOS's `.env` has the matching `STORE_URL` / `STORE_TOKEN`.
   Still to do: the Stripe webhook and `STRIPE_WEBHOOK_SECRET` once Stripe
   exists (`SETUP.md`, "Live bench stock"). The first Pages build of this
   branch failed ("Deploy failed") before the bucket existed; the binding
   needs the bucket to exist before a deploy. `migrations/1002_store_images.sql`
   (photo sizes for link previews) is not applied remotely yet: after the
   redesign deploys, run `npx wrangler d1 migrations apply dhole-workshop
   --remote`. The code works without it; product previews just don't declare
   a size or swap in `og-site.png` for small photos until then.
2. **`SSL_ERROR_NO_CYPHER_OVERLAP`** was seen on a `*.pages.dev` preview URL in
   Firefox. Untriaged — most likely antivirus TLS scanning or a Firefox TLS
   setting, but nobody has actually loaded the production URL to check.
3. **The shelf is only as full as RefurbOS makes it.** The drawn placeholder
   items came off sale on 2026-11-25; the owner is entering the real consoles
   as bench units. Until some are listed, the store shows an empty shelf that
   asks for a request by email and points at the drift tester, and the
   homepage's Store row says "Nothing listed right now" (by design, with held
   height so nothing jumps).
4. **Search and shop accounts aren't set up.** Verify dhole.dev in Google
   Search Console (a Domain property, via a TXT record in Cloudflare DNS),
   submit `/sitemap.xml`, and add the shop to Google Merchant Center (free
   listings) once Stripe is live. After the next production deploy, view the
   source of a `/product?id=` page and a `/case?id=` page and confirm
   Cloudflare injected the Web Analytics beacon into each Function's response
   as it does for static pages. Then paste product links (available, on hold,
   sold, withdrawn, unknown) into a chat to check the previews.
   `SETUP.md`, "Search and measurement".
5. **Policy gaps.** `SUPPORT_EMAIL` is `support@dhole.dev` (Cloudflare Email
   Routing forwards it to the owner). The only return term is
   `RETURNS.console` ("If a console doesn't power on, there's a 30-day return
   window."), shown word for word under every console's buy action (bench
   units included), in the cart and on `/shipping-returns`. Accessories have
   no stated return terms (`RETURNS.accessory` is `null`).
6. **Delayed payment methods would lose bench sales.** A bank debit completes
   a Checkout Session with `payment_status: "unpaid"` and settles later; the
   webhook only records paid sessions (the contract), so keep such methods off
   in Stripe's payment-method settings while bench units are on sale.
7. **Design decisions waiting on the owner.** Each renders well while open:
   - Now: don't list units from RefurbOS on the live site until the redesign
     merges, or merge first. Today a listed unit shows Add to cart on the old
     site, and checkout fails with "Checkout is not configured." (SETUP.md,
     "When does a unit appear on the site?").
   - Before the merge: look at the preview at 390 and 1280 px, and accept or
     reject the departures from earlier requests (the homepage headline, the
     nav's section names Store, Tools, Portfolio and Cart, no hero buttons,
     the build log kept off the nav and footer, ink money buttons). Each is a
     line or two to revert.
   - Before the merge: look at the preview in both themes at 390 and 1280 px
     (the footer's Theme choice, or the device setting). Accept dark as
     shipped (it follows the device, plus the footer choice), or ask for it
     to be choice-only: delete the two
     `@media screen and (prefers-color-scheme: dark)` blocks in `site.css`
     (the tokens and the pair rules) and update the design guard's dark-block
     rule.
   - Before the merge: answer what "a skosh light" meant, with the
     side-by-side screenshots (as built, and with body text at weight 420).
     Sparse pages: this build is the answer. Thin or pale text: a one-line
     follow-up, `body { font-weight: 420 }` in `site.css` (both themes;
     Public Sans is variable, so 420 renders as 420), with `npm test` and a
     light `check:layout` run. `.case-pitch` (portfolio.css) and the shipping
     table's row labels (`.info-section tbody th`, info.css) set 400
     themselves, so move them with it. Glare: point them at the footer's Dark
     choice.
   - With 3 to 5 real units listed: compare a `/product?id=` page in both
     themes. In dark, light-backdrop photos and the off-white Add to cart are
     both bright blocks: decide whether the button still leads. If not, a
     dark-only neutral `--buy-bg` one step brighter than `--ink`, or a
     mid-grey photo backdrop. Never dim or tint the photos.
   - `data/owner.js`: a first name (it turns on "Who you're buying from") and
     a place, one sentence in the owner's words, a real photo; `fullName` and
     the portfolio `profile` (email, résumé, LinkedIn). Then
     `npm run sync:owner`. Without any real photo the site is honest but
     nearly all type on white.
   - `RETURNS`: window, coverage, accessory terms, return postage,
     change-of-mind returns and a reply time, before Stripe goes live.
   - The money buttons' colour: amber only if yellowing reads the same
     beside it as beside ink, tested with real units, in both themes.
   - Whether every controller is run through the drift tester before it's
     listed (if so, the "measured here first" line can return).
   - Whether to say every unit works fully and the condition line is only
     about looks; whether sold pages keep photos, show a price or get a
     "Recently sold" strip (that needs a new public read).
   - Whether `/case` pages go in the sitemap, whether `/tools` becomes an
     alias of `/projects`, and whether `/log` stays.
   - Optional: the record heading "Record" as "My notes" if the RefurbOS
     notes are written in the first person.
8. **The drift tester capture: a follow-up session with the owner's
   controller.** The drift tester's row on home and `/projects` stays
   text-only (and `test/tools.test.js` keeps "the drift tester has no shot")
   until there is a capture made with a real controller. When the owner has
   a controller at the PC, one session builds `npm run capture:tools drift`
   with them, the owner runs it, and the same session wires it in. Rules for
   that session:
   - **Real pad only.** Headed Chromium (`launch({ headless: false })`) on
     `/projects/drift-tester` from `scripts/lib/static-server.mjs`. Wait up to
     120 s for `navigator.getGamepads()` to report a connected pad (headed
     Chromium exposes a pad only after a button press, so the prompt says to
     press one). With none, exit 2 with "No controller connected. This
     capture needs a real controller; nothing was written." No stub, flag,
     fallback or `addInitScript` on the Gamepad API.
   - **The twins are two moments of one session, not one frame.** Take the
     light frame, then `dholeTheme.set("dark")`, two animation frames, and
     the dark frame, seconds apart. The live dot's jitter differs between
     them, and the trail has usually collapsed onto the rest point by the
     time "Measure rest" has run. Say so in the script's header comment, and
     don't assert that the pair matches pixel for pixel.
   - **The alt describes what the frame shows.** Name the controller from
     the pad's `id` and the readings that are visible; mention a trail only if
     one shows in the kept frame (for example "The drift tester's plots for a
     Wireless Controller after Measure rest, with the stick's rest offset
     marked").
   - **The visible caption names it as the owner's own controller**, not a
     unit for sale (for example "My own controller on the drift tester"), so
     its numbers never read as a measured unit on the shop.
   - **Outputs and wiring.** `assets/home/drift.webp` and `drift-phone.webp`
     with `-dark` twins at identical sizes; then `data/projects.js` `shot`
     with `dark`, the home drift row's pair in `index.html`, optionally the
     portfolio's drift entry, and deliberately removing `tools.test.js`'s
     "the drift tester has no shot" guard, with a comment.
   - Until then the owner can send an ordinary screenshot instead (SETUP.md,
     "A picture of the drift tester working"), which a session crops and
     wires the same way.

## Deploying

`SETUP.md` is the full guide — DNS, Stripe, secrets, going live, and the
one-time CI settings ("Tests and CI": make the `test` check required on
`main`).

# dhole.dev

Personal site with two halves: **browser-playable projects** and a **store for
refurbished retro consoles**. Static site plus one serverless function, hosted
on Cloudflare Pages.

Most shop traffic arrives by direct link rather than through the homepage.

## Commands

```bash
npm test                          # 16 checkout tests + the Discover Cleaner and league-ify checks
npm run dev                       # wrangler pages dev . (runs the Function too)
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
| `store.html`, `product.html`, `cart.html` | Shop |
| `log.html` | Week-by-week build log |
| `portfolio.html`, `case.html` | Portfolio grid, and one templated case-study page (`case.html?id=`) for job applications |
| `data/portfolio.js` | Portfolio content — one block per project, drives both pages |
| `data/products.js` | Catalogue — prices, stock, copy |
| `data/projects.js` | Project list |
| `functions/api/checkout.js` | Stripe Checkout, as a Pages Function |
| `lib/checkout-core.js` | Order pricing, shared with the tests |
| `assets/entry/` | Per-page entry modules |
| `projects/league-ify/` | league-ify SPA — **built output, vendored** (see below) |
| `functions/api/league-ify/[[path]].js` | league-ify API (accounts + data), one bundled Pages Function — **vendored** |
| `migrations/0001_league_ify.sql` | league-ify's D1 tables (`documents`, `matches`, `lu_users`, `lu_sessions`) |

**league-ify is vendored, not written here.** Its source is the
`Dholeson/league-ify` repo. Don't hand-edit `projects/league-ify/` or the
`[[path]].js` bundle — rebuild from a league-ify checkout with
`node scripts/build-site.mjs <path-to-this-site>` and commit the result. It
needs `nodejs_compat` and the `DB` (D1) binding in `wrangler.toml`.

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
runtime, silently, in production but not in a plain local file server.

**Two paths have their own CSP**, each for a vendored app whose images come
from a CDN:

- `/projects/discover-cleaner-demo/*` shows album covers from Spotify's image
  CDN, so its policy is the global one plus `https://i.scdn.co` in `img-src`.
- `/projects/league-ify/*` shows champion art from Riot's Data Dragon and
  fetches its `versions.json`, so its policy is the global one plus
  `https://ddragon.leagueoflegends.com` in `img-src` and `connect-src`.

Nothing else differs from the global policy. In `_headers` each rule first
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

**Stock does not decrement itself.** It is a number in `data/products.js`.
Two people buying the last console minutes apart both succeed. Known and
documented in `SETUP.md`; Cloudflare KV is the upgrade path.

## Testing

`npm test` covers the money path, both CSP exceptions in `_headers`, the
vendored demo bundle, and the vendored league-ify build and its config
(`nodejs_compat`, the `DB` binding, the migration). The demo's bundle checks
skip, with a note, while `projects/discover-cleaner-demo/` is missing. There is also a Playwright suite that has
been run against the site (39 checks: both demos driven for real, cart totals,
mobile overflow, link previews) but it is not committed — reproduce it if you
change rendering.

## Outstanding — needs a browser or an account

These are why a local session is more useful than a cloud one:

1. **Stripe is not connected.** `SETUP.md` step 3 onward. Until
   `STRIPE_SECRET_KEY` is set as a Pages secret, checkout returns a clear
   "not configured" error rather than failing silently.
2. **`SSL_ERROR_NO_CYPHER_OVERLAP`** was seen on a `*.pages.dev` preview URL in
   Firefox. Untriaged — most likely antivirus TLS scanning or a Firefox TLS
   setting, but nobody has actually loaded the production URL to check.
3. **Product images are illustrations, not photographs** of the real units.
   Buyers of used hardware expect real photos. Swap before taking real money.

## Deploying

`SETUP.md` is the full guide — DNS, Stripe, secrets, going live.

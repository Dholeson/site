# dhole.dev

Personal site with two halves: **browser-playable projects** and a **store for
refurbished retro consoles**. Static site plus one serverless function, hosted
on Cloudflare Pages.

Most shop traffic arrives by direct link rather than through the homepage.

## Commands

```bash
npm test                          # 16 checkout tests
npm run dev                       # wrangler pages dev . (runs the Function too)
npx wrangler pages deploy .       # deploy
```

There is no build step. Edit files, deploy.

## Layout

| Path | What |
|---|---|
| `index.html` | Homepage hub |
| `projects.html`, `projects/` | Project index and the playable demos |
| `store.html`, `product.html`, `cart.html` | Shop |
| `log.html` | Week-by-week build log |
| `data/products.js` | Catalogue — prices, stock, copy |
| `data/projects.js` | Project list |
| `functions/api/checkout.js` | Stripe Checkout, as a Pages Function |
| `lib/checkout-core.js` | Order pricing, shared with the tests |
| `assets/entry/` | Per-page entry modules |

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

**Stock does not decrement itself.** It is a number in `data/products.js`.
Two people buying the last console minutes apart both succeed. Known and
documented in `SETUP.md`; Cloudflare KV is the upgrade path.

## Testing

`npm test` covers the money path. There is also a Playwright suite that has
been run against the site (39 checks: both demos driven for real, cart totals,
mobile overflow, link previews) but it is not committed — reproduce it if you
change rendering.

## Outstanding — needs a browser or an account

These are why a local session is more useful than a cloud one:

1. **Cloudflare production branch is wrong.** It is set to
   `claude/dhole-dev-store-setup-zy5lp7`, so deploys from `main` land as
   previews rather than production. Fix in the dashboard:
   Workers & Pages → dhole-dev → Settings → Build & deployments.
2. **The deployed site is stale.** It predates the favicon, link previews,
   404 page, and the wrangler 4 upgrade. Needs a redeploy.
3. **Stripe is not connected.** `SETUP.md` step 3 onward. Until
   `STRIPE_SECRET_KEY` is set as a Pages secret, checkout returns a clear
   "not configured" error rather than failing silently.
4. **`SSL_ERROR_NO_CYPHER_OVERLAP`** was seen on a `*.pages.dev` preview URL in
   Firefox. Untriaged — most likely antivirus TLS scanning or a Firefox TLS
   setting, but nobody has actually loaded the production URL to check.
5. **Product images are illustrations, not photographs** of the real units.
   Buyers of used hardware expect real photos. Swap before taking real money.

## Deploying

`SETUP.md` is the full guide — DNS, Stripe, secrets, going live.

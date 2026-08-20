# Setting up dhole.dev

The site is built and tested. What is left needs **your** accounts — nobody else
can create a Stripe account or change your DNS.

Rough time: **45–60 minutes**, most of it waiting on Stripe verification.

---

## What is here

```
index.html            Homepage — sends people to either half
projects.html         Project index
projects/             The playable demos (one .html + .js each)
store.html            Storefront
product.html          Product detail
cart.html             Cart
log.html              Build log
data/products.js      Catalogue: prices, stock, copy
data/projects.js      Project list
functions/api/        Checkout, as a Cloudflare Pages Function
lib/checkout-core.js  Order pricing (shared by the function and its tests)
test/                 16 tests for the money path
```

---

## Why Cloudflare Pages

You already own the Cloudflare account that runs your DNS, so hosting there
means one vendor and one deploy. Two things that actually matter:

- **Checkout lives on your own domain** (`dhole.dev/api/checkout`) instead of a
  separate `workers.dev` subdomain, so there is no CORS to configure and
  nothing cross-origin to go wrong.
- **Deploys do not depend on GitHub.** `wrangler pages deploy` uploads straight
  from your machine, which matters right now because this session's GitHub App
  is refusing writes.

GitHub Pages would also work, but it cannot run `functions/`, so checkout would
have to move back to a standalone Worker on another domain.

---

## Step 1 — Deploy the site

```bash
npm install
npx wrangler login          # opens a browser to authorise Cloudflare
npx wrangler pages deploy .
```

First run asks for a project name — `dhole-dev` matches `wrangler.toml`.

You get a URL like `https://dhole-dev.pages.dev`. Open it. Everything except
checkout works immediately: the projects run, the catalogue browses, the cart
adds up.

---

## Step 2 — Point dhole.dev at it

In the Cloudflare dashboard: **Workers & Pages → dhole-dev → Custom domains →
Set up a custom domain** → `dhole.dev`. Repeat for `www.dhole.dev` if you want it.

Because Cloudflare already hosts your DNS, it creates the records itself — you
do not hand-edit anything.

Two things to know:

- **Remove the old GitHub Pages records first** if they exist: four `A` records
  on `@` pointing at `185.199.108–111.153`, and a `www` CNAME to
  `dholeson.github.io`. Leaving them alongside the Pages record gives you a
  domain that resolves to different hosts depending on the day.
- **Your registrar is not where you edit this.** GoDaddy (or whoever) only
  renews the name; if its nameservers point at Cloudflare, then Cloudflare is
  the only DNS panel that does anything. `dig NS dhole.dev +short` settles it.

> I could not check your live DNS from the build container — outbound DNS and
> HTTPS are blocked there — so compare the above against what you actually see.

The `CNAME` file in this repo is only read by GitHub Pages. Cloudflare ignores
it. It is kept so GitHub Pages stays available as a fallback.

---

## Step 3 — Create the Stripe account

At <https://dashboard.stripe.com/register>. Stripe wants your legal name or
business details, a bank account for payouts, and tax information. This is the
part I genuinely cannot do for you.

Staying in **test mode**, copy the test secret key from **Developers → API
keys** (it starts with `sk_test_`).

> Never put a secret key in this repo. It goes in a Pages secret in the next
> step. Anyone holding that key can charge cards and issue refunds.

---

## Step 4 — Give the site the key

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY
```

Paste the `sk_test_…` key. It is stored encrypted and injected into the
function at runtime; it never reaches a browser and never lands in git.

Redeploy so the function picks it up:

```bash
npx wrangler pages deploy .
```

---

## Step 5 — Test with a fake card

Card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. Run one
full order and check:

- the totals on the Stripe page match the cart
- shipping is $18.00 with a console in the order, $6.00 for accessories only
- you land on `/order-complete.html` and the cart is now empty
- the payment shows up in your Stripe dashboard

Also press Back on the Stripe page once and confirm you land on
`/checkout-cancelled.html` **with the cart still intact**.

---

## Step 6 — Go live

1. Complete Stripe account activation, then leave test mode.
2. Copy the live key (`sk_live_…`).
3. Replace the secret and redeploy:
   ```bash
   npx wrangler pages secret put STRIPE_SECRET_KEY
   npx wrangler pages deploy .
   ```

Buy something cheap on your own card and refund yourself. It is the only way to
know the live path works.

---

## Running it day to day

### Add or edit a product

All in `data/products.js`. Copy a block, give it a new unique `id`, deploy.
The storefront, the cart, and the checkout function all read that one file, so
there is nothing to keep in sync.

Prices are **integer cents** — `14500` is $145.00. Deliberate: floating-point
money quietly mischarges people.

### When something sells

Drop its `stock` and deploy. At `stock: 0` it shows as sold out and the
checkout function refuses it even if it is sitting in someone's old cart.

### Branding

The favicon and the link-preview card live in `assets/brand/`. The preview card
(`og.png`, 1200x630) is what shows up when someone pastes a dhole.dev link into
a chat or a post — worth regenerating if you change the tagline. It was rendered
from a plain HTML page, so it can be rebuilt the same way rather than opening a
design tool.

### Add a project

1. Drop `projects/my-thing.html` and `projects/my-thing.js` in.
2. Add an entry to `data/projects.js` pointing `demo` at the page.

It appears on both the projects index and the homepage. Anything without a
`demo` is listed as write-up only rather than looking clickable.

### Local preview

```bash
npm run dev     # wrangler pages dev . — runs the function too
npm test        # the 16 checkout tests
```

---

## Limitations you should know about

**Inventory does not decrement itself.** Stock is a number in a file. If two
people buy your last GameCube minutes apart, both payments succeed and you have
oversold. At stock 2–3, that is a real risk rather than a theoretical one.

Cheapest fix: update `stock` promptly. Proper fix: move stock into
**Cloudflare KV** and decrement it inside the checkout function — maybe an
hour's work on top of what is here, worth it past a few units a week.

**Sales tax is off by default.** `ENABLE_AUTOMATIC_TAX` in `wrangler.toml` is
`"false"`, because Stripe Tax rejects sessions until you have set an origin
address and tax registrations. Configure Stripe Tax first, then flip it and
redeploy. Whether you owe sales tax at all is a question for an accountant.

**No order system beyond Stripe.** Stripe emails the customer a receipt and
emails you a notification; you fulfil from the Stripe dashboard. Reasonable at
this scale.

**Shipping is flat-rate per box size.** Console-sized or accessory-sized, and
the largest item in the order decides. No weight-based or international rates.

**The product images are illustrations, not photographs.** For used hardware,
buyers expect photos of the actual unit, and some marketplaces require it. Swap
them in before taking real money: drop files in `assets/store/` and point each
product's `image` at them.

---

## Security notes

- The Stripe key lives only in a Pages secret. Never in this repo, never sent
  to a browser.
- The browser sends **only ids and quantities** to checkout. The function
  prices the order from its own copy of the catalogue, so editing the cart in
  devtools changes what you order, never what it costs. `test/checkout.test.js`
  covers exactly that attack.
- `_headers` sets a content security policy with no `unsafe-inline` for
  scripts. That is why no page has an inline `<script>` — each one loads an
  entry module from `assets/entry/` instead. If you add a page, follow the same
  pattern or the CSP will block it.
- The old `admin.html` is gone. It had a password hardcoded in client-side
  JavaScript in a public repo, which protected nothing, and it guarded a
  notes editor that only ever wrote to the visitor's own browser.

---

## Testing

```bash
npm test
```

16 checks over price tampering, stock limits, malformed carts, duplicate lines,
shipping selection, and Stripe payload construction.

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
data/products.js      Hand-made catalogue: prices, stock, copy
data/projects.js      Project list
functions/api/        Checkout, the bench API, the public store API and the
                      Stripe webhook, as Cloudflare Pages Functions
lib/                  Order pricing, live bench stock (D1), Stripe signatures
migrations/           D1 tables: league-ify's (0001) and the store's (1001)
test/                 Tests for the money path and the live bench stock
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

Once the bench is connected ("Live bench stock" below), run one more order
with a bench unit in it. After paying, the unit disappears from the store and
the bench app's next sync records the sale. A checkout abandoned on Stripe's
page holds its unit until Stripe expires the session, about half an hour, and
then the unit is back on sale.

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

## Live bench stock (the bench app, RefurbOS)

The bench app on the workshop PC can put each refurbished unit on this store
with its real photos, and take it down again when it sells elsewhere. When a
unit sells here, the bench app picks up the sale (buyer, address, amount) on
its next sync. The units live in the site's D1 database and the photos in an
R2 bucket, both on your Cloudflare account.

**Done on 2026-11-23:** the R2 bucket, the remote D1 migration, the
`BENCH_TOKEN` secret and RefurbOS's `.env` (steps 1–3 below). Only the Stripe
webhook (step 4) is left, once Stripe is connected. The bucket must exist
before any deploy: `wrangler.toml` binds it, and a build without it fails.

**Stripe still isn't connected** (steps 3–6 above). Until it is, bench units
show on the store like everything else, but pressing Checkout says
"Checkout is not configured." Nothing is held or charged.

These are one-time steps. Run them from this folder, signed in with
`npx wrangler login`.

### 1. Create the photo bucket

```bash
npx wrangler r2 bucket create dhole-store-images
```

The name must be exactly that: `wrangler.toml` binds it as `STORE_IMAGES`. If
Cloudflare asks you to enable R2 on the account first, do that in the
dashboard (**R2 Object Storage**); the free allowance is far more than a few
hundred photos.

### 2. Create the store's tables

```bash
npx wrangler d1 migrations apply dhole-workshop --remote
```

It lists what it will apply (the store's `1001_store.sql`, plus league-ify's
`0001_league_ify.sql` if that hasn't run yet) and asks before it does
anything. Use this command, not `d1 execute`: it records what ran, so it is
safe to run again.

### 3. Give the bench app a key

Make a long random token. Either of these prints 64 random characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
openssl rand -hex 32
```

Store it as a Pages secret, pasting it at the prompt:

```bash
npx wrangler pages secret put BENCH_TOKEN
```

Then, on the workshop PC, put the same token in the bench app's `.env`:

```
STORE_URL=https://dhole.dev
STORE_TOKEN=<the same token>
```

The store refuses everything from the bench until `BENCH_TOKEN` is set, and a
token under 32 characters counts as not set. Keep the token out of git, chat
and email.

### 4. Tell the store when Stripe payments finish (after Stripe step 3)

This needs the Stripe account. In the Stripe dashboard open
**Developers → Webhooks** and add an endpoint (Stripe may call it an *event
destination*):

- URL: `https://dhole.dev/api/stripe/webhook`
- Events: `checkout.session.completed` and `checkout.session.expired`
  (nothing else is needed)

Stripe then shows a **signing secret** starting `whsec_`. Store it:

```bash
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
```

Test mode and live mode have separate endpoints and separate signing secrets.
When you go live (step 6), add the endpoint again in live mode and replace
`STRIPE_WEBHOOK_SECRET` with the live one.

While bench units are on sale, leave bank-debit payment methods (ACH Direct
Debit and the like) off in **Settings → Payment methods**. They finish
checkout before the money arrives, and the store only records paid sales.
Cards, Apple Pay, Google Pay and Link are fine.

### 5. Redeploy, then check

Secrets and the new bucket reach the site on its next deployment: merge to
`main`, or `npx wrangler pages deploy .`. Then:

```bash
curl -H "Authorization: Bearer <your token>" https://dhole.dev/api/bench/listings
```

- `{"listings":[]}`: ready. Turn on "Also on dhole.dev" in the bench app.
- `503 Bench API is not configured.`: `BENCH_TOKEN` is missing or too short,
  or the site hasn't been redeployed since you set it.
- `401`: the token you sent isn't the one stored.

### Testing the bench app against a local copy

To try the whole loop on one machine without touching the real store:

```bash
npx wrangler d1 migrations apply dhole-workshop --local
```

Create `.dev.vars` in this folder (it is gitignored) with local-only values:

```
BENCH_TOKEN=<any 32+ characters, not the production token>
STRIPE_WEBHOOK_SECRET=whsec_local_anything
```

Then `npm run dev` serves the site at `http://localhost:8788` with a local D1
and a local R2 (under `.wrangler/state`). In the bench app's `.env`, set
`STORE_URL=http://localhost:8788` and `STORE_TOKEN` to the same local token.
If the bench app runs on another computer, start the site with
`npm run dev -- --ip 0.0.0.0` and use this machine's address instead.

Checkout locally says "not configured" unless you also add a **test-mode**
`STRIPE_SECRET_KEY=sk_test_...` to `.dev.vars`; with Stripe's CLI,
`stripe listen --forward-to localhost:8788/api/stripe/webhook` prints the
`whsec_` value to use for `STRIPE_WEBHOOK_SECRET`.

> `.dev.vars` is kept out of git, but a manual `npx wrangler pages deploy .`
> uploads every file in this folder, `.dev.vars` included, where anyone could
> download it. Never put a production secret in it, and move it out of the
> folder before a manual deploy. Deploys from GitHub never see it.

---

## Running it day to day

### Add or edit a product

Refurbished units come from the bench app; you never add those here. For
hand-made items it's all in `data/products.js`. Copy a block, give it a new
unique `id` (never one like `ro-0042`, which is the bench's), deploy.
The storefront, the cart, and the checkout function all read that one file, so
there is nothing to keep in sync.

Prices are **integer cents** — `14500` is $145.00. Deliberate: floating-point
money quietly mischarges people.

### When something sells

**A refurbished unit from the bench:** nothing to do here. The store marks it
sold, and the bench app picks the sale up on its next sync.

**A hand-made item from `data/products.js`:** drop its `stock` and deploy. At
`stock: 0` it shows as sold out and the checkout function refuses it even if it
is sitting in someone's old cart.

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
npx wrangler d1 migrations apply dhole-workshop --local   # once, and after new migrations
npm run dev     # wrangler pages dev . — Functions, a local D1 and a local R2
npm test        # the money path, the live bench stock, the vendored apps
```

To point the bench app at your local copy, see "Testing the bench app against
a local copy" below.

---

## Limitations you should know about

**Hand-made items' stock does not decrement itself.** For anything in
`data/products.js`, stock is a number in a file. If two people buy your last
GameCube minutes apart, both payments succeed and you have oversold. At stock
2–3, that is a real risk rather than a theoretical one. Cheapest fix: update
`stock` promptly.

**Refurbished units from the bench don't have that problem.** Each is one
listing in the database. Checkout puts the unit on hold before sending the
buyer to Stripe, so a second buyer is told it's on hold; the sale is recorded
when Stripe says it's paid. The hold lasts about half an hour, the same as the
Stripe checkout page. The one gap: if a payment finishes in the last seconds
of a hold just as someone else starts checking out, both can pay. The bench app
flags that as "sold twice" so you can refund one.

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
  to a browser. So do `BENCH_TOKEN` and `STRIPE_WEBHOOK_SECRET`.
- The bench API (`/api/bench/...`) refuses every request until `BENCH_TOKEN`
  is set to at least 32 characters, and then answers only requests carrying
  it. Anyone holding the token can put listings on your store, so treat it
  like a password: if it leaks, set a new one here and in the bench app.
- The Stripe webhook only believes events signed with `STRIPE_WEBHOOK_SECRET`
  and at most five minutes old, so nobody can mark a unit sold by posting to
  it.
- Bench photos are re-encoded by the bench app before upload, with no EXIF
  data, so a phone photo's GPS position (your workshop) is never published.
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

Checks over price tampering, stock limits, malformed carts, duplicate lines,
shipping selection and Stripe payload construction; the bench API, the public
store API, bench-unit holds and the Stripe webhook against a real SQLite
standing in for D1; and the vendored Discover Cleaner and league-ify builds.

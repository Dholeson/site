# Store setup

The store itself is built and working. What is left is the handful of steps that
need **your** accounts — nobody but you can do these, because taking money
requires an identity, a bank account, and DNS control.

Rough time: **45–60 minutes**, most of it waiting on Stripe verification.

---

## What is already done

| | |
|---|---|
| Storefront with search, filters, and sorting | `store.html` |
| Product pages | `product.html` |
| Cart with live totals and shipping | `cart.html` |
| Post-payment and cancelled pages | `order-complete.html`, `checkout-cancelled.html` |
| Product catalogue (prices, stock, copy) | `data/products.js` |
| Checkout server | `worker/src/index.js` |
| Custom domain file for GitHub Pages | `CNAME` |

Until you finish Step 3, the store works as a **browsable catalogue** and the
checkout button says plainly that payments are not switched on yet. It never
silently fails or takes an order it cannot fulfil.

---

## Step 0 — Find out where your DNS actually lives

You said "GoDaddy I think, routed through Cloudflare." Those are two different
jobs and it matters which one you edit:

- **Registrar** (probably GoDaddy) — who you renew the domain with.
- **DNS host** (Cloudflare) — where the records actually resolve from.

If Cloudflare is in front, GoDaddy will show its nameservers pointing at
Cloudflare (something like `xxx.ns.cloudflare.com`), and **all record edits
happen in Cloudflare, not GoDaddy.** Editing GoDaddy's DNS panel in that case
does nothing at all — a very common hour-long confusion.

To confirm, run:

```bash
dig NS dhole.dev +short
```

Cloudflare nameservers in the output → do everything below in the **Cloudflare**
dashboard.

---

## Step 1 — Point dhole.dev at GitHub Pages

> I could not verify your current DNS from the build container (outbound DNS and
> HTTPS are blocked there), so treat this as the target state and compare it
> against what you actually see.

In **Cloudflare → DNS → Records**, you want:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| CNAME | `www` | `dholeson.github.io` | DNS only |

Two things people get wrong here:

1. **Set the proxy to "DNS only" (grey cloud) at first.** With the orange cloud
   on, GitHub cannot complete its certificate check and you get an SSL error
   loop. Turn the proxy back on later if you want it, and only once GitHub
   reports the certificate as issued.
2. **In Cloudflare → SSL/TLS, set the mode to "Full".** "Flexible" causes an
   infinite redirect loop with GitHub Pages.

Then in **GitHub → your repo → Settings → Pages**:

- Source: deploy from `main`
- Custom domain: `dhole.dev`
- Tick **Enforce HTTPS** (it may take a few minutes to become available)

I added a `CNAME` file to the repo, which is the half of this that GitHub reads.
Note there was **no `CNAME` file on `main` before**, which suggests `dhole.dev`
was not actually serving this repo yet — worth checking before you assume the
domain already works.

DNS changes can take anywhere from a minute to a few hours.

---

## Step 2 — Create the Stripe account

At <https://dashboard.stripe.com/register>. Stripe will want your legal name or
business details, a bank account for payouts, and tax information. This is the
part I genuinely cannot do for you.

While in **test mode**, grab your test secret key from
**Developers → API keys** (it starts with `sk_test_`).

> Never put a secret key in this repo. It goes in a Cloudflare secret in the
> next step. Anyone holding that key can charge cards and issue refunds.

---

## Step 3 — Deploy the checkout Worker

From the `worker/` folder:

```bash
cd worker
npm install
npx wrangler login          # opens a browser to authorise Cloudflare

# Paste your sk_test_... key when prompted. Stored encrypted, never in git.
npx wrangler secret put STRIPE_SECRET_KEY

npx wrangler deploy
```

Deploy prints a URL like
`https://dhole-store-checkout.<your-subdomain>.workers.dev`.

Put that URL — **with `/checkout` on the end** — into `assets/store-config.js`:

```js
export const CHECKOUT_ENDPOINT = "https://dhole-store-checkout.<your-subdomain>.workers.dev/checkout";
export const SUPPORT_EMAIL = "you@example.com";
```

Commit and push. The store is now live in test mode.

---

## Step 4 — Test with a fake card

Stripe's test card is `4242 4242 4242 4242`, any future expiry, any CVC, any
postcode. Run one full order end to end and check:

- the totals on the Stripe page match the cart
- shipping shows as $18.00 for a console, $6.00 for accessories only
- you land back on `order-complete.html` and the cart is now empty
- the payment appears in your Stripe dashboard

Also worth doing once: hit "Back" on the Stripe page and confirm you land on
`checkout-cancelled.html` **with your cart still intact**.

---

## Step 5 — Go live

1. In Stripe, complete account activation, then switch off test mode.
2. Get the **live** key (`sk_live_...`) from Developers → API keys.
3. Replace the secret and redeploy:
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY   # paste the sk_live_ key
   npx wrangler deploy
   ```

Do a real purchase of something cheap on your own card, then refund yourself. It
is the only way to know the live path actually works.

---

## Running the store day to day

### Adding or editing a product

Everything is in `data/products.js`. Copy an existing block, give it a new
unique `id`, and push. The storefront, the cart, and the checkout server all
read from that one file, so there is nothing to keep in sync.

Prices are in **integer cents** — `14500` is $145.00. This is deliberate:
floating-point money quietly mischarges people.

### When something sells

Decrease its `stock` and push. At `stock: 0` it shows as sold out, and the
checkout server refuses it even if someone has it sitting in an old cart.

---

## Limitations you should know about

**Inventory does not decrement itself.** Stock is a number in a file. If two
people buy your last GameCube within a few minutes of each other, both payments
succeed and you have oversold. With consoles at stock 2–3, this is a real risk,
not a theoretical one.

Your options, cheapest first:
- Update `stock` promptly after each sale (fine at low volume).
- Move stock into **Cloudflare KV** and have the Worker decrement it inside the
  checkout call. Maybe an hour of work on top of what is here — worth doing if
  you start selling more than a few units a week.

**Sales tax is off by default.** `ENABLE_AUTOMATIC_TAX` in `worker/wrangler.toml`
is `"false"`, because Stripe Tax rejects sessions until you have set an origin
address and tax registrations. Configure Stripe Tax first, then flip it to
`"true"` and redeploy. Whether you need to collect sales tax at all depends on
your state and turnover — a question for an accountant, not for me.

**No order emails beyond Stripe's receipt.** Stripe emails the customer a
receipt and emails you a notification. There is no separate order-management
system; you fulfil from the Stripe dashboard, which is entirely reasonable at
this scale.

**Shipping is a flat rate per box size.** Console-sized or accessory-sized, one
rate each, and the largest item in the order decides. No weight-based or
international calculation.

**The product photos are placeholder illustrations.** They are drawn to suit the
site's palette, but they are not photographs of the actual units you are
selling. For used and refurbished hardware, buyers expect real photos of the
real item, and some marketplaces require it — swap them in before you take real
money. Drop files into `assets/store/` and point each product's `image` at them.

---

## Security notes

- The Stripe secret key lives only in a Cloudflare secret. It is never in this
  repo and never sent to a browser.
- The browser sends **only product ids and quantities** to checkout. The Worker
  prices the order from its own copy of the catalogue, so editing the cart in
  devtools cannot change what anything costs. There is a test covering exactly
  this attack in `worker/test/checkout.test.js`.
- The Worker only accepts browser requests from the origins listed in
  `ALLOWED_ORIGINS` in `worker/wrangler.toml`.
- **Unrelated but worth fixing:** `admin.js` has a password (`weeklybuilds`)
  hardcoded in client-side JavaScript in a public repo. It protects nothing —
  anyone can read it in the file or bypass it from the console. It guards only
  local browser storage today, so nothing is currently at risk, but do not
  extend that page to touch anything that matters.

---

## Testing

```bash
cd worker && node test/checkout.test.js
```

14 checks covering price tampering, stock limits, malformed carts, duplicate
lines, and shipping selection.

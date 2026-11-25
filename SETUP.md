# Setting up dhole.dev

The site is built and tested. What is left needs **your** accounts — nobody else
can create a Stripe account or change your DNS.

Rough time: **45–60 minutes**, most of it waiting on Stripe verification.

---

## What is here

```
index.html            Homepage: what the site is, then Store, the tools and
                      Portfolio as one index
store.html            Storefront
product.html          Product detail (its <head> is filled per product by
                      functions/product.js)
cart.html             Cart
order-complete.html   Where Stripe sends a buyer who paid
checkout-cancelled.html  Where Stripe sends a buyer who cancelled
shipping-returns.html Shipping, returns, testing, payment, data
projects.html         Tools index ("Tools" in the nav)
projects/             The tools (one .html + .js each)
portfolio.html        Product case studies
case.html             One case study (its <head> is filled by functions/case.js)
log.html              Build log (not linked from the nav)
404.html              Not found
assets/site.css       The shared look, light and dark; each page group adds one
                      more stylesheet
assets/theme.js       Applies the visitor's Light or Dark choice before the
                      page draws
assets/fonts/         The two self-hosted fonts and their licences
assets/brand/         Link-preview cards and icons
data/products.js      Hand-made catalogue, plus the shipping rates and the
                      returns sentence every page uses
data/owner.js         Your name, place, a sentence and a photo (all empty today)
data/portfolio.js     Case studies, and your contact links for the portfolio
data/projects.js      The tools list
functions/api/        Checkout, the bench API, the public store API and the
                      Stripe webhook, as Cloudflare Pages Functions
functions/product.js  Each product's title, link-preview card and Google data
functions/case.js     Each case study's title and link-preview card
functions/sitemap.xml.js  The sitemap, live bench units included
lib/                  Order pricing, live bench stock (D1), Stripe signatures,
                      page heads
migrations/           D1 tables: league-ify's (0001) and the store's (1001,
                      1002)
scripts/              Dev scripts: owner sync, card rendering, tool captures,
                      the layout check (none of them is part of the site)
test/                 npm test: the money path, live bench stock, page heads,
                      the design rules, every page group, the vendored apps
.github/workflows/    CI: npm test on every push and pull request
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
checkout works immediately: the tools run and the store shows what the bench
app has listed. Until step 4, each product page offers "Email to buy this
unit" instead of Add to cart, so nobody starts a checkout that can't finish.

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

Turn on receipts: in **Settings → Customer emails**, switch on **Successful
payments**. The order-complete page and `/shipping-returns` both tell the
buyer that Stripe has emailed a receipt, and nothing in the checkout asks
Stripe to send one, so this setting is what makes that true. Stripe sends
these emails in live mode only; Step 6 checks one arrives.

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

Nothing else to switch. With the key set, `functions/product.js` stops
writing `<meta name="checkout" content="off">`, and product pages show Add to
cart again by themselves. `/shipping-returns` keeps saying online checkout
isn't switched on until you go live (Step 6, item 4): a test key can't take
real cards.

---

## Step 5 — Test with a fake card

Card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. Run one
full order and check:

- the totals on the Stripe page match the cart
- shipping is $18.00 with a console in the order, $6.00 for accessories only,
  and its label says it ships within two business days
- you land on `/order-complete` and the cart is now empty
- the payment shows up in your Stripe dashboard

Also press Back on the Stripe page once and confirm you land on
`/checkout-cancelled` **with the cart still intact**. With a bench unit in
the order, that page (and the unit's product page, and the cart) offers
"Return to your checkout", which reopens the same Stripe page while the hold
lasts. It is remembered in that browser only.

Once the bench is connected ("Live bench stock" below), run one more order
with a bench unit in it. After paying, the unit disappears from the store and
the bench app's next sync records the sale. A checkout abandoned on Stripe's
page holds its unit until Stripe expires the session, about 30 minutes, and
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

4. Take out the first paragraph of **Paying** in `shipping-returns.html`
   ("Online checkout isn't switched on yet. To buy a unit now, email…"), and
   the test in `test/info.test.js` that holds it there ("paying: until
   Stripe is connected…"). The rest of that section already reads right with
   checkout on. Product pages and the cart need nothing: they switched over
   by themselves in Step 4. Commit, and let the deploy run.

Buy something cheap on your own card and refund yourself. It is the only way to
know the live path works. Check that Stripe's receipt reaches your inbox: the
order-complete page promises one (Step 3, Customer emails).

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
show on the store like everything else, and each one's page offers "Email to
buy this unit" (an email to support@dhole.dev with the unit's id in the
subject) in place of Add to cart. A cart that still gets to Checkout says
online checkout isn't switched on yet. Nothing is held or charged.

**Not yet applied remotely:** `migrations/1002_store_images.sql`, which
records each photo's pixel size so a product's link preview can declare it
(and use the plain dhole.dev card when photo 1 is under 900 px wide). After
the redesign is deployed, run step 2's command once more; it applies only
1002. The site works without it, with previews as they were before.

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

It lists what it will apply (the store's `1001_store.sql` and
`1002_store_images.sql`, plus league-ify's `0001_league_ify.sql` if that
hasn't run yet) and asks before it does anything. Use this command, not
`d1 execute`: it records what ran, so it is safe to run again, and it is how
every later migration gets applied too.

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

### When does a unit appear on the site?

As soon as you move it to Listed in RefurbOS with "Also on dhole.dev" on, as
long as it has at least one JPEG photo and its copy passes the lint. Its own
page works within seconds, and the store page shows it within 30 seconds
more.

**What sends it.**
- Moving a unit to Listed on its List card with "Also on dhole.dev" on. That
  is the default, remembered per unit.
- "Put it on dhole.dev" (or "Update on dhole.dev") on its Listed card.
- A price change on a unit that is already on the site, which re-sends it by
  itself.
- Units you listed before the store was connected are never sent on their
  own. Use "Put it on dhole.dev" for those.

**How it gets there.** RefurbOS sends it straight away, in the background:
its outbox runs right after the click and every 30 seconds after that. It
uploads each photo first (a cleaned copy: rotation applied, long edge at most
1600 px, no location data), then the listing. If the site can't be reached it
tries again, waiting from 30 seconds up to an hour between tries. It stops,
with a "failed" row on its /listing page (Retry or Dismiss), when:
- the copy fails its lint;
- no photo is usable: HEIC and WebP files are skipped, so shoot JPEG
  ("Photos for a listing" below);
- a field is blank;
- the site refuses it.

**When the site shows it.** The site accepts a listing only once every photo
it names is stored, so a page never shows a missing photo. From that moment:
- `/product?id=ro-0042` (the unit's own id) works at once, and the unit is in
  `/sitemap.xml`;
- `/store`, the homepage's Store row and "Listed now" read
  `/api/store/listings`, which a browser may keep for up to 30 seconds. A
  visitor who loaded the store in the last 30 seconds sees the unit on their
  next load after that.

**What a buyer can do with it.** That depends on which version of the site
is live:
- **Until this redesign is merged**, the live site is the older design.
  Stripe isn't connected there either, so a unit you list shows an Add to
  cart button, and checkout then fails with "Checkout is not configured."
- **Once the redesign is merged**, each unit's page offers "Email to buy this
  unit" until Stripe is set up (steps 3 to 6 above), and Add to cart after
  that.

So hold off listing until the redesign is merged, or merge first.

**When it comes off.** Marking the unit sold elsewhere, pulling it back,
making it a keeper, or "Remove from dhole.dev" takes it off the site. A unit
in a buyer's open Stripe checkout can't come off until that hold ends (about
30 minutes); RefurbOS waits and tries again.

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

## Search and measurement

One-time, about 20 minutes, all free.

### Google Search Console

1. <https://search.google.com/search-console> → **Add property** → **Domain**
   → `dhole.dev`. Google shows a TXT record; add it in the Cloudflare
   dashboard (**DNS → Records**) and press Verify.
2. **Sitemaps** → submit `https://dhole.dev/sitemap.xml`. It lists every page,
   every hand-made item and every bench unit on sale, with photos, and
   updates itself as RefurbOS lists and sells.
3. **URL Inspection** → paste one bench unit's `/product?id=` URL → **Test
   live URL**. "Product snippets" should show as valid. Then **Request
   indexing** for it and for `/store`.
4. Bing: <https://www.bing.com/webmasters> can import the property from
   Search Console in one click.

### Google Merchant Center (free shopping listings)

Once Stripe is live (Merchant Center wants a contact and a returns policy on
the site; `/shipping-returns` has both): <https://merchants.google.com>,
add `dhole.dev`, and choose to get products from the website's structured
data. Every product page already carries price, availability, condition and
shipping.

### Check a link preview

Paste a `/product?id=` URL into a Discord or iMessage chat to yourself. A
bench unit should show its own first photo, its name with the unit id, and
its price, not the generic dhole.dev card. (Once migration 1002 is applied,
a unit whose first photo is under 900 px wide shows the generic card on
purpose.) Try one on hold, one sold, one withdrawn and a made-up id too:
sold and withdrawn cards say so and show no price. A `/case?id=` link should
show the case study's own title and pitch, over the portfolio image. Facebook's
<https://developers.facebook.com/tools/debug/> shows exactly what it reads,
and re-fetches a stale card.

### Check the analytics beacon

After a production deploy, view the source of a `/product?id=` page and a
`/case?id=` page on dhole.dev and look for a script from
`static.cloudflareinsights.com`. Cloudflare injects it into static pages;
those two are served by Functions, and whether it reaches their responses
hasn't been checked yet. If it's missing, Web Analytics just doesn't count
those pages.

### The numbers

Traffic, referrers and Core Web Vitals: Cloudflare dashboard → **Web
Analytics**. It doesn't record query strings, so every product page counts as
`/product` and every case study as `/case`. Orders, revenue and abandoned checkouts: Stripe dashboard.
Search impressions, clicks and indexed pages: Search Console.

Bench stock, from D1 (read-only queries; drop `--remote` and add `--local`
to try them on a local copy). Amounts are cents. `store_sales` holds bench
units only; Stripe has the full orders.

```bash
# Live now: units, total asking value, average price
npx wrangler d1 execute dhole-workshop --remote --command "SELECT count(*) AS live_units, sum(price_cents) AS live_value_cents, CAST(avg(price_cents) AS INTEGER) AS avg_price_cents FROM store_listings WHERE status IN ('available', 'reserved')"
```

```bash
# Last 30 days: listed, sold, orders, revenue; and live now (sell-through = sold / (sold + live))
npx wrangler d1 execute dhole-workshop --remote --command "SELECT (SELECT count(*) FROM store_listings WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) AS listed_30d, (SELECT count(*) FROM store_sales WHERE sold_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) AS units_sold_30d, (SELECT count(DISTINCT stripe_session_id) FROM store_sales WHERE sold_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) AS orders_30d, (SELECT coalesce(sum(amount_cents), 0) FROM store_sales WHERE sold_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) AS unit_revenue_cents_30d, (SELECT count(*) FROM store_listings WHERE status IN ('available', 'reserved')) AS live_now"
```

```bash
# How fast units sell, overall and by platform
npx wrangler d1 execute dhole-workshop --remote --command "SELECT platform, count(*) AS listed, sum(status = 'sold') AS sold, round(avg(CASE WHEN status = 'sold' THEN julianday(sold_at) - julianday(created_at) END), 1) AS avg_days_to_sell FROM store_listings GROUP BY platform ORDER BY sold DESC, listed DESC"
```

```bash
# Units on sale for more than 21 days: candidates for new photos, copy or price
npx wrangler d1 execute dhole-workshop --remote --command "SELECT id, name, price_cents, CAST(julianday('now') - julianday(created_at) AS INTEGER) AS days_listed FROM store_listings WHERE status IN ('available', 'reserved') AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-21 days') ORDER BY created_at"
```

```bash
# Average bench order (units + shipping), last 30 days
npx wrangler d1 execute dhole-workshop --remote --command "SELECT count(*) AS orders, CAST(avg(order_cents) AS INTEGER) AS avg_order_cents FROM (SELECT stripe_session_id, sum(amount_cents) + max(order_shipping_cents) AS order_cents FROM store_sales WHERE sold_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days') GROUP BY stripe_session_id)"
```

---

## Running it day to day

### Add or edit a product

Every used console, controller and memory card comes from the bench app,
with photos of that exact unit; you never add those here. `data/products.js`
is only for new, interchangeable stock you keep on the shelf (a cable, a
cleaning kit), each with a real photo. It's empty today. To add one, copy
the shape in its header comment, give it a new unique `id` (never one like
`ro-0042`, which is the bench's), and deploy. A test refuses anything there
that isn't new or that uses a drawing.
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

### Your details: `data/owner.js` and the portfolio profile

Everything about you is optional, and each empty field leaves no trace on
the site: no placeholder, no stand-in photo.

- In `data/owner.js`: `firstName` turns on a short block about you, "Who
  you're buying from" on the store and product pages and "Who runs
  dhole.dev" on the homepage. `place` (the city or state you ship from) is
  added to it. Without `firstName` the store and product pages show only a
  plain "Questions? Email support@dhole.dev" line, and the homepage shows
  nothing. `about` is one sentence in your own words.
  `benchPhoto` is `{ src, width, height, alt }` of a real photo of you or the
  bench, never a stand-in. `fullName` becomes the portfolio's heading and goes
  on its link-preview card.
- In `data/portfolio.js`, `profile`: a personal `email`, a `resume` PDF and a
  `linkedin` URL (GitHub is set). The portfolio shows a contact button only
  for each one that is set.

Then run:

```bash
npm run sync:owner
```

The portfolio's heading block is static HTML, so it shows even without
JavaScript, and this rewrites it from those two files. `npm test` fails
until you have. It then re-renders the link-preview cards so
`og-portfolio.png` shows your name, which needs Playwright (see
"Checking the layout" below); look at the images, then commit everything.

### Photos for a listing

Photos are the site's colour, and every one is of the exact unit. They go up
with the listing from RefurbOS.

**Format.**
- 1 to 8 photos per unit, at most 2 MB each.
- Shoot JPEG: RefurbOS skips HEIC and WebP files. On an iPhone, set Settings,
  Camera, Formats to Most Compatible.

**Framing.** 4:3 landscape, with photo 1 at least 1200 px wide. RefurbOS
sends a long edge of up to 1600 px. Under 900 px wide, link previews fall
back to the plain dhole.dev card.

**Backdrop and light.**
- The same plain, neutral backdrop every time: a light-to-mid grey (a grey
  card or a matte grey board) rather than pure white. It reads calmly in
  both the light and the dark theme, and the photo panels' grey (`--sweep`
  in `assets/site.css`) can later be set to match it.
- No coloured backdrop.
- Soft daylight, no props.

**Where photo 1 shows.** The store card, the homepage's Store row (from
960 px wide), "Listed now", link previews and the first slot of the
product page's gallery. Make it the hero shot.

**The photos, in order:**
1. **Hero.** The whole console, three-quarter front view, lid and ports
   visible.
2. **Working.** Powered on and connected to a TV or monitor showing its boot
   screen or a game, with console and screen in one frame and the power LED
   lit. For a handheld: the screen lit with a game. This backs the record's
   `Works:` line, and it is the most persuasive photo the store can show.
3. The back and ports (AV out, power, controller ports). This backs
   `Output:`.
4. The label or serial on the base (model, region). This identifies the
   exact unit.
5. to 7. Each mark named in a `Looks:` line, close up with a coin or ruler
   for scale, in the order the `Looks:` lines cite them ("photo 5").
8. Opened mid-refurb (cleaned board, new capacitors), or everything in the
   box laid out. This backs `Replaced:` or `In the box:`.

**Controllers.** The controller beside a screen showing
`/projects/drift-tester` with that controller's plot. The reading on the
screen must be the one in the unit's `Measured:` line, taken in the same
session.

### Writing a unit's record (RefurbOS)

A product page turns a unit's details lines (up to 12, each at most 200
characters) into a record, by the word each line starts with. Any letter
case works. A line without one of these prefixes still shows, under Notes,
so nothing is lost:

| Start the line with | Shown under |
|---|---|
| `Works:` | Tested |
| `Replaced:` | Replaced (say whether original or aftermarket) |
| `Measured:` | Measured (paste the drift tester's "Copy reading" line as it is; it starts with `Measured:`) |
| `Looks:` | Marks and wear (one line per mark) |
| `In the box:` | In the box |
| `Not included:` | Not included |
| `Output:` | Video output |

For example:

```
Works: Boots and plays a cartridge. All 4 controller ports read.
Replaced: Power supply filter capacitors (new, aftermarket).
Looks: Light yellowing on the lid (photo 5).
Looks: Scuff on the right side (photo 6).
In the box: Console, 1 controller, power supply, AV cable.
Not included: Expansion Pak, games.
Output: Composite video only.
```

Put a plain description of how it looks in the 40-character condition field.

**`(photo N)` is optional.** It points a line at photo N, and the page turns
it into a button that shows that photo. When every `Looks:` line has a
reference to a photo the unit has, the summary under the price reads "2
marks, shown in photos 5 and 6" and opens the first; otherwise it reads "2
marks, listed under Marks and wear" and links to that row. A record without
any references is complete.

**If you write references, lock the photo order once they're written.**
Reordering the photos in RefurbOS afterwards silently points every reference
at the wrong photo; a number past the last photo just stays plain text.

**Better, as a RefurbOS feature:** tag each photo with the flaw it shows and
let RefurbOS write the `(photo N)` references when it pushes, so they always
match the order, plus a default `Works:` and `In the box:` per platform.
That's a change in the RefurbOS repo only: details stay free text, and the
store needs nothing new.

### Branding

The link-preview cards and the icons live in `assets/brand/`: `og-site.png`
(home, store, shipping and product pages without a usable photo),
`og-tools.png`, `og-portfolio.png`, `icon.svg` and `icon-180.png`. Each card
is 1200x630 and is rendered from an HTML template in `scripts/brand/`, never
drawn in a design tool:

```bash
npm run render:brand
```

It needs Playwright (see "Checking the layout"). Look at the PNGs, then
commit them. `/assets/brand/` is cached for a week, so if you ever redesign
a card, give the file a new name and update the pages that point at it.

### Add a tool

1. Drop `projects/my-thing.html`, `projects/my-thing.js` and
   `projects/my-thing.entry.js` in. Copy the head and the start of the body
   from an existing tool page: the theme lines (the `color-scheme` and two
   `theme-color` metas, then `/assets/theme.js`, straight before the shared
   stylesheet), the shared stylesheet, the font preload, the empty
   `<header class="site-header"></header>`, and a `<noscript>` notice if the
   page needs JavaScript. `npm test` checks the head, the header and the
   notice. If the tool draws on a canvas, read its colours from the tokens
   and draw again on the `dhole:theme` event, as the drift tester does;
   `npm test` checks that too.
2. Add an entry to `data/projects.js`: `demo` (the page's clean URL), a
   `cta` that names it ("Open the sequencer"), `tagline`, `description`,
   `builtWith`.
3. Add its row to the homepage's index in `index.html`, matching the entry;
   `test/home.test.js` holds the two equal.

`/projects` renders from the data by itself. Every entry needs a working
page. A write-up with nothing to run belongs in `data/portfolio.js`
instead. A `shot` is optional and must be a real capture of the tool's own
page.

A capture of the site's own light interface needs a dark twin too, so the
dark theme doesn't show a white block: `shot.dark = { src, mobile }`, the
same two files with `-dark` before the extension, at the same sizes. The
page then shows only the twin for the theme in use, and the browser fetches
only that one. The homepage row has the same pair in `index.html`: copy the
chiptune row's two `<picture>`s. A capture of a dark interface (Discover
Cleaner's) needs no twin. For the chiptune sequencer,
`npm run capture:tools` takes all of it: the sequencer playing, in light and
then dark, for home, `/projects` and the portfolio. It checks each file's
size against `data/projects.js`, `data/portfolio.js` and `index.html`, and
says which to update if one differs.

### A picture of the drift tester working

The drift tester's row on the homepage and `/projects` has no picture yet,
because a picture of it needs a real controller connected, and yours is the
one to use. Either:

- **Send a screenshot.** Open `/projects/drift-tester` in a desktop browser at
  full width, connect your controller, move the sticks, let go, press
  "Measure rest", and take a screenshot of the plots.
- **Or build the capture tool with a session.** Start a session with the
  controller connected to your PC; it builds `npm run capture:tools drift`
  with you (a real controller only, both themes), and you run it.

Either way the session then puts the picture on the homepage and Tools rows,
captioned as your own controller rather than a unit for sale.

### Local preview

```bash
npx wrangler d1 migrations apply dhole-workshop --local   # once, and after new migrations
npm run dev     # wrangler pages dev . — Functions, a local D1 and a local R2
npm test        # everything in test/, as CI runs it
```

To point the bench app at your local copy, see "Testing the bench app against
a local copy" above.

### Checking the layout

```bash
npm run check:layout
```

It loads every page in Chromium at phone and desktop widths and checks that
nothing scrolls sideways, nothing shifts while units and fonts load, no text
is under 16 px, the buy action sits in the first screen of a product page,
contrast holds, and the content security policy blocks nothing. In every run
it also checks the theme (the page is in the theme it should be, and the
phone's bar colour matches the page), that only the current theme's capture
is fetched, that printing gives dark text on white, and, on two product
pages, that the photo strip's focus ring shows (also in Windows contrast
themes). It isn't part of `npm test` or CI, because it needs a browser: run
it before merging anything that changes how pages look. It prints a table
and exits 1 when a check fails; a full run takes a few minutes.

It checks a light device by default. Options for the themes:
- `--scheme dark`: the device prefers dark.
- `--theme light` or `--theme dark`: the visitor chose Light or Dark in the
  footer (`--theme auto`, the default, follows the device).
- `--first-paint`: with every script except `theme.js` held back, checks only
  that the first frame is already in the right theme (no flash of the other
  one).

Other options: `--units 0,1,5,failed`, `--checkout off`, `--slow-fonts`,
`--text-scale`, `--pages` and `--widths` (the script's header lists them all).
Before merging a change to the look, run it at least as it is, with
`--scheme dark`, and with `--scheme light --theme dark`.

Playwright isn't one of the site's dependencies. Either install it
(`npm i -D playwright && npx playwright install chromium`, without committing
the change to `package.json`), or point at an install you already have:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.js npm run check:layout
```

`npm run render:brand`, `npm run capture:tools` and the image step of
`npm run sync:owner` find Playwright the same way.

### Tests and CI

`.github/workflows/test.yml` runs `npm ci` and `npm test` on GitHub for every
push and pull request. Two one-time settings make it count:

1. **Make it a required check on `main`.** On GitHub, in the repo's
   **Settings**, add a branch protection rule (or a ruleset) for `main`,
   turn on **Require status checks to pass before merging**, and choose the
   check named `test`. It appears in the list once the workflow has run at
   least once. A red suite then can't be merged, so it can't deploy.
2. **Optional: make Cloudflare run the tests too.** In the Cloudflare
   dashboard, open the `dhole-dev` Pages project's build settings: set the
   build command to `npm test`, leave the output directory as `.`, and add
   the build environment variable `NODE_VERSION` = `22`. A failing suite
   then stops the deploy itself, previews included. The store tests need
   Node 22.13 or later; if the build log shows an older 22, give the full
   version instead.

---

## Light and dark

The site has a light and a dark theme, both neutral grey with no colour of
their own, so the photos carry the colour.

- **How a visitor gets each.** The site follows their device's setting
  (light or dark mode) until they choose otherwise under "Theme" in the
  footer: Match device, Light or Dark. Without JavaScript the device's
  setting still applies; only the footer choice needs it.
- **Where the choice is kept.** In that visitor's own browser
  (`localStorage`, `dhole_theme_v1`), for every page of the site. Nothing is
  sent anywhere. If the browser blocks storage, the choice lasts for that
  page only.
- **How to look at both.** Use the footer's Theme choice on any page, or
  switch your device between light and dark mode while the footer says
  Match device. Check the preview at a phone width (390 px) and at a laptop
  width (1280 px).
- **Printing is always light.** Printing a page or saving it as a PDF (a
  receipt from `/order-complete`, a case study, `/shipping-returns`) gives
  dark text on white paper, whatever the screen shows.
- **What never changes with the theme.** Unit photos are never dimmed or
  tinted. The link-preview cards and the site icon are the same in both.

The colours and the rules behind them are in `CLAUDE.md`, "Two themes".

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
when Stripe says it's paid. The hold lasts about 30 minutes, the same as the
Stripe checkout page. The one gap: if a payment finishes in the last seconds
of a hold just as someone else starts checking out, both can pay. The bench app
flags that as "sold twice" so you can refund one.

**Sales tax is off by default.** `ENABLE_AUTOMATIC_TAX` in `wrangler.toml` is
`"false"`, because Stripe Tax rejects sessions until you have set an origin
address and tax registrations. Configure Stripe Tax first, then flip it, set
`AUTOMATIC_TAX` in `data/products.js` to `true` to match (the cart then says
"Total before tax"; a test fails while the two differ), add a line about tax
to `/shipping-returns`, and redeploy. Whether you owe sales tax at all is a
question for an accountant.

**No order system beyond Stripe.** Stripe emails the customer a receipt (with
Customer emails → Successful payments on, Step 3) and emails you a
notification; you fulfil from the Stripe dashboard. Reasonable at this scale.

**Shipping is flat-rate per box size.** Console-sized or accessory-sized, and
the largest item in the order decides. No weight-based or international rates.

**Used hardware is listed only from the bench.** The drawn placeholder items
the store launched with are gone; until RefurbOS lists units, the store shows
an empty shelf.

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

It runs every file in `test/` (Node 22.13 or later). Checks over price
tampering, stock limits, malformed carts, duplicate lines, shipping selection
and Stripe payload construction; the bench API, the public store API,
bench-unit holds and the Stripe webhook against a real SQLite standing in for
D1; every page's server-written head and the sitemap; the design rules
(colours only from the shared tokens, contrast in both themes, the font
rules, no text under 16 px, shipping and returns wording only from
`data/products.js`); the theme on every page (the theme script and its
footer choice, each page's head, the paired light and dark captures); each
page group;
and the vendored
Discover Cleaner and league-ify builds. CI runs the same command on every
push ("Tests and CI" above). For how the pages look at phone and desktop
sizes, run `npm run check:layout` ("Checking the layout").

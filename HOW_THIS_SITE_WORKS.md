This site is static files plus one small serverless function, hosted on
Cloudflare Pages.

To update it:
- Edit the files
- `npx wrangler pages deploy .`

No local server. No Apache. No FileZilla.

## The three halves

**Projects** (`projects.html`, `projects/`) — everything listed is meant to run
in a browser. Add a page under `projects/` and an entry in `data/projects.js`.

One project is different. The **Discover Cleaner** demo
(`projects/discover-cleaner-demo/`) is a whole app built in its own repo and
copied in, not written here. To update it, rebuild it in the app repo, then
run `npm run sync:discover-cleaner` and `npm test`. Never edit the copy by
hand: the next sync overwrites it. It is also the only path with a different
security policy. `_headers` lets it load album covers from Spotify's image
server (`https://i.scdn.co`), and every other page keeps the strict default.

**Store** (`store.html`, `product.html`, `cart.html`) — reads `data/products.js`
for hand-made items: change a price or a stock count there and deploy.
Refurbished units come from the bench app instead, which pushes each one (copy,
price, real photos) to the site's database and pulls the sales back. See
"Live bench stock" in `SETUP.md`.

**Log** (`log.html`) — the week-by-week notes, from `data/weeks.js`.

## The non-static pieces

Taking card payments needs a server, so `functions/api/checkout.js` runs as a
Cloudflare Pages Function on the same domain. The live bench stock adds three
more (`functions/api/bench/`, `functions/api/store/`,
`functions/api/stripe/webhook.js`), backed by a D1 database and an R2 photo
bucket. They hold the secrets, and they are deployed by the same command as
everything else.

Prices live in `data/products.js` and are read by *both* the site and the
checkout function. The browser only ever sends an id and a quantity — never a
price — so nobody can talk the store into selling them a console for a dollar.

Full setup: `SETUP.md`.

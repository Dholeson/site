This site is static files plus one small serverless function, hosted on
Cloudflare Pages.

To update it:
- Edit the files
- `npx wrangler pages deploy .`

No local server. No Apache. No FileZilla.

## The three halves

**Projects** (`portfolio.html`, `case.html`, `projects/`) — one list, in
`data/portfolio.js`, drives the Projects page, every case study and the
homepage's featured pair. The page is `portfolio.html` (served at `/portfolio`)
but the site calls it Projects, and `/projects` redirects there. To add a
project, add a block to `data/portfolio.js`; if it runs on this site, put its
page under `projects/` and link it from that block.

One project is different. The **Discover Cleaner** demo
(`projects/discover-cleaner-demo/`) is a whole app built in its own repo and
copied in, not written here. To update it, rebuild it in the app repo, then
run `npm run sync:discover-cleaner` and `npm test`. Never edit the copy by
hand: the next sync overwrites it. It is also the only path with a different
security policy. `_headers` lets it load album covers from Spotify's image
server (`https://i.scdn.co`), and every other page keeps the strict default.

**Store** (`store.html`, `product.html`, `cart.html`) — reads `data/products.js`.
Change a price or a stock count there and deploy.

**Log** (`log.html`) — the week-by-week notes, from `data/weeks.js`.

## The one non-static piece

Taking card payments needs a server, so `functions/api/checkout.js` runs as a
Cloudflare Pages Function on the same domain. It is the only piece holding a
secret, and it is deployed by the same command as everything else.

Prices live in `data/products.js` and are read by *both* the site and the
checkout function. The browser only ever sends an id and a quantity — never a
price — so nobody can talk the store into selling them a console for a dollar.

Full setup: `SETUP.md`.

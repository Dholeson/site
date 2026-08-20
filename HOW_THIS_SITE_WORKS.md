This site is static files plus one small serverless function, hosted on
Cloudflare Pages.

To update it:
- Edit the files
- `npx wrangler pages deploy .`

No local server. No Apache. No FileZilla.

## The three halves

**Projects** (`projects.html`, `projects/`) — everything listed is meant to run
in a browser. Add a page under `projects/` and an entry in `data/projects.js`.

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

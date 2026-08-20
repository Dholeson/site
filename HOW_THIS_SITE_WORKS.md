This site is hosted on GitHub Pages.

To update it:
- Edit markdown files in this repo
- Commit changes
- The site updates automatically

No local server.
No Apache.
No FileZilla.
If GitHub loads, the site works.

## The store

The shop pages (`store.html`, `product.html`, `cart.html`) are part of the same
static site and follow the same rule: edit, commit, done.

The one thing that is *not* static is checkout. Taking card payments needs a
server, so there is a small Cloudflare Worker in `worker/` that talks to Stripe.
It is the only piece with a deploy step of its own, and the only piece holding a
secret.

- To change prices, stock, or product copy: edit `data/products.js` and push.
- To set checkout up the first time: see `STORE_SETUP.md`.

Prices live in `data/products.js` and are read by *both* the site and the
Worker. The browser only ever tells checkout an id and a quantity — never a
price — so nobody can talk the store into selling them a console for a dollar.

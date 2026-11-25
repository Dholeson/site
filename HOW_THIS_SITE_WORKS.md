This site is static files plus a few serverless Functions, hosted on
Cloudflare Pages.

To update it:
- Edit the files, then run `npm test`
- Merge to `main`, which deploys production (other branches get preview
  URLs), or run `npx wrangler pages deploy .`

There is no build step. `npm run dev` gives you a local copy with the
Functions, a local database and local photo storage. No Apache. No FileZilla.

## The sections

The header links Store, Tools, Portfolio and Cart. The footer adds Shipping
and returns, Lazy Sunday and the support address.

**Store** (`store.html`, `product.html`, `cart.html`) — refurbished units come
from the bench app, which pushes each one (copy, price, real photos) to the
site's database and pulls the sales back. See "Live bench stock" in
`SETUP.md`. The lines it sends become the record on the unit's page; "Writing
a unit's record" in `SETUP.md` has the format. `data/products.js` holds the
shipping rates and the returns sentence that every page repeats word for
word, plus any new stock you keep on the shelf (none today): change a price
or a stock count there and deploy.

**Tools** (`projects.html`, `projects/`; the URL stays `/projects`) —
everything listed runs in a browser. To add one, see "Add a tool" in
`SETUP.md`.

One tool is different. The **Discover Cleaner** demo
(`projects/discover-cleaner-demo/`) is a whole app built in its own repo and
copied in, not written here. To update it, rebuild it in the app repo, then
run `npm run sync:discover-cleaner` and `npm test`. Never edit the copy by
hand: the next sync overwrites it. It and league-ify (`projects/league-ify/`,
also vendored) are the only paths with their own security policy: `_headers`
lets the demo load album covers from Spotify's image server
(`https://i.scdn.co`) and league-ify load art from Riot's Data Dragon, and
every other page keeps the strict default.

**Portfolio** (`portfolio.html`, `case.html`) — product case studies, one
block each in `data/portfolio.js`. Your name goes in `data/owner.js` and your
contact links in the portfolio's `profile`; run `npm run sync:owner` after
changing either.

**Build log** (`log.html`) — the week-by-week notes, from `data/weeks.js`. It
isn't linked from the header or footer; the page stays until you decide.

## The look

Light and neutral, so photos of the real unit carry the colour. Public Sans
for text and Red Hat Mono only for unit ids, both served from this site.
Every colour and type size is a token at the top of `assets/site.css`, and
`npm test` fails if a page brings in its own colour, a shadow, a gradient or
text under 16 px. `CLAUDE.md`, "Design system", has the rules and the
reasons.

## The non-static pieces

Taking card payments needs a server, so `functions/api/checkout.js` runs as a
Cloudflare Pages Function on the same domain. The live bench stock adds three
more (`functions/api/bench/`, `functions/api/store/`,
`functions/api/stripe/webhook.js`), backed by a D1 database and an R2 photo
bucket. Two more, `functions/product.js` and `functions/case.js`, write a
page's `<head>` on the server, so a pasted link previews with the right
title and photo. They hold the secrets, and they are deployed by the same
command as everything else.

Prices live in `data/products.js` and the database, and are read by *both*
the site and the checkout function. The browser only ever sends an id and a
quantity — never a price — so nobody can talk the store into selling them a
console for a dollar.

Full setup: `SETUP.md`.

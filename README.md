# dhole.dev

A shop for refurbished retro consoles, tools that run in the browser, and
product case studies. The header links Store, Tools, Portfolio and Cart.

- **Store**: `store.html`, `product.html`, `cart.html`. Every used console is
  one unit, pushed with photos of that unit by the bench app:
  `functions/api/bench/`, `functions/api/store/`, `functions/api/stripe/webhook.js`
  (D1 + R2). `data/products.js` holds the shipping rates, the returns sentence
  and any new stock (none today)
- **Checkout**: `functions/api/checkout.js` (Cloudflare Pages Function + Stripe).
  Until Stripe is connected, product pages offer "Email to buy this unit"
- **Tools**: `projects.html` (the URL stays `/projects`), the tools in `projects/`
  (the Discover Cleaner demo is vendored from its own repo: `npm run sync:discover-cleaner`)
- **Portfolio**: `portfolio.html` and `case.html`, from `data/portfolio.js`
- **Build log**: `log.html`, not linked from the header or footer

A light, neutral look with self-hosted fonts; every colour and type size is a token
in `assets/site.css`, and `test/design.test.js` keeps it that way.

```bash
npm install
npm run dev            # local preview, Functions included
npm test               # everything in test/; CI runs it on every push
npm run check:layout   # every page at phone and desktop sizes (needs Playwright)
npx wrangler pages deploy .   # merging to main deploys too
```

Setup and deployment: `SETUP.md`. Day-to-day: `HOW_THIS_SITE_WORKS.md`.
Conventions and the design rules: `CLAUDE.md`.

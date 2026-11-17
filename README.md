# dhole.dev

Projects you can use in the browser, and a shop for retro consoles.

- **Projects** — `projects.html`, demos in `projects/`
  (the Discover Cleaner demo is vendored from its own repo: `npm run sync:discover-cleaner`)
- **Store** — `store.html`, catalogue in `data/products.js`
- **Checkout** — `functions/api/checkout.js` (Cloudflare Pages Function + Stripe)
- **Log** — `log.html`

```bash
npm install
npm run dev      # local preview, functions included
npm test         # checkout + vendored-demo checks
npx wrangler pages deploy .
```

Setup and deployment: `SETUP.md`. Day-to-day: `HOW_THIS_SITE_WORKS.md`.

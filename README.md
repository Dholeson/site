# dhole.dev

Projects you can use in the browser, and a shop for retro consoles.

- **Projects** — `projects.html`, demos in `projects/`
- **Store** — `store.html`, catalogue in `data/products.js`
- **Checkout** — `functions/api/checkout.js` (Cloudflare Pages Function + Stripe)
- **Log** — `log.html`

```bash
npm install
npm run dev      # local preview, functions included
npm test         # checkout tests
npx wrangler pages deploy .
```

Setup and deployment: `SETUP.md`. Day-to-day: `HOW_THIS_SITE_WORKS.md`.

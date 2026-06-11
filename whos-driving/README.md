# WHO'S DRIVING — The Nafs Audit & 30-Day Rebuild

A Niyyah product: a sales page (`/`) and the product itself (`/app/`).
Static site, Vite + vanilla TypeScript, no backend, no accounts. All buyer
state lives in localStorage on their device.

## Develop

```sh
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
```

## Deploy (Vercel or Netlify, zero config)

Create a new project and point its **root directory** at `whos-driving/`.
Both platforms auto-detect Vite: build command `npm run build`, output
directory `dist`. The existing site at the repository root is untouched —
this deploys as its own project (for example on a subdomain like
`whosdriving.niyyahtrader.com`).

## Before launch

1. **Stripe.** Create a $27 Payment Link. In `index.html`, replace
   `STRIPE_PAYMENT_LINK` with the live URL. In the Payment Link's
   "After payment" settings, redirect to
   `https://YOUR-DEPLOY-DOMAIN/app/?access=granted`.
   That query string unlocks the app on the buyer's device. This is soft
   gating, accepted for v1.
2. **Verses.** Search the code for `VERSE SLOT` (three of them: two on the
   sales page, one on the verdict screen) and insert your sourced,
   authenticated text. The build intentionally ships none.
3. **OG image domain.** The `og:image` meta tag uses a relative path;
   set it to the absolute deploy URL. Regenerate the image after any copy
   change with `node scripts/og.mjs`.

## Where things live

- `src/content/` — the product's words: 20 audit questions, 4 saboteur
  profiles, and all 120 rebuild days. Edit copy here, nowhere else.
- `src/app/` — the product app: state, scoring, dial motif, screens, export.
- `src/styles/` — tokens (palette/type), base, sales, app.
- `app/index.html` — product shell. `index.html` — sales page.

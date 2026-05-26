# CLAUDE.md — Niyyah Codebase Guide

## Project Overview

**Niyyah** is a privacy-first Islamic trading journal and accountability platform. It combines trade journaling with Islamic psychology concepts: prayer tracking, nafs (ego) awareness ratings, weekly muhasabah (self-reflection), and witness-mode accountability. The name means "intention" in Arabic.

**Live domains:** niyyahtrader.com (primary, Vercel) · Firebase Hosting (fallback)

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript SPA — single `index.html` file, no build step |
| Auth | Firebase Authentication (Google OAuth redirect + email/password) |
| Database | Firestore (user-isolated, enforced by server-side security rules) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Payments | Stripe subscriptions (Base and Sirat tiers) |
| Hosting | Vercel (primary SPA rewrite) + Firebase Hosting |
| PWA | Service worker (`sw.js`), `manifest.webmanifest` |

The frontend is intentionally framework-free — the entire app ships as a single HTML file with inline CSS and vanilla JS. There is no bundler, no npm workspace at the root level, and no compile step for the frontend.

---

## Repository Structure

```
/
├── index.html              # Entire SPA — HTML + CSS + JS (7 000+ lines, ~580 KB)
├── sw.js                   # Service worker (PWA, network-first HTML, cache-first assets)
├── manifest.webmanifest    # PWA manifest (name, icons, standalone display)
├── firebase.json           # Firebase project config (hosting, functions, Firestore)
├── firestore.rules         # Server-side Firestore security rules (critical — read before editing)
├── firestore.indexes.json  # Firestore composite indexes (stripeCustomerId index)
├── vercel.json             # Vercel SPA rewrite + security headers (CSP, HSTS, etc.)
├── robots.txt              # Blocks auth/private routes from crawlers
├── sitemap.xml             # Public routes only
├── og.png                  # Open Graph preview image
├── README.md               # Minimal placeholder
└── functions/
    ├── index.js            # DEPLOYED — Stripe webhook + checkout/portal session functions
    ├── dailyNudge.js       # DRAFT — Daily push notification scheduler (not deployed)
    ├── redeemReferral.js   # DRAFT — Referral credit logic (not deployed)
    ├── sendWitnessReport.js# DRAFT — Weekly accountability email (not deployed)
    └── package.json        # functions runtime: Node 20, firebase-admin, firebase-functions, stripe
```

---

## Firestore Data Model

### `/users/{uid}`
User profile and subscription state. **Client-side writes to subscription/Stripe fields are blocked by Firestore rules — only Cloud Functions (Admin SDK) may write them.**

| Field | Type | Notes |
|---|---|---|
| `stripeCustomerId` | string | Set by `createCheckoutSession` |
| `subscription.status` | string | `active`, `past_due`, `canceled`, `trialing` |
| `subscription.tier` | string | `base`, `sirat` |
| `subscription.currentPeriodEnd` | timestamp | |
| `subscription.cancelAtPeriodEnd` | boolean | |
| `referralCode` | string | User's shareable referral code |
| `referredBy` | string | UID of referrer (if any) |
| `referralCreditedAt` | timestamp | Idempotency guard |
| `lastNudgeAt` | timestamp | De-dup guard for push nudges |
| `settings.pushSubscription` | object | Web Push subscription object |
| `settings.witness` | object | Witness mode config |
| `settings.sirat` | object | Sirat stage progress |

### `/users/{uid}/trades/{tradeId}`
Individual journal entries.

| Field | Type | Notes |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `status` | string | `open` or `closed` |
| `pnl` | number | Profit/loss |
| `setup` | string | Playbook tag |
| `sample` | boolean | `true` for demo/sample data |

### `/users/{uid}/meta/dailyPrayers`
Single document keyed by date.
```json
{
  "2025-01-15": { "fajr": true, "dhuhr": true, "asr": false, "maghrib": true, "isha": true }
}
```

### `/rateLimits/{userId}`
Reserved for future server-side rate limiting. **Client reads and writes are blocked.**

---

## Cloud Functions

All functions live in `/functions/`. Deploy with:
```bash
firebase deploy --only functions
```

### Deployed Functions (`functions/index.js`)

| Function | Trigger | Purpose |
|---|---|---|
| `createCheckoutSession` | HTTPS callable | Creates a Stripe Checkout session for Base or Sirat tier |
| `createPortalSession` | HTTPS callable | Opens Stripe billing portal for plan/card management |
| `stripeWebhook` | HTTPS request | Handles Stripe lifecycle events → writes to Firestore |

**Stripe webhook events handled:**
- `checkout.session.completed` — activates subscription
- `customer.subscription.updated` — handles upgrades, downgrades, cancellations
- `customer.subscription.deleted` — cancels subscription in Firestore
- `invoice.payment_failed` — marks subscription as `past_due`

**Subscription tiers:**
- Base: $27/month or $230/year
- Sirat: $38/month or $300/year

### Draft Functions (not deployed — no npm install run for their dependencies)

| File | Schedule | Purpose | Blockers |
|---|---|---|---|
| `dailyNudge.js` | 17:00 UTC daily | Push nudges: post-loss reflection, streak-at-risk, Friday muhasabah | Needs `web-push`, VAPID keys in Firebase config |
| `redeemReferral.js` | Firestore trigger | Applies free-month Stripe coupon when referred user pays | Needs `referral.coupon` in Firebase config |
| `sendWitnessReport.js` | 09:00 UTC Sunday | Discipline-only weekly email to accountability partner | Needs `@sendgrid/mail` and `sendgrid.key` in Firebase config |

To activate a draft function: install its dependencies, add required Firebase config secrets, and add an export to `functions/index.js`.

---

## Environment Secrets

Secrets are stored in Firebase Functions config (not in git). Never commit real keys.

```bash
# View current config
firebase functions:config:get

# Set a value
firebase functions:config:set stripe.secret="sk_live_..."
```

| Config Key | Used By | Notes |
|---|---|---|
| `stripe.secret` | index.js | Stripe secret API key |
| `stripe.webhook_secret` | index.js | Webhook signing secret |
| `stripe.price_id` | index.js | Base monthly price ID |
| `stripe.price_id_annual` | index.js | Base annual price ID |
| `stripe.price_id_sirat_monthly` | index.js | Sirat monthly price ID |
| `stripe.price_id_sirat_annual` | index.js | Sirat annual price ID |
| `push.vapid_public` | dailyNudge.js | VAPID public key (draft) |
| `push.vapid_private` | dailyNudge.js | VAPID private key (draft) |
| `push.vapid_subject` | dailyNudge.js | VAPID contact email (draft) |
| `referral.coupon` | redeemReferral.js | Stripe coupon ID (draft) |
| `sendgrid.key` | sendWitnessReport.js | SendGrid API key (draft) |

---

## Deployment

### Frontend (Vercel — primary)
Vercel is configured to rewrite all routes to `/index.html` (SPA pattern). Pushes to `main` auto-deploy.

```bash
# Manual deploy via Vercel CLI
vercel --prod
```

### Frontend (Firebase Hosting — fallback)
```bash
firebase deploy --only hosting
```

### Firestore Rules
Always deploy rules after any change to `firestore.rules`:
```bash
firebase deploy --only firestore:rules
```

### Cloud Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy a specific function
firebase deploy --only functions:stripeWebhook

# View logs for billing functions
npm run logs   # from /functions directory
```

---

## Frontend Conventions (`index.html`)

The entire frontend is a single HTML file. Because there is no build step, all changes are made directly in `index.html`.

### Structure (top to bottom)
1. `<head>` — meta tags, PWA manifest link, Google Fonts CDN
2. `<style>` — all CSS (7 000+ lines, custom properties + utility classes)
3. `<body>` — all HTML markup (views, modals, nav)
4. `<script>` — all JavaScript (Firebase SDK imports via CDN, app logic)

### JavaScript Patterns
- **Firebase SDK v10.14.1** loaded from CDN via ES module imports (`type="module"`)
- **Auth:** Google OAuth uses redirect flow (not popup) — third-party cookie restrictions in browsers require this
- **Routing:** Hash-based (`#dashboard`, `#trades`, `#prayer`, etc.) or query param handling for email verification (`?mode=verifyEmail&oobCode=...`)
- **No state management library** — state kept in module-level variables
- **No component framework** — DOM manipulation via `querySelector` / `innerHTML`

### CSS Conventions
- CSS custom properties for theming (colors, spacing, typography)
- BEM-ish class names, kebab-case (`.trade-card`, `.prayer-row`, `.nav-link--active`)
- Mobile-first responsive design

### Naming
- JavaScript: camelCase for variables and functions
- CSS classes: kebab-case
- Firestore fields: camelCase

---

## Firestore Security Rules

`firestore.rules` is the security backbone. Key rules:

- All user data is isolated: `request.auth.uid == userId`
- Subscription fields (`stripeCustomerId`, `subscription.*`, `referral*`) are **write-blocked on the client** — only Admin SDK (Cloud Functions) may write them
- `/rateLimits` collection is **fully client-blocked** (read and write)
- Trade and prayer data is user-readable and user-writable

**Always review and re-deploy rules when adding new Firestore fields or collections.**

---

## PWA / Service Worker (`sw.js`)

- **Network-first** for HTML (always try fresh `index.html`)
- **Cache-first** for static assets (images, fonts)
- **Never cached:** Firebase APIs, Stripe endpoints, authentication flows
- Handles push notification clicks → routes to app-specific hash paths

---

## Authentication Flows

1. **Google OAuth** — redirect flow (`signInWithRedirect`), result handled on page load via `getRedirectResult`
2. **Email/Password** — standard Firebase Auth
3. **Email Verification** — URL handler: `?mode=verifyEmail&oobCode=...` parsed on load, calls `applyActionCode`
4. **Authorized domains:** `niyyahtrader.com`, `localhost`

---

## Key UI Sections

| Section | Route/Hash | Description |
|---|---|---|
| Landing | `/` (not logged in) | Hero, pillars, FAQ, pricing |
| Dashboard | `#dashboard` | Main journal overview |
| Trades | `#trades` | Trade log and management |
| Prayer | `#prayer` | Daily prayer tracking |
| Nafs | `#nafs` | Ego/discipline self-rating |
| Muhasabah | `#muhasabah` | Weekly reflection |
| Calendar | `#calendar` | Heatmap of trades + prayers |
| Analytics | `#analytics` | Performance insights |
| Settings | `#settings` | Notifications, witness mode, account |

---

## Testing

There is no automated test suite. Testing is manual. When making changes:

1. Test authentication flows (Google sign-in, email/password, email verification)
2. Test trade CRUD operations
3. Test prayer tracking
4. Verify Stripe checkout in test mode before deploying billing changes
5. Check mobile responsiveness (the app is mobile-first)
6. Verify PWA functionality (offline behavior, service worker caching)

For Cloud Functions, test using the Stripe CLI to replay webhook events:
```bash
stripe listen --forward-to localhost:5001/niyyah/us-central1/stripeWebhook
stripe trigger checkout.session.completed
```

---

## Common Tasks

### Add a new UI section/page
1. Add the HTML markup inside `index.html` (in `<body>`)
2. Add corresponding CSS in the `<style>` block
3. Add JavaScript logic in the `<script>` block
4. Add a hash route handler in the routing logic
5. Add a navigation link in the sidebar

### Add a new Firestore field
1. Update the relevant read/write in `index.html` JS
2. Check if `firestore.rules` needs updating (especially for sensitive fields)
3. Deploy updated rules: `firebase deploy --only firestore:rules`

### Deploy a draft Cloud Function
1. `cd functions && npm install <required-package>`
2. Add required secrets: `firebase functions:config:set key="value"`
3. Export the function in `functions/index.js`
4. Deploy: `firebase deploy --only functions`

### Update Stripe pricing
1. Create new price IDs in Stripe Dashboard
2. Update Firebase config: `firebase functions:config:set stripe.price_id="price_..."`
3. Update price display in `index.html` landing page section
4. Redeploy functions

---

## What Not to Do

- **Do not add a build step or bundler** to the frontend without explicit discussion — the single-file approach is intentional
- **Do not write client-side code that writes to restricted Firestore fields** (`stripeCustomerId`, `subscription.*`, `referral*`) — this will be blocked by security rules and represents a security violation
- **Do not commit secrets** — all API keys and tokens go in Firebase Functions config
- **Do not deploy draft functions** (`dailyNudge`, `redeemReferral`, `sendWitnessReport`) without first installing their npm dependencies and configuring their required secrets
- **Do not modify `firestore.rules` without testing** — a mistake here can expose user data or lock out legitimate users
- **Do not use popup auth** (`signInWithPopup`) — the app uses redirect flow deliberately due to third-party cookie restrictions in modern browsers

---

## Git Workflow

- `main` — production branch, auto-deploys to Vercel
- Feature branches: `claude/<description>` for AI-assisted work
- No CI/CD pipeline — deployments are manual via Firebase and Vercel CLIs
- Push: `git push -u origin <branch-name>`

---

## Islamic Concepts in the Codebase

Understanding these terms helps when reading code, UI strings, and data structures:

| Term | Meaning | Used For |
|---|---|---|
| Niyyah | Intention | App name — setting intentional trading habits |
| Muhasabah | Self-accounting / reflection | Weekly reflection feature |
| Nafs | Ego / self | Discipline self-rating system |
| Sirat | Path / straight path | Premium subscription tier name |
| Fajr, Dhuhr, Asr, Maghrib, Isha | The 5 daily prayers | Prayer tracking field names |
| Witness (Shahid) | Accountability partner | Witness mode feature |

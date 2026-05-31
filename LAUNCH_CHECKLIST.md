# Niyyah — Launch & Deploy Checklist

A practical, ordered checklist for taking Niyyah from "code on main" to "in
front of users." Work top-to-bottom. **Do not invite anyone in until every
P0 box is checked** — P0 is about not exposing user data and not shipping a
broken core flow.

Project: `sunnahtrader-f71f1` · Domain: `niyyahtrader.com` · Host: Vercel

---

## P0 — Security & deploy (blockers; nobody touches the app until these pass)

### Backend rules & functions
- [ ] **Deploy Firestore rules.** `firebase deploy --only firestore:rules`
      Until this runs, the "your data stays yours" promise is false and any
      account is readable with the public API key.
- [ ] **Enable Firebase Storage** in the console (it is not on by default),
      then **deploy Storage rules.** `firebase deploy --only storage`
      Until then, screenshot uploads fail and silently fall back to inline
      data URLs (the old ~4-trade ceiling).
- [ ] **Deploy live functions.** `firebase deploy --only functions`
      Live: `createCheckoutSession`, `createPortalSession`, `stripeWebhook`,
      `resetPasswordWithCode`. (`resetPasswordWithCode` powers password
      recovery — verify it works, see QA below.)
- [ ] Confirm the **draft functions stay OFF** unless finished:
      `dailyNudge`, `sendWitnessReport`, `redeemReferral` are not exported.
      Their UI is honestly labelled "rolling out / coming soon" — keep it
      that way until they're wired end-to-end.

### Config
- [ ] Verify `firebaseConfig` in `app.js` points at the production project.
- [ ] **Bump the service-worker cache version on every deploy** (`CACHE` in
      `sw.js`). Currently `niyyah-v4`. If you forget, returning users keep
      running stale code.
- [ ] Confirm `niyyahtrader.com` resolves to the Vercel deployment, HTTPS
      works, and `support@niyyahtrader.com` receives mail.
- [ ] Check OG/meta: `og.png` renders correctly when the link is shared
      (test in a real iMessage/WhatsApp/X preview).

### Data privacy (verify, don't assume)
- [ ] Sign in as user A; in another browser/profile sign in as user B.
      Confirm A **cannot** read B's Firestore doc or B's `users/{uid}/shots/*`
      Storage objects. (This is the rules working.)

---

## P1 — Must-have before the fanbase (a real human runs every flow)

> Nothing below has been verified on a real device yet. Do this pass on
> **desktop + a phone** before any beta invite.

### Auth & recovery
- [ ] Create an account (name + password) → the credentials screen shows an
      account code + recovery code → "Enter Niyyah" only enables after the
      "I've saved them" checkbox.
- [ ] Sign out, sign back in with the **account code** + password.
- [ ] "Forgot password" → enter account code + recovery code → set a new
      password → sign in with it. (Exercises `resetPasswordWithCode`.)

### Onboarding (both paths)
- [ ] **Fresh start:** Welcome → Daily Loop → Leak picker (selection sticks)
      → Import step → "I'll start fresh" → Example (illustration only,
      **no trade is added**) → First 60s → lands on an **empty, honest
      dashboard** (no phantom +$150).
- [ ] **Import:** on the Import step, import a CSV → toast "your mirror is
      live" → onboarding **auto-advances past the Example step** → dashboard
      shows the imported trades and real insights.

### Logging a trade (the two-beat entry)
- [ ] Tap **+** → Step 1 shows only the gate + emotion. Answer "No" or tag
      "revenge/fomo" → the **mirror warning** appears (once you have history).
- [ ] **Continue →** reveals Step 2 (the form); instrument field is focused.
- [ ] Enter a trade → it appears in **Trades**, the **Calendar** shows the
      correct day P&L (and a brand-new account shows **no phantom $150**),
      and **Analytics** updates.
- [ ] **Back** from Step 2 returns to the gate without losing input; Cancel
      with details entered prompts "Discard?".
- [ ] Close the trade via the exit modal (P&L, fees, optional MFE/MAE) → the
      closed result is correct everywhere.

### Screenshots (after Storage is deployed)
- [ ] Attach a chart on entry → save → open the trade detail → image shows.
- [ ] Confirm the stored value is a **Storage URL**, not a data URL (check
      the Firestore doc — the trade's `screenshot` should be `https://…`).
- [ ] Delete the trade → its Storage object is removed (best-effort).
- [ ] With Storage **disabled**, confirm the inline fallback still works
      (image saves, app doesn't break).

### Navigation & demo
- [ ] Sidebar: **Tools** and **More** collapse/expand; deep-link to `/risk`
      auto-opens the Tools group; open/closed state persists across reloads.
- [ ] **Preview with sample data** (logged out): Khalid's full account shows
      trades, a populated **calendar**, and analytics (sample-flag fix must
      NOT blank the demo — demo trades aren't sample-flagged).
- [ ] Real sign-in while demo is active clears the demo data.

### Mobile
- [ ] Sidebar opens as an overlay; sticky CTA behaves; the two-beat entry
      modal is usable; the emotion grid drops to 2 columns.

### Data ownership
- [ ] Export JSON and CSV from Settings (both download, both parse).
- [ ] Delete account → account + Firestore doc are gone; re-signup with the
      same name works.

---

## P2 — Trust & polish (do before the *full* launch, not necessarily the beta)

- [ ] **Founder note:** drop a real square photo and your full name (it's
      currently a gold "A" circle — your strongest trust asset is blank).
- [ ] **Scholar QA:** have a knowledgeable person verify the **zakat**
      calculation, **prayer-time** angles/madhab handling, and the halal
      framing. One wrong nisab or Asr time loses this audience permanently.
- [ ] **Real testimonials:** after the beta, replace the illustrative
      "scenario" cards with 3+ attributed quotes (with written permission).
- [ ] Legal: confirm Privacy Policy, Terms, and Refund Policy are accurate
      for how you actually operate (and for the free-during-early-access
      posture).
- [ ] Lighthouse pass (performance/PWA/a11y); confirm PWA install prompt
      works on iOS and Android.

---

## Decisions still open (not blockers, but decide deliberately)

- [ ] **Retention channel.** Web push is now fully wired in code (client +
      SW + server), leading with Sahib's daily focus — it just needs the
      4 deploy steps in **PUSH_SETUP.md** (VAPID keys, config, paste the
      public key, deploy the scheduled function). Do this before launch;
      it's how Sahib actually reaches people. Still recommended alongside:
      **optional email** (keep the name+code model as default) as a fallback
      for users who don't install the PWA (iOS only pushes to installed PWAs).
- [ ] **Monetization.** The paywall is intentionally bypassed
      (`isSirat()` returns `true`; the Stripe stack is live but unused).
      Decide "free during early access" vs. re-enabling gates before any
      paid launch — and revert `isSirat()` per the comment in `app.js`.

---

## Suggested rollout

1. Clear all **P0**. Deploy + verify data privacy.
2. Clear **P1** on desktop + phone yourself.
3. Add **optional email** so you can reach people.
4. Soft-launch to **~30–50 trusted fans** for two weeks.
5. Fix what breaks; collect real testimonials; clear **P2**.
6. Open to the full fanbase — now proven, with a retention loop.

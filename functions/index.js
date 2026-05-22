/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Cloud Functions
   ────────────────────────────────────────────────────────────────────────
   Three functions:

     1. createCheckoutSession (callable)
        Client calls FUNCTIONS.httpsCallable('createCheckoutSession').
        Server creates (or reuses) a Stripe Customer for the signed-in
        user, opens a Checkout Session, returns the URL.

     2. createPortalSession (callable)
        Opens Stripe's hosted billing portal so the user can update
        their card, cancel, or download invoices.

     3. stripeWebhook (HTTPS, raw body)
        Stripe posts subscription events here. We verify the signature,
        then flip users/{uid}.subscription.{status, currentPeriodEnd}
        so the client's checkSubscription() unlocks/locks access.

   ────────────────────────────────────────────────────────────────────────
   ONE-TIME SETUP

     # 1. Install
     cd functions && npm install

     # 2. Store the two secrets in Cloud Secret Manager (encrypted, never in
     #    git). Each command prompts for the value:
     firebase functions:secrets:set STRIPE_SECRET           # sk_live_...
     firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # whsec_... (from step 5)

     # 3. Set the four price IDs in functions/.env (not secret — they appear
     #    at checkout anyway). Copy .env.example to .env and fill in:
     #      STRIPE_PRICE_BASE_MONTHLY=price_...
     #      STRIPE_PRICE_BASE_ANNUAL=price_...
     #      STRIPE_PRICE_SIRAT_MONTHLY=price_...
     #      STRIPE_PRICE_SIRAT_ANNUAL=price_...

     # 4. Deploy
     firebase deploy --only functions

     # 5. In the Stripe dashboard, add a webhook endpoint pointing to:
     #      https://us-central1-sunnahtrader-f71f1.cloudfunctions.net/stripeWebhook
     #    Subscribe it to these events:
     #      checkout.session.completed
     #      customer.subscription.updated
     #      customer.subscription.deleted
     #      invoice.payment_failed
     #    Copy the signing secret (whsec_…) into STRIPE_WEBHOOK_SECRET (step 2),
     #    then redeploy: firebase deploy --only functions

   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const { defineSecret, defineString } = require('firebase-functions/params');

admin.initializeApp();
const db = admin.firestore();

// Secrets live in Cloud Secret Manager (`firebase functions:secrets:set`),
// never in git or the deprecated runtime config. Bound per-function below via
// runWith({ secrets: [...] }); .value() reads them at runtime.
const STRIPE_SECRET         = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Price IDs aren't secret (they appear at checkout), so they come from params
// backed by functions/.env — easy to vary per project/environment.
const PRICE_BASE_MONTHLY  = defineString('STRIPE_PRICE_BASE_MONTHLY',  { default: '' });
const PRICE_BASE_ANNUAL   = defineString('STRIPE_PRICE_BASE_ANNUAL',   { default: '' });
const PRICE_SIRAT_MONTHLY = defineString('STRIPE_PRICE_SIRAT_MONTHLY', { default: '' });
const PRICE_SIRAT_ANNUAL  = defineString('STRIPE_PRICE_SIRAT_ANNUAL',  { default: '' });

// Lazy-load Stripe so a missing secret surfaces as a clean error inside the
// request rather than crashing cold-start for unrelated functions.
let _stripe = null;
function stripe() {
  if (_stripe) return _stripe;
  const key = STRIPE_SECRET.value();
  if (!key) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe secret not configured. Run: firebase functions:secrets:set STRIPE_SECRET'
    );
  }
  _stripe = require('stripe')(key, { apiVersion: '2024-12-18.acacia' });
  return _stripe;
}

// Resolve the Stripe price ID for the requested (plan, tier). Two orthogonal
// axes: monthly|annual × base|sirat → 4 prices. Base is the original product
// at $27/$230, Sirat is the $38/$300 premium tier.
//
// Price IDs come from params (functions/.env):
//   STRIPE_PRICE_BASE_MONTHLY    — base monthly  ($27)
//   STRIPE_PRICE_BASE_ANNUAL     — base annual   ($230)
//   STRIPE_PRICE_SIRAT_MONTHLY   — sirat monthly ($38)
//   STRIPE_PRICE_SIRAT_ANNUAL    — sirat annual  ($300)
//
// Missing config falls back to monthly base (so checkout never hard-fails for
// a user) and logs a warning we can spot in Functions logs.
function priceId(plan, tier) {
  tier = (tier === 'sirat') ? 'sirat' : 'base';
  plan = (plan === 'annual') ? 'annual' : 'monthly';
  const baseMonthly = PRICE_BASE_MONTHLY.value();
  let key;
  if (tier === 'sirat') {
    key = (plan === 'annual') ? PRICE_SIRAT_ANNUAL.value() : PRICE_SIRAT_MONTHLY.value();
  } else {
    key = (plan === 'annual') ? PRICE_BASE_ANNUAL.value() : baseMonthly;
  }
  if (key) return key;
  console.warn('Stripe price not configured for tier='+tier+' plan='+plan+' — falling back to base monthly.');
  if (!baseMonthly) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe price not configured. Set STRIPE_PRICE_BASE_MONTHLY in functions/.env'
    );
  }
  return baseMonthly;
}

// Returns the existing Stripe customer id for this uid, or creates one
// and persists it back to Firestore so we never duplicate customers.
async function getOrCreateCustomer(uid, email) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data().stripeCustomerId : null;
  if (existing) return existing;

  const customer = await stripe().customers.create({
    email: email || undefined,
    metadata: { firebaseUID: uid }
  });
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

// ── 1. CHECKOUT SESSION ─────────────────────────────────────────────────
// Called by the client when the user clicks "Begin — Bismillah".
exports.createCheckoutSession = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30, secrets: [STRIPE_SECRET] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in to subscribe.');
    }
    const uid    = context.auth.uid;
    const email  = context.auth.token.email || null;
    const origin = (data && typeof data.origin === 'string')
      ? data.origin.replace(/\/+$/, '')
      : null;
    const plan   = (data && data.plan === 'annual') ? 'annual' : 'monthly';
    const tier   = (data && data.tier === 'sirat')  ? 'sirat'  : 'base';

    // Reject open redirects — only allow the origin tied to this Firebase
    // project (Vercel domain + localhost for dev). Add others if you ship
    // additional domains.
    const ALLOWED_ORIGINS = [
      'https://niyyahtrader.app',
      'https://www.niyyahtrader.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    // Also trust this project's own Vercel deployments — the production alias
    // (niyyah-psi.vercel.app) and branch previews (niyyah-git-<branch>.vercel.app)
    // — so the post-checkout redirect lands back on whatever URL the user
    // actually checked out from instead of a domain that may not be live yet.
    function isAllowedOrigin(o) {
      if (!o) return false;
      if (ALLOWED_ORIGINS.indexOf(o) > -1) return true;
      try {
        const host = new URL(o).hostname;
        if (/^niyyah[a-z0-9-]*\.vercel\.app$/.test(host)) return true;
      } catch (e) {}
      return false;
    }
    const safeOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

    const customerId = await getOrCreateCustomer(uid, email);

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId(plan, tier), quantity: 1 }],
      allow_promotion_codes: true,
      // Marketing copy promises a 7-day full refund (not a free trial).
      // Refunds are handled manually via the Stripe dashboard when a user
      // emails within 7 days. To switch to a true free trial instead, add:
      //   subscription_data: { trial_period_days: 7 }
      // and drop the refund-policy language from the landing page.
      subscription_data: {
        metadata: { firebaseUID: uid, plan, tier }
      },
      client_reference_id: uid,
      success_url: `${safeOrigin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${safeOrigin}/?cancelled=true`
    });

    return { url: session.url };
  });

// ── 2. BILLING PORTAL ───────────────────────────────────────────────────
// "Manage your plan" → Stripe-hosted page for card / cancel / invoices.
exports.createPortalSession = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30, secrets: [STRIPE_SECRET] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    }
    const uid = context.auth.uid;
    const origin = (data && typeof data.origin === 'string')
      ? data.origin.replace(/\/+$/, '')
      : 'https://niyyahtrader.app';

    const snap = await db.collection('users').doc(uid).get();
    const customerId = snap.exists ? snap.data().stripeCustomerId : null;
    if (!customerId) {
      throw new functions.https.HttpsError('failed-precondition', 'No active subscription found.');
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`
    });
    return { url: session.url };
  });

// ── 3. WEBHOOK ──────────────────────────────────────────────────────────
// Stripe posts subscription lifecycle events here. We verify the
// signature with the webhook secret, then sync subscription state into
// Firestore. The client's checkSubscription() reads from there.
//
// NOTE: this is intentionally an onRequest function, not onCall — Stripe
// posts raw JSON with no Firebase auth, and signature verification
// requires the unparsed request body (req.rawBody, populated automatically
// by Firebase Functions for HTTPS requests).
exports.stripeWebhook = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60, secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    const sig = req.headers['stripe-signature'];
    if (!webhookSecret || !sig) {
      res.status(400).send('Webhook not configured');
      return;
    }

    let event;
    try {
      event = stripe().webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object;
          const uid = session.client_reference_id ||
                      (session.metadata && session.metadata.firebaseUID);
          if (!uid) { console.warn('checkout.session.completed without uid'); break; }

          // Pull the subscription so we can store the period-end timestamp.
          // tier comes from either the subscription metadata (set during
          // checkout) or, as a fallback, the session metadata. Defaults to
          // 'base' so existing customers are never accidentally upgraded.
          let periodEnd = null, status = 'active', subId = session.subscription;
          let tier = (session.metadata && session.metadata.tier) || 'base';
          if (subId) {
            const sub = await stripe().subscriptions.retrieve(subId);
            status    = sub.status;
            periodEnd = sub.current_period_end;
            if (sub.metadata && sub.metadata.tier) tier = sub.metadata.tier;
          }

          await db.collection('users').doc(uid).set({
            stripeCustomerId: session.customer,
            subscription: {
              status,
              tier,
              stripeSubscriptionId: subId || null,
              currentPeriodEnd: periodEnd,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          }, { merge: true });
          // TODO(deploy): once the referral function is wired (see
          // functions/redeemReferral.js), uncomment to credit on first paid
          // checkout:
          //   try {
          //     const { creditReferralLogic } = require('./redeemReferral');
          //     await creditReferralLogic(uid, db, stripe());
          //   } catch (e) { console.error('Referral credit failed:', e); }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const uid = (sub.metadata && sub.metadata.firebaseUID) ||
                      await uidFromCustomer(sub.customer);
          if (!uid) { console.warn(event.type + ' without uid'); break; }

          // Keep tier in sync on every subscription mutation. Upgrades /
          // downgrades flip this and the client reads it via isSirat().
          const tier = (sub.metadata && sub.metadata.tier) || 'base';

          await db.collection('users').doc(uid).set({
            subscription: {
              status: sub.status, // active | past_due | canceled | unpaid | incomplete | incomplete_expired | trialing
              tier,
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: sub.current_period_end,
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          }, { merge: true });
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const uid = await uidFromCustomer(invoice.customer);
          if (!uid) break;
          await db.collection('users').doc(uid).set({
            subscription: {
              status: 'past_due',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          }, { merge: true });
          break;
        }

        default:
          // Ignore everything else (charge.refunded, invoice.paid, etc.)
          // Add explicit cases here as you need them.
          break;
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook handler error:', err);
      res.status(500).send('Webhook handler error');
    }
  });

// Reverse lookup: given a Stripe customer id, find the Firestore uid.
// We store stripeCustomerId on the user doc, so a single-field query is
// enough at any reasonable scale. Add an index in firestore.indexes.json
// if you ever see this slow down.
async function uidFromCustomer(customerId) {
  if (!customerId) return null;
  const snap = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

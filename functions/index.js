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

     # 2. Set Stripe config (NEVER commit these — they live in Firebase,
     #    not git). Paste each value once; Firebase stores it encrypted.
     firebase functions:config:set \
       stripe.secret="sk_live_...REPLACE_ME..." \
       stripe.webhook_secret="whsec_...REPLACE_ME..." \
       stripe.price_id="price_...REPLACE_ME..."

     # 3. Deploy
     firebase deploy --only functions

     # 4. In the Stripe dashboard, add a webhook endpoint pointing to:
     #      https://<your-region>-<your-project>.cloudfunctions.net/stripeWebhook
     #    Subscribe it to these events:
     #      checkout.session.completed
     #      customer.subscription.updated
     #      customer.subscription.deleted
     #      invoice.payment_failed
     #    Copy the signing secret (whsec_…) and re-run step 2 with it.

   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Lazy-load Stripe so config-read errors are deferrable and don't
// crash cold-start for unrelated functions.
let _stripe = null;
function stripe() {
  if (_stripe) return _stripe;
  const key = (functions.config().stripe || {}).secret;
  if (!key) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe secret not configured. Run: firebase functions:config:set stripe.secret="sk_..."'
    );
  }
  _stripe = require('stripe')(key, { apiVersion: '2024-12-18.acacia' });
  return _stripe;
}

// Resolve the Stripe price ID for the requested plan. Monthly is the default
// and the original config key (`stripe.price_id`) — annual lives under
// `stripe.price_id_annual` so existing deployments keep working unchanged.
//
// TODO(deploy): once you have a recurring annual price in Stripe, run:
//   firebase functions:config:set stripe.price_id_annual="price_..."
//   firebase deploy --only functions
// Until that config is set, requests with plan='annual' fall back to monthly
// (so the toggle never breaks checkout) and log a warning.
function priceId(plan) {
  const cfg = functions.config().stripe || {};
  if (plan === 'annual') {
    if (cfg.price_id_annual) return cfg.price_id_annual;
    console.warn("Annual plan requested but stripe.price_id_annual not configured — falling back to monthly.");
  }
  const p = cfg.price_id;
  if (!p) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe price_id not configured. Run: firebase functions:config:set stripe.price_id="price_..."'
    );
  }
  return p;
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
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
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

    // Reject open redirects — only allow the origin tied to this Firebase
    // project (Vercel domain + localhost for dev). Add others if you ship
    // additional domains.
    const ALLOWED_ORIGINS = [
      'https://niyyahtrader.app',
      'https://www.niyyahtrader.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    const safeOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    const customerId = await getOrCreateCustomer(uid, email);

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId(plan), quantity: 1 }],
      allow_promotion_codes: true,
      // Marketing copy promises a 7-day full refund (not a free trial).
      // Refunds are handled manually via the Stripe dashboard when a user
      // emails within 7 days. To switch to a true free trial instead, add:
      //   subscription_data: { trial_period_days: 7 }
      // and drop the refund-policy language from the landing page.
      subscription_data: {
        metadata: { firebaseUID: uid, plan }
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
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
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
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    const cfg = functions.config().stripe || {};
    const sig = req.headers['stripe-signature'];
    if (!cfg.webhook_secret || !sig) {
      res.status(400).send('Webhook not configured');
      return;
    }

    let event;
    try {
      event = stripe().webhooks.constructEvent(req.rawBody, sig, cfg.webhook_secret);
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
          let periodEnd = null, status = 'active', subId = session.subscription;
          if (subId) {
            const sub = await stripe().subscriptions.retrieve(subId);
            status    = sub.status;
            periodEnd = sub.current_period_end;
          }

          await db.collection('users').doc(uid).set({
            stripeCustomerId: session.customer,
            subscription: {
              status,
              stripeSubscriptionId: subId || null,
              currentPeriodEnd: periodEnd,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          }, { merge: true });
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const uid = (sub.metadata && sub.metadata.firebaseUID) ||
                      await uidFromCustomer(sub.customer);
          if (!uid) { console.warn(event.type + ' without uid'); break; }

          await db.collection('users').doc(uid).set({
            subscription: {
              status: sub.status, // active | past_due | canceled | unpaid | incomplete | incomplete_expired | trialing
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

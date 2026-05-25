/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Referral redemption — DRAFT, NOT DEPLOYED.
   ────────────────────────────────────────────────────────────────────────
   When a referred user pays their first invoice, this function credits both
   parties one free month via Stripe subscription coupon. The client never
   touches Stripe directly — it just reads/writes referralCode and
   referredBy on the user doc.

   Flow:
     1. Visitor lands on /?ref=ABC123 — client stashes the code.
     2. On signup, client writes users/{uid}.referredBy = "ABC123".
     3. Their first invoice.paid webhook fires (handled by stripeWebhook in
        index.js — extend it to invoke creditReferral on first paid invoice).
     4. creditReferral() finds the referrer by code, calls Stripe to apply a
        one-month 100%-off coupon to BOTH subscriptions, and stamps both user
        docs so we never double-credit.

   TODO(deploy):
     1. Create a one-time 100%-off, 1-month coupon in Stripe and copy its ID.
     2. firebase functions:config:set referral.coupon="coupon_..."
     3. Wire this export at the bottom of functions/index.js:
          exports.creditReferral = require('./redeemReferral').creditReferral;
        AND in the existing stripeWebhook handler, on a "first paid invoice",
        invoke require('./redeemReferral').creditReferralLogic(uid, db, stripe()).
     4. Deploy:
          firebase deploy --only functions
   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

// Look up the referrer's uid given their public 6-char code.
async function uidFromReferralCode(db, code){
  if(!code) return null;
  const snap = await db.collection('users')
    .where('settings.referralCode', '==', code.toUpperCase())
    .limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

// Apply a one-month free coupon to one subscription. Idempotent on coupon ID.
async function applyCouponToSubscription(stripe, subscriptionId, couponId){
  if(!subscriptionId || !couponId) return;
  // Stripe applies a discount per subscription; passing the coupon ID again
  // on an already-discounted sub overrides the previous one — caller should
  // ensure idempotency via the user-doc stamp described below.
  await stripe.subscriptions.update(subscriptionId, { coupon: couponId });
}

// Core credit logic. Idempotent: stamps both user docs with creditedAt so a
// retried webhook doesn't double-credit. Call this from the stripeWebhook
// handler in index.js on the user's first paid invoice.
async function creditReferralLogic(payingUid, db, stripe){
  const cfg = functions.config().referral || {};
  if(!cfg.coupon){
    console.warn('Referral coupon not configured — skipping credit.');
    return;
  }
  const payingDoc = await db.collection('users').doc(payingUid).get();
  if(!payingDoc.exists) return;
  const pay = payingDoc.data();
  // Already credited? Nothing to do.
  if(pay.referralCreditedAt) return;
  const code = pay.referredBy;
  if(!code) return;
  const referrerUid = await uidFromReferralCode(db, code);
  if(!referrerUid || referrerUid === payingUid) return;
  const refDoc = await db.collection('users').doc(referrerUid).get();
  if(!refDoc.exists) return;
  const ref = refDoc.data();

  const now = admin.firestore.FieldValue.serverTimestamp();
  // Stamp both docs FIRST. If the Stripe call fails, we'll see the stamp and
  // a missing coupon — surfaceable via a follow-up audit query. This beats
  // the alternative of crediting twice on a webhook retry.
  await Promise.all([
    db.collection('users').doc(payingUid).update({ referralCreditedAt: now }),
    db.collection('users').doc(referrerUid).update({ referralCreditedAt: now })
  ]);

  // Apply coupons. Either side may have no active subscription yet (referrer
  // could be on free trial / canceled / never paid) — skip those.
  try{
    if(pay.stripeSubscriptionId || (pay.subscription && pay.subscription.stripeSubscriptionId)){
      await applyCouponToSubscription(stripe, pay.subscription.stripeSubscriptionId, cfg.coupon);
    }
    if(ref.subscription && ref.subscription.stripeSubscriptionId){
      await applyCouponToSubscription(stripe, ref.subscription.stripeSubscriptionId, cfg.coupon);
    }
  }catch(err){
    console.error('Referral credit Stripe call failed:', err);
    // Don't unwind the stamps — manual reconciliation is safer than risking
    // a double credit on a retry.
  }
}

// Callable wrapper so the client (or you) can re-trigger credit on demand
// if the webhook missed for any reason. Auth required.
exports.creditReferral = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if(!context.auth){
      throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    }
    const db = admin.firestore();
    const stripeLib = require('stripe');
    const stripeKey = (functions.config().stripe || {}).secret;
    if(!stripeKey){
      throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured.');
    }
    const stripe = stripeLib(stripeKey, { apiVersion: '2024-12-18.acacia' });
    await creditReferralLogic(context.auth.uid, db, stripe);
    return { ok: true };
  });

exports.creditReferralLogic = creditReferralLogic;

/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Scheduled Push Nudge — DRAFT, NOT DEPLOYED.
   ────────────────────────────────────────────────────────────────────────
   This function reads every user with an opt-in push subscription, decides
   whether they need a nudge today (post-loss / streak-at-risk / muhasabah
   reminder / Friday), and sends a single push via web-push.

   TODO(deploy):
     1. Install dependency:
          cd functions && npm install web-push@^3.6.0
     2. Generate VAPID keys (web-push generate-vapid-keys --json) and store:
          firebase functions:config:set \
            push.vapid_public="..." \
            push.vapid_private="..." \
            push.vapid_subject="mailto:support@niyyahtrader.com"
     3. Wire this export at the bottom of functions/index.js:
          exports.sendDailyNudge = require('./dailyNudge').sendDailyNudge;
     4. Paste the same vapid_public into index.html PUSH_VAPID_PUBLIC
        so the client encrypts subscriptions with the right key.
     5. Deploy:
          firebase deploy --only functions:sendDailyNudge

   The schedule below runs every day at 17:00 UTC. Adjust .timeZone() and
   .schedule('every <n> hours') to suit. Each user is nudged at most once
   per UTC day — we de-dupe via lastNudgeAt on the user doc.
   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

// web-push must be installed: `npm install web-push` in functions/.
let _webpush = null;
function webpush(){
  if(_webpush) return _webpush;
  _webpush = require('web-push');
  const cfg = (functions.config().push || {});
  if(!cfg.vapid_public || !cfg.vapid_private){
    throw new functions.https.HttpsError('failed-precondition',
      'VAPID keys not configured. Run firebase functions:config:set push.vapid_public="..." push.vapid_private="..." push.vapid_subject="mailto:..."');
  }
  _webpush.setVapidDetails(
    cfg.vapid_subject || 'mailto:support@niyyahtrader.com',
    cfg.vapid_public,
    cfg.vapid_private
  );
  return _webpush;
}

// Decide whether the user needs a nudge today, and what to say. Returns
// { title, body, url } or null if no nudge is warranted. Read-only — does
// not mutate anything.
function decideNudge(userDoc, tradesSnap, prayersSnap){
  const today = new Date().toISOString().slice(0,10);
  const trades = tradesSnap.docs.map(d => d.data());
  const closed = trades.filter(t => t.status === 'closed');

  // 1. Post-loss reflection: today already saw a loss, no nudge yet.
  const todaysClosed = closed.filter(t => t.date === today);
  const todaysLoss   = todaysClosed.some(t => (t.pnl||0) < 0);
  if(todaysLoss){
    return {
      title: 'Niyyah · post-trade mirror',
      body: 'You took a loss today. Open the journal — write what your nafs wanted to do next.',
      url: '/journal'
    };
  }

  // 2. Streak at risk: user has a multi-day discipline streak but today is
  //    blank (no closed trade and no prayer logged).
  const streak = (userDoc.streak || 0);
  const todayPrayed = !!(prayersSnap.data() && prayersSnap.data()[today]);
  if(streak >= 3 && !todaysClosed.length && !todayPrayed){
    return {
      title: 'Niyyah · streak at risk',
      body: `Your ${streak}-day streak ends at midnight. Tap a single prayer to keep it alive.`,
      url: '/'
    };
  }

  // 3. Friday muhasabah window: Friday 17:00 UTC, user has >=2 closed trades
  //    this week.
  const dow = new Date().getDay(); // 5 = Friday
  if(dow === 5){
    return {
      title: 'Niyyah · Friday muhasabah',
      body: 'Open the weekly mirror. Five minutes — see what this week actually was.',
      url: '/'
    };
  }

  return null;
}

exports.sendDailyNudge = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .pubsub.schedule('0 17 * * *') // 17:00 UTC daily — adjust to your audience.
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const users = await db.collection('users')
      .where('settings.pushSubscription', '!=', null)
      .get();
    const today = new Date().toISOString().slice(0,10);
    let sent = 0, skipped = 0, failed = 0;
    for(const u of users.docs){
      const uid = u.id;
      const data = u.data();
      // De-dupe: one nudge per UTC day per user.
      if(data.lastNudgeAt === today){ skipped++; continue; }
      try{
        const [tradesSnap, prayersSnap] = await Promise.all([
          db.collection('users').doc(uid).collection('trades').get(),
          db.collection('users').doc(uid).collection('meta').doc('dailyPrayers').get()
        ]);
        const nudge = decideNudge(data, tradesSnap, prayersSnap);
        if(!nudge){ skipped++; continue; }
        const sub = data.settings.pushSubscription;
        await webpush().sendNotification(sub, JSON.stringify(nudge));
        await db.collection('users').doc(uid).update({ lastNudgeAt: today });
        sent++;
      }catch(err){
        // 410 = subscription expired/revoked. Clear it so we stop trying.
        if(err && (err.statusCode === 410 || err.statusCode === 404)){
          await db.collection('users').doc(uid).update({
            'settings.pushSubscription': admin.firestore.FieldValue.delete()
          }).catch(()=>{});
        }
        failed++;
      }
    }
    console.log(`Daily nudge: sent=${sent} skipped=${skipped} failed=${failed}`);
    return null;
  });

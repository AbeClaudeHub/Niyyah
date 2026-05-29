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

// Streak length, computed the same way the client does (see calcStreak in
// index.html): a "streak day" is any day with >=1 closed trade OR >=1 prayer
// tapped, counting back from today/yesterday. Note the client uses LOCAL dates
// while this scheduled job uses UTC — acceptable drift for a once-daily nudge.
function calcStreakFromData(trades, prayers, today){
  const tradeDays = {};
  (Array.isArray(trades) ? trades : [])
    .filter(t => t.status === 'closed')
    .forEach(t => { if(t.date) tradeDays[t.date] = true; });
  const prayerDays = {};
  Object.keys(prayers || {}).forEach(d => {
    if(Object.values(prayers[d] || {}).some(Boolean)) prayerDays[d] = true;
  });
  const allDays = Object.keys(Object.assign({}, tradeDays, prayerDays));
  if(!allDays.length) return 0;
  allDays.sort().reverse();
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  if(allDays[0] !== today && allDays[0] !== yest) return 0;
  let streak = 1;
  for(let i = 1; i < allDays.length; i++){
    const a = new Date(allDays[i-1] + 'T12:00:00Z');
    const b = new Date(allDays[i]   + 'T12:00:00Z');
    if((a - b) / 86400000 === 1) streak++; else break;
  }
  return streak;
}

// Decide whether the user needs a nudge today, and what to say. Returns
// { title, body, url } or null if no nudge is warranted. Read-only — reads
// trades and dailyPrayers as FIELDS on the user doc (the live storage shape).
function decideNudge(data, today){
  const trades  = Array.isArray(data.trades) ? data.trades : [];
  const prayers = data.dailyPrayers || {};
  const closed  = trades.filter(t => t.status === 'closed');

  // 1. Post-loss reflection: today already saw a loss.
  const todaysClosed = closed.filter(t => t.date === today);
  const todaysLoss   = todaysClosed.some(t => (t.pnl||0) < 0);
  if(todaysLoss){
    return {
      title: 'Niyyah · post-trade mirror',
      body: 'You took a loss today. Open the journal — write what your nafs wanted to do next.',
      url: '/journal'
    };
  }

  // 2. Streak at risk: a multi-day streak exists but today is still blank.
  const streak = calcStreakFromData(trades, prayers, today);
  const todayPrayed = !!(prayers[today] && Object.values(prayers[today]).some(Boolean));
  if(streak >= 3 && !todaysClosed.length && !todayPrayed){
    return {
      title: 'Niyyah · streak at risk',
      body: `Your ${streak}-day streak ends at midnight. Tap a single prayer to keep it alive.`,
      url: '/'
    };
  }

  // 3. Friday muhasabah window: Friday (UTC), 17:00 run.
  if(new Date().getUTCDay() === 5){
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
      const sub = data.settings && data.settings.pushSubscription;
      if(!sub){ skipped++; continue; }
      try{
        // trades and dailyPrayers are fields on the user doc, not subcollections.
        const nudge = decideNudge(data, today);
        if(!nudge){ skipped++; continue; }
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

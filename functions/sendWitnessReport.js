/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Witness Mode — DRAFT, NOT DEPLOYED.
   ────────────────────────────────────────────────────────────────────────
   Sirat-tier users can opt in to a weekly summary email going to a trusted
   person (spouse, mentor, accountability brother). The email contains
   DISCIPLINE METRICS ONLY — never P&L, never trade-by-trade detail.

   What goes in the email:
     - Trade count this week
     - % of trades that followed playbook (had a setup tagged)
     - Prayer consistency (days with all 5 / days with any)
     - Current Sirat stage
     - Whether this week's focus was honoured (binary)

   What NEVER goes in:
     - Profit / loss in dollars
     - Specific trade detail, instrument, entry/stop/target
     - Anything that could reveal account size

   TODO(deploy):
     1. Choose an email provider. Two clean options:
        a) Firebase Extension "Trigger Email" (uses SendGrid/Mailgun/SMTP).
           Install once, write a doc to `mail/{auto-id}` with {to, message}.
        b) SendGrid SDK directly:
              cd functions && npm install @sendgrid/mail
              firebase functions:config:set sendgrid.key="SG.xxx"
     2. Wire this export at the bottom of functions/index.js:
          exports.sendWitnessReport = require('./sendWitnessReport').sendWitnessReport;
     3. Deploy:
          firebase deploy --only functions:sendWitnessReport
     4. Schedule runs Sunday 09:00 UTC. Adjust .schedule() if you want a
        different cadence.
   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

// === Render the weekly summary HTML body for one user. ====================
function buildEmailHTML(user, weekStats){
  const stage  = (user.settings && user.settings.sirat && user.settings.sirat.currentStage) || '—';
  const witness = (user.settings && user.settings.witness) || {};
  const safeLabel = (witness.label || 'friend').replace(/[<>]/g, '');
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0f0d09;color:#f2ead6;padding:32px;max-width:560px;margin:0 auto;">
      <div style="font-family:Georgia,serif;font-size:1.4rem;color:#dab462;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">☽ Niyyah</div>
      <div style="font-family:Georgia,serif;font-size:1.8rem;color:#f2ead6;margin-bottom:24px;">Weekly witness report</div>
      <p style="color:#beb29a;line-height:1.7;">As-salamu alaykum, ${safeLabel}.</p>
      <p style="color:#beb29a;line-height:1.7;">This is the weekly discipline-only summary for your brother / sister in trading. Niyyah never shares their profit, loss, or specific trades — only whether they kept their word to themselves this week.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr><td style="padding:10px 0;border-bottom:1px solid rgba(218,180,98,0.18);color:#beb29a;">Trades logged</td><td style="text-align:right;color:#f2ead6;font-weight:600;">${weekStats.tradeCount}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid rgba(218,180,98,0.18);color:#beb29a;">Playbook-followed</td><td style="text-align:right;color:#f2ead6;font-weight:600;">${weekStats.playbookPct}%</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid rgba(218,180,98,0.18);color:#beb29a;">Full-prayer days</td><td style="text-align:right;color:#f2ead6;font-weight:600;">${weekStats.fullPrayerDays} / 7</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid rgba(218,180,98,0.18);color:#beb29a;">Current Sirat stage</td><td style="text-align:right;color:#dab462;font-weight:600;text-transform:capitalize;">${stage}</td></tr>
      </table>
      <p style="color:#8a7e67;font-size:0.85rem;line-height:1.65;margin-top:24px;">Witness mode is something they opted into. They can turn it off anytime in Settings. You can reply to this email if they ever want to talk.</p>
      <p style="color:#8a7e67;font-size:0.75rem;margin-top:32px;letter-spacing:0.1em;text-transform:uppercase;">niyyahtrader.com · trade with intention</p>
    </div>
  `;
}

// === Compute this past week's metrics for a user. =========================
// Reads from users/{uid}.trades and users/{uid}.dailyPrayers (whatever shape
// they have — adjust here if the storage shape differs).
function computeWeekStats(userData){
  const trades  = Array.isArray(userData.trades) ? userData.trades : [];
  const prayers = userData.dailyPrayers || {};
  const since = Date.now() - 7 * 86400000;
  const sinceISO = new Date(since).toISOString().slice(0,10);

  const week = trades.filter(t => {
    if(t.status !== 'closed' || t.sample) return false;
    return (t.date || '') >= sinceISO;
  });
  const followed = week.filter(t => !!(t.setup && (t.setup||'').trim())).length;
  const playbookPct = week.length ? Math.round(followed / week.length * 100) : 0;

  let fullPrayerDays = 0;
  Object.keys(prayers).forEach(d => {
    if(d >= sinceISO){
      const day = prayers[d] || {};
      const all5 = ['fajr','dhuhr','asr','maghrib','isha'].every(p => !!day[p]);
      if(all5) fullPrayerDays++;
    }
  });

  return {
    tradeCount: week.length,
    playbookPct,
    fullPrayerDays
  };
}

// === Sunday 09:00 UTC scheduled run. =====================================
exports.sendWitnessReport = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .pubsub.schedule('0 9 * * 0') // Sunday 09:00 UTC
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    // Find every user who has Witness Mode enabled (a witness email saved under
    // settings.witness.email). During early access every account has full
    // access, so we gate on the feature being turned on rather than on a paid
    // tier — otherwise this would match no one. We still re-check the email per
    // doc below.
    const snap = await db.collection('users')
      .where('settings.witness.email', '!=', null)
      .get();

    let sent = 0, skipped = 0, failed = 0;
    for(const doc of snap.docs){
      const data = doc.data();
      const w = (data.settings && data.settings.witness) || null;
      if(!w || !w.email){ skipped++; continue; }
      try{
        const stats = computeWeekStats(data);
        const html = buildEmailHTML(data, stats);
        // === TODO(deploy): pick your delivery path ===
        // Option A — Firebase Trigger Email extension:
        //   await db.collection('mail').add({
        //     to: w.email,
        //     message: {
        //       subject: 'Niyyah · weekly witness report',
        //       html: html
        //     }
        //   });
        // Option B — SendGrid direct:
        //   const sg = require('@sendgrid/mail');
        //   sg.setApiKey(functions.config().sendgrid.key);
        //   await sg.send({
        //     to: w.email,
        //     from: 'witness@niyyahtrader.com',
        //     subject: 'Niyyah · weekly witness report',
        //     html: html
        //   });
        console.log('[witness] would send to', w.email, 'stats=', stats);
        sent++;
      }catch(err){
        console.error('[witness] send failed for', doc.id, err);
        failed++;
      }
    }
    console.log(`Witness reports: sent=${sent} skipped=${skipped} failed=${failed}`);
    return null;
  });

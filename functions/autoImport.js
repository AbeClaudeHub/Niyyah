/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Auto-Import (Connect your chart / platform)
   ────────────────────────────────────────────────────────────────────────
   Two functions that let a trader's platform push real fills straight into
   their journal — no CSV, no manual logging:

     1. manageIngestToken (callable)
        Signed-in client asks the server to create / rotate / revoke a
        personal ingest token. The plaintext token is shown to the user
        ONCE; we persist only a SHA-256 hash (in the server-only
        `ingestTokens` collection) plus a 4-char hint on the user doc so the
        UI can say "connected · ••••3f9a".

     2. ingestFill (HTTPS, token-authed)
        The user's platform POSTs a fill here. Anything that can hit a URL
        works: TradingView alert webhooks, a MetaTrader 4/5 Expert Advisor,
        a Topstep / Tradovate / ProjectX forwarder, or a one-line curl.
        We resolve token → uid (Admin SDK, so Firestore rules don't block
        us), map the payload to a trade, run a few discipline checks so the
        trade lands already "flagged", and append it to users/{uid}.trades.

   "Keeps them in check": every auto-imported trade flows into the same
   Sahib leak engine + prayer radar as a hand-logged one, and we stamp
   immediate autoFlags (revenge re-entry, no prayer logged that day, daily
   loss-limit breach) so the discipline signal is there the instant it lands.

   ────────────────────────────────────────────────────────────────────────
   DEPLOY:  firebase deploy --only functions:ingestFill,functions:manageIngestToken
            firebase deploy --only firestore:rules
   Per-platform setup lives in AUTO_IMPORT_SETUP.md.
   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const crypto    = require('crypto');

// admin.initializeApp() is already called in index.js before this module is
// required, so we just grab the existing default app's Firestore handle.
const db = admin.firestore();

// Where the ingestFill webhook lives, derived from the deploy project so the
// client can show the user a copy-paste URL without hard-coding the project.
const REGION = 'us-central1'; // Firebase Functions v1 default
function projectId() {
  return process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'niyyah';
}
function webhookUrl() {
  return 'https://' + REGION + '-' + projectId() + '.cloudfunctions.net/ingestFill';
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

// ── 1. TOKEN MANAGEMENT (callable) ───────────────────────────────────────
exports.manageIngestToken = functions
  .runWith({ memory: '128MB', timeoutSeconds: 20 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    }
    const uid    = context.auth.uid;
    const action = (data && data.action) || 'create';
    const userRef = db.collection('users').doc(uid);

    if (action === 'revoke') {
      // Drop whatever token currently maps to this uid, and clear the flag.
      const existing = await db.collection('ingestTokens')
        .where('uid', '==', uid).get();
      const batch = db.batch();
      existing.forEach(doc => batch.delete(doc.ref));
      batch.set(userRef, { autoImport: admin.firestore.FieldValue.delete() }, { merge: true });
      await batch.commit();
      return { connected: false };
    }

    // create | rotate — always issue a fresh token and retire any old ones so
    // a leaked token stops working the moment the user rotates.
    const token = crypto.randomBytes(24).toString('hex'); // 48 hex chars
    const hash  = sha256(token);

    const old = await db.collection('ingestTokens').where('uid', '==', uid).get();
    const batch = db.batch();
    old.forEach(doc => batch.delete(doc.ref));
    batch.set(db.collection('ingestTokens').doc(hash), {
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    batch.set(userRef, {
      autoImport: {
        connected: true,
        tokenHint: token.slice(-4),
        webhookUrl: webhookUrl(),
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSource: null,
        lastImportAt: null
      }
    }, { merge: true });
    await batch.commit();

    // Plaintext token returned ONCE — never stored, never retrievable again.
    return { connected: true, token, webhookUrl: webhookUrl(), tokenHint: token.slice(-4) };
  });

// ── 2. FILL INGEST (HTTPS, token-authed) ─────────────────────────────────
// Not onCall: external platforms POST raw JSON with no Firebase auth. We
// authenticate with the per-user ingest token instead.
exports.ingestFill = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    // Lenient CORS so browser-based forwarders / test tools can POST.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Niyyah-Token');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST')    { res.status(405).json({ error: 'POST only' }); return; }

    // Body may arrive as a parsed object (application/json) or a raw string
    // (TradingView alerts default to text/plain). Handle both.
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch (_) { res.status(400).json({ error: 'Body must be JSON' }); return; }
    }
    body = body || {};

    // Token from header, bearer, query, or body — whatever the platform makes easy.
    const auth = req.headers['authorization'] || '';
    const token =
      req.headers['x-niyyah-token'] ||
      (auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '') ||
      req.query.token ||
      body.token || '';
    if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

    const tokenDoc = await db.collection('ingestTokens').doc(sha256(token)).get();
    if (!tokenDoc.exists) { res.status(401).json({ error: 'Invalid token' }); return; }
    const uid = tokenDoc.data().uid;

    // Accept a single fill or an array (some platforms batch).
    const fillsIn = Array.isArray(body.fills) ? body.fills
                  : Array.isArray(body)        ? body
                  : [body];

    try {
      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const snap = await tx.get(userRef);
        const d = snap.exists ? snap.data() : {};
        const trades = Array.isArray(d.trades) ? d.trades.slice() : [];
        const existingExt = {};
        trades.forEach(t => { if (t && t.extId) existingExt[t.extId] = true; });

        let imported = 0, skipped = 0, lastSource = null;
        const fresh = [];
        for (let i = 0; i < fillsIn.length; i++) {
          const t = mapFill(fillsIn[i], i);
          if (!t) { skipped++; continue; }
          // Idempotency: never double-import the same broker fill.
          if (t.extId && (existingExt[t.extId] || fresh.some(f => f.extId === t.extId))) {
            skipped++; continue;
          }
          t.autoFlags = disciplineFlags(t, trades.concat(fresh), d);
          t.needsReview = t.autoFlags.length > 0;
          fresh.push(t);
          imported++;
          lastSource = t.autoSource || lastSource;
        }

        if (imported > 0) {
          // Prepend so newest auto-imports sit at the top of the log, same as CSV.
          const merged = fresh.concat(trades);
          tx.set(userRef, {
            trades: merged,
            autoImport: {
              connected: true,
              tokenHint: (d.autoImport && d.autoImport.tokenHint) || token.slice(-4),
              lastSource: lastSource,
              lastImportAt: admin.firestore.FieldValue.serverTimestamp()
            }
          }, { merge: true });
        }
        return { imported, skipped };
      });

      res.status(200).json({ ok: true, imported: result.imported, skipped: result.skipped });
    } catch (err) {
      console.error('ingestFill error:', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });

// ── MAPPING ──────────────────────────────────────────────────────────────
// Turn a platform payload into Niyyah's trade shape. Field names mirror the
// CSV importer's accepted variants so the same payload works everywhere.
function pick(o, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return o[k];
  }
  return '';
}
function num(v) {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
// Accept YYYY-MM-DD, MM/DD/YYYY, or a full ISO timestamp; return {date,time}.
function normalizeDateTime(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    const now = new Date();
    return { date: now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()),
             time: pad2(now.getHours()) + ':' + pad2(now.getMinutes()) };
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/);
  if (m) return { date: m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]), time: pad2(+m[4]) + ':' + m[5] };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { date: m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]), time: '' };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { date: m[3] + '-' + pad2(+m[1]) + '-' + pad2(+m[2]), time: '' };
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return { date: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()),
             time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()) };
  }
  return { date: '', time: '' };
}
function mapFill(f, idx) {
  if (!f || typeof f !== 'object') return null;
  const inst = String(pick(f, ['instrument', 'symbol', 'ticker'])).trim().toUpperCase();
  const dt = normalizeDateTime(pick(f, ['date', 'tradedate', 'opendate', 'entrydate', 'time', 'timestamp', 'datetime']));
  if (!inst || !dt.date) return null; // same minimum as CSV: instrument + date

  let dir = String(pick(f, ['direction', 'side', 'action'])).trim().toUpperCase();
  if (dir !== 'LONG' && dir !== 'SHORT') {
    dir = (dir === 'S' || dir === 'SELL' || dir === 'SHORT') ? 'SHORT' : 'LONG';
  }
  const exitRaw = pick(f, ['exit', 'exitprice', 'closeprice']);
  const pnlRaw  = pick(f, ['pnl', 'netpnl', 'profit', 'pl', 'realized']);
  const isClosed = !!(String(exitRaw).trim() || String(pnlRaw).trim());
  const pnl = num(pnlRaw);
  const extId = String(pick(f, ['extId', 'id', 'orderid', 'fillid', 'tradeid', 'ticket'])).trim();
  const platform = String(pick(f, ['platform', 'source', 'broker'])).trim().toLowerCase();

  const t = {
    id: Date.now() + idx,
    status: isClosed ? 'closed' : 'open',
    date: dt.date,
    time: String(pick(f, ['time', 'entrytime'])).match(/^\d{1,2}:\d{2}$/) ? pick(f, ['time', 'entrytime']) : dt.time,
    instrument: inst,
    direction: dir,
    entryPrice:  String(pick(f, ['entry', 'entryprice', 'openprice', 'price', 'fillprice'])).trim(),
    stopPrice:   String(pick(f, ['stop', 'stoploss'])).trim(),
    targetPrice: String(pick(f, ['target', 'targetprice', 'tp'])).trim(),
    exitPrice:   String(exitRaw).trim(),
    setup:   String(pick(f, ['setup', 'strategy', 'tag'])).trim(),
    emotion: 'calm',
    outcome: isClosed ? (pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be') : '',
    lesson:  String(pick(f, ['lesson', 'notes', 'note', 'comment'])).trim(),
    pnl: pnl,
    islamicCheck: { bismillah: false, prayer: false, setup: false, stop: false },
    gateAnswers: {},
    prayers: {},
    screenshot: String(pick(f, ['screenshot', 'chart', 'charturl', 'image'])).trim() || null,
    createdAt: new Date().toISOString(),
    imported: true,
    source: 'auto',
    autoSource: platform || 'webhook'
  };
  if (extId) t.extId = extId;
  if (isClosed) t.closedAt = new Date().toISOString();
  return t;
}

// ── DISCIPLINE FLAGS ("keeps them in check") ─────────────────────────────
// Cheap, high-signal checks computed against the user's own history at import
// time. The deeper behavioural analysis still runs client-side via Sahib.
function disciplineFlags(t, priorTrades, userData) {
  const flags = [];

  // Revenge re-entry: an earlier trade on the same day closed at a loss.
  const sameDayLoss = priorTrades.some(p =>
    p && p.date === t.date && p.status === 'closed' && (p.pnl || 0) < 0);
  if (sameDayLoss) flags.push('revenge');

  // No prayer logged for the day this trade was taken.
  const dp = (userData && userData.dailyPrayers) || {};
  const day = dp[t.date];
  const fullDay = day && ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].every(p => day[p]);
  if (!fullDay) flags.push('noPrayer');

  // Daily loss-limit breach, if the user set one in settings.
  const limit = userData && userData.settings && parseFloat(userData.settings.dailyLossLimit);
  if (limit && limit > 0) {
    const dayPnl = priorTrades
      .filter(p => p && p.date === t.date)
      .reduce((s, p) => s + (p.pnl || 0), 0) + (t.pnl || 0);
    if (dayPnl <= -Math.abs(limit)) flags.push('lossLimit');
  }

  return flags;
}

/* ════════════════════════════════════════════════════════════════════════
   Niyyah · Password recovery (no email)
   ────────────────────────────────────────────────────────────────────────
   Users sign up with an auto-generated account code + a password. There is
   no email on the account, so a forgotten password can't be reset via the
   usual email link. Instead, a separate one-time RECOVERY CODE is shown once
   at signup. The client stores only a SHA-256 hash of it on the user doc
   (users/{uid}.recoveryHash) — never the code itself.

   This callable verifies the recovery code against that hash and, on a match,
   uses the Admin SDK to set a new password. It must run server-side: the
   client SDK cannot change a password for an account it isn't signed into.

   Wired into index.js as:
     exports.resetPasswordWithCode = require('./resetPassword').resetPasswordWithCode;

   No extra config or secrets — just deploy:
     firebase deploy --only functions
   ════════════════════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const crypto    = require('crypto');

// Same deterministic mapping the client uses: account code → synthetic email.
function codeToEmail(code){
  return String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '@niyyah.app';
}

function sha256Hex(s){
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

exports.resetPasswordWithCode = functions
  .runWith({ memory: '128MB', timeoutSeconds: 30 })
  .https.onCall(async (data) => {
    const code         = ((data && data.code)         || '').toString().trim();
    const recoveryCode = ((data && data.recoveryCode) || '').toString().trim();
    const newPassword  = ((data && data.newPassword)  || '').toString();

    if (!code || !recoveryCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Account code and recovery code are required.');
    }
    if (newPassword.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'New password must be at least 6 characters.');
    }

    const auth = admin.auth();
    const db   = admin.firestore();

    // Resolve the account code to a Firebase user.
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(codeToEmail(code));
    } catch (e) {
      throw new functions.https.HttpsError('not-found', 'No account found for that code.');
    }
    const uid = userRecord.uid;

    // Verify the recovery code against the stored hash (constant-time compare).
    const snap   = await db.collection('users').doc(uid).get();
    const stored = snap.exists ? snap.data().recoveryHash : null;
    if (!stored) {
      throw new functions.https.HttpsError('failed-precondition', 'This account has no recovery code set.');
    }
    const provided = Buffer.from(sha256Hex(recoveryCode));
    const expected = Buffer.from(String(stored));
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      throw new functions.https.HttpsError('permission-denied', 'That recovery code doesn’t match.');
    }

    await auth.updateUser(uid, { password: newPassword });
    return { ok: true };
  });

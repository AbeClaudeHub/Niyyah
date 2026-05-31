'use strict';

// ── GLOBAL ERROR BOUNDARY ──────────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('Uncaught error:', msg, src, line, err);
  try { if (typeof toast === 'function') toast('Something went wrong. Try refreshing.', 'e'); } catch(e) {}
};
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  try { if (typeof toast === 'function') toast('A background operation failed. Try again.', 'e'); } catch(e) {}
});

// ── FIREBASE CONFIG ────────────────────────────────────────────────────────
// The Firebase web SDK API key is a public project identifier — it is meant
// to ship in the browser. Per-user access is enforced server-side by
// Firestore Security Rules, not by this key.
// ── STATE ──────────────────────────────────────────────────────────────────
// Declared before Firebase initialisation so demo mode works even if the
// Firebase CDN fails to load.
var S={trades:[],journals:[],morning:{},challenge:null,goal:null,settings:{},
       dailyPrayers:{},playbook:[],nafs:{sabr:0,tawakkul:0,kibr:0,shukr:0},
       dhikr:{sub:0,alh:0,akb:0},openTradeId:null,
       selEmotion:null,selExEmotion:null,gateAns:{},
       icChecked:{bismillah:false,prayer:false,setup:false,stop:false},
       eqRange:'all',calMonth:new Date(),tradeFilter:'all',obStep:1,
       sahib:{commitment:null,history:[]},
       editPBId:null,_sub:{status:null,tier:'base'}};
var C={};

var firebaseConfig = {
  apiKey:            "AIzaSyDHRFYq_vJIaUpih1LjbfTGP9G1guFQ5J4",
  authDomain:        "sunnahtrader-f71f1.firebaseapp.com",
  projectId:         "sunnahtrader-f71f1",
  storageBucket:     "sunnahtrader-f71f1.firebasestorage.app",
  messagingSenderId: "233039236996",
  appId:             "1:233039236996:web:ca9b435aa6ac8122a997d1"
};

var AUTH, DB, FUNCTIONS, STORAGE;
try {
  if(typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');
  firebase.initializeApp(firebaseConfig);
  AUTH      = firebase.auth();
  DB        = firebase.firestore();
  FUNCTIONS = firebase.functions();
  // Storage is optional — used to keep trade screenshots out of the 1MB
  // Firestore document. If the SDK/bucket isn't available, screenshot
  // handling falls back to inline data URLs (see resolveScreenshotRef).
  try { STORAGE = firebase.storage(); } catch(e){ STORAGE = null; }
  try { DB.enablePersistence({synchronizeTabs:true}).catch(function(){}); } catch(e){}
} catch(fbErr) {
  console.warn('Firebase unavailable:', fbErr.message);
  // Minimal stubs so demo mode and routing work without Firebase
  var _fbUnavailMsg = 'Unable to connect. Please check your internet connection and try again.';
  var _fbReject = function(){ return Promise.reject({code:'auth/network-request-failed',message:_fbUnavailMsg}); };
  var _fbResolve = function(){ return Promise.resolve(); };
  AUTH = {
    onAuthStateChanged: function(cb){ setTimeout(function(){ cb(null); },50); return function(){}; },
    getRedirectResult: function(){ return Promise.resolve({user:null}); },
    createUserWithEmailAndPassword: _fbReject,
    signInWithEmailAndPassword: _fbReject,
    signInWithPopup: _fbReject,
    signInWithRedirect: _fbReject,
    signOut: _fbResolve,
    sendPasswordResetEmail: _fbResolve,
    currentUser: null
  };
  DB = null;
  FUNCTIONS = { httpsCallable: function(){ return function(){ return Promise.reject(new Error(_fbUnavailMsg)); }; } };
}
var UID = null;

// ── AUTH ───────────────────────────────────────────────────────────────────

// ── LANDING PAGE FUNCTIONS ────────────────────────────────────────────────
// True while a legal page (privacy, terms, refund) is being shown. Prevents
// the auth observer / checkSubscription from slamming landing or paywall back
// on top of the legal page.
var _showingLegalPage = false;
// Snapshot of which view was active right before the user opened a legal
// page, so backToLanding() can restore *that* exact view instead of guessing.
// Possible values: 'landing' | 'auth' | 'paywall' | 'onboard' | 'page:<id>'.
var _legalReturnTo = null;
function _captureCurrentView(){
  var lg=el('landing');     if(lg && !lg.classList.contains('hide')) return 'landing';
  var au=el('auth-screen'); if(au && au.classList.contains('show'))  return 'auth';
  var pw=el('paywall-screen'); if(pw && pw.classList.contains('show')) return 'paywall';
  var ob=el('onboard');     if(ob && ob.classList.contains('show'))  return 'onboard';
  var ap=document.querySelector('.page.active');
  if(ap) return 'page:' + ap.id.replace('page-','');
  return 'landing';
}
function pwStrengthMeter(pw){
  var wrap=el('pw-strength-wrap'),bar=el('pw-strength-bar'),lbl=el('pw-strength-label'),hint=el('pw-hint');
  if(!wrap)return;
  if(authMode!=='signup'||!pw){wrap.style.display='none';if(hint)hint.style.display='';return;}
  wrap.style.display='';if(hint)hint.style.display='none';
  var score=0;
  if(pw.length>=8)score++;if(pw.length>=12)score++;
  if(/[A-Z]/.test(pw))score++;if(/[0-9]/.test(pw))score++;if(/[^A-Za-z0-9]/.test(pw))score++;
  var levels=[{w:'20%',c:'var(--red)',l:'Too short'},
              {w:'40%',c:'#c87941',l:'Weak'},
              {w:'60%',c:'var(--gold)',l:'Fair'},
              {w:'80%',c:'#7bbe91',l:'Good'},
              {w:'100%',c:'var(--green)',l:'Strong'}];
  var idx=Math.min(score,4);
  bar.style.width=levels[idx].w;bar.style.background=levels[idx].c;
  lbl.style.color=levels[idx].c;lbl.textContent=levels[idx].l;
}
function showAuth(mode){
  _showingLegalPage = false;
  _legalReturnTo = null;
  document.body.classList.remove('legal-visitor');
  var as=el('auth-screen');
  // Was the auth screen already visible? If so we're just swapping modes \u2014
  // rewrite the current history entry instead of stacking another one. This
  // is the fix for "I click Begin, then Sign In, then back ten times to get
  // home." Browser back from auth should always land on the landing page.
  var wasOnAuth = as && as.classList.contains('show');
  var landing=el('landing');if(landing)landing.classList.add('hide');
  if(as) as.classList.add('show');
  // Always reset any loading state left over from a previous auth attempt \u2014
  // auth-loading sets pointer-events:none which silently blocks all clicks.
  var authCard = as ? as.querySelector('.auth-card') : null;
  if(authCard) authCard.classList.remove('auth-loading');
  _applyAuthMode(mode||'signin');
  if(wasOnAuth) _replace('/' + authMode);
  else _push('/' + authMode);
}

function showLegalPage(page){
  // Capture which view to restore on the way back. Only on first entry,
  // so navigating from one legal page to another preserves the original.
  if(!_showingLegalPage) _legalReturnTo = _captureCurrentView();
  _showingLegalPage = true;
  document.body.classList.add('legal-visitor');
  // Hide every full-screen overlay so the legal page actually shows.
  var landing=el('landing');if(landing)landing.classList.add('hide');
  var auth=el('auth-screen');if(auth)auth.classList.remove('show');
  var pw=el('paywall-screen');if(pw)pw.classList.remove('show');
  var ob=el('onboard');if(ob)ob.classList.remove('show');
  go(page,null);
}
function backToLanding(){
  if(window._demoMode) return;
  _showingLegalPage = false;
  document.body.classList.remove('legal-visitor');
  var ret = _legalReturnTo;
  _legalReturnTo = null;
  // Clear all overlay states first; we'll re-show exactly one below.
  var landing=el('landing');if(landing)landing.classList.add('hide');
  var auth=el('auth-screen');if(auth)auth.classList.remove('show');
  var pw=el('paywall-screen');if(pw)pw.classList.remove('show');
  var ob=el('onboard');if(ob)ob.classList.remove('show');

  if(ret === 'landing'){
    if(landing) landing.classList.remove('hide');
  } else if(ret === 'auth'){
    if(auth) auth.classList.add('show');
  } else if(ret === 'paywall'){
    if(pw) pw.classList.add('show');
  } else if(ret === 'onboard'){
    if(ob) ob.classList.add('show');
  } else if(ret && ret.indexOf('page:') === 0){
    var pname = ret.slice(5);
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    var pg = el('page-'+pname);
    if(pg) pg.classList.add('active');
    var tt = el('topbar-title');
    if(tt && PAGE_TITLES[pname]) tt.innerHTML = PAGE_TITLES[pname];
  } else {
    // No captured view (e.g. deep-link or direct refresh) — route by auth state.
    if(UID){
      if(typeof checkSubscription==='function') checkSubscription();
    } else {
      if(landing) landing.classList.remove('hide');
    }
  }
  window.scrollTo(0,0);
  _push('/');
}

function scrollToFeatures(){
  var f=document.getElementById('features-section');
  if(f)f.scrollIntoView({behavior:'smooth'});
}


var authMode = 'signin';

// Account / recovery codes are generated client-side. We avoid ambiguous
// characters (0/O, 1/I/L) so they're easy to copy off a screenshot by hand.
function _randChars(n){
  var alpha='ABCDEFGHJKMNPQRSTUVWXYZ23456789', out='', r=new Uint32Array(n);
  crypto.getRandomValues(r);
  for(var i=0;i<n;i++) out+=alpha[r[i]%alpha.length];
  return out;
}
// The account code is the user's login id (shown to them as such).
function _genAccountCode(){ return 'niyyah-'+_randChars(6); }
// The recovery code is a SEPARATE secret, used only to reset a lost password.
function _genRecoveryCode(){ return _randChars(4)+'-'+_randChars(4)+'-'+_randChars(4); }
// Deterministic map from an account code to its synthetic Firebase email.
// Case/format-insensitive so "niyyah-7F3K9Q" and "NIYYAH7F3K9Q" resolve to the
// same account. There is no real inbox at this address — it exists only so
// Firebase Auth's email/password provider has something to key on.
function _codeToEmail(code){
  return String(code||'').toLowerCase().replace(/[^a-z0-9]/g,'')+'@niyyah.app';
}
// SHA-256 hex — we store only a hash of the recovery code, never the code.
function _sha256Hex(str){
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function(buf){
    return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
  });
}

// Single source of truth for the sign-in vs create-account form layout.
// Signup collects a name (code is auto-generated); sign-in collects the code.
function _applyAuthMode(mode){
  authMode = (mode==='signup') ? 'signup' : 'signin';
  var lbl=el('auth-mode-label'), btn=el('auth-submit-btn'), sw=el('auth-switch'),
      nw=el('auth-name-wrap'), cw=el('auth-code-wrap'), pw=el('auth-password'),
      fg=el('auth-forgot'), err=el('auth-error'), sb=el('auth-success-banner'),
      hint=el('pw-hint'), swrap=el('pw-strength-wrap');
  if(err){err.style.color='';err.textContent='';}
  if(sb){sb.style.display='none';sb.innerHTML='';}
  if(authMode==='signup'){
    if(lbl) lbl.textContent='Create your account';
    if(btn) btn.textContent='Create Account';
    if(sw)  sw.innerHTML='Already have an account? <a data-hclick="h11">Sign in →</a>';
    if(nw)  nw.style.display='';      // name shown
    if(cw)  cw.style.display='none';  // code hidden — it's generated for them
    if(pw)  pw.setAttribute('autocomplete','new-password');
    if(fg)  fg.style.display='none';
    if(hint)hint.style.display='';
  }else{
    if(lbl) lbl.textContent='Sign in to your account';
    if(btn) btn.textContent='Sign In';
    if(sw)  sw.innerHTML="Don't have an account? <a onclick=\"authToggle()\">Create one →</a>";
    if(nw)  nw.style.display='none';
    if(cw)  cw.style.display='';      // code shown
    if(pw)  pw.setAttribute('autocomplete','current-password');
    if(fg)  fg.style.display='';
    if(swrap)swrap.style.display='none';
    if(hint)hint.style.display='';
  }
}

function authToggle(){ _applyAuthMode(authMode==='signin' ? 'signup' : 'signin'); }

function authSubmit(){
  var err  = el('auth-error');
  var btn  = el('auth-submit-btn');
  var card = btn ? btn.closest('.auth-card') : null;
  var password = el('auth-password') ? el('auth-password').value : '';
  if(err){err.style.color='';err.textContent='';}

  if(authMode==='signup'){
    var name = el('auth-name') ? el('auth-name').value.trim() : '';
    if(!name){ if(err)err.textContent='Please enter your name.'; return; }
    if(!password || password.length < 6){ if(err)err.textContent='Password must be at least 6 characters.'; return; }
    if(card)card.classList.add('auth-loading');
    var code     = _genAccountCode();
    var recovery = _genRecoveryCode();
    // Hash the recovery code before it ever touches the network — Firestore
    // only ever stores the hash, so a leaked DB can't reset anyone's password.
    _sha256Hex(recovery).then(function(recHash){
      AUTH.createUserWithEmailAndPassword(_codeToEmail(code), password)
        .then(function(cred){
          S.accountCode = code; // reflect immediately, before loadAll re-reads
          // Show the codes RIGHT NOW — before (and independent of) the Firestore
          // write — so a tab close mid-write can never hide them. The Continue
          // button stays locked until the recoveryHash write is confirmed.
          _showCredentials(code, recovery);
          var doc = { accountCode: code, recoveryHash: recHash, settings: { name: name }, credsAcknowledged: false };
          var ref = window._pendingReferral || null;
          if(ref){ doc.referredBy = ref; try{ sessionStorage.removeItem('niyyah_ref'); }catch(_){ } }
          DB.collection('users').doc(cred.user.uid).set(doc, {merge:true})
            .then(_credWriteOk)
            .catch(function(e){ console.error('signup doc save failed', e); _credWriteFailed(); });
        })
        .catch(function(e){
          if(card)card.classList.remove('auth-loading');
          // A collision on a 6-char code is astronomically unlikely, but if it
          // ever happens the user just taps again to get a fresh one.
          if(e && e.code === 'auth/email-already-in-use'){
            if(err)err.textContent='Hiccup generating your code — please tap Create Account again.';
            return;
          }
          if(err)err.textContent = friendlyAuthError(e.code);
        });
    }).catch(function(e){
      // WebCrypto (crypto.subtle) is unavailable on insecure origins — surface
      // it instead of leaving the card stuck in the loading state forever.
      if(card)card.classList.remove('auth-loading');
      console.error('recovery hash failed', e);
      if(err)err.textContent='Your browser blocked secure key generation. Make sure the page is loaded over https:// and try again.';
    });
  }else{
    var loginCode = el('auth-code') ? el('auth-code').value.trim() : '';
    if(!loginCode || !password){ if(err)err.textContent='Enter your account code and password.'; return; }
    if(card)card.classList.add('auth-loading');
    AUTH.signInWithEmailAndPassword(_codeToEmail(loginCode), password)
      .catch(function(e){
        if(err)err.textContent = friendlyAuthError(e.code);
        if(card)card.classList.remove('auth-loading');
      });
  }
}

// ── CREDENTIAL REVEAL (post-signup) ─────────────────────────────────────────
// onAuthStateChanged signs the new user straight in and boots the app behind
// this overlay; the user can't proceed until they confirm they saved the codes.
// True once the recoveryHash write for the codes currently on screen has
// landed in Firestore. The "Enter Niyyah" button stays locked until then, so
// a user can never proceed believing recovery works when the hash never saved.
var _credWriteConfirmed = false;
function _showCredentials(code, recovery){
  _credWriteConfirmed = false;
  var card = document.querySelector('#auth-screen .auth-card');
  if(card) card.classList.remove('auth-loading');
  var cc = el('cred-code');     if(cc) cc.textContent = code;
  var rc = el('cred-recovery'); if(rc) rc.textContent = recovery;
  var chk = el('cred-confirm'); if(chk) chk.checked = false;
  _setCredStatus('saving');
  _updateCredContinue();
  var scr = el('cred-screen');  if(scr) scr.classList.add('show');
}
function _setCredStatus(state){
  var s = el('cred-status'); if(!s) return;
  if(state==='saving'){ s.style.color='var(--ink-3)'; s.textContent='Securing your account…'; }
  else if(state==='ok'){ s.style.color='var(--green)'; s.textContent='✓ Account secured — you can sign back in with these.'; }
  else if(state==='fail'){ s.innerHTML='<span style="color:var(--red);">Couldn’t finish securing your account (connection?). </span><a data-hclick="h141" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Retry</a>'; }
}
// Continue is allowed only when the user has ticked "I saved them" AND the
// recoveryHash write is confirmed.
function _updateCredContinue(){
  var chk = el('cred-confirm'); var cont = el('cred-continue');
  if(!cont) return;
  var ready = !!(chk && chk.checked) && _credWriteConfirmed;
  cont.disabled = !ready;
  cont.style.opacity = ready ? '' : '0.5';
}
function _credWriteOk(){ _credWriteConfirmed = true; _setCredStatus('ok'); _updateCredContinue(); }
function _credWriteFailed(){ _credWriteConfirmed = false; _setCredStatus('fail'); _updateCredContinue(); }
// Re-attempt the recoveryHash write if it failed (offline at signup, etc.).
function _retryCredWrite(){
  if(!UID || !DB){ return; }
  var recovery = el('cred-recovery') ? el('cred-recovery').textContent : '';
  if(!recovery) return;
  _setCredStatus('saving');
  _sha256Hex(recovery).then(function(recHash){
    return DB.collection('users').doc(UID).set({ accountCode: S.accountCode, recoveryHash: recHash, credsAcknowledged:false }, {merge:true});
  }).then(_credWriteOk).catch(_credWriteFailed);
}
function credCopy(which){
  var node = (which==='recovery') ? el('cred-recovery') : el('cred-code');
  var text = node ? node.textContent : '';
  if(text && navigator.clipboard){
    navigator.clipboard.writeText(text)
      .then(function(){ if(typeof toast==='function') toast('✓ Copied','s'); })
      .catch(function(){});
  }
}
function credContinue(){
  if(!_credWriteConfirmed) return; // belt-and-suspenders; button is also disabled
  // Stamp acknowledgement so a returning user isn't re-prompted to save codes.
  if(UID && DB){ DB.collection('users').doc(UID).set({ credsAcknowledged:true }, {merge:true}).catch(function(){}); }
  S.credsAcknowledged = true;
  var scr = el('cred-screen');  if(scr) scr.classList.remove('show');
  var as  = el('auth-screen');  if(as)  as.classList.remove('show');
  // The app was already initialised by onAuthStateChanged → checkSubscription;
  // closing the overlays reveals it (onboarding or dashboard).
}
// Shown on a later visit if the user created an account but never confirmed
// they saved their codes (e.g. closed the tab during signup). The account code
// is re-displayable (it's just a login id); the recovery code can't be —
// only its hash was stored — so we mint and persist a fresh one.
function _resumeCredentials(){
  if(!S.accountCode || !UID || !DB) return;
  if(el('cred-screen') && el('cred-screen').classList.contains('show')) return;
  var recovery = _genRecoveryCode();
  _sha256Hex(recovery).then(function(recHash){
    _showCredentials(S.accountCode, recovery);
    DB.collection('users').doc(UID).set({ accountCode: S.accountCode, recoveryHash: recHash, credsAcknowledged:false }, {merge:true})
      .then(_credWriteOk).catch(_credWriteFailed);
  });
}

// ── PASSWORD RECOVERY (account code + recovery code → new password) ──────────
function openRecover(){
  var scr = el('recover-screen'); if(scr) scr.classList.add('show');
  var err = el('recover-error');  if(err){ err.style.color=''; err.textContent=''; }
  var typed = el('auth-code') ? el('auth-code').value.trim() : '';
  var rc = el('recover-code'); if(rc && typed) rc.value = typed;
}
function closeRecover(){ var scr = el('recover-screen'); if(scr) scr.classList.remove('show'); }
function submitRecover(){
  var code  = el('recover-code')     ? el('recover-code').value.trim()     : '';
  var rcode = el('recover-recovery') ? el('recover-recovery').value.trim() : '';
  var npw   = el('recover-newpw')    ? el('recover-newpw').value           : '';
  var err   = el('recover-error');
  if(err){ err.style.color=''; err.textContent=''; }
  if(!code || !rcode || !npw){ if(err){err.style.color='var(--red)';err.textContent='Fill in all three fields.';} return; }
  if(npw.length < 6){ if(err){err.style.color='var(--red)';err.textContent='New password must be at least 6 characters.';} return; }
  var btn = el('recover-submit');
  if(btn){ btn.disabled = true; btn.textContent = 'Resetting…'; }
  // The actual password change happens server-side (Admin SDK) — the client
  // can't reset a password it isn't signed into. See functions/resetPassword.js.
  var fn = FUNCTIONS.httpsCallable('resetPasswordWithCode');
  fn({ code: code, recoveryCode: rcode, newPassword: npw }).then(function(){
    return AUTH.signInWithEmailAndPassword(_codeToEmail(code), npw);
  }).then(function(){
    closeRecover();
  }).catch(function(e){
    if(btn){ btn.disabled = false; btn.textContent = 'Reset password'; }
    var msg = 'Could not reset — check your codes and try again.';
    if(e){
      if(e.code === 'permission-denied') msg = 'Invalid account code or recovery code.';
      else if(e.message)                 msg = e.message;
    }
    if(err){ err.style.color='var(--red)'; err.textContent = msg; }
  });
}

function friendlyAuthError(code){
  var msgs = {
    'auth/user-not-found':           'Incorrect account code or password.',
    'auth/wrong-password':           'Incorrect account code or password.',
    'auth/invalid-credential':       'Incorrect account code or password.',
    'auth/email-already-in-use':     'That account code is already taken — please try again.',
    'auth/weak-password':            'Password must be at least 6 characters.',
    'auth/too-many-requests':        'Too many attempts. Please try again in a few minutes.',
    'auth/network-request-failed':   'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':    'Sign-in is temporarily unavailable. Email support@niyyahtrader.com if this persists.',
    'auth/user-disabled':            'This account has been disabled. Email support@niyyahtrader.com.',
    'auth/requires-recent-login':    'For security, please sign in again to continue.'
  };
  return msgs[code] || ('Sign-in error (' + code + '). Please try again.');
}

// ── STREAK ──────────────────────────────────────────────────────────────────
function calcStreak(){
  // A "streak day" is any day where the user logged at least one closed trade
  // OR tapped at least one prayer — consistent with what renderStreakRisk() promises.
  var tradeDays={};
  S.trades.filter(function(t){return t.status==='closed';})
    .forEach(function(t){tradeDays[t.date]=true;});
  var prayerDays={};
  Object.keys(S.dailyPrayers||{}).forEach(function(d){
    if(Object.values(S.dailyPrayers[d]).some(Boolean)) prayerDays[d]=true;
  });
  var allDays=Object.keys(Object.assign({},tradeDays,prayerDays));
  if(!allDays.length)return 0;
  allDays.sort().reverse();
  var today=localDate();
  var yest=new Date();yest.setDate(yest.getDate()-1);
  var yd=yest.getFullYear()+'-'+pad(yest.getMonth()+1)+'-'+pad(yest.getDate());
  if(allDays[0]!==today&&allDays[0]!==yd)return 0;
  var streak=1;
  for(var i=1;i<allDays.length;i++){
    var a=new Date(allDays[i-1]+'T12:00:00'),b=new Date(allDays[i]+'T12:00:00');
    if((a-b)/(86400000)===1)streak++;else break;
  }
  return streak;
}
function calcDisciplineStreak(){
  // Count consecutive days where quality score >= 60 on ALL trades that day
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  if(!closed.length)return 0;
  var dayMap={};
  closed.forEach(function(t){
    if(!dayMap[t.date])dayMap[t.date]=[];
    dayMap[t.date].push(t.quality||0);
  });
  var days=Object.keys(dayMap).sort().reverse();
  var today=localDate();
  var yest=new Date();yest.setDate(yest.getDate()-1);
  var yd=yest.getFullYear()+'-'+pad(yest.getMonth()+1)+'-'+pad(yest.getDate());
  if(days[0]!==today&&days[0]!==yd)return 0;
  var streak=0;
  for(var i=0;i<days.length;i++){
    var dayQs=dayMap[days[i]];
    var avgQ=dayQs.reduce(function(s,v){return s+v;},0)/dayQs.length;
    if(avgQ>=60)streak++;
    else break;
  }
  return streak;
}

function renderStreak(){
  var s=calcStreak();var e=document.getElementById('streak-wrap');if(!e)return;
  var dStreak=calcDisciplineStreak();
  if(s<1&&dStreak<1){e.innerHTML='';return;}

  var html='';

  if(s>=1){
    var msg=s>=30?'Mashallah. A full month of discipline.':s>=14?'Two weeks of consistency. Sabr is real.':s>=7?'One week straight. The nafs is being tamed.':s>=2?'Keep going. Build the habit.':'Day one of your streak. Return tomorrow to make it two.';
    html+='<div class="streak-banner"><div class="streak-num">'+s+'</div><div class="streak-info"><div class="streak-label">Trading Streak</div><div class="streak-sub">'+msg+'</div></div></div>';
  }

  if(dStreak>=2&&dStreak!==s){
    var dmsg=dStreak>=14?'Two weeks of quality execution.':dStreak>=7?'A full week trading with discipline.':'Quality trades on '+dStreak+' consecutive days.';
    html+='<div class="streak-banner" style="border-color:rgba(112,184,142,0.25);background:linear-gradient(135deg,rgba(112,184,142,0.08),rgba(112,184,142,0.02));margin-top:8px;"><div class="streak-num" style="color:var(--green);">'+dStreak+'</div><div class="streak-info"><div class="streak-label" style="color:var(--green);">Discipline Streak</div><div class="streak-sub">'+dmsg+'</div></div></div>';
  }

  e.innerHTML=html;
}

// ── EDIT TRADE ────────────────────────────────────────────────────────────
var currentTDId=null;
var _editPnlId=null;
function editTrade(id){
  var t=S.trades.find(function(x){return x.id===id;});if(!t||t.status==='open')return;
  _editPnlId=id;
  var setField=function(eid,val){var e=el(eid);if(e)e.value=val||'';};
  setField('edit-inst',t.instrument);
  var dirSel=el('edit-dir');if(dirSel)dirSel.value=t.direction||'LONG';
  setField('edit-date',t.date);
  setField('edit-setup',t.setup);
  setField('edit-entry',t.entryPrice);
  setField('edit-stop',t.stopPrice);
  setField('edit-target-edit',t.targetPrice);
  setField('edit-exit',t.exitPrice);
  setField('edit-lesson',t.lesson);
  var pnlIn=el('edit-pnl-input');if(pnlIn)pnlIn.value=(t.pnl!=null?t.pnl:'');
  var m=el('edit-pnl-modal');if(m)m.classList.add('show');
  document.body.style.overflow='hidden';
  setTimeout(function(){var e=el('edit-inst');if(e){e.focus();e.select();}},80);
}
function closeEditPnl(){
  var m=el('edit-pnl-modal');if(m)m.classList.remove('show');
  document.body.style.overflow='';
  _editPnlId=null;
}
function saveEditPnl(){
  if(_editPnlId===null)return;
  var t=S.trades.find(function(x){return x.id===_editPnlId;});if(!t){closeEditPnl();return;}
  var getVal=function(eid){var e=el(eid);return e?e.value.trim():'';};
  var rawPnl=getVal('edit-pnl-input');
  var parsed=rawPnl!==''?parseFloat(rawPnl):null;
  if(rawPnl!==''&&isNaN(parsed)){toast('Enter a valid P&L number','e');return;}
  // Save snapshot for rollback
  var prior=JSON.parse(JSON.stringify(t));
  t.instrument=getVal('edit-inst')||t.instrument;
  t.direction=el('edit-dir')?el('edit-dir').value:t.direction;
  t.date=getVal('edit-date')||t.date;
  t.setup=getVal('edit-setup')||null;
  t.entryPrice=getVal('edit-entry')||t.entryPrice;
  t.stopPrice=getVal('edit-stop')||t.stopPrice;
  t.targetPrice=getVal('edit-target-edit')||t.targetPrice;
  t.exitPrice=getVal('edit-exit')||t.exitPrice;
  t.lesson=getVal('edit-lesson')||t.lesson;
  if(parsed!==null) t.pnl=parsed;
  t.quality=calcQ(t);
  var btn=el('edit-pnl-save'),orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerHTML='<span class="spinner"></span>Saving…';}
  sv('trades',S.trades).then(function(){
    closeEditPnl();closeTD();toast('✓ Trade updated','s');
    if(el('page-dashboard').classList.contains('active'))renderDash();
    if(el('page-trades').classList.contains('active'))renderTrades();
  }).catch(function(){
    // Rollback on failure
    var idx=S.trades.findIndex(function(x){return x.id===prior.id;});
    if(idx>-1)S.trades[idx]=prior;
  }).then(function(){
    if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerHTML=orig;}
  });
}

function doSignOut(){
  confirmModal({title:'Sign out?',text:'You can sign back in anytime — your data stays safe.',okText:'Sign out',icon:'☽'}).then(function(ok){if(ok)_doSignOut();});
}
function _doSignOut(){
  if(_subListener){ _subListener(); _subListener=null; }
  AUTH.signOut();
}

// ── SUBSCRIPTION ──────────────────────────────────────────────────────────
// Live mirror of the user's subscription, used by isSirat() and other gates.
// Populated by checkSubscription() on auth state change. Treat as read-only
// outside of checkSubscription. (S itself is declared further down — guard
// access at call time, not script-parse time.)
// EARLY ACCESS MODE: all users have Sirat-tier access.
// To monetise later, revert to: function isSirat(){ return !!(S && S._sub && S._sub.status === 'active' && S._sub.tier === 'sirat'); }
function isSirat(){ return true; }

var _subListener = null; // Firestore onSnapshot unsubscribe handle

function checkSubscription(){
  if(window._demoMode) return;
  S._sub = { status: 'active', tier: 'sirat' };
  var pw = el('paywall-screen'); if(pw) pw.classList.remove('show');
  // init() → loadAll() reads the user doc and handles the onboarded check internally
  init();
}

// ── PLAN + TIER SELECTION ─────────────────────────────────────────────────
// Two orthogonal axes:
//   SELECTED_PLAN ∈ {monthly, annual}  — billing period (shared toggle)
//   SELECTED_TIER ∈ {base, sirat}      — feature tier (per-card pick)
// Both are forwarded to createCheckoutSession() so the backend can resolve
// to the right Stripe price ID via priceId(plan, tier).
//
// Prices below are the SINGLE SOURCE OF TRUTH for what we display on the
// landing + paywall. If you change a price in Stripe, change it here too.
var PRICES = {
  base:  { monthly: 27, annual: 230, monthlyAnchor: 324 },
  sirat: { monthly: 38, annual: 300, monthlyAnchor: 456 }
};
var SELECTED_PLAN = 'annual';
var SELECTED_TIER = 'base';

function _fmtPrice(tier, plan){
  var p = PRICES[tier] || PRICES.base;
  return plan==='annual' ? ('$'+p.annual+'<span>/yr</span>') : ('$'+p.monthly+'<span>/mo</span>');
}

function setPlan(plan){
  if(plan!=='monthly' && plan!=='annual') return;
  SELECTED_PLAN = plan;
  var isA = plan==='annual';

  // Toggle button states (landing + paywall)
  ['plan-toggle-monthly','pw-plan-monthly'].forEach(function(id){
    var b=el(id);if(b){b.classList.toggle('active',!isA);b.setAttribute('aria-selected',!isA);}
  });
  ['plan-toggle-annual','pw-plan-annual'].forEach(function(id){
    var b=el(id);if(b){b.classList.toggle('active', isA);b.setAttribute('aria-selected', isA);}
  });

  // Landing tier prices
  var lbn=el('landing-base-num');   if(lbn) lbn.innerHTML = _fmtPrice('base', plan);
  var lba=el('landing-base-anchor'); if(lba) lba.style.display = isA ? '' : 'none';
  var lsn=el('landing-sirat-num');  if(lsn) lsn.innerHTML = _fmtPrice('sirat', plan);
  var lsa=el('landing-sirat-anchor');if(lsa) lsa.style.display = isA ? '' : 'none';

  // Paywall tier prices
  var pbn=el('pw-base-num');  if(pbn) pbn.innerHTML = _fmtPrice('base', plan);
  var pba=el('pw-base-anchor'); if(pba) pba.style.display = isA ? '' : 'none';
  var psn=el('pw-sirat-num'); if(psn) psn.innerHTML = _fmtPrice('sirat', plan);
  var psa=el('pw-sirat-anchor');if(psa) psa.style.display = isA ? '' : 'none';

  refreshSubscribeBtn();
}

function setTier(tier){
  if(tier!=='base' && tier!=='sirat') return;
  SELECTED_TIER = tier;
  // Paywall card selection state
  var cardB = el('pw-tier-base'),   cardS = el('pw-tier-sirat');
  if(cardB) cardB.classList.toggle('selected', tier==='base');
  if(cardS) cardS.classList.toggle('selected', tier==='sirat');
  var lblB = el('pw-base-select'),  lblS = el('pw-sirat-select');
  if(lblB) lblB.textContent = tier==='base'  ? 'Selected' : 'Select';
  if(lblS) lblS.textContent = tier==='sirat' ? 'Selected' : 'Select';
  refreshSubscribeBtn();
}

// Initialize paywall to whatever tier is selected (defaults to base).
(function _initTier(){ try{ setTier(SELECTED_TIER); }catch(_){ /* DOM not ready, will run again */ } })();

function refreshSubscribeBtn(){
  var sb=el('subscribe-btn'); if(!sb || sb.disabled) return;
  var tierLabel = SELECTED_TIER==='sirat' ? 'Sirat' : 'Base';
  var p = PRICES[SELECTED_TIER];
  var priceLabel = SELECTED_PLAN==='annual' ? ('$'+p.annual+'/yr') : ('$'+p.monthly+'/mo');
  sb.innerHTML = 'Begin '+tierLabel+' — Bismillah · '+priceLabel;
}

// Called from a landing tier card's CTA. Captures their pick, then opens signup.
function pickTierAndSignup(tier){
  setTier(tier);
  showAuth('signup');
}

function subscribe(){ /* Demo mode — no payment required */ }
function manageSubscription(){ toast('This is a free demo — no subscription to manage.', 'i'); }

// Handle URL params (email verification, etc.)
(function(){
  var params = new URLSearchParams(window.location.search);
  if(false && params.get('success') === 'true'){
    history.replaceState({}, '', window.location.pathname);
    // Webhook may take a moment — poll up to 10s
    var attempts = 0;
    var poll = setInterval(function(){
      attempts++;
      if(!UID){clearInterval(poll);return;}
      DB.collection('users').doc(UID).get().then(function(doc){
        var sub = (doc.exists && doc.data().subscription) || {};
        if(sub.status === 'active'){
          clearInterval(poll);
          var pw = el('paywall-screen');
          if(pw) pw.classList.remove('show');
          toast('✓ Welcome to Niyyah Pro! Bismillah.', 's');
          init();
        }else if(attempts >= 12){
          clearInterval(poll);
          toast('Payment received \u2014 refresh in a moment if the app does not open.', 's');
        }
      });
    }, 1000);
  }
  if(params.get('cancelled') === 'true'){
    history.replaceState({}, '', window.location.pathname);
  }
})();

// Auth state observer — runs when page loads and when auth changes
AUTH.onAuthStateChanged(function(user){
  // A real sign-in supersedes the "sample data" preview. Without this, signing
  // in while the demo is active leaves the fake demo trades (e.g. the +$150
  // today) sitting in state, masquerading as the new account's data.
  if(user && window._demoMode){
    window._demoMode = false;
    var demoBanner=el('demo-banner'); if(demoBanner) demoBanner.style.display='none';
    document.body.style.paddingTop='';
    S.trades=[];S.journals=[];S.morning={};S.challenge=null;S.goal=null;
    S.settings={};S.dailyPrayers={};S.playbook=[];S.openTradeId=null;
    S._sub={status:null,tier:'base'};
  }
  if(window._demoMode) return; // signed out + demo active: demo owns its own state
  var authScreen = el('auth-screen');
  var pwScreen   = el('paywall-screen');
  if(user){
    // No email verification: account-code/password users are signed in the
    // moment Firebase confirms them. (Their synthetic email is never verified
    // and never needs to be.)
    UID = user.uid;
    if(authScreen) authScreen.classList.remove('show');
    var lg=el('landing');if(lg)lg.classList.add('hide');
    checkSubscription();
  }else{
    UID = null;
    if(authScreen) authScreen.classList.remove('show');
    if(pwScreen)   pwScreen.classList.remove('show');
    // Clear state when signed out (always — separate from view routing below).
    S.trades=[];S.journals=[];S.morning={};S.challenge=null;S.goal=null;
    S.settings={};S.dailyPrayers={};S.playbook=[];S.openTradeId=null;
    if(_showingLegalPage){
      // Visitor intentionally navigated to a legal page; leave them there.
      return;
    }
    var lg=el('landing');if(lg)lg.classList.remove('hide');
  }
});

// ── DEMO MODE ─────────────────────────────────────────────────────────────────
window._demoMode = false;

function _demoDate(daysAgo){
  var dt=new Date(); dt.setDate(dt.getDate()-daysAgo);
  return dt.toISOString().split('T')[0];
}

function startDemo(){
  window._demoMode = true;
  UID = 'demo-user';

  // Grant Sirat-level access so every feature is visible
  if(!S._sub) S._sub = {};
  S._sub.status = 'active';
  S._sub.tier   = 'sirat';

  var d = _demoDate;

  S.settings     = { name:'Khalid', leak:'revenge' };
  S.openTradeId  = null;
  S.tradeFilter  = 'all';
  S.calMonth     = new Date();
  S.nafs         = {sabr:0,tawakkul:0,kibr:0,shukr:0};
  S.dhikr        = {sub:0,alh:0,akb:0};
  S.gateAns      = {};
  S.icChecked    = {bismillah:false,prayer:false,setup:false,stop:false};

  S.trades = [
    {id:101,date:d(0), time:'09:45',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5320',stopPrice:'5310',targetPrice:'5340',status:'closed',pnl:150, exitPrice:'5340',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Setup played out perfectly. Waited for the full ORB breakout and executed clean.',quality:88},
    {id:102,date:d(1), time:'10:15',instrument:'NQ', direction:'SHORT',setup:'VWAP',  entryPrice:'18240',stopPrice:'18280',targetPrice:'18180',status:'closed',pnl:-80, exitPrice:'18260',outcome:'loss',emotion:'fomo',     exitEmotion:'frustrated', lesson:'Chased a VWAP short that was already extended. Did not wait for the retest.',quality:42},
    {id:103,date:d(2), time:'09:32',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5298',stopPrice:'5290',targetPrice:'5318',status:'closed',pnl:200, exitPrice:'5318',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Clean ORB setup. Prayed all 5 today. Executed with no hesitation.',quality:92},
    {id:104,date:d(3), time:'11:05',instrument:'MGC',direction:'LONG', setup:'BPB',   entryPrice:'2031',stopPrice:'2026',targetPrice:'2041',status:'closed',pnl:-50, exitPrice:'2028',outcome:'loss',emotion:'revenge',  exitEmotion:'frustrated', lesson:'Took this to recover from yesterday. Classic revenge — setup was marginal.',quality:28},
    {id:105,date:d(4), time:'09:50',instrument:'ES', direction:'SHORT',setup:'VWAP',  entryPrice:'5310',stopPrice:'5318',targetPrice:'5294',status:'closed',pnl:320, exitPrice:'5294',outcome:'win', emotion:'focused',  exitEmotion:'content',    lesson:'Best trade of the week. Clear VWAP short, respected my stop, let it run to target.',quality:94},
    {id:106,date:d(5), time:'10:30',instrument:'NQ', direction:'LONG', setup:'ORB',   entryPrice:'18190',stopPrice:'18170',targetPrice:'18230',status:'closed',pnl:-60, exitPrice:'18178',outcome:'loss',emotion:'calm',     exitEmotion:'calm',       lesson:'Setup was valid, just did not move. Stopped out at plan. No regrets.',quality:82},
    {id:107,date:d(6), time:'09:38',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5285',stopPrice:'5276',targetPrice:'5305',status:'closed',pnl:190, exitPrice:'5304',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Pre-market prep paid off. Knew the level, waited, took it.',quality:90},
    {id:108,date:d(8), time:'10:55',instrument:'MGC',direction:'SHORT',setup:'BPB',   entryPrice:'2018',stopPrice:'2023',targetPrice:'2008',status:'closed',pnl:-50, exitPrice:'2021',outcome:'loss',emotion:'anxious',  exitEmotion:'frustrated', lesson:'Did not feel clear. Missed Fajr and Dhuhr today. Should not have traded.',quality:35},
    {id:109,date:d(9), time:'09:45',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5271',stopPrice:'5263',targetPrice:'5291',status:'closed',pnl:200, exitPrice:'5291',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Full prayer day, calm session. Executed perfectly.',quality:91},
    {id:110,date:d(10),time:'10:22',instrument:'NQ', direction:'LONG', setup:'Breakout',entryPrice:'18085',stopPrice:'18065',targetPrice:'18125',status:'closed',pnl:400, exitPrice:'18125',outcome:'win', emotion:'focused',  exitEmotion:'content',    lesson:'Breakout from consolidation. Held through the pullback and got full target.',quality:89},
    {id:111,date:d(11),time:'11:40',instrument:'ES', direction:'SHORT',setup:'VWAP',  entryPrice:'5280',stopPrice:'5288',targetPrice:'5264',status:'closed',pnl:-80, exitPrice:'5286',outcome:'loss',emotion:'revenge',  exitEmotion:'frustrated', lesson:'Revenge trade after the morning stop. Knew it as I was taking it.',quality:22},
    {id:112,date:d(12),time:'09:48',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5265',stopPrice:'5258',targetPrice:'5283',status:'closed',pnl:180, exitPrice:'5283',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Routine ORB. Waited for the open, got the breakout, executed.',quality:88},
    {id:113,date:d(13),time:'10:15',instrument:'MGC',direction:'LONG', setup:'BPB',   entryPrice:'2015',stopPrice:'2010',targetPrice:'2025',status:'closed',pnl:100, exitPrice:'2025',outcome:'win', emotion:'patient',  exitEmotion:'content',    lesson:'Gold BPB plays beautifully when dollar is weak. Patient entry.',quality:85},
    {id:114,date:d(15),time:'09:33',instrument:'NQ', direction:'SHORT',setup:'VWAP',  entryPrice:'18020',stopPrice:'18050',targetPrice:'17980',status:'closed',pnl:-90, exitPrice:'18044',outcome:'loss',emotion:'fomo',     exitEmotion:'frustrated', lesson:'Chased the short too early. VWAP rejection was not confirmed.',quality:38},
    {id:115,date:d(16),time:'09:52',instrument:'ES', direction:'LONG', setup:'ORB',   entryPrice:'5250',stopPrice:'5242',targetPrice:'5270',status:'closed',pnl:200, exitPrice:'5270',outcome:'win', emotion:'calm',     exitEmotion:'content',    lesson:'Clean week opener. Good prep, all prayers done, clean entry.',quality:93}
  ];

  // Build 21 days of prayer data — mirrors the trade days
  var pr = {};
  for(var i=0;i<21;i++){
    var dStr = d(i);
    var badDay = [3,8,11,14].indexOf(i) > -1;
    pr[dStr] = {
      fajr:    !badDay,
      dhuhr:   !badDay || i===5,
      asr:     true,
      maghrib: true,
      isha:    true
    };
  }
  S.dailyPrayers = pr;

  S.playbook = [
    {id:1,name:'ORB',    inst:'ES/NQ', desc:'Opening Range Breakout — 5-min range break with volume', entry:'Wait for 5min close above/below range\nVolume confirmation\nNo major news', avoid:'Low volume\nWithin 30min of news', rr:'2'},
    {id:2,name:'VWAP',   inst:'ES/NQ', desc:'VWAP retest rejection — aligned with daily trend',       entry:'Price bounces off VWAP cleanly\nAligned with daily trend\n1min confirmation', avoid:'Chasing after extended move\nCounter-trend', rr:'2'},
    {id:3,name:'BPB',    inst:'MGC',   desc:'Bull/Bear pattern break — key level break and retest',   entry:'Break and close beyond level\nWait for retest candle\nEnter on that candle', avoid:'First candle entries\nLow-volume sessions', rr:'2'},
    {id:4,name:'Breakout',inst:'NQ',   desc:'Range breakout on higher timeframe level',               entry:'HTF resistance broken\nVolume surge on break\n5min pullback entry', avoid:'Late entries\nLow ADR days', rr:'2.5'}
  ];

  S.journals = [
    {date:d(2), intention:'Trade with patience. Only ORB setups on ES.', fix:'Stop entering before confirmation.', shukr:'Alhamdulillah for another day of health and provision'},
    {date:d(7), intention:'Full session focus. No revenge after any stops.', fix:'Revenge trade on day 4 cost me — the gate is there for a reason.', shukr:'Grateful for a profitable week'},
    {date:d(14),intention:'Light day. 2 trades max.', fix:'Missed prayers twice this week — it shows in the results.', shukr:'Family, health, ability to learn'}
  ];

  // Show app, hide landing
  var lg=el('landing'); if(lg) lg.classList.add('hide');
  var authSc=el('auth-screen'); if(authSc) authSc.classList.remove('show');
  var pwSc=el('paywall-screen'); if(pwSc) pwSc.classList.remove('show');
  var obEl=el('onboard'); if(obEl) obEl.classList.remove('show');

  // Show demo banner — push entire body down so banner doesn't overlap sidebar or topbar
  var banner=el('demo-banner');
  if(banner){ banner.style.display='flex'; }
  document.body.style.paddingTop = '42px';

  // Set sidebar display name
  var av=el('sf-av'); if(av) av.textContent='K';
  var nm=el('sf-name'); if(nm) nm.textContent='Khalid';
  var pl=el('sf-plan-label'); if(pl) pl.textContent='Demo Mode · Sirat';

  // Init app views
  try{ updateNav(); }catch(e){}
  try{ _refreshBrakeBadge(); }catch(e){}
  var td=el('topbar-date');
  if(td){
    var greg=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    var hij=hijriToday();
    td.innerHTML=greg+(hij?' <span style="color:var(--gold-deep);margin:0 4px;opacity:0.7;">·</span> <span style="color:var(--gold-deep);">'+hij+'</span>':'');
  }
  try{ renderDash(); }catch(e){ console.error('Demo renderDash:',e); }
  go('dashboard', document.querySelector('[data-page=dashboard]'));
}

function exitDemo(){
  window._demoMode = false;
  UID = null;
  S.trades=[];S.journals=[];S.morning={};S.challenge=null;S.goal=null;
  S.settings={};S.dailyPrayers={};S.playbook=[];S.openTradeId=null;
  S._sub = {status:null,tier:'base'};
  var banner=el('demo-banner'); if(banner) banner.style.display='none';
  document.body.style.paddingTop = '';
  var lg=el('landing'); if(lg) lg.classList.remove('hide');
  showAuth('signup');
}

// ── STATE initialised before Firebase (see above) ──

// ── STORAGE (Firestore) ────────────────────────────────────────────────────
var _saveErrorAt = 0; // debounce error toasts so we don't spam
function _saveErrorToast(e,label){
  console.error('Save error ['+label+']:',e);
  var now=Date.now();
  if(now-_saveErrorAt<=5000)return;
  _saveErrorAt=now;
  if(typeof toast==='function'){
    var msg=(e&&e.code==='unavailable')
      ? 'Offline — changes will sync when you reconnect'
      : 'Could not sync — check your connection';
    toast(msg,'e');
  }
}
function sv(k,v){
  if(window._demoMode) return Promise.resolve();
  if(!UID||!DB)return Promise.resolve();
  var u={};
  u[k] = (v===null) ? firebase.firestore.FieldValue.delete() : v;
  return DB.collection('users').doc(UID).set(u,{merge:true}).catch(function(e){
    _saveErrorToast(e,k);throw e;
  });
}
// Atomic multi-field write. All fields in `obj` land in the same Firestore
// set() call, so partial failure can't leave the doc inconsistent.
function svMulti(obj){
  if(window._demoMode) return Promise.resolve();
  if(!UID||!DB)return Promise.resolve();
  var u={};
  Object.keys(obj).forEach(function(k){
    u[k]=(obj[k]===null)?firebase.firestore.FieldValue.delete():obj[k];
  });
  return DB.collection('users').doc(UID).set(u,{merge:true}).catch(function(e){
    _saveErrorToast(e,Object.keys(obj).join('+'));throw e;
  });
}

function loadAll(){
  if(window._demoMode) return Promise.resolve(true);
  if(!UID||!DB)return Promise.resolve(false);
  return DB.collection('users').doc(UID).get().then(function(doc){
    var d = doc.exists ? doc.data() : {};
    S.trades       = d.trades        || [];
    S.journals     = d.journals      || [];
    S.morning      = d.morning       || {};
    S.challenge    = d.challenge     || null;
    S.goal         = d.goal          || null;
    S.settings     = d.settings      || {};
    S.dailyPrayers = d.dailyPrayers  || {};
    S.playbook     = d.playbook      || [];
    S.openTradeId  = d.openTradeId   || null;
    S.accountCode  = d.accountCode   || null;
    S.credsAcknowledged = d.credsAcknowledged === true;
    // Restore in-progress state so a refresh doesn't wipe taps mid-session
    if(d.gateAns)                       S.gateAns     = d.gateAns;
    if(d.dhikr)                         S.dhikr       = Object.assign({sub:0,alh:0,akb:0}, d.dhikr);
    if(d.nafs)                          S.nafs        = Object.assign({sabr:0,tawakkul:0,kibr:0,shukr:0}, d.nafs);
    if(d.sahib && typeof d.sahib==='object') S.sahib  = Object.assign({commitment:null,history:[]}, d.sahib);
    if(d.icChecked)                     S.icChecked   = Object.assign({bismillah:false,prayer:false,setup:false,stop:false}, d.icChecked);
    if(d.tradeFilter)                   S.tradeFilter = d.tradeFilter;
    if(typeof d.obStep === 'number')    S.obStep      = d.obStep;
    // Lightweight, non-identifying activity metadata. We deliberately do NOT
    // persist the synthetic account email here — the product promise is "no
    // email", and the account code already lives in its own field.
    DB.collection('users').doc(UID).set({
      lastSeen: new Date().toISOString(),
      tradeCount: (d.trades||[]).length
    },{merge:true}).catch(function(){});
    return d.onboarded === true;
  }).catch(function(e){
    console.error('Load error:',e);
    return false;
  });
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function el(id){return document.getElementById(id);}

// HTML-escape any user-controlled string before it touches innerHTML. Each
// user's data is scoped to their own UID, so the worst case is self-XSS via a
// pasted CSV or typed-in instrument like "<img onerror=...>" — but self-XSS
// still hijacks the session that owns the data. Cheap, always-on defence.
function esc(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/[&<>"']/g,function(c){
    return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;';
  });
}

// ── HISTORY / ROUTING ──────────────────────────────────────────────────────
// Keep the URL in sync with the current view so the browser Back/Forward
// buttons navigate within the app instead of leaving the site.
//
// CRITICAL: the very first thing we do is replaceState() to mark the initial
// history entry as ours (state.niyyah = true). Without this, iOS Safari's
// back stack treats the initial entry as "not ours" and a second back press
// from any overlay leaves the site entirely. Users have reported this as
// "glitches and takes me back to Safari."
(function _ownInitialHistory(){
  try{
    var cur = window.location.pathname || '/';
    window.history.replaceState({path: cur, niyyah: true, view: 'initial'}, '', cur);
  }catch(_){}
})();
var _suppressHistory = false;
function _push(path){
  if(_suppressHistory) return;
  if(!window.history || !window.history.pushState) return;
  if(window.location.pathname === path) return;
  try{ window.history.pushState({path:path, niyyah:true}, '', path); }catch(e){}
}
// Same as _push but rewrites the current entry instead of adding one. Use
// when toggling between sub-states of the same overlay (e.g. signin ↔ signup,
// or transitioning from auth → paywall after a successful sign-up). Back from
// the result should return to landing, not to the intermediate state.
function _replace(path){
  if(_suppressHistory) return;
  if(!window.history || !window.history.replaceState) return;
  try{ window.history.replaceState({path:path, niyyah:true}, '', path); }catch(e){}
}
window.addEventListener('popstate', function(){
  _suppressHistory = true;
  try{
    var path = (window.location.pathname||'/').replace(/^\//,'');
    var legal = ['privacy','terms','refund'];
    if(legal.indexOf(path) > -1){
      if(typeof showLegalPage === 'function') showLegalPage(path);
    } else if(path === 'signin' || path === 'signup'){
      if(typeof showAuth === 'function') showAuth(path);
    } else if(path && typeof PAGE_FNS !== 'undefined' && PAGE_FNS[path] && UID){
      if(typeof go === 'function') go(path, null);
    } else {
      // Root / unknown — route to wherever the user actually belongs.
      if(typeof backToLanding === 'function') backToLanding();
    }
  } finally {
    _suppressHistory = false;
  }
});
function localDate(d){var n=d||new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());}
function pad(n){return String(n).padStart(2,'0');}
function fmtDate(s){if(!s)return'\u2014';var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function fmt(v,sign){var a=Math.abs(v),f=a>=10000?'$'+(a/1000).toFixed(1)+'K':'$'+a.toLocaleString('en-US',{maximumFractionDigits:0});return sign?(v>=0?'+':'-')+f:f;}
function toast(m,t){var e=el('toast');if(!e)return;e.textContent=m;e.className='toast show '+(t||'s');setTimeout(function(){e.classList.remove('show');},2700);}

// ── MILESTONE CELEBRATIONS — for first close, 5/20/50/100 trades ────────
// These exist because the first close is the single biggest psychological
// moment for a new user. Default success toast disappears; the milestone
// stays until acknowledged, giving the activation actual weight.
var MILESTONES={
  1:{eye:'MASHALLAH · FIRST CLOSE',title:'Your first <em>close</em>.',text:function(t){return'Quality <strong>'+(t.quality||0)+'/100</strong>. The mirror is starting to form. Log <strong>4 more closes</strong> and your behavioral patterns unlock — revenge sequences, prayer correlation, calm-vs-emotional gap.';},stat:function(t){return'1 OF 5 TRADES TO PATTERN UNLOCK';}},
  5:{eye:'PATTERNS UNLOCKED',title:'Your <em>mirror</em> is live.',text:function(t){return'5 closed trades. The insights panel, the prayer radar, and the muhasabah engine now have enough data to reflect <strong>your</strong> patterns — not generic ones. Open the dashboard. See what your nafs has been doing.';},stat:function(t){return'PATTERN ENGINE · ACTIVE';}},
  20:{eye:'TWENTY TRADES',title:'You\'ve been <em>honest</em>.',text:function(t){return'20 closed trades logged. Most traders cherry-pick their journal by trade 10. You did not. That honesty is the work — it\'s why the analytics page now tells you the truth.';},stat:function(t){return'DEEP ANALYTICS · UNLOCKED';}},
  50:{eye:'FIFTY TRADES · ALHAMDULILLAH',title:'Your edge is <em>measurable</em> now.',text:function(t){return'50 closes. Statistical significance. Every metric — profit factor, expectancy, prayer-day delta — is now real signal, not noise. Read your analytics with confidence.';},stat:function(t){return'STATISTICAL SIGNIFICANCE';}},
  100:{eye:'ONE HUNDRED TRADES',title:'A real <em>track record</em>.',text:function(t){return'100 closed trades, journaled with discipline. This is a body of evidence about who you are as a trader. Few make it here. Mashallah.';},stat:function(t){return'CENTURY · COMPLETE';}}
};

function showMilestone(n,trade){
  var m=MILESTONES[n];if(!m)return;
  var modal=el('milestone-modal');if(!modal)return;
  var eye=el('milestone-eye'),title=el('milestone-title'),text=el('milestone-text'),stat=el('milestone-stat');
  if(eye)eye.textContent=m.eye;
  if(title)title.innerHTML=m.title;
  if(text)text.innerHTML=m.text(trade||{});
  if(stat){var s=m.stat?m.stat(trade||{}):'';if(s){stat.textContent=s;stat.style.display='';}else{stat.style.display='none';}}
  modal.classList.add('show');
  document.body.style.overflow='hidden';
}
function closeMilestone(){
  var m=el('milestone-modal');if(m)m.classList.remove('show');
  document.body.style.overflow='';
}

// Promise-based custom confirm — replaces native browser confirm()
// Usage: confirmModal({title:'...', text:'...', okText:'Delete', danger:true, icon:'⚠'}).then(function(ok){ if(ok) ... });
function confirmModal(opts){
  opts = opts || {};
  return new Promise(function(resolve){
    var m = el('confirm-modal');
    if(!m){ resolve(window.confirm(opts.text || opts.title || 'Are you sure?')); return; }
    el('confirm-title').textContent = opts.title || 'Are you sure?';
    el('confirm-text').textContent  = opts.text || '';
    el('confirm-icon').textContent  = opts.icon || '⚠';
    var ok = el('confirm-ok'), cn = el('confirm-cancel');
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-gold');
    ok.textContent = opts.okText || 'Confirm';
    cn.textContent = opts.cancelText || 'Cancel';
    // Optional type-to-confirm gate for catastrophic actions
    var wrap = el('confirm-input-wrap');
    var input = el('confirm-input');
    var lbl = el('confirm-input-label');
    var requireText = opts.requireText || '';
    var needsType = !!requireText;
    if(wrap && input){
      if(needsType){
        wrap.style.display = '';
        input.value = '';
        if(lbl) lbl.textContent = 'Type ' + requireText + ' to confirm';
        input.placeholder = requireText;
        ok.disabled = true;
        input.oninput = function(){
          ok.disabled = input.value.trim().toUpperCase() !== requireText.toUpperCase();
        };
      } else {
        wrap.style.display = 'none';
        ok.disabled = false;
        input.oninput = null;
      }
    }
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
    function cleanup(result){
      m.classList.remove('show');
      document.body.style.overflow = '';
      ok.onclick = null; cn.onclick = null; m.onclick = null;
      if(input) input.oninput = null;
      ok.disabled = false;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e){
      if(e.key === 'Escape') cleanup(false);
      else if(e.key === 'Enter' && !ok.disabled) cleanup(true);
    }
    ok.onclick = function(){ if(!ok.disabled) cleanup(true); };
    cn.onclick = function(){ cleanup(false); };
    m.onclick  = function(e){ if(e.target === m) cleanup(false); };
    document.addEventListener('keydown', onKey);
    setTimeout(function(){ if(needsType && input) input.focus(); else cn.focus(); }, 50);
  });
}
function setText(id,t){var e=el(id);if(e)e.textContent=t;}

// ── ONBOARDING ─────────────────────────────────────────────────────────────
var OB=[
  {
    eye:'BISMILLAH · WELCOME',
    title:'A mirror, not a <em>journal</em>.',
    text:'Niyyah is built for traders who already know the strategy but keep breaking their own rules.<br><br>It tracks the three things every other journal ignores: your <strong>salah</strong>, your <strong>nafs</strong>, and the <strong>gap</strong> between what you said you would do and what you actually did.'
  },
  {
    eye:'THE DAILY LOOP',
    title:'Four moments. <em>Every day.</em>',
    text:'<div style="text-align:left;display:flex;flex-direction:column;gap:10px;"><div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:22px;height:22px;border-radius:50%;background:rgba(218,180,98,0.15);border:1px solid rgba(218,180,98,0.3);display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--gold);flex-shrink:0;">1</div><div style="font-size:0.86rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--ink);">Morning</strong> — set your niyyah. Tap prayers as you pray them.</div></div><div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:22px;height:22px;border-radius:50%;background:rgba(218,180,98,0.15);border:1px solid rgba(218,180,98,0.3);display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--gold);flex-shrink:0;">2</div><div style="font-size:0.86rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--ink);">Before a trade</strong> — three honest questions. Your own history holds you accountable.</div></div><div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:22px;height:22px;border-radius:50%;background:rgba(218,180,98,0.15);border:1px solid rgba(218,180,98,0.3);display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--gold);flex-shrink:0;">3</div><div style="font-size:0.86rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--ink);">In trade</strong> — dhikr counter keeps you off the P&amp;L tick by tick.</div></div><div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:22px;height:22px;border-radius:50%;background:rgba(218,180,98,0.15);border:1px solid rgba(218,180,98,0.3);display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--gold);flex-shrink:0;">4</div><div style="font-size:0.86rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--ink);">Evening</strong> — muhasabah. The app reflects what your nafs actually did.</div></div></div>'
  },
  {
    eye:'PERSONAL · BE HONEST',
    title:'What\'s your <em>biggest leak</em>?',
    text:'<div style="font-size:0.84rem;color:var(--ink-3);margin-bottom:14px;line-height:1.6;">Pick the one that costs you the most. Niyyah will calibrate your dashboard to it.</div><div id="ob-leak-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;"><button class="ob-leak-btn" data-leak="revenge" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">Revenge trading</div><div style="font-size:0.72rem;color:var(--ink-4);">Adding after a loss</div></button><button class="ob-leak-btn" data-leak="fomo" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">FOMO entries</div><div style="font-size:0.72rem;color:var(--ink-4);">Chasing the move</div></button><button class="ob-leak-btn" data-leak="rules" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">Breaking my rules</div><div style="font-size:0.72rem;color:var(--ink-4);">Moving stops, oversizing</div></button><button class="ob-leak-btn" data-leak="overconf" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">Kibr after wins</div><div style="font-size:0.72rem;color:var(--ink-4);">Sizing up, getting cocky</div></button><button class="ob-leak-btn" data-leak="missing" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">Missing salah</div><div style="font-size:0.72rem;color:var(--ink-4);">For a chart, regularly</div></button><button class="ob-leak-btn" data-leak="boredom" data-hclick="h142" style="padding:14px 14px;background:linear-gradient(145deg,#1a1810,#0f0d09);border:1.5px solid rgba(255,255,255,0.08);border-radius:11px;color:var(--ink-2);font-family:\'Inter\',sans-serif;font-size:0.82rem;cursor:pointer;text-align:left;transition:all 0.18s;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:var(--ink);font-weight:600;margin-bottom:2px;">Boredom trades</div><div style="font-size:0.72rem;color:var(--ink-4);">Forcing setups</div></button></div>'
  },
  {
    eye:'JUMP-START · OPTIONAL',
    title:'Already have a <em>trade history</em>?',
    btnLabel:'I\'ll start fresh →',
    text:'<div style="text-align:left;font-size:0.86rem;color:var(--ink-2);line-height:1.8;">Import your last few weeks and the mirror lights up <strong style="color:var(--ink);">today</strong> instead of next week. Niyyah reads your real trades and surfaces your first behavioral leak right away — the revenge sequences, the time-of-day that quietly bleeds you, the days your discipline slips.<br><br>Export a CSV from your broker or platform, then drop it in. Your salah and nafs data fill in as you go.</div><div style="margin-top:18px;"><button class="btn btn-gold" data-hclick="h67" style="width:100%;justify-content:center;">Import my trades (CSV) →</button></div><div style="margin-top:10px;font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.14em;color:var(--ink-4);text-align:center;">NO HISTORY YET? START FRESH BELOW — WE\'LL SHOW YOU THE ROPES WITH A SAMPLE.</div>'
  },
  {
    eye:'SEE IT WORK · EXAMPLE',
    title:'What a logged trade <em>looks like</em>.',
    text:'<div style="text-align:left;font-size:0.85rem;color:var(--ink-2);line-height:1.75;">Here\'s a complete trade in Niyyah — the setup, your gate answers, your emotional state, and the <strong style="color:var(--ink);">Quality Score</strong> it earns. Yours will look like this.<br><br>This is just an illustration — <strong style="color:var(--ink);">nothing is added to your journal.</strong> Your stats start at zero, honestly, with your first real trade.</div><div style="margin-top:18px;display:flex;flex-direction:column;gap:8px;text-align:left;background:rgba(218,180,98,0.04);border:1px solid rgba(218,180,98,0.14);border-radius:10px;padding:12px 14px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;color:var(--ink-3);line-height:1.6;"><div><span style="color:var(--gold);">EXAMPLE</span> · ES LONG · entry 5320 · stop 5310 · target 5340</div><div><span style="color:var(--gold);">SETUP</span> · ORB · emotion: calm · gate: all yes</div><div><span style="color:var(--gold);">RESULT</span> · +$150 · quality ~88/100</div></div>'
  },
  {
    eye:'YOUR FIRST 60 SECONDS',
    title:'Three taps to <em>begin</em>.',
    text:'<div style="text-align:left;font-size:0.88rem;color:var(--ink-2);line-height:1.85;">→ Tap the <strong style="color:var(--gold);">+</strong> button to log a real trade — entry now, close when done.<br>→ Tap a prayer pill on the dashboard when you pray it.<br>→ That is it. Your patterns sharpen with every trade you log.</div><div style="margin-top:14px;font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.16em;color:var(--ink-4);">YOU CAN OPEN THE GUIDE ANYTIME FROM THE SIDEBAR.</div>'
  }
];

// NOTE: onboarding no longer injects a fake "sample" trade. A persisted
// pnl:+$150 trade polluted real-account stats (calendar, KPIs, win rate,
// streaks, equity) and confused new users into thinking they'd made money.
// The onboarding step now shows a purely illustrative, non-persisted card;
// the full "see it work" experience lives in the demo preview (Khalid).

// User picks their biggest leak during onboarding. Persisted to settings so
// the dashboard insight panel can speak to it specifically until enough
// trade data exists to find leaks empirically.
function obPickLeak(btn){
  var leak=btn.getAttribute('data-leak');
  document.querySelectorAll('.ob-leak-btn').forEach(function(b){b.style.borderColor='rgba(255,255,255,0.08)';b.style.background='linear-gradient(145deg,#1a1810,#0f0d09)';});
  btn.style.borderColor='var(--gold)';btn.style.background='linear-gradient(135deg,rgba(218,180,98,0.14),rgba(218,180,98,0.04))';
  if(!S.settings)S.settings={};
  S.settings.leak=leak;sv('settings',S.settings);
  // Auto-advance after a short beat so the selection feels satisfying
  setTimeout(function(){obNext();},420);
}
function showOB(){S.obStep=0;renderOB();}
function renderOB(){
  var s=OB[S.obStep];if(!s)return;
  var eye=el('ob-eye'),title=el('ob-title'),text=el('ob-text'),btn=el('ob-btn'),skip=el('ob-skip');
  if(eye)eye.textContent=s.eye;
  if(title)title.innerHTML=s.title;
  if(text)text.innerHTML=s.text;
  var isLast=S.obStep>=OB.length-1;
  // The leak-selection step (eye starts with PERSONAL) has its own buttons
  // that auto-advance — the standard Continue would let users skip the
  // question, which defeats the personalization.
  var isLeakStep=(s.eye||'').indexOf('PERSONAL')===0;
  if(btn){
    btn.textContent=isLast?'Bismillah — begin':(s.btnLabel||'Continue →');
    btn.style.display=isLeakStep?'none':'';
  }
  if(skip)skip.style.display=isLast?'none':'';
  for(var i=0;i<OB.length;i++){var d=el('od'+(i+1));if(d)d.classList.toggle('on',i===S.obStep);}
  var ob=el('onboard');if(ob)ob.classList.add('show');
  var card=document.querySelector('.ob-card');
  if(card){card.style.animation='none';card.offsetHeight;card.style.animation='scaleIn 0.35s cubic-bezier(0.16,1,0.3,1)';}
  // If we re-enter the leak step (e.g. via back/skip recovery), highlight
  // the previously chosen leak so the user sees their selection persisted.
  if(isLeakStep && S.settings && S.settings.leak){
    setTimeout(function(){
      var prior=document.querySelector('.ob-leak-btn[data-leak="'+S.settings.leak+'"]');
      if(prior){prior.style.borderColor='var(--gold)';prior.style.background='linear-gradient(135deg,rgba(218,180,98,0.14),rgba(218,180,98,0.04))';}
    },30);
  }
}
function obNext(){
  S.obStep++;
  // If the user imported (or otherwise already has) real trades, the
  // illustrative "example trade" step is redundant — skip past it.
  var hasReal = (S.trades||[]).some(function(t){return !t.sample;});
  if(hasReal){
    while(S.obStep<OB.length && (OB[S.obStep].eye||'').indexOf('EXAMPLE')>-1){ S.obStep++; }
  }
  sv('obStep',S.obStep);
  if(S.obStep<OB.length){renderOB();}
  else{ obFinish(); }
}
function obSkip(){ S.obStep=OB.length; obFinish(); }
function obFinish(){
  var ob=el('onboard');if(ob)ob.classList.remove('show');
  sv('onboarded',true);
}
// Manually re-open the 4-step intro from Settings. Doesn't reset `onboarded`
// — they've already paid — but lets them re-read the loop / re-pick their leak.
function replayOnboarding(){
  S.obStep = 0;
  var ob = el('onboard'); if(ob) ob.classList.add('show');
  renderOB();
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
var PAGE_TITLES={dashboard:'Today',intrade:'In Trade',trades:'Trade Log',calendar:'Calendar',analytics:'Analytics',journal:'Journal',playbook:'Playbook',risk:'Risk Calc',zakat:'Zakat',sirat:'Sirat',goals:'Goals',blueprint:'Blueprint',guide:'Guide',settings:'Settings',privacy:'Privacy',terms:'Terms',refund:'Refund Policy'}
// Page renderers are looked up at navigation time. dashboard & settings are
// wrapped at runtime by the retention module, so resolve through the live
// binding instead of capturing the original reference here.
var PAGE_FNS={privacy:function(){},terms:function(){},refund:function(){},guide:function(){},blueprint:function(){},
  dashboard:function(){return renderDash.apply(this,arguments);},
  intrade:renderInTrade,trades:renderTrades,
  calendar:renderCal,analytics:renderAnalytics,journal:renderJournal,
  playbook:renderPlaybook,risk:renderRisk,zakat:renderZakat,sirat:renderSirat,goals:renderGoals,
  settings:function(){return renderSettings.apply(this,arguments);}};

function go(page,navEl){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  if(page==='dashboard'){var dot=el('nav-muh-dot');if(dot)dot.style.display='none';}
  var pg=el('page-'+page);if(pg)pg.classList.add('active');
  if(navEl)navEl.classList.add('active');
  else{var ne=document.querySelector('[data-page="'+page+'"]');if(ne)ne.classList.add('active');}
  // If the active item lives inside a collapsed nav group, reveal the group
  // so the highlighted page is visible (e.g. deep-linking straight to /risk).
  var actNav=document.querySelector('.nav-item.active');
  if(actNav){
    var grpBody=actNav.closest('.nav-group-body');
    if(grpBody && !grpBody.classList.contains('open')){
      grpBody.classList.add('open');
      var tog=grpBody.previousElementSibling;
      if(tog && tog.classList.contains('nav-sect-toggle')){ tog.classList.add('open'); tog.setAttribute('aria-expanded','true'); }
    }
  }
  var tt=el('topbar-title');if(tt)tt.innerHTML=PAGE_TITLES[page]||page;
  closeDP();
  var sb=el('sidebar');if(sb)sb.classList.remove('open');
  var sbo=el('sb-overlay');if(sbo)sbo.classList.remove('show');
  window.scrollTo(0,0);
  if(PAGE_FNS[page])try{PAGE_FNS[page]();}catch(err){console.error('Page error:',page,err);toast('Something went wrong loading this page','e');}
  _push('/' + page);
}
function toggleSB(){
  var sb=el('sidebar');if(sb)sb.classList.toggle('open');
  var sbo=el('sb-overlay');if(sbo)sbo.classList.toggle('show');
}
// Collapsible secondary nav groups (Tools, More) — keep the daily-loop pages
// always visible and tuck advanced tools behind a header. State persists.
function toggleNavGroup(key,btn){
  var body=el('navgrp-'+key); if(!body) return;
  var open=body.classList.toggle('open');
  if(btn){ btn.classList.toggle('open',open); btn.setAttribute('aria-expanded',open?'true':'false'); }
  try{ localStorage.setItem('niyyah_nav_'+key, open?'1':'0'); }catch(e){}
}
(function restoreNavGroups(){
  function apply(){
    ['tools','more'].forEach(function(key){
      var saved; try{ saved=localStorage.getItem('niyyah_nav_'+key); }catch(e){}
      if(saved==='1'){
        var body=el('navgrp-'+key); if(body){ body.classList.add('open');
          var tog=body.previousElementSibling;
          if(tog && tog.classList.contains('nav-sect-toggle')){ tog.classList.add('open'); tog.setAttribute('aria-expanded','true'); }
        }
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();

// ── SALAH ──────────────────────────────────────────────────────────────────
function getTodayPrayers(){var k=localDate();return S.dailyPrayers[k]||{fajr:false,dhuhr:false,asr:false,maghrib:false,isha:false};}
function toggleSalah(p){
  var k=localDate();
  if(!S.dailyPrayers[k])S.dailyPrayers[k]={fajr:false,dhuhr:false,asr:false,maghrib:false,isha:false};
  S.dailyPrayers[k][p]=!S.dailyPrayers[k][p];
  sv('dailyPrayers',S.dailyPrayers);
  renderSalah();
  // Update compact Today View pills
  var pill=el('tp-'+p);
  if(pill){if(S.dailyPrayers[k][p])pill.classList.add('done');else pill.classList.remove('done');}
  var prayers=['fajr','dhuhr','asr','maghrib','isha'];
  var prayedCount=prayers.filter(function(pr){return S.dailyPrayers[k][pr];}).length;
  var scToday=el('sal-count-today');if(scToday)scToday.textContent=prayedCount+'/5';
  var sHint=el('sal-hint-today');if(sHint && prayedCount>0)sHint.style.display='none';
}
function renderSalah(){
  // The visible salah pills are updated inline by toggleSalah() / renderDash().
  // Kept as a hook in case other callers exist; no DOM writes needed here.
}

// ── GATE ───────────────────────────────────────────────────────────────────
function gAns(k,v,btn){
  S.gateAns[k]=v;
  sv('gateAns',S.gateAns);
  var par=btn.parentElement;if(!par)return;
  par.querySelectorAll('.gqb').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');checkGate();
}
function checkGate(){
  var w=el('gate-warn');if(!w)return;
  var anyNo=Object.values(S.gateAns).includes('no');
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  var insights=[];

  // Adaptive: consecutive win pattern (chronological — not array order)
  if(closed.length>=4){
    var chronoG=_chronoClosed(); // oldest first
    var recentWins=0;
    for(var i=chronoG.length-1;i>=0;i--){if(chronoG[i].pnl>0)recentWins++;else break;}
    if(recentWins>=2){
      var postWinEmotional=chronoG.filter(function(t,idx){return idx>0&&chronoG[idx-1].pnl>0&&['overconf','revenge'].includes(t.emotion||'');});
      if(postWinEmotional.length>=2){
        insights.push('You are on a '+recentWins+'-win streak. Your data shows discipline slipping after wins. Kibr guard — same rules, always.');
      }
    }
  }

  // Adaptive: prayer vs trading correlation
  var today=localDate();
  var todayPr=S.dailyPrayers[today]||{};
  var prayedToday=Object.values(todayPr).filter(Boolean).length;
  if(prayedToday<3&&closed.length>=6){
    var fullDays=Object.keys(S.dailyPrayers).filter(function(d){return Object.values(S.dailyPrayers[d]).every(Boolean);});
    var partDays=Object.keys(S.dailyPrayers).filter(function(d){return d!==today&&!Object.values(S.dailyPrayers[d]).every(Boolean);});
    var fpT=closed.filter(function(t){return fullDays.indexOf(t.date)>-1;});
    var ppT=closed.filter(function(t){return partDays.indexOf(t.date)>-1;});
    if(fpT.length>=5&&ppT.length>=3){
      var fpWR=Math.round(fpT.filter(function(t){return t.pnl>0;}).length/fpT.length*100);
      var ppWR=Math.round(ppT.filter(function(t){return t.pnl>0;}).length/ppT.length*100);
      if(fpWR>ppWR+10){insights.push('Your data: full-prayer days → <strong>'+fpWR+'%</strong> win rate ('+fpT.length+' trades). Partial-prayer days → <strong>'+ppWR+'%</strong> ('+ppT.length+' trades).');}
    }
  }

  // Adaptive: time-of-day pattern
  if(closed.length>=8&&!anyNo){
    var now=new Date();var hour=now.getHours();
    var sameHour=closed.filter(function(t){
      if(!t.time)return false;
      return Math.abs(parseInt(t.time.split(':')[0])-hour)<=1;
    });
    if(sameHour.length>=4){
      var hWR=Math.round(sameHour.filter(function(t){return t.pnl>0;}).length/sameHour.length*100);
      if(hWR<38){insights.push('Trades at this time of day: <strong>'+hWR+'%</strong> win rate across '+sameHour.length+' trades. Your own data suggests caution.');}
    }
  }

  // Cross-check: user said calm in the gate but picked a charged emotion.
  // This is the central contradiction the audit flagged — surface it instead
  // of silently letting both stand.
  if(S.gateAns.calm==='yes' && EMOTION_CHARGED[S.selEmotion]){
    insights.push('You answered <strong>calm</strong> in the gate but tagged your state as <strong>'+S.selEmotion+'</strong>. One of these is the truth — the mirror only works when they agree.');
  }

  // The signature mirror: when the trader tags a charged emotion, surface their
  // OWN track record trading on that exact emotion — at the decision moment.
  // This is the promise onboarding makes; it must fire from the emotion tag,
  // not only from the Yes/No gate answers.
  if(EMOTION_CHARGED[S.selEmotion]){
    var sameEmo=closed.filter(function(t){return t.emotion===S.selEmotion;});
    if(sameEmo.length>=3){
      var eWR=Math.round(sameEmo.filter(function(t){return t.pnl>0;}).length/sameEmo.length*100);
      var eTot=sameEmo.reduce(function(acc,t){return acc+(t.pnl||0);},0);
      insights.push('Your last <strong>'+sameEmo.length+'</strong> trades tagged <strong>'+S.selEmotion+'</strong>: <strong>'+eWR+'%</strong> win rate, <strong>'+(eTot>=0?'+':'-')+fmt(Math.abs(eTot))+'</strong> total. This is the moment that decides it.');
    }
  }

  // Wire the weekly Nafs Check into the gate so a low self-rating becomes a
  // live reminder at the decision point — otherwise the tracker is just a diary.
  if(S.nafs){
    if(S.nafs.sabr && S.nafs.sabr<=2)
      insights.push('You rated your <strong>Sabr</strong> low this week. Patience is the setup — is this a trade you’d take on your most disciplined day?');
    else if(S.nafs.tawakkul && S.nafs.tawakkul<=2)
      insights.push('You rated your <strong>Tawakkul</strong> low this week. Set your stop, set your target, then release the outcome.');
    else if(S.nafs.kibr && S.nafs.kibr<=2)
      insights.push('Your <strong>kibr guard</strong> was low this week. After wins the nafs whispers "I’ve figured it out." Same size, same rules.');
  }

  if(!anyNo&&insights.length===0){w.classList.remove('show');return;}

  var a=S.gateAns,recent=S.trades.slice(0,20),lb=[],wt='';
  if(a.calm==='no'){lb=recent.filter(function(t){return['fomo','revenge','urgency','overconf','anxious'].includes(t.emotion);});wt='emotional';}
  else if(a.conf==='no'){lb=recent.filter(function(t){return t.outcome&&t.outcome.indexOf('broke')>-1;});wt='low-confluence';}
  else if(a.waited==='no'){lb=recent.filter(function(t){return['fomo','urgency'].includes(t.emotion);});wt='forced';}

  var mainMsg='';
  if(anyNo){
    var s2=lb.slice(0,5);
    if(!s2.length){mainMsg='You answered No. The market will be there in 10 minutes.';}
    else{
      var wr=Math.round(s2.filter(function(t){return t.pnl>0;}).length/s2.length*100);
      var tp=s2.reduce(function(acc,t){return acc+t.pnl;},0);
      mainMsg='Your last <strong>'+s2.length+'</strong> '+wt+' trades: <strong>'+wr+'%</strong> win rate, <strong>'+(tp>=0?'+':'')+fmt(Math.abs(tp))+'</strong> total. Proceed knowing this — or walk away.';
    }
  }

  var insHTML=insights.map(function(i){return'<div style="margin-top:9px;padding-top:9px;border-top:1px solid rgba(218,180,98,0.15);font-size:0.8rem;color:var(--gold-2);line-height:1.6;">'+i+'</div>';}).join('');
  w.innerHTML=(mainMsg?'<div>'+mainMsg+'</div>':'')+insHTML;
  w.classList.add('show');
}

// ── ISLAMIC CRITERIA ───────────────────────────────────────────────────────
function toggleIC(k){
  S.icChecked[k]=!S.icChecked[k];
  var item=el('ic-'+k)||el('ic-'+k+'2');if(item)item.classList.toggle('checked',S.icChecked[k]);
  var circ=el('icc-'+k);if(circ)circ.classList.toggle('checked',S.icChecked[k]);
  sv('icChecked',S.icChecked);
}
function resetIC(){
  ['bismillah','prayer','setup','stop'].forEach(function(k){
    S.icChecked[k]=false;
    var item=el('ic-'+k)||el('ic-'+k+'2');if(item)item.classList.remove('checked');
    var circ=el('icc-'+k);if(circ)circ.classList.remove('checked');
  });
  sv('icChecked',S.icChecked);
}

// ── EMOTION ────────────────────────────────────────────────────────────────
// Cross-check: if the user picks a charged emotion (fomo / revenge / urgency /
// anxious) but already self-reported "calm" in the gate, surface the
// contradiction so they reconsider one or the other. We do not silently
// overwrite — the mirror only works if the user faces it.
var EMOTION_CHARGED = {fomo:1, revenge:1, urgency:1, anxious:1, overconf:1};
function selEm(btn){
  document.querySelectorAll('#entry-modal .emotion-btn').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  S.selEmotion = btn.dataset.e;
  // Refresh the warning state of the gate so the contradiction (if any) shows
  // up immediately without waiting for another gate tap.
  if(typeof checkGate === 'function') checkGate();
  if(typeof refreshMizan === 'function') refreshMizan();
}
function selExEm(btn){document.querySelectorAll('#exit-modal .emotion-btn').forEach(function(b){b.classList.remove('on');});btn.classList.add('on');S.selExEmotion=btn.dataset.e;}

// ── QUALITY SCORE ──────────────────────────────────────────────────────────
// Out of 11 points. Returns 0–100.
function calcQ(t){
  var s=0,m=0;

  // Gate discipline (3pts) — answering the gate AND all "yes" counts; bypass earns 0.
  m+=3;
  var ga=t.gateAnswers||{};
  var gaKeys=Object.keys(ga);
  var gOK=gaKeys.length>0 && gaKeys.every(function(k){return ga[k]==='yes';});
  if(gOK)s+=2;
  if(t.setup)s+=1;

  // Emotional honesty (2pts)
  m+=2;
  var entryEm=t.emotion||'';
  var exitEm=t.exitEmotion||'';
  if(['calm','patient','focused'].indexOf(entryEm)>-1)s+=2;
  else if(entryEm==='anxious')s+=1;

  // Contradiction: calm entry → revenge/frustrated/regret exit = penalty
  if(['calm','patient','focused'].indexOf(entryEm)>-1 && ['revenge','frustrated','regret'].indexOf(exitEm)>-1){
    s=Math.max(0,s-1);
  }

  // Outcome integrity (2pts)
  m+=2;
  if(t.outcome && t.outcome.indexOf('broke')===-1) s+=2;

  // Rule break + emotional exit = additional penalty
  if(t.outcome && t.outcome.indexOf('broke')>-1 && ['revenge','frustrated','overconf'].indexOf(exitEm)>-1){
    s=Math.max(0,s-1);
  }

  // Islamic practice (4pts) — one point per toggle: bismillah, prayer, setup, stop.
  m+=4;
  var ic=t.islamicCheck||{};
  if(ic.bismillah) s+=1;
  if(ic.prayer)    s+=1;
  if(ic.setup)     s+=1;
  if(ic.stop)      s+=1;

  // Kibr flag: win + overconfident exit = arrogance penalty
  if(t.pnl>0 && exitEm==='overconf') s=Math.max(0,s-1);

  return Math.round(Math.max(0,Math.min(s,m))/m*100);
}

// ── ENTRY MODAL ────────────────────────────────────────────────────────────
function openEntryModal(){
  // Sirat: Disaster Brake hard-blocks new trades while the user is locked.
  if(isSirat() && isSiratLocked()){
    toast('Trade entry locked until ' + new Date(siratLockUntil()).toLocaleString(), 'e');
    return;
  }
  var m=el('entry-modal');if(!m)return;
  m.classList.add('show');
  var ed=el('e-date');if(ed)ed.value=localDate();
  var et=el('e-time');if(et)et.value=new Date().toTimeString().slice(0,5);
  document.body.style.overflow='hidden';
  S.gateAns={};S.selEmotion=null;S.icChecked={bismillah:false,prayer:false,setup:false,stop:false};
  S.entryScreenshot=null;
  resetScreenshotZone('e-screenshot-zone','entry');
  document.querySelectorAll('.gqb').forEach(function(b){b.classList.remove('on');});
  var gw=el('gate-warn');if(gw)gw.classList.remove('show');
  // Sahib's active commitment, surfaced at the moment of decision.
  var sr=el('entry-sahib-reminder');
  if(sr){ var sc=S.sahib&&S.sahib.commitment; sr.innerHTML = sc ? '<div class="gate-sahib">☽ Your Sahib focus this week — <strong>'+esc(sc.text)+'</strong></div>' : ''; }
  var rw=el('e-rr-warn');if(rw)rw.style.display='none';
  window._rrConfirmed = false;
  document.querySelectorAll('#entry-modal .emotion-btn').forEach(function(b){b.classList.remove('on');});
  resetIC();
  var sel=el('e-setup-sel');
  if(sel){sel.innerHTML='<option value="">— Select from Playbook —</option>';S.playbook.forEach(function(p){sel.innerHTML+='<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>';});}
  var selField=el('e-setup-sel-field');
  if(selField)selField.style.display=S.playbook.length?'':'none';
  var setupLbl=el('e-setup-label');
  if(setupLbl)setupLbl.textContent=S.playbook.length?'Or type setup name':'Setup name';
  var setupRow=el('e-setup-row');
  if(setupRow)setupRow.className='field-row '+(S.playbook.length?'c3':'c2');
  // Mizan live-verdict wiring (Sirat-only — refreshMizan no-ops otherwise).
  // Attach listeners once per modal open. We use a flag to avoid stacking.
  if(!m._mizanWired){
    ['e-inst','e-dir','e-setup-sel','e-setup','e-entry','e-stop','e-target','e-time'].forEach(function(id){
      var n = el(id); if(n) n.addEventListener('input', refreshMizan);
      if(n && n.tagName === 'SELECT') n.addEventListener('change', refreshMizan);
    });
    m._mizanWired = true;
  }
  entryGoStep(1); // always open on the gate, not the form
  refreshMizan();
}
function closeEntry(force){
  var m=el('entry-modal');if(!m)return;
  var inst=el('e-inst')&&el('e-inst').value;
  if(inst && !force){
    confirmModal({title:'Discard this trade?',text:'You have unsaved entry details. They will be lost.',okText:'Discard',cancelText:'Keep editing',danger:true,icon:'⚠'})
      .then(function(ok){if(ok)closeEntry(true);});
    return;
  }
  m.classList.remove('show');document.body.style.overflow='';
}
// Two-beat entry flow: step 1 is the gate + emotion (the psychological
// intervention, where the mirror fires); step 2 is the trade log. Keeping
// them apart stops the gate from competing with bookkeeping fields.
function entryGoStep(n){
  var toStep2 = (n===2);
  var s1=el('entry-step-1'),s2=el('entry-step-2'),f1=el('entry-foot-1'),f2=el('entry-foot-2');
  if(s1)s1.style.display=toStep2?'none':'';
  if(s2)s2.style.display=toStep2?'':'none';
  if(f1)f1.style.display=toStep2?'none':'';
  if(f2)f2.style.display=toStep2?'':'none';
  var body=document.querySelector('#entry-modal .modal-body'); if(body)body.scrollTop=0;
  if(toStep2){ refreshMizan(); var ei=el('e-inst'); if(ei) try{ei.focus();}catch(e){} }
}
function saveEntry(){
  var rawInst=(el('e-inst')?el('e-inst').value:'').trim();
  var inst=_normaliseInst(rawInst)||rawInst.toUpperCase().trim();
  if(!inst){toast('Please enter the instrument','e');return;}
  var dir = el('e-dir') ? el('e-dir').value : 'LONG';
  var rawEntry = el('e-entry')?el('e-entry').value:'';
  var rawStop  = el('e-stop')?el('e-stop').value:'';
  var rawTarget= el('e-target')?el('e-target').value:'';
  // Strip thousands separators for numeric validation. Keep raw string on the
  // trade so the user's original formatting survives the round-trip.
  var nEntry = parseFloat((rawEntry||'').replace(/,/g,''));
  var nStop  = parseFloat((rawStop ||'').replace(/,/g,''));
  var nTarget= parseFloat((rawTarget||'').replace(/,/g,''));
  // Hard validation: stop on the wrong side of entry is almost always a typo
  // or a misunderstanding of the gate. Block save and explain.
  if(!isNaN(nEntry) && !isNaN(nStop) && nEntry !== nStop){
    if(dir==='LONG' && nStop >= nEntry){toast('LONG trade: stop ('+nStop+') must be BELOW entry ('+nEntry+')','e');return;}
    if(dir==='SHORT' && nStop <= nEntry){toast('SHORT trade: stop ('+nStop+') must be ABOVE entry ('+nEntry+')','e');return;}
  }
  // Soft warning (not a block): RR below 1:1.
  var rrWarn = el('e-rr-warn');
  if(rrWarn) rrWarn.style.display = 'none';
  if(!isNaN(nEntry) && !isNaN(nStop) && !isNaN(nTarget) && nEntry !== nStop){
    var risk = Math.abs(nEntry - nStop);
    var reward = Math.abs(nTarget - nEntry);
    var rr = risk > 0 ? reward / risk : 0;
    if(rr > 0 && rr < 1 && rrWarn){
      // First click on Save shows the warning. Second click (within 6s)
      // proceeds anyway so high-conviction setups aren't blocked.
      if(!window._rrConfirmed){
        rrWarn.innerHTML = '\u26a0 Reward-to-risk is <strong>'+rr.toFixed(2)+':1</strong> (below 1:1). Click Enter Trade again within 6s if you want to proceed anyway.';
        rrWarn.style.display = '';
        window._rrConfirmed = true;
        setTimeout(function(){ window._rrConfirmed = false; }, 6000);
        return;
      }
    }
  }
  window._rrConfirmed = false;
  var btn=el('save-entry-btn'),orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerHTML='<span class="spinner"></span>Saving\u2026';}
  var setupSel=el('e-setup-sel')&&el('e-setup-sel').value;
  var setupTyped=el('e-setup')?el('e-setup').value:'';
  var t={id:Date.now(),status:'open',
    date:el('e-date')?el('e-date').value:localDate(),
    time:el('e-time')?el('e-time').value:'',
    instrument:inst,
    direction:dir,
    setup:setupSel||setupTyped,
    entryPrice:rawEntry,
    stopPrice:rawStop,
    targetPrice:rawTarget,
    emotion:S.selEmotion||'calm',
    islamicCheck:Object.assign({},S.icChecked),
    gateAnswers:Object.assign({},S.gateAns),
    prayers:Object.assign({},getTodayPrayers()),
    screenshot:S.entryScreenshot||null,
    qty:parseFloat((el('e-qty')?el('e-qty').value:'')||1)||1,
    pnl:0,createdAt:new Date().toISOString()};
  t.quality=calcQ(t);
  // Snapshot prior state so we can revert if the write fails.
  var priorTrades=S.trades.slice(), priorOpenId=S.openTradeId;
  // Upload the screenshot to Storage (or keep inline) before the doc write.
  resolveScreenshotRef(t.screenshot, t.id, 'entry').then(function(ref){
    t.screenshot=ref;
    S.trades.unshift(t); S.openTradeId=t.id;
    // Single atomic write: both fields land together or neither does.
    return svMulti({trades:S.trades, openTradeId:S.openTradeId});
  })
    .then(function(){
      closeEntry(true);
      ['e-inst','e-setup','e-entry','e-stop','e-target'].forEach(function(id){var e=el(id);if(e)e.value='';});
      updateNav(); toast('\u2713 Trade entered \u2014 come back to log the close','s');
      if(el('page-dashboard').classList.contains('active'))renderDash();
    })
    .catch(function(){
      // sv() already showed a toast; restore the exact prior state.
      S.trades=priorTrades; S.openTradeId=priorOpenId;
    })
    .then(function(){
      if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerHTML=orig;}
    });
}

// ── EXIT MODAL ─────────────────────────────────────────────────────────────
function openExitModal(){
  var t=S.trades.find(function(x){return x.id===S.openTradeId&&x.status==='open';});
  if(!t){toast('No open trade found','e');return;}
  var m=el('exit-modal');if(!m)return;
  var ref=el('exit-ref');
  if(ref)ref.innerHTML='<strong style="color:var(--ink);">'+esc(t.instrument)+' '+esc(t.direction)+'</strong> \u00b7 '+fmtDate(t.date)+(t.time?' at '+esc(t.time):'')+(t.entryPrice?' \u00b7 Entry: '+esc(t.entryPrice):'')+(t.stopPrice?' \u00b7 Stop: '+esc(t.stopPrice):'');
  m.classList.add('show');document.body.style.overflow='hidden';
  S.selExEmotion=null;
  document.querySelectorAll('#exit-modal .emotion-btn').forEach(function(b){b.classList.remove('on');});
  var hint=el('x-pnl-hint');if(hint){hint.textContent='';hint.style.display='none';}
  var xp=el('x-pnl');if(xp){xp.value='';xp._userEdited=false;if(!xp._changeListenerAdded){xp.addEventListener('input',function(){xp._userEdited=true;});xp._changeListenerAdded=true;}}
  var xe=el('x-exit');if(xe)xe.value='';
  S.exitScreenshot=null;resetScreenshotZone('x-screenshot-zone','exit');
}
var TICK_VALUES={
  'ES':50,'MES':5,
  'NQ':20,'MNQ':2,
  'YM':5,'MYM':0.5,
  'RTY':50,'M2K':5,
  'GC':100,'MGC':10,
  'SI':5000,'MSI':500,
  'CL':1000,'MCL':100,
  'NG':10000,
  'ZB':1000,'ZN':1000,'ZF':1000,
  'MNQU':2,'MESU':5,'ESU':50,'NQU':20
};
function _normaliseInst(s){
  if(!s)return '';
  var u=s.toUpperCase().replace(/[^A-Z0-9]/g,'');
  // Strip trailing contract month letters + year digits (e.g. ESM25 -> ES, NQZ4 -> NQ)
  u=u.replace(/([A-Z]{1,5})[FGHJKMNQUVXZ]\d{1,2}$/, '$1');
  // Strip leading slash
  u=u.replace(/^\//, '');
  // Common aliases
  var alias={'EMINI':'ES','EMININQ':'NQ','SP500':'ES','NAS100':'NQ','DOW':'YM','RUSSELL':'RTY','GOLD':'GC','SILVER':'SI','OIL':'CL','CRUDE':'CL','CRUDEOIL':'CL'};
  return alias[u]||u;
}
function autoCalcExitHint(){
  var t=S.trades.find(function(x){return x.id===S.openTradeId&&x.status==='open';});
  var hint=el('x-pnl-hint');if(!hint)return;
  if(!t||!t.entryPrice){hint.style.display='none';return;}
  var exitRaw=(el('x-exit')?el('x-exit').value:'').replace(/[^\d.\-]/g,'');
  var entryRaw=(t.entryPrice||'').replace(/[^\d.\-]/g,'');
  var exitVal=parseFloat(exitRaw),entryVal=parseFloat(entryRaw);
  if(isNaN(exitVal)||isNaN(entryVal)){hint.style.display='none';return;}
  var diff=exitVal-entryVal;
  var isLong=t.direction==='LONG';
  var pricePnl=isLong?diff:-diff;
  var profitable=pricePnl>0;
  var norm=_normaliseInst(t.instrument||'');
  var tickVal=TICK_VALUES[norm];
  var qty=parseFloat(t.qty)||1;
  var pnlEl=el('x-pnl');
  var fees=Math.abs(parseFloat(el('x-fees')?el('x-fees').value:0)||0);
  if(tickVal&&!isNaN(diff)){
    var dollarPnl=Math.round(pricePnl*tickVal*qty*100)/100;
    var netPnl=Math.round((dollarPnl-fees)*100)/100;
    hint.textContent='Auto-calculated: '+(dollarPnl>=0?'$+':'$')+dollarPnl.toLocaleString()
      +' ('+qty+' contract'+(qty!==1?'s':'')+' \u00d7 $'+tickVal+'/pt)'
      +(fees>0?(' \u2212 $'+fees.toLocaleString()+' fees = '+(netPnl>=0?'$+':'$')+netPnl.toLocaleString()+' net'):'');
    hint.style.color=netPnl===0?'var(--ink-3)':netPnl>0?'var(--green)':'var(--red)';
    hint.style.display='';
    if(pnlEl&&!pnlEl._userEdited){
      pnlEl.value=dollarPnl;
      if(!pnlEl._changeListenerAdded){
        pnlEl.addEventListener('input',function(){pnlEl._userEdited=true;});
        pnlEl._changeListenerAdded=true;
      }
    }
  } else {
    hint.textContent='Price moved '+(diff>=0?'+':'')+diff.toFixed(4).replace(/\.?0+$/,'')+' pts \u00b7 P&L direction: '+(diff===0?'flat':profitable?'positive':'negative');
    hint.style.color=diff===0?'var(--ink-3)':profitable?'var(--green)':'var(--red)';
    hint.style.display='';
    if(pnlEl&&!pnlEl.value&&!pnlEl._userEdited){
      pnlEl.placeholder=profitable?'e.g. +225':diff===0?'0':'e.g. -120';
    }
  }
}
function closeExit(){var m=el('exit-modal');if(m)m.classList.remove('show');document.body.style.overflow='';}
function saveExit(){
  var grossPnl=parseFloat(el('x-pnl')?el('x-pnl').value:0)||0;
  var fees=Math.abs(parseFloat(el('x-fees')?el('x-fees').value:0)||0);
  var pnl=Math.round((grossPnl-fees)*100)/100; // store NET as the trade result
  var t=S.trades.find(function(x){return x.id===S.openTradeId&&x.status==='open';});
  if(!t){toast('No open trade to close','e');return;}
  // Lesson is required on close. The whole product premise is reflection —
  // accepting empty lessons quietly betrays it.
  var lessonText = (el('x-lesson') ? el('x-lesson').value : '').trim();
  if(lessonText.length < 20){
    toast('Lesson too short — write a full sentence (min 20 chars). This is the mirror.','e');
    var lx = el('x-lesson');
    if(lx){lx.focus(); lx.style.borderColor='var(--red)'; setTimeout(function(){lx.style.borderColor='';}, 1800);}
    return;
  }
  var btn=el('save-exit-btn'),orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerHTML='<span class="spinner"></span>Closing\u2026';}
  // Snapshot the prior state so we can revert if save fails
  var priorStatus=t.status,priorPnl=t.pnl,priorOpenId=S.openTradeId;
  t.status='closed';t.pnl=pnl;t.grossPnl=grossPnl;t.fees=fees;
  t.exitPrice=el('x-exit')?el('x-exit').value:'';
  // Optional MFE/MAE: store favorable/adverse excursions in $ (magnitudes).
  (function(){
    var entry=parseFloat(String(t.entryPrice||'').replace(/[^\d.\-]/g,''));
    var tv=TICK_VALUES[_normaliseInst(t.instrument||'')]; var q=parseFloat(t.qty)||1;
    var mfeP=parseFloat(String(el('x-mfe')?el('x-mfe').value:'').replace(/[^\d.\-]/g,''));
    var maeP=parseFloat(String(el('x-mae')?el('x-mae').value:'').replace(/[^\d.\-]/g,''));
    if(isNaN(entry)||!tv){t.mfe=null;t.mae=null;return;}
    var isLong=t.direction==='LONG';
    if(!isNaN(mfeP)) t.mfe=Math.max(0,Math.round((isLong?(mfeP-entry):(entry-mfeP))*tv*q*100)/100); else t.mfe=null;
    if(!isNaN(maeP)) t.mae=Math.max(0,Math.round((isLong?(entry-maeP):(maeP-entry))*tv*q*100)/100); else t.mae=null;
  })();
  t.outcome=el('x-outcome')?el('x-outcome').value:'loss';
  t.exitEmotion=S.selExEmotion||'calm';
  t.lesson=el('x-lesson')?el('x-lesson').value:'';
  t.exitScreenshot=S.exitScreenshot||null;
  t.closedAt=new Date().toISOString();
  t.quality=calcQ(t);
  S.openTradeId=null;
  // Upload the exit screenshot to Storage (or keep inline) before the write.
  resolveScreenshotRef(t.exitScreenshot, t.id, 'exit').then(function(ref){
    t.exitScreenshot=ref;
    // Single atomic write so the trade-close and openTradeId-clear can't desync.
    return svMulti({trades:S.trades, openTradeId:null});
  })
    .then(function(){
      closeExit();
      ['x-exit','x-pnl','x-fees','x-mfe','x-mae','x-lesson'].forEach(function(id){var e=el(id);if(e)e.value='';});
      updateNav();
      // Quality toast for every close; milestone celebrations layered on top.
      toast('\u2713 Trade closed \u00b7 Quality '+t.quality+'/100','s');
      var closedCount=S.trades.filter(function(x){return x.status==='closed';}).length;
      if(closedCount===1||closedCount===5||closedCount===20||closedCount===50||closedCount===100){
        setTimeout(function(){showMilestone(closedCount,t);},400);
      }
      if(el('page-dashboard').classList.contains('active'))renderDash();
      if(el('page-trades').classList.contains('active'))renderTrades();
      if(el('page-intrade').classList.contains('active'))renderInTrade();
    })
    .catch(function(){
      // Restore so user can retry; in-memory trade object and openTradeId both reverted.
      t.status=priorStatus; t.pnl=priorPnl; S.openTradeId=priorOpenId;
    })
    .then(function(){
      if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerHTML=orig;}
    });
}

// ── TRADE DETAIL MODAL ─────────────────────────────────────────────────────
function openTD(id){
  currentTDId=id;
  var t=S.trades.find(function(x){return x.id===id;});if(!t)return;
  var m=el('td-modal');if(!m)return;
  var ic=t.islamicCheck||{};var icScore=Object.values(ic).filter(Boolean).length;
  var body=el('td-body');
  if(body)body.innerHTML='<div class="td-section"><div class="td-label">Position</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:600;color:var(--ink);margin-bottom:10px;">'+esc(t.instrument)+' <span style="color:'+(t.direction==='LONG'?'var(--green)':'var(--red)')+'">'+esc(t.direction)+'</span></div><div class="td-row">'+
    mkTDItem('Date',fmtDate(t.date))+mkTDItem('Time',esc(t.time)||'\u2014')+mkTDItem('Setup',esc(t.setup)||'\u2014')+mkTDItem('Status',esc(t.status.toUpperCase()))+
    '</div></div><div class="td-section"><div class="td-label">Prices</div><div class="td-row">'+mkTDItem('Entry',esc(t.entryPrice)||'\u2014')+mkTDItem('Stop',esc(t.stopPrice)||'\u2014')+mkTDItem('Target',esc(t.targetPrice)||'\u2014')+mkTDItem('Exit',esc(t.exitPrice)||'\u2014')+'</div></div>'+
    '<div class="td-section"><div class="td-label">Result</div><div class="td-row">'+
    mkTDItem('P&L','<span class="t-pnl '+(t.pnl>=0?'pos':'neg')+'">'+fmt(t.pnl,true)+'</span>')+
    (function(){var r=_tradeR(t);return r!=null?mkTDItem('R-multiple',(r>=0?'+':'')+r+'R'):'';})()+
    (t.fees?mkTDItem('Fees','-'+fmt(Math.abs(t.fees))):'')+
    (t.mfe!=null?mkTDItem('Best (MFE)','+'+fmt(t.mfe)+(t.mfe>0&&t.pnl>0?' \u00b7 kept '+Math.min(100,Math.round(t.pnl/t.mfe*100))+'%':'')):'')+
    (t.mae!=null?mkTDItem('Worst (MAE)','-'+fmt(t.mae)):'')+
    mkTDItem('Quality',(t.quality||0)+'/100')+mkTDItem('Outcome',esc(t.outcome)||'\u2014')+mkTDItem('Islamic',icScore+'/4 \u2713')+
    '</div></div><div class="td-section"><div class="td-label">Psychology</div><div class="td-row">'+mkTDItem('Entry State',esc(t.emotion)||'\u2014')+mkTDItem('Exit State',esc(t.exitEmotion)||'\u2014')+'</div>'+
    (t.lesson?'<div style="margin-top:10px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--line-2);border-radius:var(--r);font-size:0.84rem;color:var(--ink-2);line-height:1.6;"><strong style="color:var(--gold);">Lesson:</strong> '+esc(t.lesson)+'</div>':'')+'</div>'+
    (t.gateAnswers&&Object.keys(t.gateAnswers).length?'<div class="td-section"><div class="td-label">Pre-Trade Gate</div><div style="font-size:0.82rem;color:var(--ink-2);line-height:1.9;">'+Object.entries(t.gateAnswers).map(function(kv){return'<span style="color:'+(kv[1]==='yes'?'var(--green)':'var(--red)')+'">'+esc(String(kv[1]).toUpperCase())+'</span> \u2014 '+esc(kv[0]);}).join('<br>')+'</div></div>':'')+
    (t.screenshot?'<div class="td-section"><div class="td-label">Entry Chart</div><div class="td-screenshot" data-hclick="hZoomEntry" data-hid="'+t.id+'"><img id="td-shot-'+t.id+'" src="'+esc(t.screenshot)+'" alt="Entry chart"></div></div>':'')+
    (t.exitScreenshot?'<div class="td-section"><div class="td-label">Exit Chart</div><div class="td-screenshot" data-hclick="hZoomExit" data-hid="'+t.id+'"><img src="'+esc(t.exitScreenshot)+'" alt="Exit chart"></div></div>':'');
  var title=el('td-title');if(title)title.innerHTML=esc(t.instrument)+' <em>Detail</em>';
  var eb=el('td-edit-btn');if(eb)eb.style.display=t.status==='closed'?'':'none';
  var db=el('td-delete-btn');if(db)db.style.display=t.status==='open'?'':'none';
  m.classList.add('show');document.body.style.overflow='hidden';
}
function mkTDItem(label,val){return'<div class="td-item"><div class="td-item-label">'+label+'</div><div class="td-item-val">'+val+'</div></div>';}
function closeTD(){var m=el('td-modal');if(m)m.classList.remove('show');document.body.style.overflow='';currentTDId=null;}
function deleteOpenTrade(id){
  confirmModal({title:'Delete this open trade?',text:'The trade will be permanently removed. This cannot be undone.',okText:'Delete trade',danger:true,icon:'⚠'}).then(function(ok){
    if(!ok)return;
    var gone=S.trades.find(function(t){return t.id===id;});
    deleteTradeScreenshots(gone);
    S.trades=S.trades.filter(function(t){return t.id!==id;});
    if(S.openTradeId===id)S.openTradeId=null;
    sv('trades',S.trades);sv('openTradeId',S.openTradeId);
    closeTD();toast('Trade deleted','s');
    if(el('page-dashboard').classList.contains('active'))renderDash();
    if(el('page-trades').classList.contains('active'))renderTrades();
    if(el('page-intrade').classList.contains('active'))renderInTrade();
  });
}

// ── IMAGE ZOOM ─────────────────────────────────────────────────────────────
function openImageZoom(tradeId,which){
  var t=S.trades.find(function(x){return x.id==tradeId;}); // loose == — id may arrive as number or string
  if(!t)return;
  var src=which==='exit'?t.exitScreenshot:t.screenshot;
  if(!src)return;
  var z=el('image-zoom'),img=el('image-zoom-img');
  if(!z||!img)return;
  img.src=src;
  z.classList.add('show');
}
function closeImageZoom(){var z=el('image-zoom');if(z)z.classList.remove('show');}

// ── SCREENSHOT UPLOAD ──────────────────────────────────────────────────────
// Compresses to max 1280px wide, JPEG q0.65. Stored inline on the trade as base64.
// Hard cap 600KB encoded — refuses oversized images so we don't blow Firestore limits.
function onScreenshotPick(evt,which){
  var file=evt.target.files&&evt.target.files[0];
  if(!file)return;
  if(!/^image\/(png|jpe?g|webp)$/i.test(file.type)){toast('Only PNG, JPEG, or WebP','e');return;}
  if(file.size>10*1024*1024){toast('Image too large (max 10MB before compression)','e');return;}
  compressImage(file,1280,0.65).then(function(dataUrl){
    if(dataUrl.length>600*1024){toast('Compressed image still too large. Try a smaller capture.','e');return;}
    // Firestore caps each document at ~1MB. Screenshots live inside the user
    // doc today, so we reject anything that would push the user past ~800KB of
    // images total. Honest ceiling > silent write failure two months in.
    var existing=S.trades.reduce(function(s,t){return s+((t.screenshot&&t.screenshot.length)||0)+((t.exitScreenshot&&t.exitScreenshot.length)||0);},0);
    if(existing + dataUrl.length > 800*1024){
      toast('Chart storage limit reached (≈800KB total). Remove an old screenshot from a past trade to add this one.','e');
      return;
    }
    // Warn when approaching 70% of the limit so users aren't surprised later
    if(existing + dataUrl.length > 560*1024 && existing <= 560*1024){
      toast('Heads up: chart storage is getting full. You have room for ~1-2 more screenshots.','i');
    }
    if(which==='entry'){
      S.entryScreenshot=dataUrl;
      paintScreenshotPreview('e-screenshot-zone',dataUrl,'entry');
    } else if(which==='exit'){
      S.exitScreenshot=dataUrl;
      paintScreenshotPreview('x-screenshot-zone',dataUrl,'exit');
    }
  }).catch(function(){toast('Could not read that image','e');});
  evt.target.value=''; // allow re-picking the same file later
}
function compressImage(file,maxW,quality){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onerror=reject;
    reader.onload=function(e){
      var img=new Image();
      img.onerror=reject;
      img.onload=function(){
        var w=img.width,h=img.height;
        if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
        var c=document.createElement('canvas');c.width=w;c.height=h;
        var ctx=c.getContext('2d');
        ctx.fillStyle='#000';ctx.fillRect(0,0,w,h); // black bg if transparent
        ctx.drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
// Resolve a screenshot value into something cheap to persist. If it's a data
// URL and Firebase Storage is available, upload it (keyed by trade id so a
// re-save overwrites rather than duplicates) and return the download URL —
// keeping the heavy bytes OUT of the 1MB Firestore user doc. If Storage is
// unavailable or the upload fails, fall back to storing the data URL inline
// (today's behaviour). Never rejects.
function resolveScreenshotRef(val, tradeId, kind){
  return new Promise(function(resolve){
    if(!val || typeof val!=='string' || val.indexOf('data:')!==0){ resolve(val||null); return; }
    if(!STORAGE || !UID || window._demoMode){ resolve(val); return; }
    try{
      var ref = STORAGE.ref().child('users/'+UID+'/shots/'+tradeId+'-'+kind+'.jpg');
      ref.putString(val,'data_url',{contentType:'image/jpeg'})
        .then(function(snap){ return snap.ref.getDownloadURL(); })
        .then(function(url){ resolve(url); })
        .catch(function(e){ console.warn('Screenshot upload failed; storing inline.', e && e.code); resolve(val); });
    }catch(e){ resolve(val); }
  });
}
// Best-effort cleanup of a trade's screenshots from Storage on delete.
// Inline (data-URL) screenshots need no cleanup — they vanish with the trade.
function deleteTradeScreenshots(t){
  if(!t || !STORAGE) return;
  ['screenshot','exitScreenshot'].forEach(function(k){
    var v=t[k];
    if(typeof v==='string' && /^https?:\/\//.test(v)){
      try{ STORAGE.refFromURL(v).delete().catch(function(){}); }catch(e){}
    }
  });
}
function paintScreenshotPreview(zoneId,dataUrl,which){
  var z=el(zoneId);if(!z)return;
  z.classList.add('has-image');
  z.onclick=null;
  z.innerHTML='<div class="screenshot-preview"><img src="'+dataUrl+'" alt="Chart screenshot"><button type="button" class="screenshot-remove" aria-label="Remove screenshot" data-hclick="hRemoveShot" data-hwhich="'+which+'">×</button></div>';
}
function resetScreenshotZone(zoneId,which){
  var z=el(zoneId);if(!z)return;
  z.classList.remove('has-image');
  z.innerHTML='<div class="screenshot-zone-label">+ Attach chart</div><div class="screenshot-zone-hint">PNG / JPEG · auto-compressed · stored privately on your account</div>';
  var inputId=which==='entry'?'e-screenshot-input':which==='exit'?'x-screenshot-input':null;
  z.onclick=function(){var inp=el(inputId);if(inp)inp.click();};
}
function removeScreenshot(which){
  if(which==='entry'){
    S.entryScreenshot=null;
    resetScreenshotZone('e-screenshot-zone','entry');
  } else if(which==='exit'){
    S.exitScreenshot=null;
    resetScreenshotZone('x-screenshot-zone','exit');
  }
}

// ── CSV IMPORT ─────────────────────────────────────────────────────────────
var _csvPending=null;
function openCsvModal(){
  var m=el('csv-modal');if(!m)return;
  _csvPending=null;
  el('csv-error-wrap').innerHTML='';
  el('csv-summary-wrap').innerHTML='';
  el('csv-confirm-btn').style.display='none';
  // Lift above the onboarding overlay (z-index 500) so import works mid-onboarding.
  m.style.zIndex='600';
  m.classList.add('show');document.body.style.overflow='hidden';
}
function closeCsvModal(){var m=el('csv-modal');if(m){m.classList.remove('show');m.style.zIndex='';}document.body.style.overflow='';_csvPending=null;}
function downloadCsvTemplate(){
  var sample='date,instrument,direction,entry,stop,target,exit,pnl,setup,emotion,outcome,lesson\n'+
             '2026-05-15,NQ,LONG,21050,21000,21150,21125,150,ORB,calm,win,Held to target — patience worked\n'+
             '2026-05-16,ES,SHORT,5320,5330,5290,5305,75,VWAP Reject,focused,win,Clean rejection at VWAP\n';
  var b=new Blob([sample],{type:'text/csv'});var u=URL.createObjectURL(b);
  var a=document.createElement('a');a.href=u;a.download='niyyah-template.csv';a.click();URL.revokeObjectURL(u);
}
function onCsvPick(evt){
  var file=evt.target.files&&evt.target.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){csvError('File too large (max 5MB)');return;}
  var reader=new FileReader();
  reader.onerror=function(){csvError('Could not read the file');};
  reader.onload=function(e){parseCsv(e.target.result);};
  reader.readAsText(file);
  evt.target.value='';
}
function csvError(msg){
  el('csv-error-wrap').innerHTML='<div class="csv-error">'+msg+'</div>';
  el('csv-summary-wrap').innerHTML='';
  el('csv-confirm-btn').style.display='none';
  _csvPending=null;
}
function parseCsv(text){
  el('csv-error-wrap').innerHTML='';
  el('csv-summary-wrap').innerHTML='';
  var rows=csvSplitRows(text);
  if(rows.length<2){csvError('CSV is empty or has no data rows.');return;}
  var header=rows[0].map(function(h){return String(h||'').trim().toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');});
  function col(name){return header.indexOf(name);}
  // Accept common variant names so users don't have to massage the file
  function findIdx(){for(var i=0;i<arguments.length;i++){var x=col(arguments[i]);if(x>-1)return x;}return -1;}
  var idx={
    date:findIdx('date','tradedate','opendate','entrydate'),
    inst:findIdx('instrument','symbol','ticker'),
    dir:findIdx('direction','side'),
    entry:findIdx('entry','entryprice','openprice'),
    stop:findIdx('stop','stoploss'),
    target:findIdx('target','targetprice','tp'),
    exit:findIdx('exit','exitprice','closeprice'),
    pnl:findIdx('pnl','netpnl','profit','pl'),
    setup:findIdx('setup','strategy','tag'),
    emotion:findIdx('emotion','state','psychology'),
    outcome:findIdx('outcome','result'),
    lesson:findIdx('lesson','notes','note','comment')
  };
  if(idx.date===-1||idx.inst===-1){csvError('Missing required columns. CSV must include at minimum: date, instrument.');return;}
  var parsed=[],skipped=0;
  for(var r=1;r<rows.length;r++){
    var row=rows[r];if(!row||!row.length||row.every(function(c){return!String(c||'').trim();})){continue;}
    var date=String(row[idx.date]||'').trim();
    var inst=String(row[idx.inst]||'').trim().toUpperCase();
    if(!date||!inst){skipped++;continue;}
    // Normalize date — accept YYYY-MM-DD or MM/DD/YYYY
    date=normalizeDate(date);
    if(!date){skipped++;continue;}
    var dir=(idx.dir>-1?String(row[idx.dir]||''):'LONG').trim().toUpperCase();
    if(dir!=='LONG'&&dir!=='SHORT')dir=(dir==='S'||dir==='SELL'?'SHORT':'LONG');
    var pnlRaw=idx.pnl>-1?String(row[idx.pnl]||'').replace(/[$,\s]/g,''):'';
    var pnl=parseFloat(pnlRaw);if(isNaN(pnl))pnl=0;
    var exitPrice=idx.exit>-1?String(row[idx.exit]||'').trim():'';
    var isClosed=!!(exitPrice||pnlRaw);
    var t={
      id:Date.now()+r,
      status:isClosed?'closed':'open',
      date:date,
      time:'',
      instrument:inst,
      direction:dir,
      entryPrice:idx.entry>-1?String(row[idx.entry]||'').trim():'',
      stopPrice:idx.stop>-1?String(row[idx.stop]||'').trim():'',
      targetPrice:idx.target>-1?String(row[idx.target]||'').trim():'',
      exitPrice:exitPrice,
      setup:idx.setup>-1?String(row[idx.setup]||'').trim():'',
      emotion:(idx.emotion>-1?String(row[idx.emotion]||'').trim().toLowerCase():'')||'calm',
      outcome:idx.outcome>-1?String(row[idx.outcome]||'').trim().toLowerCase():(isClosed?(pnl>0?'win':pnl<0?'loss':'be'):''),
      lesson:idx.lesson>-1?String(row[idx.lesson]||'').trim():'',
      pnl:pnl,
      islamicCheck:{bismillah:false,prayer:false,setup:false,stop:false},
      gateAnswers:{},
      prayers:{},
      screenshot:null,
      createdAt:new Date().toISOString(),
      imported:true
    };
    if(isClosed)t.closedAt=new Date().toISOString();
    t.quality=calcQ(t);
    parsed.push(t);
  }
  if(!parsed.length){csvError('No valid trade rows found.'+(skipped?' '+skipped+' row(s) skipped — check date format and required columns.':''));return;}
  _csvPending=parsed;
  var closed=parsed.filter(function(t){return t.status==='closed';}).length;
  var open=parsed.length-closed;
  var totalPnl=parsed.reduce(function(s,t){return s+(t.pnl||0);},0);
  el('csv-summary-wrap').innerHTML='<div class="csv-summary"><strong>Ready to import '+parsed.length+' trade'+(parsed.length===1?'':'s')+'.</strong> '+closed+' closed · '+open+' open · total P&amp;L '+fmt(totalPnl,true)+'.'+(skipped?' ('+skipped+' row(s) skipped — missing date or instrument.)':'')+'</div>';
  el('csv-confirm-count').textContent=parsed.length;
  el('csv-confirm-btn').style.display='';
}
function csvSplitRows(text){
  // RFC-ish CSV split that handles quoted fields with embedded commas / quotes / newlines.
  var rows=[],row=[],field='',inQuotes=false;
  for(var i=0;i<text.length;i++){
    var c=text[i],n=text[i+1];
    if(inQuotes){
      if(c==='"'&&n==='"'){field+='"';i++;}
      else if(c==='"'){inQuotes=false;}
      else{field+=c;}
    } else {
      if(c==='"'){inQuotes=true;}
      else if(c===','){row.push(field);field='';}
      else if(c==='\r'){/* skip */}
      else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else{field+=c;}
    }
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows;
}
function normalizeDate(s){
  s=s.trim();
  // YYYY-MM-DD
  var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m)return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);
  // MM/DD/YYYY or M/D/YYYY
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m)return m[3]+'-'+pad(+m[1])+'-'+pad(+m[2]);
  // YYYY/MM/DD
  m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if(m)return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);
  return '';
}
function confirmCsvImport(){
  if(!_csvPending||!_csvPending.length){closeCsvModal();return;}
  var btn=el('csv-confirm-btn'),orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerHTML='<span class="spinner"></span>Importing…';}
  var prior=S.trades.slice();
  // New trades prepended so they appear at the top of the log
  S.trades=_csvPending.concat(S.trades);
  sv('trades',S.trades).then(function(){
    var n=_csvPending.length;
    _csvPending=null;
    closeCsvModal();
    updateNav();
    if(el('page-trades')&&el('page-trades').classList.contains('active'))renderTrades();
    if(el('page-dashboard')&&el('page-dashboard').classList.contains('active'))renderDash();
    toast('✓ Imported '+n+' trade'+(n===1?'':'s')+' — your mirror is live','s');
    // If we're mid-onboarding, the import IS the jump-start: advance straight
    // past the (now-redundant) practice-trade step to the finish.
    if(el('onboard')&&el('onboard').classList.contains('show')){ obNext(); }
  }).catch(function(){
    S.trades=prior; // sv() already toasted the error
  }).then(function(){
    if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerHTML=orig;}
  });
}

// ── DHIKR ──────────────────────────────────────────────────────────────────
function cDhikr(k){S.dhikr[k]=(S.dhikr[k]||0)+1;var e=el('dhikr-'+k);if(e)e.textContent=S.dhikr[k];sv('dhikr',S.dhikr);}
function resetDhikr(){S.dhikr={sub:0,alh:0,akb:0};['sub','alh','akb'].forEach(function(k){setText('dhikr-'+k,'0');});sv('dhikr',S.dhikr);}

// ── NAV ────────────────────────────────────────────────────────────────────
function updateNav(){
  var tc=el('nav-tc');if(tc)tc.textContent=S.trades.length;
  var oc=el('nav-oc');var ni=el('nav-intrade');
  var hasOpen=!!(S.openTradeId&&S.trades.find(function(t){return t.id===S.openTradeId&&t.status==='open';}));
  if(oc)oc.textContent=hasOpen?'\u25cf':'';
  if(ni)ni.className='nav-item'+(hasOpen?' alert':'');
  var cb=el('close-trade-btn');if(cb)cb.style.display=hasOpen?'':'none';
}

// ── VERSES ─────────────────────────────────────────────────────────────────
// ── VERSE LIBRARY — mapped to nafs patterns ──────────────────────────────
var VERSES=[
  {ar:"\u0648\u0627\u0635\u0628\u0650\u0631\u0652 \u0648\u064e\u0645\u064e\u0627 \u0635\u064e\u0628\u0652\u0631\u064f\u0643\u064e \u0625\u0650\u0644\u0627\u0651 \u0628\u0650\u0627\u0644\u0644\u0651\u064e\u0647\u0650",en:"And be patient \u2014 your patience is only through Allah.",ref:"An-Nahl \u00b7 16:127",lesson:"Sabr is not passive. It is the active choice to hold your plan when everything in you wants to deviate.",nafs:"sabr"},
  {ar:"\u0625\u0650\u0646\u0651\u064e \u0645\u064e\u0639\u064e \u0627\u0644\u0652\u0639\u064f\u0633\u0652\u0631\u0650 \u064a\u064f\u0633\u0652\u0631\u064b\u0627",en:"Indeed, with hardship comes ease.",ref:"Al-Inshirah \u00b7 94:6",lesson:"Your blown challenge is not your end. It is your education. Get up. Make wudu. Return with a clean slate.",nafs:"recovery"},
  {ar:"\u0644\u064e\u0627 \u064a\u064f\u0643\u064e\u0644\u0651\u0650\u0641\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0646\u064e\u0641\u0652\u0633\u064b\u0627 \u0625\u0650\u0644\u0627\u0651 \u0648\u064f\u0633\u0652\u0639\u064e\u0647\u064e\u0627",en:"Allah does not burden a soul beyond what it can bear.",ref:"Al-Baqarah \u00b7 2:286",lesson:"Your current drawdown is within your capacity. Your rules were designed for exactly this moment.",nafs:"recovery"},
  {ar:"\u0625\u0650\u0646\u0651\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064e \u0644\u064e\u0627 \u064a\u064f\u063a\u064e\u064a\u0651\u0650\u0631\u064f \u0645\u064e\u0627 \u0628\u0650\u0642\u064e\u0648\u0652\u0645\u0650",en:"Allah will not change a people until they change what is in themselves.",ref:"Ar-Ra'd \u00b7 13:11",lesson:"Your results are a mirror of your psychology. The inner game changes first. The P&L follows.",nafs:"discipline"},
  {ar:"\u0641\u064e\u0644\u064e\u0627 \u062a\u064e\u0647\u0650\u0646\u064f\u0648\u0627 \u0648\u064e\u0644\u064e\u0627 \u062a\u064e\u062d\u0652\u0632\u064e\u0646\u064f\u0648\u0627",en:"So do not weaken and do not grieve.",ref:"Al-Imran \u00b7 3:139",lesson:"A losing week does not define you. Your response to it does.",nafs:"recovery"},
  {ar:"\u0631\u064e\u0628\u0651\u0650 \u0632\u0650\u062f\u0652\u0646\u0650\u064a \u0639\u0650\u0644\u0652\u0645\u064b\u0627",en:"My Lord, increase me in knowledge.",ref:"Ta-Ha \u00b7 20:114",lesson:"Every trade \u2014 win or lose \u2014 teaches something. The trader who journals consistently learns fastest.",nafs:"tafakkur"},
  {ar:"\u0648\u064e\u0644\u064e\u0627 \u062a\u064e\u064a\u0652\u0623\u064e\u0633\u064f\u0648\u0627 \u0645\u0650\u0646 \u0631\u064e\u0651\u0648\u062d\u0650 \u0627\u0644\u0644\u0651\u064e\u0647\u0650",en:"Do not despair of the mercy of Allah.",ref:"Yusuf \u00b7 12:87",lesson:"After the worst day, mercy is still available. Tomorrow is a clean session.",nafs:"recovery"},
  {ar:"\u0648\u064e\u0639\u064e\u0644\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0641\u064e\u062a\u064e\u0648\u064e\u0643\u0651\u064e\u0644\u064f\u0648\u0627",en:"And upon Allah rely, if you should be believers.",ref:"Al-Ma'idah \u00b7 5:23",lesson:"You entered with analysis. You set your stop. Your job is done. What happens next is not yours to control.",nafs:"tawakkul"},
  {ar:"\u0648\u0627\u0644\u0643\u0627\u0638\u0645\u064a\u0646 \u0627\u0644\u063a\u064a\u0638 \u0648\u0627\u0644\u0639\u0627\u0641\u064a\u0646 \u0639\u0646 \u0627\u0644\u0646\u0627\u0633",en:"Those who restrain anger and pardon people.",ref:"Al-Imran \u00b7 3:134",lesson:"The market will provoke you. It is designed to. The trader who does not react to provocation has an edge no indicator can give.",nafs:"kibr"},
  {ar:"\u0648\u0644\u0627 \u062a\u0643\u0648\u0646\u0648\u0627 \u0643\u0627\u0644\u0630\u064a\u0646 \u0646\u0633\u0648\u0627 \u0627\u0644\u0644\u0647 \u0641\u0623\u0646\u0633\u0627\u0647\u0645 \u0623\u0646\u0641\u0633\u0647\u0645",en:"Do not be like those who forgot Allah, so He made them forget themselves.",ref:"Al-Hashr \u00b7 59:19",lesson:"When you abandon your structure \u2014 your rules, your process, your plan \u2014 you abandon yourself. The blueprint is your protection.",nafs:"discipline"},
  {ar:"\u0648\u062a\u0632\u0648\u062f\u0648\u0627 \u0641\u0625\u0646 \u062e\u064a\u0631 \u0627\u0644\u0632\u0627\u062f \u0627\u0644\u062a\u0642\u0648\u0649",en:"Take provision, but indeed the best provision is taqwa.",ref:"Al-Baqarah \u00b7 2:197",lesson:"Preparation is part of tawakkul, not its opposite. Study, plan, and then release the outcome.",nafs:"tawakkul"},
  {ar:"\u0627\u0644\u0630\u064a\u0646 \u0622\u0645\u0646\u0648\u0627 \u0648\u062a\u0637\u0645\u0626\u0646 \u0642\u0644\u0648\u0628\u0647\u0645 \u0628\u0630\u0643\u0631 \u0627\u0644\u0644\u0647",en:"Those who believed and whose hearts find rest in the remembrance of Allah.",ref:"Ar-Ra'd \u00b7 13:28",lesson:"Dhikr during a live trade is not ritual. It is the practical act of keeping the heart still when the P&L is moving.",nafs:"tawakkul"},
  {ar:"\u0641\u0625\u0630\u0627 \u0639\u0632\u0645\u062a \u0641\u062a\u0648\u0643\u0644 \u0639\u0644\u0649 \u0627\u0644\u0644\u0647",en:"When you have decided, then rely upon Allah.",ref:"Al-Imran \u00b7 3:159",lesson:"The decision is yours. The analysis, the entry, the stop \u2014 yours. The outcome belongs to Allah. This is not fatalism. This is the highest form of discipline.",nafs:"tawakkul"},
  {ar:"\u0648\u0644\u0627 \u062a\u0628\u062e\u0633\u0648\u0627 \u0627\u0644\u0646\u0627\u0633 \u0623\u0634\u064a\u0627\u0621\u0647\u0645",en:"Do not defraud people of their things.",ref:"Hud \u00b7 11:85",lesson:"Honesty in your trade log is non-negotiable. A journal you cherry-pick teaches you nothing. Log every trade, especially the ones you are ashamed of.",nafs:"tafakkur"},
  {ar:"\u0645\u0627 \u0623\u0635\u0627\u0628\u0643 \u0645\u0646 \u062d\u0633\u0646\u0629 \u0641\u0645\u0646 \u0627\u0644\u0644\u0647",en:"Whatever good reaches you is from Allah.",ref:"An-Nisa \u00b7 4:79",lesson:"A great week is not proof of your genius. It is rizq. Trade next week with the same humility you had in the losing weeks.",nafs:"kibr"}
];

function chooseVerse(){
  var closed=S.trades.filter(function(t){return t.status==='closed';}).slice(0,8);
  if(closed.filter(function(t){return['fomo','urgency','revenge'].includes(t.emotion||'');}).length>=2)return VERSES[0];
  if(closed.filter(function(t){return t.pnl<0;}).length>=4)return VERSES[1];
  if(closed.filter(function(t){return t.outcome&&t.outcome.indexOf('broke')>-1;}).length>=2)return VERSES[3];
  return VERSES[new Date().getDay()%VERSES.length];
}

// ── DAILY REFLECTION ENGINE ───────────────────────────────────────────────
// Shown every morning regardless of trading activity.
// Picks a verse based on nafs pattern from recent data.
function renderDailyReflection(){
  var e=el('daily-reflection-wrap');
  if(!e)return;

  // Only suppress late at night (after 20:00) — show on day 1 too so the
  // user has a reason to open the app even before their first trade.
  var h=new Date().getHours();
  if(h>=20){e.innerHTML='';return;}

  var closed=S.trades.filter(function(t){return t.status==='closed';});
  var last7=closed.filter(function(t){
    return (Date.now()-new Date(t.date+'T12:00:00').getTime())<604800000;
  });

  // ── PATTERN DETECTION → NAFS CATEGORY ────────────────────────────────
  var nafsCategory='tafakkur'; // default: reflection
  var patternLabel='Daily Reflection';

  if(last7.length>=3){
    var revCount=last7.filter(function(t){return t.emotion==='revenge';}).length;
    var brokeCount=last7.filter(function(t){return t.outcome&&t.outcome.indexOf('broke')>-1;}).length;
    var overconfCount=last7.filter(function(t){return t.exitEmotion==='overconf';}).length;
    var lossCount=last7.filter(function(t){return t.pnl<0;}).length;
    var contCount=last7.filter(function(t){
      return ['calm','patient','focused'].includes(t.emotion||'')&&
             ['revenge','frustrated','regret'].includes(t.exitEmotion||'');
    }).length;

    // Priority order: most urgent pattern first
    if(revCount>=2){
      nafsCategory='sabr';
      patternLabel='Nafs \u00b7 Revenge Pattern Active';
    } else if(brokeCount>=2){
      nafsCategory='discipline';
      patternLabel='Nafs \u00b7 Discipline Slipping';
    } else if(overconfCount>=2){
      nafsCategory='kibr';
      patternLabel='Nafs \u00b7 Kibr Warning';
    } else if(lossCount>=4){
      nafsCategory='recovery';
      patternLabel='Nafs \u00b7 In Recovery';
    } else if(contCount>=2){
      nafsCategory='tawakkul';
      patternLabel='Nafs \u00b7 Release the Outcome';
    } else {
      // No warning pattern — pick based on day of week for variety
      var dayCategories=['tawakkul','sabr','discipline','tafakkur','tawakkul','kibr','recovery'];
      nafsCategory=dayCategories[new Date().getDay()];
      patternLabel='Daily Reflection';
    }
  } else if(closed.length===0){
    // Brand new user — show welcoming tawakkul verse
    nafsCategory='tawakkul';
    patternLabel='Your First Reflection';
  }

  // ── SELECT VERSE ──────────────────────────────────────────────────────
  var pool=VERSES.filter(function(v){return v.nafs===nafsCategory;});
  if(!pool.length)pool=VERSES; // fallback
  // Rotate through pool by date so it changes daily
  var dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/86400000);
  var verse=pool[dayOfYear%pool.length];

  // ── BUILD UI ──────────────────────────────────────────────────────────
  var html='<div class="daily-reflection" data-hclick="h143" title="Open Journal">';
  html+='<div class="dr-eye">MORNING REFLECTION</div>';
  html+='<div class="dr-nafs-tag">'+patternLabel+'</div>';
  html+='<div class="dr-ar">'+verse.ar+'</div>';
  html+='<div class="dr-en">\u201c'+verse.en+'\u201d</div>';
  html+='<div class="dr-ref">'+verse.ref+'</div>';
  html+='<div class="dr-lesson">'+verse.lesson+'</div>';
  html+='</div>';

  e.innerHTML=html;
}



// ── DEEN SCORE ─────────────────────────────────────────────────────────────
function calcDeenScore(){
  var days=Object.keys(S.dailyPrayers);if(!days.length)return null;
  var recent=days.sort().slice(-20);
  if(!recent.length)return null;
  var avg=recent.map(function(d){
    var prayers=S.dailyPrayers[d];
    if(!prayers||typeof prayers!=='object')return 0;
    return Object.values(prayers).filter(Boolean).length/5*100;
  });
  if(!avg.length)return null;
  return Math.round(avg.reduce(function(a,v){return a+v;},0)/avg.length);
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function renderSiratTeaser(){
  var wrap=el('sirat-teaser-wrap');if(!wrap)return;
  wrap.innerHTML='';
  if(!isSirat())return;
  var result=computeUserStage(S);if(!result)return;
  var stage=SIRAT_STAGES[result.stage]||{name:result.stage,sub:''};
  var grad=result.graduation;
  if(!grad)return;
  var pct=grad.target>0?Math.min(100,Math.round(grad.progress/grad.target*100)):100;
  wrap.innerHTML='<div style="background:linear-gradient(90deg,rgba(218,180,98,0.06),transparent 70%);border:1px solid rgba(218,180,98,0.12);border-left:3px solid rgba(218,180,98,0.5);border-radius:0 var(--r-lg) var(--r-lg) 0;padding:12px 16px;margin-bottom:8px;cursor:pointer;" data-hclick="h144">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">'
    +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.48rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(218,180,98,0.6);">SIRAT PATH · '+stage.name.toUpperCase()+'</div>'
    +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.48rem;letter-spacing:0.1em;color:var(--ink-3);">'+grad.progress+' / '+grad.target+'</div>'
    +'</div>'
    +'<div style="font-size:0.78rem;color:var(--ink-2);margin-bottom:8px;">'+esc(grad.label)+' — '+esc(grad.copy)+'</div>'
    +'<div style="height:4px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">'
    +'<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#9a7820,#dab462);border-radius:3px;transition:width 0.8s cubic-bezier(0.16,1,0.3,1);"></div>'
    +'</div>'
    +'</div>';
}
function renderDash(){
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  var totalPnl=closed.reduce(function(s,t){return s+t.pnl;},0);
  var wins=closed.filter(function(t){return t.pnl>0;});
  var losses=closed.filter(function(t){return t.pnl<0;});
  var wr=closed.length?Math.round(wins.length/closed.length*100):null;
  var deen=calcDeenScore();
  var name=S.settings.name||'trader';
  var h=new Date().getHours();
  var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';

  // ── PRIMARY STATE CARD ──────────────────────────────────────────────────
  var openTrade=S.openTradeId?S.trades.find(function(t){return t.id===S.openTradeId&&t.status==='open';}):null;
  var eyeEl=el('today-eye-label'),greetEl=el('today-greeting'),subEl=el('today-sub'),actEl=el('today-actions');
  if(openTrade){
    if(eyeEl)eyeEl.textContent='LIVE POSITION \u00b7 TAWAKKUL';
    if(greetEl)greetEl.innerHTML='You are <em>in a trade</em>.';
    if(subEl)subEl.textContent=openTrade.instrument+' '+openTrade.direction+(openTrade.entryPrice?' \u00b7 Entry: '+openTrade.entryPrice:'')+' \u00b7 Trust the plan.';
    if(actEl)actEl.innerHTML='<button class="btn btn-gold" data-hclick="h145">In Trade \u2192</button><button class="btn btn-outline" data-hclick="h64">Close Trade</button>';
  } else if(!S.trades.length){
    if(eyeEl)eyeEl.textContent='BISMILLAH \u00b7 BEGIN';
    if(greetEl)greetEl.innerHTML='As-salamu alaykum, <em>'+name+'</em>.';
    if(subEl)subEl.innerHTML='Two steps to begin \u2014 <strong style="color:var(--ink-2);">log your first trade</strong> when a setup appears, and <strong style="color:var(--ink-2);">tap each prayer</strong> as you pray it. Patterns surface after 5 trades.';
    if(actEl)actEl.innerHTML='<button class="btn btn-gold" data-hclick="h65">+ Log first trade</button><button class="btn btn-outline" data-hclick="h146">Read the Guide</button>';
  } else {
    if(eyeEl)eyeEl.textContent='TODAY \u00b7 '+new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    if(greetEl)greetEl.innerHTML=greet+', <em>'+name+'</em>.';
    var todayTrades=S.trades.filter(function(t){return t.date===localDate();});
    var todayClosed=todayTrades.filter(function(t){return t.status==='closed';});
    var todayPnl=todayClosed.reduce(function(s,t){return s+t.pnl;},0);
    // \u2500\u2500 Jumu'ah branch \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Friday before 1:30pm local time. Speaks to the specific tension Muslim
    // traders feel on a Jumu'ah day: do I close before khutbah?
    var dayOfWeek=new Date().getDay();
    var minutesNow=h*60 + new Date().getMinutes();
    var isJumuahWindow = (dayOfWeek===5 && minutesNow < 13*60+30);
    if(isJumuahWindow){
      if(eyeEl) eyeEl.textContent = 'JUMU\u2019AH \u00b7 ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
      if(subEl) subEl.innerHTML = 'Today is Friday. Khutbah is soon \u2014 close positions before salah, or hold with intention.';
      var openIds = S.trades.filter(function(t){return t.status==='open';}).length;
      if(actEl){
        if(openIds>0){
          actEl.innerHTML = '<button class="btn btn-gold" data-hclick="h64">Close open trade for Jumu\u2019ah</button><button class="btn btn-outline" data-hclick="h143">Morning Journal</button>';
        } else {
          actEl.innerHTML = '<button class="btn btn-outline" data-hclick="h65">+ Enter Trade (after Jumu\u2019ah)</button><button class="btn btn-gold" data-hclick="h143">Morning Journal</button>';
        }
      }
    } else if(h<9){
      if(subEl)subEl.textContent='Pre-market. Set your intention before opening any chart.';
      if(actEl)actEl.innerHTML='<button class="btn btn-gold" data-hclick="h65">+ Enter Trade</button><button class="btn btn-outline" data-hclick="h143">Morning Journal</button>';
    } else if(todayClosed.length>0){
      var pnlStr=fmt(todayPnl,true);
      if(subEl)subEl.textContent=todayClosed.length+' trade'+(todayClosed.length>1?'s':'')+' today \u00b7 '+pnlStr+'.';
      if(actEl)actEl.innerHTML='<button class="btn btn-gold" data-hclick="h65">+ Another Trade</button><button class="btn btn-outline" data-hclick="h143">Evening Reflection</button>';
    } else {
      if(subEl)subEl.textContent='Ready. Your edge is patience.';
      if(actEl)actEl.innerHTML='<button class="btn btn-gold" data-hclick="h65">+ Enter Trade</button><button class="btn btn-outline" data-hclick="h143">Open Journal</button>';
    }
  }

  // ── OPEN BANNER (clear it — state shown above) ─────────────────────────
  var ob=el('open-banner');if(ob)ob.innerHTML='';

  // ── SALAH COMPACT PILLS ────────────────────────────────────────────────
  var prayers=['fajr','dhuhr','asr','maghrib','isha'];
  var todayP=S.dailyPrayers[localDate()]||{};
  var prayedCount=prayers.filter(function(p){return todayP[p];}).length;
  var scToday=el('sal-count-today');if(scToday)scToday.textContent=prayedCount+'/5';
  prayers.forEach(function(p){var pill=el('tp-'+p);if(pill){if(todayP[p])pill.classList.add('done');else pill.classList.remove('done');}});
  // Hint only appears while the user is learning the affordance; remove once they've engaged.
  var sHint=el('sal-hint-today');
  if(sHint){
    var prayerDays=Object.keys(S.dailyPrayers||{}).length;
    sHint.style.display = (prayedCount===0 && prayerDays<3) ? '' : 'none';
  }

  // ── SIRAT PATH TEASER (Sirat subscribers) ─────────────────────────────
  renderSiratTeaser();

  // ── SAHIB · the daily companion (diagnosis + weekly commitment) ────────
  try{ renderSahib(); }catch(e){ console.error('sahib:',e); }

  // ── SINGLE BEHAVIORAL INSIGHT ──────────────────────────────────────────
  renderTodayInsight();

  // ── MORNING INTENTION ──────────────────────────────────────────────────
  // Only meaningful in the morning, and only after the user has any trade history
  // (zero-trade users don't need another empty input on day 1).
  var intentCard=el('today-intention-card');
  var intentEl=el('today-intention-input');
  var showIntent = h < 18 && S.trades.length > 0;
  if(intentCard) intentCard.style.display = showIntent ? '' : 'none';
  if(showIntent && intentEl && !intentEl.value){
    var today=localDate();
    var savedInt=S.morning&&S.morning[today]&&S.morning[today].intention;
    if(savedInt)intentEl.value=savedInt;
  }

  // ── MUHASABAH + STREAK ─────────────────────────────────────────────────
  renderDailyReflection();runFridayMuhasabah();runMuhasabah();renderStreak();

  // ── KPI VALUES ─────────────────────────────────────────────────────────
  var pe=el('kpi-pnl');if(pe){pe.textContent=closed.length?fmt(totalPnl,true):'—';pe.className='today-card-val '+(totalPnl>0?'g':totalPnl<0?'r':'');}
  setText('kpi-pnl-m',closed.length?closed.length+' closed trades':'Log your first close to begin');
  setText('kpi-wr',wr!==null?wr+'%':'\u2014');
  setText('kpi-wr-m',wr!==null?wins.length+'W \u00b7 '+losses.length+'L':'Appears after 1 closed trade');
  setText('kpi-deen',deen!==null?deen+'/100':'\u2014');
  setText('kpi-deen-m',deen!==null?(deen>=80?'Mashallah \u2746':deen>=60?'Strong foundation':'Keep building'):'Tap a prayer pill above');
  var lastClosed=closed[0];
  var lqEl=el('kpi-last-q');
  if(lqEl){lqEl.textContent=lastClosed?(lastClosed.quality||0)+'/100':'—';lqEl.className='today-card-val '+(lastClosed&&(lastClosed.quality||0)>=70?'g':lastClosed&&(lastClosed.quality||0)>=40?'gold':'r');}
  setText('kpi-last-q-m',lastClosed?lastClosed.instrument+' \u00b7 '+fmtDate(lastClosed.date):'Set after your first close');

  // ── ADVANCED SECTION ───────────────────────────────────────────────────
  // Hide the expand entirely until the user has closed at least one trade —
  // before that, the analytics panel is empty placeholders.
  // Sirat stage teaser strip
  var sss=el('sirat-stage-strip');
  if(sss){
    if(isSirat()){
      var stg=computeUserStage(S);
      var stageName={tahaarah:'Tahaarah',sabr:'Sabr',yaqeen:'Yaqeen',tawakkul:'Tawakkul',ihsan:'Ihsan'}[stg.stage]||stg.stage;
      var stageIdx={tahaarah:1,sabr:2,yaqeen:3,tawakkul:4,ihsan:5}[stg.stage]||1;
      var closedReal=closed.filter(function(t){return !t.sample;});
      var minT=SIRAT_THRESHOLDS.minTradesForStage2||20;
      var progressPct=stg.stage==='tahaarah'?Math.min(100,Math.round(closedReal.length/minT*100)):100;
      sss.style.display='';
      sss.innerHTML='<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
        +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.52rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);">SIRAT · STAGE '+stageIdx+'/5</div>'
        +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;font-weight:600;color:var(--ink);">'+stageName+'</div>'
        +(stg.stage==='tahaarah'?'<div style="flex:1;min-width:100px;"><div style="height:4px;background:var(--surface-2);border-radius:2px;"><div style="height:4px;background:var(--gold);border-radius:2px;width:'+progressPct+'%;transition:width .5s;"></div></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;color:var(--ink-3);margin-top:4px;">'+closedReal.length+' / '+minT+' trades to Stage 2</div></div>':'')
        +'<button class="btn btn-ghost btn-sm" data-hclick="h147" style="margin-left:auto;">View path →</button>'
        +'</div>';
    } else {
      sss.style.display='none';
    }
  }
  var expBtn=el('today-expand-btn');
  if(expBtn) expBtn.style.display = closed.length ? '' : 'none';
  var adv=el('today-advanced');
  if(adv){
    if(!closed.length){
      adv.classList.remove('show');
      var ico=el('today-expand-icon'),lbl=el('today-expand-label');
      if(ico)ico.textContent='↓';
      if(lbl)lbl.textContent='Show Analytics';
    } else if(adv.classList.contains('show')){
      renderAdvancedDash();
    }
  }
}

function renderAdvancedDash(){
  renderSparklines();renderInsights();renderStatsStrip();
  var v=chooseVerse();setText('v-ar',v.ar);setText('v-ref',v.ref);
  var ven=el('v-en');if(ven)ven.textContent='"'+v.en+'"';
  renderEquity();renderRecentTrades();
}

function toggleAdvanced(){
  var adv=el('today-advanced'),ico=el('today-expand-icon'),lbl=el('today-expand-label');
  if(!adv)return;
  var open=adv.classList.contains('show');
  if(open){adv.classList.remove('show');if(ico)ico.textContent='\u2193';if(lbl)lbl.textContent='Show Analytics';}
  else{adv.classList.add('show');if(ico)ico.textContent='\u2191';if(lbl)lbl.textContent='Hide Analytics';renderAdvancedDash();}
}

function saveTodayIntention(){
  var intentEl=el('today-intention-input');if(!intentEl)return;
  var val=intentEl.value.trim();if(!val)return;
  var today=localDate();
  if(!S.morning)S.morning={};if(!S.morning[today])S.morning[today]={};
  S.morning[today].intention=val;sv('morning',S.morning);
}

function renderTodayInsight(){
  var e=el('today-insight-wrap');if(!e)return;
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  // Anticipation: show how many trades remain before patterns unlock.
  // Day-0 user gets a calm welcome; 1–4 closed trades see a progress meter
  // so they know what they are working toward.
  if(closed.length<3){
    if(closed.length===0){
      // Personalized welcome — if the user told us their biggest leak during
      // onboarding, speak to it directly. Otherwise fall back to the generic.
      var leak=S.settings&&S.settings.leak;
      var leakCopy={
        revenge:{label:'YOUR LEAK · REVENGE',text:'You named <strong>revenge trading</strong> as your biggest leak. The pre-trade gate will surface your last 5 revenge trades the moment you answer "No" to the calm question — your own history, before you take the next one.'},
        fomo:{label:'YOUR LEAK · FOMO',text:'You named <strong>FOMO</strong> as your biggest leak. Once you have 5 trades logged, Niyyah will show you the win rate of trades you took urgently vs trades you waited for. The pattern is usually brutal.'},
        rules:{label:'YOUR LEAK · BROKEN RULES',text:'You named <strong>breaking your rules</strong>. Every trade gets a quality score; rule-breaks compress it. After your first 5 closes you\'ll see exactly what each rule-break has cost you in dollars.'},
        overconf:{label:'YOUR LEAK · KIBR',text:'You named <strong>kibr after wins</strong>. Niyyah will warn you in the pre-trade gate when you are on a win streak — same rules, always. The data will show you what happens when you don\'t listen.'},
        missing:{label:'YOUR LEAK · MISSED SALAH',text:'You named <strong>missing salah for charts</strong>. The prayer radar will show you, in your own data, what win rate looks like on full-prayer days vs missed-prayer days. Most users find a 15–30% gap.'},
        boredom:{label:'YOUR LEAK · BOREDOM TRADES',text:'You named <strong>boredom trades</strong>. Zero trades on a day with no setup will be celebrated as a winning session. The pre-trade gate will ask if you actually waited — every time.'}
      };
      var lc=(leak&&leakCopy[leak])||{label:'YOUR JOURNEY · BEGINS',text:'Your behavioral patterns unlock at <strong>5 closed trades</strong>. Until then, every trade you log is building the mirror. The first reflection is the hardest — and the most honest.'};
      e.innerHTML='<div class="today-insight" style="cursor:default;border-left-color:var(--gold);"><div class="today-insight-label">'+lc.label+'</div><div class="today-insight-text">'+lc.text+'</div></div>';
    } else {
      var remaining=5-closed.length;
      var pct=Math.round((closed.length/5)*100);
      e.innerHTML='<div class="today-insight" style="cursor:default;"><div class="today-insight-label">YOUR TRADING PATTERNS · '+closed.length+' OF 5 TRADES</div><div class="today-insight-text"><strong>'+remaining+' more closed trade'+(remaining===1?'':'s')+'</strong> and your behavioral insights unlock — revenge sequences, prayer correlation, the calm-vs-emotional edge. The mirror needs data to reflect.</div><div style="margin-top:10px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#9a7820,#dab462,#ecc878);border-radius:3px;transition:width 0.8s cubic-bezier(0.16,1,0.3,1);"></div></div></div>';
    }
    return;
  }
  // Build a pool of all valid insights, then pick one deterministically by day
  // so the user sees different patterns on different days instead of always
  // the same first match.
  var insightPool=[];

  // 1. Active revenge pattern (always surfaces if present — it's urgent)
  var last5=closed.slice(0,5);
  var revRecent=last5.filter(function(t){return t.emotion==='revenge';});
  if(revRecent.length>=2){
    var revWR=Math.round(revRecent.filter(function(t){return t.pnl>0;}).length/revRecent.length*100);
    insightPool.push({text:'<strong>'+revRecent.length+' revenge trades</strong> in your last 5. Win rate: <strong>'+revWR+'%</strong>. The pattern is active. Notice it before the next entry.',type:'warn',priority:0});
  }

  // 2. Losing streak warning
  var last3=closed.slice(0,3);
  if(last3.length===3&&last3.every(function(t){return t.pnl<0;})){
    var ls3Pnl=last3.reduce(function(s,t){return s+t.pnl;},0);
    insightPool.push({text:'Three losses in a row. Total: <strong>'+fmt(ls3Pnl,true)+'</strong>. Ask yourself honestly — is the next trade from your playbook, or from wanting it back?',type:'warn',priority:1});
  }

  // 3. Win streak / kibr warning
  var last4=closed.slice(0,4);
  if(last4.length===4&&last4.every(function(t){return t.pnl>0;})){
    insightPool.push({text:'<strong>4 wins in a row</strong>. Alhamdulillah — and this is exactly when kibr enters. Apply the same rules on trade 5 as you did on trade 1.',type:'warn',priority:2});
  }

  // 4. Prayer-to-P&L correlation
  var pDays=Object.keys(S.dailyPrayers);
  var fullPD=pDays.filter(function(d){return Object.values(S.dailyPrayers[d]).every(Boolean);});
  var partPD=pDays.filter(function(d){return!Object.values(S.dailyPrayers[d]).every(Boolean);});
  var fpT=closed.filter(function(t){return fullPD.indexOf(t.date)>-1;});
  var ppT=closed.filter(function(t){return partPD.indexOf(t.date)>-1;});
  if(fpT.length>=4&&ppT.length>=4){
    var fpWR=Math.round(fpT.filter(function(t){return t.pnl>0;}).length/fpT.length*100);
    var ppWR=Math.round(ppT.filter(function(t){return t.pnl>0;}).length/ppT.length*100);
    if(fpWR>ppWR+10){insightPool.push({text:'Full salah days: <strong>'+fpWR+'%</strong> win rate ('+fpT.length+' trades) vs <strong>'+ppWR+'%</strong> on partial-prayer days ('+ppT.length+' trades). Your data is telling you something.',type:'good',priority:3});}
  }

  // 5. Calm vs emotional edge
  var calm=closed.filter(function(t){return['calm','patient','focused'].includes(t.emotion||'');});
  var emot=closed.filter(function(t){return['fomo','revenge','urgency','overconf'].includes(t.emotion||'');});
  if(calm.length>=4&&emot.length>=3){
    var cWR=Math.round(calm.filter(function(t){return t.pnl>0;}).length/calm.length*100);
    var eWR=Math.round(emot.filter(function(t){return t.pnl>0;}).length/emot.length*100);
    if(cWR>eWR+15){insightPool.push({text:'Calm trades: <strong>'+cWR+'%</strong> win rate vs <strong>'+eWR+'%</strong> emotional. Stillness is already your edge.',type:'good',priority:4});}
  }

  // 6. Best setup spotlight
  var setups={};closed.forEach(function(t){if(t.setup){if(!setups[t.setup])setups[t.setup]={w:0,n:0,pnl:0};setups[t.setup].n++;if(t.pnl>0)setups[t.setup].w++;setups[t.setup].pnl+=t.pnl;}});
  var bestSetup=null,bestSWR=-1;Object.keys(setups).forEach(function(s){if(setups[s].n>=4){var wr=Math.round(setups[s].w/setups[s].n*100);if(wr>bestSWR){bestSWR=wr;bestSetup=s;}}});
  if(bestSetup&&bestSWR>=60){insightPool.push({text:'Your <strong>'+esc(bestSetup)+'</strong> setup: <strong>'+bestSWR+'%</strong> win rate over '+setups[bestSetup].n+' trades. This is your edge. Trade it until your data says otherwise.',type:'good',priority:5});}

  // 7. Day-of-week best day
  var dowMap={};closed.forEach(function(t){var d=new Date(t.date+'T12:00:00').getDay();if(!dowMap[d])dowMap[d]={pnl:0,n:0};dowMap[d].pnl+=t.pnl;dowMap[d].n++;});
  var dowNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var bestDow=null,bestDowPnl=-Infinity;Object.keys(dowMap).forEach(function(d){if(dowMap[d].n>=3&&dowMap[d].pnl>bestDowPnl){bestDowPnl=dowMap[d].pnl;bestDow=d;}});
  var worstDow=null,worstDowPnl=Infinity;Object.keys(dowMap).forEach(function(d){if(dowMap[d].n>=3&&dowMap[d].pnl<worstDowPnl){worstDowPnl=dowMap[d].pnl;worstDow=d;}});
  if(worstDow!==null&&worstDowPnl<0){insightPool.push({text:'<strong>'+dowNames[worstDow]+'</strong> is your worst trading day ('+(worstDowPnl>0?'+':'')+fmt(worstDowPnl,true)+' total). Consider trading lighter or skipping entirely.',type:'warn',priority:6});}
  else if(bestDow!==null&&bestDowPnl>0){insightPool.push({text:'<strong>'+dowNames[bestDow]+'</strong> is your strongest day — <strong>'+fmt(bestDowPnl,true)+'</strong> total P&L. Be fully present on it.',type:'good',priority:7});}

  // 8. Overtrading warning (5+ trades on any single day)
  var dayTradeCounts={};closed.forEach(function(t){dayTradeCounts[t.date]=(dayTradeCounts[t.date]||0)+1;});
  var overtradeDays=Object.values(dayTradeCounts).filter(function(n){return n>=5;}).length;
  if(overtradeDays>=2){insightPool.push({text:'You\'ve had <strong>'+overtradeDays+' sessions with 5+ trades</strong>. More trades rarely means more profit — it usually means the nafs is running the session.',type:'warn',priority:8});}

  if(!insightPool.length){e.innerHTML='';return;}

  // Always show the highest-priority urgent alert if it exists.
  // For non-urgent insights, rotate by day of year so the user sees variety.
  insightPool.sort(function(a,b){return a.priority-b.priority;});
  var urgent=insightPool.find(function(x){return x.priority<=2;});
  var chosen=urgent||insightPool[new Date().getDate()%insightPool.length];
  var label=chosen.type==='warn'?'Pattern Alert':chosen.type==='good'?'Your Edge':'Today\'s Insight';
  e.innerHTML='<div class="today-insight" data-hclick="h148" title="See full analytics"><div class="today-insight-label">'+label+'</div><div class="today-insight-text">'+chosen.text+'</div></div>';
}
function renderSparklines(){
  var dayMap={};
  S.trades.filter(function(t){return t.status==='closed';}).slice().reverse().forEach(function(t){
    if(!dayMap[t.date])dayMap[t.date]={pnl:0,w:0,n:0};
    dayMap[t.date].pnl+=t.pnl;dayMap[t.date].n++;if(t.pnl>0)dayMap[t.date].w++;
  });
  var days=Object.keys(dayMap).sort().slice(-10);if(days.length<2)return;
  drawSpark('spark-pnl',days.map(function(d){return dayMap[d].pnl;}));
  drawSpark('spark-wr',days.map(function(d){return dayMap[d].n?dayMap[d].w/dayMap[d].n*100:0;}));
  drawSpark('spark-deen',days.map(function(d){var p=S.dailyPrayers[d];return p?Object.values(p).filter(Boolean).length/5*100:0;}));
}
function drawSpark(id,vals){
  var e=el(id);if(!e||vals.length<2)return;
  var n=Math.min(vals.length,10),vs=vals.slice(-n);
  var mx=Math.max.apply(null,vs.map(Math.abs));if(mx<1)mx=1;
  var W=n*9,H=21,mid=Math.floor(H/2);
  var bars=vs.map(function(v,i){var bh=Math.max(2,Math.round(Math.abs(v)/mx*(mid-1)));return'<rect x="'+(i*9)+'" y="'+(v>=0?mid-bh:mid)+'" width="7" height="'+bh+'" fill="'+(v>=0?'#6cb088':'#d28282')+'" opacity="0.72" rx="1.5"/>';}).join('');
  e.innerHTML='<line x1="0" y1="'+mid+'" x2="'+W+'" y2="'+mid+'" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>'+bars;
  e.setAttribute('viewBox','0 0 '+W+' '+H);e.setAttribute('width','100%');e.setAttribute('height',H);
}

function renderInsights(){
  var e=el('insights-wrap');if(!e)return;
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  if(closed.length<4){e.innerHTML='<div class="empty" style="padding:26px 8px;"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.8A8.5 8.5 0 1 1 10.2 3.5 6.8 6.8 0 0 0 20.5 14.8z"/></svg></div><div class="empty-title">Insights after 5 closed trades</div><div class="empty-text">Keep logging. The patterns will emerge.</div></div>';return;}
  var ins=[];

  // Contradiction detection — calm entry, bad exit
  var contradictions=closed.filter(function(t){return['calm','patient','focused'].includes(t.emotion||'')&&['revenge','frustrated','regret'].includes(t.exitEmotion||'');});
  if(contradictions.length>=2){ins.push({t:'w',i:'\u26a0',title:'Entry calm, exit emotional',desc:'<strong>'+contradictions.length+'</strong> trades where you entered calm but exited in distress. The trade is testing your tawakkul. Watch for this pattern.'});}

  // Revenge trading
  var rev=closed.filter(function(t){return t.emotion==='revenge';});
  if(rev.length>=2){var rwr=Math.round(rev.filter(function(t){return t.pnl>0;}).length/rev.length*100);ins.push({t:'w',i:'\u26a0',title:'Revenge trading detected',desc:'<strong>'+rev.length+'</strong> revenge trades, <span class="p">'+rwr+'%</span> win rate. The nafs is expensive.'});}

  // Calm edge
  var calm=closed.filter(function(t){return['calm','patient','focused'].includes(t.emotion||'');});
  var emot=closed.filter(function(t){return['fomo','revenge','urgency','overconf','anxious'].includes(t.emotion||'');});
  if(calm.length>=3&&emot.length>=2){
    var cwr=Math.round(calm.filter(function(t){return t.pnl>0;}).length/calm.length*100);
    var ewr=Math.round(emot.filter(function(t){return t.pnl>0;}).length/emot.length*100);
    if(cwr>ewr+12){ins.push({t:'g',i:'\u2713',title:'Sabr is your measurable edge',desc:'Calm/focused: <span class="p">'+cwr+'%</span> vs emotional: <span class="p">'+ewr+'%</span>. The data confirms the deen.'});}
  }

  // Prayer correlation
  var days=Object.keys(S.dailyPrayers);
  if(days.length>=5){
    var f5=days.filter(function(d){return Object.values(S.dailyPrayers[d]).every(Boolean);});
    var pf5=days.filter(function(d){return f5.indexOf(d)===-1;});
    var tf=closed.filter(function(t){return f5.indexOf(t.date)>-1;});
    var tp=closed.filter(function(t){return pf5.indexOf(t.date)>-1;});
    if(tf.length>=3&&tp.length>=3){
      var fwr=Math.round(tf.filter(function(t){return t.pnl>0;}).length/tf.length*100);
      var pw=Math.round(tp.filter(function(t){return t.pnl>0;}).length/tp.length*100);
      if(fwr>pw+8)ins.push({t:'g',i:'✓',title:'Full salah days outperform',desc:'Full-prayer days: <span class="p">'+fwr+'%</span> vs <span class="p">'+pw+'%</span>. The same discipline. Different arenas.'});
    }
  }

  // Rule breaks
  var broke=closed.filter(function(t){return t.outcome&&t.outcome.indexOf('broke')>-1;});
  if(broke.length>=3){
    var lp=Math.round(broke.filter(function(t){return t.pnl<0;}).length/broke.length*100);
    var brokePnl=broke.reduce(function(s,t){return s+t.pnl;},0);
    ins.push({t:'w',i:'⚠',title:'Rule breaks are expensive',desc:'<span class="p">'+lp+'%</span> of rule breaks lose money. Total cost: <strong>'+fmt(brokePnl,true)+'</strong>.'});
  }

  // Quality score improvement
  if(closed.length>=8){
    var rec3=closed.slice(0,3);var old3=closed.slice(closed.length-3);
    var rAvg=rec3.reduce(function(s,t){return s+(t.quality||0);},0)/3;
    var oAvg=old3.reduce(function(s,t){return s+(t.quality||0);},0)/3;
    if(rAvg>oAvg+12){ins.push({t:'g',i:'\u2191',title:'Discipline is compounding',desc:'Recent quality avg: <span class="p">'+Math.round(rAvg)+'/100</span> vs early avg: <span class="p">'+Math.round(oAvg)+'/100</span>. The process is working.'});}
  }

  if(!ins.length){e.innerHTML='<div class="empty" style="padding:20px 8px;"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z"/><path d="M12 15c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5z"/></svg></div><div class="empty-title">Building your pattern profile</div><div class="empty-text">More trades logged = more precise insights.</div></div>';return;}
  e.innerHTML=ins.slice(0,3).map(function(x){return'<div class="insight '+x.t+'"><div class="insight-ico">'+x.i+'</div><div><div class="insight-title">'+x.title+'</div><div class="insight-desc">'+x.desc+'</div></div></div>';}).join('');
}

// Closed trades in chronological order (oldest first). Array insertion order
// (S.trades.unshift = newest *entered* first) is NOT reliable chronological
// order once a trade entered earlier is closed later, or a date is edited \u2014 so
// any sequential metric (streaks, equity curve, drawdown) must sort explicitly.
function _chronoClosed(){
  return S.trades.filter(function(t){return t.status==='closed';})
    .slice()
    .sort(function(a,b){
      // Prefer the real close timestamp; fall back to trade date + entry time.
      var ka=(a.closedAt||((a.date||'')+'T'+(a.time||'00:00')))+'#'+(a.id||0);
      var kb=(b.closedAt||((b.date||'')+'T'+(b.time||'00:00')))+'#'+(b.id||0);
      return ka<kb?-1:ka>kb?1:0;
    });
}
// R-multiple of a closed trade = net P&L ÷ initial risk ($). Initial risk is
// |entry − stop| × $/point × contracts. Returns null when the inputs needed
// aren't present (no stop, unknown instrument, etc.). Computed on demand so it
// works for trades logged before this existed.
function _tradeR(t){
  if(!t || t.pnl==null) return null;
  var e=parseFloat(String(t.entryPrice||'').replace(/[^\d.\-]/g,''));
  var s=parseFloat(String(t.stopPrice||t.stopLoss||'').replace(/[^\d.\-]/g,''));
  var tv=TICK_VALUES[_normaliseInst(t.instrument||'')];
  var q=parseFloat(t.qty)||1;
  if(isNaN(e)||isNaN(s)||!tv||Math.abs(e-s)<=0) return null;
  var risk=Math.abs(e-s)*tv*q;
  if(risk<=0) return null;
  return Math.round((t.pnl/risk)*100)/100;
}

// ══════════════════════════════════════════════════════════════════════════
// SAHIB (صاحب · "the companion") — the daily guide.
// Reads the user's own closed trades, names the single highest-cost
// behavioural leak, turns it into one weekly commitment, then measures
// whether they actually improved week over week. Fully deterministic — no
// AI, no data leaves the account. Diagnosis is stage-aware: it reads the
// Sirat stage and weights which leaks matter for where the trader is.
// ══════════════════════════════════════════════════════════════════════════

var SAHIB_MIN_TRADES = 6;
// Which leaks Sahib prioritises per Sirat stage. Same engine, different
// companion: survival-stage traders are pushed toward risk control;
// consistent traders toward squeezing the edge. Default weight is 1.
var SAHIB_STAGE_WEIGHTS = {
  tahaarah: { hard_stops:2.2, fixed_size:1.9, no_revenge:1.9, max_trades:1.5 },
  sabr:     { has_setup:1.8, pray_before:1.4, max_trades:1.3, time_window:1.4, no_revenge:1.3 },
  yaqeen:   { has_setup:1.5, capture:1.4, pray_before:1.3, time_window:1.2 },
  tawakkul: { capture:1.9, fixed_size:1.4, time_window:1.2 },
  ihsan:    { capture:2.0, fixed_size:1.3 }
};

function _sahibNum(v){ var n=parseFloat(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isNaN(n)?null:n; }
function _median(a){ if(!a.length)return 0; var s=a.slice().sort(function(x,y){return x-y;}); var m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function _daysSince(dateStr){ var a=new Date(dateStr+'T00:00:00'), b=new Date(localDate()+'T00:00:00'); return Math.max(0,Math.round((b-a)/86400000)); }
function _fmtHour(h){ h=((h%24)+24)%24; var ap=h<12?'am':'pm'; var hh=h%12; if(hh===0)hh=12; return hh+ap; }
function _plannedRisk(t){
  var e=_sahibNum(t.entryPrice), s=_sahibNum(t.stopPrice!=null?t.stopPrice:t.stopLoss);
  var tv=TICK_VALUES[_normaliseInst(t.instrument||'')]; var q=parseFloat(t.qty)||1;
  if(e==null||s==null||!tv||Math.abs(e-s)<=0)return null;
  return Math.abs(e-s)*tv*q;
}
// Non-sample closed trades in chronological order (oldest first).
function _sahibChrono(){
  return S.trades.filter(function(t){return t.status==='closed' && !t.sample;}).slice().sort(function(a,b){
    var ka=(a.closedAt||((a.date||'')+'T'+(a.time||'00:00')))+'#'+(a.id||0);
    var kb=(b.closedAt||((b.date||'')+'T'+(b.time||'00:00')))+'#'+(b.id||0);
    return ka<kb?-1:ka>kb?1:0;
  });
}
function _isRevengeTrade(t,prev){ return t.emotion==='revenge' || (prev && prev.pnl<0 && prev.date===t.date); }

// ── Leak detectors. Each returns null or a leak object:
//    { id, label, cost, freq, evidence, prescription, commitment, meta } ──
function _sahibDetectRevenge(chrono){
  var win=chrono.slice(-20), rev=[];
  for(var i=0;i<win.length;i++){ if(_isRevengeTrade(win[i], i>0?win[i-1]:null)) rev.push(win[i]); }
  if(rev.length<2) return null;
  var sum=rev.reduce(function(s,t){return s+t.pnl;},0);
  if(sum>=0) return null;
  var wr=Math.round(rev.filter(function(t){return t.pnl>0;}).length/rev.length*100);
  return { id:'no_revenge', label:'Revenge trading', cost:Math.abs(sum), freq:rev.length,
    evidence: rev.length+' of your recent trades were taken on tilt or right after a loss — they\'re '+fmt(sum,true)+' at <strong>'+wr+'%</strong> win.',
    prescription:'After any loss, step away for ten minutes before the next entry — or call it a day.',
    commitment:'No revenge entries — after a loss, I step away before trading again.', meta:{} };
}
function _sahibDetectStopMoving(chrono){
  var win=chrono.slice(-25);
  var losers=win.filter(function(t){return t.pnl<0;}).map(function(t){return {t:t,r:_tradeR(t),pr:_plannedRisk(t)};}).filter(function(x){return x.r!=null&&x.pr!=null;});
  if(losers.length<3) return null;
  var blown=losers.filter(function(x){return x.r<=-1.15;});
  if(blown.length<2) return null;
  var extra=blown.reduce(function(s,x){return s+(Math.abs(x.t.pnl)-x.pr);},0);
  if(extra<=0) return null;
  return { id:'hard_stops', label:'Moving your stop', cost:extra, freq:blown.length,
    evidence: '<strong>'+blown.length+' of your last '+losers.length+'</strong> losers blew past the stop you set — about '+fmt(extra)+' of avoidable damage.',
    prescription:'Place the stop when your mind is clear, then never touch it. That version of you knew better.',
    commitment:'Hard stops only — once it\'s placed, it does not move.', meta:{} };
}
function _sahibDetectCutWinners(chrono){
  var win=chrono.slice(-25);
  var winners=win.filter(function(t){return t.pnl>0 && t.mfe!=null && t.mfe>0;});
  if(winners.length<4) return null;
  var avgWin=winners.reduce(function(s,t){return s+t.pnl;},0)/winners.length;
  var avgMfe=winners.reduce(function(s,t){return s+t.mfe;},0)/winners.length;
  if(avgMfe < avgWin*1.35) return null;
  return { id:'capture', label:'Cutting winners early', cost:(avgMfe-avgWin)*winners.length, freq:winners.length,
    evidence: 'Your winners ran to '+fmt(avgMfe,true)+' on average but you booked '+fmt(avgWin,true)+' — leaving about <strong>'+Math.round((1-avgWin/avgMfe)*100)+'%</strong> on the table.',
    prescription:'Move to breakeven at 1R and let a runner reach target instead of grabbing the first green.',
    commitment:'Let winners run — hold a runner to target instead of booking early.', meta:{} };
}
function _sahibDetectOversizing(chrono){
  var win=chrono.slice(-25);
  var med=_median(win.map(function(t){return parseFloat(t.qty)||1;}));
  if(med<=0) return null;
  var big=[]; for(var i=1;i<win.length;i++){ if(win[i-1].pnl>0 && (parseFloat(win[i].qty)||1)>med*1.3) big.push(win[i]); }
  if(big.length<2) return null;
  var sum=big.reduce(function(s,t){return s+t.pnl;},0);
  if(sum>=0) return null;
  return { id:'fixed_size', label:'Sizing up after wins', cost:Math.abs(sum), freq:big.length,
    evidence: 'After a win you size up — those bigger trades are '+fmt(sum,true)+'. Kibr sizes up; sabr stays consistent.',
    prescription:'Risk the same fixed amount every trade, win or lose.',
    commitment:'Same size every trade this week — fixed risk regardless of the last result.', meta:{med:med} };
}
function _sahibDetectNoEdge(chrono){
  var win=chrono.slice(-25);
  var noEdge=win.filter(function(t){ return (t.gateAnswers&&t.gateAnswers.waited==='no') || !((t.setup||'').trim()); });
  if(noEdge.length<3) return null;
  var sum=noEdge.reduce(function(s,t){return s+t.pnl;},0);
  if(sum>=0) return null;
  var wr=Math.round(noEdge.filter(function(t){return t.pnl>0;}).length/noEdge.length*100);
  return { id:'has_setup', label:'Trading without a setup', cost:Math.abs(sum), freq:noEdge.length,
    evidence: 'Trades you took without waiting for a named setup are '+fmt(sum,true)+' at <strong>'+wr+'%</strong> — improvising costs you.',
    prescription:'If you can\'t name the setup from your playbook, it isn\'t a trade.',
    commitment:'Only trades I can name from my playbook — no improvising.', meta:{} };
}
function _sahibDetectPrayerTilt(chrono){
  if(chrono.length<8) return null;
  var dp=S.dailyPrayers||{};
  function full(d){ var p=dp[d]; return p && Object.keys(p).length>=5 && Object.values(p).every(Boolean); }
  var fp=chrono.filter(function(t){return full(t.date);});
  var pp=chrono.filter(function(t){return dp[t.date] && !full(t.date);});
  if(fp.length<4||pp.length<3) return null;
  var fpWR=Math.round(fp.filter(function(t){return t.pnl>0;}).length/fp.length*100);
  var ppWR=Math.round(pp.filter(function(t){return t.pnl>0;}).length/pp.length*100);
  if(fpWR<=ppWR+10) return null;
  var sum=pp.reduce(function(s,t){return s+t.pnl;},0);
  return { id:'pray_before', label:'Trading through missed prayers', cost:Math.max(Math.abs(sum),1)+ (fpWR-ppWR), freq:pp.length,
    evidence: 'Full-prayer days: <strong>'+fpWR+'%</strong> win rate. Partial-prayer days: <strong>'+ppWR+'%</strong>. Your deen and your edge move together.',
    prescription:'Pray before the session. Start with your deen intact.',
    commitment:'Pray before every trading session this week — no exceptions.', meta:{} };
}
function _sahibDetectTimeOfDay(chrono){
  var win=chrono.slice(-30), buckets={};
  win.forEach(function(t){ if(!t.time)return; var h=parseInt(String(t.time).slice(0,2),10); if(isNaN(h))return; (buckets[h]=buckets[h]||[]).push(t); });
  var worst=null;
  Object.keys(buckets).forEach(function(h){ var ts=buckets[h]; if(ts.length<3)return; var pnl=ts.reduce(function(s,t){return s+t.pnl;},0); if(pnl<0 && (!worst||pnl<worst.pnl)) worst={h:parseInt(h,10),pnl:pnl,n:ts.length}; });
  if(!worst) return null;
  var cut=worst.h;
  return { id:'time_window', label:'Trading past your edge window', cost:Math.abs(worst.pnl), freq:worst.n,
    evidence: 'Your trades in the '+_fmtHour(worst.h)+'–'+_fmtHour(worst.h+1)+' hour are '+fmt(worst.pnl,true)+' across '+worst.n+' trades. That hour isn\'t your edge.',
    prescription:'Stop trading after your edge window closes. Flat is a position.',
    commitment:'No new trades after '+_fmtHour(cut)+' this week — protect the hours that aren\'t my edge.', meta:{cutHour:cut} };
}
function _sahibDetectOvertrading(chrono){
  var win=chrono.slice(-40), byDay={};
  win.forEach(function(t){ (byDay[t.date]=byDay[t.date]||[]).push(t); });
  var hi=[],lo=[];
  Object.keys(byDay).forEach(function(d){ var ts=byDay[d]; var pnl=ts.reduce(function(s,t){return s+t.pnl;},0); if(ts.length>=5)hi.push(pnl); else if(ts.length<=2)lo.push(pnl); });
  if(hi.length<2) return null;
  var hiAvg=hi.reduce(function(s,p){return s+p;},0)/hi.length;
  var loAvg=lo.length?lo.reduce(function(s,p){return s+p;},0)/lo.length:0;
  if(hiAvg>=loAvg) return null;
  var cost=Math.abs(hi.filter(function(p){return p<0;}).reduce(function(s,p){return s+p;},0));
  if(cost<=0) return null;
  return { id:'max_trades', label:'Overtrading', cost:cost, freq:hi.length,
    evidence: 'Days you take 5+ trades average '+fmt(Math.round(hiAvg),true)+'; your 1–2 trade days average '+fmt(Math.round(loAvg),true)+'. More clicks, less money.',
    prescription:'Cap your trades. Fewer, better decisions.',
    commitment:'Max 3 trades a day this week — quality over quantity.', meta:{target:3} };
}
var SAHIB_DETECTORS = [_sahibDetectRevenge,_sahibDetectStopMoving,_sahibDetectCutWinners,_sahibDetectOversizing,_sahibDetectNoEdge,_sahibDetectPrayerTilt,_sahibDetectTimeOfDay,_sahibDetectOvertrading];

// Run every detector, weight by stage, return ranked leaks + the stage.
function diagnoseSahib(){
  var chrono=_sahibChrono();
  var stage=(typeof computeUserStage==='function' ? (computeUserStage(S).stage||'tahaarah') : 'tahaarah');
  if(chrono.length < SAHIB_MIN_TRADES) return { enough:false, stage:stage, need:SAHIB_MIN_TRADES-chrono.length, leaks:[] };
  var leaks=[];
  SAHIB_DETECTORS.forEach(function(fn){ try{ var r=fn(chrono); if(r && r.cost>0) leaks.push(r); }catch(e){} });
  var w=SAHIB_STAGE_WEIGHTS[stage]||{};
  leaks.forEach(function(l){ l.severity=l.cost*(w[l.id]||1); });
  leaks.sort(function(a,b){ return b.severity-a.severity; });
  return { enough:true, stage:stage, leaks:leaks };
}

// ── Commitment + measurement loop ──
function _sahibSince(d){ return _sahibChrono().filter(function(t){return (t.date||'')>=d;}); }
function _sahibBefore(d,n){ var b=_sahibChrono().filter(function(t){return (t.date||'')<d;}); return b.slice(-Math.max(n,8)); }

// Measure how well the active commitment is being kept. Returns
// { value, before, unit, better, hit, line } where `line` is human copy.
function measureSahib(c){
  var since=_sahibSince(c.startDate), before=_sahibBefore(c.startDate, since.length);
  function pctRespectStop(arr){ var l=arr.filter(function(t){return t.pnl<0;}).map(_tradeR).filter(function(r){return r!=null;}); if(!l.length)return null; return Math.round(l.filter(function(r){return r>=-1.15;}).length/l.length*100); }
  function revengeCount(arr){ var n=0; for(var i=0;i<arr.length;i++){ if(_isRevengeTrade(arr[i], i>0?arr[i-1]:null)) n++; } return n; }
  function captureRatio(arr){ var w=arr.filter(function(t){return t.pnl>0&&t.mfe!=null&&t.mfe>0;}); if(w.length<2)return null; var aw=w.reduce(function(s,t){return s+t.pnl;},0)/w.length, am=w.reduce(function(s,t){return s+t.mfe;},0)/w.length; return am>0?Math.round(aw/am*100):null; }
  function setupPct(arr){ if(!arr.length)return null; return Math.round(arr.filter(function(t){return (t.setup||'').trim() && !(t.gateAnswers&&t.gateAnswers.waited==='no');}).length/arr.length*100); }
  function maxPerDay(arr){ var by={}; arr.forEach(function(t){by[t.date]=(by[t.date]||0)+1;}); var m=0; Object.keys(by).forEach(function(d){if(by[d]>m)m=by[d];}); return arr.length?m:null; }
  function prayedDaysPct(arr){ var dp=S.dailyPrayers||{}; var days={}; arr.forEach(function(t){days[t.date]=1;}); var ks=Object.keys(days); if(!ks.length)return null; var ok=ks.filter(function(d){var p=dp[d];return p&&Object.values(p).filter(Boolean).length>=4;}).length; return Math.round(ok/ks.length*100); }
  function afterCut(arr,h){ var late=arr.filter(function(t){ if(!t.time)return false; var hh=parseInt(String(t.time).slice(0,2),10); return !isNaN(hh)&&hh>=h; }); return late.length; }
  var v,b,unit,better,hit,line;
  switch(c.id){
    case 'no_revenge': v=revengeCount(since); b=revengeCount(before); unit=''; better='lower'; hit=(v===0);
      line=(v===0?'Zero revenge entries since you committed.':v+' slipped through'+(b>v?' — down from '+b:'')+'.'); break;
    case 'hard_stops': v=pctRespectStop(since); b=pctRespectStop(before); unit='%'; better='higher'; hit=(v!=null&&v>=90);
      line=(v==null?'No closed losers yet to measure.':v+'% of losers held the stop'+(b!=null?' (was '+b+'%)':'')+'.'); break;
    case 'capture': v=captureRatio(since); b=captureRatio(before); unit='%'; better='higher'; hit=(v!=null&&v>=70);
      line=(v==null?'Not enough winners with extremes logged yet.':'You captured '+v+'% of the move'+(b!=null?' (was '+b+'%)':'')+'.'); break;
    case 'has_setup': v=setupPct(since); b=setupPct(before); unit='%'; better='higher'; hit=(v!=null&&v>=90);
      line=(v==null?'No trades yet to measure.':v+'% were named setups'+(b!=null?' (was '+b+'%)':'')+'.'); break;
    case 'fixed_size': var mvals=since.map(function(t){return parseFloat(t.qty)||1;}); var md=_median(mvals); var off=md>0?since.filter(function(t){return Math.abs((parseFloat(t.qty)||1)-md)>md*0.3;}).length:0; v=since.length?Math.round((since.length-off)/since.length*100):null; b=null; unit='%'; better='higher'; hit=(v!=null&&v>=90);
      line=(v==null?'No trades yet to measure.':v+'% of trades stayed at your base size.'); break;
    case 'pray_before': v=prayedDaysPct(since); b=prayedDaysPct(before); unit='%'; better='higher'; hit=(v!=null&&v>=80);
      line=(v==null?'No prayer data logged on trading days yet.':v+'% of your trading days you prayed'+(b!=null?' (was '+b+'%)':'')+'.'); break;
    case 'max_trades': var tgt=(c.meta&&c.meta.target)||3; v=maxPerDay(since); b=maxPerDay(before); unit=' max/day'; better='lower'; hit=(v!=null&&v<=tgt);
      line=(v==null?'No trades yet to measure.':'Busiest day: '+v+' trades'+(b!=null?' (was '+b+')':'')+'. Cap is '+tgt+'.'); break;
    case 'time_window': var h=(c.meta&&c.meta.cutHour)||12; v=afterCut(since,h); b=afterCut(before,h); unit=''; better='lower'; hit=(v===0);
      line=(v===0?'No trades after '+_fmtHour(h)+' since you committed.':v+' trade'+(v===1?'':'s')+' slipped past '+_fmtHour(h)+(b>v?' — down from '+b:'')+'.'); break;
    default: v=null;b=null;unit='';better='higher';hit=false;line='Tracking your commitment.';
  }
  return { value:v, before:b, unit:unit, better:better, hit:hit, line:line, days:_daysSince(c.startDate) };
}

function acceptSahibCommitment(){
  var diag=diagnoseSahib(); if(!diag.enough||!diag.leaks.length) return;
  var idx=window._sahibIdx||0; if(idx>=diag.leaks.length)idx=0;
  var leak=diag.leaks[idx];
  if(!S.sahib)S.sahib={commitment:null,history:[]};
  S.sahib.commitment={ id:leak.id, text:leak.commitment, leakLabel:leak.label, meta:leak.meta||{}, startDate:localDate(), startedAt:new Date().toISOString() };
  window._sahibIdx=0;
  sv('sahib',S.sahib);
  toast('Bismillah — this week\'s focus is set.','s');
  renderSahib();
}
function swapSahibCommitment(){
  var diag=diagnoseSahib(); if(!diag.enough||diag.leaks.length<2) return;
  window._sahibIdx=((window._sahibIdx||0)+1)%diag.leaks.length;
  renderSahib();
}
function lockInSahibWeek(){
  var c=S.sahib&&S.sahib.commitment; if(!c) return;
  var m=measureSahib(c);
  S.sahib.history=S.sahib.history||[];
  S.sahib.history.push({ week:c.startDate, id:c.id, text:c.text, value:m.value, before:m.before, hit:m.hit, line:m.line, closedAt:localDate() });
  if(S.sahib.history.length>26) S.sahib.history=S.sahib.history.slice(-26);
  S.sahib.commitment=null;
  window._sahibIdx=0;
  sv('sahib',S.sahib);
  toast(m.hit?'Mashallah — locked in. New focus ready.':'Logged. A fresh focus this week, insha\'Allah.','s');
  renderSahib();
}

// One-line daily brief — powers both the in-app frame and the daily push.
function sahibBriefText(){
  try{
    var diag=diagnoseSahib();
    if(!diag.enough) return 'Log '+diag.need+' more trade'+(diag.need===1?'':'s')+' and I\'ll name the one habit costing you the most.';
    var c=S.sahib&&S.sahib.commitment;
    if(c){
      if(_daysSince(c.startDate)>=7) return 'Your week is in — open Niyyah to see how you held your focus.';
      if(new Date().getHours()<16) return 'Today’s focus: '+c.text;
      return _sahibTodayLine(c);
    }
    if(diag.leaks && diag.leaks.length) return 'I found the one habit costing you the most this week. Open Niyyah to see it.';
    return 'No leak worth chasing right now — alhamdulillah. Keep logging honestly.';
  }catch(e){ return 'Open Niyyah — your companion is waiting.'; }
}
// Today-scoped reflection on the active commitment (the evening frame).
function _sahibTodayLine(c){
  var today=localDate();
  var tt=_sahibChrono().filter(function(t){return t.date===today;});
  var n=tt.length;
  if(!n) return 'No trades logged today. The focus still stands: '+c.text;
  switch(c.id){
    case 'no_revenge': { var r=0; for(var i=0;i<tt.length;i++){ if(_isRevengeTrade(tt[i], i>0?tt[i-1]:null)) r++; } return n+' trade'+(n===1?'':'s')+' today · '+(r===0?'no revenge entries. That’s the work.':r+' revenge entr'+(r===1?'y':'ies')+' — name it.'); }
    case 'hard_stops': { var blown=tt.filter(function(t){return t.pnl<0;}).map(_tradeR).filter(function(x){return x!=null;}).filter(function(x){return x<=-1.15;}).length; return n+' today · '+(blown===0?'every stop held.':blown+' stop'+(blown===1?'':'s')+' moved.'); }
    case 'max_trades': { var tgt=(c.meta&&c.meta.target)||3; return n+' trade'+(n===1?'':'s')+' today · '+(n<=tgt?'within your cap of '+tgt+'.':'over your cap of '+tgt+'.'); }
    case 'time_window': { var h=(c.meta&&c.meta.cutHour)||12; var late=tt.filter(function(t){var hh=parseInt(String(t.time||'').slice(0,2),10);return !isNaN(hh)&&hh>=h;}).length; return n+' today · '+(late===0?'nothing after '+_fmtHour(h)+'.':late+' after '+_fmtHour(h)+'.'); }
    case 'has_setup': { var named=tt.filter(function(t){return (t.setup||'').trim() && !(t.gateAnswers&&t.gateAnswers.waited==='no');}).length; return named+' of '+n+' today were named setups.'; }
    case 'fixed_size': { return n+' trade'+(n===1?'':'s')+' today · hold your size steady.'; }
    case 'pray_before': { var dp=(S.dailyPrayers||{})[today]||{}; var p=Object.values(dp).filter(Boolean).length; return n+' today · '+p+'/5 prayers logged.'; }
    default: return n+' trade'+(n===1?'':'s')+' logged today. Focus: '+c.text;
  }
}

// ── Sahib card (mounts into #sahib-card on the dashboard) ──
function _sahibCard(eye,inner){
  return '<div class="sahib-card"><div class="sahib-eye"><span class="sahib-eye-dot"></span>'+eye+'</div>'+inner+'</div>';
}
function renderSahib(){
  var host=el('sahib-card'); if(!host) return;
  var diag=diagnoseSahib();
  if(!diag.enough){
    host.innerHTML=_sahibCard('SAHIB · YOUR COMPANION',
      '<div class="sahib-title">I\'m learning your game.</div>'+
      '<div class="sahib-body">Log <strong>'+diag.need+' more closed trade'+(diag.need===1?'':'s')+'</strong> and I\'ll name the one habit costing you the most — then we fix it together, one week at a time.</div>');
    return;
  }
  var c=S.sahib&&S.sahib.commitment;
  if(!c && (!diag.leaks || !diag.leaks.length)){
    var wins=(S.sahib&&S.sahib.history&&S.sahib.history.length)||0;
    host.innerHTML=_sahibCard('SAHIB · STEADY',
      '<div class="sahib-title">No leak worth chasing right now. <em>Alhamdulillah.</em></div>'+
      '<div class="sahib-body">Your recent trades show no single habit bleeding you. Keep logging honestly — the moment something drifts, I\'ll flag it before it costs you.'+(wins?' You\'ve locked in <strong>'+wins+'</strong> weekly focus'+(wins===1?'':'es')+' so far.':'')+'</div>');
    return;
  }
  if(c){
    var m=measureSahib(c);
    var arrow=(m.value!=null&&m.before!=null)?(m.value===m.before?'':(((m.better==='higher'&&m.value>m.before)||(m.better==='lower'&&m.value<m.before))?' ▲ improving':' ▼ slipping')):'';
    if(m.days>=7){
      host.innerHTML=_sahibCard('SAHIB · YOUR WEEK',
        '<div class="sahib-title">'+(m.hit?'You held it. <em>Mashallah.</em>':'Honest look at the week.')+'</div>'+
        '<div class="sahib-commit">“'+esc(c.text)+'”</div>'+
        '<div class="sahib-body">'+m.line+'</div>'+
        '<div class="sahib-actions"><button class="btn btn-gold btn-sm" data-hclick="hSahibLock">'+(m.hit?'Lock it in · next focus →':'Set a fresh focus →')+'</button></div>');
    } else {
      var morning=new Date().getHours()<16;
      var brief = morning ? 'Today — hold the line.' : _sahibTodayLine(c);
      host.innerHTML=_sahibCard('SAHIB · '+(morning?'TODAY':'TONIGHT')+' · DAY '+(m.days+1)+' OF 7',
        '<div class="sahib-commit">“'+esc(c.text)+'”</div>'+
        '<div class="sahib-title" style="font-size:1.15rem;margin-top:12px;margin-bottom:6px;">'+esc(brief)+'</div>'+
        '<div class="sahib-body">This week: '+m.line+'<span style="color:var(--gold);">'+arrow+'</span></div>'+
        '<div class="sahib-foot">'+(7-m.days)+' day'+((7-m.days)===1?'':'s')+' left — I\'m watching.</div>');
    }
    return;
  }
  var idx=window._sahibIdx||0; if(idx>=diag.leaks.length)idx=0;
  var leak=diag.leaks[idx];
  var stageName=(SIRAT_STAGES[diag.stage]&&SIRAT_STAGES[diag.stage].name)||'';
  host.innerHTML=_sahibCard('SAHIB · '+(stageName?stageName.toUpperCase()+' · ':'')+'YOUR BIGGEST LEAK',
    '<div class="sahib-title">'+esc(leak.label)+'</div>'+
    '<div class="sahib-body">'+leak.evidence+'</div>'+
    '<div class="sahib-rx">'+leak.prescription+'</div>'+
    '<div class="sahib-commit">This week: “'+esc(leak.commitment)+'”</div>'+
    '<div class="sahib-actions"><button class="btn btn-gold btn-sm" data-hclick="hSahibAccept">Commit this week →</button>'+
    (diag.leaks.length>1?'<button class="btn btn-ghost btn-sm" data-hclick="hSahibSwap">Show another</button>':'')+'</div>');
}

function renderStatsStrip(){
  var e=el('stats-strip');if(!e)return;
  var closed=S.trades.filter(function(t){return t.status==='closed';});if(!closed.length){e.innerHTML='';return;}
  var wins=closed.filter(function(t){return t.pnl>0;});var losses=closed.filter(function(t){return t.pnl<0;});
  var avgW=wins.length?wins.reduce(function(s,t){return s+t.pnl;},0)/wins.length:0;
  var avgL=losses.length?Math.abs(losses.reduce(function(s,t){return s+t.pnl;},0)/losses.length):0;
  var grossW=wins.reduce(function(s,t){return s+t.pnl;},0);
  var grossL=Math.abs(losses.reduce(function(s,t){return s+t.pnl;},0));
  // Expectancy = average net P&L per trade. Summing all pnl \u00f7 N counts
  // breakevens correctly (as 0) \u2014 the old wr*avgW-(1-wr)*avgL formula lumped
  // breakevens in with losers and understated it.
  var exp=closed.reduce(function(s,t){return s+(t.pnl||0);},0)/closed.length;
  var pf=grossL>0?(grossW/grossL):(grossW>0?Infinity:null);
  var cw=0,cl=0;
  var chrono=_chronoClosed(); // oldest first \u2192 iterate from the end for "most recent"
  for(var i=chrono.length-1;i>=0;i--){if(chrono[i].pnl>0)cw++;else break;}
  for(var j=chrono.length-1;j>=0;j--){if(chrono[j].pnl<0)cl++;else break;}
  var streak=cw>0?'+'+cw+' wins':cl>0?'-'+cl+' losses':'\u2014';
  var sc=cw>0?'var(--green)':cl>0?'var(--red)':'var(--ink)';
  function stat(lbl,val,col){return'<div class="metric-card"><div class="metric-label">'+lbl+'</div><div class="metric-val" style="color:'+(col||'var(--gold)')+'">'+val+'</div></div>';}
  e.innerHTML=stat('EXPECTANCY',fmt(exp,true),exp>=0?'var(--green)':'var(--red)')+stat('PROFIT FACTOR',pf===Infinity?'\u221e':(pf?pf.toFixed(2):'\u2014'),(pf&&pf>=1)?'var(--green)':'var(--red)')+stat('AVG W / AVG L',avgW?(fmt(avgW)+' / '+fmt(avgL)):'\u2014','var(--ink)')+stat('CURRENT STREAK',streak,sc);
}

function renderEquity(){
  if(!window.Chart){
    // Chart.js is lazy-loaded — fetch it, then retry.
    if(typeof window.__ensureChart === 'function'){
      window.__ensureChart().then(renderEquity).catch(_chartFallback);
    }
    return;
  }
  var c=el('eq-chart');if(!c)return;
  if(C.eq){try{C.eq.destroy();}catch(e){}}
  var trades=_chronoClosed();
  if(S.eqRange==='30'){var co30=Date.now()-2592000000;trades=trades.filter(function(t){return new Date(t.date+'T12:00:00').getTime()>=co30;});}
  else if(S.eqRange==='7'){var co7=Date.now()-604800000;trades=trades.filter(function(t){return new Date(t.date+'T12:00:00').getTime()>=co7;});}
  if(!trades.length){c.parentElement.innerHTML='<div class="empty" style="padding:50px;"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M7 14l4-5 3 3 4-6"/></svg></div><div class="empty-title">Equity curve appears here</div></div>';return;}
  var cum=0,peak=0,eq=[],dd=[];
  trades.forEach(function(t){cum+=t.pnl;if(cum>peak)peak=cum;eq.push(cum);dd.push(Math.min(0,cum-peak));});
  try{C.eq=new Chart(c,{type:'line',data:{labels:trades.map(function(_,i){return'T'+(i+1);}),datasets:[
    {data:eq,borderColor:'#dab462',backgroundColor:function(ctx){var ca=ctx.chart.chartArea;if(!ca)return'rgba(218,180,98,0.08)';var g=ctx.chart.ctx.createLinearGradient(0,ca.top,0,ca.bottom);g.addColorStop(0,'rgba(218,180,98,0.2)');g.addColorStop(1,'rgba(218,180,98,0)');return g;},borderWidth:2.5,fill:true,tension:0.38,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:'#dab462'},
    {data:dd,borderColor:'rgba(210,130,130,0.42)',backgroundColor:'rgba(210,130,130,0.07)',borderWidth:1.5,fill:true,tension:0.38,pointRadius:0}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#181510',borderColor:'rgba(218,180,98,0.28)',borderWidth:1,titleColor:'#f0e8d4',bodyColor:'#beb29a',padding:10,cornerRadius:7,callbacks:{label:function(ctx){return ctx.datasetIndex===0?'Equity: '+fmt(ctx.parsed.y,true):'Drawdown: '+fmt(ctx.parsed.y,true);}}}},scales:{x:{grid:{color:'rgba(255,255,255,0.024)'},ticks:{color:'#867c66',font:{family:'JetBrains Mono',size:10}}},y:{grid:{color:'rgba(255,255,255,0.024)'},ticks:{color:'#867c66',font:{family:'JetBrains Mono',size:10},callback:function(v){return v===0?'$0':fmt(v);}}}}}});}catch(e){console.error('Equity:',e);}
}
function setEq(r,btn){S.eqRange=r;btn.parentElement.querySelectorAll('.tg-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');renderEquity();}

function renderRecentTrades(){
  var e=el('recent-wrap');if(!e)return;var r=S.trades.slice(0,6);
  if(!r.length){e.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M7 14l4-5 3 3 4-6"/></svg></div><div class="empty-title">No trades yet</div><div class="empty-text">Log your first trade entry to start building your journal.</div><button class="btn btn-gold" data-hclick="h65" style="margin-top:18px;">+ Log your first trade</button></div>';return;}
  e.innerHTML=r.map(function(t){return'<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--line-2);cursor:pointer;" data-hclick="hOpenTD" data-hid="'+t.id+'" title="Click for full detail"><span class="t-side '+(t.direction==='LONG'?'long':'short')+'">'+esc(t.direction)+'</span><div style="flex:1;min-width:0;"><div style="font-size:0.88rem;font-weight:600;color:var(--ink);">'+esc(t.instrument)+'</div><div style="font-size:0.68rem;color:var(--ink-3);margin-top:2px;">'+fmtDate(t.date)+(t.setup?' \u00b7 '+esc(t.setup):'')+(t.emotion?' \u00b7 '+esc(t.emotion):'')+'</div></div>'+(t.status==='open'?'<span class="open-pill">OPEN</span><button class="btn btn-gold btn-sm" data-hclick="h149">Close</button>':'<div class="q-score"><div class="q-bar"><div class="q-fill" style="width:'+(t.quality||0)+'%;"></div></div>'+(t.quality||0)+'</div><div class="t-pnl '+(t.pnl>=0?'pos':'neg')+'">'+fmt(t.pnl,true)+'</div>')+'</div>';}).join('');
}

// ── IN-TRADE ────────────────────────────────────────────────────────────────
function renderInTrade(){
  renderPrayerPill();
  var t=S.openTradeId?S.trades.find(function(x){return x.id===S.openTradeId&&x.status==='open';}):null;
  var de=el('open-trade-detail'),pe=el('intrade-eye'),pt=el('intrade-title'),ps=el('intrade-sub'),cb=el('close-trade-btn');
  var panels=el('intrade-active-panels');
  if(!t){
    if(pe)pe.textContent='IN TRADE MODE';if(pt)pt.innerHTML='Stay <em>grounded</em>.';
    if(ps)ps.textContent='When a trade is open, your dhikr counter and tawakkul reminder appear here.';
    if(de)de.innerHTML='<div class="panel" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:18px 20px;border-color:rgba(218,180,98,0.12);"><div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px;">NO ACTIVE POSITION</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.1rem;color:var(--ink-2);">Enter a trade to see your live position details here.</div></div><button class="btn btn-gold" data-hclick="h65">+ Enter a Trade</button></div>';
    if(cb)cb.style.display='none';
    if(panels)panels.style.display='none';
    return;
  }
  if(pe)pe.textContent='YOU ARE IN A TRADE';if(pt)pt.innerHTML='Tawakkul \u2014 <em>Release</em> the outcome.';if(ps)ps.innerHTML='Your analysis is done. Your stop is set. Trust Allah with what happens next.<br><span style="font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;color:var(--ink-4);">Switch to your platform to monitor price \u2014 return here to close.</span>';if(cb)cb.style.display='';
  if(panels)panels.style.display='';
  if(de)de.innerHTML='<div class="panel" style="border-color:rgba(218,180,98,0.3);background:linear-gradient(135deg,rgba(218,180,98,0.07),transparent),var(--surface);position:relative;overflow:hidden;"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);"></div><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;"><div><div class="open-badge" style="margin-bottom:11px;">LIVE POSITION</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:600;color:var(--ink);letter-spacing:-0.02em;margin-bottom:9px;">'+esc(t.instrument)+' <span style="color:'+(t.direction==='LONG'?'var(--green)':'var(--red)')+';">'+esc(t.direction)+'</span></div><div style="display:flex;gap:16px;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--ink-3);flex-wrap:wrap;line-height:2;">'+(t.entryPrice?'<span>Entry\u00a0<strong style="color:var(--ink);">'+esc(t.entryPrice)+'</strong></span>':'')+(t.stopPrice?'<span>Stop\u00a0<strong style="color:var(--red);">'+esc(t.stopPrice)+'</strong></span>':'')+(t.targetPrice?'<span>Target\u00a0<strong style="color:var(--green);">'+esc(t.targetPrice)+'</strong></span>':'')+(t.setup?'<span>Setup\u00a0<strong style="color:var(--gold);">'+esc(t.setup)+'</strong></span>':'')+'</div></div><div style="text-align:right;flex-shrink:0;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px;">QUALITY</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:600;color:var(--gold);">'+(t.quality||'\u2014')+'</div></div></div></div>';
}

function stopMoveCheck(){
  var questions=[
    'Is the market structure broken, or just uncomfortable?',
    'Are you moving it out of fear, or out of new information?',
    'If you hadn\'t seen the P&L, would you still move it?',
    'Would you make this decision without a live position open?',
    'Your stop was set with a calm mind before entering. That version of you knew better.'
  ];
  var q=questions[Math.floor(Math.random()*questions.length)];
  confirmModal({
    title:'Before you touch that stop…',
    text:q+'\n\nMoving your stop to avoid a loss is not risk management — it\'s the nafs taking over.',
    okText:'I\'ll leave it. Tawakkul.',
    cancelText:'I have a real reason',
    danger:false,
    icon:'⚠'
  }).then(function(kept){
    if(kept){toast('Barakallahu feek. Trust your plan.','s');}
    else{toast('Log your reason in the trade lesson when you close.','i');}
  });
}

// ── TRADES ─────────────────────────────────────────────────────────────────
var _tradeSortKey='date',_tradeSortDir=-1;
function sortT(key){if(_tradeSortKey===key){_tradeSortDir*=-1;}else{_tradeSortKey=key;_tradeSortDir=-1;}renderTrades();}
function filterT(f,btn){S.tradeFilter=f;sv('tradeFilter',f);document.querySelectorAll('#page-trades .tg-btn').forEach(function(b){b.classList.remove('active');});if(btn)btn.classList.add('active');renderTrades();}
function renderTrades(){
  var w=el('trade-table-wrap');if(!w)return;
  var t=[].concat(S.trades);
  if(S.tradeFilter==='open')t=t.filter(function(x){return x.status==='open';});
  else if(S.tradeFilter==='wins')t=t.filter(function(x){return x.status==='closed'&&x.pnl>0;});
  else if(S.tradeFilter==='losses')t=t.filter(function(x){return x.status==='closed'&&x.pnl<0;});
  else if(S.tradeFilter==='week'){var w7=Date.now()-7*86400000;t=t.filter(function(x){return new Date(x.date+'T12:00:00').getTime()>=w7;});}
  else if(S.tradeFilter==='month'){var now2=new Date(),ms=now2.getFullYear()+'-'+pad(now2.getMonth()+1);t=t.filter(function(x){return(x.date||'').startsWith(ms);});}
  var sq=el('trade-search')?el('trade-search').value.trim().toLowerCase():'';
  if(sq)t=t.filter(function(x){return(x.instrument||'').toLowerCase().includes(sq)||(x.setup||'').toLowerCase().includes(sq)||(x.date||'').includes(sq)||(x.emotion||'').toLowerCase().includes(sq);});
  t.sort(function(a,b){var av,bv;if(_tradeSortKey==='pnl'){av=a.status==='open'?-Infinity:(a.pnl||0);bv=b.status==='open'?-Infinity:(b.pnl||0);}else if(_tradeSortKey==='quality'){av=a.status==='open'?-1:(a.quality||0);bv=b.status==='open'?-1:(b.quality||0);}else{av=a.date||'';bv=b.date||'';}if(av<bv)return _tradeSortDir;if(av>bv)return -_tradeSortDir;return 0;});
  if(!t.length){w.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M7 20v-6M12 20V8M17 20v-9"/></svg></div><div class="empty-title">No trades match this filter</div></div>';return;}
  function etag(e){if(['calm','patient','focused'].includes(e||''))return'g';if(['fomo','revenge','urgency','overconf','anxious'].includes(e||''))return'r';return'o';}
  function si(key){return _tradeSortKey===key?(_tradeSortDir===1?' \u2191':' \u2193'):'';}
  function th(lbl,key){return'<th style="cursor:pointer;user-select:none;" data-hclick="hSortT" data-hkey="'+key+'">'+lbl+si(key)+'</th>';}
  w.innerHTML='<div class="table-wrap"><table class="t-table"><thead><tr>'+th('Date','date')+'<th>Instrument</th><th>Side</th><th>Setup</th><th>State</th>'+th('Quality','quality')+th('P&L','pnl')+'</tr></thead><tbody>'+t.map(function(x){return'<tr style="cursor:pointer;" data-hclick="hOpenTD" data-hid="'+x.id+'" class="'+(x.status==='open'?'open-row':'')+'"><td style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;">'+fmtDate(x.date)+'</td><td style="color:var(--ink);font-weight:600;">'+esc(x.instrument)+'</td><td><span class="t-side '+(x.direction==='LONG'?'long':'short')+'">'+esc(x.direction)+'</span></td><td style="color:var(--ink-3);font-size:0.8rem;">'+(x.setup?esc(x.setup):'\u2014')+'</td><td><span class="e-tag '+etag(x.emotion)+'">'+(x.emotion?esc(x.emotion):'\u2014')+'</span></td><td>'+(x.status==='open'?'<span class="open-pill">OPEN</span>':'<div class="q-score"><div class="q-bar"><div class="q-fill" style="width:'+(x.quality||0)+'%;"></div></div>'+(x.quality||0)+'</div>')+'</td><td>'+(x.status==='open'?'<button class="btn btn-gold btn-sm" data-hclick="h149">Close</button>':'<div class="t-pnl '+(x.pnl>=0?'pos':'neg')+'">'+fmt(x.pnl,true)+'</div>')+'</td></tr>';}).join('')+'</tbody></table></div>';
}

// ── CALENDAR ─────────────────────────────────────────────────────────────────
function changeMonth(dir){if(dir===0)S.calMonth=new Date();else S.calMonth=new Date(S.calMonth.getFullYear(),S.calMonth.getMonth()+dir,1);renderCal();}
function renderCal(){
  var y=S.calMonth.getFullYear(),m=S.calMonth.getMonth();
  var MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var todayStr=localDate();var ml=el('cal-month-label');if(ml)ml.textContent=MN[m]+' '+y;
  // Exclude sample/tutorial trades — they must never inflate P&L, win rate, or heatmap cells.
  var TR=S.trades.filter(function(t){return !t.sample;});
  var tradeMap={};TR.forEach(function(t){if(!tradeMap[t.date])tradeMap[t.date]=[];tradeMap[t.date].push(t);});
  var ms=y+'-'+pad(m+1);var mAll=TR.filter(function(t){return t.date.startsWith(ms);});
  var mClosed=mAll.filter(function(t){return t.status==='closed';});
  var mp=mClosed.reduce(function(s,t){return s+t.pnl;},0);var mW=mClosed.filter(function(t){return t.pnl>0;});
  var tDays=new Set(mAll.map(function(t){return t.date;})).size;
  var dayPnls=[];Object.keys(tradeMap).filter(function(d){return d.startsWith(ms);}).forEach(function(d){dayPnls.push(mClosed.filter(function(t){return t.date===d;}).reduce(function(s,t){return s+t.pnl;},0));});
  var best=dayPnls.length?Math.max.apply(null,dayPnls):0;var worst=dayPnls.length?Math.min.apply(null,dayPnls):0;
  function cst(lbl,val,col){return'<div class="cal-stat-card"><div class="cal-stat-label">'+lbl+'</div><div class="cal-stat-value" style="color:'+col+';">'+val+'</div></div>';}
  var se=el('cal-stats');if(se)se.innerHTML=cst('Month P&L',fmt(mp,true),mp>=0?'var(--green)':'var(--red)')+cst('Win Rate',mClosed.length?Math.round(mW.length/mClosed.length*100)+'%':'\u2014','var(--gold)')+cst('Trading Days',tDays||'\u2014','var(--ink)')+cst('Best Day',best>0?fmt(best,true):'\u2014','var(--green)')+cst('Worst Day',worst<0?fmt(worst,true):'\u2014','var(--red)');
  var maxAbs=dayPnls.length?Math.max.apply(null,dayPnls.map(Math.abs)):1;if(maxAbs<1)maxAbs=1;
  function cellCls(pnl,hasTrade){if(!hasTrade)return'cal-no-trade';if(pnl===0)return'';var r=Math.abs(pnl)/maxAbs;if(pnl>0)return r>0.7?'cal-p4':r>0.45?'cal-p3':r>0.2?'cal-p2':'cal-p1';return r>0.7?'cal-l4':r>0.45?'cal-l3':r>0.2?'cal-l2':'cal-l1';}
  var firstDow=new Date(y,m,1).getDay();var daysInMo=new Date(y,m+1,0).getDate();var html='';
  for(var i=0;i<firstDow;i++)html+='<div class="cal-cell cal-empty"></div>';
  for(var d=1;d<=daysInMo;d++){
    var ds=y+'-'+pad(m+1)+'-'+pad(d);var dt=tradeMap[ds]||[];
    var closedDay=dt.filter(function(t){return t.status==='closed';});var openDay=dt.filter(function(t){return t.status==='open';});
    var dayPnl=closedDay.reduce(function(s,t){return s+t.pnl;},0);var isToday=ds===todayStr;
    var cls='cal-cell '+cellCls(dayPnl,dt.length>0)+(isToday?' cal-today':'');
    var badge=dt.length>1?'<div class="cal-cell-badge">'+dt.length+'</div>':'';
    var insts=[];dt.forEach(function(t){if(t.instrument&&insts.indexOf(t.instrument)<0)insts.push(t.instrument);});
    html+='<div class="'+cls+'" data-date="'+ds+'" data-hclick="h150">'+badge+'<div class="cal-cell-num">'+d+'</div>'+(insts.length?'<div class="cal-cell-inst">'+insts.join(', ')+'</div>':'')+(closedDay.length?'<div class="cal-cell-pnl '+(dayPnl>=0?'pos':'neg')+'">'+fmt(dayPnl,true)+'</div>':'')+(openDay.length?'<div class="cal-cell-open">\u25cf OPEN</div>':'')+'</div>';
  }
  var cg=el('cal-grid');if(cg)cg.innerHTML=html;renderMonthlyBars();
}
function showDayDetail(dateStr){
  var dt=S.trades.filter(function(t){return t.date===dateStr && !t.sample;});if(!dt.length)return;
  var popup=el('day-popup');if(!popup)return;
  var dpd=el('dp-date');if(dpd)dpd.textContent=fmtDate(dateStr)+' \u00b7 '+dt.length+' trade'+(dt.length>1?'s':'');
  var dpb=el('dp-body');if(dpb)dpb.innerHTML=dt.map(function(t){var pS=t.status==='open'?'<span class="open-pill">OPEN</span>':'<span class="t-pnl '+(t.pnl>=0?'pos':'neg')+'">'+fmt(t.pnl,true)+'</span>';return'<div class="day-popup-trade"><span class="t-side '+(t.direction==='LONG'?'long':'short')+'">'+esc(t.direction)+'</span><span style="flex:1;font-size:0.83rem;color:var(--ink);margin:0 8px;">'+esc(t.instrument)+(t.setup?' \u00b7 '+esc(t.setup):'')+'</span>'+pS+'</div>';}).join('');
  popup.style.top='50%';popup.style.left='50%';popup.style.transform='translate(-50%,-50%)';popup.classList.add('show');
}
function closeDP(){var p=el('day-popup');if(p)p.classList.remove('show');}
document.addEventListener('click',function(e){var p=el('day-popup');if(p&&p.classList.contains('show')&&!p.contains(e.target))closeDP();});
function renderMonthlyBars(){
  var mbEl=el('mbars-wrap');if(!mbEl)return;
  var MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var closed=S.trades.filter(function(t){return t.status==='closed' && !t.sample;});var nowD=new Date(),months=[];
  for(var i=11;i>=0;i--){var d=new Date(nowD.getFullYear(),nowD.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:MN[d.getMonth()]});}
  var mData=months.map(function(mo){var key=mo.y+'-'+pad(mo.m+1);var ts=closed.filter(function(x){return x.date.startsWith(key);});return{label:mo.label,pnl:ts.reduce(function(s,x){return s+x.pnl;},0),n:ts.length};});
  var mMax=Math.max.apply(null,mData.map(function(d){return Math.abs(d.pnl);}));if(!mMax||mMax<1)mMax=1;
  mbEl.innerHTML='<div class="mbars">'+mData.map(function(d){var h=d.n?Math.max(4,Math.round(Math.abs(d.pnl)/mMax*84)):2;return'<div class="mbar-col"><div class="mbar-track"><div class="mbar '+(d.n?(d.pnl>=0?'p':'l'):'e')+'" style="height:'+h+'px;" title="'+d.label+': '+(d.n?fmt(d.pnl,true):'no trades')+'"></div></div><div class="mbar-label">'+d.label+'</div></div>';}).join('')+'<div class="mbar-base"></div></div>';
}

// ── ANALYTICS ───────────────────────────────────────────────────────────────
// Filter state lives on window so the user can navigate away and back without
// losing their pick. Not persisted to Firestore — these are view options.
window._anFilters = window._anFilters || { range:'all' };
function setAnRange(r, btn){
  window._anFilters.range = r;
  document.querySelectorAll('.an-range-btn').forEach(function(b){b.classList.remove('active');b.classList.remove('btn-gold');b.classList.add('btn-ghost');});
  if(btn){btn.classList.add('active');btn.classList.add('btn-gold');btn.classList.remove('btn-ghost');}
  renderAnalytics();
}
function applyAnFilter(trades){
  var f = window._anFilters || {range:'all'};
  // Always exclude sample trades from analytics — they're tutorial fixtures.
  var out = trades.filter(function(t){ return !t.sample; });
  if(f.range !== 'all'){
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(f.range));
    var cutoffStr = cutoff.toISOString().slice(0,10);
    out = out.filter(function(t){ return t.date >= cutoffStr; });
  }
  return out;
}

// When Chart.js can't be fetched (offline / blocked), don't leave blank
// canvases — overlay a clear message instead.
function _chartFallback(){
  ['eq-chart','dow-chart','tod-chart','wl-chart','prayer-radar'].forEach(function(id){
    var c=el(id); if(!c||!c.parentElement) return; var wrap=c.parentElement;
    if(wrap.querySelector('.chart-fallback')) return;
    c.style.display='none';
    var d=document.createElement('div'); d.className='chart-fallback';
    d.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:120px;text-align:center;gap:6px;padding:16px;';
    d.innerHTML='<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);">Charts unavailable</div><div style="color:var(--ink-4);font-size:0.78rem;">Couldn’t load the chart library — check your connection and refresh.</div>';
    wrap.appendChild(d);
  });
}
function _clearChartFallback(){
  document.querySelectorAll('.chart-fallback').forEach(function(d){
    var wrap=d.parentElement; if(wrap){ var c=wrap.querySelector('canvas'); if(c) c.style.display=''; }
    d.remove();
  });
}

function renderAnalytics(){
  // Lazy-load Chart.js if not yet present, then continue.
  if(!window.Chart && typeof window.__ensureChart === 'function'){
    window.__ensureChart().then(renderAnalytics).catch(_chartFallback);
    return;
  }
  var closed=applyAnFilter(S.trades.filter(function(t){return t.status==='closed';}));
  var sum=el('an-filter-summary');
  if(sum){
    var lbl = (window._anFilters.range==='all'?'All time':'Last '+window._anFilters.range+' days');
    sum.textContent = lbl + ' · ' + closed.length + ' trade'+(closed.length===1?'':'s');
  }
  var pm=el('perf-metrics');
  if(pm&&closed.length){
    var wins=closed.filter(function(t){return t.pnl>0;}),losses=closed.filter(function(t){return t.pnl<0;});
    var grossW=wins.reduce(function(s,t){return s+t.pnl;},0),grossL=Math.abs(losses.reduce(function(s,t){return s+t.pnl;},0));
    var pf=grossL>0?(grossW/grossL).toFixed(2):'\u221e';var avgW=wins.length?grossW/wins.length:0,avgL=losses.length?grossL/losses.length:0;
    var pr=avgL>0?(avgW/avgL).toFixed(2):'\u221e';var cw=0,cl=0,mxW=0,mxL=0;
    closed.forEach(function(t){if(t.pnl>0){cw++;cl=0;if(cw>mxW)mxW=cw;}else{cl++;cw=0;if(cl>mxL)mxL=cl;}});
    function mc(lbl,val,col,note){return'<div class="metric-card"><div class="metric-label">'+lbl+'</div><div class="metric-val" style="color:'+(col||'var(--gold)')+'">'+val+'</div>'+(note?'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;color:var(--ink-3);margin-top:3px;letter-spacing:0.05em;">'+note+'</div>':'')+'</div>';}
    var pfColor=pf==='\u221e'?'var(--green)':parseFloat(pf)>=1?'var(--green)':'var(--red)';
    var pfNote=pf==='\u221e'?'no losing trades yet':null;
    pm.innerHTML=mc('PROFIT FACTOR',pf,pfColor,pfNote)+mc('PAYOFF RATIO',pr,pr==='\u221e'?'var(--green)':'var(--ink)')+mc('MAX CONSEC WINS',mxW,'var(--green)')+mc('MAX CONSEC LOSSES',mxL,'var(--red)');
  }else if(pm)pm.innerHTML='';
  if(!window.Chart){ _chartFallback(); return; }
  _clearChartFallback();
  var dc=el('dow-chart');if(dc){try{if(C.dow)C.dow.destroy();}catch(e){}try{var dows=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];var dd=dows.map(function(_,i){return closed.filter(function(t){return new Date(t.date+'T12:00:00').getDay()===i;}).reduce(function(s,t){return s+t.pnl;},0);});C.dow=new Chart(dc,mkBarCfg(dd,dows,false));}catch(e){}}
  var tc=el('tod-chart');if(tc){try{if(C.tod)C.tod.destroy();}catch(e){}try{var slots=['Pre-9:30','9:30-10','10-11','11-12','12-2','2-3','3-4','4+'];function gs(tm){if(!tm)return 7;var p=tm.split(':');var hh=+p[0],mm=+p[1],tt=hh*60+mm;if(tt<570)return 0;if(tt<600)return 1;if(tt<660)return 2;if(tt<720)return 3;if(tt<840)return 4;if(tt<900)return 5;if(tt<960)return 6;return 7;}var td=slots.map(function(_,i){return closed.filter(function(t){return gs(t.time)===i;}).reduce(function(s,t){return s+t.pnl;},0);});C.tod=new Chart(tc,mkBarCfg(td,slots,true));}catch(e){}}
  var wc=el('wl-chart');if(wc){try{if(C.wl)C.wl.destroy();}catch(e){}try{var w2=closed.filter(function(t){return t.pnl>0;}).length,l2=closed.filter(function(t){return t.pnl<0;}).length,be=closed.filter(function(t){return t.pnl===0;}).length;if(w2||l2||be)C.wl=new Chart(wc,{type:'doughnut',data:{labels:['Wins','Losses','BE'],datasets:[{data:[w2,l2,be],backgroundColor:['#6cb088','#d28282','#867c66'],borderColor:'#181510',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{color:'#beb29a',font:{family:'Inter',size:11},padding:12,boxWidth:8}}}}});}catch(e){}}
  var pr=el('prayer-radar');if(pr){try{if(C.pr)C.pr.destroy();}catch(e){}try{var ps=['fajr','dhuhr','asr','maghrib','isha'],lbs=['Fajr','Dhuhr','Asr','Maghrib','Isha'];var dkeys=Object.keys(S.dailyPrayers);if(dkeys.length>=3){var vals=ps.map(function(p){var pd=dkeys.filter(function(d){return S.dailyPrayers[d][p];});var pt=closed.filter(function(t){return pd.indexOf(t.date)>-1;});return pt.length?Math.round(pt.filter(function(t){return t.pnl>0;}).length/pt.length*100):0;});C.pr=new Chart(pr,{type:'radar',data:{labels:lbs,datasets:[{data:vals,backgroundColor:'rgba(218,180,98,0.1)',borderColor:'rgba(218,180,98,0.6)',pointBackgroundColor:'#dab462',pointBorderColor:'#0b0a08',borderWidth:2,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#181510',borderColor:'rgba(218,180,98,0.25)',borderWidth:1,titleColor:'#f0e8d4',bodyColor:'#beb29a',callbacks:{label:function(ctx){return'Win rate: '+ctx.parsed.r+'%';}}}},scales:{r:{backgroundColor:'transparent',grid:{color:'rgba(255,255,255,0.055)'},angleLines:{color:'rgba(218,180,98,0.1)'},pointLabels:{color:'#beb29a',font:{family:'JetBrains Mono',size:10}},ticks:{color:'#4a4538',backdropColor:'transparent',stepSize:25},min:0,max:100}}}});}else{pr.parentElement.innerHTML='<div class="empty" style="padding:44px;"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.8A8.5 8.5 0 1 1 10.2 3.5 6.8 6.8 0 0 0 20.5 14.8z"/></svg></div><div class="empty-title">Track prayers for 3+ days</div><div class="empty-text">The prayer radar needs at least 3 days of data to show meaningful correlation.</div></div>';}
  }catch(e){}}
  var st=el('setup-wrap');if(st){var setups=[];closed.forEach(function(t){if(t.setup&&setups.indexOf(t.setup)<0)setups.push(t.setup);});if(!setups.length){st.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.8M12 18.6v2.8M21.4 12h-2.8M5.4 12H2.6M18.6 5.4l-2 2M7.4 16.6l-2 2M18.6 18.6l-2-2M7.4 7.4l-2-2"/></svg></div><div class="empty-title">Tag setups when logging trades</div></div>';}else{var sd=setups.map(function(s){var ts=closed.filter(function(t){return t.setup===s;});var w=ts.filter(function(t){return t.pnl>0;}).length;var pnl=ts.reduce(function(a,t){return a+t.pnl;},0);var wr=Math.round(w/ts.length*100);return{s:s,n:ts.length,wr:wr,pnl:pnl,avg:pnl/ts.length};}).sort(function(a,b){return b.pnl-a.pnl;});st.innerHTML='<div class="table-wrap"><table class="s-table"><thead><tr><th>Setup</th><th>Trades</th><th>Win Rate</th><th>Total P&L</th><th>Avg P&L</th></tr></thead><tbody>'+sd.map(function(d){return'<tr><td style="color:var(--ink);font-weight:500;">'+esc(d.s)+'</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;">'+d.n+'</td><td><div class="s-bar"><div class="s-bar-fill" style="width:'+d.wr+'%;background:'+(d.wr>=50?'var(--green)':'var(--red)')+';height:100%;border-radius:3px;"></div></div><span style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;">'+d.wr+'%</span></td><td class="t-pnl '+(d.pnl>=0?'pos':'neg')+'">'+fmt(d.pnl,true)+'</td><td class="t-pnl '+(d.avg>=0?'pos':'neg')+'">'+fmt(d.avg,true)+'</td></tr>';}).join('')+'</tbody></table></div>';}}
  var da=el('deen-wrap');if(da){var dDays=Object.keys(S.dailyPrayers);if(dDays.length<5){da.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.8A8.5 8.5 0 1 1 10.2 3.5 6.8 6.8 0 0 0 20.5 14.8z"/></svg></div><div class="empty-title">Track prayers daily for 5+ days</div><div class="empty-text">5+ days builds a pattern. 20+ days builds a conviction. Keep going.</div></div>';}else{var pN={fajr:'Fajr',dhuhr:'Dhuhr',asr:'Asr',maghrib:'Maghrib',isha:'Isha'};var rows=['fajr','dhuhr','asr','maghrib','isha'].map(function(p){var yD=dDays.filter(function(d){return S.dailyPrayers[d][p];}),nD=dDays.filter(function(d){return!S.dailyPrayers[d][p];});var yT=closed.filter(function(t){return yD.indexOf(t.date)>-1;}),nT=closed.filter(function(t){return nD.indexOf(t.date)>-1;});var yWR=yT.length?Math.round(yT.filter(function(t){return t.pnl>0;}).length/yT.length*100):0,nWR=nT.length?Math.round(nT.filter(function(t){return t.pnl>0;}).length/nT.length*100):0;var yP=yT.reduce(function(s,t){return s+t.pnl;},0),nP=nT.reduce(function(s,t){return s+t.pnl;},0);return{name:pN[p],yN:yT.length,nN:nT.length,yWR:yWR,nWR:nWR,yP:yP,nP:nP,diff:yWR-nWR};});da.innerHTML='<div style="overflow-x:auto"><table class="s-table"><thead><tr><th>Prayer</th><th>Days prayed</th><th>Win %</th><th>P&L</th><th>Days missed</th><th>Win %</th><th>P&L</th><th>Edge</th><th>Confidence</th></tr></thead><tbody>'+rows.map(function(r){
  var conf=r.yN<3||r.nN<3?'low':r.yN<8||r.nN<8?'mid':'high';
  var confLabel=conf==='low'?'Insufficient data':conf==='mid'?'Pattern emerging':'High confidence';
  return'<tr><td style="color:var(--ink);font-weight:500;">'+r.name+'</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;">'+r.yN+'</td><td style="color:var(--green);font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;">'+r.yWR+'%</td><td class="t-pnl '+(r.yP>=0?'pos':'neg')+'">'+fmt(r.yP,true)+'</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;">'+r.nN+'</td><td style="color:var(--red);font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;">'+r.nWR+'%</td><td class="t-pnl '+(r.nP>=0?'pos':'neg')+'">'+fmt(r.nP,true)+'</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;color:'+(r.diff>0?'var(--green)':'var(--red)')+';">'+(r.diff>0?'+':'')+r.diff+'%</td><td><span class="muh-confidence '+conf+'">'+confLabel+'</span></td></tr>';
}).join('')+'</tbody></table></div><p style="font-size:0.74rem;color:var(--ink-3);margin-top:10px;">Edge = win rate when prayed minus win rate when missed.</p>';}}
}
function mkBarCfg(data,labels,smallTick){return{type:'bar',data:{labels:labels,datasets:[{data:data,backgroundColor:data.map(function(v){return v>=0?'rgba(108,176,136,0.65)':'rgba(210,130,130,0.65)';}),borderColor:data.map(function(v){return v>=0?'#6cb088':'#d28282';}),borderWidth:1.5,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#867c66',font:{size:smallTick?9:11}}},y:{grid:{color:'rgba(255,255,255,0.024)'},ticks:{color:'#867c66',callback:function(v){return'$'+v;}}}}}};}

// ── JOURNAL ──────────────────────────────────────────────────────────────────
var CL=['Prayed Fajr \u2014 start with deen intact','Mapped key levels on chart','Checked economic calendar','Set personal daily loss limit','Reviewed trading rules','Made dua for clarity'];
var NK=['sabr','tawakkul','kibr','shukr'];
function renderJournal(){
  // Restore nafs from most recent journal entry
  if(S.journals.length){
    var lastN=S.journals.find(function(j){return j.nafs&&(j.nafs.sabr||j.nafs.tawakkul);});
    if(lastN&&lastN.nafs)S.nafs=Object.assign({sabr:0,tawakkul:0,kibr:0,shukr:0},lastN.nafs);
  }
  NK.forEach(function(k){var e=el('nd-'+k);if(!e)return;e.innerHTML='';for(var i=1;i<=5;i++){(function(ii){var d=document.createElement('div');d.className='nafs-dot'+(S.nafs[k]>=ii?' on':'');d.onclick=function(){S.nafs[k]=ii;renderNafsDots(k);sv('nafs',S.nafs);};e.appendChild(d);})(i);}});
  var today=localDate(),m=S.morning[today]||{};
  ['j-int','j-ll','j-mt','j-kl'].forEach(function(id,i){var keys=['intention','lossLimit','maxTrades','key'];var e=el(id);if(e&&m[keys[i]])e.value=m[keys[i]];});
  var w=el('chk-wrap');if(!w)return;w.innerHTML='';
  CL.forEach(function(it,i){var done=m.checklist&&m.checklist[i];var d=document.createElement('div');d.className='check-item'+(done?' done':'');d.innerHTML='<div class="check-circle">'+(done?'\u2713':'')+'</div><div class="check-text">'+it+'</div>';d.onclick=function(){toggleCheck(i);};w.appendChild(d);});
  renderJournalList();
}
function renderNafsDots(k){var e=el('nd-'+k);if(!e)return;e.querySelectorAll('.nafs-dot').forEach(function(d,i){d.classList.toggle('on',i<S.nafs[k]);});}
function toggleCheck(i){var t=localDate();if(!S.morning[t])S.morning[t]={};if(!S.morning[t].checklist)S.morning[t].checklist=[];S.morning[t].checklist[i]=!S.morning[t].checklist[i];sv('morning',S.morning);renderJournal();}
function saveJournal(){
  var today=localDate();if(!S.morning[today])S.morning[today]={};var m=S.morning[today];
  ['j-int','j-ll','j-mt','j-kl'].forEach(function(id,i){var keys=['intention','lossLimit','maxTrades','key'];var e=el(id);if(e)m[keys[i]]=e.value;});
  sv('morning',S.morning);
  var e={id:Date.now(),date:today,rules:el('j-rules')?el('j-rules').value:'',what:el('j-what')?el('j-what').value:'',fix:el('j-fix')?el('j-fix').value:'',shukr:el('j-shukr')?el('j-shukr').value:'',nafs:Object.assign({},S.nafs),createdAt:new Date().toISOString()};
  S.journals.unshift(e);sv('journals',S.journals);
  toast('\u2713 Entry saved','s');renderJournalList();
}
function clearJournal(){['j-int','j-what','j-fix','j-shukr'].forEach(function(id){var e=el(id);if(e)e.value='';});var jr=el('j-rules');if(jr)jr.value='';S.nafs={sabr:0,tawakkul:0,kibr:0,shukr:0};NK.forEach(function(k){renderNafsDots(k);});}
function renderJournalList(){
  var e=el('journal-list');if(!e)return;
  if(!S.journals.length){e.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H7a2 2 0 0 0-2 2V4.5z"/><path d="M9 8h6M9 11.5h6"/></svg></div><div class="empty-title">No entries yet</div><div class="empty-text">Use the form above to log your first reflection.</div></div>';return;}
  var sq=(el('journal-search')?el('journal-search').value:'').trim().toLowerCase();
  var list=S.journals;
  if(sq){list=list.filter(function(j){return(j.date||'').includes(sq)||(j.fix||'').toLowerCase().includes(sq)||(j.what||'').toLowerCase().includes(sq)||(j.shukr||'').toLowerCase().includes(sq)||(j.intention||'').toLowerCase().includes(sq);});}
  var show=sq?list:list.slice(0,10);
  if(!show.length){e.innerHTML='<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg></div><div class="empty-title">No entries match</div></div>';return;}
  e.innerHTML=show.map(function(j){return'<div style="padding:12px 0;border-bottom:1px solid var(--line-2);"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;color:var(--gold);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:5px;">'+fmtDate(j.date)+'</div>'+(j.fix?'<div style="font-size:0.8rem;color:var(--ink-2);margin-bottom:4px;line-height:1.55;"><strong style="color:var(--ink);">Tomorrow:</strong> '+esc(j.fix)+'</div>':'')+(j.shukr?'<div style="font-size:0.8rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--gold);">Shukr:</strong> '+esc(j.shukr)+'</div>':'')+'</div>';}).join('')+(!sq&&S.journals.length>10?'<div style="font-size:0.76rem;color:var(--ink-3);text-align:center;padding:12px 0;">Showing 10 of '+S.journals.length+' \u2014 search to find older entries</div>':'');
}

// ── PLAYBOOK ──────────────────────────────────────────────────────────────────
function savePBSetup(){
  var name=el('pb-name')?el('pb-name').value.trim():'';if(!name){toast('Please enter a setup name','e');return;}
  var setup={id:S.editPBId||Date.now(),name:name,condition:el('pb-condition')?el('pb-condition').value:'',desc:el('pb-desc')?el('pb-desc').value:'',rr:el('pb-rr')?el('pb-rr').value:'',inst:el('pb-inst')?el('pb-inst').value:'',hold:el('pb-hold')?el('pb-hold').value:'',entry:el('pb-entry')?el('pb-entry').value:'',exit:el('pb-exit')?el('pb-exit').value:'',avoid:el('pb-avoid')?el('pb-avoid').value:'',createdAt:new Date().toISOString()};
  if(S.editPBId){var idx=S.playbook.findIndex(function(p){return p.id===S.editPBId;});if(idx>-1)S.playbook[idx]=setup;S.editPBId=null;}else{S.playbook.push(setup);}
  sv('playbook',S.playbook);clearPBForm();toast('\u2713 Setup saved to Playbook','s');renderPlaybook();
}
function clearPBForm(){['pb-name','pb-condition','pb-desc','pb-rr','pb-inst','pb-hold','pb-entry','pb-exit','pb-avoid'].forEach(function(id){var e=el(id);if(e)e.value='';});S.editPBId=null;var ft=el('pb-form-title');if(ft)ft.textContent='Add New Setup';}
function deletePB(id){
  confirmModal({title:'Delete this setup?',text:'The setup will be removed from your playbook.',okText:'Delete',danger:true,icon:'⚠'})
    .then(function(ok){
      if(!ok)return;
      S.playbook=S.playbook.filter(function(p){return p.id!==id;});
      sv('playbook',S.playbook);
      renderPlaybook();
    });
}
function editPB(id){var p=S.playbook.find(function(x){return x.id===id;});if(!p)return;S.editPBId=id;var fields={name:p.name,condition:p.condition,desc:p.desc,rr:p.rr,inst:p.inst,hold:p.hold,entry:p.entry,exit:p.exit,avoid:p.avoid};Object.keys(fields).forEach(function(k){var e=el('pb-'+k);if(e)e.value=fields[k]||'';});var ft=el('pb-form-title');if(ft)ft.textContent='Edit Setup';window.scrollTo(0,0);}
function renderPlaybook(){
  var e=el('playbook-list');if(!e)return;
  if(!S.playbook.length){e.innerHTML='<div class="empty"><div class="empty-icon">\u2751</div><div class="empty-title">No setups yet</div><div class="empty-text">Document your first setup above.</div></div>';return;}
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  e.innerHTML=S.playbook.map(function(p){var ts=closed.filter(function(t){return t.setup===p.name;});var wins=ts.filter(function(t){return t.pnl>0;});var pnl=ts.reduce(function(s,t){return s+t.pnl;},0);var wr=ts.length?Math.round(wins.length/ts.length*100):null;var entryRules=p.entry?p.entry.split('\n').filter(Boolean):[];var avoidRules=p.avoid?p.avoid.split('\n').filter(Boolean):[];return'<div class="pb-card"><div class="pb-badge">'+esc(p.inst||'Any')+'</div><div class="pb-card-name">'+esc(p.name)+'</div>'+(p.desc?'<div class="pb-card-desc">'+esc(p.desc)+'</div>':'')+'<div class="pb-card-stats"><span class="pb-stat">Trades: <strong>'+ts.length+'</strong></span>'+(wr!==null?'<span class="pb-stat '+(wr>=50?'g':'r')+'">Win Rate: <strong>'+wr+'%</strong></span>':'')+(ts.length?'<span class="pb-stat '+(pnl>=0?'g':'r')+'">P&L: <strong>'+fmt(pnl,true)+'</strong></span>':'')+(p.rr?'<span class="pb-stat o">Min R:R: <strong>'+esc(p.rr)+':1</strong></span>':'')+(p.hold?'<span class="pb-stat">Hold: <strong>'+esc(p.hold)+'</strong></span>':'')+'</div>'+(entryRules.length?'<div class="pb-rules">'+entryRules.map(function(r){return'<div class="pb-rule must">'+esc(r)+'</div>';}).join('')+'</div>':'')+(avoidRules.length?'<div class="pb-rules" style="margin-top:6px;">'+avoidRules.map(function(r){return'<div class="pb-rule avoid">'+esc(r)+'</div>';}).join('')+'</div>':'')+'<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-ghost btn-sm" data-hclick="hEditPB" data-hid="'+p.id+'">Edit</button><button class="btn btn-red btn-sm" data-hclick="hDeletePB" data-hid="'+p.id+'">Delete</button></div></div>';}).join('');
}

// ── RISK ──────────────────────────────────────────────────────────────────
// ── PRAYER TIMES (approximate, opt-in) ────────────────────────────────────
// Self-contained inline calculation using the Muslim World League convention
// (Fajr -18°, Isha -17°). Accurate enough to surface a "Maghrib in ~12 min"
// nudge in the In Trade page. Users who need precise times should still rely
// on their dedicated adhan app — the UI surface labels this as approximate.
//
// Math reference: Pray Times algorithm by Hamid Zarrabi-Zadeh (open source).
function _ptDeg2Rad(d){return d*Math.PI/180;}
function _ptRad2Deg(r){return r*180/Math.PI;}
function _ptJulian(y,m,d){
  if(m<=2){y--;m+=12;}
  var A=Math.floor(y/100);
  var B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5;
}
// Returns {decl, eqt} — sun declination (deg) and equation of time (min).
function _ptSunPos(jd){
  var D=jd-2451545.0;
  var g=357.529 + 0.98560028*D;
  var q=280.459 + 0.98564736*D;
  var L=q + 1.915*Math.sin(_ptDeg2Rad(g)) + 0.020*Math.sin(_ptDeg2Rad(2*g));
  var e=23.439 - 0.00000036*D;
  var RA=_ptRad2Deg(Math.atan2(Math.cos(_ptDeg2Rad(e))*Math.sin(_ptDeg2Rad(L)), Math.cos(_ptDeg2Rad(L))))/15;
  var decl=_ptRad2Deg(Math.asin(Math.sin(_ptDeg2Rad(e))*Math.sin(_ptDeg2Rad(L))));
  var eqt=(q/15 - ((RA%24)+24)%24);
  if(eqt>12)eqt-=24; if(eqt<-12)eqt+=24;
  return {decl:decl, eqt:eqt*60};
}
// Compute time-of-day (hours) for a sun-altitude angle relative to noon.
function _ptT(angle, lat, decl, noonHours){
  var l=_ptDeg2Rad(lat), d=_ptDeg2Rad(decl);
  var cosH=(-Math.sin(_ptDeg2Rad(angle)) - Math.sin(l)*Math.sin(d)) / (Math.cos(l)*Math.cos(d));
  if(cosH>1||cosH<-1) return null;
  return _ptRad2Deg(Math.acos(cosH))/15;
}
// Returns {fajr, dhuhr, asr, maghrib, isha} as fractional hours in local time,
// or null if location is unset. Uses today's date.
function computePrayerTimes(){
  var loc = (S.settings && S.settings.prayerLoc) || null;
  if(!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  var now = new Date();
  var jd = _ptJulian(now.getFullYear(), now.getMonth()+1, now.getDate());
  var pos = _ptSunPos(jd);
  var tzOffset = -now.getTimezoneOffset()/60; // hours east of UTC
  var noon = 12 - pos.eqt/60 - loc.lng/15 + tzOffset; // solar noon, local time
  var fajrA=_ptT(18, loc.lat, pos.decl, noon);
  var ishaA=_ptT(17, loc.lat, pos.decl, noon);
  var sunset=_ptT(0.833, loc.lat, pos.decl, noon);
  // Asr shadow factor: Shafi'i/Maliki/Hanbali = 1, Hanafi = 2 (later Asr).
  // User-selectable in Settings; defaults to the majority (factor 1).
  var asrFactor = (S.settings && S.settings.asrMadhab === 'hanafi') ? 2 : 1;
  var asrAngle = -_ptRad2Deg(Math.atan(1/(asrFactor + Math.tan(_ptDeg2Rad(Math.abs(loc.lat-pos.decl))))));
  var asrA = _ptT(-asrAngle, loc.lat, pos.decl, noon);
  if(fajrA===null||sunset===null||asrA===null||ishaA===null) return null;
  return {
    fajr: noon - fajrA,
    dhuhr: noon,
    asr: noon + asrA,
    maghrib: noon + sunset,
    isha: noon + sunset + (ishaA - sunset)
  };
}
// Given today's prayer times, find the next prayer relative to now. Returns
// {name, minutes} or null if all today's prayers have passed.
function nextPrayer(){
  var pt = computePrayerTimes(); if(!pt) return null;
  var now = new Date();
  var nowH = now.getHours() + now.getMinutes()/60;
  var order = ['fajr','dhuhr','asr','maghrib','isha'];
  for(var i=0;i<order.length;i++){
    if(pt[order[i]] > nowH){
      return { name: order[i], minutes: Math.round((pt[order[i]] - nowH) * 60) };
    }
  }
  return null;
}
// Soft pill shown on the In Trade page when a prayer is within 30 min.
function renderPrayerPill(){
  var wrap = el('prayer-pill-wrap'); if(!wrap) return;
  if(!(S.settings && S.settings.prayerLoc)){ wrap.style.display='none'; wrap.innerHTML=''; return; }
  var np = nextPrayer();
  if(!np || np.minutes > 30){ wrap.style.display='none'; wrap.innerHTML=''; return; }
  var cap = np.name.charAt(0).toUpperCase() + np.name.slice(1);
  wrap.style.display = '';
  wrap.innerHTML =
    '<div style="background:linear-gradient(135deg,rgba(218,180,98,0.07),transparent);border:1px solid rgba(218,180,98,0.25);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c49a28,#0e0a02);border:1px solid rgba(218,180,98,0.4);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">☽</div>' +
      '<div style="flex:1;min-width:200px;">' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.2em;color:var(--gold);text-transform:uppercase;margin-bottom:4px;">'+cap+' IN ~'+np.minutes+' MIN</div>' +
        '<div style="font-size:0.86rem;color:var(--ink-2);line-height:1.55;">Close before the call, or hold with intention. Approximate — verify in your adhan app.</div>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm" data-hclick="h64">Close trade</button>' +
    '</div>';
}

// ══════════════════════════════════════════════════════════════════════════
// SIRAT — staged profitability path (premium-only)
// ══════════════════════════════════════════════════════════════════════════
//
// Five stages. Stage is computed from S.trades + S.dailyPrayers — never
// self-declared. Stage transitions are stamped to S.settings.sirat.history
// so the user sees their journey over time.
//
//   Tahaarah  — < 30 closed trades. Build the habit. Log everything.
//   Sabr      — has data, no setup yet has ≥ 30 trades at WR ≥ 55%.
//   Yaqeen    — one setup hits the threshold OR positive expectancy +
//                profit factor ≥ 1.4 over the last 30 days.
//   Tawakkul  — positive P&L across 3 consecutive months,
//                max drawdown stays under 15% of starting capital.
//   Ihsan     — positive P&L 6+ months, two or more proven setups.
//
// All thresholds are tunable here in one place.

var SIRAT_STAGES = {
  tahaarah: { name:'Tahaarah', sub:'Cleaning the foundation', order:1 },
  sabr:     { name:'Sabr',     sub:'Finding your edge',       order:2 },
  yaqeen:   { name:'Yaqeen',   sub:'Proving your edge',       order:3 },
  tawakkul: { name:'Tawakkul', sub:'Defending your edge',     order:4 },
  ihsan:    { name:'Ihsan',    sub:'Mastery',                 order:5 }
};
var SIRAT_THRESHOLDS = {
  minTradesForStage2: 30,
  setupMinTrades: 30,
  setupMinWR: 55,
  yaqeenMinPF: 1.4,
  tawakkulMinMonths: 3,
  tawakkulMaxDDPct: 15,
  ihsanMinMonths: 6
};

// Pure function: given the user's data, return the stage diagnosis.
// Returns { stage, reasoning, focusThisWeek, graduation, kpis }.
function computeUserStage(s){
  var trades = (s && s.trades) || [];
  var closed = trades.filter(function(t){ return t.status==='closed' && !t.sample; });
  var leak = (s && s.settings && s.settings.leak) || null;

  // === Tahaarah — fewer than the minimum trade count ===
  if(closed.length < SIRAT_THRESHOLDS.minTradesForStage2){
    return {
      stage: 'tahaarah',
      reasoning: closed.length + ' closed trades logged. The path starts with data — the next ' + (SIRAT_THRESHOLDS.minTradesForStage2 - closed.length) + ' trades build it.',
      focusThisWeek: _siratFocusFor('tahaarah', closed, leak),
      graduation: {
        label: 'To reach Sabr',
        progress: closed.length,
        target: SIRAT_THRESHOLDS.minTradesForStage2,
        copy: 'Log ' + SIRAT_THRESHOLDS.minTradesForStage2 + ' closed trades with full discipline data.'
      },
      kpis: _siratKpisFor('tahaarah', closed, s)
    };
  }

  // Group trades by setup to find any with proven edge.
  var bySetup = {};
  closed.forEach(function(t){
    var k = (t.setup||'').trim() || '(unnamed)';
    (bySetup[k] = bySetup[k] || []).push(t);
  });
  var topSetup = null;
  Object.keys(bySetup).forEach(function(k){
    var ts = bySetup[k];
    var wr = ts.filter(function(t){return t.pnl>0;}).length / ts.length * 100;
    var hit = ts.length >= SIRAT_THRESHOLDS.setupMinTrades && wr >= SIRAT_THRESHOLDS.setupMinWR;
    if(hit && (!topSetup || ts.length > topSetup.count)){
      topSetup = { name:k, count:ts.length, wr:Math.round(wr) };
    }
  });

  // Last 30 days profit factor + expectancy.
  var thirtyAgo = Date.now() - 30*86400000;
  var recent = closed.filter(function(t){
    return new Date(t.date+'T12:00:00').getTime() >= thirtyAgo;
  });
  var rWins = recent.filter(function(t){return t.pnl>0;});
  var rLoss = recent.filter(function(t){return t.pnl<0;});
  var grossW = rWins.reduce(function(s,t){return s+t.pnl;},0);
  var grossL = Math.abs(rLoss.reduce(function(s,t){return s+t.pnl;},0));
  var pf = grossL>0 ? grossW/grossL : (grossW>0 ? Infinity : 0);
  var expectancy = recent.length ? (grossW - grossL) / recent.length : 0;

  // === Yaqeen check — proven setup OR positive expectancy + PF ≥ 1.4 ===
  var yaqeenByPF = recent.length >= 20 && expectancy > 0 && pf >= SIRAT_THRESHOLDS.yaqeenMinPF;
  var yaqeenBySetup = !!topSetup;

  // === Tawakkul / Ihsan checks — monthly P&L sweep ===
  var months = {};
  closed.forEach(function(t){
    var m = (t.date||'').slice(0,7); // YYYY-MM
    if(!m) return;
    months[m] = (months[m]||0) + (t.pnl||0);
  });
  var monthKeys = Object.keys(months).sort();
  // Count the longest run of consecutive positive months ending at the most
  // recent month with data (we don't penalize gaps).
  var positiveRun = 0;
  for(var i=monthKeys.length-1; i>=0; i--){
    if(months[monthKeys[i]] > 0) positiveRun++;
    else break;
  }
  // Crude max-drawdown estimate: equity-curve peak-to-trough using the closed
  // trades in chronological order.
  var equity = 0, peak = 0, maxDD = 0;
  _chronoClosed().forEach(function(t){
    equity += (t.pnl||0);
    if(equity > peak) peak = equity;
    var dd = peak - equity;
    if(dd > maxDD) maxDD = dd;
  });
  // Without a stored starting capital we approximate the "max DD %" as
  // maxDD / max(peak, 1). Conservative — only Ihsan/Tawakkul stages care.
  var ddPct = peak > 0 ? (maxDD / peak * 100) : 0;

  var siratStage = null, reasoning;
  if(positiveRun >= SIRAT_THRESHOLDS.ihsanMinMonths && Object.keys(bySetup).filter(function(k){
       var ts = bySetup[k]; return ts.length >= SIRAT_THRESHOLDS.setupMinTrades && (ts.filter(function(t){return t.pnl>0;}).length/ts.length*100) >= SIRAT_THRESHOLDS.setupMinWR;
     }).length >= 2){
    siratStage = 'ihsan';
    reasoning = positiveRun + ' consecutive positive months across multiple proven setups. The work now is teaching, giving, and scaling without drift.';
  } else if(positiveRun >= SIRAT_THRESHOLDS.tawakkulMinMonths && ddPct < SIRAT_THRESHOLDS.tawakkulMaxDDPct){
    siratStage = 'tawakkul';
    reasoning = positiveRun + ' positive months in a row, max drawdown ' + Math.round(ddPct) + '%. You have an edge that survives variance — defend it.';
  } else if(yaqeenByPF || yaqeenBySetup){
    siratStage = 'yaqeen';
    if(yaqeenBySetup){
      reasoning = 'Your "' + topSetup.name + '" setup: ' + topSetup.count + ' trades at ' + topSetup.wr + '% win rate. That is statistically real edge.';
    } else {
      reasoning = 'Last 30d: profit factor ' + pf.toFixed(2) + ', expectancy ' + (expectancy>=0?'+':'') + '$' + Math.round(expectancy) + '/trade. The edge is forming — protect it.';
    }
  } else {
    siratStage = 'sabr';
    reasoning = closed.length + ' closed trades, no setup yet at ' + SIRAT_THRESHOLDS.setupMinTrades + '+ trades with ' + SIRAT_THRESHOLDS.setupMinWR + '% WR. Stop trading marginal setups. Concentrate.';
  }

  return {
    stage: siratStage,
    reasoning: reasoning,
    focusThisWeek: _siratFocusFor(siratStage, closed, leak, { topSetup: topSetup, pf: pf, expectancy: expectancy, positiveRun: positiveRun }),
    graduation: _siratGraduationFor(siratStage, { closed: closed, bySetup: bySetup, topSetup: topSetup, pf: pf, expectancy: expectancy, positiveRun: positiveRun, ddPct: ddPct }),
    kpis: _siratKpisFor(siratStage, closed, s, { pf: pf, expectancy: expectancy, ddPct: ddPct, positiveRun: positiveRun })
  };
}

// One concrete focus action per stage. Pulls from the user's biggest leak
// (selected during onboarding) when the stage allows for it.
function _siratFocusFor(stage, closed, leak, ctx){
  ctx = ctx || {};
  if(stage === 'tahaarah'){
    return { title: 'Log every trade — including the ones you regret.', body: 'Discipline data only becomes useful at ' + SIRAT_THRESHOLDS.minTradesForStage2 + ' trades. Skip the "this one doesn\'t count" tax.' };
  }
  if(stage === 'sabr'){
    return { title: 'Pick one setup. Trade only that for 7 sessions.', body: 'Concentration is how an edge becomes visible in the data. Every other setup is a distraction this week.' };
  }
  if(stage === 'yaqeen'){
    var name = (ctx.topSetup && ctx.topSetup.name) || 'your best setup';
    return { title: 'Defend ' + name + '. Refuse everything else.', body: 'Your evidence says this works. The fastest way to break it is by drifting into adjacent setups when ' + name + ' isn\'t available.' };
  }
  if(stage === 'tawakkul'){
    return { title: 'Add a second proven setup — slowly.', body: 'Run it at half size until you have ' + SIRAT_THRESHOLDS.setupMinTrades + ' trades at ' + SIRAT_THRESHOLDS.setupMinWR + '%+ WR. Diversification compounds; chasing variety destroys.' };
  }
  return { title: 'Teach what you know. Give zakat. Scale honestly.', body: 'Ihsan is not about more trades — it\'s about more discipline at the same edge, and helping the next trader find theirs.' };
}

function _siratGraduationFor(stage, ctx){
  if(stage === 'tahaarah'){
    return { label:'To reach Sabr', target: SIRAT_THRESHOLDS.minTradesForStage2, progress: ctx.closed.length, copy: 'Log ' + SIRAT_THRESHOLDS.minTradesForStage2 + ' closed trades.' };
  }
  if(stage === 'sabr'){
    var best = null;
    Object.keys(ctx.bySetup).forEach(function(k){
      var ts = ctx.bySetup[k];
      var wr = ts.filter(function(t){return t.pnl>0;}).length / ts.length * 100;
      if(!best || ts.length > best.count) best = { name:k, count:ts.length, wr:Math.round(wr) };
    });
    return {
      label: 'To reach Yaqeen',
      target: SIRAT_THRESHOLDS.setupMinTrades,
      progress: best ? best.count : 0,
      copy: best ? ('Top setup "' + best.name + '": ' + best.count + ' trades / ' + best.wr + '% WR. Needs ' + SIRAT_THRESHOLDS.setupMinTrades + ' trades at ≥ ' + SIRAT_THRESHOLDS.setupMinWR + '%.') : ('Tag a setup on every trade. Top setup needs ' + SIRAT_THRESHOLDS.setupMinTrades + ' trades at ≥ ' + SIRAT_THRESHOLDS.setupMinWR + '% WR.')
    };
  }
  if(stage === 'yaqeen'){
    return {
      label: 'To reach Tawakkul',
      target: SIRAT_THRESHOLDS.tawakkulMinMonths,
      progress: ctx.positiveRun,
      copy: ctx.positiveRun + ' positive months in a row · need ' + SIRAT_THRESHOLDS.tawakkulMinMonths + '. Keep drawdown under ' + SIRAT_THRESHOLDS.tawakkulMaxDDPct + '%.'
    };
  }
  if(stage === 'tawakkul'){
    return {
      label: 'To reach Ihsan',
      target: SIRAT_THRESHOLDS.ihsanMinMonths,
      progress: ctx.positiveRun,
      copy: ctx.positiveRun + ' positive months in a row · need ' + SIRAT_THRESHOLDS.ihsanMinMonths + ' and a second proven setup.'
    };
  }
  return { label:'Ihsan', target: 1, progress: 1, copy: 'You\'re on the highest stage. Keep your edge, keep your prayers, keep paying it forward.' };
}

function _siratKpisFor(stage, closed, s, ctx){
  ctx = ctx || {};
  function kpi(label, value, helper){ return { label: label, value: value, helper: helper||'' }; }
  if(stage === 'tahaarah'){
    var loggedDays = {};
    closed.forEach(function(t){ if(t.date) loggedDays[t.date]=true; });
    var prayerDays = (s && s.dailyPrayers) ? Object.keys(s.dailyPrayers).length : 0;
    return [
      kpi('Trades logged', closed.length, 'Sample size for an edge to emerge'),
      kpi('Logging days', Object.keys(loggedDays).length, 'Distinct days with a trade'),
      kpi('Prayer days tracked', prayerDays, 'Days you marked at least one salah')
    ];
  }
  if(stage === 'sabr'){
    var top = ctx.topSetup;
    return [
      kpi('Top setup', top ? top.name : '—', top ? (top.count + ' trades · ' + top.wr + '% WR') : 'Tag setups on every trade'),
      kpi('Profit factor (30d)', ctx.pf === Infinity ? '∞' : (ctx.pf||0).toFixed(2), ctx.pf === Infinity ? 'No losing trades yet — keep it that way' : 'Gross wins ÷ gross losses'),
      kpi('Expectancy (30d)', (ctx.expectancy>=0?'+':'') + '$' + Math.round(ctx.expectancy||0), 'Per-trade average over the last 30 days')
    ];
  }
  if(stage === 'yaqeen'){
    return [
      kpi('Profit factor (30d)', ctx.pf === Infinity ? '∞' : (ctx.pf||0).toFixed(2), ctx.pf === Infinity ? 'No losing trades yet — goal: stay above 1.4' : 'Goal: stay above 1.4'),
      kpi('Expectancy (30d)', (ctx.expectancy>=0?'+':'') + '$' + Math.round(ctx.expectancy||0), 'Per-trade average'),
      kpi('Top setup', ctx.topSetup ? (ctx.topSetup.name + ' · ' + ctx.topSetup.wr + '%') : '—', ctx.topSetup ? (ctx.topSetup.count + ' trades') : 'Find your one best setup')
    ];
  }
  if(stage === 'tawakkul'){
    return [
      kpi('Positive months in a row', ctx.positiveRun, 'Goal: ' + SIRAT_THRESHOLDS.ihsanMinMonths + '+ for Ihsan'),
      kpi('Max drawdown', Math.round(ctx.ddPct||0) + '%', 'Stay under ' + SIRAT_THRESHOLDS.tawakkulMaxDDPct + '%'),
      kpi('Profit factor (30d)', ctx.pf === Infinity ? '∞' : (ctx.pf||0).toFixed(2), ctx.pf === Infinity ? 'No losing trades yet — edge defense' : 'Edge defense')
    ];
  }
  return [
    kpi('Positive months in a row', ctx.positiveRun, 'Maintain'),
    kpi('Max drawdown', Math.round(ctx.ddPct||0) + '%', 'Discipline check'),
    kpi('Top setup', ctx.topSetup ? ctx.topSetup.name : '—', 'Your proven edge')
  ];
}

// Persist stage transitions to S.settings.sirat so the user sees their
// journey over time. Called from renderSirat() and from the dashboard.
function recordSiratStage(diag){
  if(!S.settings) S.settings = {};
  var cur = S.settings.sirat || {};
  if(cur.currentStage === diag.stage) return; // no transition
  cur.history = cur.history || [];
  if(cur.currentStage){
    // Close the previous stage entry
    var last = cur.history[cur.history.length-1];
    if(last && last.stage === cur.currentStage && !last.exitedAt){
      last.exitedAt = new Date().toISOString();
    }
  }
  cur.currentStage = diag.stage;
  cur.enteredAt = new Date().toISOString();
  cur.history.push({ stage: diag.stage, enteredAt: cur.enteredAt });
  S.settings.sirat = cur;
  sv('settings', S.settings);
}

function renderSirat(){
  var host = el('sirat-content'); if(!host) return;
  // Premium gate
  if(!isSirat()){
    host.innerHTML = _siratUpsell();
    return;
  }
  var diag = computeUserStage(S);
  recordSiratStage(diag);

  var stageInfo = SIRAT_STAGES[diag.stage] || SIRAT_STAGES.tahaarah;
  var stageNum = stageInfo.order;
  var grad = diag.graduation || {};
  var pct = grad.target ? Math.min(100, Math.round(grad.progress / grad.target * 100)) : 100;

  var html = '';

  // ── Stage banner ────────────────────────────────────────────────────────
  html += '<div style="background:linear-gradient(160deg,#1e1b12 0%,#0f0d09 100%);border:1px solid rgba(218,180,98,0.28);border-radius:20px;padding:32px 32px;margin-bottom:18px;position:relative;overflow:hidden;">';
  html += '<div style="position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);"></div>';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;letter-spacing:0.22em;color:var(--gold);text-transform:uppercase;margin-bottom:10px;">STAGE ' + stageNum + ' OF 5</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:2.7rem;font-weight:600;color:var(--ink);line-height:1.05;letter-spacing:-0.03em;">You\'re in <em style="color:var(--gold);font-style:italic;">' + esc(stageInfo.name) + '</em>.</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:1.05rem;color:var(--ink-3);margin-top:4px;margin-bottom:18px;">' + esc(stageInfo.sub) + '</div>';
  html += '<div style="font-size:0.92rem;color:var(--ink-2);line-height:1.7;max-width:680px;">' + esc(diag.reasoning) + '</div>';
  html += '</div>';

  // ── This week's focus ───────────────────────────────────────────────────
  if(diag.focusThisWeek){
    html += '<div style="background:linear-gradient(135deg,rgba(218,180,98,0.08),transparent);border:1px solid rgba(218,180,98,0.22);border-radius:16px;padding:22px 24px;margin-bottom:18px;">';
    html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.2em;color:var(--gold);text-transform:uppercase;margin-bottom:8px;">THIS WEEK\'S FOCUS</div>';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.35rem;font-weight:600;color:var(--ink);line-height:1.3;margin-bottom:6px;">' + esc(diag.focusThisWeek.title) + '</div>';
    html += '<div style="font-size:0.86rem;color:var(--ink-2);line-height:1.7;">' + esc(diag.focusThisWeek.body) + '</div>';
    html += '</div>';
  }

  // ── KPI dashboard (stage-specific) ──────────────────────────────────────
  if(diag.kpis && diag.kpis.length){
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">';
    diag.kpis.forEach(function(k){
      html += '<div style="background:var(--surface);border:1px solid var(--line-2);border-radius:12px;padding:18px 18px;">';
      html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.18em;color:var(--ink-3);text-transform:uppercase;margin-bottom:6px;">' + esc(k.label) + '</div>';
      html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.7rem;font-weight:600;color:var(--ink);line-height:1.1;">' + esc(String(k.value)) + '</div>';
      if(k.helper){ html += '<div style="font-size:0.72rem;color:var(--ink-4);margin-top:4px;line-height:1.45;">' + esc(k.helper) + '</div>'; }
      html += '</div>';
    });
    html += '</div>';
  }

  // ── Graduation progress ─────────────────────────────────────────────────
  html += '<div style="background:var(--surface);border:1px solid var(--line-2);border-radius:14px;padding:22px 24px;margin-bottom:18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:10px;">';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.18em;color:var(--ink-3);text-transform:uppercase;">' + esc(grad.label || 'Progress') + '</div>';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;color:var(--gold);">' + (grad.progress||0) + ' / ' + (grad.target||0) + '</div>';
  html += '</div>';
  html += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--gold-deep),var(--gold-2));transition:width 0.4s;"></div></div>';
  if(grad.copy){ html += '<div style="font-size:0.82rem;color:var(--ink-2);margin-top:12px;line-height:1.65;">' + esc(grad.copy) + '</div>'; }
  html += '</div>';

  // ── Stage history timeline ──────────────────────────────────────────────
  var hist = (S.settings && S.settings.sirat && S.settings.sirat.history) || [];
  if(hist.length){
    html += '<div style="background:var(--surface);border:1px solid var(--line-2);border-radius:14px;padding:22px 24px;margin-bottom:18px;">';
    html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.18em;color:var(--ink-3);text-transform:uppercase;margin-bottom:14px;">YOUR PATH</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    hist.slice().reverse().forEach(function(h, i){
      var s = SIRAT_STAGES[h.stage] || {};
      var d = h.enteredAt ? new Date(h.enteredAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      html += '<div style="display:flex;align-items:baseline;gap:14px;font-size:0.86rem;">';
      html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;color:var(--ink-4);min-width:110px;">' + esc(d) + '</div>';
      html += '<div style="color:' + (i===0 ? 'var(--gold)' : 'var(--ink-2)') + ';font-family:\'Cormorant Garamond\',serif;font-size:1.05rem;font-weight:' + (i===0 ? '600' : '500') + ';">' + esc(s.name || h.stage) + (i===0 ? ' <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.18em;color:var(--gold);text-transform:uppercase;margin-left:8px;">CURRENT</span>' : '') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // ── Tools: Edge Audit + Risk-of-Ruin ───────────────────────────────────
  html += '<div class="grid-2" style="gap:12px;margin-bottom:18px;">';
  html += '<div class="panel"><div class="panel-head"><div class="panel-title">Edge Audit</div></div><div style="font-size:0.84rem;color:var(--ink-3);margin-bottom:14px;line-height:1.65;">A shareable monthly snapshot of where your edge actually lives: setup, time-of-day, instrument, and behavior. Auto-generated from your data.</div><button class="btn btn-gold" data-hclick="h151">Generate this month\'s audit</button></div>';
  html += '<div class="panel"><div class="panel-head"><div class="panel-title">Risk-of-Ruin</div></div><div style="font-size:0.84rem;color:var(--ink-3);margin-bottom:14px;line-height:1.65;">10,000 Monte Carlo simulations using your actual win-rate and win/loss distribution. Tells you the probability of N% drawdown over the next 100 trades.</div><button class="btn btn-outline" data-hclick="h152">Run simulation</button><div id="ror-result" style="margin-top:14px;"></div></div>';
  html += '</div>';

  host.innerHTML = html;
}

function _siratUpsell(){
  return '<div style="background:linear-gradient(160deg,#1e1b12 0%,#0f0d09 100%);border:1px solid rgba(218,180,98,0.28);border-radius:20px;padding:38px 36px;text-align:left;max-width:720px;margin:0 auto;">' +
    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;letter-spacing:0.22em;color:var(--gold);text-transform:uppercase;margin-bottom:10px;">SIRAT — NIYYAH PREMIUM</div>' +
    '<div style="font-family:\'Cormorant Garamond\',serif;font-size:2.1rem;font-weight:600;color:var(--ink);line-height:1.1;margin-bottom:14px;">The staged path to <em style="color:var(--gold);">profitability.</em></div>' +
    '<div style="font-size:0.92rem;color:var(--ink-2);line-height:1.75;margin-bottom:22px;">Five stages — Tahaarah, Sabr, Yaqeen, Tawakkul, Ihsan — calibrated to your actual data. Niyyah tells you exactly where you stand, what\'s blocking the next stage, and the one focus that gets you through it. Plus <strong style="color:var(--ink);">Mizan</strong> (live verdict on every trade you propose), <strong style="color:var(--ink);">Edge Audit</strong>, <strong style="color:var(--ink);">Risk-of-Ruin</strong>, <strong style="color:var(--ink);">Disaster Brake</strong>, and <strong style="color:var(--ink);">Witness Mode</strong> <span style="font-size:0.8em;color:var(--ink-4);">(rolling out)</span>.</div>' +
    '<button class="btn btn-gold btn-lg" data-hclick="h153">Upgrade to Sirat — $38/mo</button>' +
    '<div style="margin-top:10px;font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;letter-spacing:0.14em;color:var(--ink-4);text-transform:uppercase;">or $300/yr · save $156 · 7-day refund</div>' +
    '</div>';
}

// Re-open the paywall pre-selected to Sirat so the user can upgrade.
function upgradeToSirat(){ /* Demo mode — all features already unlocked */ }

// ══════════════════════════════════════════════════════════════════════════
// MIZAN — pre-trade live validator
// ══════════════════════════════════════════════════════════════════════════
//
// Weighs a proposed trade against the user's own evidence in real time.
// Pure deterministic — no AI, no external calls. Wired into the entry
// modal as the user types.
//
// Returns { overall:'green'|'yellow'|'red', verdicts:[{name,signal,message}], summary }.

function computeMizan(p, s){
  var verdicts = [];
  var add = function(name, signal, message){ verdicts.push({ name:name, signal:signal, message:message }); };

  var closed = (s.trades||[]).filter(function(t){ return t.status==='closed' && !t.sample; });

  // 1. Playbook match
  var pbHit = null;
  (s.playbook||[]).forEach(function(pb){
    if(pb.name && p.setup && pb.name.toLowerCase() === p.setup.toLowerCase()) pbHit = pb;
  });
  if(p.setup){
    if(pbHit){
      add('Playbook', 'green', 'Setup "' + p.setup + '" is in your playbook. ✓');
    } else {
      add('Playbook', 'yellow', '"' + p.setup + '" isn\'t in your playbook yet. Add it or pick a known setup.');
    }
  }

  // 2. Setup edge
  if(p.setup){
    var sameSetup = closed.filter(function(t){ return (t.setup||'').toLowerCase() === p.setup.toLowerCase(); });
    if(sameSetup.length >= 5){
      var w = sameSetup.filter(function(t){return t.pnl>0;}).length;
      var wr = Math.round(w/sameSetup.length*100);
      var net = sameSetup.reduce(function(a,t){return a+t.pnl;},0);
      var exp = Math.round(net/sameSetup.length);
      var sig = wr >= 55 ? 'green' : wr >= 40 ? 'yellow' : 'red';
      add('Setup edge', sig, 'Your last ' + sameSetup.length + ' "' + p.setup + '" trades: ' + wr + '% WR · ' + (exp>=0?'+':'') + '$' + Math.abs(exp) + '/trade.');
    } else if(sameSetup.length > 0){
      add('Setup edge', 'yellow', 'Only ' + sameSetup.length + ' prior trades on "' + p.setup + '" — too few to know your edge.');
    }
  }

  // 3. Instrument edge
  if(p.instrument){
    var sameInst = closed.filter(function(t){ return (t.instrument||'').toLowerCase() === p.instrument.toLowerCase(); });
    if(sameInst.length >= 5){
      var iw = sameInst.filter(function(t){return t.pnl>0;}).length;
      var iwr = Math.round(iw/sameInst.length*100);
      var inet = sameInst.reduce(function(a,t){return a+t.pnl;},0);
      var isig = iwr >= 50 && inet > 0 ? 'green' : iwr >= 40 ? 'yellow' : 'red';
      add('Instrument', isig, p.instrument + ': ' + sameInst.length + ' trades · ' + iwr + '% WR · net ' + (inet>=0?'+':'') + '$' + Math.abs(inet) + '.');
    }
  }

  // 4. Time-of-day edge
  var now = new Date();
  var hour = now.getHours();
  if(closed.length >= 10){
    var sameHour = closed.filter(function(t){
      if(!t.time) return false;
      return Math.abs(parseInt(t.time.split(':')[0]) - hour) <= 0;
    });
    if(sameHour.length >= 5){
      var hw = sameHour.filter(function(t){return t.pnl>0;}).length;
      var hwr = Math.round(hw/sameHour.length*100);
      var hsig = hwr >= 55 ? 'green' : hwr >= 40 ? 'yellow' : 'red';
      add('Time of day', hsig, hour + ':00 hour · ' + sameHour.length + ' trades · ' + hwr + '% WR.');
    }
  }

  // 5. Day-state context (post-win / post-loss)
  var today = (function(){ var n=new Date(); return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate()); })();
  var yest = (function(){ var d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); })();
  var yestClosed = closed.filter(function(t){ return t.date === yest; });
  var yestPnl = yestClosed.reduce(function(a,t){return a+t.pnl;},0);
  if(yestClosed.length && closed.length >= 10){
    var afterWin = closed.length >= 12 ? closed.filter(function(t,i,arr){
      var prev = arr[i+1]; return prev && prev.pnl > 0;
    }) : [];
    var afterLoss = closed.length >= 12 ? closed.filter(function(t,i,arr){
      var prev = arr[i+1]; return prev && prev.pnl < 0;
    }) : [];
    if(yestPnl > 0 && afterWin.length >= 5){
      var awr = Math.round(afterWin.filter(function(t){return t.pnl>0;}).length / afterWin.length * 100);
      var sig5 = awr >= 50 ? 'green' : awr >= 40 ? 'yellow' : 'red';
      add('Day state', sig5, 'Yesterday closed +$' + Math.round(yestPnl) + '. Your post-win trades: ' + awr + '% WR — kibr guard.');
    } else if(yestPnl < 0 && afterLoss.length >= 5){
      var lwr = Math.round(afterLoss.filter(function(t){return t.pnl>0;}).length / afterLoss.length * 100);
      var sig5b = lwr >= 50 ? 'green' : lwr >= 40 ? 'yellow' : 'red';
      add('Day state', sig5b, 'Yesterday closed -$' + Math.round(Math.abs(yestPnl)) + '. Your post-loss trades: ' + lwr + '% WR — revenge guard.');
    }
  }

  // 6. Sirat focus alignment
  var sirat = s.settings && s.settings.sirat;
  if(sirat && sirat.currentStage === 'sabr' && p.setup){
    // Sabr stage: focus is on one chosen top setup. If we have a top
    // setup and the proposed trade isn't it, flag.
    var bySetup = {};
    closed.forEach(function(t){
      var k = (t.setup||'').trim() || '(unnamed)';
      (bySetup[k] = bySetup[k] || []).push(t);
    });
    var top = null;
    Object.keys(bySetup).forEach(function(k){
      var ts = bySetup[k];
      if(!top || ts.length > top.count) top = { name:k, count:ts.length };
    });
    if(top && top.name.toLowerCase() !== p.setup.toLowerCase()){
      add('Sirat focus', 'red', 'Sabr stage says concentrate on "' + top.name + '" (your largest sample). This is "' + p.setup + '" — outside focus.');
    }
  }

  // 7. Daily-limit proximity
  var todaysClosed = closed.filter(function(t){ return t.date === today; });
  var todayPnl = todaysClosed.reduce(function(a,t){return a+t.pnl;},0);
  var dailyLimit = s.morning && s.morning[today] && s.morning[today].lossLimit;
  if(dailyLimit && todayPnl < 0){
    var loss = Math.abs(todayPnl);
    var pctOfLimit = Math.round(loss/dailyLimit*100);
    if(pctOfLimit >= 70){
      add('Daily limit', 'red', 'Today: -$' + Math.round(loss) + ' (' + pctOfLimit + '% of -$' + dailyLimit + ' limit). Step away.');
    } else if(pctOfLimit >= 40){
      add('Daily limit', 'yellow', 'Today: -$' + Math.round(loss) + ' (' + pctOfLimit + '% of -$' + dailyLimit + ' limit).');
    }
  }

  // 8. Consecutive loss guard
  if(todaysClosed.length >= 2){
    // Walk backwards through today's chronologically-last trades. We can't
    // perfectly order without timestamps, so use array order (newest first
    // because trades.unshift on save).
    var streak = 0;
    for(var i=0; i<todaysClosed.length; i++){
      if(todaysClosed[i].pnl < 0) streak++;
      else break;
    }
    if(streak >= 3){
      add('Loss streak', 'red', streak + ' consecutive losses today. Your nafs wants the next trade. Your data says wait.');
    } else if(streak >= 2){
      add('Loss streak', 'yellow', streak + ' losses in a row today. Half-size or wait for an A+ setup.');
    }
  }

  // Aggregate verdict
  var reds = verdicts.filter(function(v){return v.signal==='red';}).length;
  var yellows = verdicts.filter(function(v){return v.signal==='yellow';}).length;
  var greens = verdicts.filter(function(v){return v.signal==='green';}).length;
  var overall = reds > 0 ? 'red' : yellows > greens ? 'yellow' : greens > 0 ? 'green' : 'neutral';
  var summary = reds > 0
    ? (reds + ' red signal' + (reds===1?'':'s') + '. Read carefully before entering.')
    : yellows > 0
      ? (yellows + ' caution flag' + (yellows===1?'':'s') + '. Proceed with eyes open.')
      : greens > 0
        ? 'Your own data supports this trade.'
        : 'Not enough history yet to judge.';

  return { overall: overall, verdicts: verdicts, summary: summary };
}

// Build the proposed-trade object from the current entry modal form state.
function _readProposedTradeFromModal(){
  var dir = el('e-dir') ? el('e-dir').value : 'LONG';
  var setupSel = el('e-setup-sel') ? el('e-setup-sel').value : '';
  var setupTxt = el('e-setup') ? el('e-setup').value : '';
  var time = el('e-time') ? el('e-time').value : '';
  return {
    instrument: (el('e-inst') ? el('e-inst').value : '').toUpperCase().trim(),
    direction: dir,
    setup: (setupSel || setupTxt || '').trim(),
    entry: el('e-entry') ? el('e-entry').value : '',
    stop: el('e-stop') ? el('e-stop').value : '',
    target: el('e-target') ? el('e-target').value : '',
    time: time,
    emotion: S.selEmotion || ''
  };
}

var _mizanTimer = null;
function refreshMizan(){
  var panel = el('mizan-panel'); if(!panel) return;
  if(!isSirat()){ panel.style.display = 'none'; panel.innerHTML = ''; return; }
  // Debounce — typing in a price field would otherwise re-render on every keystroke
  if(_mizanTimer) clearTimeout(_mizanTimer);
  _mizanTimer = setTimeout(_doRenderMizan, 120);
}

function _doRenderMizan(){
  var panel = el('mizan-panel'); if(!panel) return;
  var proposed = _readProposedTradeFromModal();
  if(!proposed.instrument && !proposed.setup){
    panel.style.display = 'none'; panel.innerHTML = '';
    return;
  }
  panel.style.display = '';
  var r = computeMizan(proposed, S);
  var ringColor = r.overall==='red' ? 'var(--red)' : r.overall==='yellow' ? 'var(--gold)' : r.overall==='green' ? 'var(--green)' : 'var(--ink-3)';
  var ringText = r.overall.toUpperCase();
  var html = '<div style="border:1px solid rgba(218,180,98,0.22);border-radius:14px;padding:16px 18px;background:linear-gradient(160deg,#1a1810 0%,#0e0c08 100%);">';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.2em;color:var(--gold);text-transform:uppercase;">MIZAN · LIVE VERDICT</div>';
  html += '<div style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,0.4);border:1px solid ' + ringColor + ';color:' + ringColor + ';font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:0.16em;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:' + ringColor + ';"></span>' + ringText + '</div>';
  html += '</div>';
  html += '<div style="font-size:0.86rem;color:var(--ink-2);line-height:1.6;margin-bottom:10px;">' + esc(r.summary) + '</div>';
  if(r.verdicts.length){
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    r.verdicts.forEach(function(v){
      var c = v.signal==='red' ? 'var(--red)' : v.signal==='yellow' ? 'var(--gold)' : 'var(--green)';
      html += '<div style="display:flex;align-items:flex-start;gap:10px;font-size:0.8rem;color:var(--ink-2);line-height:1.5;">';
      html += '<div style="width:5px;height:5px;border-radius:50%;background:' + c + ';margin-top:7px;flex-shrink:0;"></div>';
      html += '<div><strong style="color:var(--ink);">' + esc(v.name) + '</strong> — ' + esc(v.message) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '<div style="margin-top:10px;font-size:0.68rem;color:var(--ink-4);font-style:italic;">Mizan never blocks — it weighs. Final say is yours.</div>';
  html += '</div>';
  panel.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════
// RISK-OF-RUIN — Monte Carlo against the user's actual trade distribution
// ══════════════════════════════════════════════════════════════════════════
function renderRiskOfRuin(){
  var host = el('ror-result'); if(!host) return;
  var closed = (S.trades||[]).filter(function(t){return t.status==='closed' && !t.sample;});
  if(closed.length < 20){
    host.innerHTML = '<div style="font-size:0.82rem;color:var(--ink-4);background:var(--surface-2);border:1px solid var(--line-2);border-radius:10px;padding:14px 16px;line-height:1.6;">Risk-of-Ruin needs at least 20 closed trades to simulate against. You have ' + closed.length + '. Keep logging.</div>';
    return;
  }
  host.innerHTML = '<div style="font-size:0.82rem;color:var(--ink-3);">Running 10,000 simulations…</div>';
  // Run async so the UI doesn't freeze on slower devices.
  setTimeout(function(){
    var pnls = closed.map(function(t){return t.pnl||0;});
    var SIMS = 10000;
    var STEPS = 100;
    var ddBuckets = { p50:0, p75:0, p95:0, ruin:0 };
    var ddSamples = [];
    for(var s=0; s<SIMS; s++){
      var eq = 0, peak = 0, mdd = 0;
      for(var i=0; i<STEPS; i++){
        eq += pnls[Math.floor(Math.random()*pnls.length)];
        if(eq > peak) peak = eq;
        var dd = peak - eq;
        if(dd > mdd) mdd = dd;
      }
      ddSamples.push(mdd);
      if(eq <= -Math.max(peak, 1000)) ddBuckets.ruin++;
    }
    ddSamples.sort(function(a,b){return a-b;});
    ddBuckets.p50 = ddSamples[Math.floor(SIMS*0.5)];
    ddBuckets.p75 = ddSamples[Math.floor(SIMS*0.75)];
    ddBuckets.p95 = ddSamples[Math.floor(SIMS*0.95)];
    var ruinPct = (ddBuckets.ruin / SIMS * 100).toFixed(1);
    host.innerHTML =
      '<div style="background:var(--surface-2);border:1px solid var(--line-2);border-radius:12px;padding:16px 18px;">' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">' +
          '<div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.16em;color:var(--ink-3);text-transform:uppercase;">Median DD</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:600;color:var(--ink);line-height:1.1;">-$' + Math.round(ddBuckets.p50) + '</div></div>' +
          '<div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.16em;color:var(--ink-3);text-transform:uppercase;">75th %ile</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:600;color:var(--gold);line-height:1.1;">-$' + Math.round(ddBuckets.p75) + '</div></div>' +
          '<div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.16em;color:var(--ink-3);text-transform:uppercase;">95th %ile</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:600;color:var(--red);line-height:1.1;">-$' + Math.round(ddBuckets.p95) + '</div></div>' +
        '</div>' +
        '<div style="font-size:0.78rem;color:var(--ink-3);line-height:1.65;">' +
          'Across 10,000 simulations of your next 100 trades (resampled from your real win/loss distribution), the median worst drawdown is <strong style="color:var(--ink);">-$' + Math.round(ddBuckets.p50) + '</strong>. There\'s a 5% chance it exceeds <strong style="color:var(--red);">-$' + Math.round(ddBuckets.p95) + '</strong>. Plan around the 95th percentile, not the median.' +
        '</div>' +
      '</div>';
  }, 40);
}

// ══════════════════════════════════════════════════════════════════════════
// EDGE AUDIT — auto-generated shareable monthly report
// ══════════════════════════════════════════════════════════════════════════
function generateEdgeAudit(){
  if(!isSirat()){ toast('Sirat-only feature','e'); return; }
  var closed = (S.trades||[]).filter(function(t){return t.status==='closed' && !t.sample;});
  if(closed.length < 5){ toast('Need at least 5 closed trades for an audit','e'); return; }
  toast('Rendering audit…','i');
  var ensureLib = window.htmlToImage
    ? Promise.resolve(window.htmlToImage)
    : new Promise(function(resolve, reject){
        var sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
        sc.onload = function(){ resolve(window.htmlToImage); };
        sc.onerror = reject;
        document.head.appendChild(sc);
      });

  // Build the poster
  var month = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
  var monthKey = (new Date()).toISOString().slice(0,7);
  var monthly = closed.filter(function(t){ return (t.date||'').slice(0,7) === monthKey; });
  if(!monthly.length) monthly = closed.slice(0, 30); // fallback so the poster always has content
  var wins = monthly.filter(function(t){return t.pnl>0;});
  var pnl = monthly.reduce(function(a,t){return a+t.pnl;},0);
  var wr = monthly.length ? Math.round(wins.length/monthly.length*100) : 0;

  // Aggregate by setup
  var bySetup = {};
  monthly.forEach(function(t){
    var k = (t.setup||'(no setup)').trim();
    if(!bySetup[k]) bySetup[k] = { n:0, w:0, pnl:0 };
    bySetup[k].n++; bySetup[k].pnl += t.pnl||0; if((t.pnl||0)>0) bySetup[k].w++;
  });
  var setupRows = Object.keys(bySetup).map(function(k){
    var d = bySetup[k];
    return { name:k, n:d.n, wr: Math.round(d.w/d.n*100), pnl:d.pnl };
  }).sort(function(a,b){return b.pnl-a.pnl;}).slice(0,5);

  // Time-of-day aggregate
  var byHour = {};
  monthly.forEach(function(t){
    if(!t.time) return;
    var h = parseInt(t.time.split(':')[0],10);
    if(isNaN(h)) return;
    if(!byHour[h]) byHour[h] = { n:0, w:0, pnl:0 };
    byHour[h].n++; byHour[h].pnl += t.pnl||0; if((t.pnl||0)>0) byHour[h].w++;
  });
  var bestHour = null, worstHour = null;
  Object.keys(byHour).forEach(function(h){
    var d = byHour[h];
    if(d.n < 2) return;
    if(!bestHour || d.pnl > bestHour.pnl) bestHour = { h:h, pnl:d.pnl, wr:Math.round(d.w/d.n*100), n:d.n };
    if(!worstHour || d.pnl < worstHour.pnl) worstHour = { h:h, pnl:d.pnl, wr:Math.round(d.w/d.n*100), n:d.n };
  });

  // Behavioral
  var calmWins = monthly.filter(function(t){return ['calm','patient','focused'].indexOf(t.emotion||'')>-1 && t.pnl>0;}).length;
  var emotionalLosses = monthly.filter(function(t){return ['fomo','revenge','urgency','anxious','overconf'].indexOf(t.emotion||'')>-1 && t.pnl<0;}).length;

  var diag = computeUserStage(S);
  var focusNext = diag.focusThisWeek;

  var poster = document.createElement('div');
  poster.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;padding:80px 70px;background:linear-gradient(160deg,#1e1b12 0%,#0a0906 100%);color:#f2ead6;font-family:Inter,sans-serif;';
  var html = '';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.9rem;letter-spacing:0.3em;color:#dab462;text-transform:uppercase;margin-bottom:8px;">☽ Niyyah · Edge Audit</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:3.4rem;font-weight:600;color:#f2ead6;line-height:1.05;letter-spacing:-0.02em;margin-bottom:6px;">' + esc(month) + '</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:1.2rem;color:#beb29a;margin-bottom:30px;">' + monthly.length + ' trades · ' + wr + '% win rate · ' + (pnl>=0?'+':'') + '$' + Math.round(Math.abs(pnl)) + ' net</div>';

  html += '<div style="margin-bottom:26px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;letter-spacing:0.22em;color:#dab462;text-transform:uppercase;margin-bottom:10px;">SETUP EDGE</div>';
  setupRows.forEach(function(r){
    html += '<div style="display:flex;justify-content:space-between;font-size:1.05rem;padding:8px 0;border-bottom:1px solid rgba(218,180,98,0.08);"><span style="color:#f2ead6;font-weight:500;">' + esc(r.name) + '</span><span style="color:#beb29a;">' + r.n + ' trades · ' + r.wr + '% WR · <strong style="color:' + (r.pnl>=0?'#6cb088':'#d28282') + ';">' + (r.pnl>=0?'+':'-') + '$' + Math.round(Math.abs(r.pnl)) + '</strong></span></div>';
  });
  html += '</div>';

  if(bestHour && worstHour){
    html += '<div style="margin-bottom:26px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;letter-spacing:0.22em;color:#dab462;text-transform:uppercase;margin-bottom:10px;">TIME OF DAY</div>';
    html += '<div style="font-size:1.05rem;color:#f2ead6;line-height:1.7;">Best: <strong>' + bestHour.h + ':00–' + (bestHour.h+1) + ':00</strong> · ' + bestHour.wr + '% WR · <span style="color:#6cb088;">+$' + Math.round(bestHour.pnl) + '</span><br>Worst: <strong>' + worstHour.h + ':00–' + (worstHour.h+1) + ':00</strong> · ' + worstHour.wr + '% WR · <span style="color:#d28282;">-$' + Math.round(Math.abs(worstHour.pnl)) + '</span></div></div>';
  }

  html += '<div style="margin-bottom:26px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;letter-spacing:0.22em;color:#dab462;text-transform:uppercase;margin-bottom:10px;">BEHAVIOR</div>';
  html += '<div style="font-size:1.05rem;color:#f2ead6;line-height:1.7;">Calm-state wins: <strong>' + calmWins + '</strong> · Emotional losses: <strong style="color:#d28282;">' + emotionalLosses + '</strong></div></div>';

  if(focusNext){
    html += '<div style="margin-top:30px;padding:24px 26px;background:rgba(218,180,98,0.06);border:1px solid rgba(218,180,98,0.2);border-radius:14px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;letter-spacing:0.22em;color:#dab462;text-transform:uppercase;margin-bottom:10px;">NEXT MONTH\'S FOCUS</div>';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:600;color:#f2ead6;line-height:1.3;margin-bottom:6px;">' + esc(focusNext.title) + '</div>';
    html += '<div style="font-size:1rem;color:#beb29a;line-height:1.65;">' + esc(focusNext.body) + '</div></div>';
  }

  html += '<div style="margin-top:42px;padding-top:22px;border-top:1px solid rgba(218,180,98,0.18);font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;color:#8a7e67;letter-spacing:0.18em;text-transform:uppercase;text-align:center;">niyyahtrader.com · trade with intention</div>';
  poster.innerHTML = html;
  document.body.appendChild(poster);

  ensureLib.then(function(lib){
    return lib.toPng(poster, { pixelRatio: 1, width: 1080, height: poster.scrollHeight });
  }).then(function(dataUrl){
    document.body.removeChild(poster);
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'niyyah-edge-audit-' + monthKey + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('✓ Saved edge-audit-' + monthKey + '.png','s');
  }).catch(function(err){
    try{ document.body.removeChild(poster); }catch(_){}
    toast('Could not render image: ' + (err && err.message || 'load failed'),'e');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// DISASTER BRAKE — opt-in lockout when you're about to tilt
// ══════════════════════════════════════════════════════════════════════════
function siratLockUntil(){
  return (S.settings && S.settings.sirat && S.settings.sirat.lockUntil) || 0;
}
function isSiratLocked(){
  return siratLockUntil() > Date.now();
}
function openDisasterBrake(){
  if(!isSirat()){ upgradeToSirat(); return; }
  var html = '<div style="background:linear-gradient(160deg,#1e1810 0%,#0e0c08 100%);border:1px solid rgba(210,130,130,0.32);border-radius:18px;padding:28px 26px;max-width:440px;width:100%;">';
  html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.55rem;letter-spacing:0.22em;color:var(--red);text-transform:uppercase;margin-bottom:8px;">DISASTER BRAKE</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:600;color:var(--ink);line-height:1.25;margin-bottom:14px;">Stop yourself. <em style="color:var(--red);">Now.</em></div>';
  html += '<div style="font-size:0.85rem;color:var(--ink-2);line-height:1.7;margin-bottom:16px;">Trade entry will be locked until the duration you pick is up. You\'ll need to write one line about what triggered this before unlocking.</div>';
  html += '<label style="display:block;font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;color:var(--ink-3);text-transform:uppercase;margin-bottom:6px;">LOCK FOR</label>';
  html += '<select id="db-duration" style="width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:10px 12px;color:var(--ink);font-family:Inter,sans-serif;font-size:0.86rem;margin-bottom:14px;">';
  html += '<option value="3600">1 hour</option>';
  html += '<option value="14400">4 hours</option>';
  html += '<option value="86400" selected>Until tomorrow (24h)</option>';
  html += '<option value="604800">Until next week (7 days)</option>';
  html += '</select>';
  html += '<label style="display:block;font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;color:var(--ink-3);text-transform:uppercase;margin-bottom:6px;">WHAT TRIGGERED THIS? (REQUIRED)</label>';
  html += '<textarea id="db-reason" rows="3" placeholder="One sentence is enough. Be honest." style="width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:10px 12px;color:var(--ink);font-family:Inter,sans-serif;font-size:0.86rem;margin-bottom:18px;resize:vertical;"></textarea>';
  html += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="btn btn-outline" data-hclick="h154">Cancel</button>';
  html += '<button class="btn btn-danger" data-hclick="h155">Engage brake</button>';
  html += '</div></div>';
  var overlay = el('db-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'db-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.78);backdrop-filter:blur(8px);padding:24px;';
    overlay.onclick = function(e){ if(e.target===overlay) closeDisasterBrake(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeDisasterBrake(){
  var overlay = el('db-overlay'); if(overlay){ overlay.style.display = 'none'; overlay.innerHTML=''; }
  document.body.style.overflow = '';
}
function engageDisasterBrake(){
  var dur = parseInt(el('db-duration') && el('db-duration').value || '86400', 10);
  var reason = (el('db-reason') && el('db-reason').value || '').trim();
  if(reason.length < 8){ toast('Write at least one honest line first','e'); return; }
  var until = Date.now() + dur*1000;
  if(!S.settings) S.settings = {};
  if(!S.settings.sirat) S.settings.sirat = {};
  S.settings.sirat.lockUntil = until;
  S.settings.sirat.brakes = S.settings.sirat.brakes || [];
  S.settings.sirat.brakes.push({ at: new Date().toISOString(), reason: reason, durationSec: dur });
  sv('settings', S.settings);
  closeDisasterBrake();
  toast('✓ Entry locked until ' + new Date(until).toLocaleString(),'s');
  // Refresh the dashboard / topbar so the lock badge shows immediately.
  if(el('page-dashboard').classList.contains('active')) renderDash();
  _refreshBrakeBadge();
}
function _refreshBrakeBadge(){
  var btn = el('topbar-brake'); if(!btn) return;
  btn.style.display = isSirat() ? '' : 'none';
  if(isSiratLocked()){
    btn.classList.add('locked');
    btn.title = 'Locked until ' + new Date(siratLockUntil()).toLocaleString();
  } else {
    btn.classList.remove('locked');
    btn.title = 'Disaster brake — lock yourself out';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// WITNESS MODE — weekly summary email to a trusted person (Sirat-only)
// ══════════════════════════════════════════════════════════════════════════
function renderWitnessRow(){
  var row = el('witness-row'); if(!row) return;
  if(!isSirat()){
    row.innerHTML = '<div style="font-size:0.78rem;color:var(--ink-4);">Available on Sirat. <a data-hclick="h153" style="color:var(--gold);cursor:pointer;">Upgrade →</a></div>';
    return;
  }
  var w = (S.settings && S.settings.witness) || null;
  if(w && w.email){
    row.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        '<div style="flex:1;font-size:0.82rem;color:var(--ink-2);">Weekly summary going to <strong style="color:var(--gold);">' + esc(w.email) + '</strong>' + (w.label ? ' (' + esc(w.label) + ')' : '') + '. Discipline metrics only — no P&L, no trade detail.</div>' +
        '<button class="btn btn-ghost btn-sm" data-hclick="h156">Disable</button>' +
      '</div>';
  } else {
    row.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px;">' +
          '<input type="email" id="w-email" placeholder="trusted@example.com" style="background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:9px 12px;color:var(--ink);font-size:0.84rem;">' +
          '<input type="text" id="w-label" placeholder="Spouse · Mentor · Partner" style="background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:9px 12px;color:var(--ink);font-size:0.84rem;">' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;"><button class="btn btn-gold btn-sm" data-hclick="h157">Enable witness</button></div>' +
      '</div>';
  }
}
function saveWitness(){
  var email = (el('w-email') && el('w-email').value || '').trim();
  var label = (el('w-label') && el('w-label').value || '').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Enter a valid email','e'); return; }
  if(!S.settings) S.settings = {};
  S.settings.witness = { email: email, label: label, since: new Date().toISOString() };
  sv('settings', S.settings);
  renderWitnessRow();
  toast('✓ Witness saved. Weekly email delivery is rolling out — you\'ll be notified when active.','s');
}
function clearWitness(){
  if(!S.settings) S.settings = {};
  delete S.settings.witness;
  sv('settings', S.settings);
  renderWitnessRow();
  toast('Witness mode off','i');
}

// ── ZAKAT ──────────────────────────────────────────────────────────────────
// Estimate zakat due on trading wealth. Pulls realized P&L from the user's
// own journal so the only numbers they have to provide are: hawl start date,
// current nisab value (today's spot), other qualifying wealth, and the
// current account balance.
//
// IMPORTANT: This is a planning aid, not a fatwa. Madhhab differences on
// day-trading capital, leverage, and futures are real. The UI calls this out.
function realizedPnLSince(isoDate){
  if(!isoDate) return 0;
  return (S.trades||[]).filter(function(t){
    return t.status==='closed' && t.date && t.date >= isoDate;
  }).reduce(function(sum,t){return sum + (t.pnl||0);}, 0);
}
// Approximate Hijri year length is 354 days. Returns YYYY-MM-DD of the date
// one hawl after the given ISO date, or '' if invalid.
function addHawl(isoDate){
  if(!isoDate) return '';
  var d = new Date(isoDate + 'T12:00:00');
  if(isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 354);
  return d.toISOString().slice(0,10);
}
function daysUntil(isoDate){
  if(!isoDate) return null;
  var t = new Date(isoDate + 'T12:00:00').getTime();
  if(isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000*60*60*24));
}
function calcZakat(){
  var rr = el('zakat-result'); if(!rr) return;
  var hawlStart = el('zk-hawl-start') ? el('zk-hawl-start').value : '';
  var basis     = el('zk-basis') ? el('zk-basis').value : 'silver';
  var nisab     = parseFloat(el('zk-nisab') ? el('zk-nisab').value : 0) || 0;
  var other     = parseFloat(el('zk-other') ? el('zk-other').value : 0) || 0;
  var balance   = parseFloat(el('zk-balance') ? el('zk-balance').value : 0) || 0;
  if(!hawlStart || !nisab){
    rr.innerHTML = '<div style="padding:14px 16px;background:rgba(218,180,98,0.04);border:1px dashed rgba(218,180,98,0.18);border-radius:10px;font-size:0.82rem;color:var(--ink-3);text-align:center;line-height:1.7;">Set your hawl start date and today\'s nisab value to begin.</div>';
    return;
  }
  var realized = realizedPnLSince(hawlStart);
  var total = other + balance; // your full zakatable wealth picture
  var aboveNisab = total >= nisab;
  var dueDate = addHawl(hawlStart);
  var daysToHawl = daysUntil(dueDate);
  var hawlComplete = daysToHawl !== null && daysToHawl <= 0;
  var zakatAmt = aboveNisab && hawlComplete ? total * 0.025 : 0;
  var status, statusColor, statusBody;
  if(!aboveNisab){
    status = 'BELOW NISAB';
    statusColor = 'var(--ink-3)';
    statusBody = 'Total zakatable wealth ($'+fmt(total)+') is below the '+basis+' nisab ($'+fmt(nisab)+'). No zakat is due. Update the nisab value as gold/silver prices move.';
  } else if(!hawlComplete){
    status = 'HAWL IN PROGRESS';
    statusColor = 'var(--gold)';
    statusBody = 'Your wealth is above nisab. Hawl completes on '+dueDate+' (~'+daysToHawl+' days). If you remain above nisab on that date, zakat will be due then.';
  } else {
    status = 'ZAKAT DUE';
    statusColor = 'var(--green)';
    statusBody = 'Your hawl completed on '+dueDate+'. At 2.5% of $'+fmt(total)+', your zakat due is the figure above. Verify with a scholar.';
  }
  rr.innerHTML =
    '<div style="margin-top:8px;background:linear-gradient(135deg,rgba(218,180,98,0.05),transparent);border:1px solid rgba(218,180,98,0.18);border-radius:14px;padding:22px 20px;">' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.54rem;letter-spacing:0.18em;color:'+statusColor+';margin-bottom:8px;">'+status+'</div>' +
      '<div style="font-family:\'Cormorant Garamond\',serif;font-size:2.2rem;font-weight:600;color:var(--ink);letter-spacing:-0.02em;">$'+fmt(zakatAmt)+'</div>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:0.12em;color:var(--ink-3);margin-top:4px;text-transform:uppercase;">Estimated zakat due</div>' +
      '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(218,180,98,0.1);font-size:0.78rem;color:var(--ink-2);line-height:1.7;">'+statusBody+'</div>' +
      '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-family:\'JetBrains Mono\',monospace;font-size:0.66rem;color:var(--ink-3);">' +
        '<div>Realized P&amp;L since hawl<br><strong style="color:'+(realized>=0?'var(--green)':'var(--red)')+';font-size:0.82rem;">'+fmt(realized,true)+'</strong></div>' +
        '<div>Total zakatable wealth<br><strong style="color:var(--ink);font-size:0.82rem;">$'+fmt(total)+'</strong></div>' +
      '</div>' +
    '</div>';
}
function renderZakat(){
  // Pre-fill the account balance with realized P&L if user hasn't entered one.
  var bal = el('zk-balance');
  if(bal && !bal.value){
    var lastClosedSum = (S.trades||[]).filter(function(t){return t.status==='closed';})
      .reduce(function(s,t){return s + (t.pnl||0);}, 0);
    if(lastClosedSum > 0) bal.placeholder = 'e.g. ' + Math.round(lastClosedSum);
  }
  calcZakat();
}

function calcRisk(){
  var acc=parseFloat(el('rc-account')?el('rc-account').value:0)||0;var riskPct=parseFloat(el('rc-risk-pct')?el('rc-risk-pct').value:1)||1;var entry=parseFloat(el('rc-entry')?el('rc-entry').value:0)||0;var stop=parseFloat(el('rc-stop')?el('rc-stop').value:0)||0;var type=el('rc-type')?el('rc-type').value:'MNQ';
  var rr=el('risk-result');if(!rr)return;if(!acc||!entry||!stop){rr.innerHTML='';return;}
  var riskAmt=acc*(riskPct/100);var pts=Math.abs(entry-stop);if(pts<0.001){rr.innerHTML='';return;}
  // Per-instrument $/point comes from the same TICK_VALUES table the trade
  // auto-calc uses — so ES is $50/pt, gold $100/pt, etc. (was hardcoded to
  // NQ's $20/$2 for ALL futures, which over-sized ES/GC positions 2.5–5x).
  var isFutures=!(type==='forex'||type==='stock');
  var ptVal=type==='forex'?10:type==='stock'?1:(TICK_VALUES[type]||1);
  var contracts=Math.floor(riskAmt/(pts*ptVal));var actualRisk=contracts*pts*ptVal;var target2=entry+(entry>stop?1:-1)*pts*2;
  rr.innerHTML='<div class="risk-result"><div class="risk-result-num">'+contracts+'</div><div class="risk-result-label">'+(isFutures?'CONTRACTS':type==='forex'?'LOTS':'SHARES')+'</div><div style="margin-top:16px;display:flex;gap:18px;justify-content:center;flex-wrap:wrap;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--ink-3);"><span>Risk: <strong style="color:var(--red);">'+fmt(actualRisk)+'</strong></span><span>2:1 Target: <strong style="color:var(--ink);">'+target2.toFixed(1)+'</strong></span><span>Pct: <strong style="color:var(--gold);">'+riskPct+'% of account</strong></span></div></div>';
}
function renderRisk(){calcRisk();}

// ── GOALS ─────────────────────────────────────────────────────────────────────
function saveGoal(){S.goal={desc:el('g-desc')?el('g-desc').value:'',target:parseFloat(el('g-target')?el('g-target').value:0)||0,deadline:el('g-dl')?el('g-dl').value:'',createdAt:new Date().toISOString()};sv('goal',S.goal);renderGoals();toast('\u2713 Goal saved','s');}
function saveChallenge(){S.challenge={firm:el('ch-firm')?el('ch-firm').value:'',target:parseFloat(el('ch-target')?el('ch-target').value:0)||0,dd:parseFloat(el('ch-dd')?el('ch-dd').value:0)||0,daily:parseFloat(el('ch-daily')?el('ch-daily').value:0)||0};sv('challenge',S.challenge);renderGoals();toast('\u2713 Challenge saved','s');}
function renderGoals(){
  var e=el('goal-display');if(!e)return;var h='';var closed=S.trades.filter(function(t){return t.status==='closed';});
  if(S.goal&&S.goal.target){var cp=closed.reduce(function(s,t){return s+t.pnl;},0),pct=Math.min(100,Math.max(0,cp/S.goal.target*100)),rem=Math.max(0,S.goal.target-cp);h+='<div class="goal-card"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">ACTIVE GOAL</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.35rem;font-weight:500;color:var(--ink);margin-bottom:7px;">'+esc(S.goal.desc||'Reach target')+'</div><div style="display:flex;gap:16px;font-size:0.82rem;color:var(--ink-3);margin-bottom:12px;flex-wrap:wrap;"><span>Target: <strong style="color:var(--ink);">$'+S.goal.target.toLocaleString()+'</strong></span><span>Current: <strong style="color:var(--ink);">'+fmt(cp,true)+'</strong></span></div><div class="prog-track"><div class="prog-fill" style="width:'+pct+'%;"></div></div><div style="display:flex;justify-content:space-between;font-family:\'JetBrains Mono\',monospace;font-size:0.64rem;color:var(--ink-3);margin-top:5px;"><span><strong style="color:var(--gold);">'+pct.toFixed(0)+'%</strong></span><span>'+fmt(rem)+' remaining</span></div></div>';}
  if(S.challenge&&S.challenge.firm){var ml=(S.challenge.daily*0.4).toFixed(0);h+='<div class="goal-card"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">CHALLENGE \u00b7 '+esc(String(S.challenge.firm).toUpperCase())+'</div><div style="display:flex;gap:16px;font-size:0.84rem;color:var(--ink-2);flex-wrap:wrap;line-height:2;"><span>Target: <strong style="color:var(--ink);">$'+S.challenge.target.toLocaleString()+'</strong></span><span>Max DD: <strong style="color:var(--red);">$'+S.challenge.dd.toLocaleString()+'</strong></span><span>My daily limit: <strong style="color:var(--gold);">$'+ml+'</strong></span></div></div>';}
  e.innerHTML=h;
  if(S.goal){var gd=el('g-desc');if(gd)gd.value=S.goal.desc||'';var gt=el('g-target');if(gt)gt.value=S.goal.target||'';var gdl=el('g-dl');if(gdl)gdl.value=S.goal.deadline||'';}
  if(S.challenge){['ch-firm','ch-target','ch-dd','ch-daily'].forEach(function(id,i){var keys=['firm','target','dd','daily'];var e=el(id);if(e)e.value=S.challenge[keys[i]]||'';});}
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function renderSettings(){
  var sn=el('s-name');if(sn&&S.settings.name)sn.value=S.settings.name;
  var user=AUTH.currentUser;
  if(user){
    var emailEl=el('s-email');if(emailEl)emailEl.textContent=S.accountCode?('Account code: '+S.accountCode):'';
    var dispEl=el('s-display-name');if(dispEl)dispEl.textContent=S.settings.name||S.accountCode||'Your Account';
    var avEl=el('s-avatar');if(avEl)avEl.textContent=(S.settings.name||'A').charAt(0).toUpperCase();
    // Show subscription status
    var subEl=el('s-sub-status');
    if(subEl){
      subEl.innerHTML='<span style="color:var(--green);">\u2713 Active</span> \u00b7 <strong>Free Demo \u2014 All Features</strong>';
    }
    // Show password change only for email/password users (not Google/OAuth)
    var isEmailUser=user.providerData&&user.providerData.some(function(p){return p.providerId==='password';});
    var pwSection=el('s-password-section');
    if(pwSection)pwSection.style.display=isEmailUser?'':'none';
  }
  renderPrayerLocRow();
  renderPushToggleRow();
  renderReferralRow();
  renderWitnessRow();
}
function changePassword(){
  var np=(el('s-new-pw')&&el('s-new-pw').value)||'';
  var cp=(el('s-conf-pw')&&el('s-conf-pw').value)||'';
  if(np.length<6){toast('Password must be at least 6 characters','e');return;}
  if(np!==cp){toast('Passwords do not match','e');return;}
  var user=AUTH.currentUser;
  if(!user){toast('Not signed in','e');return;}
  user.updatePassword(np).then(function(){
    toast('\u2713 Password updated','s');
    if(el('s-new-pw'))el('s-new-pw').value='';
    if(el('s-conf-pw'))el('s-conf-pw').value='';
  }).catch(function(e){
    if(e.code==='auth/requires-recent-login'){
      toast('For security, please sign out and sign back in before changing your password.','e');
    } else {
      toast(friendlyAuthError(e&&e.code),'e');
    }
  });
}

// ── PRAYER-LOCATION OPT-IN ────────────────────────────────────────────────
function renderPrayerLocRow(){
  var row = el('prayer-loc-row'); if(!row) return;
  var loc = S.settings && S.settings.prayerLoc;
  if(loc){
    row.innerHTML =
      '<div style="flex:1;font-size:0.82rem;color:var(--ink-2);"><strong style="color:var(--gold);">Enabled</strong> at <span style="font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;">'+loc.lat.toFixed(2)+', '+loc.lng.toFixed(2)+'</span> · '+(loc.city||'(no city set)')+'</div>' +
      '<button class="btn btn-outline btn-sm" data-hclick="h158">Re-detect</button>' +
      '<button class="btn btn-ghost btn-sm" data-hclick="h159">Disable</button>';
  } else {
    row.innerHTML =
      '<div style="flex:1;font-size:0.82rem;color:var(--ink-3);">Off. Enable to see prayer-time pills while you trade.</div>' +
      '<button class="btn btn-gold btn-sm" data-hclick="h158">Enable & use my location</button>';
  }
  var am = el('asr-madhab');
  if(am) am.value = (S.settings && S.settings.asrMadhab === 'hanafi') ? 'hanafi' : 'standard';
}
function setAsrMadhab(v){
  S.settings.asrMadhab = (v === 'hanafi') ? 'hanafi' : 'standard';
  sv('settings', S.settings);
  if(typeof renderPrayerPill === 'function'){ try{ renderPrayerPill(); }catch(e){} }
  toast('✓ Asr calculation updated','s');
}
function setPrayerLoc(){
  if(!navigator.geolocation){ toast('Geolocation not supported in this browser','e'); return; }
  toast('Requesting location…','i');
  navigator.geolocation.getCurrentPosition(function(pos){
    var coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, city: '' };
    if(!S.settings) S.settings = {};
    S.settings.prayerLoc = coords;
    sv('settings', S.settings);
    renderPrayerLocRow();
    toast('✓ Prayer location saved','s');
  }, function(err){
    toast('Could not get location: '+(err.message||'permission denied'),'e');
  }, { timeout: 8000, maximumAge: 0, enableHighAccuracy: false });
}
function clearPrayerLoc(){
  if(!S.settings) S.settings = {};
  delete S.settings.prayerLoc;
  sv('settings', S.settings);
  renderPrayerLocRow();
  toast('Prayer alerts disabled','i');
}

// ── WEB PUSH OPT-IN ───────────────────────────────────────────────────────
// Client side of the daily-nudge system. The server side
// (functions/dailyNudge.js) reads users with a push subscription stored
// here and sends scheduled notifications. We never push from the client.
//
// TODO(deploy): generate a VAPID key pair, set the public half in
// firebase functions:config:set push.vapid_public="..."
//                                  push.vapid_private="..."
// then update PUSH_VAPID_PUBLIC below with the same public key.
var PUSH_VAPID_PUBLIC = ''; // TODO(deploy): paste public VAPID key here

function _urlBase64ToUint8Array(b64){
  var padding = '='.repeat((4 - b64.length % 4) % 4);
  var base64 = (b64 + padding).replace(/-/g,'+').replace(/_/g,'/');
  var raw = atob(base64);
  var out = new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++) out[i] = raw.charCodeAt(i);
  return out;
}
function renderPushToggleRow(){
  var row = el('push-toggle-row'); if(!row) return;
  if(!PUSH_VAPID_PUBLIC){
    row.innerHTML = '<div style="font-size:0.74rem;color:var(--ink-4);line-height:1.55;">Sahib\'s daily nudge — <em>rolling out.</em> A once-a-day push with your focus, plus streak-at-risk and post-loss reflection. Being switched on shortly.</div>';
    return;
  }
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    row.innerHTML = '<div style="font-size:0.74rem;color:var(--ink-4);">Push notifications are not supported in this browser.</div>';
    return;
  }
  var enabled = !!(S.settings && S.settings.pushSubscription);
  row.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
      '<div style="flex:1;font-size:0.82rem;color:'+(enabled?'var(--ink-2)':'var(--ink-3)')+';"><strong style="color:'+(enabled?'var(--gold)':'var(--ink-3)')+';">Sahib\'s daily nudge</strong> — one push a day: your focus for the day, plus streak-at-risk and post-loss reflection.</div>' +
      '<button class="btn btn-'+(enabled?'outline':'gold')+' btn-sm" data-hclick="hTogglePush">'+(enabled?'Disable':'Enable')+'</button>' +
    '</div>';
}
function enablePush(){
  if(!PUSH_VAPID_PUBLIC){
    toast('Server VAPID key not configured yet — your sub will save once it is','i');
  }
  if(Notification.permission === 'denied'){
    toast('Browser notifications are blocked — unblock in site settings first','e');
    return;
  }
  navigator.serviceWorker.ready.then(function(reg){
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: PUSH_VAPID_PUBLIC ? _urlBase64ToUint8Array(PUSH_VAPID_PUBLIC) : undefined
    });
  }).then(function(sub){
    if(!S.settings) S.settings = {};
    S.settings.pushSubscription = sub.toJSON();
    sv('settings', S.settings);
    renderPushToggleRow();
    toast('✓ Daily nudge enabled','s');
  }).catch(function(err){
    toast('Could not enable push: '+(err.message||'unknown'),'e');
  });
}
function disablePush(){
  navigator.serviceWorker.ready.then(function(reg){
    return reg.pushManager.getSubscription();
  }).then(function(sub){
    if(sub) return sub.unsubscribe();
  }).then(function(){
    if(!S.settings) S.settings = {};
    delete S.settings.pushSubscription;
    sv('settings', S.settings);
    renderPushToggleRow();
    toast('Push disabled','i');
  }).catch(function(){ /* best-effort */ });
}

// ── REFERRAL ──────────────────────────────────────────────────────────────
// Generates a short code on demand, stores it on the user doc, and gives
// the user a copyable share URL. The server-side credit logic lives in
// functions/redeemReferral.js and is deployed separately.
function genReferralCode(){
  // 6-char A-Z0-9, easy to type and read.
  var alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = ''; for(var i=0;i<6;i++) s += alpha[Math.floor(Math.random()*alpha.length)];
  return s;
}
function renderReferralRow(){
  var row = el('referral-row'); if(!row) return;
  if(!S.settings) S.settings = {};
  if(!S.settings.referralCode){
    S.settings.referralCode = genReferralCode();
    sv('settings', S.settings);
  }
  var code = S.settings.referralCode;
  var url = window.location.origin + '/?ref=' + code;
  row.innerHTML =
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--surface-2);border:1px solid var(--line-2);border-radius:10px;padding:12px 14px;">' +
      '<div style="flex:1;min-width:200px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;letter-spacing:0.16em;color:var(--gold);text-transform:uppercase;margin-bottom:5px;">YOUR REFERRAL LINK</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;color:var(--ink);word-break:break-all;line-height:1.5;">'+esc(url)+'</div></div>' +
      '<button class="btn btn-gold btn-sm" data-hclick="h160">Copy link</button>' +
    '</div>';
}
function copyReferralLink(){
  var code = (S.settings && S.settings.referralCode) || '';
  if(!code) return;
  var url = window.location.origin + '/?ref=' + code;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){ toast('✓ Link copied','s'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast('✓ Link copied','s'); }catch(e){}
    document.body.removeChild(ta);
  }
}
// Capture ?ref= on page load and stash for the signup flow to read.
(function captureReferral(){
  try{
    var m = (window.location.search || '').match(/[?&]ref=([A-Z0-9]{4,12})/i);
    if(m){
      window._pendingReferral = m[1].toUpperCase();
      // Persist across reloads in case user signs up later.
      try{ sessionStorage.setItem('niyyah_ref', window._pendingReferral); }catch(_){}
    } else {
      try{
        var saved = sessionStorage.getItem('niyyah_ref');
        if(saved) window._pendingReferral = saved;
      }catch(_){}
    }
  }catch(_){}
})();
function saveSettings(){var sn=el('s-name');S.settings.name=sn?sn.value:'';sv('settings',S.settings);if(S.settings.name){setText('sf-av',S.settings.name[0].toUpperCase());setText('sf-name',S.settings.name);}toast('\u2713 Saved','s');}
function confirmResetAll(){
  confirmModal({
    title:'Reset all your data?',
    text:'This permanently deletes every trade, journal, prayer record, and playbook setup. Your account stays — you can sign back in and start fresh.',
    okText:'Reset everything',
    cancelText:'Cancel',
    danger:true,
    requireText:'RESET',
    icon:'⚠'
  }).then(function(ok){if(ok)resetAll();});
}
function resetAll(){
  if(!UID)return;
  // Selectively delete user-generated data while preserving billing fields
  // (stripeCustomerId, subscription) so the user isn't locked out of the
  // app after resetting. The Admin SDK webhook will keep these in sync.
  var DELETABLE=['trades','journals','morning','challenge','goal','settings',
                 'dailyPrayers','playbook','nafs','dhikr','openTradeId',
                 'streakStart','referredBy','lastNudgeAt','onboardingDone'];
  var patch={};
  DELETABLE.forEach(function(k){patch[k]=firebase.firestore.FieldValue.delete();});
  DB.collection('users').doc(UID).update(patch)
    .then(function(){location.reload();})
    .catch(function(){toast('Could not reset — check your connection','e');});
}

// GDPR-compliant: deletes Firestore data AND Firebase Auth user
function deleteAccount(){
  confirmModal({
    title:'Delete your account forever?',
    text:'Your Niyyah account and ALL data (trades, journals, prayer history) will be permanently deleted. This cannot be undone.',
    okText:'Delete forever',
    cancelText:'Keep my account',
    danger:true,
    requireText:'DELETE',
    icon:'⚠'
  }).then(function(ok){
    if(!ok)return;
    var user = AUTH.currentUser;
    if(!user){toast('Not signed in','e');return;}
    var uid = UID;
    // Delete the AUTH account FIRST. It's the operation that can fail with
    // requires-recent-login — and if it does, we must NOT have already wiped
    // the user's data (and recoveryHash). Only once auth deletion succeeds do
    // we remove the Firestore doc.
    user.delete()
      .then(function(){ return DB.collection('users').doc(uid).delete().catch(function(){}); })
      .then(function(){
        toast('✓ Account deleted','s');
        setTimeout(function(){location.reload();},900);
      })
      .catch(function(e){
        if(e && e.code === 'auth/requires-recent-login'){
          toast('For security, sign out and back in, then try again','e');
        } else {
          toast('Could not delete account — try again','e');
        }
      });
  });
}
function exportData(){var d={trades:S.trades,journals:S.journals,morning:S.morning,challenge:S.challenge,goal:S.goal,settings:S.settings,dailyPrayers:S.dailyPrayers,playbook:S.playbook,nafs:S.nafs,dhikr:S.dhikr,exportedAt:new Date().toISOString()};var b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='niyyah-'+localDate()+'.json';a.click();URL.revokeObjectURL(u);toast('\u2713 Exported','s');}

function exportCSV(){
  if(!S.trades.length){toast('No trades to export','e');return;}
  var cols=['date','time','instrument','direction','setup','status','entryPrice','stopPrice','targetPrice','exitPrice','pnl','emotion','exitEmotion','quality','lesson'];
  var csvEsc=function(v){var s=String(v==null?'':v);return s.indexOf(',')>-1||s.indexOf('"')>-1||s.indexOf('\n')>-1?'"'+s.replace(/"/g,'""')+'"':s;};
  var rows=[cols.join(',')];
  S.trades.forEach(function(t){rows.push(cols.map(function(c){return csvEsc(t[c]);}).join(','));});
  var b=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
  var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='niyyah-trades-'+localDate()+'.csv';a.click();URL.revokeObjectURL(u);
  toast('✓ Exported '+S.trades.length+' trades as CSV','s');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
// initScrollReveal replaced by initReveal below

// ── FRIDAY MUHASABAH ENGINE ─────────────────────────────────────────────────
function runFridayMuhasabah(){
  var e=el('friday-wrap');
  if(!e){e=el('muhasabah-wrap');}
  if(!e)return;

  // Show on Friday afternoon through Saturday evening (catch-up window)
  var day=new Date().getDay();
  var hour=new Date().getHours();
  var isFridayEvening=(day===5&&hour>=14);
  var isSaturdayReview=(day===6&&hour<20);
  if(!isFridayEvening&&!isSaturdayReview){
    var fw=el('friday-wrap');if(fw){
      // Render a quiet teaser so the user anticipates Friday muhasabah.
      // Only shown to users with at least one trade so it doesn't crowd day 1.
      var closedTeaser=S.trades.filter(function(t){return t.status==='closed';}).length;
      if(closedTeaser>=1){
        // Days until next Friday at 14:00. day 5 before 14:00 → today.
        var daysToFri = (5-day+7)%7;
        if(day===5&&hour<14) daysToFri=0;
        var nextLabel = daysToFri===0 ? 'Today' : daysToFri===1 ? 'Tomorrow' : 'In '+daysToFri+' days';
        // Count this-week trades for the teaser
        var now=new Date();
        var monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));monday.setHours(0,0,0,0);
        var mondayTs=monday.getTime();
        var weekT=S.trades.filter(function(t){return t.status==='closed'&&new Date(t.date+'T12:00:00').getTime()>=mondayTs;});
        fw.innerHTML='<div style="background:linear-gradient(160deg,#1a1810 0%,#0e0c08 100%);border:1px solid rgba(218,180,98,0.15);border-radius:var(--r-lg);padding:16px 20px;margin-bottom:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;"><div style="width:38px;height:38px;border-radius:9px;background:rgba(218,180,98,0.08);border:1px solid rgba(218,180,98,0.22);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1rem;flex-shrink:0;">☽</div><div style="flex:1;min-width:160px;"><div style="font-family:\'JetBrains Mono\',monospace;font-size:0.5rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:3px;">FRIDAY MUHASABAH · '+nextLabel.toUpperCase()+'</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:0.98rem;color:var(--ink);line-height:1.4;">'+weekT.length+' trade'+(weekT.length===1?'':'s')+' logged this week. The mirror needs data to reflect.</div></div></div>';
      } else {
        fw.innerHTML='';
      }
    }
    return;
  }

  // Get this week's trades (Mon-Sun)
  var now=new Date();
  var monday=new Date(now);
  monday.setDate(now.getDate()-((now.getDay()+6)%7));
  monday.setHours(0,0,0,0);
  var mondayTs=monday.getTime();

  var closed=S.trades.filter(function(t){return t.status==='closed';});
  var weekTrades=closed.filter(function(t){
    return new Date(t.date+'T12:00:00').getTime()>=mondayTs;
  });

  if(weekTrades.length<2){
    var fw=el('friday-wrap');if(fw)fw.innerHTML='';
    return;
  }

  var fw=el('friday-wrap');if(!fw)return;

  // ── WEEK STATS ──────────────────────────────────────────────────────────
  var weekWins=weekTrades.filter(function(t){return t.pnl>0;});
  var weekPnl=weekTrades.reduce(function(s,t){return s+t.pnl;},0);
  var weekWR=Math.round(weekWins.length/weekTrades.length*100);
  var avgQ=weekTrades.length?Math.round(weekTrades.reduce(function(s,t){return s+(t.quality||0);},0)/weekTrades.length):0;

  // Prayer consistency this week
  var weekPrayerDays=0,weekFullDays=0;
  for(var i=0;i<7;i++){
    var d=new Date(monday);d.setDate(monday.getDate()+i);
    var dk=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    if(S.dailyPrayers[dk]){
      weekPrayerDays++;
      if(Object.values(S.dailyPrayers[dk]).every(Boolean))weekFullDays++;
    }
  }

  // ── TRUTH (hard pattern of the week) ────────────────────────────────────
  var truth=null;
  var revW=weekTrades.filter(function(t){return t.emotion==='revenge';});
  var brokeW=weekTrades.filter(function(t){return t.outcome&&t.outcome.indexOf('broke')>-1;});
  var contW=weekTrades.filter(function(t){
    return ['calm','patient','focused'].includes(t.emotion||'')&&
           ['revenge','frustrated','regret'].includes(t.exitEmotion||'');
  });

  if(revW.length>=2){
    var revP=revW.reduce(function(s,t){return s+t.pnl;},0);
    truth='You took <strong>'+revW.length+' revenge trades</strong> this week. Combined result: <strong>'+(revP>=0?'+':'')+fmt(Math.abs(revP))+'</strong>. The nafs revenge cycle is not random — it has a trigger. Find it in your journal this week.';
  } else if(contW.length>=2){
    truth='On <strong>'+contW.length+' occasions</strong> this week you entered calm and exited in distress. This gap between presentation and feeling is where discipline breaks. Your gate answers and your trading behavior are telling different stories.';
  } else if(brokeW.length>=2){
    var bPnl=brokeW.reduce(function(s,t){return s+t.pnl;},0);
    truth='<strong>'+brokeW.length+' rule breaks</strong> this week. Cost: <strong>'+(bPnl>=0?'+':'')+fmt(Math.abs(bPnl))+'</strong>. Each one started as an exception you made for yourself. The blueprint exists to protect you from yourself.';
  } else {
    truth='You traded '+weekTrades.length+' times this week with a '+weekWR+'% win rate. The numbers are not the story — the story is in <em>how</em> you traded. Review your gate answers for any trade you are not fully proud of.';
  }

  // ── STRENGTH (what genuinely worked) ─────────────────────────────────
  var strength=null;
  var calmW=weekTrades.filter(function(t){return['calm','patient','focused'].includes(t.emotion||'');});
  var emotW=weekTrades.filter(function(t){return['fomo','revenge','urgency','overconf'].includes(t.emotion||'');});
  if(calmW.length>=3&&emotW.length>=1){
    var cwWR=Math.round(calmW.filter(function(t){return t.pnl>0;}).length/calmW.length*100);
    var ewWR=Math.round(emotW.filter(function(t){return t.pnl>0;}).length/emotW.length*100);
    if(cwWR>ewWR+10){
      strength='Calm entries: <strong>'+cwWR+'%</strong> win rate this week vs <strong>'+ewWR+'%</strong> emotional. The deen is correct — stillness produces clarity. This is not a coincidence.';
    }
  }
  if(!strength&&weekFullDays>=3){
    strength='<strong>'+weekFullDays+' full salah days</strong> this week. That structure does not stay in the masjid — it shows up in your execution. Keep building it.';
  }
  if(!strength&&avgQ>=70){
    strength='Average trade quality this week: <strong>'+avgQ+'/100</strong>. When you follow the process, the process protects you. This is what discipline looks like in the data.';
  }
  if(!strength){
    strength='You showed up and traded this week. Review each trade honestly — not to judge, but to understand the state you were in. That awareness is the work.';
  }

  // ── FOCUS FOR NEXT WEEK ───────────────────────────────────────────────
  var focus=null;
  if(revW.length>=2){focus='Next week: identify the trade that precedes your revenge sequence. That trade is the real problem — not the ones after it.';}
  else if(brokeW.length>=2){focus='Next week: before any deviation from your plan, pause for 10 seconds and ask: would I log this honestly? If the answer is no — do not take it.';}
  else if(weekFullDays<3){focus='Next week: pray before opening your charts. Not as superstition — as structure. Test whether it changes your first-trade quality.';}
  else{focus='Next week: one setup, one execution style, full accountability. Breadth is not your edge. Depth is.';}

  // ── INTENTION ─────────────────────────────────────────────────────────
  var intentions=['Enter next week with one clear intention. Write it in your journal tonight.',
    'Rest this weekend. The market will be there Monday. You cannot trade well tired.',
    'Your niyyah next week: trade fewer, better. Quality over frequency.',
    'Make your intention for next week specific enough that you can measure it at the next Friday Muhasabah.'];
  var niyyahText=intentions[new Date().getDate()%intentions.length];

  // ── BUILD UI ───────────────────────────────────────────────────────────
  var html='<div class="friday-wrap">';
  html+='<div class="friday-eye"><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);animation:pulse 2.5s ease-in-out infinite;display:inline-block;"></span>FRIDAY MUHASABAH · WEEKLY REFLECTION</div>';
  html+='<div class="friday-title">This week, <em>honestly</em>.</div>';
  html+='<div class="friday-stat-row">';
  html+='<div class="friday-stat"><div class="friday-stat-num">'+(weekPnl>=0?'+':'')+fmt(Math.abs(weekPnl))+'</div><div class="friday-stat-label">Net P&L</div></div>';
  html+='<div class="friday-stat"><div class="friday-stat-num">'+weekWR+'%</div><div class="friday-stat-label">Win Rate</div></div>';
  html+='<div class="friday-stat"><div class="friday-stat-num">'+avgQ+'</div><div class="friday-stat-label">Avg Quality</div></div>';
  html+='<div class="friday-stat"><div class="friday-stat-num">'+weekFullDays+'/5</div><div class="friday-stat-label">Full Salah Days</div></div>';
  html+='</div>';
  html+='<div class="friday-section truth"><div class="friday-section-label">The truth of this week</div><div class="friday-section-text">'+truth+'</div></div>';
  html+='<div class="friday-section strength"><div class="friday-section-label">What is working</div><div class="friday-section-text">'+strength+'</div></div>';
  html+='<div class="friday-section focus"><div class="friday-section-label">Focus for next week</div><div class="friday-section-text">'+focus+'</div></div>';
  html+='<div class="friday-niyyah"><strong>Your niyyah:</strong> '+niyyahText+'</div>';
  html+='<div style="margin-top:18px;display:flex;justify-content:flex-end;"><button class="btn btn-outline btn-sm" data-hclick="h161">↗ Share this week</button></div>';
  html+='</div>';

  fw.innerHTML=html;
}

// ── SHARE MUHASABAH AS IMAGE ──────────────────────────────────────────────
// Builds a 1080×1350 IG-portrait card from the live muhasabah data and
// triggers a download. Uses html-to-image loaded on demand (only when the
// user clicks the share button) so landing-page visitors pay zero cost.
function shareMuhasabah(){
  var src = document.querySelector('.friday-wrap');
  if(!src){ toast('No muhasabah card on screen','e'); return; }
  toast('Rendering image…','i');
  var ensureLib = window.htmlToImage
    ? Promise.resolve(window.htmlToImage)
    : new Promise(function(resolve, reject){
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
        s.onload = function(){ resolve(window.htmlToImage); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
  ensureLib.then(function(lib){
    // Build a poster-sized clone so the screenshot looks good on IG / X.
    var poster = document.createElement('div');
    poster.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;padding:80px 70px;background:linear-gradient(160deg,#1e1b12 0%,#0a0906 100%);color:#f2ead6;font-family:Inter,sans-serif;';
    poster.innerHTML =
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.9rem;letter-spacing:0.3em;color:#dab462;text-transform:uppercase;margin-bottom:18px;">☽ Niyyah · Friday Muhasabah</div>' +
      src.innerHTML.replace(/\s*data-h[a-z]+="[^"]*"/g, '') +
      '<div style="margin-top:42px;padding-top:22px;border-top:1px solid rgba(218,180,98,0.18);font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;color:#8a7e67;letter-spacing:0.18em;text-transform:uppercase;text-align:center;">niyyahtrader.com · trade with intention</div>';
    document.body.appendChild(poster);
    return lib.toPng(poster, { pixelRatio: 1, width: 1080, height: 1350 }).then(function(dataUrl){
      document.body.removeChild(poster);
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'niyyah-muhasabah-' + localDate() + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('✓ Saved muhasabah-' + localDate() + '.png','s');
    });
  }).catch(function(err){
    toast('Could not render image: '+(err && err.message || 'load failed'),'e');
  });
}

// ── MUHASABAH ENGINE ────────────────────────────────────────────────────────
// Generates nightly behavioral mirror — compares what trader said vs what they did
function runMuhasabah(){
  var closed=S.trades.filter(function(t){return t.status==='closed';});
  var e=el('muhasabah-wrap');
  if(!e)return;

  // Need at least 3 closed trades for meaningful insights
  if(closed.length<3){
    e.innerHTML='';
    return;
  }

  // Only show if there are trades today or in last 2 days
  var today=localDate();
  var yest=new Date();yest.setDate(yest.getDate()-1);
  var yd=yest.getFullYear()+'-'+pad(yest.getMonth()+1)+'-'+pad(yest.getDate());
  var recentTrades=closed.filter(function(t){return t.date===today||t.date===yd;});
  if(!recentTrades.length){e.innerHTML='';return;}

  var insights={warn:null,good:null,neutral:null,tomorrow:''};
  var last7=closed.filter(function(t){
    return (Date.now()-new Date(t.date+'T12:00:00').getTime())<604800000;
  });
  var last14=closed.filter(function(t){
    return (Date.now()-new Date(t.date+'T12:00:00').getTime())<1209600000;
  });

  // ── WARNING: Contradiction detection ──────────────────────────────────
  // Calm entry + bad exit = self-deception
  var contradictions=recentTrades.filter(function(t){
    return ['calm','patient','focused'].includes(t.emotion||'')&&
           ['revenge','frustrated','regret'].includes(t.exitEmotion||'');
  });
  if(contradictions.length>0){
    var inst=contradictions[0].instrument;
    var pnlResult=contradictions[0].pnl>=0?'won':'lost';
    insights.warn='You entered the '+inst+' trade marking yourself as calm. You exited '+contradictions[0].exitEmotion+'. You '+pnlResult+' <strong>'+fmt(Math.abs(contradictions[0].pnl))+'</strong>. Watch for the gap between how you present and how you actually feel.';
  }

  // ── WARNING: Revenge sequence ──────────────────────────────────────────
  if(!insights.warn){
    var revengeTrades=last7.filter(function(t){return t.emotion==='revenge';});
    if(revengeTrades.length>=2){
      var revWR=Math.round(revengeTrades.filter(function(t){return t.pnl>0;}).length/revengeTrades.length*100);
      var revPnl=revengeTrades.reduce(function(s,t){return s+t.pnl;},0);
      insights.warn='<strong>'+revengeTrades.length+' revenge trades</strong> in the last 7 days. Win rate: <strong>'+revWR+'%</strong>. Total result: <strong>'+(revPnl>=0?'+':'')+fmt(Math.abs(revPnl))+'</strong>. The nafs revenge cycle is costing you. Identify the trigger trade — it starts there.';
    }
  }

  // ── WARNING: Rule breaks after wins ───────────────────────────────────
  if(!insights.warn&&last7.length>=3){
    var postWinBreaks=[];
    for(var i=0;i<last7.length-1;i++){
      if(last7[i+1].pnl>0&&last7[i].outcome&&last7[i].outcome.indexOf('broke')>-1){
        postWinBreaks.push(last7[i]);
      }
    }
    if(postWinBreaks.length>=2){
      insights.warn='You broke rules on <strong>'+postWinBreaks.length+' trades</strong> that followed a win this week. This is Kibr operating silently — confidence inflating your risk tolerance. After a win, lower your size, not raise it.';
    }
  }

  // ── GOOD: Calm edge confirmed ──────────────────────────────────────────
  if(last7.length>=4){
    var calmTrades=last7.filter(function(t){return['calm','patient','focused'].includes(t.emotion||'');});
    var emotTrades=last7.filter(function(t){return['fomo','revenge','urgency','overconf','anxious'].includes(t.emotion||'');});
    if(calmTrades.length>=3&&emotTrades.length>=2){
      var calmWR=Math.round(calmTrades.filter(function(t){return t.pnl>0;}).length/calmTrades.length*100);
      var emotWR=Math.round(emotTrades.filter(function(t){return t.pnl>0;}).length/emotTrades.length*100);
      if(calmWR>emotWR+15){
        insights.good='Calm entries this week: <strong>'+calmWR+'%</strong> win rate. Emotional entries: <strong>'+emotWR+'%</strong>. Your data confirms what the deen already tells you. Stillness is your edge.';
      }
    }
  }

  // ── GOOD: Prayer consistency rewarded ─────────────────────────────────
  if(!insights.good&&closed.length>=8){
    var pDays=Object.keys(S.dailyPrayers);
    var fullPD=pDays.filter(function(d){return Object.values(S.dailyPrayers[d]).every(Boolean);});
    var partPD=pDays.filter(function(d){return!Object.values(S.dailyPrayers[d]).every(Boolean);});
    var fpT=last14.filter(function(t){return fullPD.indexOf(t.date)>-1;});
    var ppT=last14.filter(function(t){return partPD.indexOf(t.date)>-1;});
    if(fpT.length>=3&&ppT.length>=3){
      var fpWR=Math.round(fpT.filter(function(t){return t.pnl>0;}).length/fpT.length*100);
      var ppWR=Math.round(ppT.filter(function(t){return t.pnl>0;}).length/ppT.length*100);
      if(fpWR>ppWR+12){
        insights.good='Full salah days: <strong>'+fpWR+'%</strong> win rate vs <strong>'+ppWR+'%</strong> on partial days. Not coincidence. The same discipline that keeps your prayers keeps your rules.';
      }
    }
  }

  // ── GOOD: Quality score trending up ───────────────────────────────────
  if(!insights.good&&closed.length>=6){
    var recent3=closed.slice(0,3);var prior3=closed.slice(3,6);
    var rAvg=recent3.reduce(function(s,t){return s+(t.quality||0);},0)/3;
    var pAvg=prior3.reduce(function(s,t){return s+(t.quality||0);},0)/3;
    if(rAvg>pAvg+10){
      insights.good='Your trade quality score is trending up. Last 3 trades averaged <strong>'+Math.round(rAvg)+'/100</strong> vs <strong>'+Math.round(pAvg)+'/100</strong> before. Discipline is compounding.';
    }
  }

  // ── NEUTRAL: Setup performance ─────────────────────────────────────────
  if(last7.length>=3){
    var setupMap={};
    last7.forEach(function(t){
      if(t.setup){
        if(!setupMap[t.setup])setupMap[t.setup]={n:0,w:0,pnl:0};
        setupMap[t.setup].n++;
        if(t.pnl>0)setupMap[t.setup].w++;
        setupMap[t.setup].pnl+=t.pnl;
      }
    });
    var setups=Object.keys(setupMap).filter(function(k){return setupMap[k].n>=2;});
    if(setups.length>0){
      var best=setups.reduce(function(a,b){return setupMap[a].pnl>setupMap[b].pnl?a:b;});
      var worst=setups.reduce(function(a,b){return setupMap[a].pnl<setupMap[b].pnl?a:b;});
      if(setups.length>1&&best!==worst){
        var bWR=Math.round(setupMap[best].w/setupMap[best].n*100);
        insights.neutral='This week: <strong>'+best+'</strong> is your edge ('+bWR+'% win rate, '+fmt(setupMap[best].pnl,true)+'). <strong>'+worst+'</strong> is costing you ('+fmt(setupMap[worst].pnl,true)+'). The data is telling you where to focus.';
      }
    }
  }

  // ── TOMORROW'S INTENTION ──────────────────────────────────────────────
  var intentions=[];
  if(insights.warn&&insights.warn.indexOf('revenge')>-1)intentions.push('Stop before the second trade. Always.');
  else if(insights.warn&&insights.warn.indexOf('Kibr')>-1)intentions.push('After a win, same size. No exceptions.');
  else if(insights.warn&&insights.warn.indexOf('gap')>-1)intentions.push('Check your emotional state honestly before the gate.');
  else if(insights.good&&insights.good.indexOf('salah')>-1||insights.good&&insights.good.indexOf('Salah')>-1||insights.good&&insights.good.indexOf('prayer')>-1)intentions.push('Pray Fajr before opening any chart tomorrow.');
  else intentions.push('One trade. Full setup. Full gate. Trust the process.');
  insights.tomorrow=intentions[0];

  // ── BUILD THE UI ───────────────────────────────────────────────────────
  var html='<div class="muhasabah-card">';
  html+='<div class="muh-eye">TONIGHT’S MUHASABAH</div>';
  html+='<div class="muh-title">What your <em>nafs</em> did today.</div>';

  if(insights.warn){
    html+='<div class="muh-section warn"><div class="muh-section-label">Where discipline slipped</div><div class="muh-text">'+insights.warn+'</div></div>';
  }
  if(insights.good){
    html+='<div class="muh-section good"><div class="muh-section-label">What is working</div><div class="muh-text">'+insights.good+'</div></div>';
  }
  if(insights.neutral){
    html+='<div class="muh-section neutral"><div class="muh-section-label">Your data this week</div><div class="muh-text">'+insights.neutral+'</div></div>';
  }

  if(!insights.warn&&!insights.good&&!insights.neutral){
    html+='<div class="muh-section neutral"><div class="muh-section-label">Reflection</div><div class="muh-text">Keep logging. The patterns will reveal themselves. Every trade entry is a data point about your nafs, not just your P&L.</div></div>';
  }

  html+='<div class="muh-intention">';
  html+='<div class="muh-intention-label">Tomorrow’s Intention</div>';
  html+='<div class="muh-intention-text">'+insights.tomorrow+'</div>';
  html+='</div>';
  html+='</div>';

  e.innerHTML=html;
  // Show nav dot to signal there's a reflection waiting
  var dot=el('nav-muh-dot');if(dot)dot.style.display='';
}

// ════════════════════════════════════════════════════════════════════════
// RETENTION SYSTEM
// ════════════════════════════════════════════════════════════════════════
// Everything below exists to close week-2 drop-off. Three pillars:
//   1. In-app emotional triggers (daily mission, streak risk, habit chain)
//   2. Local browser notifications (Friday muhasabah, streak guard,
//      post-loss cooldown) — fire while the app is open in a tab.
//   3. Data scaffolding (notifPrefs, notifState, lastSessionAt) so a
//      Cloud Function can later send actual email/push without a single
//      client-side change. The user doc fields below are the contract.
// ────────────────────────────────────────────────────────────────────────

// Default notification preferences. Stored under S.notifPrefs and
// persisted to Firestore so they sync across devices.
var DEFAULT_NOTIF_PREFS = {
  sahibDailyBrief: true,   // 08:30 local — Sahib's daily focus, when a commitment is active
  fridayMuhasabah: true,   // Friday at 16:00 local
  streakGuard:     true,   // 21:00 local if streak ≥3 and today is empty
  lossCooldown:    true,   // Next day 08:00 after a big-loss day
  marketOpen:      false,  // 09:25 ET — opt-in, off by default
  weekKickoff:     false,  // Sunday 19:00 local
  emailDigest:     false   // Future: backend-sent weekly email
};

function notifPrefs(){
  return Object.assign({}, DEFAULT_NOTIF_PREFS, S.notifPrefs||{});
}
function setNotifPref(k,v){
  S.notifPrefs = Object.assign({}, notifPrefs(), pairs(k,v));
  sv('notifPrefs', S.notifPrefs);
}
function pairs(k,v){var o={};o[k]=v;return o;}

// Permission state — 'default' | 'granted' | 'denied' | 'unsupported'
function notifPermission(){
  if(typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// Request permission. Always called from a user gesture to satisfy
// browser autoplay-style restrictions on Notification.requestPermission.
function requestNotifPermission(){
  if(typeof Notification === 'undefined'){
    toast('Notifications not supported in this browser','e');
    return Promise.resolve('unsupported');
  }
  return Notification.requestPermission().then(function(p){
    S.notifAskedAt = new Date().toISOString();
    sv('notifAskedAt', S.notifAskedAt);
    if(p === 'granted'){
      toast('✓ Reminders on. We’ll ping you for Friday muhasabah and streak guard.', 's');
      fireNotif('Reminders enabled', 'Niyyah will quietly hold you to your loop. Bismillah.', '/');
      tickNotifScheduler();
      renderNotifPrompt();
    } else if(p === 'denied'){
      toast('Reminders blocked. You can enable in your browser settings.', 'e');
      renderNotifPrompt();
    }
    return p;
  });
}

// Fire a notification right now (uses SW registration if available so
// notifications survive a quick tab close on Android/desktop). Returns
// true if delivered.
function fireNotif(title, body, url){
  if(notifPermission() !== 'granted') return false;
  try{
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(reg){
        reg.showNotification(title, {
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'niyyah-' + (title || '').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,24),
          renotify: false,
          data: { url: url || '/' }
        }).catch(function(){});
      });
    } else {
      // Fallback: plain Notification (no click routing)
      new Notification(title, { body: body });
    }
    return true;
  } catch(e){ return false; }
}

// Compute the next firing time (Date) for each enabled reminder type.
// Returns null if the reminder shouldn't fire (already happened today,
// disabled, etc). All times are user-local.
function nextFireTime(type){
  var now = new Date();
  var prefs = notifPrefs();
  var state = S.notifState || {};
  var todayKey = localDate();
  switch(type){
    case 'sahibDailyBrief': {
      if(!prefs.sahibDailyBrief) return null;
      // Only nudge when there's an active commitment to hold to.
      if(!(S.sahib && S.sahib.commitment)) return null;
      var sd = new Date(); sd.setHours(8,30,0,0);
      if(sd <= now) return null;                     // morning already passed
      if(state.sahibDailyBriefDate === todayKey) return null;
      return sd;
    }
    case 'fridayMuhasabah': {
      if(!prefs.fridayMuhasabah) return null;
      // Next Friday at 16:00 local. If today is Friday and it's after 16:00,
      // skip to next Friday so we don't fire twice.
      var d = new Date();
      var daysUntilFri = (5 - d.getDay() + 7) % 7;
      if(daysUntilFri === 0 && d.getHours() >= 16) daysUntilFri = 7;
      d.setDate(d.getDate() + daysUntilFri);
      d.setHours(16,0,0,0);
      // Suppress if already fired today
      if(state.fridayMuhasabahDate === localDate(d)) return null;
      return d;
    }
    case 'streakGuard': {
      if(!prefs.streakGuard) return null;
      var streak = (typeof calcStreak === 'function') ? calcStreak() : 0;
      if(streak < 3) return null;
      // Already did something today? skip.
      var trades = S.trades.filter(function(t){return t.date===todayKey;});
      var prayers = (S.dailyPrayers||{})[todayKey] || {};
      var prayed = Object.values(prayers).filter(Boolean).length;
      if(trades.length > 0 || prayed > 0) return null;
      // Tonight at 21:00
      var t = new Date();
      t.setHours(21,0,0,0);
      if(t <= now) return null; // already past
      if(state.streakGuardDate === todayKey) return null;
      return t;
    }
    case 'lossCooldown': {
      if(!prefs.lossCooldown) return null;
      // Was yesterday a big-loss day? Schedule tomorrow morning.
      var yest = new Date(); yest.setDate(yest.getDate() - 1);
      var yKey = localDate(yest);
      var yClosed = S.trades.filter(function(t){return t.date===yKey && t.status==='closed';});
      if(!yClosed.length) return null;
      var yPnl = yClosed.reduce(function(s,t){return s+(t.pnl||0);},0);
      // Threshold: any day in the bottom 25% of loss days, or a -2× average loss day.
      var allClosed = S.trades.filter(function(t){return t.status==='closed' && t.pnl<0;});
      if(!allClosed.length) return null;
      var avgLoss = allClosed.reduce(function(s,t){return s+t.pnl;},0)/allClosed.length;
      if(yPnl >= avgLoss*2) return null; // not bad enough
      // Today 08:00 (or right now if already past 08:00)
      var t2 = new Date();
      t2.setHours(8,0,0,0);
      if(t2 <= now) {
        // Already past 8am today — fire silently within next 60 seconds
        t2 = new Date(now.getTime() + 60000);
      }
      if(state.lossCooldownDate === todayKey) return null;
      return t2;
    }
    case 'weekKickoff': {
      if(!prefs.weekKickoff) return null;
      var d2 = new Date();
      var daysUntilSun = (0 - d2.getDay() + 7) % 7;
      if(daysUntilSun === 0 && d2.getHours() >= 19) daysUntilSun = 7;
      d2.setDate(d2.getDate() + daysUntilSun);
      d2.setHours(19,0,0,0);
      if(state.weekKickoffDate === localDate(d2)) return null;
      return d2;
    }
    default: return null;
  }
}

// Cancelable handles for in-tab scheduled notifications. Re-scheduled
// from scratch on every tick so we never accumulate stale timers.
var _notifTimers = {};
function tickNotifScheduler(){
  if(notifPermission() !== 'granted') return;
  // Cancel previous timers
  Object.keys(_notifTimers).forEach(function(k){
    clearTimeout(_notifTimers[k]); delete _notifTimers[k];
  });
  ['sahibDailyBrief','fridayMuhasabah','streakGuard','lossCooldown','weekKickoff'].forEach(function(type){
    var when = nextFireTime(type);
    if(!when) return;
    var delay = when.getTime() - Date.now();
    // Only schedule things within the next 12 hours — beyond that, the user
    // will almost certainly close the tab anyway. We re-schedule on every
    // visibilitychange and on app open.
    if(delay < 0 || delay > 12*3600*1000) return;
    _notifTimers[type] = setTimeout(function(){
      fireScheduledNotif(type);
    }, delay);
  });
}

function fireScheduledNotif(type){
  var state = S.notifState || (S.notifState = {});
  var today = localDate();
  var copy = NOTIF_COPY[type] || { title: 'Niyyah', body: 'A reminder.', url: '/' };
  // Re-evaluate body at fire-time so streak/loss numbers are fresh
  if(typeof copy.body === 'function') copy = { title: copy.title, body: copy.body(), url: copy.url };
  fireNotif(copy.title, copy.body, copy.url);
  state[type + 'Date'] = today;
  sv('notifState', state);
}

var NOTIF_COPY = {
  sahibDailyBrief: {
    title: '☽ Sahib',
    body: function(){ return (typeof sahibBriefText==='function') ? sahibBriefText() : 'Your daily focus is ready.'; },
    url: '/'
  },
  fridayMuhasabah: {
    title: '☽ Friday muhasabah',
    body: function(){
      var monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
      monday.setHours(0,0,0,0);
      var ts = monday.getTime();
      var week = S.trades.filter(function(t){return t.status==='closed' && new Date(t.date+'T12:00:00').getTime()>=ts;});
      var pnl = week.reduce(function(s,t){return s+(t.pnl||0);},0);
      return week.length + ' trade' + (week.length===1?'':'s') + ' this week · ' +
             ((pnl>=0?'+':'-')+'$'+Math.abs(Math.round(pnl))) +
             '. Look at it with honesty before Maghrib.';
    },
    url: '/'
  },
  streakGuard: {
    title: 'Your streak breaks at midnight',
    body: function(){
      var s = calcStreak();
      return s + '-day streak · no trade or prayer logged today. 30 seconds keeps it alive.';
    },
    url: '/'
  },
  lossCooldown: {
    title: 'Yesterday was hard — protect today',
    body: 'Pray Fajr. Read the Blueprint. Set today’s intention before opening any chart.',
    url: '/'
  },
  weekKickoff: {
    title: '☽ One week ahead',
    body: 'Set your niyyah for the week before the first session opens.',
    url: '/'
  }
};

// Send a quick test notification (Settings → Send test).
function testNotification(){
  if(notifPermission() === 'default'){
    requestNotifPermission().then(function(p){
      if(p === 'granted') fireNotif('Niyyah test', 'Reminders are working. Bismillah.', '/');
    });
    return;
  }
  if(notifPermission() !== 'granted'){
    toast('Reminders are blocked. Enable in your browser settings.', 'e'); return;
  }
  fireNotif('Niyyah test', 'Reminders are working. Bismillah.', '/');
}

// ── DAILY MISSION ──────────────────────────────────────────────────────────
// Single most-important action for today, derived from the user's state.
// One mission per day, ordered by priority. Empty = no mission card shown.
function pickDailyMission(){
  var todayKey = localDate();
  var now = new Date();
  var day = now.getDay();
  var hour = now.getHours();
  var closed = S.trades.filter(function(t){return t.status==='closed';});
  var todayClosed = closed.filter(function(t){return t.date===todayKey;});
  var prayers = (S.dailyPrayers||{})[todayKey] || {};
  var prayedCount = Object.values(prayers).filter(Boolean).length;

  // 1. Yesterday was a real loss → cooldown mission, regardless of anything
  var yest = new Date(); yest.setDate(yest.getDate()-1);
  var yKey = localDate(yest);
  var yClosed = closed.filter(function(t){return t.date===yKey;});
  if(yClosed.length){
    var yPnl = yClosed.reduce(function(s,t){return s+(t.pnl||0);},0);
    var allLosses = closed.filter(function(t){return t.pnl<0;});
    if(allLosses.length){
      var avgLoss = allLosses.reduce(function(s,t){return s+t.pnl;},0)/allLosses.length;
      if(yPnl <= avgLoss * 1.5){
        return {
          urgent: true, icon: '⚠',
          eye: 'COOLDOWN MISSION',
          text: 'Yesterday was <em>hard</em>. Re-read the Blueprint before any chart.',
          page: 'blueprint'
        };
      }
    }
  }

  // 2. Friday afternoon and muhasabah not yet done this week
  if((day===5 && hour>=14) || (day===6 && hour<12)){
    var weekJournals = (S.journals||[]).filter(function(j){
      var jd = new Date(j.date+'T12:00:00');
      var diff = (now - jd)/86400000;
      return diff >= 0 && diff <= 2;
    });
    if(!weekJournals.length){
      return {
        urgent: true, icon: '☽',
        eye: 'FRIDAY · MUHASABAH',
        text: 'It\'s Friday. Look at this week with <em>honesty</em>.',
        page: 'journal'
      };
    }
  }

  // 3. Streak alive but nothing logged yet today → protect it
  var streak = calcStreak();
  if(streak >= 3 && todayClosed.length===0 && prayedCount===0){
    return {
      urgent: hour >= 18,
      icon: '✦',
      eye: 'STREAK · DAY ' + streak,
      text: 'Your ' + streak + '-day streak <em>holds</em> if you log one trade or tap one prayer today.',
      page: 'dashboard'
    };
  }

  // 4. Leak-specific mission for new users with no closed trades
  if(closed.length < 5 && S.settings && S.settings.leak){
    var leak = S.settings.leak;
    var leakMissions = {
      revenge:  { icon:'⏳', eye:'LEAK · REVENGE',    text:'Today\'s rule: <em>one trade per session</em>. If it loses, you stop.' },
      fomo:     { icon:'⏱', eye:'LEAK · FOMO',       text:'Today\'s rule: wait <em>10 minutes</em> after spotting a setup before entering.' },
      rules:    { icon:'❑', eye:'LEAK · BROKEN RULES', text:'Today\'s rule: write each rule down <em>before</em> the first chart.' },
      overconf: { icon:'☽', eye:'LEAK · KIBR',       text:'After any win today: <em>reduce</em> next size by one contract. Same rules, always.' },
      missing:  { icon:'☽', eye:'LEAK · SALAH',      text:'Today\'s rule: no chart until <em>this prayer</em> is done.' },
      boredom:  { icon:'✦', eye:'LEAK · BOREDOM',    text:'Today\'s rule: zero trades is a <em>winning session</em> if nothing qualifies.' }
    };
    var lm = leakMissions[leak];
    if(lm){ lm.page = 'guide'; lm.urgent = false; return lm; }
  }

  // 5. Morning and no intention set → write the niyyah
  if(hour < 12 && closed.length > 0){
    var m = (S.morning||{})[todayKey];
    if(!m || !m.intention){
      return {
        urgent: false, icon: '✎',
        eye: 'MORNING · INTENTION',
        text: 'Write today\'s <em>niyyah</em> before the open.',
        page: 'journal'
      };
    }
  }

  // 6. Evening and trades happened → muhasabah
  if(hour >= 17 && todayClosed.length > 0){
    var j = (S.journals||[]).find(function(x){return x.date===todayKey;});
    if(!j){
      return {
        urgent: false, icon: '☽',
        eye: 'EVENING · MUHASABAH',
        text: 'Reflect on today before sleep. <em>One fix</em> for tomorrow.',
        page: 'journal'
      };
    }
  }

  // 7. Default — calm continuation prompt
  if(closed.length >= 5){
    return {
      urgent: false, calm: true, icon: '☽',
      eye: 'TODAY · ONE THING',
      text: 'Quality <em>over</em> P&L. Take only setups your gate approves.',
      page: 'guide'
    };
  }

  return null;
}

function renderDailyMission(){
  var e = el('daily-mission-wrap'); if(!e) return;
  var m = pickDailyMission();
  if(!m){ e.innerHTML=''; return; }
  var cls = 'daily-mission' + (m.urgent?' urgent':'') + (m.calm?' calm':'');
  e.innerHTML =
    '<div class="' + cls + '" data-hclick="hGoPage" data-hpage="' + (m.page||'dashboard') + '">' +
      '<div class="dm-icon">' + esc(m.icon||'☽') + '</div>' +
      '<div class="dm-body">' +
        '<div class="dm-eye">' + esc(m.eye||'TODAY') + '</div>' +
        '<div class="dm-text">' + m.text + '</div>' +  // text contains intentional <em>
      '</div>' +
      '<div class="dm-arrow">→</div>' +
    '</div>';
}

// ── 30-DAY HABIT CHAIN ──────────────────────────────────────────────────
function renderHabitChain(){
  var e = el('habit-chain-wrap'); if(!e) return;
  // Only show the chain once the user has 3+ active days — one active cell
  // surrounded by 29 grey circles just discourages new users.
  var _activeDays=0;
  for(var _i=0;_i<30;_i++){var _d=new Date();_d.setDate(_d.getDate()-_i);var _k=localDate(_d);var _tr=S.trades.filter(function(t){return t.date===_k;});var _pr=((S.dailyPrayers||{})[_k])?Object.values(S.dailyPrayers[_k]).filter(Boolean).length:0;if(_tr.length||_pr>=1)_activeDays++;}
  if(_activeDays<3){e.innerHTML='';return;}
  var todayKey = localDate();
  var cells = [];
  var loggedDays = 0;
  for(var i=29;i>=0;i--){
    var d = new Date(); d.setDate(d.getDate() - i);
    var k = localDate(d);
    var trades = S.trades.filter(function(t){return t.date===k;});
    var prayed = ((S.dailyPrayers||{})[k]) ? Object.values(S.dailyPrayers[k]).filter(Boolean).length : 0;
    var level = 0;
    if(trades.length && prayed >= 4) level = 4;
    else if(trades.length && prayed >= 1) level = 3;
    else if(trades.length) level = 2;
    else if(prayed >= 3) level = 2;
    else if(prayed >= 1) level = 1;
    if(level > 0) loggedDays++;
    var dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    var titleParts = [dateStr];
    if(trades.length) titleParts.push(trades.length + ' trade' + (trades.length===1?'':'s'));
    if(prayed) titleParts.push(prayed + '/5 prayers');
    if(!trades.length && !prayed) titleParts.push('quiet day');
    cells.push('<div class="hc-cell' + (level?' l'+level:'') + (k===todayKey?' today':'') + '" title="' + esc(titleParts.join(' · ')) + '"></div>');
  }
  e.innerHTML =
    '<div class="habit-chain">' +
      '<div class="hc-head">' +
        '<div class="hc-title">30-Day Chain <span style="font-family:Inter,sans-serif;font-weight:300;font-size:0.66rem;letter-spacing:0;text-transform:none;color:var(--ink-4);">· each square is a day — hover for detail</span></div>' +
        '<div class="hc-summary"><strong>' + loggedDays + '</strong> of 30 days active</div>' +
      '</div>' +
      '<div class="hc-grid">' + cells.join('') + '</div>' +
      '<div class="hc-legend"><span>Quiet day</span> ' +
        '<div class="hc-legend-dots">' +
          '<div class="hc-legend-dot"></div>' +
          '<div class="hc-legend-dot l1"></div>' +
          '<div class="hc-legend-dot l2"></div>' +
          '<div class="hc-legend-dot l3"></div>' +
          '<div class="hc-legend-dot l4"></div>' +
        '</div> <span>Traded &amp; prayed</span></div>' +
    '</div>';
}

// ── STREAK-AT-RISK BANNER ──────────────────────────────────────────────
// Fires when streak >= 3, after 18:00 local, and nothing logged today.
// Loss aversion is the single most powerful retention force; surface it.
function renderStreakRisk(){
  var e = el('streak-risk-wrap'); if(!e){ return; }
  var streak = calcStreak();
  if(streak < 3){ e.innerHTML=''; return; }
  var now = new Date();
  if(now.getHours() < 18){ e.innerHTML=''; return; }
  var todayKey = localDate();
  var todayTrades = S.trades.filter(function(t){return t.date===todayKey;});
  var prayed = ((S.dailyPrayers||{})[todayKey]) ? Object.values(S.dailyPrayers[todayKey]).filter(Boolean).length : 0;
  if(todayTrades.length || prayed){ e.innerHTML=''; return; }
  e.innerHTML =
    '<div class="streak-risk">' +
      '<div class="sr-icon">⏳</div>' +
      '<div class="sr-body">' +
        '<div class="sr-title">Your <strong>' + streak + '-day streak</strong> breaks at midnight.</div>' +
        '<div class="sr-sub">30 seconds keeps it alive — tap one prayer or open the journal.</div>' +
      '</div>' +
      '<div class="sr-actions">' +
        '<button class="btn btn-gold btn-sm" data-hclick="h163">Tap a prayer</button>' +
        '<button class="btn btn-outline btn-sm" data-hclick="h143">Open journal</button>' +
      '</div>' +
    '</div>';
}

// Picks the next unprayed prayer for the streak-guard quick-tap.
function _nextDuePrayer(){
  var order = ['fajr','dhuhr','asr','maghrib','isha'];
  var p = (S.dailyPrayers||{})[localDate()] || {};
  for(var i=0;i<order.length;i++) if(!p[order[i]]) return order[i];
  return 'isha';
}

// ── NOTIFICATION OPT-IN PROMPT ──────────────────────────────────────────
// Appears ONCE, after the user has shown engagement (tapped a prayer or
// logged a trade). Dismiss = silence for 14 days. Granted = silence forever.
function renderNotifPrompt(){
  var e = el('notif-prompt-wrap'); if(!e){ return; }
  if(notifPermission() !== 'default'){ e.innerHTML=''; return; }
  // Honor "Not now" cooldown
  if(S.notifSnoozeUntil && new Date(S.notifSnoozeUntil) > new Date()){
    e.innerHTML=''; return;
  }
  // Only prompt if engaged: ≥1 trade or ≥1 prayer tapped at any point
  var anyTrade = S.trades.length > 0;
  var anyPrayer = Object.keys(S.dailyPrayers||{}).some(function(d){
    return Object.values(S.dailyPrayers[d]).some(Boolean);
  });
  if(!anyTrade && !anyPrayer){ e.innerHTML=''; return; }
  e.innerHTML =
    '<div class="notif-prompt">' +
      '<div class="np-icon">☽</div>' +
      '<div class="np-body">' +
        '<div class="np-title">Reminders for Friday muhasabah &amp; streak guard?</div>' +
        '<div class="np-sub">One ping at the moments that matter. No marketing, ever.</div>' +
      '</div>' +
      '<div class="np-actions">' +
        '<button class="btn btn-gold btn-sm" data-hclick="h164">Enable</button>' +
        '<button class="btn btn-ghost btn-sm" data-hclick="h165">Not now</button>' +
      '</div>' +
    '</div>';
}
function snoozeNotifPrompt(){
  var until = new Date(); until.setDate(until.getDate() + 14);
  S.notifSnoozeUntil = until.toISOString();
  sv('notifSnoozeUntil', S.notifSnoozeUntil);
  renderNotifPrompt();
}

// ── PWA INSTALL ────────────────────────────────────────────────────────
// Capture the beforeinstallprompt event so we can fire it later from a
// real user click (browsers reject programmatic prompts).
var _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  _deferredInstallPrompt = e;
  renderPwaNudge();
  var btn = el('pwa-install-btn'); if(btn) btn.style.display='';
});
window.addEventListener('appinstalled', function(){
  _deferredInstallPrompt = null;
  S.pwaInstalled = true; sv('pwaInstalled', true);
  toast('✓ Niyyah installed. Open from your home screen.','s');
  renderPwaNudge();
});

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}
function installPwaPrompt(){
  if(!_deferredInstallPrompt){
    toast('Install via your browser menu (Add to Home Screen).','s');
    return;
  }
  _deferredInstallPrompt.prompt();
  _deferredInstallPrompt.userChoice.then(function(){
    _deferredInstallPrompt = null;
  });
}
function dismissPwaNudge(){
  var until = new Date(); until.setDate(until.getDate() + 30);
  S.pwaNudgeSnoozedUntil = until.toISOString();
  sv('pwaNudgeSnoozedUntil', S.pwaNudgeSnoozedUntil);
  renderPwaNudge();
}
function renderPwaNudge(){
  var e = el('pwa-nudge-wrap'); if(!e){ return; }
  if(isStandalone()){ e.innerHTML=''; return; }
  if(!_deferredInstallPrompt){ e.innerHTML=''; return; }
  if(S.pwaNudgeSnoozedUntil && new Date(S.pwaNudgeSnoozedUntil) > new Date()){ e.innerHTML=''; return; }
  // Only show after a few sessions of real engagement
  if((S.sessionCount||0) < 3){ e.innerHTML=''; return; }
  e.innerHTML =
    '<div class="pwa-nudge">' +
      '<span style="color:var(--gold);font-size:1.1rem;flex-shrink:0;line-height:1;">↓</span>' +
      '<div><strong>Install Niyyah</strong> — open it as fast as your trading app, and reminders fire even when the browser is closed.</div>' +
      '<button class="btn btn-gold btn-sm" data-hclick="h101">Install</button>' +
      '<button class="pwa-dismiss" data-hclick="h166" aria-label="Dismiss">×</button>' +
    '</div>';
}

// ── SETTINGS PANEL FOR NOTIFICATIONS ──────────────────────────────────
function renderNotifSettings(){
  var prefs = notifPrefs();
  var perm = notifPermission();
  var prow = el('notif-permission-row');
  if(prow){
    if(perm === 'unsupported'){
      prow.innerHTML = '<div style="padding:11px 14px;background:var(--surface-2);border:1px solid var(--line-2);border-radius:var(--r);font-size:0.78rem;color:var(--ink-3);">Notifications are not supported in this browser.</div>';
    } else if(perm === 'denied'){
      prow.innerHTML = '<div style="padding:11px 14px;background:rgba(214,132,132,0.05);border:1px solid rgba(214,132,132,0.18);border-radius:var(--r);font-size:0.78rem;color:var(--ink-2);line-height:1.55;"><strong style="color:var(--red);">Reminders blocked.</strong> Re-enable in your browser settings (the lock icon next to the URL).</div>';
    } else if(perm === 'granted'){
      prow.innerHTML = '<div style="padding:11px 14px;background:rgba(112,184,142,0.05);border:1px solid rgba(112,184,142,0.18);border-radius:var(--r);font-size:0.78rem;color:var(--ink-2);"><strong style="color:var(--green);">✓ Reminders enabled.</strong> Pick which ones below.</div>';
    } else {
      prow.innerHTML = '<button class="btn btn-gold" data-hclick="h167">Enable browser reminders</button>';
    }
  }
  var rows = el('notif-prefs-rows');
  if(!rows) return;
  var items = [
    { key:'sahibDailyBrief', title:'Sahib daily focus',  sub:'08:30 · your weekly commitment, every morning it\'s active' },
    { key:'fridayMuhasabah', title:'Friday muhasabah',  sub:'Friday 16:00 · weekly review reminder' },
    { key:'streakGuard',     title:'Streak guard',      sub:'21:00 · only when a streak is alive and today is empty' },
    { key:'lossCooldown',    title:'Loss-day cooldown', sub:'Next morning 08:00 · after a hard day' },
    { key:'weekKickoff',     title:'Sunday week kickoff', sub:'Sunday 19:00 · plan the week ahead' }
  ];
  rows.innerHTML = items.map(function(it){
    var on = prefs[it.key];
    return '<div class="notif-row">' +
      '<div class="notif-row-body">' +
        '<div class="notif-row-title">' + esc(it.title) + '</div>' +
        '<div class="notif-row-sub">' + esc(it.sub) + '</div>' +
      '</div>' +
      '<div class="toggle' + (on?' on':'') + '" data-hclick="hToggleNotif" data-hkey="' + it.key + '"><div class="toggle-dot"></div></div>' +
    '</div>';
  }).join('');
}
function toggleNotifPref(k){
  var cur = notifPrefs();
  setNotifPref(k, !cur[k]);
  renderNotifSettings();
  tickNotifScheduler();
}

// Patch renderSettings to also render the notification panel after the
// existing settings UI builds.
var _origRenderSettings = renderSettings;
renderSettings = function(){
  _origRenderSettings.apply(this, arguments);
  try{ renderNotifSettings(); }catch(e){ console.error('notif settings:',e); }
};

// Patch renderDash so all retention surfaces refresh on every dashboard
// repaint (after trade close, after prayer tap, etc).
var _origRenderDash = renderDash;
renderDash = function(){
  _origRenderDash.apply(this, arguments);
  try{ renderStreakRisk(); }catch(e){ console.error('streak risk:',e); }
  try{ renderDailyMission(); }catch(e){ console.error('daily mission:',e); }
  try{ renderHabitChain(); }catch(e){ console.error('habit chain:',e); }
  try{ renderNotifPrompt(); }catch(e){ console.error('notif prompt:',e); }
  try{ renderPwaNudge(); }catch(e){ console.error('pwa nudge:',e); }
};

// Re-schedule notifications whenever the tab regains focus, since long
// timeouts get throttled / dropped when a tab is backgrounded.
document.addEventListener('visibilitychange', function(){
  if(!document.hidden){
    try{ tickNotifScheduler(); }catch(e){}
    try{ renderStreakRisk(); }catch(e){}
    try{ renderDailyMission(); }catch(e){}
  }
});

// Format today's Hijri date as e.g. "12 Dhul-Qa'dah 1446". Returns empty
// string if the runtime doesn't support the Umm al-Qura calendar (very old
// browsers); the topbar then quietly falls back to Gregorian only.
function hijriToday(){
  try{
    var parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura',
      {day:'numeric',month:'long',year:'numeric'}).formatToParts(new Date());
    var day='',mon='',yr='';
    parts.forEach(function(p){
      if(p.type==='day') day=p.value;
      else if(p.type==='month') mon=p.value;
      else if(p.type==='year') yr=p.value.replace(/\s*AH$/,'');
    });
    if(!day||!mon||!yr) return '';
    return day+' '+mon+' '+yr+' AH';
  }catch(_){ return ''; }
}

function init(){
  var td=el('topbar-date');
  if(td){
    var greg=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    var hij=hijriToday();
    td.innerHTML = greg + (hij ? ' <span style="color:var(--gold-deep);margin:0 4px;opacity:0.7;">·</span> <span style="color:var(--gold-deep);">'+hij+'</span>' : '');
  }
  // Pre-load Chart.js for the in-app analytics views. Visitors who never sign in
  // skip this entirely — see __ensureChart definition above.
  if(typeof window.__ensureChart === 'function'){
    window.__ensureChart().catch(function(){});
  }
  loadAll().then(function(ob){
    var user=AUTH.currentUser;
    // Recover from an interrupted signup: account exists but the user never
    // confirmed they saved their codes. Re-show them (with a fresh recovery
    // code) so they can never be permanently locked out. Skipped if the
    // credential screen is already up (i.e. this load IS the fresh signup).
    if(!window._demoMode && S.accountCode && S.credsAcknowledged !== true) _resumeCredentials();
    if(S.settings.name){setText('sf-av',S.settings.name[0].toUpperCase());setText('sf-name',S.settings.name);}
    else if(user&&user.displayName){setText('sf-av',user.displayName[0].toUpperCase());setText('sf-name',user.displayName);}
    if(user&&user.email){setText('sf-plan-label','Free Demo');}
    if(S.openTradeId){var found=S.trades.find(function(t){return t.id===S.openTradeId&&t.status==='open';});if(!found){S.openTradeId=null;sv('openTradeId',null);}}
    // Increment session counter — drives PWA-install nudge timing
    S.sessionCount = (S.sessionCount||0) + 1;
    S.lastSessionAt = new Date().toISOString();
    sv('sessionCount', S.sessionCount);
    sv('lastSessionAt', S.lastSessionAt);
    updateNav();
    try{ _refreshBrakeBadge(); }catch(e){}
    try{renderDash();}catch(e){console.error('Init renderDash:',e);}
    // Hook the local scheduler on every app open — bridges from "user is
    // active" → "reminder fires later today while tab is still open."
    try{ tickNotifScheduler(); }catch(e){ console.error('scheduler:',e); }
    if(!ob)setTimeout(showOB,500);
  });
}

// ── STAR FIELD ANIMATION ──────────────────────────────────────────────────
(function(){
  var canvas=document.getElementById('star-canvas');
  if(!canvas)return;
  // Respect users who have asked the OS for less motion (vestibular issues,
  // low-battery modes). Paint a single static frame instead of running RAF.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx=canvas.getContext('2d');
  var stars=[];
  var W,H;

  function resize(){
    W=canvas.width=window.innerWidth;
    H=canvas.height=window.innerHeight;
  }

  function createStars(){
    stars=[];
    // Cap at 80 stars — enough to feel alive, not enough to lag
    var count=Math.min(Math.floor((W*H)/16000),80);
    for(var i=0;i<count;i++){
      stars.push({
        x:Math.random()*W,
        y:Math.random()*H,
        r:Math.random()*1.1+0.15,
        a:Math.random()*0.7+0.1,
        da:(Math.random()-0.5)*0.0025,
        vx:(Math.random()-0.5)*0.03,
        vy:(Math.random()-0.5)*0.025
      });
    }
  }

  function draw(){
    var landing=document.getElementById('landing');
    // Skip draw but keep loop alive so it resumes instantly when landing reappears
    if(landing&&landing.classList.contains('hide')){
      requestAnimationFrame(draw);return;
    }
    ctx.clearRect(0,0,W,H);
    // Set color once per frame — not per star
    ctx.fillStyle='#dab462';
    for(var i=0;i<stars.length;i++){
      var s=stars[i];
      s.a+=s.da;
      if(s.a<=0.06||s.a>=0.82)s.da*=-1;
      s.x+=s.vx;s.y+=s.vy;
      if(s.x<0)s.x=W;if(s.x>W)s.x=0;
      if(s.y<0)s.y=H;if(s.y>H)s.y=0;
      ctx.globalAlpha=s.a;
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize',function(){resize();createStars();if(reduceMotion)drawStatic();});
  resize();createStars();
  if(reduceMotion) drawStatic(); else draw();

  function drawStatic(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#dab462';
    for(var i=0;i<stars.length;i++){
      var s=stars[i];
      ctx.globalAlpha=s.a;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // Mouse spotlight — update CSS variable on mousemove inside landing
  var root=document.documentElement;
  var ld=document.getElementById('landing');
  if(ld){
    ld.addEventListener('mousemove',function(e){
      root.style.setProperty('--lmx',e.clientX+'px');
      root.style.setProperty('--lmy',e.clientY+'px');
    });
    ld.addEventListener('mouseleave',function(){
      root.style.setProperty('--lmx','-400px');
      root.style.setProperty('--lmy','-400px');
    });
  }
})();

// ── COUNT-UP ANIMATION ────────────────────────────────────────────────────
function animateCounters(){
  var els=document.querySelectorAll('.stat-num[data-target]');
  els.forEach(function(el){
    var target=parseInt(el.getAttribute('data-target'),10);
    var start=0;
    var duration=1200;
    var startTime=null;
    function step(ts){
      if(!startTime)startTime=ts;
      var prog=Math.min((ts-startTime)/duration,1);
      var ease=1-Math.pow(1-prog,3);
      el.textContent=Math.round(start+(target-start)*ease);
      if(prog<1)requestAnimationFrame(step);
      else el.textContent=target;
    }
    requestAnimationFrame(step);
  });
}

// ── ENHANCED SCROLL REVEAL (covers .reveal + legacy .lfeat-card etc.) ────
function initReveal(){
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('visible');
        // Legacy elements rely on inline opacity (no .visible CSS rule binds to them).
        // Clear the inline hide so the transition we set runs and they actually appear.
        if(e.target.style.opacity==='0'){
          e.target.style.opacity='1';
          e.target.style.transform='translateY(0)';
        }
        // Trigger counter animation when stat bar comes into view
        if(e.target.querySelector&&e.target.querySelector('.stat-num')){
          animateCounters();
        }
        obs.unobserve(e.target);
      }
    });
  },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});

  // Reveal classes
  document.querySelectorAll('.reveal').forEach(function(el){obs.observe(el);});

  // Legacy lfeat-card / ldeen / lprice-section scroll reveal
  var legacy=document.querySelectorAll('.lfeat-card:not(.reveal),.ldeen:not(.reveal),.lprice-section:not(.reveal),.lmock:not(.reveal)');
  legacy.forEach(function(el,i){
    if(!el.style.opacity){
      el.style.opacity='0';
      el.style.transform='translateY(28px)';
      el.style.transition='opacity 0.7s cubic-bezier(0.16,1,0.3,1) '+(i*0.06)+'s, transform 0.7s cubic-bezier(0.16,1,0.3,1) '+(i*0.06)+'s';
    }
    obs.observe(el);
  });
}

// Accessibility pass: programmatically associate each .field label with its
// control (screen readers couldn't announce them — labels were siblings with
// no for/id), and tag Arabic text with lang/dir so it isn't mispronounced.
(function(){
  function run(){
    var n=0;
    document.querySelectorAll('.field').forEach(function(field){
      var label=field.querySelector('label');
      var ctrl=field.querySelector('input,select,textarea');
      if(!label||!ctrl) return;
      if(!ctrl.id) ctrl.id='f_auto_'+(n++);
      if(!label.htmlFor) label.htmlFor=ctrl.id;
    });
    document.querySelectorAll('.dhikr-ar,.nafs-ar,.ldeen-ar,.gate-ar,[data-arabic]').forEach(function(s){
      s.setAttribute('lang','ar'); s.setAttribute('dir','rtl');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();
})();

// Mobile sticky CTA — IntersectionObserver: show after hero scrolls out, hide at pricing
(function(){
  document.addEventListener('DOMContentLoaded',function(){
    var hero=document.querySelector('.lhero');
    var sticky=document.getElementById('sticky-cta');
    var pricing=document.getElementById('pricing-section');
    if(!hero||!sticky)return;
    var stickyObs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.target===hero){
          if(!e.isIntersecting) sticky.classList.add('show');
          else sticky.classList.remove('show');
        }
        if(e.target===pricing){
          if(e.isIntersecting) sticky.classList.remove('show');
        }
      });
    },{threshold:0.1});
    stickyObs.observe(hero);
    if(pricing) stickyObs.observe(pricing);
  });
})();

document.addEventListener('DOMContentLoaded',function(){
  setTimeout(initReveal,80);
  // Deep-link support: if URL points at a legal page, open it directly.
  // Set _showingLegalPage before the auth observer fires so it doesn't bounce
  // the user back to landing on its own.
  var initialPath = (window.location.pathname||'').replace(/^\//,'');
  if(['privacy','terms','refund'].indexOf(initialPath) > -1){
    _showingLegalPage = true;
    document.body.classList.add('legal-visitor');
    var lg=el('landing'); if(lg) lg.classList.add('hide');
    _suppressHistory = true;
    try{ showLegalPage(initialPath); } finally { _suppressHistory = false; }
  }
  // (Email-verification URL handlers removed \u2014 accounts no longer use email.)
});

// ── MODAL KEYBOARD SUPPORT + GLOBAL SHORTCUTS ─────────────────────────────
// Escape closes the topmost open modal. Cmd/Ctrl+Enter submits entry/exit.
// Bare N opens a new trade (Linear-style). G then a letter jumps pages.
// Shortcuts are suppressed while typing in inputs or when a modal is open.
var _gPending = false;
var _gTimer = null;
function _isTyping(target){
  if(!target) return false;
  var tag = (target.tagName||'').toUpperCase();
  return tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || target.isContentEditable;
}
document.addEventListener('keydown',function(e){
  var confirmOpen=el('confirm-modal')&&el('confirm-modal').classList.contains('show');
  if(confirmOpen)return;
  var zoomOpen=el('image-zoom')&&el('image-zoom').classList.contains('show');
  if(zoomOpen){if(e.key==='Escape'){e.preventDefault();closeImageZoom();}return;}
  var entryOpen=el('entry-modal')&&el('entry-modal').classList.contains('show');
  var exitOpen=el('exit-modal')&&el('exit-modal').classList.contains('show');
  var editPnlOpen=el('edit-pnl-modal')&&el('edit-pnl-modal').classList.contains('show');
  var csvOpen=el('csv-modal')&&el('csv-modal').classList.contains('show');
  var anyModal = entryOpen||exitOpen||editPnlOpen||csvOpen;
  if(anyModal){
    if(e.key==='Escape'){
      e.preventDefault();
      if(editPnlOpen)closeEditPnl();
      else if(csvOpen)closeCsvModal();
      else if(entryOpen)closeEntry();
      else if(exitOpen)closeExit();
    } else if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){
      e.preventDefault();
      if(entryOpen){var b=el('save-entry-btn');if(b&&!b.disabled)b.click();}
      else if(exitOpen){var b2=el('save-exit-btn');if(b2&&!b2.disabled)b2.click();}
    }
    return;
  }
  // Global shortcuts — only when signed in, no modal, not typing, no modifier keys.
  if(!UID) return;
  if(_isTyping(e.target)) return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  var k = (e.key||'').toLowerCase();
  if(_gPending){
    _gPending = false;
    if(_gTimer){clearTimeout(_gTimer);_gTimer=null;}
    var map = {d:'dashboard',t:'trades',c:'calendar',a:'analytics',j:'journal',p:'playbook',r:'risk',s:'settings'};
    if(map[k]){
      e.preventDefault();
      go(map[k], document.querySelector('[data-page="'+map[k]+'"]'));
    }
    return;
  }
  if(k==='n'){
    e.preventDefault();
    openEntryModal();
  } else if(k==='?'){
    e.preventDefault();
    go('guide', document.querySelector('[data-page="guide"]'));
  } else if(k==='g'){
    e.preventDefault();
    _gPending = true;
    _gTimer = setTimeout(function(){_gPending=false;_gTimer=null;}, 1200);
  }
});

// ── PWA SERVICE WORKER ─────────────────────────────────────────────────────
// Registered lazily after first paint so it never blocks the landing page.
if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load',function(){
    setTimeout(function(){
      navigator.serviceWorker.register('/sw.js').catch(function(e){
        console.warn('SW registration failed (ok in dev):',e);
      });
    },1500);
  });
}

// ── MODAL ACCESSIBILITY: Escape closes, Tab stays trapped inside ──────────
(function(){
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var MODAL_CLOSERS = {
    'entry-modal':    function(){ closeEntry(false); },
    'exit-modal':     function(){ closeExit(); },
    'edit-pnl-modal': function(){ closeEditPnl(); },
    'td-modal':       function(){ closeTD(); },
    'csv-modal':      function(){ if(typeof closeCsvModal==='function') closeCsvModal(); }
  };
  document.addEventListener('keydown', function(e){
    // Find the topmost visible modal
    var activeModal = null;
    Object.keys(MODAL_CLOSERS).forEach(function(id){
      var m = document.getElementById(id);
      if(m && m.classList.contains('show')) activeModal = m;
    });
    if(!activeModal) return;
    if(e.key === 'Escape'){
      e.preventDefault();
      var closer = MODAL_CLOSERS[activeModal.id];
      if(closer) closer();
      return;
    }
    if(e.key === 'Tab'){
      var focusable = Array.from(activeModal.querySelectorAll(FOCUSABLE))
        .filter(function(el){ return !el.closest('[style*="display:none"]') && !el.closest('[style*="display: none"]'); });
      if(!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length-1];
      if(e.shiftKey){
        if(document.activeElement === first){ e.preventDefault(); last.focus(); }
      } else {
        if(document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
  });
})();


// ══════════════════════════════════════════════════════════════════════════
// DELEGATED EVENT HANDLERS (CSP hardening — replaces inline on* attributes)
// Each former inline handler body is preserved verbatim as a function called
// with `this` = the element carrying the data-h<event> attribute and the
// original `event`. A single document-level listener per event type walks from
// the target upward, faithfully reproducing inline-handler bubbling, including
// stopPropagation.
// ══════════════════════════════════════════════════════════════════════════
var __H = {
  // Dynamic handlers (former concatenated inline handlers). Args travel on
  // sibling data-* attributes; ids use Number() because openTD/editPB match
  // with strict === against numeric Date.now() ids.
  'hLesson': function(){ var n=this.value.length,el=document.getElementById('x-lesson-count');if(el){el.textContent='('+n+'/20 min)';el.style.color=n>=20?'var(--green)':'var(--ink-3)';} },
  'hZoomEntry': function(){ openImageZoom(this.dataset.hid,'entry'); },
  'hZoomExit': function(){ openImageZoom(this.dataset.hid,'exit'); },
  'hRemoveShot': function(){ removeScreenshot(this.dataset.hwhich); },
  'hOpenTD': function(){ openTD(Number(this.dataset.hid)); },
  'hSortT': function(){ sortT(this.dataset.hkey); },
  'hEditPB': function(){ editPB(Number(this.dataset.hid)); },
  'hDeletePB': function(){ deletePB(Number(this.dataset.hid)); },
  'hTogglePush': function(){ if(S.settings && S.settings.pushSubscription){ disablePush(); } else { enablePush(); } },
  'hGoPage': function(){ var p=this.dataset.hpage; go(p, document.querySelector('[data-page='+p+']')); },
  'hToggleNotif': function(){ toggleNotifPref(this.dataset.hkey); },
  'h1': function(event){ closeMilestone() },
  'h2': function(event){ showAuth('signin') },
  'h3': function(event){ showAuth('signup') },
  'h4': function(event){ startDemo() },
  'h5': function(event){ scrollToFeatures() },
  'h6': function(event){ showLegalPage('privacy') },
  'h7': function(event){ showLegalPage('terms') },
  'h8': function(event){ if(event.key==='Enter')authSubmit() },
  'h9': function(event){ pwStrengthMeter(this.value) },
  'h10': function(event){ authSubmit() },
  'h11': function(event){ authToggle() },
  'h12': function(event){ openRecover() },
  'h13': function(event){ backToLanding() },
  'h14': function(event){ credCopy('code') },
  'h15': function(event){ credCopy('recovery') },
  'h16': function(event){ _updateCredContinue() },
  'h17': function(event){ credContinue() },
  'h18': function(event){ submitRecover() },
  'h19': function(event){ closeRecover() },
  'h20': function(event){ setPlan('monthly') },
  'h21': function(event){ setPlan('annual') },
  'h22': function(event){ setTier('base') },
  'h23': function(event){ setTier('sirat') },
  'h24': function(event){ subscribe() },
  'h25': function(event){ manageSubscription() },
  'h26': function(event){ doSignOut() },
  'h27': function(event){ obNext() },
  'h28': function(event){ obSkip() },
  'h29': function(event){ toggleSB() },
  'h30': function(event){ go('dashboard',this) },
  'h31': function(event){ go('intrade',this) },
  'h32': function(event){ go('trades',this) },
  'h33': function(event){ go('calendar',this) },
  'h34': function(event){ go('analytics',this) },
  'h35': function(event){ go('journal',this) },
  'h36': function(event){ go('sirat',this) },
  'h37': function(event){ go('playbook',this) },
  'h38': function(event){ go('risk',this) },
  'h39': function(event){ go('zakat',this) },
  'h40': function(event){ go('guide',this) },
  'h41': function(event){ go('goals',this) },
  'h42': function(event){ go('blueprint',this) },
  'h43': function(event){ this.style.color='var(--gold)';this.style.background='var(--surface-2)'; },
  'h44': function(event){ this.style.color='var(--ink-3)';this.style.background='transparent'; },
  'h45': function(event){ go('settings',null) },
  'hgrpTools': function(event){ toggleNavGroup('tools',this) },
  'hgrpMore': function(event){ toggleNavGroup('more',this) },
  'h46': function(event){ exitDemo() },
  'h47': function(event){ openDisasterBrake() },
  'h48': function(event){ toggleSalah('fajr') },
  'h49': function(event){ toggleSalah('dhuhr') },
  'h50': function(event){ toggleSalah('asr') },
  'h51': function(event){ toggleSalah('maghrib') },
  'h52': function(event){ toggleSalah('isha') },
  'h53': function(event){ saveTodayIntention() },
  'h54': function(event){ toggleAdvanced() },
  'h55': function(event){ setEq('all',this) },
  'h56': function(event){ setEq('30',this) },
  'h57': function(event){ setEq('7',this) },
  'h58': function(event){ go('trades',document.querySelector('[data-page=trades]')) },
  'h59': function(event){ cDhikr('sub') },
  'h60': function(event){ cDhikr('alh') },
  'h61': function(event){ cDhikr('akb') },
  'h62': function(event){ resetDhikr() },
  'h63': function(event){ stopMoveCheck() },
  'h64': function(event){ openExitModal() },
  'h65': function(event){ openEntryModal() },
  'h66': function(event){ renderTrades() },
  'h67': function(event){ openCsvModal() },
  'h68': function(event){ filterT('all',this) },
  'h69': function(event){ filterT('week',this) },
  'h70': function(event){ filterT('month',this) },
  'h71': function(event){ filterT('open',this) },
  'h72': function(event){ filterT('wins',this) },
  'h73': function(event){ filterT('losses',this) },
  'h74': function(event){ changeMonth(-1) },
  'h75': function(event){ changeMonth(0) },
  'h76': function(event){ changeMonth(1) },
  'h77': function(event){ closeDP() },
  'h78': function(event){ setAnRange(7,this) },
  'h79': function(event){ setAnRange(30,this) },
  'h80': function(event){ setAnRange(90,this) },
  'h81': function(event){ setAnRange('all',this) },
  'h82': function(event){ clearJournal() },
  'h83': function(event){ saveJournal() },
  'h84': function(event){ renderJournalList() },
  'h85': function(event){ clearPBForm() },
  'h86': function(event){ savePBSetup() },
  'h87': function(event){ calcRisk() },
  'h88': function(event){ calcZakat() },
  'h89': function(event){ saveGoal() },
  'h90': function(event){ saveChallenge() },
  'h91': function(event){ go('privacy',null) },
  'h92': function(event){ go('terms',null) },
  'h93': function(event){ go('refund',null) },
  'h94': function(event){ saveSettings() },
  'h95': function(event){ exportData() },
  'h96': function(event){ exportCSV() },
  'h97': function(event){ replayOnboarding() },
  'h98': function(event){ confirmResetAll() },
  'h99': function(event){ changePassword() },
  'h100': function(event){ testNotification() },
  'h101': function(event){ installPwaPrompt() },
  'h102': function(event){ setAsrMadhab(this.value) },
  'h103': function(event){ deleteAccount() },
  'h104': function(event){ if(event.target===this)closeEntry() },
  'h105': function(event){ closeEntry() },
  'h106': function(event){ gAns('waited','yes',this) },
  'h107': function(event){ gAns('waited','no',this) },
  'h108': function(event){ gAns('conf','yes',this) },
  'h109': function(event){ gAns('conf','no',this) },
  'h110': function(event){ gAns('calm','yes',this) },
  'h111': function(event){ gAns('calm','no',this) },
  'h112': function(event){ selEm(this) },
  'h113': function(event){ toggleIC('bismillah') },
  'h114': function(event){ toggleIC('prayer') },
  'h115': function(event){ toggleIC('setup') },
  'h116': function(event){ toggleIC('stop') },
  'h117': function(event){ onScreenshotPick(event,'entry') },
  'h118': function(event){ el('e-screenshot-input').click() },
  'h119': function(event){ saveEntry() },
  'hEntryNext': function(event){ entryGoStep(2) },
  'hEntryBack': function(event){ entryGoStep(1) },
  'hSahibAccept': function(event){ acceptSahibCommitment() },
  'hSahibSwap': function(event){ swapSahibCommitment() },
  'hSahibLock': function(event){ lockInSahibWeek() },
  'h120': function(event){ if(event.target===this)closeExit() },
  'h121': function(event){ closeExit() },
  'h122': function(event){ autoCalcExitHint() },
  'h123': function(event){ selExEm(this) },
  'h124': function(event){ onScreenshotPick(event,'exit') },
  'h125': function(event){ el('x-screenshot-input').click() },
  'h126': function(event){ saveExit() },
  'h127': function(event){ if(event.target===this)closeTD() },
  'h128': function(event){ closeTD() },
  'h129': function(event){ deleteOpenTrade(currentTDId) },
  'h130': function(event){ editTrade(currentTDId) },
  'h131': function(event){ if(event.target===this)closeEditPnl() },
  'h132': function(event){ closeEditPnl() },
  'h133': function(event){ saveEditPnl() },
  'h134': function(event){ if(event.target===this)closeCsvModal() },
  'h135': function(event){ closeCsvModal() },
  'h136': function(event){ onCsvPick(event) },
  'h137': function(event){ el('csv-file-input').click() },
  'h138': function(event){ downloadCsvTemplate() },
  'h139': function(event){ confirmCsvImport() },
  'h140': function(event){ closeImageZoom() },
  'h141': function(event){ _retryCredWrite() },
  'h142': function(event){ obPickLeak(this) },
  'h143': function(event){ go('journal',document.querySelector('[data-page=journal]')) },
  'h144': function(event){ go('sirat',document.querySelector('[data-page=sirat]')) },
  'h145': function(event){ go('intrade',document.querySelector('[data-page=intrade]')) },
  'h146': function(event){ go('guide',null) },
  'h147': function(event){ go('sirat') },
  'h148': function(event){ go('analytics',document.querySelector('[data-page=analytics]')) },
  'h149': function(event){ event.stopPropagation();openExitModal() },
  'h150': function(event){ showDayDetail(this.dataset.date) },
  'h151': function(event){ generateEdgeAudit() },
  'h152': function(event){ renderRiskOfRuin() },
  'h153': function(event){ upgradeToSirat() },
  'h154': function(event){ closeDisasterBrake() },
  'h155': function(event){ engageDisasterBrake() },
  'h156': function(event){ clearWitness() },
  'h157': function(event){ saveWitness() },
  'h158': function(event){ setPrayerLoc() },
  'h159': function(event){ clearPrayerLoc() },
  'h160': function(event){ copyReferralLink() },
  'h161': function(event){ shareMuhasabah() },  'h163': function(event){ toggleSalah(_nextDuePrayer()) },
  'h164': function(event){ requestNotifPermission() },
  'h165': function(event){ snoozeNotifPrompt() },
  'h166': function(event){ dismissPwaNudge() },
  'h167': function(event){ requestNotifPermission().then(renderNotifSettings) },
};
(function(){
  var BUBBLE  = ['click','input','change','keydown','mouseover','mouseout'];
  var CAPTURE = ['blur','error']; // these do not bubble
  function run(type, event){
    var node = event.target, stopped = false;
    var realStop = event.stopPropagation;
    event.stopPropagation = function(){ stopped = true; if(realStop) realStop.call(event); };
    while(node && node.nodeType === 1){
      if(node.hasAttribute && node.hasAttribute('data-h' + type)){
        var fn = __H[node.getAttribute('data-h' + type)];
        if(fn){ fn.call(node, event); if(stopped) break; }
      }
      node = node.parentNode;
    }
  }
  BUBBLE.forEach(function(t){ document.addEventListener(t, function(e){ run(t, e); }, false); });
  CAPTURE.forEach(function(t){ document.addEventListener(t, function(e){ run(t, e); }, true); });
})();

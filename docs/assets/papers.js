/* Niyyah — The Daily Papers. Two short forms generated from the member's
   own signed contract: The Check-In (before the session) and The Check-Out
   (after it). The contract is posted once; these are used every day. */

let contract = null;
try{ contract = JSON.parse(localStorage.getItem("niyyah_contract") || "null"); }catch(_){}

let app;

function esc(s){
  return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function toggleRow(id, question, options){
  return `
    <div class="check-row" data-id="${id}">
      <div class="q">${question}</div>
      <div class="toggle-pair">
        ${options.map(o => `<button type="button" class="toggle-btn" data-id="${id}" data-value="${o.value}">${o.label}</button>`).join("")}
      </div>
    </div>`;
}

/* ---------- Entry ---------- */

function renderNoContract(){
  app.innerHTML = `
    <div class="stage fx-in intro-card">
      <h1>Sign your contract first.</h1>
      <p>The papers are generated from what you wrote in your contract — your rules, your deed, your leaving. There's nothing to print until that exists.</p>
      <a class="btn primary" href="contract.html">Go to your contract</a>
    </div>`;
}

function renderMenu(){
  app.innerHTML = `
    <div class="stage fx-in">
      <div class="wiz-kicker">The Daily Papers</div>
      <h1 class="wiz-title">Your contract is posted. This is what you use every day.</h1>
      <p class="wiz-help">Check in before you trade. Check out when you're done. <em>Muhasabah</em> — the daily self-accounting — is how the nafs gets caught early, not after the account is already gone.</p>
      <div class="paper-menu">
        <button type="button" class="paper-card" id="openCheckIn">
          <div class="pc-kicker">Paper One &middot; Before The Session</div>
          <h2>The Check-In</h2>
          <p>Your niyyah, your plan, your state, your Hard Rule restated.</p>
        </button>
        <button type="button" class="paper-card" id="openCheckOut">
          <div class="pc-kicker">Paper Two &middot; After The Session</div>
          <h2>The Check-Out</h2>
          <p>The daily grade against your own rules, your deed, and your leaving.</p>
        </button>
      </div>
    </div>`;
  document.getElementById("openCheckIn").addEventListener("click", openCheckIn);
  document.getElementById("openCheckOut").addEventListener("click", openCheckOut);
}

function openCheckIn(){
  let existing = null;
  try{ existing = JSON.parse(localStorage.getItem("niyyah_checkin") || "null"); }catch(_){}
  if(existing) renderCheckInDoc(existing);
  else renderCheckInForm();
}
function openCheckOut(){
  let existing = null;
  try{ existing = JSON.parse(localStorage.getItem("niyyah_checkout") || "null"); }catch(_){}
  if(existing) renderCheckOutDoc(existing);
  else renderCheckOutForm();
}

/* ---------- Paper One: The Check-In ---------- */

function renderCheckInForm(){
  const hard = contract.rules.hard;
  app.innerHTML = `
    <div class="stage fx-in">
      <div class="wiz-kicker">Paper One</div>
      <h1 class="wiz-title">The Check-In</h1>
      <p class="wiz-help">Before you trade. Read it, answer it, take it into the session.</p>

      <div class="field">
        <label class="f-label">My niyyah today</label>
        <p class="hint" style="margin-bottom:.5em">One line. Your intention for this session — not your target.</p>
        <input type="text" id="ciNiyyah" placeholder="e.g. Trade my plan, not my mood." />
      </div>

      <div class="field">
        <label class="f-label">My plan</label>
        <p class="hint" style="margin-bottom:.5em">The setups I will take today, and nothing else.</p>
        <textarea id="ciPlan" placeholder="e.g. Only the breakout retest on my two pairs. Nothing off-plan."></textarea>
      </div>

      <div class="wiz-kicker" style="margin-top:1.8em">My State</div>
      ${toggleRow("sleep", "Did I sleep enough?", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}
      ${toggleRow("fajr", "Did I pray Fajr?", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}
      ${toggleRow("motive", "Am I trading to trade well, or to win something back?", [{ value: "well", label: "To trade well" }, { value: "back", label: "To win something back" }])}

      <div class="field" style="margin-top:1.8em">
        <label class="f-label">My Hard Rule, restated</label>
        <div class="rule-echo-box"><div class="clause-text">"${esc(hard)}"</div></div>
        <label class="chk-row">
          <input type="checkbox" id="ciAck" />
          <span>I have read my rule out loud.</span>
        </label>
      </div>

      <button class="btn primary" id="genBtn" style="margin-top:1.8em">Generate my Check-In</button>
    </div>`;

  const toggles = {};
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      document.querySelectorAll(`.toggle-btn[data-id="${id}"]`).forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      toggles[id] = btn.dataset.value;
    });
  });

  document.getElementById("genBtn").addEventListener("click", () => {
    const niyyah = document.getElementById("ciNiyyah").value.trim();
    const plan = document.getElementById("ciPlan").value.trim();
    const ack = document.getElementById("ciAck").checked;
    if(!niyyah || !plan || !toggles.sleep || !toggles.fajr || !toggles.motive || !ack){
      alert("Fill in every field, answer all three state checks, and confirm you read your rule out loud.");
      return;
    }
    const record = {
      dateISO: new Date().toISOString(),
      name: contract.name,
      niyyah, plan,
      sleep: toggles.sleep, fajr: toggles.fajr, motive: toggles.motive,
      hardRule: hard,
    };
    try{ localStorage.setItem("niyyah_checkin", JSON.stringify(record)); }catch(_){}
    renderCheckInDoc(record);
  });
}

function checkinDocInnerHtml(record){
  return `
    <div class="paper-head">
      <div class="kicker">Paper One &middot; Before The Session</div>
      <h1>The Check-In</h1>
      <div class="who">${esc(record.name)}</div>
      <div class="when">${fmtDate(record.dateISO)}</div>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Niyyah Today</div>
      <p>${esc(record.niyyah)}</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Plan</div>
      <p style="white-space:pre-line">${esc(record.plan)}</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My State</div>
      <p>Slept enough: <strong style="color:var(--cream)">${record.sleep === "yes" ? "Yes" : "No"}</strong></p>
      <p>Prayed Fajr: <strong style="color:var(--cream)">${record.fajr === "yes" ? "Yes" : "No"}</strong></p>
      <p>Trading today to: <strong style="color:var(--cream)">${record.motive === "well" ? "Trade well" : "Win something back"}</strong></p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Hard Rule, Restated</div>
      <div class="doc-clause"><div class="clause-text">"${esc(record.hardRule)}"</div></div>
      <p>Read out loud: <strong style="color:var(--cream)">Yes</strong></p>
    </div>

    <div class="sig-line">
      <div class="name">${esc(record.name)}</div>
      <div class="date">${fmtDate(record.dateISO)}</div>
    </div>
  `;
}

function renderCheckInDoc(record){
  app.innerHTML = `
    <div class="wrap fx-slow" style="padding:88px 0 40px">
      <div class="paper" id="finalPaper">${checkinDocInnerHtml(record)}</div>
      <div style="max-width:600px;margin:1.6em auto 0">
        <button class="btn primary" id="downloadBtn">Download your Check-In</button>
      </div>
      <div style="max-width:600px;margin:.8em auto 0;display:flex;gap:20px;justify-content:center">
        <button type="button" class="back-link" id="redoBtn">Fill in again</button>
        <button type="button" class="back-link" id="menuBtn">Back to your papers</button>
      </div>
      <div id="handoff" hidden></div>
    </div>`;
  document.getElementById("downloadBtn").addEventListener("click", () => {
    exportCheckInPNG(record);
    revealHandoff();
  });
  document.getElementById("redoBtn").addEventListener("click", () => {
    localStorage.removeItem("niyyah_checkin");
    renderCheckInForm();
  });
  document.getElementById("menuBtn").addEventListener("click", renderMenu);
}

/* ---------- Paper Two: The Check-Out ---------- */

function renderCheckOutForm(){
  let prevBroken = "";
  try{
    const prev = JSON.parse(localStorage.getItem("niyyah_checkout") || "null");
    if(prev && prev.brokenClause) prevBroken = prev.brokenClause;
  }catch(_){}

  const rows = [
    { id: "hard", label: "My Hard Rule", text: contract.rules.hard, q: "Followed?" },
    { id: "daily", label: "My Daily Rule", text: contract.rules.daily, q: "Followed?" },
    { id: "recovery", label: "My Recovery Rule", text: contract.rules.recovery, q: "Followed, or not triggered?" },
    { id: "deed", label: "My Deed", text: contract.deed, q: "Done?" },
    { id: "leaving", label: "My Leaving", text: contract.leaving, q: "Avoided?" },
  ];

  app.innerHTML = `
    <div class="stage fx-in">
      <div class="wiz-kicker">Paper Two</div>
      <h1 class="wiz-title">The Check-Out</h1>
      <p class="wiz-help">After the session. This is the <em>muhasabah</em> — the self-accounting — the whole thing depends on.</p>

      <div class="wiz-kicker" style="margin-top:.4em">The Grade</div>
      ${rows.map(r => `
        <div class="grade-row" data-row="${r.id}">
          <div class="rule-echo">"${esc(r.text)}"</div>
          <div class="g-question">${esc(r.label)} &mdash; ${r.q}</div>
          <div class="score-picker" data-id="${r.id}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="score-btn" data-id="${r.id}" data-val="${n}">${n}</button>`).join("")}</div>
        </div>`).join("")}
      <div class="grade-row" data-row="honesty" style="border-bottom:none">
        <div class="g-question">Honesty &mdash; was I fully honest on this paper today?</div>
        <div class="score-picker" data-id="honesty">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="score-btn" data-id="honesty" data-val="${n}">${n}</button>`).join("")}</div>
      </div>

      <div class="grade-total"><span class="label">Daily total</span><span class="value" id="totalVal">0 / 30</span></div>

      <div class="field" style="margin-top:1.8em">
        <label class="f-label">One sentence — where did the nafs show up today?</label>
        <input type="text" id="coSentence" placeholder="e.g. Impatience, twenty minutes before close." />
      </div>

      <div class="field">
        <label class="f-label">If I broke my Hard Rule, that same day I will</label>
        <textarea id="coBroken" placeholder="e.g. Message my witness before the market closes.">${esc(prevBroken)}</textarea>
      </div>

      <button class="btn primary" id="genBtn" style="margin-top:1.4em">Generate my Check-Out</button>
    </div>`;

  const scores = {};
  function updateTotal(){
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    document.getElementById("totalVal").textContent = `${sum} / 30`;
  }
  document.querySelectorAll(".score-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      document.querySelectorAll(`.score-btn[data-id="${id}"]`).forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      scores[id] = Number(btn.dataset.val);
      updateTotal();
    });
  });

  document.getElementById("genBtn").addEventListener("click", () => {
    const sentence = document.getElementById("coSentence").value.trim();
    const brokenClause = document.getElementById("coBroken").value.trim();
    const need = ["hard", "daily", "recovery", "deed", "leaving", "honesty"];
    const allScored = need.every(k => scores[k]);
    if(!allScored || !sentence || !brokenClause){
      alert("Score all six lines, add your one sentence, and write your broken-rule clause.");
      return;
    }
    const total = need.reduce((sum, k) => sum + scores[k], 0);
    const record = {
      dateISO: new Date().toISOString(),
      name: contract.name,
      scores: { hard: scores.hard, daily: scores.daily, recovery: scores.recovery, deed: scores.deed, leaving: scores.leaving, honesty: scores.honesty },
      total, sentence, brokenClause,
      hardRuleText: contract.rules.hard, dailyRuleText: contract.rules.daily, recoveryRuleText: contract.rules.recovery,
      deedText: contract.deed, leavingText: contract.leaving,
    };
    try{ localStorage.setItem("niyyah_checkout", JSON.stringify(record)); }catch(_){}
    renderCheckOutDoc(record);
  });
}

function checkoutDocInnerHtml(record){
  const rows = [
    ["My Hard Rule", record.hardRuleText, record.scores.hard],
    ["My Daily Rule", record.dailyRuleText, record.scores.daily],
    ["My Recovery Rule", record.recoveryRuleText, record.scores.recovery],
    ["My Deed", record.deedText, record.scores.deed],
    ["My Leaving", record.leavingText, record.scores.leaving],
  ];
  return `
    <div class="paper-head">
      <div class="kicker">Paper Two &middot; After The Session</div>
      <h1>The Check-Out</h1>
      <div class="who">${esc(record.name)}</div>
      <div class="when">${fmtDate(record.dateISO)}</div>
    </div>

    <div class="doc-section">
      <div class="sec-label">The Grade</div>
      <table class="doc-grade-table">
        ${rows.map(([label, text, score]) => `<tr><td>${esc(label)} &mdash; "${esc(text)}"</td><td>${score}/5</td></tr>`).join("")}
        <tr><td>Honesty &mdash; was I fully honest on this paper today?</td><td>${record.scores.honesty}/5</td></tr>
      </table>
      <p style="margin-top:.8em">Daily total: <strong style="color:var(--cream)">${record.total} / 30</strong></p>
    </div>

    <div class="doc-section">
      <div class="sec-label">One Sentence</div>
      <p>Where the nafs showed up today: <em style="color:var(--cream)">${esc(record.sentence)}</em></p>
    </div>

    <div class="doc-section">
      <div class="sec-label">If I Broke My Hard Rule</div>
      <p><em style="color:var(--cream)">${esc(record.brokenClause)}</em></p>
    </div>

    <div class="sig-line">
      <div class="name">${esc(record.name)}</div>
      <div class="date">${fmtDate(record.dateISO)}</div>
    </div>
  `;
}

function renderCheckOutDoc(record){
  app.innerHTML = `
    <div class="wrap fx-slow" style="padding:88px 0 40px">
      <div class="paper" id="finalPaper">${checkoutDocInnerHtml(record)}</div>
      <div style="max-width:600px;margin:1.6em auto 0">
        <button class="btn primary" id="downloadBtn">Download your Check-Out</button>
      </div>
      <div style="max-width:600px;margin:.8em auto 0;display:flex;gap:20px;justify-content:center">
        <button type="button" class="back-link" id="redoBtn">Fill in again</button>
        <button type="button" class="back-link" id="menuBtn">Back to your papers</button>
      </div>
      <div id="handoff" hidden></div>
    </div>`;
  document.getElementById("downloadBtn").addEventListener("click", () => {
    exportCheckOutPNG(record);
    revealHandoff();
  });
  document.getElementById("redoBtn").addEventListener("click", () => {
    localStorage.removeItem("niyyah_checkout");
    renderCheckOutForm();
  });
  document.getElementById("menuBtn").addEventListener("click", renderMenu);
}

/* ---------- Shared closing handoff ---------- */

function revealHandoff(){
  const el = document.getElementById("handoff");
  if(!el || !el.hidden) return;
  el.hidden = false;
  el.className = "turn fx-in";
  el.innerHTML = `
    <p>Your paper is downloading.</p>
    <p style="font-family:var(--sans);font-style:normal;font-size:.92rem;color:var(--muted)">Post the contract once. Use these two every day — check in before you trade, check out when you're done. Not motivation — <em style="color:var(--gold-hi)">muhasabah</em>, the self-accounting that catches the nafs on paper before it costs you in the account.</p>
    <a class="btn ghost" href="papers.html" style="margin-top:1em">Back to your papers</a>
  `;
}

/* ---------- PNG exports (shared engine in assets/canvas-doc.js) ---------- */

function exportCheckInPNG(record){
  const b = DocRender.createBuilder();
  const { COLOR, SERIF, SANS } = DocRender;

  b.kicker("Paper One · Before The Session", COLOR.muted2, "center");
  b.heading("The Check-In", `500 48px ${SERIF}`, COLOR.cream, 30, 26, "center");
  b.heading(record.name, `italic 300 26px ${SERIF}`, COLOR.goldHi, 0, 10, "center");
  b.paragraph(fmtDate(record.dateISO), { font: `300 20px ${SANS}`, color: COLOR.muted2, lineHeight: 26, align: "center", gapAfter: 0 });
  b.divider(30, 10);

  b.sectionLabel("My Niyyah Today");
  b.paragraph(record.niyyah, { color: COLOR.muted });

  b.sectionLabel("My Plan");
  record.plan.split(/\n+/).filter(Boolean).forEach(line => b.paragraph(line, { color: COLOR.muted, gapAfter: 4 }));

  b.sectionLabel("My State");
  b.paragraph(`Slept enough: ${record.sleep === "yes" ? "Yes" : "No"}`, { color: COLOR.muted });
  b.paragraph(`Prayed Fajr: ${record.fajr === "yes" ? "Yes" : "No"}`, { color: COLOR.muted });
  b.paragraph(`Trading today to: ${record.motive === "well" ? "Trade well" : "Win something back"}`, { color: COLOR.muted });

  b.sectionLabel("My Hard Rule, Restated");
  b.paragraph(`“${record.hardRule}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 6 });
  b.paragraph("Read out loud: Yes", { color: COLOR.muted });

  b.divider(20, 0);
  b.signatureLine(record.name, fmtDate(record.dateISO));

  DocRender.renderAndDownload(b, "niyyah-checkin.png");
}

function exportCheckOutPNG(record){
  const b = DocRender.createBuilder();
  const { COLOR, SERIF, SANS } = DocRender;

  b.kicker("Paper Two · After The Session", COLOR.muted2, "center");
  b.heading("The Check-Out", `500 48px ${SERIF}`, COLOR.cream, 30, 26, "center");
  b.heading(record.name, `italic 300 26px ${SERIF}`, COLOR.goldHi, 0, 10, "center");
  b.paragraph(fmtDate(record.dateISO), { font: `300 20px ${SANS}`, color: COLOR.muted2, lineHeight: 26, align: "center", gapAfter: 0 });
  b.divider(30, 10);

  b.sectionLabel("The Grade");
  b.gradeLine(`My Hard Rule — "${record.hardRuleText}"`, `${record.scores.hard}/5`);
  b.gradeLine(`My Daily Rule — "${record.dailyRuleText}"`, `${record.scores.daily}/5`);
  b.gradeLine(`My Recovery Rule — "${record.recoveryRuleText}"`, `${record.scores.recovery}/5`);
  b.gradeLine(`My Deed — "${record.deedText}"`, `${record.scores.deed}/5`);
  b.gradeLine(`My Leaving — "${record.leavingText}"`, `${record.scores.leaving}/5`);
  b.gradeLine("Honesty — was I fully honest on this paper today?", `${record.scores.honesty}/5`);
  b.paragraph(`Daily total: ${record.total} / 30`, { font: `300 24px ${SANS}`, color: COLOR.cream, lineHeight: 30, gapAfter: 6 });

  b.sectionLabel("One Sentence");
  b.paragraph(`Where the nafs showed up today: “${record.sentence}”`, { color: COLOR.muted });

  b.sectionLabel("If I Broke My Hard Rule");
  b.paragraph(`“${record.brokenClause}”`, { font: `italic 300 24px ${SERIF}`, color: COLOR.cream });

  b.divider(20, 0);
  b.signatureLine(record.name, fmtDate(record.dateISO));

  DocRender.renderAndDownload(b, "niyyah-checkout.png");
}

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  app = document.getElementById("app");
  if(!contract){ renderNoContract(); return; }
  renderMenu();
});

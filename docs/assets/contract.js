/* Niyyah — The Contract. A guided covenant the member writes themselves.
   Structure and gravity are ours; the words are theirs. Nothing here is
   pre-signed on their behalf. Signed once — a standing covenant, no end
   date. Daily tracking lives in the papers (papers.html), not here. */

const PATTERN_LABEL = {
  impatience: "Impatience", greed: "Greed", fear: "Fear", pride: "Pride", despair: "Despair",
};

const RULE_EXAMPLES = {
  greed: {
    hard: [
      "I will never add to a losing position.",
      "I will never increase my size after a winning trade without a written reason.",
      "I will never move a profit target further away once price is near it.",
    ],
    daily: [
      "I will set a daily profit cap and stop trading the moment I hit it, win or lose.",
      "I will check my size against my written plan out loud before every entry.",
      "I will write down my target before the trade and not touch it once the trade is live.",
    ],
    recovery: [
      "After two losses, I am done. I close the platform and I do not reopen it.",
      "After a big win, I trade the next day at my normal size, not my excited size.",
      "After any day I break my size rule, I trade half size for the next three days.",
    ],
  },
  fear: {
    hard: [
      "I will never close a valid trade before my planned exit out of fear alone.",
      "I will never skip a setup that meets every rule I've written.",
      "I will never reduce my size below my plan just because I'm nervous.",
    ],
    daily: [
      "I will take the first valid setup of the day without waiting for a confirmation I didn't ask for.",
      "I will state my stop and target out loud before I enter, so the trade has a shape before it has a feeling.",
      "I will place my full planned size on every valid setup, not a smaller 'test' size.",
    ],
    recovery: [
      "After a loss, I take the next valid setup at full planned size, not reduced size.",
      "After a scary day, I review the trades on paper before I decide anything about tomorrow.",
      "After three trades I hesitated on, I stop for the day rather than force a fourth.",
    ],
  },
  impatience: {
    hard: [
      "I will never enter a trade before my setup fully confirms.",
      "I will never take a trade outside my written strategy out of boredom.",
      "I will never open a new position within five minutes of closing one out of restlessness.",
    ],
    daily: [
      "I will read my entry checklist out loud before every trade, no exceptions.",
      "I will set a maximum number of trades for the day and stop the moment I hit it.",
      "I will wait for my setup's confirmation candle to fully close before I touch the entry button.",
    ],
    recovery: [
      "After a loss, I wait a full fifteen minutes before I look at another chart.",
      "After I catch myself entering early, I close the trade and write down what I felt right before the click.",
      "After a day where I overtraded, the next day's maximum is cut in half.",
    ],
  },
  pride: {
    hard: [
      "I will exit at my stop loss every time it is hit, without moving it.",
      "I will never add to a losing trade to avoid admitting I was wrong.",
      "I will never take a setup with 'my own tweak' when the plan already had one.",
    ],
    daily: [
      "I will write what the trade actually did, not what I meant it to do, every single day.",
      "I will take every setup exactly as my plan wrote it, with no personal tweak.",
      "I will ask one person to check my process weekly, and listen without defending it.",
    ],
    recovery: [
      "After a loss, I write the honest reason in one sentence before I take another trade.",
      "After I catch myself defending a bad trade, I stop trading for the rest of the session.",
      "After being shown a real mistake, I say 'you're right' before I say anything else.",
    ],
  },
  despair: {
    hard: [
      "I will never skip my journal, even on the days I don't want to look at it.",
      "I will never decide the plan is broken based on one bad week.",
      "I will never trade without doing my deed clause first.",
    ],
    daily: [
      "I will take one trade a day exactly to plan, regardless of mood.",
      "I will complete the daily review even on the days I don't want to look at it.",
      "I will message my witness before I make any decision about quitting.",
    ],
    recovery: [
      "After a losing week, I bring it to my witness before I decide anything about quitting.",
      "After a day I wanted to skip, I still open the platform and write one honest line.",
      "After three red days in a row, I take the next day off on purpose, not out of hopelessness.",
    ],
  },
};

const MIRROR_HINT = {
  greed: "after you're already up, when your size grows and your stop moves",
  fear: "the moment a trade is finally right and something in you shrinks the plan",
  impatience: "in the gap between finishing your analysis and waiting for it to be true",
  pride: "the half-second after a trade goes wrong, when it stops being your fault",
  despair: "as a slow withdrawal — the journal stops, the review stops",
};

let diag = null;
try{ diag = JSON.parse(localStorage.getItem("niyyah_diagnosis") || "null"); }catch(_){}

const state = {
  primary: (diag && diag.primary) || "greed",
  secondary: (diag && diag.secondary) || "fear",
  vision: { trader: "", man: "", servant: "" },
  primaryEnters: "",
  secondaryEnters: "",
  rules: { hard: "", daily: "", recovery: "" },
  life: [{ area: "", action: "" }],
  deed: "",
  leaving: "",
  witness: "",
  name: "",
  ack: false,
};

const STEP_COUNT = 8;
let stepIdx = 0;
let app;

function esc(s){
  return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function stepChrome(kicker, title, help, bodyHtml, opts){
  opts = opts || {};
  const backBtn = stepIdx > 0 && !opts.noBack ? `<button class="back-link" id="backBtn">&larr; Back</button>` : `<span></span>`;
  return `
    <div class="stage fx-in" id="stepStage">
      <div class="step-nav">
        ${backBtn}
        <span class="step-count">Step ${stepIdx + 1} of ${STEP_COUNT}</span>
      </div>
      <div class="wiz-kicker">${kicker}</div>
      <h1 class="wiz-title">${title}</h1>
      ${help ? `<p class="wiz-help">${help}</p>` : ""}
      ${bodyHtml}
    </div>`;
}

function goStep(delta){
  const stage = document.getElementById("stepStage");
  if(stage){ stage.classList.remove("fx-in"); stage.classList.add("fx-out"); }
  setTimeout(() => {
    stepIdx += delta;
    renderStep();
    window.scrollTo(0,0);
  }, delta > 0 ? 220 : 0);
}

function bindNav(onNext){
  const back = document.getElementById("backBtn");
  if(back) back.addEventListener("click", () => goStep(-1));
  const next = document.getElementById("nextBtn");
  if(next) next.addEventListener("click", () => { if(onNext()) goStep(1); });
}

/* ---------- Step renderers ---------- */

function renderStep(){
  const renderers = [
    renderDeclaration, renderVision, renderPatterns, renderRules,
    renderLife, renderDeen, renderWitness, renderSignature,
  ];
  renderers[stepIdx]();
}

function renderDeclaration(){
  app.innerHTML = stepChrome("The Declaration", "Read this before you write anything.", "", `
    <div class="decl-text">
      <p>I am entering this contract with my eyes open. My results in the market are downstream of my discipline, not my strategy — I have been shown my patterns, and I no longer get to say I didn't know.</p>
      <p>This contract is between me and <em>Allah</em> before it is between me and any group, any room, or any brother watching. What I write here is a covenant, not a caption.</p>
      <p>A contract written casually will be broken casually. I am taking the next fifteen minutes seriously, because what I sign today does not come with an expiration date.</p>
    </div>
    <button class="btn primary" id="nextBtn" disabled style="margin-top:2em">Continue</button>
  `, { noBack: true });
  const btn = document.getElementById("nextBtn");
  let secs = 5;
  btn.textContent = `Continue (${secs})`;
  const timer = setInterval(() => {
    secs -= 1;
    if(secs <= 0){
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "Continue";
    }else{
      btn.textContent = `Continue (${secs})`;
    }
  }, 1000);
  btn.addEventListener("click", () => goStep(1));
}

function renderVision(){
  app.innerHTML = stepChrome("The Vision", "Where you see yourself, inshAllah.", "<em>InshAllah</em> — \"if Allah wills.\" Not slogans — a real picture of who you're becoming. One example under each prompt to set the register; the answer has to be yours.", `
    <div class="field">
      <label class="f-label">As a trader</label>
      <p class="hint" style="margin-bottom:.5em">e.g. Someone who takes the setups on his plan and leaves the rest alone, win or lose.</p>
      <textarea id="visionTrader" placeholder="The trader I am becoming, inshAllah:">${esc(state.vision.trader)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">As a man</label>
      <p class="hint" style="margin-bottom:.5em">e.g. Someone whose word is the same in the group chat as it is at home.</p>
      <textarea id="visionMan" placeholder="The man my family and brothers will know, inshAllah:">${esc(state.vision.man)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">As a servant</label>
      <p class="hint" style="margin-bottom:.5em">e.g. Praying on time without being chased into it, and asking forgiveness before I ask for anything else.</p>
      <textarea id="visionServant" placeholder="Where I stand with Allah, inshAllah:">${esc(state.vision.servant)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindNav(() => {
    state.vision.trader = document.getElementById("visionTrader").value.trim();
    state.vision.man = document.getElementById("visionMan").value.trim();
    state.vision.servant = document.getElementById("visionServant").value.trim();
    if(!state.vision.trader || !state.vision.man || !state.vision.servant){
      alert("All three — trader, man, servant — are required.");
      return false;
    }
    return true;
  });
}

function renderPatterns(){
  app.innerHTML = stepChrome("My Patterns", "Name where they enter.", "Your diagnosis found these two. Complete each clause in your own words — not ours.", `
    <div class="field">
      <label class="f-label">My primary pattern</label>
      <p class="quote" style="font-family:var(--serif);font-style:italic;color:var(--gold-hi);font-size:1.2rem;margin-bottom:.6em">${PATTERN_LABEL[state.primary]}</p>
      <label class="f-label">...and it enters when</label>
      <textarea id="primaryEnters" placeholder="e.g. ${esc(MIRROR_HINT[state.primary])}">${esc(state.primaryEnters)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">My secondary pattern</label>
      <p class="quote" style="font-family:var(--serif);font-style:italic;color:var(--gold-hi);font-size:1.2rem;margin-bottom:.6em">${PATTERN_LABEL[state.secondary]}</p>
      <label class="f-label">...and it enters when</label>
      <textarea id="secondaryEnters" placeholder="e.g. ${esc(MIRROR_HINT[state.secondary])}">${esc(state.secondaryEnters)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindNav(() => {
    state.primaryEnters = document.getElementById("primaryEnters").value.trim();
    state.secondaryEnters = document.getElementById("secondaryEnters").value.trim();
    if(!state.primaryEnters || !state.secondaryEnters){
      alert("Finish both clauses in your own words before continuing.");
      return false;
    }
    return true;
  });
}

function chipsHtml(list, targetId){
  return `<div class="suggestions">${list.map(t => `<button type="button" class="chip" data-target="${targetId}" data-text="${esc(t)}">${t}</button>`).join("")}</div>`;
}

function renderRules(){
  const ex = RULE_EXAMPLES[state.primary];
  app.innerHTML = stepChrome("My Trading Rules", "Exactly three. No more, no fewer.", "Each is a different kind of rule. Use the examples for inspiration, but write your own — it has to be your sentence to hold.", `
    <div class="rule-slot">
      <div class="kind">The Hard Rule</div>
      <h3>An absolute "I will never," aimed at your primary pattern.</h3>
      ${chipsHtml(ex.hard, "hardRule")}
      <textarea id="hardRule" placeholder="I will never...">${esc(state.rules.hard)}</textarea>
    </div>
    <div class="rule-slot">
      <div class="kind">The Daily Rule</div>
      <h3>A process you follow every single day.</h3>
      ${chipsHtml(ex.daily, "dailyRule")}
      <textarea id="dailyRule" placeholder="I will always...">${esc(state.rules.daily)}</textarea>
    </div>
    <div class="rule-slot">
      <div class="kind">The Recovery Rule</div>
      <h3>What you do after a loss or a red day.</h3>
      ${chipsHtml(ex.recovery, "recoveryRule")}
      <textarea id="recoveryRule" placeholder="After...">${esc(state.rules.recovery)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById(chip.dataset.target).value = chip.dataset.text;
    });
  });
  bindNav(() => {
    state.rules.hard = document.getElementById("hardRule").value.trim();
    state.rules.daily = document.getElementById("dailyRule").value.trim();
    state.rules.recovery = document.getElementById("recoveryRule").value.trim();
    if(!state.rules.hard || !state.rules.daily || !state.rules.recovery){
      alert("All three rules are required — hard, daily, and recovery.");
      return false;
    }
    return true;
  });
}

function lifeRowHtml(row, i){
  return `
    <div class="life-row" data-i="${i}">
      <div class="row-head"><span>Area ${i + 1}</span>${state.life.length > 1 ? `<button type="button" class="remove" data-i="${i}">Remove</button>` : ""}</div>
      <div class="field">
        <label class="f-label">Area</label>
        <input type="text" class="life-area" data-i="${i}" placeholder="e.g. Marriage, sleep, prayer, anger" value="${esc(row.area)}" />
      </div>
      <div class="field">
        <label class="f-label">One concrete weekly action</label>
        <input type="text" class="life-action" data-i="${i}" placeholder="e.g. One evening a week, phone off" value="${esc(row.action)}" />
      </div>
    </div>`;
}

function renderLife(){
  app.innerHTML = stepChrome("My Life", "Trading is not the only place discipline is missing.", "Up to two areas outside the charts. Each needs a concrete weekly action — an area with no action doesn't count.", `
    <div id="lifeRows">${state.life.map(lifeRowHtml).join("")}</div>
    ${state.life.length < 2 ? `<button type="button" class="btn ghost small" id="addLife">+ Add another area</button>` : ""}
    <button class="btn primary" id="nextBtn" style="margin-top:1.6em">Continue</button>
  `);
  const addBtn = document.getElementById("addLife");
  if(addBtn) addBtn.addEventListener("click", () => {
    state.life.push({ area: "", action: "" });
    syncLifeFromDom();
    renderLife();
  });
  document.querySelectorAll(".life-row .remove").forEach(btn => {
    btn.addEventListener("click", () => {
      syncLifeFromDom();
      state.life.splice(Number(btn.dataset.i), 1);
      renderLife();
    });
  });
  bindNav(() => {
    syncLifeFromDom();
    for(const row of state.life){
      if((row.area && !row.action) || (!row.area && row.action)){
        alert("Every area needs its action, and every action needs its area.");
        return false;
      }
    }
    state.life = state.life.filter(r => r.area && r.action);
    if(state.life.length === 0) state.life = [{ area: "", action: "" }];
    return true;
  });
}
function syncLifeFromDom(){
  document.querySelectorAll(".life-area").forEach(inp => { state.life[Number(inp.dataset.i)].area = inp.value.trim(); });
  document.querySelectorAll(".life-action").forEach(inp => { state.life[Number(inp.dataset.i)].action = inp.value.trim(); });
}

function renderDeen(){
  app.innerHTML = stepChrome("My Deen", "Taking on, and leaving off.", "<em>Deen</em> — the way of life; the discipline of practice, not just belief. These are different disciplines — the contract asks for both.", `
    <div class="field">
      <label class="f-label">The Deed — one thing you weren't doing before, or weren't doing consistently</label>
      <p class="hint" style="margin-bottom:.5em">Praying on time. Daily Qur'an. <em>Istighfar</em> (asking forgiveness). Calling your mother.</p>
      <textarea id="deed" placeholder="I will...">${esc(state.deed)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">The Leaving — one thing you commit to reducing or leaving</label>
      <p class="hint" style="margin-bottom:.5em">Backbiting. Doom-scrolling. Music in the car. Whatever is true for you.</p>
      <textarea id="leaving" placeholder="I will leave...">${esc(state.leaving)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindNav(() => {
    state.deed = document.getElementById("deed").value.trim();
    state.leaving = document.getElementById("leaving").value.trim();
    if(!state.deed || !state.leaving){
      alert("Both the deed and the leaving are required.");
      return false;
    }
    return true;
  });
}

function renderWitness(){
  app.innerHTML = stepChrome("My Witness", "This contract does not hold itself.", "The brother or room that will actually hold you to this — pulled back into the Discord.", `
    <div class="field">
      <label class="f-label">This contract is witnessed by</label>
      <input type="text" id="witness" placeholder="Name, or the name of your room" value="${esc(state.witness)}" />
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindNav(() => {
    state.witness = document.getElementById("witness").value.trim();
    if(!state.witness){ alert("Name your witness."); return false; }
    return true;
  });
}

function renderSignature(){
  app.innerHTML = stepChrome("Signature", "Sign it.", "", `
    <div class="field">
      <label class="f-label">Your full name</label>
      <input type="text" id="sigName" placeholder="Type your full name" value="${esc(state.name)}" autocomplete="name" />
    </div>
    <label class="chk-row">
      <input type="checkbox" id="sigAck" ${state.ack ? "checked" : ""} />
      <span>No one is watching me sign this except Allah. This contract is real.</span>
    </label>
    <button class="btn primary" id="signBtn" disabled style="margin-top:1.8em">Sign the contract</button>
  `);
  const nameInput = document.getElementById("sigName");
  const ackInput = document.getElementById("sigAck");
  const signBtn = document.getElementById("signBtn");
  function checkReady(){ signBtn.disabled = !(nameInput.value.trim().length > 1 && ackInput.checked); }
  nameInput.addEventListener("input", checkReady);
  ackInput.addEventListener("change", checkReady);
  checkReady();
  const back = document.getElementById("backBtn");
  if(back) back.addEventListener("click", () => goStep(-1));
  signBtn.addEventListener("click", () => {
    state.name = nameInput.value.trim();
    state.ack = true;
    signContract();
  });
}

/* ---------- Signing + final document ---------- */

function signContract(){
  const record = { ...state, signedAt: new Date().toISOString() };
  try{ localStorage.setItem("niyyah_contract", JSON.stringify(record)); }catch(_){}
  renderSignedCeremony(record);
}

function renderSignedCeremony(record){
  app.innerHTML = `<div class="stage" style="text-align:center;opacity:.4"><p class="gloss" style="margin-top:2em">Sealing your contract&hellip;</p></div>`;
  setTimeout(() => {
    renderDocument(record);
  }, 900);
}

function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function documentInnerHtml(record){
  return `
    <div class="paper-head">
      <div class="kicker">The Contract</div>
      <h1>Niyyah</h1>
      <div class="who">${esc(record.name)}</div>
      <div class="when">Signed ${fmtDate(record.signedAt)}</div>
    </div>

    <div class="doc-section">
      <div class="sec-label">The Vision</div>
      <p><strong style="color:var(--cream)">As a trader:</strong> ${esc(record.vision.trader)}</p>
      <p><strong style="color:var(--cream)">As a man:</strong> ${esc(record.vision.man)}</p>
      <p><strong style="color:var(--cream)">As a servant:</strong> ${esc(record.vision.servant)}</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Patterns</div>
      <p><strong style="color:var(--cream)">${PATTERN_LABEL[record.primary]}</strong> enters when ${esc(record.primaryEnters)}</p>
      <p><strong style="color:var(--cream)">${PATTERN_LABEL[record.secondary]}</strong> enters when ${esc(record.secondaryEnters)}</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Trading Rules</div>
      <div class="doc-clause"><div class="clause-kind">The Hard Rule</div><div class="clause-text">"${esc(record.rules.hard)}"</div></div>
      <div class="doc-clause"><div class="clause-kind">The Daily Rule</div><div class="clause-text">"${esc(record.rules.daily)}"</div></div>
      <div class="doc-clause"><div class="clause-kind">The Recovery Rule</div><div class="clause-text">"${esc(record.rules.recovery)}"</div></div>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Life</div>
      ${record.life.map(r => `<p><strong style="color:var(--cream)">${esc(r.area)}</strong> — ${esc(r.action)}</p>`).join("")}
    </div>

    <div class="doc-section">
      <div class="sec-label">My Deen</div>
      <div class="doc-clause"><div class="clause-kind">The Deed</div><div class="clause-text">"${esc(record.deed)}"</div></div>
      <div class="doc-clause"><div class="clause-kind">The Leaving</div><div class="clause-text">"${esc(record.leaving)}"</div></div>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Witness</div>
      <p>This contract is witnessed by <strong style="color:var(--cream)">${esc(record.witness)}</strong>.</p>
    </div>

    <div class="sig-line">
      <div class="name">${esc(record.name)}</div>
      <div class="date">${fmtDate(record.signedAt)}</div>
    </div>
  `;
}

function renderDocument(record){
  app.innerHTML = `
    <div class="wrap fx-slow" style="padding:88px 0 40px">
      <div class="paper" id="finalPaper">${documentInnerHtml(record)}</div>
      <div style="max-width:600px;margin:1.6em auto 0">
        <button class="btn primary" id="downloadBtn">Download your contract. Post it in your room.</button>
      </div>
      <div style="max-width:600px;margin:0 auto" class="turn">
        <p>Your contract is signed. Now take your papers.</p>
        <a class="btn ghost" href="papers.html" style="margin-top:1em">Take your papers</a>
      </div>
    </div>`;
  document.getElementById("downloadBtn").addEventListener("click", () => exportContractPNG(record));
}

/* ---------- PNG export (shared engine in assets/canvas-doc.js) ---------- */

function exportContractPNG(record){
  const b = DocRender.createBuilder();
  const { COLOR, SERIF, SANS } = DocRender;

  b.kicker("The Contract", COLOR.muted2, "center");
  b.heading("Niyyah", `500 56px ${SERIF}`, COLOR.cream, 34, 30, "center");
  b.heading(record.name, `italic 300 30px ${SERIF}`, COLOR.goldHi, 0, 12, "center");
  b.paragraph(`Signed ${fmtDate(record.signedAt)}`, { font: `300 20px ${SANS}`, color: COLOR.muted2, lineHeight: 26, align: "center", gapAfter: 0 });
  b.divider(36, 10);

  b.sectionLabel("The Vision");
  b.paragraph(`As a trader: ${record.vision.trader}`, { color: COLOR.muted });
  b.paragraph(`As a man: ${record.vision.man}`, { color: COLOR.muted });
  b.paragraph(`As a servant: ${record.vision.servant}`, { color: COLOR.muted });

  b.sectionLabel("My Patterns");
  b.paragraph(`${PATTERN_LABEL[record.primary]} enters when ${record.primaryEnters}`, { color: COLOR.muted });
  b.paragraph(`${PATTERN_LABEL[record.secondary]} enters when ${record.secondaryEnters}`, { color: COLOR.muted });

  b.sectionLabel("My Trading Rules");
  b.paragraph("The Hard Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  b.paragraph(`“${record.rules.hard}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  b.paragraph("The Daily Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  b.paragraph(`“${record.rules.daily}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  b.paragraph("The Recovery Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  b.paragraph(`“${record.rules.recovery}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 4 });

  b.sectionLabel("My Life");
  record.life.forEach(r => b.paragraph(`${r.area} — ${r.action}`, { color: COLOR.muted }));

  b.sectionLabel("My Deen");
  b.paragraph("The Deed", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  b.paragraph(`“${record.deed}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  b.paragraph("The Leaving", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  b.paragraph(`“${record.leaving}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 4 });

  b.sectionLabel("My Witness");
  b.paragraph(`This contract is witnessed by ${record.witness}.`, { color: COLOR.muted });

  b.divider(20, 0);
  b.signatureLine(record.name, fmtDate(record.signedAt));

  DocRender.renderAndDownload(b, "niyyah-contract.png");
}

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  app = document.getElementById("app");
  let existing = null;
  try{ existing = JSON.parse(localStorage.getItem("niyyah_contract") || "null"); }catch(_){}
  if(existing){
    renderDocument(existing);
  }else{
    renderStep();
  }
});

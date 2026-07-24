/* Niyyah — The Contract. A guided covenant the member writes themselves.
   Structure and gravity are ours; the words are theirs. Nothing here is
   pre-signed on their behalf. */

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
  primaryEnters: "",
  secondaryEnters: "",
  rules: { hard: "", daily: "", recovery: "" },
  life: [{ area: "", action: "" }],
  deed: "",
  leaving: "",
  grade: { passing: 80, failClause: "", brokenClause: "" },
  witness: "",
  name: "",
  ack: false,
};

const STEP_COUNT = 9;
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
    renderDeclaration, renderPatterns, renderRules, renderLife,
    renderDeen, renderGrade, renderWitness, renderTerm, renderSignature,
  ];
  renderers[stepIdx]();
}

function renderDeclaration(){
  app.innerHTML = stepChrome("The Declaration", "Read this before you write anything.", "", `
    <div class="decl-text">
      <p>I am entering this contract with my eyes open. My results in the market are downstream of my discipline, not my strategy — I have been shown my patterns, and I no longer get to say I didn't know.</p>
      <p>This contract is between me and <em>Allah</em> before it is between me and any group, any room, or any brother watching. What I write here is a covenant, not a caption.</p>
      <p>A contract written casually will be broken casually. I am taking the next fifteen minutes seriously because the next twelve weeks deserve it.</p>
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

function renderGrade(){
  app.innerHTML = stepChrome("My Grade", "The scorecard this contract lives or dies by.", "Each line below is graded 1–5, every trading day. Then set your own terms.", `
    <div class="doc-section" style="border:1px solid var(--line-2);border-radius:14px;padding:1.2em 1.4em">
      <div class="grade-line"><span class="g-label">Hard Rule followed</span><span class="g-scale">1–5</span></div>
      <div class="grade-line"><span class="g-label">Daily Rule followed</span><span class="g-scale">1–5</span></div>
      <div class="grade-line"><span class="g-label">Recovery Rule followed</span><span class="g-scale">1–5</span></div>
      <div class="grade-line"><span class="g-label">The Deed done</span><span class="g-scale">1–5</span></div>
      <div class="grade-line"><span class="g-label">The Leaving held</span><span class="g-scale">1–5</span></div>
      <div class="grade-line" style="border-bottom:none"><span class="g-label">Was I honest in my check-in today?</span><span class="g-scale">1–5</span></div>
    </div>
    <div class="field" style="margin-top:1.6em">
      <label class="f-label">My passing weekly score</label>
      <input type="number" id="passing" min="1" max="100" value="${state.grade.passing}" />
      <p class="hint">Suggested: 80%.</p>
    </div>
    <div class="field">
      <label class="f-label">If I fail a week, I will</label>
      <textarea id="failClause" placeholder="e.g. Say it out loud on the Friday call.">${esc(state.grade.failClause)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">If I break my Hard Rule, that same day I will</label>
      <textarea id="brokenClause" placeholder="e.g. Message my witness before the market closes.">${esc(state.grade.brokenClause)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindNav(() => {
    state.grade.passing = Number(document.getElementById("passing").value) || 80;
    state.grade.failClause = document.getElementById("failClause").value.trim();
    state.grade.brokenClause = document.getElementById("brokenClause").value.trim();
    if(!state.grade.failClause || !state.grade.brokenClause){
      alert("Both clauses are required — what happens if you fail a week, and what happens the day you break your Hard Rule.");
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

function renderTerm(){
  app.innerHTML = stepChrome("The Term", "A contract with no end date is a wish.", "", `
    <div class="decl-text">
      <p>This contract runs for twelve weeks from the date of signature. At the end of the term, it is reviewed on a call — and either renewed, or rewritten.</p>
    </div>
    <button class="btn primary" id="nextBtn" style="margin-top:1.6em">Continue</button>
  `);
  bindNav(() => true);
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
      <div class="when">Signed ${fmtDate(record.signedAt)} &middot; Term ends ${fmtDate(new Date(new Date(record.signedAt).getTime() + 84*24*60*60*1000).toISOString())}</div>
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
      <div class="sec-label">My Grade</div>
      <table class="doc-grade-table">
        <tr><td>Hard Rule followed</td><td>1&ndash;5</td></tr>
        <tr><td>Daily Rule followed</td><td>1&ndash;5</td></tr>
        <tr><td>Recovery Rule followed</td><td>1&ndash;5</td></tr>
        <tr><td>The Deed done</td><td>1&ndash;5</td></tr>
        <tr><td>The Leaving held</td><td>1&ndash;5</td></tr>
        <tr><td>Was I honest in my check-in today?</td><td>1&ndash;5</td></tr>
      </table>
      <p style="margin-top:.8em">Passing weekly score: <strong style="color:var(--cream)">${record.grade.passing}%</strong></p>
      <p>If I fail a week: <em style="color:var(--cream)">${esc(record.grade.failClause)}</em></p>
      <p>If I break my Hard Rule: <em style="color:var(--cream)">${esc(record.grade.brokenClause)}</em></p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Witness</div>
      <p>This contract is witnessed by <strong style="color:var(--cream)">${esc(record.witness)}</strong>.</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">The Term</div>
      <p>Twelve weeks from the date of signature, then reviewed — renewed or rewritten.</p>
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
    </div>`;
  document.getElementById("downloadBtn").addEventListener("click", () => exportContractPNG(record));
}

/* ---------- PNG export ----------
   Draws the document directly onto a <canvas> with fillText/strokes —
   no drawImage of an SVG/foreignObject. That SVG-rasterization technique
   taints the canvas in Chrome (SecurityError on toDataURL) even for
   same-origin, script-free content, so it can't be used here. Pure 2D
   drawing primitives never taint the canvas, which is what makes this
   approach reliable. Runs a measure pass (no drawing) to compute the
   image height, then a draw pass at that height. */

function exportContractPNG(record){
  const W = 1080, M = 72;
  const contentW = W - M * 2;
  const COLOR = {
    bg: "#0c0a08", paper: "#151109", border: "rgba(201,163,95,.4)",
    borderSoft: "rgba(242,237,225,.14)",
    cream: "#f2ede1", muted: "#b7c2b9", muted2: "#8a9188",
    gold: "#c9a35f", goldHi: "#e8cd93",
  };
  const SERIF = `Georgia, 'Times New Roman', serif`;
  const SANS = `Arial, Helvetica, sans-serif`;

  function wrapLines(ctx, text, maxWidth){
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for(const w of words){
      const test = line ? line + " " + w : w;
      if(line && ctx.measureText(test).width > maxWidth){
        lines.push(line);
        line = w;
      }else{
        line = test;
      }
    }
    if(line) lines.push(line);
    return lines;
  }
  function spacedWidth(ctx, text, spacing){
    let w = 0;
    for(const ch of text) w += ctx.measureText(ch).width + spacing;
    return w - spacing;
  }
  function drawSpaced(ctx, text, x, y, spacing, align){
    let startX = x;
    if(align === "center") startX = x - spacedWidth(ctx, text, spacing) / 2;
    let cx = startX;
    for(const ch of text){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  }

  const ops = [];
  let y = 0;
  const push = fn => ops.push(fn);

  function heading(text, font, color, gapBefore, gapAfter, align){
    push((ctx, measuring) => {
      ctx.font = font;
      y += gapBefore;
      if(!measuring){
        ctx.fillStyle = color;
        ctx.textAlign = align || "left";
        ctx.fillText(text, align === "center" ? W / 2 : M, y);
        ctx.textAlign = "left";
      }
      y += gapAfter;
    });
  }
  function kicker(text, color, align){
    push((ctx, measuring) => {
      ctx.font = `700 18px ${SANS}`;
      y += 26;
      if(!measuring){
        ctx.fillStyle = color;
        drawSpaced(ctx, text.toUpperCase(), align === "center" ? W / 2 : M, y, 4, align);
      }
      y += 18;
    });
  }
  function paragraph(text, opts){
    opts = opts || {};
    const font = opts.font || `300 27px ${SERIF}`;
    const color = opts.color || COLOR.muted;
    const lineHeight = opts.lineHeight || 36;
    const align = opts.align || "left";
    push((ctx, measuring) => {
      ctx.font = font;
      const lines = wrapLines(ctx, text, opts.maxWidth || contentW);
      for(const line of lines){
        y += lineHeight;
        if(!measuring){
          ctx.fillStyle = color;
          ctx.textAlign = align;
          ctx.fillText(line, align === "center" ? W / 2 : M, y);
          ctx.textAlign = "left";
        }
      }
      y += opts.gapAfter != null ? opts.gapAfter : 14;
    });
  }
  function sectionLabel(text){
    push((ctx, measuring) => {
      ctx.font = `700 19px ${SANS}`;
      y += 44;
      if(!measuring){
        ctx.fillStyle = COLOR.gold;
        drawSpaced(ctx, text.toUpperCase(), M, y, 3);
      }
      y += 20;
    });
  }
  function divider(gapBefore, gapAfter, style){
    gapBefore = gapBefore == null ? 30 : gapBefore;
    gapAfter = gapAfter == null ? 30 : gapAfter;
    push((ctx, measuring) => {
      y += gapBefore;
      if(!measuring){
        ctx.strokeStyle = style || COLOR.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
      }
      y += gapAfter;
    });
  }
  function gradeLine(label){
    push((ctx, measuring) => {
      ctx.font = `300 24px ${SANS}`;
      y += 38;
      if(!measuring){
        ctx.fillStyle = COLOR.cream;
        ctx.textAlign = "left";
        ctx.fillText(label, M, y);
        ctx.fillStyle = COLOR.muted2;
        ctx.textAlign = "right";
        ctx.fillText("1–5", W - M, y);
        ctx.textAlign = "left";
      }
      y += 10;
      if(!measuring){
        ctx.strokeStyle = COLOR.borderSoft;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
      }
      y += 14;
    });
  }

  /* ---- build the document ---- */
  const term = fmtDate(new Date(new Date(record.signedAt).getTime() + 84 * 24 * 60 * 60 * 1000).toISOString());

  y += 0;
  kicker("The Contract", COLOR.muted2, "center");
  heading("Niyyah", `500 56px ${SERIF}`, COLOR.cream, 34, 30, "center");
  heading(record.name, `italic 300 30px ${SERIF}`, COLOR.goldHi, 0, 12, "center");
  paragraph(`Signed ${fmtDate(record.signedAt)}  ·  Term ends ${term}`, { font: `300 20px ${SANS}`, color: COLOR.muted2, lineHeight: 26, align: "center", gapAfter: 0 });
  divider(36, 10);

  sectionLabel("My Patterns");
  paragraph(`${PATTERN_LABEL[record.primary]} enters when ${record.primaryEnters}`, { color: COLOR.muted });
  paragraph(`${PATTERN_LABEL[record.secondary]} enters when ${record.secondaryEnters}`, { color: COLOR.muted });

  sectionLabel("My Trading Rules");
  paragraph("The Hard Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  paragraph(`“${record.rules.hard}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  paragraph("The Daily Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  paragraph(`“${record.rules.daily}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  paragraph("The Recovery Rule", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  paragraph(`“${record.rules.recovery}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 4 });

  sectionLabel("My Life");
  record.life.forEach(r => paragraph(`${r.area} — ${r.action}`, { color: COLOR.muted }));

  sectionLabel("My Deen");
  paragraph("The Deed", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  paragraph(`“${record.deed}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 16 });
  paragraph("The Leaving", { font: `700 18px ${SANS}`, color: COLOR.muted2, lineHeight: 20, gapAfter: 6 });
  paragraph(`“${record.leaving}”`, { font: `italic 300 26px ${SERIF}`, color: COLOR.cream, gapAfter: 4 });

  sectionLabel("My Grade");
  gradeLine("Hard Rule followed");
  gradeLine("Daily Rule followed");
  gradeLine("Recovery Rule followed");
  gradeLine("The Deed done");
  gradeLine("The Leaving held");
  gradeLine("Was I honest in my check-in today?");
  paragraph(`Passing weekly score: ${record.grade.passing}%`, { font: `300 24px ${SANS}`, color: COLOR.cream, lineHeight: 30, gapAfter: 6 });
  paragraph(`If I fail a week: “${record.grade.failClause}”`, { font: `italic 300 24px ${SERIF}`, color: COLOR.muted });
  paragraph(`If I break my Hard Rule: “${record.grade.brokenClause}”`, { font: `italic 300 24px ${SERIF}`, color: COLOR.muted });

  sectionLabel("My Witness");
  paragraph(`This contract is witnessed by ${record.witness}.`, { color: COLOR.muted });

  sectionLabel("The Term");
  paragraph("Twelve weeks from the date of signature, then reviewed — renewed or rewritten.", { color: COLOR.muted });

  divider(20, 0);
  push((ctx, measuring) => {
    ctx.font = `italic 300 34px ${SERIF}`;
    y += 46;
    if(!measuring){
      ctx.fillStyle = COLOR.cream;
      ctx.textAlign = "left";
      ctx.fillText(record.name, M, y);
      ctx.font = `300 20px ${SANS}`;
      ctx.fillStyle = COLOR.muted2;
      ctx.textAlign = "right";
      ctx.fillText(fmtDate(record.signedAt), W - M, y);
      ctx.textAlign = "left";
    }
  });

  /* ---- pass 1: measure ---- */
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  y = M;
  for(const op of ops) op(mctx, true);
  const totalHeight = Math.ceil(y + M);

  /* ---- pass 2: draw ---- */
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, totalHeight);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, 0, W, totalHeight);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, totalHeight - 1);
  ctx.textBaseline = "alphabetic";

  y = M;
  for(const op of ops) op(ctx, false);

  try{
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.download = "niyyah-contract.png";
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(err){
    console.warn("PNG export failed:", err);
    alert("Couldn't generate the image in this browser. Try again, or screenshot this page.");
  }
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

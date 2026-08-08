/* Niyyah — The Contract. A guided covenant the member writes themselves.
   Structure and gravity are ours; the words are theirs. Nothing here is
   pre-signed on their behalf. Signed once — a standing covenant, no end
   date. Daily tracking lives on the daily page (daily.html), not here. */

const PATTERN_LABEL = {
  impatience: "Impatience", greed: "Greed", fear: "Fear", pride: "Pride", despair: "Despair",
};

const PATTERN_ORDER = ["impatience", "greed", "fear", "pride", "despair"];

const PATTERN_DESC = {
  impatience: "You act before the setup is ready — entries, exits, decisions, all rushed.",
  greed: "Size grows and stops loosen when you're winning.",
  fear: "You hesitate on a valid trade, or cut it short, out of nerves rather than plan.",
  pride: "You won't admit the trade was wrong until it's already cost you.",
  despair: "You stop caring what happens, or stop trying, after it goes bad.",
};

const MOMENT_OPTIONS = [
  { label: "After a win", phrase: "after a win" },
  { label: "After a loss", phrase: "after a loss" },
  { label: "Before entry, waiting", phrase: "before entry, while I'm waiting" },
  { label: "When I'm flat too long", phrase: "when I'm flat too long" },
  { label: "At the end of a red day", phrase: "at the end of a red day" },
  { label: "When I'm about to hit my goal", phrase: "when I'm about to hit my goal" },
];

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

const DEED_EXAMPLES = [
  "I will pray every prayer on time, not just when it's convenient.",
  "I will read a page of Qur'an daily, even one page.",
  "I will say istighfar before my first trade of the day.",
];
const LEAVING_EXAMPLES = [
  "I will leave backbiting, even when everyone else in the room is doing it.",
  "I will leave doom-scrolling trading Twitter after a loss.",
  "I will leave music in the car on the way to trade.",
];
const LIFE_EXAMPLES = [
  { area: "Marriage", action: "One evening a week, phone off." },
  { area: "Sleep", action: "In bed by 11pm on trading nights." },
  { area: "Anger", action: "Walk outside for five minutes before I respond to anyone." },
];

/* The second Vision clause is written as a man or as a woman — the member
   chooses. The stored field stays `vision.man` so contracts signed before
   this choice existed keep loading; `selfAs` only decides the wording. */
const SELF_WORD = { man: "man", woman: "woman" };
function selfWord(selfAs){ return SELF_WORD[selfAs] || SELF_WORD.man; }
function selfPlaceholder(selfAs){
  return selfAs === "woman"
    ? "The woman my family and sisters will know, inshAllah:"
    : "The man my family and brothers will know, inshAllah:";
}

let diag = null;
try{ diag = JSON.parse(localStorage.getItem("niyyah_diagnosis") || "null"); }catch(_){}

const state = {
  primary: (diag && diag.primary) || "",
  secondary: (diag && diag.secondary) || "",
  vision: { trader: "", man: "", servant: "" },
  selfAs: "man",
  patterns: [],
  patternMoments: {},
  rules: { hard: "", daily: "", recovery: "" },
  life: [{ area: "", action: "" }],
  deed: "",
  leaving: "",
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

function bindChipFill(){
  document.querySelectorAll(".chip[data-target]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById(chip.dataset.target).value = chip.dataset.text;
    });
  });
}

function chipsHtml(list, targetId){
  return `<div class="suggestions">${list.map(t => `<button type="button" class="chip" data-target="${targetId}" data-text="${esc(t)}">${t}</button>`).join("")}</div>`;
}

/* Examples in Rules are drawn from the patterns the member actually chose
   in My Patterns (Fix 2) — not the diagnosis alone. Two patterns pool
   their examples (2 from the first, 1 from the second) so the chip row
   stays at three, not six. */
function combinedExamples(category){
  const keys = state.patterns.length ? state.patterns : [state.primary, state.secondary].filter(Boolean);
  if(keys.length === 0) return RULE_EXAMPLES.greed[category];
  if(keys.length === 1) return RULE_EXAMPLES[keys[0]][category];
  return [...RULE_EXAMPLES[keys[0]][category].slice(0, 2), ...RULE_EXAMPLES[keys[1]][category].slice(0, 1)];
}

function composeWhen(moments){
  if(moments.length === 0) return "";
  if(moments.length === 1) return moments[0];
  return `${moments[0]}, and ${moments[1]}`;
}
function patternSentence(record, key){
  const moments = ((record.patternMoments || {})[key] || {}).moments || [];
  return `I recognize ${PATTERN_LABEL[key].toLowerCase()} in myself. It enters ${composeWhen(moments)}.`;
}
function patternSentenceHtml(record, key){
  const moments = (((record.patternMoments || {})[key] || {}).moments || []).map(esc);
  return `I recognize <strong style="color:var(--cream)">${esc(PATTERN_LABEL[key].toLowerCase())}</strong> in myself. It enters ${composeWhen(moments)}.`;
}

/* ---------- Step renderers ---------- */

function renderStep(){
  const renderers = [
    renderDeclaration, renderVision, renderPatternsPick, renderPatternsMoments,
    renderRules, renderLife, renderDeen, renderWitness, renderSignature,
  ];
  renderers[stepIdx]();
}

function renderDeclaration(){
  app.innerHTML = stepChrome("The Declaration", "Read this before you write anything.", "", `
    <div class="decl-text">
      <p>I am entering this contract with my eyes open. My results in the market are downstream of my discipline, not my strategy — I have been shown my patterns, and I no longer get to say I didn't know.</p>
      <p>This contract is between me and <em>Allah</em> before it is between me and any group, any room, or anyone watching. What I write here is a covenant, not a caption.</p>
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
      <p class="hint" style="margin-bottom:.5em">e.g. Someone who takes the setups on their plan and leaves the rest alone, win or lose.</p>
      <textarea id="visionTrader" placeholder="The trader I am becoming, inshAllah:">${esc(state.vision.trader)}</textarea>
    </div>
    <div class="field">
      <label class="f-label" id="selfLabel">As a ${selfWord(state.selfAs)}</label>
      <div class="toggle-pair" style="margin-bottom:.7em">
        <button type="button" class="toggle-btn self-btn${state.selfAs === "woman" ? "" : " selected"}" data-self="man">As a man</button>
        <button type="button" class="toggle-btn self-btn${state.selfAs === "woman" ? " selected" : ""}" data-self="woman">As a woman</button>
      </div>
      <p class="hint" style="margin-bottom:.5em">e.g. Someone whose word is the same in the group chat as it is at home.</p>
      <textarea id="visionMan" placeholder="${esc(selfPlaceholder(state.selfAs))}">${esc(state.vision.man)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">As a servant</label>
      <p class="hint" style="margin-bottom:.5em">e.g. Praying on time without being chased into it, and asking forgiveness before I ask for anything else.</p>
      <textarea id="visionServant" placeholder="Where I stand with Allah, inshAllah:">${esc(state.vision.servant)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  document.querySelectorAll(".self-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selfAs = btn.dataset.self === "woman" ? "woman" : "man";
      document.querySelectorAll(".self-btn").forEach(b => b.classList.toggle("selected", b === btn));
      document.getElementById("selfLabel").textContent = `As a ${selfWord(state.selfAs)}`;
      document.getElementById("visionMan").placeholder = selfPlaceholder(state.selfAs);
    });
  });
  bindNav(() => {
    state.vision.trader = document.getElementById("visionTrader").value.trim();
    state.vision.man = document.getElementById("visionMan").value.trim();
    state.vision.servant = document.getElementById("visionServant").value.trim();
    if(!state.vision.trader || !state.vision.man || !state.vision.servant){
      alert(`All three — trader, ${selfWord(state.selfAs)}, servant — are required.`);
      return false;
    }
    return true;
  });
}

/* My Patterns — Step A: pick 1-2 patterns you recognize in yourself. */
function renderPatternsPick(){
  if(state.patterns.length === 0){
    state.patterns = [state.primary, state.secondary].filter(Boolean);
  }
  const cardsHtml = PATTERN_ORDER.map(key => {
    const seen = key === state.primary || key === state.secondary;
    return `
      <button type="button" class="pattern-card" data-pattern="${key}">
        ${seen ? `<span class="seen-badge">Seen in your diagnosis</span>` : ""}
        <h3>${PATTERN_LABEL[key]}</h3>
        <p>${PATTERN_DESC[key]}</p>
      </button>`;
  }).join("");

  app.innerHTML = stepChrome("My Patterns", "Which of these do you recognize in yourself?", "Pick one or two. Your diagnosis pointed at some of these — but this is your call, not ours.", `
    <div class="pattern-grid">${cardsHtml}</div>
    <p class="hint" style="margin-top:.8em">Choose 1 or 2.</p>
    <button class="btn primary" id="nextBtn" style="margin-top:1.2em">Continue</button>
  `);

  function refresh(){
    document.querySelectorAll(".pattern-card").forEach(card => {
      const key = card.dataset.pattern;
      const selected = state.patterns.includes(key);
      card.classList.toggle("selected", selected);
      card.classList.toggle("disabled", !selected && state.patterns.length >= 2);
    });
  }
  refresh();
  document.querySelectorAll(".pattern-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.pattern;
      if(state.patterns.includes(key)){
        state.patterns = state.patterns.filter(k => k !== key);
      }else if(state.patterns.length < 2){
        state.patterns = [...state.patterns, key];
      }
      refresh();
    });
  });

  bindNav(() => {
    if(state.patterns.length < 1){
      alert("Pick at least one pattern.");
      return false;
    }
    const nextMoments = {};
    state.patterns.forEach(k => { nextMoments[k] = state.patternMoments[k] || { moments: [] }; });
    state.patternMoments = nextMoments;
    return true;
  });
}

/* My Patterns — Step B: when does each selected pattern enter. */
function renderPatternsMoments(){
  const blocksHtml = state.patterns.map(key => {
    const entry = state.patternMoments[key];
    const customVal = entry.moments.find(m => !MOMENT_OPTIONS.some(o => o.phrase === m)) || "";
    const optsHtml = MOMENT_OPTIONS.map(o => {
      const isSel = entry.moments.includes(o.phrase);
      return `<button type="button" class="chip moment-chip ${isSel ? "selected" : ""}" data-pattern="${key}" data-phrase="${esc(o.phrase)}">${o.label}</button>`;
    }).join("");
    return `
      <div class="rule-slot" data-pattern-block="${key}">
        <div class="kind">${PATTERN_LABEL[key]}</div>
        <h3>When does it enter?</h3>
        <div class="suggestions">${optsHtml}<button type="button" class="chip custom-toggle" data-pattern="${key}">+ Write my own</button></div>
        <p class="hint">Tap up to two — or write your own.</p>
        <div class="field custom-field" data-pattern="${key}" style="margin-top:.6em;${customVal ? "" : "display:none"}">
          <input type="text" class="custom-input" data-pattern="${key}" placeholder="When it enters, in your words" value="${esc(customVal)}" />
        </div>
      </div>`;
  }).join("");

  app.innerHTML = stepChrome("My Patterns", "When does it enter?", "Up to two moments per pattern. Tap the ones that are true — or write your own.", `
    ${blocksHtml}
    <button class="btn primary" id="nextBtn">Continue</button>
  `);

  const moments = key => state.patternMoments[key].moments;
  const setMoments = (key, arr) => { state.patternMoments[key].moments = arr.slice(0, 2); };

  document.querySelectorAll(".moment-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.pattern;
      const phrase = chip.dataset.phrase;
      let m = moments(key);
      if(m.includes(phrase)) m = m.filter(x => x !== phrase);
      else if(m.length < 2) m = [...m, phrase];
      setMoments(key, m);
      renderPatternsMoments();
    });
  });
  document.querySelectorAll(".custom-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pattern;
      const field = document.querySelector(`.custom-field[data-pattern="${key}"]`);
      const show = field.style.display === "none";
      field.style.display = show ? "block" : "none";
      if(show) field.querySelector("input").focus();
    });
  });
  document.querySelectorAll(".custom-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const key = inp.dataset.pattern;
      const val = inp.value.trim();
      let m = moments(key).filter(x => MOMENT_OPTIONS.some(o => o.phrase === x));
      if(val) m = m.length < 2 ? [...m, val] : [...m.slice(0, 1), val];
      setMoments(key, m);
    });
  });

  bindNav(() => {
    for(const key of state.patterns){
      if(moments(key).length === 0){
        alert(`Add at least one moment for ${PATTERN_LABEL[key]}.`);
        return false;
      }
    }
    return true;
  });
}

function renderRules(){
  app.innerHTML = stepChrome("My Trading Rules", "Exactly three. No more, no fewer.", "Each is a different kind of rule. Use the examples for inspiration, but write your own — it has to be your sentence to hold.", `
    <div class="rule-slot">
      <div class="kind">The Hard Rule</div>
      <h3>An absolute "I will never," aimed at what you just named in My Patterns.</h3>
      ${chipsHtml(combinedExamples("hard"), "hardRule")}
      <p class="hint">Tap one to use it — or write your own.</p>
      <textarea id="hardRule" placeholder="I will never...">${esc(state.rules.hard)}</textarea>
    </div>
    <div class="rule-slot">
      <div class="kind">The Daily Rule</div>
      <h3>A process you follow every single day.</h3>
      ${chipsHtml(combinedExamples("daily"), "dailyRule")}
      <p class="hint">Tap one to use it — or write your own.</p>
      <textarea id="dailyRule" placeholder="I will always...">${esc(state.rules.daily)}</textarea>
    </div>
    <div class="rule-slot">
      <div class="kind">The Recovery Rule</div>
      <h3>What you do after a loss or a red day.</h3>
      ${chipsHtml(combinedExamples("recovery"), "recoveryRule")}
      <p class="hint">Tap one to use it — or write your own.</p>
      <textarea id="recoveryRule" placeholder="After...">${esc(state.rules.recovery)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindChipFill();
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

function applyLifeExample(ex){
  syncLifeFromDom();
  let idx = state.life.findIndex(r => !r.area && !r.action);
  if(idx === -1 && state.life.length < 2){
    state.life.push({ area: "", action: "" });
    idx = state.life.length - 1;
  }
  if(idx === -1) idx = 0;
  state.life[idx] = { area: ex.area, action: ex.action };
  renderLife();
}

function renderLife(){
  const exampleChips = `<div class="suggestions">${LIFE_EXAMPLES.map((ex, i) => `<button type="button" class="chip life-chip" data-i="${i}">${esc(ex.area)} — ${esc(ex.action)}</button>`).join("")}</div><p class="hint">Tap one to use it — or write your own.</p>`;
  app.innerHTML = stepChrome("My Life", "Trading is not the only place discipline is missing.", "Up to two areas outside the charts. Each needs a concrete weekly action — an area with no action doesn't count.", `
    ${exampleChips}
    <div id="lifeRows">${state.life.map(lifeRowHtml).join("")}</div>
    ${state.life.length < 2 ? `<button type="button" class="btn ghost small" id="addLife">+ Add another area</button>` : ""}
    <button class="btn primary" id="nextBtn" style="margin-top:1.6em">Continue</button>
  `);
  document.querySelectorAll(".life-chip").forEach(chip => {
    chip.addEventListener("click", () => applyLifeExample(LIFE_EXAMPLES[Number(chip.dataset.i)]));
  });
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
      ${chipsHtml(DEED_EXAMPLES, "deed")}
      <p class="hint">Tap one to use it — or write your own.</p>
      <textarea id="deed" placeholder="I will...">${esc(state.deed)}</textarea>
    </div>
    <div class="field">
      <label class="f-label">The Leaving — one thing you commit to reducing or leaving</label>
      ${chipsHtml(LEAVING_EXAMPLES, "leaving")}
      <p class="hint">Tap one to use it — or write your own.</p>
      <textarea id="leaving" placeholder="I will leave...">${esc(state.leaving)}</textarea>
    </div>
    <button class="btn primary" id="nextBtn">Continue</button>
  `);
  bindChipFill();
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
  const vision = record.vision || {};
  const rules = record.rules || {};
  const patterns = Array.isArray(record.patterns) ? record.patterns : [];
  const life = Array.isArray(record.life) ? record.life : [];
  return `
    <div class="paper-head">
      <div class="kicker">The Contract</div>
      <h1>Niyyah</h1>
      <div class="who">${esc(record.name)}</div>
      <div class="when">Signed ${fmtDate(record.signedAt)}</div>
    </div>

    <div class="doc-section">
      <div class="sec-label">The Vision</div>
      <p><strong style="color:var(--cream)">As a trader:</strong> ${esc(vision.trader)}</p>
      <p><strong style="color:var(--cream)">As a ${esc(selfWord(record.selfAs))}:</strong> ${esc(vision.man)}</p>
      <p><strong style="color:var(--cream)">As a servant:</strong> ${esc(vision.servant)}</p>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Patterns</div>
      ${patterns.map(k => `<p>${patternSentenceHtml(record, k)}</p>`).join("")}
    </div>

    <div class="doc-section">
      <div class="sec-label">My Trading Rules</div>
      <div class="doc-clause"><div class="clause-kind">The Hard Rule</div><div class="clause-text">"${esc(rules.hard)}"</div></div>
      <div class="doc-clause"><div class="clause-kind">The Daily Rule</div><div class="clause-text">"${esc(rules.daily)}"</div></div>
      <div class="doc-clause"><div class="clause-kind">The Recovery Rule</div><div class="clause-text">"${esc(rules.recovery)}"</div></div>
    </div>

    <div class="doc-section">
      <div class="sec-label">My Life</div>
      ${life.filter(r => r && typeof r === "object").map(r => `<p><strong style="color:var(--cream)">${esc(r.area)}</strong> — ${esc(r.action)}</p>`).join("")}
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

function copyToClipboard(text, btn){
  const original = btn.textContent;
  const done = () => {
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = original; }, 1600);
  };
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try{ document.execCommand("copy"); done(); }catch(_){}
    ta.remove();
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  }else{
    fallback();
  }
}

function renderDocument(record){
  const rules = record.rules || {};
  const dailyPayload = {
    n: record.name,
    h: rules.hard, d: rules.daily, r: rules.recovery,
    de: record.deed, le: record.leaving,
  };

  app.innerHTML = `
    <div class="wrap fx-slow" style="padding:88px 0 40px">
      <div class="paper" id="finalPaper">${documentInnerHtml(record)}</div>

      <div class="handoff" style="max-width:600px;margin:1.6em auto 0">
        <div class="handoff-step">
          <div class="handoff-num">1</div>
          <div class="handoff-body">
            <h3>Post your contract in your room.</h3>
            <p>Download the document above and share it where your witness can see it.</p>
            <button class="btn primary" id="downloadBtn">Download your contract</button>
          </div>
        </div>
        <div class="handoff-step">
          <div class="handoff-num">2</div>
          <div class="handoff-body">
            <h3>This is your daily page.</h3>
            <p>Save this link — pin it in your room, add it to your home screen. It carries your rules with it, on any device.</p>
            <div class="link-box">
              <span class="link-text" id="dailyLinkText">Preparing your link&hellip;</span>
              <button type="button" class="btn ghost small" id="copyLinkBtn" disabled>Copy</button>
            </div>
          </div>
        </div>
        <div class="handoff-step">
          <div class="handoff-num">3</div>
          <div class="handoff-body">
            <h3>Check in before every session. Check out after. Every day.</h3>
            <a class="btn ghost" id="openDailyBtn" href="/daily">Open your daily page</a>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("downloadBtn").addEventListener("click", () => exportContractPNG(record));

  // The link is built asynchronously (it gets compressed when the browser
  // supports it). If anything fails, /daily still works on this device via
  // localStorage — the link just won't carry the rules cross-device.
  const copyBtn = document.getElementById("copyLinkBtn");
  Promise.resolve(DailyLink.encode(dailyPayload)).then(code => {
    return `${location.origin}/daily#${code}`;
  }).catch(() => {
    return `${location.origin}/daily`;
  }).then(dailyLink => {
    document.getElementById("dailyLinkText").textContent = dailyLink;
    document.getElementById("openDailyBtn").href = dailyLink;
    copyBtn.disabled = false;
    copyBtn.addEventListener("click", () => copyToClipboard(dailyLink, copyBtn));
  });
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
  b.paragraph(`As a ${selfWord(record.selfAs)}: ${record.vision.man}`, { color: COLOR.muted });
  b.paragraph(`As a servant: ${record.vision.servant}`, { color: COLOR.muted });

  b.sectionLabel("My Patterns");
  record.patterns.forEach(k => b.paragraph(patternSentence(record, k), { color: COLOR.muted }));

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

/* Contracts signed on earlier versions of this page can be missing whole
   sections (vision arrived after v1, the patterns array after v2). Rendering
   the signed document from such a record used to throw before any HTML was
   written, leaving the page blank. Only render the document when the record
   actually has everything the document prints. */
function usableContract(rec){
  return !!(rec && typeof rec === "object"
    && typeof rec.name === "string" && rec.name
    && rec.signedAt
    && rec.vision && typeof rec.vision === "object"
    && Array.isArray(rec.patterns)
    && rec.rules && typeof rec.rules === "object"
    && typeof rec.rules.hard === "string"
    && Array.isArray(rec.life));
}

/* A legacy record can't be rendered as a document, but the member shouldn't
   retype what still carries over — prefill the wizard with it. */
function prefillFromLegacy(rec){
  if(!rec || typeof rec !== "object") return;
  if(rec.vision && typeof rec.vision === "object"){
    state.vision.trader = rec.vision.trader || "";
    state.vision.man = rec.vision.man || "";
    state.vision.servant = rec.vision.servant || "";
  }
  if(rec.selfAs === "woman" || rec.selfAs === "man") state.selfAs = rec.selfAs;
  if(rec.rules && typeof rec.rules === "object"){
    state.rules.hard = rec.rules.hard || "";
    state.rules.daily = rec.rules.daily || "";
    state.rules.recovery = rec.rules.recovery || "";
  }
  if(Array.isArray(rec.patterns)) state.patterns = rec.patterns.filter(k => PATTERN_LABEL[k]);
  if(rec.patternMoments && typeof rec.patternMoments === "object") state.patternMoments = rec.patternMoments;
  if(Array.isArray(rec.life) && rec.life.length){
    const rows = rec.life.filter(r => r && typeof r === "object").map(r => ({ area: r.area || "", action: r.action || "" }));
    if(rows.length) state.life = rows;
  }
  if(typeof rec.deed === "string") state.deed = rec.deed;
  if(typeof rec.leaving === "string") state.leaving = rec.leaving;
  if(typeof rec.witness === "string") state.witness = rec.witness;
  if(typeof rec.name === "string") state.name = rec.name;
}

document.addEventListener("DOMContentLoaded", () => {
  app = document.getElementById("app");
  let existing = null;
  try{ existing = JSON.parse(localStorage.getItem("niyyah_contract") || "null"); }catch(_){}
  try{
    if(usableContract(existing)){
      renderDocument(existing);
    }else{
      if(existing) prefillFromLegacy(existing);
      renderStep();
    }
  }catch(_){
    // Whatever failed, this page must never sit blank.
    try{ renderStep(); }catch(__){
      app.innerHTML = `
        <div class="stage">
          <div class="wiz-kicker">The Contract</div>
          <h1 class="wiz-title">Something went wrong loading your saved contract.</h1>
          <p class="wiz-help">Your answers are safe on this device. Reload the page to write your contract.</p>
          <a class="btn primary" href="contract.html">Reload</a>
        </div>`;
    }
  }
});

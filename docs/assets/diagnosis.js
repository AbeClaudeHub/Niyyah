/* Niyyah — The Diagnosis. Pattern-recognition instrument, not a personality quiz.
   Five patterns: impatience, greed, fear, pride, despair.

   Scoring is intensity-based, not flat:
     - a disciplined answer scores 0 on every pattern (a: null, w: 0)
     - a partial-discipline answer scores 1 on its pattern (w: 1)
     - a pattern behavior scores 2 on its pattern (w: 2)
   The two highest-scoring patterns become the Mirror's primary/secondary,
   and total intensity decides severity: heavy, moderate, or clean.
   Nothing here ever assigns identity — only "where and when this pattern
   enters," and for a clean result, nothing gets invented to fill the space. */

const PATTERN_LABEL = {
  impatience: "Impatience",
  greed: "Greed",
  fear: "Fear",
  pride: "Pride",
  despair: "Despair",
};

// Used to break ties deterministically when picking primary/secondary.
const TIE_PRIORITY = ["greed", "pride", "fear", "impatience", "despair"];
// Used to break ties when picking the lowest (strength) pattern.
const STRENGTH_PRIORITY = ["despair", "impatience", "fear", "pride", "greed"];

/* Each question keeps its original stem and format. Answer sets span a real
   spectrum: one disciplined response, two partial ones, two pattern behaviors —
   every option a different action, not a different phrasing. */
const QUESTIONS = [
  { format: "Scenario",
    q: "It's five minutes before your session starts. What's actually happening in your body?",
    opts: [
      { t: "You're already calculating what today could be if it goes right — ahead of yourself before a single candle prints.", a: "greed", w: 2 },
      { t: "Nothing dramatic. The plan is read, you know exactly what you're waiting for, and you're fine if it never shows up today.", a: null, w: 0 },
      { t: "You're ready, mostly — but you keep checking the clock, and you already know the first half hour is going to feel longer than it should.", a: "impatience", w: 1 },
      { t: "Your stomach is tight. You're re-reading yesterday's losses instead of today's plan.", a: "fear", w: 2 },
      { t: "You'll trade the plan, but there's a low hum of 'here we go again' that you push down before the open.", a: "despair", w: 1 },
    ]},
  { format: "Scenario",
    q: "You're in a live trade, thirty seconds after entry. What are your eyes doing?",
    opts: [
      { t: "On the chart, checking price against your invalidation level. If it hits the stop, it hits the stop — that was decided before you entered.", a: null, w: 0 },
      { t: "Mostly on the chart — but you've already glanced once at what this becomes if it runs past your target.", a: "greed", w: 1 },
      { t: "Confirming to yourself that this was a smart entry, before the trade has had time to be right.", a: "pride", w: 2 },
      { t: "On the chart, but flicking across other tickers too. Thirty seconds of watching one position already feels slow.", a: "impatience", w: 1 },
      { t: "Half-detached, like you're watching it happen to someone else.", a: "despair", w: 2 },
    ]},
  { format: "The next sixty seconds",
    q: "The trade just stopped out. In the next sixty seconds, what do you actually do?",
    opts: [
      { t: "Open the next chart immediately, already sizing the trade that fixes this.", a: "greed", w: 2 },
      { t: "Log it, note whether the entry was actually valid, and step away from the screen for a few minutes. The stop did its job.", a: null, w: 0 },
      { t: "Take the next setup that shows up, valid or not, just to be back in something.", a: "impatience", w: 2 },
      { t: "Follow your re-entry rules — but at smaller size. The loss wasn't supposed to change your sizing, and it just did.", a: "fear", w: 1 },
      { t: "Log it, but the note comes out reading more like a defense of the entry than a review of it.", a: "pride", w: 1 },
    ]},
  { format: "The next moment",
    q: "You just closed a winner, clean, better than expected. What happens next, honestly?",
    opts: [
      { t: "You stay at your planned size for the next trade — but you catch yourself doing the math on what today could still become.", a: "greed", w: 1 },
      { t: "You screenshot it. Some part of you is already thinking about who's going to see this.", a: "pride", w: 2 },
      { t: "You log it like any other trade and check whether a second setup from your plan actually exists. Usually it doesn't, and you're done.", a: null, w: 0 },
      { t: "You go flat and stay flat, afraid of giving it back.", a: "fear", w: 2 },
      { t: "It lands strangely flat. You know it should feel like something, and the fact that it doesn't bothers you a little.", a: "despair", w: 1 },
    ]},
  { format: "Trade-off",
    q: "Two setups look almost identical in quality. One is this week's normal size, one is bigger. Which do you actually take, and why?",
    opts: [
      { t: "The normal one. Size is a planning decision you made before the week started — not a feeling you get in the moment.", a: null, w: 0 },
      { t: "The normal one — but if you're honest, that wasn't discipline. The bigger number scared you, and the rule was just a good excuse.", a: "fear", w: 1 },
      { t: "Whichever one is in front of you right now. You don't actually check the size math.", a: "impatience", w: 2 },
      { t: "The normal one this time — but you note the setup carefully, so if it works you'll have proof you could have pressed it.", a: "pride", w: 1 },
      { t: "It doesn't matter which. You take it without much thought either way.", a: "despair", w: 2 },
    ]},
  { format: "Honest inventory",
    q: "Written rules — the honest version, not the one you'd tell a mentor. Which is true?",
    opts: [
      { t: "You have rules, but you consider them guidelines for other traders. You know when you're the exception.", a: "pride", w: 2 },
      { t: "You have them and mostly follow them — but on slow days, 'mostly' starts developing exceptions by mid-afternoon.", a: "impatience", w: 1 },
      { t: "You have them, you reread them weekly, and the last time one was wrong you changed it in writing instead of quietly ignoring it.", a: null, w: 0 },
      { t: "You have them, and the one you break most is the size rule — always upward.", a: "greed", w: 2 },
      { t: "You have them and follow them, more or less — from memory. You haven't actually reopened the file in months.", a: "despair", w: 1 },
    ]},
  { format: "The gap",
    q: "Think about what you post or say about your trading. What's missing from that version?",
    opts: [
      { t: "The trades you didn't take — the good ones you watched from the sideline out of nerves.", a: "fear", w: 2 },
      { t: "How big you actually sized the last winner. You round it down when you say it out loud.", a: "greed", w: 1 },
      { t: "Not much. You share very little, and the few people close to it know your real numbers — wins, losses, and size.", a: null, w: 0 },
      { t: "A few of the losses. Not hidden, exactly — they just never quite make it into the story.", a: "pride", w: 1 },
      { t: "The days you didn't trade at all, because you couldn't make yourself open the platform.", a: "despair", w: 2 },
    ]},
  { format: "At home",
    q: "When you lose, who do you become for the people in your house?",
    opts: [
      { t: "Distracted — already mentally trading the next session instead of being present.", a: "greed", w: 2 },
      { t: "Quieter than usual for an hour or two. You come back, but the people who know you can tell.", a: "fear", w: 1 },
      { t: "Roughly the same person. A loss inside your rules is a business expense, and you've had enough of them that it stays at the desk.", a: null, w: 0 },
      { t: "Restless and irritable, like you're still looking for the next thing to fix it.", a: "impatience", w: 2 },
      { t: "Present, technically. You do the dishes, answer the questions — but you're flat until bedtime.", a: "despair", w: 1 },
    ]},
  { format: "Underneath it all",
    q: "Strip away the reasons you'd say out loud. What's the real one underneath?",
    opts: [
      { t: "Building something specific — a number, a timeline, a life you've actually written down. Trading is the vehicle, not the identity.", a: null, w: 0 },
      { t: "Proving someone specific wrong. Someone who didn't believe you'd make it.", a: "pride", w: 2 },
      { t: "Mostly building — but underneath it, more escape than you'd like to admit: getting away from a future that scares you.", a: "fear", w: 1 },
      { t: "The plan is real, but so is this: sitting still has never felt like enough, and trading gives that a respectable name.", a: "impatience", w: 1 },
      { t: "Some days you're not sure there is one anymore. You just keep opening the platform.", a: "despair", w: 2 },
    ]},
  { format: "Scenario",
    q: "It's 3:47pm, you're down $400 on the day, and you see a setup that's almost valid. What does your hand actually do?",
    opts: [
      { t: "Nothing. Almost valid is invalid — that was settled when you wrote the rule, not at 3:47 with red on the screen.", a: null, w: 0 },
      { t: "Clicks it anyway. Almost valid and valid stopped being different an hour ago.", a: "impatience", w: 2 },
      { t: "Passes — then spends the next ten minutes building the case for taking the next setup at bigger size, to get the day back.", a: "greed", w: 1 },
      { t: "Hovers. You wanted it to become valid, and you sat there frozen until the candle closed and made the decision for you.", a: "fear", w: 2 },
      { t: "Doesn't take it — but starts sketching the 'improved' version of the setup you would have taken, half-convinced your version beats the rulebook.", a: "pride", w: 1 },
    ]},
  { format: "Frequency",
    q: "In your last 20 trades, how many entries would survive you explaining them out loud to someone you respect?",
    opts: [
      { t: "Almost none. You already know that, which is its own kind of exhausting.", a: "despair", w: 2 },
      { t: "Most of them, in your telling — though you'd shade a few details if you're honest.", a: "pride", w: 1 },
      { t: "The entries were fine. It's the size and the hold that wouldn't survive the explanation.", a: "greed", w: 2 },
      { t: "Maybe fifteen. The other five happened in fast markets, and 'it was moving' isn't an explanation you'd say out loud.", a: "impatience", w: 1 },
      { t: "Nearly all of them — because if an entry can't be explained, you don't take it. That filter is the system.", a: null, w: 0 },
    ]},
  { format: "Either / or",
    q: "Pick the true one, not the right-sounding one: in the moment it actually matters, you protect your capital, or you protect being right?",
    opts: [
      { t: "Being right. You'll find out later what it cost you.", a: "pride", w: 2 },
      { t: "Capital, most days — but when a winner is running, protecting it quietly loses to feeding it.", a: "greed", w: 1 },
      { t: "Capital. You've taken stops that disproved reads you loved, and taken them at full size without renegotiating.", a: null, w: 0 },
      { t: "Capital, so hard that you exit good trades early just to feel protected.", a: "fear", w: 2 },
      { t: "Capital, in principle — but on the bad days, the honest answer is you're not protecting either one with much conviction.", a: "despair", w: 1 },
    ]},
  { format: "The night before",
    q: "The night before a session that matters to you — what actually happens to your sleep?",
    opts: [
      { t: "You fall asleep late. Nothing dramatic — just twenty extra minutes of running tomorrow's first trade in your head.", a: "fear", w: 1 },
      { t: "You sleep. The plan is written, the alarm is set, and there's nothing left to decide at midnight.", a: null, w: 0 },
      { t: "You sleep fine, or tell yourself you do. You've stopped expecting the night before to mean anything.", a: "despair", w: 2 },
      { t: "You're on your phone checking futures or news at 1am, because waiting for the open feels impossible.", a: "impatience", w: 2 },
      { t: "You sleep okay, but the last thing you replay is the trade that proved you right — not the plan for tomorrow.", a: "pride", w: 1 },
    ]},
  { format: "The feedback",
    q: "Someone whose read on markets you trust points out a real flaw in how you traded. What's underneath your first reaction?",
    opts: [
      { t: "Irritation, even if your face doesn't show it. Some part of you is already building the rebuttal.", a: "pride", w: 2 },
      { t: "Gratitude, then over-correction — you barely trade for the next two days while you rebuild your confidence around it.", a: "fear", w: 1 },
      { t: "You ask them to say more. It stings a little, but a real flaw named out loud is cheaper than the market naming it.", a: null, w: 0 },
      { t: "Quick agreement, and a genuine intention to fix it — but by tomorrow's open, the fix never made it into writing.", a: "impatience", w: 1 },
      { t: "Half-agreement, while you're already thinking about the next setup instead of the point they made.", a: "greed", w: 2 },
    ]},
  { format: "The grade",
    q: "If today were graded only on discipline — not P&L — what grade would you honestly give yourself?",
    opts: [
      { t: "A B, and I'd know I was being generous about the size.", a: "greed", w: 1 },
      { t: "A C, because half my grade would be for trades I was too scared to take.", a: "fear", w: 2 },
      { t: "A D. I know exactly which trades shouldn't have happened.", a: "impatience", w: 2 },
      { t: "An A on the honest days, a B on most — and I could point to the exact trades that cost the A. The grade comes off the journal, not the mood.", a: null, w: 0 },
      { t: "I'd rather not grade it. Not because today was bad — because caring about the grade has been getting harder.", a: "despair", w: 1 },
    ]},
];

/* Mirror copy, by severity.
   heavy    — the pattern is ruling; full-strength copy.
   moderate — the pattern is present but not ruling; names where it leaks in.
   Secondary blocks have their own heavy/moderate variants, chosen by the
   secondary pattern's own score. Strength stays the lowest pattern.
   clean    — low scores everywhere: real copy, no invented flaw. */
const MIRROR = {
  heavy: {
    greed: "Greed doesn't run your entries. Your setups are usually patient, sometimes even textbook. It enters after you're already up — that's when your size grows without a real decision behind it, and your stop quietly moves further away because winning has made the story hard to stop reading.",
    fear: "Fear doesn't keep you from opening the platform. You show up. It enters the moment a trade is finally right — when it's time to hold, add, or take the size your own analysis actually calls for — and something in you shrinks the plan instead.",
    impatience: "Impatience doesn't touch your analysis. You can build a real thesis. It enters in the gap between finishing that analysis and waiting for it to be true — that gap is where you take trades your own plan never actually cleared.",
    pride: "Pride doesn't show up as arrogance you'd recognize. It enters in the half-second after a trade goes wrong, when the story shifts from “I was wrong” to “the market was wrong.” That half-second is where the real damage starts.",
    despair: "Despair doesn't arrive as one bad day. It enters as a slow withdrawal — the journal stops, the review stops, the plan gets followed less, because some part of you has already decided how this ends, and you're just waiting to be right about that too.",
  },
  moderate: {
    greed: "Greed is present, but it isn't running the show. Most sessions, your size is decided before the open and stays decided. It leaks in at the edges — the winner you feed a little past the plan, the size that creeps up a notch after a good week without a written decision behind it. Edges are where it lives now. Left unwatched, edges become the center.",
    fear: "Fear is present, but it isn't ruling you. You take your setups, and most of the plan survives contact with the market. It leaks in at the margins — the size that shrinks a step after a loss, the early exit on a trade you'd already proven. It isn't costing you the account. It's costing you the difference between your results and your analysis.",
    impatience: "Impatience is there, but it doesn't own your trading. Most of your entries have a reason you could say out loud. It leaks in on the slow days — the afternoon exception, the 'close enough' entry in a fast market, the fix you agreed to that never got written down. It isn't a fire. It's a slow leak, the kind you only notice at the end of the quarter.",
    pride: "Pride is present, but it isn't in charge. You can hear criticism, and most of your reviews are honest. It leaks in as shading — the loss that never quite makes it into the story, the journal note that defends an entry instead of examining it, the replay of the trade that proved you right. Small edits. But a journal that flatters you is compounding in the wrong direction.",
    despair: "Despair is present, but it hasn't won anything. You still show up, and you still follow the plan — mostly. It leaks in as flatness — the win that doesn't register, the review that feels pointless, the rules you follow from memory because opening the file feels like effort. It isn't loud. That's exactly how it grows.",
  },
  secondaryHeavy: {
    greed: "Underneath that, greed is running nearly as loud — the size creep and the fed winners aren't leaks, they're a second pattern working the same shifts as the first.",
    fear: "Underneath that, fear is running nearly as loud — the shrinking size and the surrendered setups aren't occasional. Two patterns this strong take turns: one makes the mess, the other stops you from trading your way back honestly.",
    impatience: "Underneath that, impatience is running nearly as loud — the entries you can't explain aren't rare exceptions, they're a second pattern on its own schedule, and it hands the first one ammunition every time it fires.",
    pride: "Underneath that, pride is running nearly as loud — the defended entries and the edited stories aren't shading, they're a second pattern, and it's the one that keeps the first from ever being reviewed honestly.",
    despair: "Underneath that, despair is running nearly as loud — the flatness and the abandoned reviews aren't a mood, they're a second pattern, and it's the one that keeps convincing you the first isn't worth fighting.",
  },
  secondaryModerate: {
    greed: "Underneath that, greed shows up too — quieter, mostly in how hard it is for you to leave a winner alone once it's already worked.",
    fear: "Underneath that, fear is present as well — mostly in how much smaller you get after any account move you weren't ready for.",
    impatience: "Underneath that, impatience shows up too — in how rarely you let a flat, boring stretch of market stay boring.",
    pride: "Underneath that, pride is there as well — in how much you need the story of a trade to make you look sharp, even to yourself.",
    despair: "Underneath that, despair shows up too — in how quickly a bad stretch convinces you the good stretch before it wasn't real.",
  },
  secondaryNone: "Nothing else scored loud enough to name honestly, and this mirror doesn't invent second patterns to fill space. One pattern is doing most of the work here — which is better news than it sounds, because one front is a war you can actually fight.",
  strength: {
    greed: "You don't chase. When a trade is done, you seem able to let it be done — and that's rarer than you probably think it is.",
    fear: "You don't flinch from taking a valid setup. Whatever else is running underneath, hesitation doesn't seem to be what's costing you.",
    impatience: "You can wait. You don't need the market to be doing something every minute to feel like you're trading well, and that patience is a real asset.",
    pride: "You can hear you were wrong without needing to rebuild the story first. That's the part of this work most people never get to.",
    despair: "Something in you keeps showing up. Whatever else is true, you haven't quietly given up on this — and that's not nothing.",
  },
  clean: {
    body1: "No pattern owns you right now. Your answers show structure: rules that exist and get followed, losses that stay at the desk, size that gets decided before the session instead of during it. The diagnosis found structure, not sickness — and it will not invent a flaw to satisfy the format. That discipline is real, and it was built. Nobody is born with it.",
    body2: "But hear the one warning this result carries. Every pattern this instrument measures got its start in a trader who had it handled. Your danger isn't greed or fear or pride today — your danger is the day you believe you're past danger, because that's the day the checking stops. Discipline that isn't guarded doesn't stay; it erodes politely, one justified exception at a time.",
    lean: "If anything leans at all, it leans toward {pattern} — worth a glance on the days you're tired or the week runs hot. Nothing more than that.",
    turn: "A contract isn't only for the broken. Yours has a different job: protecting what you've built, so the version of you who wrote these answers is still the one trading a year from now.",
  },
  fallbackBody: "Something went wrong reading your scores — that's a fault in this page, not in your answers. Here's what fifteen honest answers still mean: you now know which questions were hardest to answer truthfully, and those are exactly the places your patterns enter. The pattern you flinched at naming is the one worth watching.",
  turn: "A pattern you can see is a pattern you can fight. The fight starts with a contract.",
};

// Severity thresholds. Max per pattern is 18 (six 2-point + six 1-point slots).
function severityFor(primaryScore, total){
  if (total <= 6 && primaryScore <= 3) return "clean";
  if (primaryScore >= 8 || total >= 18) return "heavy";
  return "moderate";
}

const TOTAL_STEPS = QUESTIONS.length + 1;
let step = 0;
const scores = { impatience: 0, greed: 0, fear: 0, pride: 0, despair: 0 };

let app, progressFill;

function setProgress(){
  if (!progressFill) return;
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  progressFill.style.width = pct + "%";
}

// Non-finite score values (possible if the DOM was mangled by an extension)
// must never poison the tally — coerce them to 0 before ranking.
function safeScores(){
  const out = {};
  Object.keys(scores).forEach(k => {
    out[k] = Number.isFinite(scores[k]) ? scores[k] : 0;
  });
  return out;
}

function pickPrimary(s){
  let max = -1;
  Object.keys(s).forEach(k => { if (s[k] > max) max = s[k]; });
  const tied = Object.keys(s).filter(k => s[k] === max);
  for (const a of TIE_PRIORITY) if (tied.includes(a)) return a;
  return tied[0] || TIE_PRIORITY[0];
}
function pickSecondary(s, primary){
  const rest = Object.keys(s).filter(k => k !== primary);
  let max = -1;
  rest.forEach(k => { if (s[k] > max) max = s[k]; });
  const tied = rest.filter(k => s[k] === max);
  for (const a of TIE_PRIORITY) if (tied.includes(a)) return a;
  return tied[0] || TIE_PRIORITY[1];
}
function pickStrength(s, primary, secondary){
  const rest = Object.keys(s).filter(k => k !== primary && k !== secondary);
  let min = Infinity;
  rest.forEach(k => { if (s[k] < min) min = s[k]; });
  const tied = rest.filter(k => s[k] === min);
  for (const a of STRENGTH_PRIORITY) if (tied.includes(a)) return a;
  return tied[0] || primary;
}

function renderIntro(){
  app.innerHTML = `
    <div class="stage intro-card fx-in">
      <h1>The Diagnosis</h1>
      <p>Fifteen questions. No typing, no scoring you'll see in real time. This isn't a personality test — it's a look at where your patterns actually enter your trading. Answer the honest one, not the correct one.</p>
      <div class="meta"><span>15 questions</span><span>~4 minutes</span></div>
      <a class="btn primary" href="#" id="startBtn">Begin</a>
    </div>`;
  document.getElementById("startBtn").addEventListener("click", (e) => {
    e.preventDefault();
    step = 0;
    setProgress();
    renderQuestion();
  });
}

function renderQuestion(){
  const item = QUESTIONS[step];
  if (!item){ renderMirror(); return; }
  const optsHtml = item.opts.map(o =>
    `<button type="button" class="opt" data-a="${o.a || ""}" data-w="${o.w}">${o.t}</button>`
  ).join("");
  app.innerHTML = `
    <div class="stage fx-in" id="qStage">
      <div class="q-counter">Question ${step + 1} of ${QUESTIONS.length}</div>
      <div class="q-format">${item.format}</div>
      <div class="q-text">${item.q}</div>
      <div class="q-opts">${optsHtml}</div>
    </div>`;
  // One advance per rendered question — a fast desktop double-click must not
  // score twice or skip a question.
  let advanced = false;
  document.querySelectorAll(".opt").forEach(btn => {
    btn.addEventListener("click", () => {
      if (advanced) return;
      advanced = true;
      const a = btn.dataset.a;
      const w = parseInt(btn.dataset.w, 10);
      if (Object.prototype.hasOwnProperty.call(scores, a) && Number.isFinite(w)) {
        scores[a] += w;
      }
      const stage = document.getElementById("qStage");
      if (stage){
        stage.classList.remove("fx-in");
        stage.classList.add("fx-out");
      }
      setTimeout(() => {
        step += 1;
        setProgress();
        if (step < QUESTIONS.length) renderQuestion();
        else renderMirror();
      }, 260);
    });
  });
}

// Copy lookup that can never return undefined into the page.
function copyFor(map, key, fallback){
  if (map && typeof map[key] === "string" && map[key]) return map[key];
  return fallback;
}

function buildMirrorHtml(){
  const s = safeScores();
  const total = Object.keys(s).reduce((sum, k) => sum + s[k], 0);
  const primary = pickPrimary(s);
  const secondary = pickSecondary(s, primary);
  const strength = pickStrength(s, primary, secondary);
  const severity = severityFor(s[primary], total);

  const record = {
    scores: s, total, severity,
    // A clean result names no pattern downstream — the contract shouldn't
    // badge "seen in your diagnosis" on a pattern that wasn't really seen.
    primary: severity === "clean" ? "" : primary,
    secondary: severity === "clean" ? "" : secondary,
    strength: severity === "clean" ? "" : strength,
    ts: new Date().toISOString(),
  };

  let bodyHtml, turnText;
  if (severity === "clean"){
    const leanHtml = total > 0
      ? `<p>${MIRROR.clean.lean.replace("{pattern}", (PATTERN_LABEL[primary] || primary || "").toLowerCase())}</p>`
      : "";
    bodyHtml = `
      <p>${MIRROR.clean.body1}</p>
      <p>${MIRROR.clean.body2}</p>
      ${leanHtml}`;
    turnText = MIRROR.clean.turn;
  } else {
    const primaryMap = severity === "heavy" ? MIRROR.heavy : MIRROR.moderate;
    const primaryCopy = copyFor(primaryMap, primary,
      copyFor(MIRROR.heavy, primary, MIRROR.fallbackBody));
    let secondaryCopy;
    if (s[secondary] >= 8) secondaryCopy = copyFor(MIRROR.secondaryHeavy, secondary, MIRROR.secondaryNone);
    else if (s[secondary] >= 3) secondaryCopy = copyFor(MIRROR.secondaryModerate, secondary, MIRROR.secondaryNone);
    else secondaryCopy = MIRROR.secondaryNone;
    const strengthCopy = copyFor(MIRROR.strength, strength, MIRROR.strength.despair);
    bodyHtml = `
      <p>${primaryCopy}</p>
      <p>${secondaryCopy}</p>
      <div class="mirror-strength">
        <span class="tag">What's intact</span>
        <p>${strengthCopy}</p>
      </div>`;
    turnText = MIRROR.turn;
  }

  const html = `
    <div class="stage fx-in" data-severity="${severity}">
      <div class="mirror-open">Here is what your answers show.</div>
      <div class="mirror-body">${bodyHtml}</div>
      <div class="turn">
        <p>${turnText}</p>
        <a class="btn primary" href="contract.html" style="margin-top:1em">Write your contract</a>
      </div>
    </div>`;
  return { html, record };
}

// The mirror must never render blank: the previous stage exits at opacity 0,
// so an uncaught error here would leave an empty page. Any failure falls back
// to a valid rendered state.
function fallbackMirrorHtml(){
  // Deliberately avoids MIRROR lookups beyond guarded string reads, so it
  // stays renderable even if the copy object itself was corrupted.
  let body = "Something went wrong reading your scores — that's a fault in this page, not in your answers. Here's what fifteen honest answers still mean: you now know which questions were hardest to answer truthfully, and those are exactly the places your patterns enter. The pattern you flinched at naming is the one worth watching.";
  let turn = "A pattern you can see is a pattern you can fight. The fight starts with a contract.";
  try{
    if (MIRROR && typeof MIRROR.fallbackBody === "string" && MIRROR.fallbackBody) body = MIRROR.fallbackBody;
    if (MIRROR && typeof MIRROR.turn === "string" && MIRROR.turn) turn = MIRROR.turn;
  }catch(_){}
  return `
    <div class="stage fx-in" data-severity="fallback">
      <div class="mirror-open">Here is what your answers show.</div>
      <div class="mirror-body">
        <p>${body}</p>
      </div>
      <div class="turn">
        <p>${turn}</p>
        <a class="btn primary" href="contract.html" style="margin-top:1em">Write your contract</a>
      </div>
    </div>`;
}

function renderMirror(){
  let html, record = null;
  try{
    const built = buildMirrorHtml();
    html = built.html;
    record = built.record;
  }catch(_){
    html = fallbackMirrorHtml();
  }

  app.innerHTML = html;

  if (record){
    try{ localStorage.setItem("niyyah_diagnosis", JSON.stringify(record)); }catch(_){}
  }
}

document.addEventListener("DOMContentLoaded", () => {
  app = document.getElementById("app");
  progressFill = document.getElementById("progressFill");
  renderIntro();
});

// Test hook: lets automated checks drive edge-case scoring outcomes directly
// (ties, sweeps, corrupted scores) and assert the mirror never renders blank.
window.__niyyahDiag = { scores, renderMirror, severityFor, QUESTIONS, MIRROR };

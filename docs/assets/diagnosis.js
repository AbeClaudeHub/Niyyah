/* Niyyah — The Diagnosis. Pattern-recognition instrument, not a personality quiz.
   Every question resolves one tap to one of five patterns:
   impatience, greed, fear, pride, despair. Highest two patterns become the
   Mirror's primary/secondary. Nothing here ever assigns identity — only
   "where and when this pattern enters." */

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

const QUESTIONS = [
  { format: "Scenario",
    q: "It's five minutes before your session starts. What's actually happening in your body?",
    opts: [
      { t: "You're already calculating what today could be if it goes right — ahead of yourself before a single candle prints.", a: "greed" },
      { t: "Your stomach is tight. You're re-reading yesterday's losses instead of today's plan.", a: "fear" },
      { t: "You're refreshing the chart every few seconds, annoyed the market hasn't opened yet.", a: "impatience" },
      { t: "You're thinking about the trade that proved you right last week, not the one in front of you today.", a: "pride" },
      { t: "You're already tired. Some part of you doesn't expect today to be different.", a: "despair" },
    ]},
  { format: "Scenario",
    q: "You're in a live trade, thirty seconds after entry. What are your eyes doing?",
    opts: [
      { t: "Locked on the P&L number, not the chart. You're watching the money, not the market.", a: "fear" },
      { t: "Already picturing the exit two targets past your actual plan.", a: "greed" },
      { t: "Looking for a reason — any reason — to close it early and do something else.", a: "impatience" },
      { t: "Confirming to yourself that this was a smart entry, before the trade has had time to be right.", a: "pride" },
      { t: "Half-detached, like you're watching it happen to someone else.", a: "despair" },
    ]},
  { format: "The next sixty seconds",
    q: "The trade just stopped out. In the next sixty seconds, what do you actually do?",
    opts: [
      { t: "Open the next chart immediately, already sizing the trade that fixes this.", a: "greed" },
      { t: "Look for the reason it wasn't really your fault — spread, news, someone else's call.", a: "pride" },
      { t: "Take the next setup that shows up, valid or not, just to be back in something.", a: "impatience" },
      { t: "Close everything and tell yourself you're done for the day, even if it's 9am.", a: "fear" },
      { t: "Sit there a while doing nothing. Not even angry — just flat.", a: "despair" },
    ]},
  { format: "The next moment",
    q: "You just closed a winner, clean, better than expected. What happens next, honestly?",
    opts: [
      { t: "Your size for the next trade quietly goes up. You don't even decide to do it — it just does.", a: "greed" },
      { t: "You screenshot it. Some part of you is already thinking about who's going to see this.", a: "pride" },
      { t: "You're back in another position within minutes, riding the feeling.", a: "impatience" },
      { t: "You go flat and stay flat, afraid of giving it back.", a: "fear" },
      { t: "It barely registers. You're waiting for the next one to erase it.", a: "despair" },
    ]},
  { format: "Trade-off",
    q: "Two setups look almost identical in quality. One is this week's normal size, one is bigger. Which do you actually take, and why?",
    opts: [
      { t: "The bigger one. You've been running hot and it feels stupid not to press it.", a: "greed" },
      { t: "The bigger one. This is the setup that proves the read you've been defending all week.", a: "pride" },
      { t: "The smaller one, or neither — you talk yourself out of it at the last second.", a: "fear" },
      { t: "Whichever one is in front of you right now. You don't actually check the size math.", a: "impatience" },
      { t: "It doesn't matter which. You take it without much thought either way.", a: "despair" },
    ]},
  { format: "Honest inventory",
    q: "Written rules — the honest version, not the one you'd tell a mentor. Which is true?",
    opts: [
      { t: "You have rules, but you consider them guidelines for other traders. You know when you're the exception.", a: "pride" },
      { t: "You wrote them once, a while ago. You haven't opened that file in months.", a: "despair" },
      { t: "You have them, and you broke one on purpose within the last week.", a: "impatience" },
      { t: "You have them, and the one you break most is the size rule — always upward.", a: "greed" },
      { t: "You have them, and you follow them so tightly they stop you from taking trades that would've worked.", a: "fear" },
    ]},
  { format: "The gap",
    q: "Think about what you post or say about your trading. What's missing from that version?",
    opts: [
      { t: "The losses. Almost all of them. What people see is a highlight reel you curated on purpose.", a: "pride" },
      { t: "The trades you didn't take — the good ones you watched from the sideline out of nerves.", a: "fear" },
      { t: "How big you actually sized the last winner. You round it down when you say it out loud.", a: "greed" },
      { t: "How many trades you actually took today. The real number would embarrass you.", a: "impatience" },
      { t: "The days you didn't trade at all, because you couldn't make yourself open the platform.", a: "despair" },
    ]},
  { format: "At home",
    q: "When you lose, who do you become for the people in your house?",
    opts: [
      { t: "Distracted — already mentally trading the next session instead of being present.", a: "greed" },
      { t: "Short-tempered in a quiet way. Withdrawn. Hard to reach. Answering in as few words as possible.", a: "fear" },
      { t: "Defensive. If anyone asks how trading's going, you deflect or lie by omission.", a: "pride" },
      { t: "Restless and irritable, like you're still looking for the next thing to fix it.", a: "impatience" },
      { t: "Flat. You go through the motions and hope no one asks you anything real.", a: "despair" },
    ]},
  { format: "Underneath it all",
    q: "Strip away the reasons you'd say out loud. What's the real one underneath?",
    opts: [
      { t: "More. Not a number — just more than you have now, always.", a: "greed" },
      { t: "Proving someone specific wrong. Someone who didn't believe you'd make it.", a: "pride" },
      { t: "Escaping a version of your future you're scared of, more than building the one you want.", a: "fear" },
      { t: "You're not sure. You just know sitting still with a plan has never felt like enough.", a: "impatience" },
      { t: "Some days you're not sure there is one anymore. You just keep opening the platform.", a: "despair" },
    ]},
  { format: "Scenario",
    q: "It's 3:47pm, you're down $400 on the day, and you see a setup that's almost valid. What does your hand actually do?",
    opts: [
      { t: "Sizes it up past your normal size — almost valid still means basically free money if it hits.", a: "greed" },
      { t: "Clicks it anyway. Almost valid and valid stopped being different an hour ago.", a: "impatience" },
      { t: "Takes it your way, with a tweak that makes it 'better' than the setup as written.", a: "pride" },
      { t: "Hesitates so long the candle closes and the decision gets made for you.", a: "fear" },
      { t: "Clicks it without really caring. What's one more red trade today.", a: "despair" },
    ]},
  { format: "Frequency",
    q: "In your last 20 trades, how many entries would survive you explaining them out loud to someone you respect?",
    opts: [
      { t: "Almost none. You already know that, which is its own kind of exhausting.", a: "despair" },
      { t: "Most of them, in your telling — though you'd shade a few details if you're honest.", a: "pride" },
      { t: "The entries were fine. It's the size and the hold that wouldn't survive the explanation.", a: "greed" },
      { t: "Maybe half. The other half you couldn't explain, because there wasn't really a reason.", a: "impatience" },
      { t: "Almost all of them — because you only let yourself take the obvious ones, which is its own problem.", a: "fear" },
    ]},
  { format: "Either / or",
    q: "Pick the true one, not the right-sounding one: in the moment it actually matters, you protect your capital, or you protect being right?",
    opts: [
      { t: "Being right. You'll find out later what it cost you.", a: "pride" },
      { t: "Neither, really — you protect the feeling of the trade going bigger.", a: "greed" },
      { t: "Capital, so hard that you exit good trades early just to feel protected.", a: "fear" },
      { t: "Whichever one lets you move on to the next trade fastest.", a: "impatience" },
      { t: "Honestly, some days neither one feels worth protecting.", a: "despair" },
    ]},
  { format: "The night before",
    q: "The night before a session that matters to you — what actually happens to your sleep?",
    opts: [
      { t: "You're awake running the trade in your head before you've even taken it.", a: "fear" },
      { t: "You're awake, but it's excitement — you're already spending money you haven't made yet.", a: "greed" },
      { t: "You sleep fine, or tell yourself you do. You've stopped expecting the night before to mean anything.", a: "despair" },
      { t: "You're on your phone checking futures or news at 1am, because waiting for the open feels impossible.", a: "impatience" },
      { t: "You're awake replaying the last trade that proved you were right, not preparing for the next one.", a: "pride" },
    ]},
  { format: "The feedback",
    q: "Someone whose read on markets you trust points out a real flaw in how you traded. What's underneath your first reaction?",
    opts: [
      { t: "Irritation, even if your face doesn't show it. Some part of you is already building the rebuttal.", a: "pride" },
      { t: "Relief that someone else is steering, followed by two days of barely trading.", a: "fear" },
      { t: "Half-agreement, while you're already thinking about the next setup instead of the point they made.", a: "greed" },
      { t: "Quick agreement, no real change. Tomorrow looks like today did.", a: "impatience" },
      { t: "You take it as confirmation of something you already suspected about yourself.", a: "despair" },
    ]},
  { format: "The grade",
    q: "If today were graded only on discipline — not P&L — what grade would you honestly give yourself?",
    opts: [
      { t: "A B, and I'd know I was being generous about the size.", a: "greed" },
      { t: "A C, because half my grade would be for trades I was too scared to take.", a: "fear" },
      { t: "A D. I know exactly which trades shouldn't have happened.", a: "impatience" },
      { t: "An A, and I'd defend that grade harder than the truth deserves.", a: "pride" },
      { t: "I wouldn't grade it. Some days I don't think it matters.", a: "despair" },
    ]},
];

/* Mirror copy. Primary + secondary blocks compose; strength is chosen from
   whichever pattern scored lowest. Never phrased as identity — always
   "where this pattern enters." */
const MIRROR = {
  primary: {
    greed: "Greed doesn't run your entries. Your setups are usually patient, sometimes even textbook. It enters after you're already up — that's when your size grows without a real decision behind it, and your stop quietly moves further away because winning has made the story hard to stop reading.",
    fear: "Fear doesn't keep you from opening the platform. You show up. It enters the moment a trade is finally right — when it's time to hold, add, or take the size your own analysis actually calls for — and something in you shrinks the plan instead.",
    impatience: "Impatience doesn't touch your analysis. You can build a real thesis. It enters in the gap between finishing that analysis and waiting for it to be true — that gap is where you take trades your own plan never actually cleared.",
    pride: "Pride doesn't show up as arrogance you'd recognize. It enters in the half-second after a trade goes wrong, when the story shifts from “I was wrong” to “the market was wrong.” That half-second is where the real damage starts.",
    despair: "Despair doesn't arrive as one bad day. It enters as a slow withdrawal — the journal stops, the review stops, the plan gets followed less, because some part of you has already decided how this ends, and you're just waiting to be right about that too.",
  },
  secondary: {
    greed: "Underneath that, greed shows up too — quieter, mostly in how hard it is for you to leave a winner alone once it's already worked.",
    fear: "Underneath that, fear is present as well — mostly in how much smaller you get after any account move you weren't ready for.",
    impatience: "Underneath that, impatience shows up too — in how rarely you let a flat, boring stretch of market stay boring.",
    pride: "Underneath that, pride is there as well — in how much you need the story of a trade to make you look sharp, even to yourself.",
    despair: "Underneath that, despair shows up too — in how quickly a bad stretch convinces you the good stretch before it wasn't real.",
  },
  strength: {
    greed: "You don't chase. When a trade is done, you seem able to let it be done — and that's rarer than you probably think it is.",
    fear: "You don't flinch from taking a valid setup. Whatever else is running underneath, hesitation doesn't seem to be what's costing you.",
    impatience: "You can wait. You don't need the market to be doing something every minute to feel like you're trading well, and that patience is a real asset.",
    pride: "You can hear you were wrong without needing to rebuild the story first. That's the part of this work most people never get to.",
    despair: "Something in you keeps showing up. Whatever else is true, you haven't quietly given up on this — and that's not nothing.",
  },
};

const TOTAL_STEPS = QUESTIONS.length + 1;
let step = 0;
const scores = { impatience: 0, greed: 0, fear: 0, pride: 0, despair: 0 };

let app, progressFill;

function setProgress(){
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  progressFill.style.width = pct + "%";
}

function pickPrimary(){
  let max = -1;
  Object.keys(scores).forEach(k => { if (scores[k] > max) max = scores[k]; });
  const tied = Object.keys(scores).filter(k => scores[k] === max);
  for (const a of TIE_PRIORITY) if (tied.includes(a)) return a;
  return tied[0];
}
function pickSecondary(primary){
  const rest = Object.keys(scores).filter(k => k !== primary);
  let max = -1;
  rest.forEach(k => { if (scores[k] > max) max = scores[k]; });
  const tied = rest.filter(k => scores[k] === max);
  for (const a of TIE_PRIORITY) if (tied.includes(a)) return a;
  return tied[0];
}
function pickStrength(primary, secondary){
  const rest = Object.keys(scores).filter(k => k !== primary && k !== secondary);
  let min = Infinity;
  rest.forEach(k => { if (scores[k] < min) min = scores[k]; });
  const tied = rest.filter(k => scores[k] === min);
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
  const optsHtml = item.opts.map(o => `<button type="button" class="opt" data-a="${o.a}">${o.t}</button>`).join("");
  app.innerHTML = `
    <div class="stage fx-in" id="qStage">
      <div class="q-counter">Question ${step + 1} of ${QUESTIONS.length}</div>
      <div class="q-format">${item.format}</div>
      <div class="q-text">${item.q}</div>
      <div class="q-opts">${optsHtml}</div>
    </div>`;
  document.querySelectorAll(".opt").forEach(btn => {
    btn.addEventListener("click", () => {
      scores[btn.dataset.a] += 1;
      const stage = document.getElementById("qStage");
      stage.classList.remove("fx-in");
      stage.classList.add("fx-out");
      setTimeout(() => {
        step += 1;
        setProgress();
        if (step < QUESTIONS.length) renderQuestion();
        else renderMirror();
      }, 260);
    });
  });
}

function renderMirror(){
  const primary = pickPrimary();
  const secondary = pickSecondary(primary);
  const strength = pickStrength(primary, secondary);

  try{
    localStorage.setItem("niyyah_diagnosis", JSON.stringify({
      scores, primary, secondary, strength, ts: new Date().toISOString(),
    }));
  }catch(_){}

  app.innerHTML = `
    <div class="stage fx-in">
      <div class="mirror-open">Here is what your answers show.</div>
      <div class="mirror-body">
        <p>${MIRROR.primary[primary]}</p>
        <p>${MIRROR.secondary[secondary]}</p>
        <div class="mirror-strength">
          <span class="tag">What's intact</span>
          <p>${MIRROR.strength[strength]}</p>
        </div>
      </div>
      <div class="turn">
        <p>A pattern you can see is a pattern you can fight. The fight starts with a contract.</p>
        <a class="btn primary" href="contract.html" style="margin-top:1em">Write your contract</a>
      </div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  app = document.getElementById("app");
  progressFill = document.getElementById("progressFill");
  renderIntro();
});

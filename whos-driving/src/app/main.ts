import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/app.css";

import { QUESTIONS } from "../content/questions";
import { PROFILES, SABOTEUR_ORDER } from "../content/profiles";
import { REBUILD } from "../content/rebuild";
import { ANSWER_LABELS, MAX_SCORE_PER_SABOTEUR } from "../content/types";
import { arcSvg, animateDial } from "./arc";
import { buildMirrorText, downloadText } from "./export";
import {
  auditComplete,
  claimAccessFromUrl,
  computeScores,
  currentDayNumber,
  dateOfDay,
  dayStatus,
  doneCount,
  firstUnanswered,
  hasAccess,
  loadState,
  missedCount,
  protocolFinished,
  resetState,
  saveState,
  todayLocal,
  type PersistedState,
} from "./state";

type View =
  | { name: "locked" }
  | { name: "intro" }
  | { name: "audit" }
  | { name: "verdict" }
  | { name: "protocol" }
  | { name: "day"; day: number }
  | { name: "mirror" }
  | { name: "reader" };

const root = document.getElementById("root") as HTMLElement;
let state: PersistedState;
let view: View;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function commit(): void {
  saveState(state);
}

function go(next: View): void {
  view = next;
  paint();
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------------
   Shell
---------------------------------------------------------------- */

function navHtml(): string {
  if (!auditComplete(state)) return "";
  const tab = (label: string, target: View["name"], active: boolean) =>
    `<button class="tab${active ? " active" : ""}" data-nav="${target}"
       ${active ? 'aria-current="page"' : ""}>${label}</button>`;
  const current = view.name === "day" ? "protocol" : view.name;
  return `<nav class="tabs" aria-label="Sections">
    ${tab("Protocol", "protocol", current === "protocol")}
    ${tab("Mirror", "mirror", current === "mirror")}
    ${tab("Verdict", "verdict", current === "verdict")}
  </nav>`;
}

function shell(inner: string, opts: { bare?: boolean } = {}): string {
  if (opts.bare) return `<div class="screen">${inner}</div>`;
  return `
    <header class="app-head">
      <a class="wordmark-link" href="/" aria-label="Niyyah home">
        <svg class="wordmark" viewBox="0 0 130 22" width="92" height="16" role="img" aria-label="NIYYAH">
          <text x="0" y="17" font-family="Fraunces, Georgia, serif" font-size="19"
            letter-spacing="5" fill="currentColor">NIYYAH</text>
        </svg>
      </a>
      ${navHtml()}
    </header>
    <div class="screen">${inner}</div>`;
}

function bindNav(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((b) => {
    b.addEventListener("click", () => {
      const target = b.dataset.nav as "protocol" | "mirror" | "verdict";
      go({ name: target });
    });
  });
}

/* ----------------------------------------------------------------
   Locked
---------------------------------------------------------------- */

function paintLocked(): void {
  root.innerHTML = shell(`
    <section class="center-col">
      <p class="mono gold">Who's driving</p>
      <h1>This room is for buyers.</h1>
      <p>The audit and the 30-day rebuild live behind this door.
         One purchase. Lifetime access. $27.</p>
      <p><a class="btn" href="/#price">Get access — $27</a></p>
      <p class="fine">Already bought it? Open the access link from your purchase
         confirmation on this device. Your data stays on this device only.</p>
    </section>
  `);
  bindNav();
}

/* ----------------------------------------------------------------
   Intro
---------------------------------------------------------------- */

function paintIntro(): void {
  const answered = state.audit.answers.filter((a) => a !== null).length;
  const resuming = answered > 0;
  root.innerHTML = shell(`
    <section class="center-col">
      <p class="mono gold">The nafs audit</p>
      <h1>Twenty questions.<br>One condition.</h1>
      <p>Answer as the trader you are. Not the one you're planning to become.
         Nobody sees this but you. Lying here is lying in your own ledger.</p>
      <p class="mono dim-line">Alone &nbsp;·&nbsp; Phone on silent &nbsp;·&nbsp; About four minutes</p>
      <p><button class="btn" id="begin">
        ${resuming ? `Resume — ${answered} of 20 answered` : "Begin the audit"}
      </button></p>
    </section>
  `);
  bindNav();
  root.querySelector("#begin")!.addEventListener("click", () => go({ name: "audit" }));
}

/* ----------------------------------------------------------------
   Audit
---------------------------------------------------------------- */

function paintAudit(): void {
  const index = firstUnanswered(state);
  if (index === -1) {
    state.audit.completedAt = state.audit.completedAt ?? new Date().toISOString();
    commit();
    go({ name: "verdict" });
    return;
  }
  const q = QUESTIONS[index];
  const n = String(index + 1).padStart(2, "0");
  root.innerHTML = shell(
    `
    <section class="audit">
      <div class="audit-top">
        ${arcSvg({ size: 44, progress: index / QUESTIONS.length, label: `Question ${index + 1} of ${QUESTIONS.length}` })}
        <span class="mono">${n} / ${QUESTIONS.length}</span>
      </div>
      <h1 class="audit-q">${esc(q.text)}</h1>
      <div class="answers" role="group" aria-label="Your answer">
        ${ANSWER_LABELS.map(
          (label, value) =>
            `<button class="answer" data-value="${value}">${label}</button>`,
        ).join("")}
      </div>
      ${
        index > 0
          ? `<button class="linkish" id="back">Back — change the last answer</button>`
          : ""
      }
    </section>
  `,
    { bare: true },
  );

  const section = root.querySelector<HTMLElement>(".audit")!;
  root.querySelectorAll<HTMLButtonElement>(".answer").forEach((b) => {
    b.addEventListener("click", () => {
      state.audit.answers[index] = Number(b.dataset.value);
      commit();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        paintAudit();
        return;
      }
      section.classList.add("leaving");
      window.setTimeout(() => paintAudit(), 170);
    });
  });
  root.querySelector("#back")?.addEventListener("click", () => {
    state.audit.answers[index - 1] = null;
    commit();
    paintAudit();
  });
}

/* ----------------------------------------------------------------
   Verdict
---------------------------------------------------------------- */

function paintVerdict(): void {
  const scores = computeScores(state);
  const p = PROFILES[scores.dominant];
  const dominantScore = scores.totals[scores.dominant];
  const secondScore = scores.totals[scores.second];
  const closeBehind =
    secondScore > 0 && dominantScore - secondScore <= 2 && scores.second !== scores.dominant;

  const bars = SABOTEUR_ORDER.map((id) => {
    const sp = PROFILES[id];
    const score = scores.totals[id];
    const pct = (score / MAX_SCORE_PER_SABOTEUR) * 100;
    const isDominant = id === scores.dominant;
    return `
      <div class="bar-row${isDominant ? " dominant" : ""}">
        <span class="bar-name">${sp.name} <span class="bar-register">· ${sp.register}</span></span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="mono bar-score">${String(score).padStart(2, "0")}/15</span>
      </div>`;
  }).join("");

  const started = Boolean(state.rebuild.startDate);

  root.innerHTML = shell(`
    <section class="verdict">
      <p class="mono gold">The verdict</p>
      <div class="dial-wrap" id="dial">
        ${arcSvg({
          size: 230,
          progress: dominantScore / MAX_SCORE_PER_SABOTEUR,
          strokeWidth: 2,
          label: `${p.name} score: ${dominantScore} of 15`,
        })}
        <div class="dial-center">
          <span class="dial-number mono" id="dial-number">${dominantScore}</span>
          <span class="mono dial-max">of 15</span>
        </div>
      </div>
      <p class="verdict-arabic" lang="ar" dir="rtl">${p.arabic}</p>
      <h1 class="verdict-name">${p.name}</h1>
      <p class="mono verdict-register">${esc(p.definition)}</p>
      <p class="verdict-line">${esc(p.verdictLine)}</p>

      <div class="bars">${bars}</div>
      ${
        closeBehind
          ? `<p class="fine">Close behind: ${PROFILES[scores.second].name},
             ${secondScore} of 15. Watch for it in week two.</p>`
          : ""
      }

      <hr class="rule rule-tight">

      <div class="profile">
        ${p.profile.map((para) => `<p>${esc(para)}</p>`).join("")}
      </div>

      <aside class="counter">
        <p class="mono gold">The counter-discipline</p>
        <p class="counter-line">${esc(p.counter)}</p>
      </aside>

      <!-- VERSE SLOT: theme = accountability of the self / the commanding nafs -->

      <div class="verdict-cta">
        ${
          started
            ? `<button class="btn" data-nav="protocol">Open your protocol</button>`
            : `<button class="btn" id="begin-rebuild">Begin the rebuild — day 1 is today</button>
               <p class="fine">Thirty days. They unlock one at a time.
               Missed days stay missed. That's the point.</p>`
        }
      </div>
    </section>
  `);
  bindNav();

  const dial = root.querySelector<HTMLElement>("#dial")!;
  const num = root.querySelector<HTMLElement>("#dial-number")!;
  animateDial(dial, num, dominantScore, MAX_SCORE_PER_SABOTEUR);

  root.querySelector("#begin-rebuild")?.addEventListener("click", () => {
    state.rebuild.startDate = todayLocal();
    commit();
    go({ name: "protocol" });
  });
}

/* ----------------------------------------------------------------
   Protocol (the 30-day rebuild)
---------------------------------------------------------------- */

function calendarHtml(): string {
  const cells: string[] = [];
  for (let d = 1; d <= 30; d++) {
    const status = dayStatus(state, d);
    const mark = status === "missed" ? `<span class="miss-mark" aria-hidden="true">×</span>` : "";
    const label =
      status === "locked"
        ? `Day ${d}, locked`
        : status === "missed"
          ? `Day ${d}, missed`
          : status === "done"
            ? `Day ${d}, sealed`
            : `Day ${d}, today`;
    cells.push(
      `<button class="cal-cell ${status}" data-day="${d}"
         ${status === "locked" ? "disabled" : ""} aria-label="${label}">
         <span class="cal-num mono">${d}</span>${mark}
       </button>`,
    );
  }
  return `<div class="calendar" role="group" aria-label="Thirty days">${cells.join("")}</div>`;
}

function dayBlocksHtml(dayNum: number, editable: boolean): string {
  const scores = computeScores(state);
  const content = REBUILD[scores.dominant][dayNum - 1];
  const log = state.rebuild.days[dayNum] ?? {};
  const sealed = Boolean(log.muhasabah?.trim());

  const intentionBlock = editable
    ? `
      <div class="block">
        <p class="mono gold">Before the market — the intention</p>
        <p class="intention-line">“${esc(content.intention)}”</p>
        <label class="fine" for="intention-input">Write it out. Word for word, or in your own words. Writing it is the commitment.</label>
        <input type="text" id="intention-input" value="${esc(log.intention ?? "")}" autocomplete="off">
      </div>`
    : `
      <div class="block">
        <p class="mono gold">The intention</p>
        <p class="intention-line">“${esc(content.intention)}”</p>
        ${log.intention?.trim() ? `<p class="user-text">You wrote: ${esc(log.intention)}</p>` : `<p class="fine">Not written.</p>`}
      </div>`;

  const constraintButtons = editable
    ? `
      <div class="constraint-actions" role="group" aria-label="Did you hold the constraint">
        <button class="choice${log.constraint === "held" ? " on" : ""}" data-held="held">I held it</button>
        <button class="choice choice-broke${log.constraint === "broke" ? " on" : ""}" data-held="broke">I broke it</button>
      </div>
      <p class="fine">Log it either way. The log only works if it's true.</p>`
    : `<p class="user-text">${
        log.constraint === "held"
          ? "Held."
          : log.constraint === "broke"
            ? "Broken. Logged honestly."
            : "Not logged."
      }</p>`;

  const muhasabahBlock = editable
    ? `
      <div class="block">
        <p class="mono gold">After the close — muhasabah</p>
        ${dayNum === 1 ? `<p class="fine">Muhasabah: the nightly reckoning with yourself. Write it plainly.</p>` : ""}
        <p class="block-q">${esc(content.muhasabah)}</p>
        <textarea id="muhasabah-input" rows="5" aria-label="Your muhasabah answer">${esc(log.muhasabah ?? "")}</textarea>
        <div class="seal-row">
          <button class="btn" id="seal">${sealed ? "Update the entry" : "Seal the day"}</button>
          ${sealed ? `<span class="mono gold">Sealed</span>` : ""}
        </div>
      </div>`
    : `
      <div class="block">
        <p class="mono gold">Muhasabah</p>
        <p class="block-q">${esc(content.muhasabah)}</p>
        ${log.muhasabah?.trim() ? `<p class="user-text">${esc(log.muhasabah)}</p>` : `<p class="fine">No answer recorded.</p>`}
      </div>`;

  return `
    ${intentionBlock}
    <div class="block">
      <p class="mono gold">The constraint</p>
      <p class="block-q">${esc(content.constraint)}</p>
      ${constraintButtons}
    </div>
    ${muhasabahBlock}`;
}

function bindDayEditors(dayNum: number): void {
  const getLog = () => {
    const log = state.rebuild.days[dayNum] ?? {};
    state.rebuild.days[dayNum] = log;
    return log;
  };
  const intention = root.querySelector<HTMLInputElement>("#intention-input");
  intention?.addEventListener("change", () => {
    getLog().intention = intention.value;
    commit();
  });
  root.querySelectorAll<HTMLButtonElement>(".choice").forEach((b) => {
    b.addEventListener("click", () => {
      if (intention) getLog().intention = intention.value;
      getLog().constraint = b.dataset.held as "held" | "broke";
      commit();
      paint();
    });
  });
  const seal = root.querySelector<HTMLButtonElement>("#seal");
  const muhasabah = root.querySelector<HTMLTextAreaElement>("#muhasabah-input");
  seal?.addEventListener("click", () => {
    const log = getLog();
    if (intention) log.intention = intention.value;
    log.muhasabah = muhasabah?.value ?? "";
    log.savedAt = new Date().toISOString();
    commit();
    paint();
  });
}

function paintProtocol(): void {
  const scores = computeScores(state);
  const p = PROFILES[scores.dominant];

  if (!state.rebuild.startDate) {
    go({ name: "verdict" });
    return;
  }

  if (protocolFinished(state)) {
    const done = doneCount(state);
    const missed = missedCount(state);
    root.innerHTML = shell(`
      <section>
        <p class="mono gold">The 30-day rebuild — ${p.name}</p>
        <h1>Thirty days. It's written.</h1>
        <p class="mono dim-line">${done} sealed &nbsp;·&nbsp; <span class="${missed ? "miss-text" : ""}">${missed} missed</span></p>
        <p>The protocol is over. The document remains. Read it the way you'd
           read a letter from someone who finally stopped lying to you.</p>
        <p><button class="btn" id="read-30">Read your 30 days</button></p>
        ${calendarHtml()}
      </section>
    `);
    bindNav();
    bindCalendar();
    root.querySelector("#read-30")!.addEventListener("click", () => go({ name: "reader" }));
    return;
  }

  const today = currentDayNumber(state);
  const missed = missedCount(state);
  const done = doneCount(state);

  root.innerHTML = shell(`
    <section>
      <p class="mono gold">The 30-day rebuild — ${p.name}</p>
      ${
        today
          ? `
        <h1 class="day-title">Day ${today} <span class="day-of">of 30</span></h1>
        <p class="mono dim-line">${dateOfDay(state.rebuild.startDate!, today)}</p>
        ${dayBlocksHtml(today, true)}`
          : ""
      }
      <hr class="rule rule-tight">
      <p class="mono dim-line">${done} sealed &nbsp;·&nbsp; <span class="${missed ? "miss-text" : ""}">${missed} missed</span></p>
      ${calendarHtml()}
      <p class="fine">Missed days stay red. There is no streak repair here.
         The calendar is a record, not a scoreboard.</p>
    </section>
  `);
  bindNav();
  bindCalendar();
  if (today) bindDayEditors(today);
}

function bindCalendar(): void {
  root.querySelectorAll<HTMLButtonElement>(".cal-cell:not([disabled])").forEach((b) => {
    b.addEventListener("click", () => {
      const d = Number(b.dataset.day);
      if (dayStatus(state, d) === "today") {
        go({ name: "protocol" });
      } else {
        go({ name: "day", day: d });
      }
    });
  });
}

function paintDay(dayNum: number): void {
  const start = state.rebuild.startDate;
  if (!start) {
    go({ name: "verdict" });
    return;
  }
  const status = dayStatus(state, dayNum);
  root.innerHTML = shell(`
    <section>
      <button class="linkish" id="back-to-cal">← Back to the calendar</button>
      <h1 class="day-title">Day ${dayNum} <span class="day-of">of 30</span></h1>
      <p class="mono dim-line">${dateOfDay(start, dayNum)}
        ${status === "missed" ? ` &nbsp;·&nbsp; <span class="miss-text">Missed</span>` : ""}</p>
      ${
        status === "missed"
          ? `<p>No entry. The mark stays. Tomorrow's page is still blank, and that one you can write.</p>`
          : ""
      }
      ${dayBlocksHtml(dayNum, status === "today")}
    </section>
  `);
  bindNav();
  root.querySelector("#back-to-cal")!.addEventListener("click", () => go({ name: "protocol" }));
  if (status === "today") bindDayEditors(dayNum);
}

/* ----------------------------------------------------------------
   Mirror Log
---------------------------------------------------------------- */

function mirrorEntriesHtml(readerMode: boolean): string {
  const start = state.rebuild.startDate;
  if (!start) return "";
  const scores = computeScores(state);
  const days = REBUILD[scores.dominant];
  const parts: string[] = [];
  for (const day of days) {
    const status = dayStatus(state, day.day);
    if (status === "locked") continue;
    const log = state.rebuild.days[day.day];
    const date = dateOfDay(start, day.day);
    if (status === "missed") {
      parts.push(`
        <article class="entry entry-missed">
          <p class="mono">Day ${String(day.day).padStart(2, "0")} — ${date}</p>
          <p class="miss-text">Missed. No entry.</p>
        </article>`);
      continue;
    }
    const answer = log?.muhasabah?.trim();
    parts.push(`
      <article class="entry">
        <p class="mono">Day ${String(day.day).padStart(2, "0")} — ${date}</p>
        ${log?.intention?.trim() ? `<p class="entry-intention">${esc(log.intention)}</p>` : ""}
        ${
          log?.constraint
            ? `<p class="mono entry-constraint">Constraint: ${log.constraint === "held" ? "held" : "broken"}</p>`
            : ""
        }
        ${
          answer
            ? `${readerMode ? "" : `<p class="entry-q">${esc(day.muhasabah)}</p>`}
               <p class="entry-answer">${esc(answer)}</p>`
            : `<p class="fine">Open. Not yet sealed.</p>`
        }
      </article>`);
  }
  return parts.join("");
}

function paintMirror(): void {
  const started = Boolean(state.rebuild.startDate);
  const entries = started ? mirrorEntriesHtml(false) : "";
  root.innerHTML = shell(`
    <section>
      <p class="mono gold">The mirror log</p>
      <h1>Your own hand.</h1>
      ${
        started
          ? `
        <p>Every sealed night lands here, in order. On day 30 you read it
           back as one document. It will read like a letter, because it is one.</p>
        <div class="mirror-actions">
          <button class="btn btn-ghost" id="read-mode">Read your 30 days</button>
          <button class="btn btn-ghost" id="export">Export as text</button>
        </div>
        <div class="entries">${entries}</div>`
          : `
        <p>Empty, for now. The log begins when the rebuild does. Finish the
           verdict and begin day 1.</p>
        <p><button class="btn btn-ghost" data-nav="verdict">Back to the verdict</button></p>`
      }
      <hr class="rule rule-tight">
      <p class="fine">Everything here lives in this browser only.
        <button class="linkish danger" id="erase">Erase all data and start over</button></p>
    </section>
  `);
  bindNav();
  root.querySelector("#read-mode")?.addEventListener("click", () => go({ name: "reader" }));
  root.querySelector("#export")?.addEventListener("click", () => {
    const scores = computeScores(state);
    downloadText("niyyah-mirror-log.txt", buildMirrorText(state, scores.dominant));
  });
  root.querySelector("#erase")?.addEventListener("click", () => {
    const sure = window.confirm(
      "This erases the audit, the protocol, and every Mirror Log entry on this device. There is no undo.",
    );
    if (!sure) return;
    resetState();
    state = loadState();
    go({ name: "intro" });
  });
}

function paintReader(): void {
  root.innerHTML = shell(
    `
    <section class="reader">
      <button class="linkish reader-close" id="close-reader">Close</button>
      <p class="mono gold">Thirty days</p>
      <h1 class="reader-title">A letter from the one<br>who was driving.</h1>
      <p class="reader-sub">Read it slowly. You wrote every word.</p>
      <hr class="rule rule-tight">
      <div class="entries reader-entries">${mirrorEntriesHtml(true)}</div>
      <hr class="rule rule-tight">
      <p class="reader-end">End of the record. Whatever you do next, you do it knowing.</p>
    </section>
  `,
    { bare: true },
  );
  root.querySelector("#close-reader")!.addEventListener("click", () => go({ name: "mirror" }));
}

/* ----------------------------------------------------------------
   Router
---------------------------------------------------------------- */

function paint(): void {
  switch (view.name) {
    case "locked":
      paintLocked();
      break;
    case "intro":
      paintIntro();
      break;
    case "audit":
      paintAudit();
      break;
    case "verdict":
      paintVerdict();
      break;
    case "protocol":
      paintProtocol();
      break;
    case "day":
      paintDay(view.day);
      break;
    case "mirror":
      paintMirror();
      break;
    case "reader":
      paintReader();
      break;
  }
}

function boot(): void {
  claimAccessFromUrl();
  state = loadState();
  if (!hasAccess()) {
    view = { name: "locked" };
  } else if (!auditComplete(state)) {
    view = { name: "intro" };
  } else if (!state.rebuild.startDate) {
    view = { name: "verdict" };
  } else {
    view = { name: "protocol" };
  }
  paint();
}

boot();

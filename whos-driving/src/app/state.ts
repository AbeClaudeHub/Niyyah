import { QUESTIONS } from "../content/questions";
import { SABOTEUR_ORDER } from "../content/profiles";
import type { SaboteurId } from "../content/types";

/*
 * All product state lives in localStorage. No backend, no accounts.
 *
 * Soft gate (v1, accepted): the Stripe success URL appends ?access=granted,
 * which writes ACCESS_KEY. Anyone who knows the query string can open the
 * app. Acceptable for a $27 v1; revisit with signed links or license keys
 * if refund abuse shows up.
 */

const STATE_KEY = "niyyah.whosdriving.v1";
const ACCESS_KEY = "niyyah.whosdriving.access";

export type ConstraintResult = "held" | "broke";

export interface DayLog {
  intention?: string;
  constraint?: ConstraintResult;
  muhasabah?: string;
  savedAt?: string;
}

export interface PersistedState {
  v: 1;
  audit: {
    /** Answer per question, in QUESTIONS order. null = unanswered. 0–3. */
    answers: (number | null)[];
    completedAt: string | null;
  };
  rebuild: {
    /** Local date "YYYY-MM-DD" of day 1, set when the user begins. */
    startDate: string | null;
    days: Record<number, DayLog>;
  };
}

function blankState(): PersistedState {
  return {
    v: 1,
    audit: { answers: QUESTIONS.map(() => null), completedAt: null },
    rebuild: { startDate: null, days: {} },
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.v !== 1 || !Array.isArray(parsed.audit?.answers)) return blankState();
    // Heal answer array length if the question set ever changes.
    const answers = QUESTIONS.map((_, i) => {
      const a = parsed.audit.answers[i];
      return typeof a === "number" && a >= 0 && a <= 3 ? a : null;
    });
    return {
      v: 1,
      audit: { answers, completedAt: parsed.audit.completedAt ?? null },
      rebuild: {
        startDate: parsed.rebuild?.startDate ?? null,
        days: parsed.rebuild?.days ?? {},
      },
    };
  } catch {
    return blankState();
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function resetState(): void {
  localStorage.removeItem(STATE_KEY);
}

/* ---- access ---- */

export function hasAccess(): boolean {
  return localStorage.getItem(ACCESS_KEY) === "1";
}

/** Grants access when the URL carries ?access=granted, then cleans the URL. */
export function claimAccessFromUrl(): void {
  const params = new URLSearchParams(location.search);
  if (params.get("access") === "granted") {
    localStorage.setItem(ACCESS_KEY, "1");
    history.replaceState(null, "", location.pathname);
  }
}

/* ---- scoring ---- */

export interface Scores {
  totals: Record<SaboteurId, number>;
  /** Count of "Every week" answers per saboteur — the tie-breaker. */
  peaks: Record<SaboteurId, number>;
  dominant: SaboteurId;
  /** Second-highest saboteur, for the "close behind" line. */
  second: SaboteurId;
}

export function firstUnanswered(state: PersistedState): number {
  return state.audit.answers.findIndex((a) => a === null);
}

export function auditComplete(state: PersistedState): boolean {
  return firstUnanswered(state) === -1;
}

export function computeScores(state: PersistedState): Scores {
  const totals = { kibr: 0, tama: 0, ghadab: 0, waswas: 0 };
  const peaks = { kibr: 0, tama: 0, ghadab: 0, waswas: 0 };
  QUESTIONS.forEach((q, i) => {
    const a = state.audit.answers[i];
    if (a === null) return;
    totals[q.saboteur] += a;
    if (a === 3) peaks[q.saboteur] += 1;
  });
  const ranked = [...SABOTEUR_ORDER].sort((a, b) => {
    if (totals[b] !== totals[a]) return totals[b] - totals[a];
    if (peaks[b] !== peaks[a]) return peaks[b] - peaks[a];
    return SABOTEUR_ORDER.indexOf(a) - SABOTEUR_ORDER.indexOf(b);
  });
  return { totals, peaks, dominant: ranked[0], second: ranked[1] };
}

/* ---- rebuild calendar ---- */

export type DayStatus = "locked" | "today" | "done" | "missed";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date, not UTC — a Sydney night is still that day's session. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateOfDay(startDate: string, day: number): string {
  const [y, m, dd] = startDate.split("-").map(Number);
  const d = new Date(y, m - 1, dd + (day - 1));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayIsDone(state: PersistedState, day: number): boolean {
  return Boolean(state.rebuild.days[day]?.muhasabah?.trim());
}

export function dayStatus(state: PersistedState, day: number): DayStatus {
  const start = state.rebuild.startDate;
  if (!start) return "locked";
  const date = dateOfDay(start, day);
  const now = todayLocal();
  if (date > now) return "locked";
  if (dayIsDone(state, day)) return "done";
  return date === now ? "today" : "missed";
}

/** The day number whose date is today, or null if outside the 30 days. */
export function currentDayNumber(state: PersistedState): number | null {
  const start = state.rebuild.startDate;
  if (!start) return null;
  for (let day = 1; day <= 30; day++) {
    if (dateOfDay(start, day) === todayLocal()) return day;
  }
  return null;
}

export function missedCount(state: PersistedState): number {
  let missed = 0;
  for (let day = 1; day <= 30; day++) {
    if (dayStatus(state, day) === "missed") missed++;
  }
  return missed;
}

export function doneCount(state: PersistedState): number {
  let done = 0;
  for (let day = 1; day <= 30; day++) {
    if (dayIsDone(state, day)) done++;
  }
  return done;
}

export function protocolFinished(state: PersistedState): boolean {
  const start = state.rebuild.startDate;
  if (!start) return false;
  return todayLocal() > dateOfDay(start, 30);
}

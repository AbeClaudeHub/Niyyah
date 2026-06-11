export type SaboteurId = "kibr" | "tama" | "ghadab" | "waswas";

export interface Question {
  /** Stable id, used as the answer-array key. */
  id: string;
  /** Which saboteur this question scores. Never shown to the user. */
  saboteur: SaboteurId;
  text: string;
}

export interface SaboteurProfile {
  id: SaboteurId;
  /** Transliterated name, e.g. "Kibr". */
  name: string;
  /** Arabic script. */
  arabic: string;
  /** One-word register, e.g. "Ego". */
  register: string;
  /** One-line definition for cards and bars. */
  definition: string;
  /** What it sounds like in your head — one line, quoted on the sales page. */
  voice: string;
  /** The full verdict profile, 150–200 words, rendered as paragraphs. */
  profile: string[];
  /** The single counter-discipline, named short. */
  counter: string;
  /** One cutting line under the dial on the verdict screen. */
  verdictLine: string;
}

export interface RebuildDay {
  day: number;
  /** The pre-market line. The user writes it out to commit to it. */
  intention: string;
  /** The behavioral constraint for the session. */
  constraint: string;
  /** The nightly muhasabah question. */
  muhasabah: string;
}

export const ANSWER_LABELS = ["Never", "Sometimes", "Often", "Every week"] as const;
export const MAX_SCORE_PER_SABOTEUR = 15; // 5 questions × 3 points

import type { Question } from "./types";

/**
 * 20 questions, 5 per saboteur, in a fixed interleaved order so no two
 * questions for the same saboteur sit next to each other and the mapping
 * stays invisible. The mapping is never shown to the user.
 */
export const QUESTIONS: Question[] = [
  {
    id: "k1",
    saboteur: "kibr",
    text: "I've moved a stop loss while telling myself I was “giving the trade room.”",
  },
  {
    id: "w1",
    saboteur: "waswas",
    text: "I've watched a setup I planned hit target without me, then entered late at a worse price.",
  },
  {
    id: "t1",
    saboteur: "tama",
    text: "I've hit my daily target, then kept trading, because stopping felt like leaving money on the table.",
  },
  {
    id: "g1",
    saboteur: "ghadab",
    text: "Within minutes of a stop-out, I've been back in. Same market, bigger size.",
  },
  {
    id: "w2",
    saboteur: "waswas",
    text: "I close winners early. Not because the chart changed. Because the profit might leave.",
  },
  {
    id: "k2",
    saboteur: "kibr",
    text: "I've added to a losing position because being wrong once felt worse than losing more.",
  },
  {
    id: "t2",
    saboteur: "tama",
    text: "After two or three wins I size up. Not because the setup is better. Because I feel unstoppable.",
  },
  {
    id: "g2",
    saboteur: "ghadab",
    text: "I've broken my daily loss limit because ending the day red felt unbearable.",
  },
  {
    id: "w3",
    saboteur: "waswas",
    text: "One red candle against me, and I start rebuilding the entire thesis.",
  },
  {
    id: "t3",
    saboteur: "tama",
    text: "I take trades I know are mediocre because waiting for the good one feels like wasted time.",
  },
  {
    id: "k3",
    saboteur: "kibr",
    text: "I skip journaling the trades that would embarrass me.",
  },
  {
    id: "g3",
    saboteur: "ghadab",
    text: "After a loss, I've traded to get back at the market, not to follow my plan.",
  },
  {
    id: "t4",
    saboteur: "tama",
    text: "A green day that's smaller than yesterday's feels like a loss.",
  },
  {
    id: "w4",
    saboteur: "waswas",
    text: "Before pressing buy, I look for someone else's chart, signal, or opinion to make it feel safer.",
  },
  {
    id: "g4",
    saboteur: "ghadab",
    text: "One loss has turned into five in a single session, and I couldn't tell you the setup for the last four.",
  },
  {
    id: "k4",
    saboteur: "kibr",
    text: "When a trade goes against me, my first thought is that the market is wrong. Not that I am.",
  },
  {
    id: "w5",
    saboteur: "waswas",
    text: "I hesitate on my best setups, then take a worse trade an hour later out of regret.",
  },
  {
    id: "g5",
    saboteur: "ghadab",
    text: "I've sworn at the screen, slammed something, then placed a trade in that exact state.",
  },
  {
    id: "t5",
    saboteur: "tama",
    text: "During a live trade, I check my running P&L more than I check the chart.",
  },
  {
    id: "k5",
    saboteur: "kibr",
    text: "I've held a loser past my invalidation because I'd already told someone it would work. Even if that someone was me.",
  },
];

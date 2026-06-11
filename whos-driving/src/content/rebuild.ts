import type { RebuildDay, SaboteurId } from "./types";

/**
 * The 30-Day Rebuild. Four full protocols, one per saboteur.
 *
 * Shared arc:
 *   Days 1–7    Watch.     See the pattern without fixing it yet.
 *   Days 8–14   Interrupt. One hard rule at the trigger point.
 *   Days 15–21  Replace.   Build the opposite motion.
 *   Days 22–30  Own.       The rule becomes yours. Day 30 reads it all back.
 */

const KIBR: RebuildDay[] = [
  {
    day: 1,
    intention: "Today my stop loss is a promise, not an opinion.",
    constraint:
      "Before your first trade, write your invalidation price down. If price touches it, you are flat. No reading the chart for one more candle.",
    muhasabah:
      "Did price prove you wrong anywhere today? Write the exact moment. If you argued with it, write what you said to yourself.",
  },
  {
    day: 2,
    intention: "I would rather be wrong and flat than right and ruined.",
    constraint:
      "Count every time you think “the market is wrong” or “this doesn't make sense.” Tally on paper. No other action required.",
    muhasabah: "How many tallies? What was the market doing each time you made one?",
  },
  {
    day: 3,
    intention: "The chart owes me nothing. It does not know I exist.",
    constraint:
      "You may not state a prediction to anyone today. No “this is going up.” Not in a group chat, not out loud, not to yourself in the mirror.",
    muhasabah: "Did you feel the urge to announce a call today? Who were you performing for?",
  },
  {
    day: 4,
    intention: "Every loss goes in the journal today. Especially the ugly one.",
    constraint:
      "Journal every trade within five minutes of closing it. Losses first, full size, entry to exit. No cleanup. No excuses column.",
    muhasabah: "Which trade did you least want to write down? Write why, here.",
  },
  {
    day: 5,
    intention: "Being wrong costs one stop. Refusing to be wrong costs the account.",
    constraint:
      "Set your stop before entry and screenshot it. Moving it anywhere except toward safety is a violation. If it happens, log it honestly.",
    muhasabah: "Did your hand drift toward the stop today? What was the feeling one second before?",
  },
  {
    day: 6,
    intention: "I am not my last trade. I am not my best trade either.",
    constraint:
      "After any winning trade, wait one full setup cycle before re-entering. The win does not promote you.",
    muhasabah: "Did winning today change how big or how sure you felt? Be exact.",
  },
  {
    day: 7,
    intention: "Today I review the week the way an auditor would. Cold.",
    constraint:
      "No new trades until you have re-read days 1 through 6 in your Mirror Log. Then trade your plan, or don't trade.",
    muhasabah:
      "Reading your own week back: where does the ego show up most? Name the pattern in one sentence.",
  },
  {
    day: 8,
    intention: "When the stop is hit, I am flat in the same breath.",
    constraint:
      "The rule starts today: stop hit means out, hands off, stand up. If no stop fires, rehearse it once anyway, out loud.",
    muhasabah: "Did you exit clean today, or negotiate? Describe the exit honestly.",
  },
  {
    day: 9,
    intention: "I do not add to losers. Averaging down is arguing with reality.",
    constraint:
      "Adding to any losing position is forbidden today. One entry per idea. If it loses, the idea was wrong. Let it be wrong.",
    muhasabah: "Did a losing position whisper “better price” at you today? What did you do?",
  },
  {
    day: 10,
    intention: "My job is execution, not vindication.",
    constraint:
      "Before each entry, say the invalidation out loud: “If price hits this level, I was wrong.” No entry without saying it.",
    muhasabah:
      "Did saying it out loud change anything? Did you skip it on any trade? Why that one?",
  },
  {
    day: 11,
    intention: "A small loss taken fast is the cheapest thing I will buy today.",
    constraint:
      "If a trade moves against you and the setup visibly degrades, you may exit before the stop and log it as a correct decision. Practice cutting, not hoping.",
    muhasabah:
      "Did you cut anything early today? If you held and hoped instead, what were you protecting?",
  },
  {
    day: 12,
    intention: "Nobody is watching. There is no audience to be right for.",
    constraint: "No posting trades, P&L, or charts anywhere today. Trade unseen.",
    muhasabah: "Was trading different with no audience? What changed?",
  },
  {
    day: 13,
    intention: "I review losers the way I review winners. Same table, same light.",
    constraint:
      "Tonight's journal requires one line per loss: “The market told me X, and I heard it at price Y.” No loss skipped.",
    muhasabah:
      "Write that line now for today's worst trade. If you didn't trade, write it for the last loss you still flinch at.",
  },
  {
    day: 14,
    intention: "Two weeks in. The stop is no longer a debate.",
    constraint:
      "Mid-protocol audit: count your violations from days 8 to 13. Write the number at the top of today's journal. No commentary. Just the number.",
    muhasabah:
      "What is the number? Is it shrinking? What does the number say that your self-image doesn't?",
  },
  {
    day: 15,
    intention: "Today I look for where I'm wrong before the market finds it.",
    constraint:
      "Before entering, write one sentence: the strongest argument against this trade. If you can't write one, you haven't looked.",
    muhasabah:
      "Did writing the case against your trade change your size, your stop, or your patience?",
  },
  {
    day: 16,
    intention: "Confidence is quiet. Certainty is the impostor.",
    constraint:
      "The words “definitely,” “guaranteed,” and “can't lose” are banned from your head today. Tally each occurrence.",
    muhasabah: "How many tallies? Which setup made the certainty loudest?",
  },
  {
    day: 17,
    intention: "I hold opinions like water and positions like rules.",
    constraint:
      "If the session invalidates your bias, you must write the new bias down before acting on it. Flip on paper first.",
    muhasabah: "Did you change your mind today? Was it because of price, or because of pain?",
  },
  {
    day: 18,
    intention: "Being wrong often is the job. Staying wrong is the sin.",
    constraint:
      "Every loss today gets logged with the amount written out in words, not digits. “Two hundred forty dollars.” Make it real.",
    muhasabah:
      "Writing the loss in words: what did you feel? Where else in your life do you round pain down?",
  },
  {
    day: 19,
    intention: "My edge is a process. It does not need me to defend it.",
    constraint:
      "No re-entering any market within thirty minutes of being stopped out of it. The fast re-entry is rarely analysis. It's an appeal.",
    muhasabah:
      "Did you want to appeal a verdict today? What was the evidence for the re-entry, honestly?",
  },
  {
    day: 20,
    intention: "I can be the kind of trader whose losses are boring.",
    constraint:
      "Target for today: every loss identical in process. Planned stop, instant exit, one-line journal. Grade yourself tonight.",
    muhasabah: "Grade your losses today, A to F, on process alone. Explain the grade in one sentence.",
  },
  {
    day: 21,
    intention: "Three weeks. Tonight I read my own evidence.",
    constraint:
      "No new positions in the last hour of your session. End the week deliberately, not breathless.",
    muhasabah:
      "Re-read days 15 to 20 in your Mirror Log. What has changed since day 1? What hasn't moved at all?",
  },
  {
    day: 22,
    intention: "The rule is mine now. Nobody imposed it.",
    constraint:
      "Write your stop-loss rule in your own words at the top of your journal, and sign it. That version is the one you keep.",
    muhasabah: "Does the rule you wrote feel like yours, or borrowed? What would make it yours?",
  },
  {
    day: 23,
    intention: "I am building a record I could show anyone.",
    constraint:
      "Trade today as if the full session will be reviewed by the trader you respect most. Every entry, every exit, on record.",
    muhasabah: "If they had watched today, which moment would you want to explain away?",
  },
  {
    day: 24,
    intention: "Humility is operational. It looks like a stop order.",
    constraint:
      "A hard stop in the market on every position today. Not mental. In the book, working.",
    muhasabah:
      "Mental stops versus working stops: which did you actually run today, and what does the choice say?",
  },
  {
    day: 25,
    intention: "I let winners prove me right. I never make losers do it.",
    constraint:
      "You may add only to winning positions today, and only at a level written before entry. Losers get nothing.",
    muhasabah: "Did you feed anything today, winner or loser? What did it earn?",
  },
  {
    day: 26,
    intention: "The market will humble me eventually. I'd rather do it myself, daily, in small amounts.",
    constraint:
      "Start the session by writing your three worst trades of the month from memory. Then trade.",
    muhasabah:
      "Did the morning list change how you traded? Smaller, slower, sharper? Or had you forgotten it by noon?",
  },
  {
    day: 27,
    intention: "This trade does not need to be special. It needs to be correct.",
    constraint:
      "Flat size all day. Every position identical. No conviction sizing. Conviction is where the ego hides.",
    muhasabah:
      "Did any trade feel like it deserved more size? That feeling is the subject of this whole protocol. Describe it.",
  },
  {
    day: 28,
    intention: "Two days left. The audit was the start, not the verdict.",
    constraint:
      "Repeat day 8's rule, perfectly: stop hit means flat, same breath, stand up. Prove the habit held.",
    muhasabah:
      "Day 8 versus day 28. Same rule. Is your body different when the stop fires? How?",
  },
  {
    day: 29,
    intention: "Tomorrow I read everything. Tonight I trade like it's already written.",
    constraint:
      "Close the session with your journal fully current before you stand up. Nothing left unwritten overnight.",
    muhasabah:
      "Is there anything from this month you still haven't written down? Write it now. It belongs in the letter.",
  },
  {
    day: 30,
    intention: "I read my own testimony today. All of it.",
    constraint:
      "No trading today. Or half size, finished early. Then open the Mirror Log and read all thirty days, start to end, without skipping.",
    muhasabah:
      "You just read thirty days of your own voice. Who was driving on day 1? Who is driving now? Write the answer like you're telling the truth. Because you are.",
  },
];

const TAMA: RebuildDay[] = [
  {
    day: 1,
    intention: "Today, enough is a number I choose before the open.",
    constraint:
      "Before the session, write your maximum number of trades and your stop point, target or time. Today you only have to write it, not obey it. Watch what happens.",
    muhasabah:
      "Did you cross the line you wrote this morning? At what moment did “enough” become “a little more”?",
  },
  {
    day: 2,
    intention: "Every trade today must pay rent: a written reason before entry.",
    constraint:
      "No entry without one written sentence of setup. Count how many trades wanted in but couldn't pay.",
    muhasabah: "How many trades did the sentence rule kill today? What were they, honestly?",
  },
  {
    day: 3,
    intention: "I am watching my hands today, not my P&L.",
    constraint: "Tally every time you check your running P&L. Just count. Change nothing else.",
    muhasabah: "What's the count? What were you hoping the number would do for you?",
  },
  {
    day: 4,
    intention: "The afternoon trade is rarely a setup. It is usually appetite.",
    constraint:
      "Grade each of today's trades A, B, or C at entry, in writing. No grade, no trade.",
    muhasabah: "List today's grades in order. Where in the day do the Bs and Cs cluster?",
  },
  {
    day: 5,
    intention: "A small green day is a green day. Full stop.",
    constraint:
      "Tally every time you compare today's P&L to another day, another trader, or an imagined number.",
    muhasabah: "What did you compare today to? Who set the number you feel behind?",
  },
  {
    day: 6,
    intention: "Size is a decision, not a mood.",
    constraint:
      "Write your position size for the day before the open. Every trade at that size. Note every urge to deviate.",
    muhasabah:
      "When did you want to size up today? What had just happened in the five minutes before?",
  },
  {
    day: 7,
    intention: "One week watched. Tonight I count the appetite.",
    constraint:
      "Your first loss ends the session today. Spend the recovered time re-reading days 1 to 6 in your Mirror Log.",
    muhasabah:
      "Reading the week back: how many of your trades existed because of hunger, not setup? Write it as a fraction.",
  },
  {
    day: 8,
    intention: "Today I stop at the number. The number is the discipline.",
    constraint:
      "The quota starts: three trades maximum. The third trade closes, the platform closes. Whatever the P&L.",
    muhasabah:
      "Did you stop at three? If yes, what did the extra hours feel like? If no, what did trade four give you?",
  },
  {
    day: 9,
    intention: "Hitting target and stopping is the entire skill I'm building.",
    constraint:
      "If you hit your daily target, you are done within five minutes. Log out. The market continues without you. That is the practice.",
    muhasabah:
      "Did you have to stop today? If yes, write what your head said in the five minutes after. If no, write what you imagine it would say.",
  },
  {
    day: 10,
    intention: "I don't get paid for activity. I get paid for waiting.",
    constraint:
      "Minimum thirty minutes between trades today. Set a timer. The gap is the trade.",
    muhasabah: "What happened inside the gaps? What did your hands want to do?",
  },
  {
    day: 11,
    intention: "Oversizing is borrowing against a future I haven't earned.",
    constraint:
      "Half size today, every trade. Notice whether your decisions get better or worse when the money matters less.",
    muhasabah:
      "At half size, were your entries cleaner or sloppier? What does that say about what full size does to your eyes?",
  },
  {
    day: 12,
    intention: "After a win I am most dangerous. Today I act like I know that.",
    constraint:
      "After any winning trade: fifteen minutes flat, platform closed. The win cools before the next decision.",
    muhasabah: "Did a win try to buy the next trade today? Describe the urge in one sentence.",
  },
  {
    day: 13,
    intention: "The market is not leaving. There is a session tomorrow.",
    constraint:
      "Pick your two best hours in advance. Trade only inside them. Outside the window, charts closed.",
    muhasabah:
      "What did the market do outside your window? Did you check? Be honest about how many times.",
  },
  {
    day: 14,
    intention: "Two weeks in. Tonight I count what the quota saved me.",
    constraint:
      "Mid-protocol audit: count every trade from days 8 to 13 that broke quota, size, or window. Write the count and what those trades cost in total.",
    muhasabah: "What did the violations cost in money? What did they cost in how you slept?",
  },
  {
    day: 15,
    intention: "Today I hunt one trade. The best one I can find. Maybe none.",
    constraint:
      "One trade maximum. If the A-setup never comes, you take nothing, and you log a perfect day.",
    muhasabah:
      "One bullet. Did you fire it well, or waste it? If you never fired, how does a zero-trade day actually feel, underneath?",
  },
  {
    day: 16,
    intention: "My target today is obedience, not money.",
    constraint:
      "Tonight you grade the day only on rules followed. P&L gets written at the bottom. Last. Small.",
    muhasabah:
      "Grade the day A to F on obedience alone. Did the grade and the P&L agree? Which one is the real result?",
  },
  {
    day: 17,
    intention: "What I keep matters more than what I catch.",
    constraint:
      "If a position hits target, take it. Full exit at the plan. No improvising a runner today.",
    muhasabah:
      "Did you take the planned exit or stretch it? What is your relationship with the word “more” today?",
  },
  {
    day: 18,
    intention: "I can watch a move happen without being owed a piece of it.",
    constraint:
      "When you finish for the day, watch the market for ten minutes, flat, on purpose. See moves you're not in. Let them pass.",
    muhasabah:
      "Watching flat: which move hurt to miss? Write the sentence your head said about it.",
  },
  {
    day: 19,
    intention: "Appetite shrinks when it's named. I name it at the door.",
    constraint:
      "Before every entry today, write one word: “setup” or “hunger.” You may only take the ones marked “setup.”",
    muhasabah:
      "How many times did you write “hunger” today? Did naming it kill it, or did it argue back?",
  },
  {
    day: 20,
    intention: "Enough was today's number. I reach it or I don't. Either way I stop.",
    constraint:
      "Repeat day 8 exactly: three trades maximum, then done. The habit gets one more coat.",
    muhasabah: "Compare today to day 8. Is stopping getting quieter? More yours?",
  },
  {
    day: 21,
    intention: "Three weeks. Tonight I read what hunger wrote.",
    constraint:
      "End the session thirty minutes early. Use the time to re-read days 15 to 20 in the Mirror Log.",
    muhasabah:
      "In your own entries, find the day greed was loudest. Quote your own line back to yourself, here.",
  },
  {
    day: 22,
    intention: "The quota is mine now. I'd keep it even if nobody asked.",
    constraint:
      "Write your permanent trade quota and stop-rule in your own words, signed, at the top of your journal.",
    muhasabah:
      "Is the number you chose honest, or negotiated? What would the greedier version of you have written?",
  },
  {
    day: 23,
    intention: "I trade my plan's size, in my plan's window, at my plan's pace.",
    constraint:
      "Full-rails day: quota, fixed size, time window, written reasons. All four at once.",
    muhasabah: "Four rails. Which one bent today? That rail is next month's work.",
  },
  {
    day: 24,
    intention: "A missed trade costs nothing.",
    constraint:
      "Keep a “missed and survived” list today: every trade you didn't take and what happened after. Truthfully, including the ones that worked.",
    muhasabah:
      "Look at the list. The ones that worked without you: are you still whole? What did missing them actually cost?",
  },
  {
    day: 25,
    intention: "I am building a month I can live on, not a day I can brag about.",
    constraint:
      "No P&L checks until session end. Hide the number if your platform shows it.",
    muhasabah:
      "A session without the running number: how did you decide your exits? Better or worse?",
  },
  {
    day: 26,
    intention: "Today the win cools before it spends.",
    constraint:
      "Repeat day 12: after any win, fifteen minutes flat. Stack it with the quota. Both rules, all day.",
    muhasabah:
      "What is the win-feeling like at minute one versus minute fifteen? Describe the difference. The difference is the edge.",
  },
  {
    day: 27,
    intention: "More is not a direction. It's a leak.",
    constraint:
      "Find one place to take less today: smaller size, fewer trades, an earlier finish. Choose it now, write it, do it.",
    muhasabah:
      "You took less on purpose today. What did you get back? Time, calm, clarity? Name it.",
  },
  {
    day: 28,
    intention: "Two days left. Stopping is now something I do well.",
    constraint:
      "Hit any one of your limits today, quota, target, or time, and stop within five minutes. One more clean exit.",
    muhasabah: "Rate your stop today, one to ten, on cleanness. What would a ten look like tomorrow?",
  },
  {
    day: 29,
    intention: "Tonight nothing is left open. Not a position, not a sentence.",
    constraint:
      "Flat by session close. Journal complete before you stand up. Tomorrow is for reading.",
    muhasabah:
      "Is there a want you carried all month that you haven't written down? Write it now. The letter needs it.",
  },
  {
    day: 30,
    intention: "Today I read thirty days of my own appetite.",
    constraint:
      "No trading today. Or half size, finished early. Then open the Mirror Log and read all thirty days without skipping.",
    muhasabah:
      "You just read a month of your own hunger. What is “enough,” in your own words, now? Write it like you intend to keep it.",
  },
];

const GHADAB: RebuildDay[] = [
  {
    day: 1,
    intention: "Today I watch what a loss does to my body before it reaches my hands.",
    constraint:
      "After every loss today, write three observations: jaw, shoulders, breath. Just observe. Trade as normal otherwise.",
    muhasabah: "What did the loss do to your body today? Where does the anger sit first?",
  },
  {
    day: 2,
    intention: "The market did not do it to me. It did not see me.",
    constraint:
      "Tally every “it” thought today: “it took my stop,” “it always does this,” “they hunted me.” Count the persecutions.",
    muhasabah: "How many tallies? Read them back. Who, exactly, is “they”?",
  },
  {
    day: 3,
    intention: "Speed is the tell. Anger trades fast.",
    constraint:
      "Write the time of every entry today. Tonight, measure the minutes between each loss and the next entry.",
    muhasabah:
      "What was your shortest loss-to-entry gap today? What was that trade's quality, honestly?",
  },
  {
    day: 4,
    intention: "Getting it back is not a strategy. It's a debt spiral with a chart open.",
    constraint:
      "Tally every “get it back” thought today. Next to each, note the loss that triggered it.",
    muhasabah:
      "Which loss demanded repayment loudest today? Why that one? What did it threaten?",
  },
  {
    day: 5,
    intention: "Red is information. It is not an insult.",
    constraint:
      "After each loss, write one neutral sentence: “I risked X, the setup failed, I paid X.” No adjectives allowed.",
    muhasabah:
      "Was writing without adjectives hard? Which adjective fought hardest to get in?",
  },
  {
    day: 6,
    intention: "Today I find my real loss limit: the number after which I am not myself.",
    constraint:
      "Write the amount at which, historically, you start trading like someone else. Be honest. That number is your wall now, on paper.",
    muhasabah:
      "What is the number? When did you last cross it, and what happened in the hour after?",
  },
  {
    day: 7,
    intention: "One week of watching the fire. Tonight I map it.",
    constraint:
      "No trading within thirty minutes of any argument, bad news, or frustration from outside the market. Anger imported is still anger.",
    muhasabah:
      "Re-read days 1 to 6. Write your anger's signature in one sentence: trigger, body, first bad action.",
  },
  {
    day: 8,
    intention: "After any loss, my hands come off for fifteen minutes. Starting today.",
    constraint:
      "The rule begins: any loss means fifteen minutes away from the platform. Timer on, screen closed. Log that you served it.",
    muhasabah:
      "Did you serve the full fifteen each time? What was minute three like? Minute twelve?",
  },
  {
    day: 9,
    intention: "I do not trade to feel better. A feeling is not a position.",
    constraint:
      "Any entry that follows a loss, after the fifteen minutes, requires one written line first: “This trade is a setup, not a settlement.”",
    muhasabah:
      "How many post-loss trades did you take? Looking at them now: setups, or settlements?",
  },
  {
    day: 10,
    intention: "The daily loss limit is a wall, not a suggestion.",
    constraint:
      "Set the limit you wrote on day 6, in the platform if it supports it, on paper if not. Touch it, and the session ends that minute.",
    muhasabah:
      "Did the wall get tested today? If you stopped, what was the rest of the day for? If you broke through, what was on the other side?",
  },
  {
    day: 11,
    intention: "Size does not avenge. Doubling after a loss is anger doing math.",
    constraint:
      "No trade after a loss may be larger than the trade that lost. Same size or smaller, always, all day.",
    muhasabah:
      "Did you want to double today? What number did the anger suggest, and what would it have risked?",
  },
  {
    day: 12,
    intention: "I end red days while they are small. That is the whole skill.",
    constraint:
      "Two consecutive losses means a thirty-minute break, not fifteen. Three means done for the day. Count honestly.",
    muhasabah:
      "How far down the ladder did today go? At which loss was your judgment actually gone, in hindsight?",
  },
  {
    day: 13,
    intention: "The chart at night looks nothing like it felt at noon.",
    constraint:
      "Tonight, screenshot today's chart and mark your entries. For every post-loss entry, write whether you would take it cold, tomorrow morning.",
    muhasabah:
      "Your post-loss entries, seen cold: how many would you take fresh? What does the gap tell you?",
  },
  {
    day: 14,
    intention: "Two weeks. I measure the temperature drop.",
    constraint:
      "Mid-protocol audit: count every revenge entry from days 8 to 13. An entry within fifteen minutes of a loss, or sized up after one, counts. Write the count and the cost.",
    muhasabah:
      "The count and the cost: write both. Is the fire smaller, or just better hidden?",
  },
  {
    day: 15,
    intention: "Today the break is not a punishment. It is the position.",
    constraint:
      "After every loss: fifteen minutes off, then one written line about why the setup failed, before you may look at a chart again. Analysis before re-entry.",
    muhasabah: "Did the written line change what you did next? Copy today's best one here.",
  },
  {
    day: 16,
    intention: "I can stand up mid-session. The chair is not a cell.",
    constraint:
      "Take one deliberate twenty-minute walk during market hours today, flat, phone left behind. Practice leaving while the market runs.",
    muhasabah:
      "What did the walk interrupt? What was waiting when you returned, and had it actually changed?",
  },
  {
    day: 17,
    intention: "Losses are tuition I agreed to pay. The fee was posted at the door.",
    constraint:
      "Before the open, pre-write the worst case: “If I lose X today, that was the agreed price of doing business.” Sign it.",
    muhasabah:
      "If today went red, did the signed agreement change the heat? If green, write the sentence you'd need to believe on the worst day.",
  },
  {
    day: 18,
    intention: "I notice the wronged story starting, and I put it down.",
    constraint:
      "When the persecution story starts, “they hunted my stop,” write the boring version instead: price went where my risk was. One rewrite per occurrence.",
    muhasabah: "How many stories did you rewrite today? Copy your best boring version here.",
  },
  {
    day: 19,
    intention: "My last loss does not get a vote in my next trade.",
    constraint:
      "Before each entry, one written check: “Would I take this if I were green today?” No honest yes, no trade.",
    muhasabah:
      "Did any trade fail the green-day test today? Which one, and what was it really for?",
  },
  {
    day: 20,
    intention: "Today I protect the session from one bad hour.",
    constraint:
      "Repeat day 12's ladder: two losses, thirty minutes off. Three, done. The ladder is becoming reflex.",
    muhasabah:
      "Day 12 versus today: is stopping earlier getting easier? What does your body do now at loss number two?",
  },
  {
    day: 21,
    intention: "Three weeks. Tonight I read the fire's diary.",
    constraint:
      "End early today. Re-read days 15 to 20 in the Mirror Log with the platform closed, before maghrib if you can.",
    muhasabah:
      "Reading your own entries: when did anger last place a trade with your hands? How many days ago? That number is the progress.",
  },
  {
    day: 22,
    intention: "The fifteen minutes is mine now. I'd keep it if nobody ever checked.",
    constraint:
      "Write your post-loss rule in your own words, signed, at the top of your journal. That version is permanent.",
    muhasabah:
      "Read your rule out loud. Is it written like a punishment or like armor? Rewrite it here until it's armor.",
  },
  {
    day: 23,
    intention: "Calm is not weakness. It is the only state with good aim.",
    constraint:
      "Full-ladder day: fifteen minutes after any loss, thirty after two, done at three, no sizing up after red. All rails at once.",
    muhasabah: "All rails up. Did trading feel smaller today, or cleaner? Where is the difference?",
  },
  {
    day: 24,
    intention: "I bring nothing into the session that was burning before it.",
    constraint:
      "Sixty seconds before the open, write your state in three words. If one of them is angry, tired, or wounded: half size all day.",
    muhasabah: "What were your three words? Did the day confirm them or surprise you?",
  },
  {
    day: 25,
    intention: "The market will be where I left it. Walking away loses nothing.",
    constraint:
      "Practice one voluntary exit today: close everything and leave for fifteen minutes while green or flat. Leaving must not require a wound.",
    muhasabah:
      "Leaving without being forced: what did it prove? Could you have done that six months ago?",
  },
  {
    day: 26,
    intention: "I answer losses with process, not with volume.",
    constraint:
      "Any loss today is answered with exactly one action: re-reading your setup checklist before the next trade. That is the entire response.",
    muhasabah:
      "Did the checklist feel like enough of a response? What would “enough of a response” to a loss even be?",
  },
  {
    day: 27,
    intention: "Nobody owes me a green day. Not the market, not the month.",
    constraint:
      "If you are red at the session's halfway point, your only goal becomes ending at that number. Defense only: best setups, minimum size, or nothing.",
    muhasabah:
      "Did you play defense today? If yes, how does a contained red day compare to a chased one? If no, write the plan for the day it comes.",
  },
  {
    day: 28,
    intention: "Two days left. The fire still lives here. It just doesn't drive.",
    constraint:
      "Repeat day 8 perfectly: any loss, fifteen minutes, logged. Prove the reflex held for twenty days.",
    muhasabah:
      "Day 8 versus day 28: what happens inside you now, between the stop-out and the timer's end? Write the difference.",
  },
  {
    day: 29,
    intention: "Tonight I close everything. Positions, journal, and the ledger of who wronged me.",
    constraint:
      "Flat by close. Journal current before you stand. Then write one line stating what the market is: a price. Not an opponent.",
    muhasabah:
      "Is there a loss from this month you are still arguing with? Write the argument here, and end it tonight.",
  },
  {
    day: 30,
    intention: "Today I read thirty days of fire, from the outside.",
    constraint:
      "No trading today. Or half size, finished early. Then open the Mirror Log and read all thirty days, start to finish.",
    muhasabah:
      "You read a month of your own anger. Where does it come from, before trading ever existed in your life? Write the truest sentence you can about that.",
  },
];

const WASWAS: RebuildDay[] = [
  {
    day: 1,
    intention: "Today I write the plan before the open, and I watch myself argue with it.",
    constraint:
      "Write your full plan pre-market: setups, levels, size. Today, only observe. Tally every deviation and every hesitation. Fix nothing yet.",
    muhasabah:
      "How many times did you argue with your own plan today? Quote the argument that won most often.",
  },
  {
    day: 2,
    intention: "Hesitation has a price. Today I start the invoice.",
    constraint:
      "Log every valid setup you saw but didn't take, with the reason in five words or fewer.",
    muhasabah:
      "Read the reasons back. How many are analysis? How many are fear wearing analysis as a coat?",
  },
  {
    day: 3,
    intention: "A winner I cut early is a loss I chose.",
    constraint:
      "For every exit today, write which changed: the chart, or your feeling. Two columns. Be exact.",
    muhasabah: "How many exits were chart, how many were feeling? Which column made money?",
  },
  {
    day: 4,
    intention: "Other people's conviction is not transferable. I stop borrowing it.",
    constraint:
      "No checking anyone else's charts, signals, group chats, or opinions during market hours. Your eyes only, all day.",
    muhasabah:
      "How many times did you reach for someone else's certainty today? What were you hoping they would carry for you?",
  },
  {
    day: 5,
    intention: "The late entry is the fine I pay for the early doubt.",
    constraint: "Mark every entry today: “planned price” or “chased.” Just mark them.",
    muhasabah:
      "How many were chased? For each one, where was the planned entry, and what were you doing at that moment?",
  },
  {
    day: 6,
    intention: "One look is data. The tenth look is a prayer to the chart.",
    constraint:
      "Once in a trade, check it on a schedule only: once per candle close on your timeframe. Tally every extra look.",
    muhasabah:
      "How many extra looks? What were you checking for that the plan didn't already answer?",
  },
  {
    day: 7,
    intention: "One week of listening to the whisper. Tonight I learn its accent.",
    constraint:
      "No trades today until you have re-read days 1 to 6 in your Mirror Log. Then trade the plan, or don't.",
    muhasabah:
      "From your own week: does your waswās say “don't enter,” “get out now,” or “you missed it”? Which whisper costs the most?",
  },
  {
    day: 8,
    intention: "Today the plan executes. I am the hands, not the committee.",
    constraint:
      "The rule starts: any A-setup from your written plan that triggers, you take. A hesitation gets logged as a violation, same as a bad trade.",
    muhasabah:
      "Did every triggered A-setup get taken? For any that didn't, write what the whisper said in the exact second.",
  },
  {
    day: 9,
    intention: "I decide exits before entries. At night, in peace, once.",
    constraint:
      "Every trade today must have stop and target written before entry. Exits happen at those prices. No mid-trade invention.",
    muhasabah:
      "Did any trade try to renegotiate mid-flight? What did the whisper offer you to break the plan?",
  },
  {
    day: 10,
    intention: "Missed is a complete sentence. There is no chase clause.",
    constraint:
      "If you miss a planned entry beyond your tolerance, the trade is dead. Log “missed” and wait for the next. No market orders after the fact.",
    muhasabah:
      "Did you write “missed” today without fixing it? What does a missed trade feel like at minute one, and at minute thirty?",
  },
  {
    day: 11,
    intention: "My first read is usually the plan talking. The rewrite is usually fear.",
    constraint:
      "To flip your bias mid-session you must write the old bias, the new one, and the exact price evidence between them. No evidence, no flip.",
    muhasabah: "Did you flip today? Was the evidence price, or one red candle and a feeling?",
  },
  {
    day: 12,
    intention: "Profit-taking is in the plan, not in my pulse.",
    constraint:
      "No manual exits before target unless your written invalidation prints. Sit through the noise. If your hands move, document it.",
    muhasabah:
      "How many times did your cursor drift toward the close button? What was the chart doing at those exact moments?",
  },
  {
    day: 13,
    intention: "Today: one screen, one market, one plan.",
    constraint:
      "Trade one instrument only. Close every other chart. The whisper feeds on open doors.",
    muhasabah: "One market only: was the whisper quieter with fewer doors? What does that tell you?",
  },
  {
    day: 14,
    intention: "Two weeks. I count what the whisper stole and what the plan saved.",
    constraint:
      "Mid-protocol audit: from days 8 to 13, count the hesitations, early exits, and chases. Write the count, and what the skipped A-setups would have paid, honestly.",
    muhasabah: "Write the numbers. The whisper keeps a bill. Read it out loud.",
  },
  {
    day: 15,
    intention: "Confidence is a consequence. It follows kept promises.",
    constraint:
      "Pick your single most trusted setup. Today you take only that one, executed exactly. One promise, kept all day.",
    muhasabah:
      "Keeping one promise all day: what did it do to the noise? Quieter, or did the whisper find a new door?",
  },
  {
    day: 16,
    intention: "The trade does not need my supervision. It needs my absence.",
    constraint:
      "After entry, set alerts at stop and target, then leave the chart until one fires or your candle closes. Practice not watching.",
    muhasabah:
      "What was the hardest minute of not watching? What did you imagine was happening, versus what actually happened?",
  },
  {
    day: 17,
    intention: "Half the whisper is yesterday's loss talking in disguise.",
    constraint:
      "Before the open, write one line: “Yesterday's result is not evidence about today's setup.” Then list which old trades are still in your head.",
    muhasabah:
      "Which old trade whispered during today's session? How old is the oldest trade that still talks to you?",
  },
  {
    day: 18,
    intention: "I trust the work I did when I was calm.",
    constraint:
      "No changing the plan during market hours. Amendments go on a “tonight” list and get decided after the close, in peace.",
    muhasabah:
      "What's on the tonight list? Now that you're calm, how many amendments survive? What does that ratio say about mid-session you?",
  },
  {
    day: 19,
    intention: "Second-guessing the entry is fear asking for a refund.",
    constraint:
      "Once in a trade, the only permitted question is: has my invalidation printed? Tally every other question your head asks.",
    muhasabah:
      "Write the top three other questions your head asked today. Which is really about money? Which is about being judged?",
  },
  {
    day: 20,
    intention: "Today I execute like the plan was written by someone I trust. It was.",
    constraint:
      "Repeat day 8: every triggered A-setup taken, every hesitation logged as a violation. One more coat.",
    muhasabah:
      "Day 8 versus day 20: is the gap between trigger and click shrinking? Estimate both, in seconds, honestly.",
  },
  {
    day: 21,
    intention: "Three weeks. Tonight I read what the doubt wrote, in its own hand.",
    constraint:
      "End thirty minutes early. Re-read days 15 to 20 in the Mirror Log, platform closed.",
    muhasabah:
      "In your entries, find one moment you executed clean through the noise. Quote your own line back here. That voice is the one you're building.",
  },
  {
    day: 22,
    intention: "The plan is mine now. The whisper is the visitor.",
    constraint:
      "Write your execution rule in your own words, signed, at the top of your journal: when an A-setup triggers, what happens. Every time.",
    muhasabah:
      "Read your rule out loud. Does it hide an escape hatch? Find the weasel word and remove it, here.",
  },
  {
    day: 23,
    intention: "I would rather lose on my plan than win on a borrowed one.",
    constraint:
      "Full-rails day: plan written the night before, alerts instead of staring, no outside opinions, exits at plan. All four at once.",
    muhasabah:
      "Four rails up. Which one did the whisper test hardest today? That rail is next month's work.",
  },
  {
    day: 24,
    intention: "FOMO is a rumor about a party that isn't happening.",
    constraint:
      "Every time “it's leaving without me” fires today, write what entering right then would have risked, in numbers, before you may act.",
    muhasabah:
      "Read the list back. How many of those late entries would have survived their own stop? What is FOMO's actual record in your account?",
  },
  {
    day: 25,
    intention: "Stillness is a position. Today I hold it well.",
    constraint:
      "If no A-setup has triggered by your session's midpoint, you stay flat to the close. A zero-trade day executed cleanly is a kept promise.",
    muhasabah:
      "Did you have to hold the stillness today? Where does unspent attention go when there is no trade to spend it on?",
  },
  {
    day: 26,
    intention: "I ask the chart questions. I do not ask it for reassurance.",
    constraint:
      "Three timeframes maximum today. No dropping to the one-minute chart to feel something.",
    muhasabah:
      "Did you crave the lower timeframe today? At which moments? What was it supposed to soothe?",
  },
  {
    day: 27,
    intention: "Every kept rule is evidence. I am building a case against the whisper.",
    constraint:
      "Tonight, list every promise you kept today, however small. The list is the work.",
    muhasabah:
      "Read your kept-promise list. Then answer: is the whisper quieter because the market changed, or because you did?",
  },
  {
    day: 28,
    intention: "Two days left. The trigger fires, the hands move. That is the whole sentence.",
    constraint:
      "Repeat day 8 perfectly, one final time: triggered A-setups taken, hesitations logged. Prove the reflex.",
    muhasabah:
      "Estimate your trigger-to-click gap today. Write day 8's gap next to it. The shrink is yours, on paper.",
  },
  {
    day: 29,
    intention: "Tonight I leave nothing undecided. Tomorrow is for reading.",
    constraint:
      "Write tomorrow's plan tonight, complete. Then close everything: the charts, the tabs, and the question you keep reopening.",
    muhasabah:
      "What is the question you kept reopening this month? Write it once more, here. Then write the answer you already know.",
  },
  {
    day: 30,
    intention: "Today I read thirty days of whispers, and the voice that outlasted them.",
    constraint:
      "No trading today. Or half size, finished early. Then open the Mirror Log and read all thirty days, beginning to end.",
    muhasabah:
      "You read a month of your own doubt. Whose voice is on page one? Whose voice is on page thirty? Write the difference. The difference is the verdict.",
  },
];

export const REBUILD: Record<SaboteurId, RebuildDay[]> = {
  kibr: KIBR,
  tama: TAMA,
  ghadab: GHADAB,
  waswas: WASWAS,
};

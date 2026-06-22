# Changelog — Phase 2 Editorial Pass

*The Trader and the Nafs* — bestselling-author editing pass.
Scope chosen by the author: **restraint-first** (high-confidence, mostly-subtractive fixes; no
chapters merged, removed, or reordered; chapter structure and build-pipeline markers preserved).
Source-hedging chosen: **light hedge for consistency**.

All edits were checked against `book/parse.py`'s structural regexes — every file still parses, and
no `## Chapter N` / `# Title` / part / front-matter / `### Reflect` / `### Train` markers were
disturbed. Net change: −245 words (70,680 → 70,435), reflecting the subtractive intent.

Rationale for the pass as a whole: the manuscript is already excellent and consistent. The only
real drag is *repetition* in the middle third. The fixes below remove that repetition (restraint,
not churn), protect a key reveal, and give the two weakest chapters a stronger entry — without
touching any chapter that is already at its ceiling.

---

## 1. Ch15 (Greed) — de-duplicated against Ch11 (The Love of Wealth)
**File:** `manuscript/18-ch15-greed.md`
**Change:** Replaced the ~7-paragraph theology block (full re-quotes of *Sūrah al-Takāthur*
102:1–2 and the *ghinā an-nafs* hadith, plus the *qanāʿa* saying and the companions material —
all already presented in full in Ch11) with a tighter ~3-paragraph version that *leans on* Ch11:
a one-line callback to takāthur, the *ghinā an-nafs* cure folded in as "as we saw," and the
companions beat compressed. Kept the valley-of-gold hadith rendered once, because its
*bottomlessness* is the defining image of greed specifically and earns its place here.
**Why:** This was the book's single clearest case of "I just read this" — the same two hadith and
the same verse quoted in full in two consecutive-themed chapters. The reduction removes the
déjà-vu, foregrounds Ch15's genuinely strong *unique* material (the bottomlessness, the hedonic
treadmill, greed-as-fear-of-regret, the best-day ambush — all left untouched), and reads as
deliberate craft ("I won't re-walk the whole ground") rather than repetition. Highest-impact fix
in the pass.
**Also:** standardized the transliteration to *ghinā an-nafs* (Ch15 previously read *ghinā
al-nafs*) to match Ch11.

## 2. Ch20 (Tawakkul) — protected the "your provision is written" reveal
**File:** `manuscript/24-ch20-tawakkul.md`
**Change:** Reworded the framing of the reveal from "the one I've promised you and **withheld until
now**…" to "…**glimpsed already in the chapters on fear and the tranquil self, but deliberately
kept from its full weight until now**, so it could land in one place, undiluted."
**Why:** The idea is genuinely glimpsed earlier (Ch9, Ch15, Ch16 — the latter explicitly
forward-references this chapter), so "withheld until now" rang slightly false. The new phrasing is
honest about the earlier foreshadowing while *preserving* Ch20 as the place the teaching lands at
full force. One-line, in-voice; the climactic landing is untouched.

## 3. Ch32 (Weekly Self-Audits) — added a concrete opening scene
**File:** `manuscript/37-ch32-weekly-self-audits.md`
**Change:** Added a short opening vignette — Khalid discovering he has *drifted*, sizing up by
"feel," skipping the ritual, letting the journal shrink, "without ever once choosing to" — before
the existing abstract framing.
**Why:** Ch32 was the weakest chapter on its own terms: the only one to open with no scene and no
character, the most manual-like in tone. *Drift* is the chapter's real subject, so opening on a
lived instance of it both raises the emotional charge and matches the book's established pattern
(strong chapters open on Khalid/Omar in a scene). Improves momentum *and* consistency. The
chapter's body and its useful procedure were left intact (restraint).

## 4. Ch28 (Daily Operating System) — removed an internal triple-explanation
**File:** `manuscript/33-ch28-daily-operating-system.md`
**Change:** Deleted the four bulleted phase-preview paragraphs (Before/During/After/Periodically,
each with a "(Chapter N.)" pointer) and folded their function into a single lead-in sentence that
feeds directly into the phase **table** immediately below it.
**Why:** The chapter explained the four phases three times in close succession — the bullets, the
table, and then the prose "master principle" section. The bullets and the table were near-verbatim
duplicates; the table is the more scannable of the two and also carries the self-in-charge / job
columns. Cutting the bullets removes the redundancy while losing no information (navigation is
preserved by the new lead-in and by the chapter's existing closing line, "The next four chapters
build the rooms"). The prose "master principle" section — which holds the actual insight — was
kept in full.

## 5. Ch36 — light, consistency hedge on the "greater jihad" narration
**File:** `manuscript/42-ch36-the-trader-who-conquered-himself.md`
**Change:** "This is the victory **the Prophet ﷺ pointed to when he called** the struggle against
the self the *greater* jihad" → "…**the tradition has long pointed to in calling** the struggle
against the self the *greater* jihad." In the same breath, attributed the *authentic* hadith more
firmly: "And it's the victory **the Prophet ﷺ named directly** in the hadith we met earlier…"
**Why:** The "greater jihad" narration is widely classified as weak (ḍaʿīf); elsewhere the book
carefully hedges contested narrations (e.g., the "fiercest enemy is your nafs" athar in Ch5: "whether
or not every chain is airtight"). This was the one place that narration was stated firmly as the
Prophet's direct speech. The edit makes the book's scholarly posture uniform *and*, by contrast,
attributes the rigorously authentic "the strong man controls himself when angry" hadith (Bukhārī,
Muslim) firmly to the Prophet — sharpening rather than blurring the distinction. (Ch3 already
hedges via "the tradition calls," so it was left as-is.)

---

## Considered and deliberately *not* changed (restraint)

- **Spine-proof re-quotes (Yusuf 12:53; "all his affairs are good").** Reviewed for over-repetition.
  Yusuf 12:53 recurs (front-matter epigraph, Ch1, Ch5, Ch6) but each use carries a distinct argument
  and Ch6 is already a bare citation, not a re-quote — this is intentional, effective spine.
  "All his affairs are good" is quoted in full only in its home chapter (Ch25); Ch33 and Ch35 already
  reference it as short callbacks. No full double-quotes remained once Ch11/Ch15 (item 1) was fixed.
  **No change made.**
- **Ch31's deliberate re-tread of Ch22 (muhasabah spirit vs machinery).** A defensible split that
  the book signposts; trimming it risked weakening the practical Part V. Out of scope for a
  restraint-first pass. **No change made.**
- **The Khalid "old friend" (Ch5) vs "came to me / sat across from me" (Ch4) wrinkle.** Minor and
  reconcilable (a friend confiding); not part of the selected restraint-first scope. **No change made.**
- **Every chapter marked "leave alone" in the audit** (Front matter, Ch1, Ch3, Ch12, Ch16, Ch20
  structure, Ch34, Ch36 body, Ch38, both appendices, all part-openers). Already at their ceiling.

---

## Follow-up: Khalid instrument continuity — reconciled to "funded only"

**Files:** `manuscript/04-ch03-the-gap-between-knowing-and-doing.md`,
`manuscript/06-ch05-the-real-enemy.md`
**Issue:** The recurring character Khalid was anchored to *two different markets* — a "funded
**futures** account" in Ch3, and **crypto** in Ch5 (he "came to crypto early"; the enemies list ran
on whales, the exchange, liquidations, "the coin"). A reader tracking the character would notice the
mismatch. (Surfaced by a reader question about how many trading types the book mentions: funded,
futures, and crypto appeared; stocks did not.)
**Decision (author):** Standardize on a **funded account**, with no specific instrument named — so
the book stays largely instrument-agnostic and the one concrete frame (prop-firm funded trading,
already used in Ch15 and Ch16) is consistent everywhere.
**Changes:**
- Ch3: "funded **futures** account" → "funded account."
- Ch5: reframed the enemies-list scene off crypto and onto funded-account-neutral villains —
  *came to crypto early* → *has traded long enough*; *liquidations* → *stops*; *the exchange* →
  *the platform*; *the whales* → *the big players*; *the influencers who pumped the coin* → *the
  funding firm, whose rules feel rigged to trip him*; *a coin he swore off* → *a trade he swore
  off*. Kept the "leverage he promised his wife" detail, which Ch36 calls back to and which a
  funded account supports.
**Result:** No crypto- or futures-specific instrument terms remain anywhere in the manuscript;
Khalid is consistently a funded-account trader. The enemies-list rhetoric and rhythm are preserved.
Parser-validated; structure unchanged.

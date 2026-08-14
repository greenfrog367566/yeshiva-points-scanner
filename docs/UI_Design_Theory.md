# Menchmark — UI Design Theory (external review, August 2026)

*Summary of two ChatGPT design pieces Ben shared on 2026-08-14: a general design
theory, and a review of `Menchmark_UI_Redesign_Summary.md`. The originals lived
only in a chat; this document preserves the ideas worth keeping, mapped against
what has actually shipped. It is a **philosophy/record doc, not a spec** — the
open items at the bottom are PROPOSE-FIRST candidates, not commitments.*

---

## 1. The theory, in short

**Apps fail when they organize around features instead of workflows.** The
natural developer habit — feature → button, tool → tab — produces a toolbox,
not an experience. After 20 features the UI stops reflecting how anyone
actually works.

**The 80/20 rule.** In a 45-minute class a rebbi scans ~100 times, changes
activities ~10 times, checks attendance once, glances at the leaderboard twice,
and touches settings/students/printing/Sheets zero times. The interface should
mirror those frequencies: 80% of classroom time represented by 20% of the
interface.

**Three layers:**

| Layer | Visibility | Contents |
|---|---|---|
| Daily | always visible | scan, activity, recent scans, leaderboard, attendance |
| Weekly | one click away | homework, contests, raffles, reports |
| Administrative | hidden | students, printing, backups, Sheets, setup |

**The cockpit model.** A pilot doesn't switch between 12 screens; important
controls stay visible, secondary controls sit nearby, rare controls are hidden.
Don't make users navigate — make them stay.

**The one-handed rule.** A rebbi must be able to choose an activity, scan, see
the result, and undo a mistake *while teaching*, without thinking.

**The three-second rule.** On open, a new user should understand within three
seconds: what class, what activity, where to scan, did it work, who's leading.
Nothing else matters at that moment.

**Don't punish beginners for power users.** The maintainer is a power user
(Chavrusa, Learn, printing, tracking, contests, Sheets); most teachers are
"scan student, give points, done." Beginners should never know the advanced
features exist — progressive disclosure, Apple-style: start with Scan, reveal
layers as they become relevant.

**The closing diagnosis:** *"You don't have too many features. You have too
many things visible simultaneously. Hide half the controls and the app will
immediately feel twice as simple."*

## 2. The review's verdict on the redesign

The second piece reviewed the July redesign spec and **approved it**: the
information architecture is now good; the remaining risk is reorganizing a
large product without reducing its conceptual complexity. Scores moved from
~6/10 to ~9/10 across navigation, classroom focus, feature organization, and
consistency.

Ranked wins: **(1)** the Gradebook / Tracked Items consolidation ("the kind of
duplication that eventually destroys a large single-file app"), **(2)** removing
Print as a destination, **(3)** the Dashboard becoming a command center.

Points it endorsed specifically, all since shipped or already in the spec:
keep exactly 5 tabs and add no more; Scan is *home*, not one of five equals —
the global scan bar is the input layer of the whole application; never truncate
activity names; the collapsed-strip mini leaderboard; History under Scan ("what
just happened?") vs Standings ("where are we?"); the Trends pace-vs-total fix
("Dovid is DOWN 50%" on a Tuesday destroys trust); Contest as a temporary
scoped leaderboard with fear-answering copy; Prizes as the common outcome
layer of Rewards (user-facing label "Prizes", never "ledger"); Coin Deposit
kept quiet with no banking metaphor; Gradebook as the one place complexity is
allowed (Scan = cockpit, Gradebook = filing cabinet); cutting Shorashim to
Words + Match; the unified Quiz with its distractor safeguards; printable
A/B/C/D answer cards ("Menchmark at its best — no student device, no login");
PIP dropdowns instead of shrunken button grids; phased implementation rather
than one big pass.

On the four unbuilt philosophy features, it ranked: **do now** — double-scan
detection; **maybe later** — Student View; **interesting but dangerous** —
the Command Bar (scanning is already fast; don't add a second input layer
before the product is proven); **don't prioritize** — 🔥-style class badges
(the app already deliberately stepped back from flashy gamification).

**The sentence it asked to be added to the top of any implementation spec:**

> The redesign must reduce what the teacher has to think about, not merely
> reorganize where existing features live.

## 3. Reality check (2026-08-14) — what the reviews couldn't know

- **Most of the approved spec has shipped.** Phases 0–1 done; Phase 2
  (Tracked Items + Gradebook, the review's "largest technical refactor") is
  complete end-to-end — mirror gap closed, Gradebook un-hidden (#185), every
  tracked item armable from the scan bar (2d). Contest is back with stored
  totals (#210). The phased rollout the review demanded (#22) is exactly how
  it was built (`Menchmark_Phased_Build_Plan.md`).
- **"Hide half the controls" already collided with reality once.** Lean/Simple
  mode (#121, PR #150) was built and reverted the same day — the *logic*
  worked, the *chrome* broke (one visible tab per group left an empty subtab
  row and a wasted header row). Settled 2026-08-05: not to be re-proposed. The
  surviving mechanism is per-tab `navHidden` visibility. Any future disclosure
  work must collapse the chrome gracefully, not re-argue the philosophy.
- **The review's #21 ("keep the Review page hidden") is a misread** — Review
  is one of the five top-level *group labels* (Record · Recognize · Reward ·
  Review · Run); there is no internal-only Review page.
- It also called Menchmark a "7,000-line app" (it's ~22,450 lines) — ChatGPT
  was reasoning from a stale snapshot throughout.
- **The center of gravity has moved.** The Firebase rebuild (all 8 steps
  designed) is the big open workstream; anything below queues behind or beside
  it via `docs/NOW.md`.

## 4. Open items worth a decision (PROPOSE-FIRST, not commitments)

*A tab-by-tab audit of the shipped app against this theory ran 2026-08-14 —
see `UI_Theory_Tab_Audit.md` for the ranked findings, which add concrete code
locations to items 1–4 below plus two bugs and several settled-spec gaps.*

1. **Double-scan detection** — the review's one "do now." A soft inline
   "Dovid was just scanned — again?" within ~2 seconds; no modal. Small,
   real, unbuilt.
2. **Teacher-facing naming for "Tracked Items"** — audit what the Gradebook
   config UI actually calls things. "Tracked Item" is an engine name;
   "Gradebook → Add → what do you want to track?" is how a rebbi thinks. Keep
   the internal name; fix only the copy if it leaks.
3. **Light visual grouping in the Run/Manage subtab row** — enough hierarchy
   that Backup & Restore doesn't sit visually beside Students (the review
   sketched Class / Classroom / System).
4. **First-run staged disclosure** — seed a minimal tab set for *new* users at
   onboarding (a `navHidden` seed in setup, so it never takes a tab away from
   an existing user — the same principle as the hide-until-ready seeds, and
   the route that sidesteps the Lean-mode revert).
5. **Adopt the closing sentence** at the top of
   `Menchmark_UI_Redesign_Summary.md` as the standing test for future UI work.

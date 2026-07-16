# Menchmark Redesign — Skeleton Phased Build Plan

*A theoretical build order. Not a schedule — a dependency map. The goal is to sequence the work so each phase ships something testable, nothing breaks live teacher data, and later phases build on foundations laid earlier rather than requiring rework.*

---

## The two constraints that shape everything

Before any ordering, two realities drive the sequence:

1. **This is one ~11,000-line single-file app that real rebbeim use live.** A bad migration = a teacher loses a year of student data mid-semester. So **every phase that touches the data model must ship its `migrateData()` path first, tested, before any feature that depends on it.** Data safety is not a phase — it's a gate on every phase.

2. **Features have real dependencies.** The Gradebook engine underpins Quiz grades, Chart-mode, and the tracked-items consolidation. The Library underpins the Review Wizard. Print reorganization underpins the No-Computer workflow. Building in the wrong order means building things twice. The phases below are ordered so nothing waits on something built later.

**Guiding principle throughout:** ship in independently-testable slices. A phase should be mergeable and usable on its own, even if the phases after it never happen.

---

## Phase 0 — Foundation & Safety Net *(do first, always)*

Not glamorous, but everything rides on it.

- **Repo hygiene:** confirm the landing-page/app split is clean (`index.html` landing, `app.html` app, `setup.html` onboarding — already done), branch protection, the validation pipeline (`node --check`, CSS brace-balance) wired as a pre-merge habit.
- **Migration test harness:** a way to load a *real teacher's saved `localStorage` blob* into a dev copy and verify migrations don't destroy it. This is the single most important thing to build before touching the data model. Every later phase tests against it.
- **The additive-migration discipline, written down:** new fields default in on load, old data never assumed absent. (Already a stated principle — Phase 0 makes it enforced, not aspirational.)

**Ships:** nothing user-facing. Buys: the ability to move fast later without fear.

---

## Phase 1 — Tab restructure (the 5-group shell) *(pure reorganization, no new logic)*

The lowest-risk high-visibility change: move existing tabs into the new 5-group structure (Scan / Standings / Rewards / Manage / Learn) **without changing what any tab does.**

- Rewrite `TAB_GROUPS` / `GROUP_ORDER` to the new 5 groups.
- Dissolve the "Print" group — re-home its 4 pages as sub-sections/actions on their data-owner tabs (Points→Leader Board, Seats→Dashboard, Students→Students, Activities→Activities). **Preserve Personal Scoring Pages** — load-bearing for later No-Computer work.
- Move the few relocated items (Standings "reset points" → Manage; Settings' Teach/Shorashim options → their feature panels).

**Why first:** it's navigation only, touches no data model, and immediately makes the app match every spec doc. It also surfaces the real tab inventory so later phases slot in cleanly.

**Ships:** the whole app, reorganized. Every feature still works exactly as before — just findable in the new structure.

**Risk:** low. No migration needed. Mostly moving markup + updating the tab registry.

---

## Phase 2 — The Gradebook engine + Tracked Items *(the keystone — everything academic depends on it)*

The biggest single lift, and the one the most other things wait on. Built in testable sub-slices:

**2a. The Tracked Item data model + migration.**
- Define the five value types (Count / Status / Checked / Limited-use / Grade).
- Write the migration that converts existing Attendance / Homework / Passes / Tracker data into Tracked Items **without loss.** Test against real data (Phase 0 harness). This is the scary part — do it first, alone, verify it.

**2b. The Gradebook UI** — the one full interface: auto-populated matrix, toggleable columns, search + date filter, weekly grid view, by-student drill-down, print.

**2c. Retire the old tabs** — Attendance/Homework/Passes/Tracker become presets (Gradebook columns + armable scan items), their old standalone tabs removed once the Gradebook covers them.

**2d. The armed-item scan mechanic + tile staleness badges** (Count-type "last: 3d / never", Status "unmarked", Limited-use "used/available").

**Why here:** Quiz grades (Phase 5), Chart-mode fold-in (Phase 6), and the whole "one engine not five" consolidation all depend on this existing. Build it once, build it right.

**Ships:** a working Gradebook; Attendance/Homework/Passes/Tracker still work but now through one engine.

**Risk:** high (data migration). Mitigated entirely by Phase 0's harness and shipping 2a in isolation first.

---

## Phase 3 — Dashboard & scan-flow polish *(depends on Phase 1's structure)*

Now that tabs are reorganized and the armed-item mechanic exists (2d), refine the daily-use surface:

- Dashboard List/Class-view toggle, bottom-up mini-leaderboard, cut redundant panels.
- Floating Points panel → dropdowns fix (compact for PIP).
- History: contest include/exclude filter + bulk-undo.
- Trends redesign (class overview → drill-down, pace-fix, remove redundant "send to sheet").

**Why here:** it's UI refinement on top of foundations already laid. None of it blocks anything else, so it can flex earlier or later — but it reads best once Phase 1+2 are in.

**Ships:** the polished daily-driver experience.

**Risk:** low-medium. Mostly presentation; the risky data bits (scan mechanic) already shipped in Phase 2.

---

## Phase 4 — Rewards consolidation + Shulchani Coin tools *(mostly independent)*

- Prize Ledger (unify Store/Auction/Raffle wins; the Auction audit-log fix).
- Raffle/Auction/Store UI polish.
- **Shulchani:** Coin Deposit/Withdraw tool (physical-coin loss protection).

**Why here:** largely self-contained — depends on nothing but the existing points/Shulchani system. Could move earlier; parked here because it's lower-priority than the academic keystone.

**Ships:** the full Rewards group + Shulchani physical-coin handling.

**Risk:** low-medium (Auction log fix touches transaction integrity — test carefully, but it's isolated).

---

## Phase 5 — Quiz engine + Speed Mode *(depends on Phase 2 Gradebook for grade storage)*

- One Quiz engine across Chumash/Mishna/Shorashim, with the **false-negative-safe distractor rules** (translation-string dedup, graceful option-count reduction).
- Standard + Speed modes.
- Spin-for-student (auto-PIP) / manual pick.
- Printable A/B/C/D Answer Cards.
- **Quiz results log as Grade-type Tracked Items** → Gradebook columns. *This is why it waits for Phase 2.*

**Ships:** the full Quiz + Speed Round feature.

**Risk:** medium. Self-contained logic, but the distractor correctness rules need real testing (a wrong "wrong answer" in front of kids is the failure mode).

---

## Phase 6 — Learn cleanup + Library + Review Wizard *(Library underpins the Wizard)*

- **Learn housekeeping:** Chart-mode folds into Gradebook (Phase 2 dependency), Shorashim trimmed to Words+Match, Brachos two-tab (Asher Yatzar), dead-code removal, AI→"automatic" language (partly done).
- **6a. The Library** — static JSON on GitHub Pages, `index.json` catalog, the honest draft/partial/reviewed status flag, the in-app "browse & load" picker replacing the AI-import UI. (Vayelech already prepared as seed content.)
- **6b. The Review Wizard** — per-pasuk confirm/edit, "not reviewed" banner, resumable, reviewed-version callback. *Depends on 6a existing.* (Share-back deliberately deferred — its own future project.)

**Ships:** clean Learn tab, a real text library, the review flow.

**Risk:** medium. Library is additive (low risk); Wizard touches text-set data (reuses existing `orig` field, so migration-light).

---

## Phase 7 — Print Wizard + No-Computer workflow *(depends on Phase 1 print reorg + Phase 4 coins)*

- **7a. Print Wizard shell** — one guided entry point; re-home the (already-relocated in Phase 1) print pages into it; class-list printable; big double-sided student card.
- **7b. Shulchani coin cards** — color-matched coin QR backgrounds (uses existing `COINS` colors), per-student coin codes. *Depends on Phase 4's Shulchani work being settled.*
- **7c. Scanner Setup sheet** — reference-only version first (safe, no Tera permission needed); upgrade to reproduced codes only if/when Tera says yes.
- **7d. Batch Import / No-Computer** — the offline scan-all-day-upload-later flow. **Blocked on the real scanner timestamp-format test** (still outstanding). Parser built against real output, review-before-commit screen, paired with Personal Scoring Pages (preserved since Phase 1).

**Ships:** the complete printing story + the no-screen classroom workflow.

**Risk:** medium. 7d has an external blocker (scanner test) and is the most "new subsystem" of the lot — genuinely its own project phase, as flagged in the spec.

---

## Phase 8 — Chavrusa Mode *(full build; touches Dashboard from Phase 3)*

The largest deferred feature. Spec is complete.

- Focused-mode screen, manual/automatic pairing, compatibility rules, past-chavrusas.
- Point-target modes (Individual / Group / Group Entity + Resolve).
- Dashboard integration (grouping in List + Class view, scan-bar target indicator, multi-tile flash, unresolved-points strip) — *builds on Phase 3's Dashboard.*

**Why last:** biggest new surface, depends on the most other things being stable, and isn't blocking anything. Genuinely a "once the core is solid" feature.

**Ships:** Chavrusa Mode, end to end.

**Risk:** medium-high (large new feature, Dashboard touchpoints) — but isolated behind its own mode, so a bug can't corrupt the core scan/points flow.

---

## The gaps still undesigned (decide before they'd slot in)

Flagged in the UI summary, not yet designed — each would need a design pass before earning a phase:
- **Student View** (student-facing screen) — Coin Deposit could seed it.
- **Teacher Command Bar** (Spotlight-style "give yosef 5") — called a "killer feature" in the docs.
- **Double-scan detection** (same student <2s → soft warning) — small, could fold into Phase 3.
- **Class Goal / status badges** — the gamification layer.

Don't schedule these until designed. Double-scan detection is the easy win (fold into Phase 3 if desired).

---

## Dependency map at a glance

```
Phase 0 (safety) ──> gates everything
Phase 1 (tab shell) ──> Phase 3 (dashboard), Phase 7 (print reorg)
Phase 2 (Gradebook) ──> Phase 5 (quiz grades), Phase 6a→b less so, Phase 6 chart-fold
Phase 4 (Shulchani coins) ──> Phase 7b (coin cards)
Phase 6a (Library) ──> Phase 6b (Review Wizard)
Phase 3 (Dashboard) ──> Phase 8 (Chavrusa Dashboard bits)
Phase 7d (Batch Import) ──> BLOCKED on real scanner timestamp test
```

**Critical path:** 0 → 1 → 2 is the spine. Everything valuable hangs off Phase 2 existing. If you build nothing else, 0→1→2 already transforms the app.

---

## Suggested first three moves (if starting tomorrow)

1. **Phase 0 migration harness** — boring, essential, unblocks fearless iteration.
2. **Phase 1 tab restructure** — high-visibility, low-risk, makes the app match the vision immediately.
3. **Phase 2a Tracked-Item migration** — the scary data step, done in isolation and verified, before building the Gradebook UI on top.

Everything after that has room to flex based on what you and Rabbi Goldwasser actually feel the classroom needs next.

# Menchmark Redesign — Skeleton Phased Build Plan

*A theoretical build order. Not a schedule — a dependency map. The goal is to sequence the work so each phase ships something testable, nothing breaks live teacher data, and later phases build on foundations laid earlier rather than requiring rework.*

> **Which doc is authoritative for what:** *Status* (what has shipped, partially shipped, or not started) lives in the per-phase status stamps in this document — update those, and only those, when a phase moves. *Sequencing and dependencies* live in the dependency map at the bottom. *Rebuild scope* (what the Firebase build includes, folds in, retires, or defers) lives in `Firebase_Rebuild_Scope.md`. *The immediate queue* lives in `docs/NOW.md`. *What each phase actually builds* (the tab map, per-tab decisions) lives in `Menchmark_UI_Redesign_Summary.md` — this doc sequences that spec, it doesn't restate it. When these disagree, this doc wins on status, the Firebase doc wins on rebuild scope, `Menchmark_UI_Redesign_Summary.md` wins on design decisions, and the disagreement itself is a bug — file it.

> **Related UI-planning docs, added as an index 2026-08-18** (previously
> content-coupled to this plan with no filename links, which is its own kind
> of drift risk): `Menchmark_UI_Redesign_Summary.md` (the spec these phases
> implement, 1:1 by section — Phase 1 ↔ its §1, Phase 2 ↔ its §6 Gradebook
> consolidation, etc.); `UI_Design_Theory.md` (the design philosophy this
> spec was reviewed against); `UI_Theory_Tab_Audit.md` (the 2026-08-14
> code-location audit of what shipped vs. that theory — tracked as one line
> in `docs/NOW.md`); `Left_Rail_Nav_Decision.md` (an open, undecided nav
> proposal); `Onboarding_Starter_Tabs_Proposal.md` (approved 2026-08-18,
> the first-run tab-visibility seed — the part of Phase 1's Lean-mode revert
> left unsolved).

> **Status stamps verified against the code on 2026-08-04, and Phases 2, 4 and 7 re-verified 2026-08-21.** Before the first sweep this plan had no status at all and the Firebase doc's version of it was wrong in four places. If you are reading a stamp much later than its own date, re-verify rather than trust it — the 2026-08-21 pass found Phase 4 still reading "NOT STARTED" more than two weeks after one of its three items shipped, and Phase 7c still naming an external blocker that had been lifted six days earlier. **A stamp goes stale in days at this repo's merge rate, not months.**

---

## The two constraints that shape everything

Before any ordering, two realities drive the sequence:

1. **This is one ~22,450-line single-file app that real rebbeim use live.** A bad migration = a teacher loses a year of student data mid-semester. So **every phase that touches the data model must ship its `migrateData()` path first, tested, before any feature that depends on it.** Data safety is not a phase — it's a gate on every phase.

2. **Features have real dependencies.** The Gradebook engine underpins Quiz grades, Chart-mode, and the tracked-items consolidation. The Library underpins the Review Wizard. Print reorganization underpins the No-Computer workflow. Building in the wrong order means building things twice. The phases below are ordered so nothing waits on something built later.

**Guiding principle throughout:** ship in independently-testable slices. A phase should be mergeable and usable on its own, even if the phases after it never happen.

---

## Phase 0 — Foundation & Safety Net *(do first, always)*

> **Status (2026-08-04):** SHIPPED — `test-migration.html` harness plus `.github/workflows/validate.yml` running the validators in CI. **Note for the Firebase rebuild:** this gate is localStorage-only and has no Firestore analogue; see that doc's open question 6.

Not glamorous, but everything rides on it.

- **Repo hygiene:** confirm the landing-page/app split is clean (`index.html` landing, `app.html` app, `setup.html` onboarding — already done), branch protection, the validation pipeline (`node --check`, CSS brace-balance) wired as a pre-merge habit.
- **Migration test harness:** a way to load a *real teacher's saved `localStorage` blob* into a dev copy and verify migrations don't destroy it. This is the single most important thing to build before touching the data model. Every later phase tests against it.
- **The additive-migration discipline, written down:** new fields default in on load, old data never assumed absent. (Already a stated principle — Phase 0 makes it enforced, not aspirational.)

**Ships:** nothing user-facing. Buys: the ability to move fast later without fear.

---

## Phase 1 — Tab restructure (the 5-group shell) *(pure reorganization, no new logic)*

> **Status (2026-08-04):** SHIPPED. The five groups display as Record · Recognize · Reward · Review · Run.

The lowest-risk high-visibility change: move existing tabs into the new 5-group structure (Scan / Standings / Rewards / Manage / Learn) **without changing what any tab does.**

- Rewrite `TAB_GROUPS` / `GROUP_ORDER` to the new 5 groups.
- Dissolve the "Print" group — re-home its 4 pages as sub-sections/actions on their data-owner tabs (Points→Leader Board, Seats→Dashboard, Students→Students, Activities→Activities). **Preserve Personal Scoring Pages** — load-bearing for later No-Computer work.
- Move the few relocated items (Standings "reset points" → Manage; Settings' Teach/Shorashim options → their feature panels).

**Why first:** it's navigation only, touches no data model, and immediately makes the app match every spec doc. It also surfaces the real tab inventory so later phases slot in cleanly.

**Ships:** the whole app, reorganized. Every feature still works exactly as before — just findable in the new structure.

**Risk:** low. No migration needed. Mostly moving markup + updating the tab registry.

---

## Phase 2 — The Gradebook engine + Tracked Items *(the keystone — everything academic depends on it)*

> **Status (2026-08-21):** 2a SHIPPED (#107) · 2b SHIPPED (#115) · 2c **PARTIAL** — data done (attendance converted #138; tracker and passes answered by #219; homework resets); Gradebook write path now shipped for **all 4 tabs** — Attendance (#248), Homework (#285), Tracker (#339) and Pass (#341, today-only because `data.passCount` keeps no per-day history). `gbCanEdit()` is the single gate. **#227's write side is complete; only the tab removals remain** · 2d **SHIPPED in two parts** — the armed-item scan mechanic (#208) and the tile badges (this PR). Contest is un-hidden again (#210). **The Gradebook is UN-HIDDEN (#185)** — 2d plus the mirror-gap fix cleared both reasons it was hidden, and Phase 2 is now complete end to end. 2d has now cleared the Firebase rebuild's step 1 of its one blocking input, the count value shape.

The biggest single lift, and the one the most other things wait on. Built in testable sub-slices:

**2a. The Tracked Item data model — a fresh, empty shell.** *(SHIPPED — merged to `main` 2026-07-28 via PR #107)*
- Define the value types and register them openly (`TRACKED_METHODS`), so an unbuilt shape is a new row rather than a new branch.
- Add `data.trackedItems` (the item definitions) and `data.trackedData` (an ordered, timestamped list per student per item — last entry is the current value, earlier entries are history that is never overwritten). Seed the presets: Attendance, Homework, one count item per existing tracked activity, Bathroom Pass.
- **Reset, not conversion.** No existing data is converted. `data.attendance`, `data.hw`, `data.trackerLog` and `data.passes` are not read, modified or deleted — they stay wired to their existing tabs and keep working exactly as before, while the new stores start empty. Agreed with the maintainer: it is summer, the beta cohort is small and notified, and the pre-#100 homework data is partly fictional (dashboard-armed homework scans flashed success but wrote nothing).
- Purely additive: `load2fix()` backfills only, `DATA_VERSION` unchanged. Verified against the Phase 0 harness, including snapshots proving the four old stores are byte-identical after a load.

**2b. The Gradebook UI** *(SHIPPED — PR #115)* — the one full interface: auto-populated matrix, toggleable columns, search + date filter, weekly grid view, by-student drill-down, print. Hidden from the nav by #185 until it had something real to read; **un-hidden once 2d and the mirror-gap fix gave it that**, and it came back intact because hiding never deleted anything.

**2c. Retire the old tabs** *(PARTIAL — all four stores settled; Gradebook write path shipped for Attendance and Homework, Pass and Tracker still read-only, tracked under #227)* — Attendance/Homework/Passes/Tracker become presets (Gradebook columns + armable scan items), their old standalone tabs removed once the Gradebook covers them.
- ⚠️ **2c inherits the data question 2a set aside.** `data.attendance`, `data.hw`, `data.trackerLog` and `data.passes` still hold every pre-2a record, and nothing has ever carried them into `data.trackedData`. Do **not** plan 2c on the assumption that the old data is already forward-ported. Retiring a tab therefore means deciding, per store, whether to convert its records, export them, or accept the reset — and saying so explicitly before the old tab's read path goes away.
- **What actually shipped:** `data.attendance` was converted, one-shot, with the receipt in `data.attConversion`. `data.hw` is agreed to RESET (it starts at the ship date on purpose — see `docs/NOW.md`'s Phase 2 status). `data.trackerLog` and `data.passes` are still TBD. **The Gradebook can now write Attendance (#248) and Homework (PR #285) cells** — click-to-edit, same `dateKey`-on-the-legacy-setter pattern for both. Pass and Tracker are harder than a mechanical port: `setPass()` keeps no per-use history, and `trackerLogAdd()` writes individual timestamped entries rather than one record per day, so an edit there means deciding what "set day X to N" even converts to. **All four old tabs remain registered and visible** — no tab has been retired yet. Retiring the tab UI is the last step of 2c, not the first.

**2d. The armed-item scan mechanic + tile staleness badges** *(SHIPPED in two parts — #123)*
- **The mechanic (#208).** `award()`'s four name-matched branches collapse into one `recordTrackedScan()`. Every tracked activity is armable from every surface. Identity is `a.tiId`, stamped once in `load2fix()`, so renaming an activity no longer breaks it.
- **The count value shape, decided (#208).** A count entry stores **the step it contributed**; a total is a plain sum and `config.step` is baked in at write time, never applied on read. `gbCountOf()`'s guess collapses to a sum. This was 2d's one blocking input to the rebuild's step 1, and it is now settled.
- **The badges (this PR).** Count "last: 3d / never", Status "unmarked" (or the marked value), Limited-use "used / available" — on the boy's tile, in both the Dashboard list and the seating chart, only while that item is armed. They read the **legacy** store rather than the mirror, because with 2c partial the legacy store is still the authority on what was actually recorded; a mirror-fed badge would say "unmarked" for a boy just marked Present on the Attendance tab.
- **All three of its gates are now clear.** Phase 5's grade storage, the rebuild's step 1, and the Gradebook itself.
- ✅ **The mirror gap is closed** (`docs/Mirror_Gap_Proposal.md`, approved 2026-08-05). A correction made on one of the old tabs now reaches `data.trackedData` by **transcription at the setter**: the mirror copies the value the legacy store just wrote, with that record's own `ts` and day, and never computes one. Corrections to a preselect item append and win by being last; the two undo-shaped operations (pass give-back, tracker undo) remove, because those methods are read as a count. A one-shot idempotent backfill in `load2fix()` closes the historical window, with the receipt in `data.mirrorBackfill`.
- **#185 shipped as its own PR**, deliberately separate from the data change so the two were verified independently. The Homework column starts at the ship date rather than carrying history (decision 2), which costs nothing in practice: the beta cohort onboarded in the summer on v0.9.0, so there is no homework history to carry, and the column fills from the first day of the school year.

**Why here:** Quiz grades (Phase 5), Chart-mode fold-in (Phase 6), and the whole "one engine not five" consolidation all depend on this existing. Build it once, build it right.

**Ships:** a working Gradebook; Attendance/Homework/Passes/Tracker still work but now through one engine.

**Risk:** 2a came in low — additive stores only, nothing existing touched, verified by Phase 0's harness. The data risk now sits in **2c**, where the old stores are retired and their pre-2a records have to be dealt with (see the 2c note above).

---

## Phase 3 — Dashboard & scan-flow polish *(depends on Phase 1's structure)*

> **Status (2026-08-04):** 1 of 5. The Dashboard List/Seating-view toggle SHIPPED (#195). Still unbuilt: the floating Points panel dropdown fix, History's contest include/exclude filter, History bulk-undo, and the Trends redesign. The floating-panel fix folds into the Firebase rebuild's routing step; the other three are independent display work with no storage dependency.

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

> **Status (2026-08-21):** 1 of 3, with the second well advanced. **Coin Deposit/Withdraw SHIPPED** — live in `app.html`, its own modal plus a recent-transactions board; this stamp read "absent" for over two weeks after it landed. The **Raffle/Auction/Store polish** item has moved a long way too: scannable prize codes (#336), Class Points with its own QR card and class prizes (#340), a Prizes print page and student prize cards (#350), and a Prize Store setup step (#345). **Still absent: Prize Ledger and the Auction audit-log fix** — both return zero references. The **Shulchani coin engine** is done, but that predates this phase and is not one of its items; the Firebase doc previously read the engine's completion as Phase 4 being done. Prize Ledger carries transaction-integrity data — decide its Firestore shape during the rebuild's step 1 rather than bolting it on after.

- Prize Ledger (unify Store/Auction/Raffle wins; the Auction audit-log fix).
- Raffle/Auction/Store UI polish.
- **Shulchani:** Coin Deposit/Withdraw tool (physical-coin loss protection).

**Why here:** largely self-contained — depends on nothing but the existing points/Shulchani system. Could move earlier; parked here because it's lower-priority than the academic keystone.

**Ships:** the full Rewards group + Shulchani physical-coin handling.

**Risk:** low-medium (Auction log fix touches transaction integrity — test carefully, but it's isolated).

---

## Phase 5 — Quiz engine + Speed Mode *(depends on Phase 2 Gradebook for grade storage)*

> **Status (2026-08-04):** NOT STARTED, and **not unblocked**. 2a/2b shipping is not sufficient: quiz results store as Grade-type tracked items feeding Gradebook columns, and that store is frozen with the tab hidden (#185). The real gate is **2d**, which pins the value shape Phase 5 would write into. Once 2d lands this is genuinely free — it's offline by design and touches nothing the Firebase rebuild does.

- One Quiz engine across Chumash/Mishna/Shorashim, with the **false-negative-safe distractor rules** (translation-string dedup, graceful option-count reduction).
- Standard + Speed modes.
- Spin-for-student (auto-PIP) / manual pick.
- Printable A/B/C/D Answer Cards.
- **Quiz results log as Grade-type Tracked Items** → Gradebook columns. *This is why it waits for Phase 2.*

**Ships:** the full Quiz + Speed Round feature.

**Risk:** medium. Self-contained logic, but the distractor correctness rules need real testing (a wrong "wrong answer" in front of kids is the failure mode).

---

## Phase 6 — Learn cleanup + Library + Review Wizard *(Library underpins the Wizard)*

> **Status (2026-08-04):** 6a **data-only and orphaned** — `library/index.json` and Vayelech exist, but **nothing in `app.html` references `library/`** (#187); the Pesukim and Mishnayos tabs still source from the AI proxy or manual entry, so the "browse & load" picker was never wired. 6b (Review Wizard) **NOT BUILT**. The dependency chain is 6a loader → 6b Wizard → the deferred share-back; the Firebase doc previously treated all three as settled.

- **Learn housekeeping:** Chart-mode folds into Gradebook (Phase 2 dependency), Shorashim trimmed to Words+Match, Brachos two-tab (Asher Yatzar), dead-code removal, AI→"automatic" language (partly done).
- **6a. The Library** — static JSON served alongside the app (CLAUDE.md names the deploy path; nothing here depends on which host it is), `index.json` catalog, the honest draft/partial/reviewed status flag, the in-app "browse & load" picker replacing the AI-import UI. (Vayelech already prepared as seed content.)
- **6b. The Review Wizard** — per-pasuk confirm/edit, "not reviewed" banner, resumable, reviewed-version callback. *Depends on 6a existing.* (Share-back deliberately deferred — its own future project.)

**Ships:** clean Learn tab, a real text library, the review flow.

**Risk:** medium. Library is additive (low risk); Wizard touches text-set data (reuses existing `orig` field, so migration-light).

---

## Phase 7 — Print Wizard + No-Computer workflow *(depends on Phase 1 print reorg + Phase 4 coins)*

> **Status (2026-08-04):** 7a **NOT BUILT** — no guided print entry point exists; what shipped instead is a de-facto one, the renamed "Seating chart & print" tab plus a setup wizard that ends at the class sheet. 7b **SHIPPED** for denomination coin cards and the printable Coin Guide (#197 / #201 / #203), but **per-student coin codes were never built**. 7c **SHIPPED, and no longer reference-only** — Tera gave written permission on 2026-08-15 (see `CLAUDE.md` rule 7), and nine cropped images from Tera's own manual now ship in the Help modal's Scanner Setup tab, sourced from `docs/tera-scanner-codes/`. The external blocker this line was written around is gone. 7d **NOT STARTED but UNBLOCKED** — the scanner timestamp format is confirmed. **Secretary Mode is now folded into the Firebase rebuild** (locked 2026-08-04): it is the app's first multi-user feature, so it waits for real accounts rather than being built twice. Offline Mode and the Batch Import parser stay independent and are free to build now.

- **7a. Print Wizard shell** — one guided entry point; re-home the (already-relocated in Phase 1) print pages into it; class-list printable; big double-sided student card.
- **7b. Shulchani coin cards** — color-matched coin QR backgrounds (uses existing `COINS` colors), per-student coin codes. *Depends on Phase 4's Shulchani work being settled.*
- **7c. Scanner Setup sheet** — reference-only version first (safe, no Tera permission needed); upgrade to reproduced codes only if/when Tera says yes.
- **7d. Offline Mode / Batch Import / Secretary Mode** — the full no-computer story. **UNBLOCKED** — the real scanner timestamp format is confirmed (`YYYY/MM/DD HH:MM:SS` suffix, 1-sec resolution). Fully spec'd in `docs/Offline_NoComputer_Secretary_Spec.md`: Offline Mode preference (onboarding + Manage tile + readiness wizard), Batch Import parser (with review-before-commit, same-second-duplicate + unknown-code flagging), and Secretary Mode (upload-for-others with saved rebbi roster + batch revert — the first multi-user feature, build carefully & last). Paired with Personal Scoring Pages (preserved since Phase 1) — the test data proved arm-then-scan is unreliable in batch. Only remaining external dep is Tera's permission for reproducing config barcodes on the *print* side (import/parser unaffected).

**Ships:** the complete printing story + the no-screen classroom workflow.

**Risk:** medium. 7d has an external blocker (scanner test) and is the most "new subsystem" of the lot — genuinely its own project phase, as flagged in the spec.

---

## Phase 8 — Chavrusa Mode *(full build; touches Dashboard from Phase 3)*

> **Status (2026-08-21):** **IN PROGRESS — third slice open as PR #377, see `CHANGELOG.md`.** The "sequence after Phase 3" framing above was checked against real code and found stricter than the spec's own content actually requires: every real Chavrusa touchpoint (§2) is scoped to Dashboard's List/Class-view toggle and the mini leaderboard strip, both of which shipped in #195 (the one Phase 3 item that IS done) — none of the four still-open Phase 3 items (floating Points panel dropdown, History's contest filter, History bulk-undo, Trends redesign) are actually a dependency. Manual/Automatic group-building and a reusable Past Chavrusas history are done (new "Chavrusa Mode" tab, Run group). Point-target modes are all built and shipped: Individual needed zero extra code (the spec's own default, "no Dashboard changes"); Entire Group and Group Entity + Resolve shipped in PR #358. The Dashboard visual integration (§2's touchpoints — target confirmation, grouped-tile rings, unresolved-pool strip) is PR #377, draft, awaiting Ben's click-through; it also adds a "From tables" quick group-builder and fixes an unrelated award-flash bug found along the way (a tabled seat's flash color, beaten by a CSS specificity collision). Still open after #377 lands: the rule editor, planned as a full tag-based system rather than just a never-pair blocklist — decided 2026-08-20.

The largest deferred feature. Spec is complete.

- ✅ Manual/automatic pairing, past-chavrusas — **shipped**, first slice.
- Rule editor (compatibility rules) — not yet built. Planned as a full tag-based system (freeform per-student tags + rules referencing them), not just a never-pair blocklist — decided 2026-08-20.
- ✅ Point-target modes: Individual **shipped** (no code needed); Group / Group Entity + Resolve — **shipped, PR #358** (merged 2026-08-21).
- Dashboard integration (grouping in List + Class view, scan-bar target indicator, multi-tile flash, unresolved-points strip) — **PR #377**, draft, awaiting Ben's click-through. *Confirmed unblocked, not gated on the rest of Phase 3 — see status line above.*

**Why last:** biggest new surface, depends on the most other things being stable, and isn't blocking anything. Genuinely a "once the core is solid" feature.

**Ships:** Chavrusa Mode, end to end.

**Risk:** medium-high (large new feature, Dashboard touchpoints) — but isolated behind its own mode, so a bug can't corrupt the core scan/points flow.

---

## The gaps still undesigned (decide before they'd slot in)

Flagged in the UI summary, not yet designed — each would need a design pass before earning a phase:
- **Student View** (student-facing screen) — Coin Deposit could seed it. **Revisit after the rebuild's step 2 (auth + tiers):** a student-facing screen under real accounts is an access-control question, not just a UI one, and designing it before tiers exist would mean designing it twice.
- **Teacher Command Bar** (Spotlight-style "give yosef 5") — called a "killer feature" in the docs.
- **Double-scan detection** (same student <2s → soft warning) — small, could fold into Phase 3.
- **Class Goal / status badges** — the gamification layer.

Don't schedule these until designed. Double-scan detection is the easy win (fold into Phase 3 if desired).

---

## Dependency map at a glance

```
Phase 0 (safety) ──> gates everything  [no Firestore analogue — rebuild must rebuild the gate]
Phase 1 (tab shell) ──> Phase 3 (dashboard), Phase 7 (print reorg)
Phase 2a/2b (Gradebook) ──> Phase 2d ──> Phase 5 (quiz grades), Phase 6 chart-fold
Phase 2d ──> un-hiding the Gradebook (#185) AND the Firebase rebuild's step 1
Phase 4 (Shulchani coins) ──> Phase 7b (coin cards)
Phase 6a (Library loader, #187) ──> Phase 6b (Review Wizard) ──> Library share-back
Phase 3 (Dashboard) ──> Phase 8 (Chavrusa bits) — partly absorbed by the rebuild's routing step
Phase 7d (Offline/Batch) ──> UNBLOCKED (scanner format confirmed)
Phase 7d (Secretary Mode) ──> folded into the Firebase rebuild (first multi-user feature)

Firebase rebuild (docs/Firebase_Rebuild_Scope.md)
  NEEDS 2d first (count value shape)
  ABSORBS 2d's interaction design, Phase 3's floating-panel fix, 7d Secretary Mode
  SEQUENCES BEFORE Phase 8
```

**Critical path, as originally written:** 0 → 1 → 2 is the spine. That spine is now essentially built — 0, 1, 2a and 2b are shipped and 2c is partway.

**Critical path from here (2026-08-04):** **2d → the Firebase rebuild.** 2d is the last slice of the keystone and it gates three separate things (the hidden Gradebook, Phase 5, and the rebuild's data model), which makes it the highest-leverage single piece of work left. Everything else in this plan is either independent or waits on one of those two.

---

## Suggested first three moves (if starting tomorrow) *(historical — all three are done)*

1. **Phase 0 migration harness** — boring, essential, unblocks fearless iteration.
2. **Phase 1 tab restructure** — high-visibility, low-risk, makes the app match the vision immediately.
3. **Phase 2a Tracked-Item data shell** — the new stores added in isolation and verified, before building the Gradebook UI on top.

Everything after that has room to flex based on what you and Rabbi Goldwasser actually feel the classroom needs next.

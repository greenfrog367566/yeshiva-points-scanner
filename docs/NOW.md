# NOW

The current working queue. Read this at the start of a session.

**Keep it short.** This is what is happening now, not a history. When something ships, delete it from here — `CHANGELOG.md` is the record. When something is decided but not next, it belongs in an issue or a spec in `docs/`, not here.

---

## Doing now

**Phase 2d is done — in two parts, both on 2026-08-05.** The mechanic shipped as #208; the tile badges are the second PR. Nothing in #123's scope is left.

- **#208** — `award()`'s four name-matched branches collapse into one `recordTrackedScan()`; every tracked activity is armable from every surface; identity is `a.tiId`, not the name. **The count value shape is decided:** an entry stores the step it contributed, so a total is a plain sum and `config.step` is baked in at write, never applied on read. `gbCountOf()`'s guess collapses.
- **The badges** — while a tracked item is armed, each boy's tile says where he stands on it: `last: 3d` / `never` for counts, `unmarked` (or the marked value) for statuses, `available` / `used` for the pass. They read the **legacy** store, not the mirror, for the reason in the next bullet.

**Two of 2d's three gates are now clear. The Gradebook is not one of them.**
Phase 5's grade storage and the Firebase rebuild's step 1 are unblocked — 2d has given step 1 the count value shape it was waiting on.

**The mirror gap is closed** (proposal in `docs/Mirror_Gap_Proposal.md`, approved 2026-08-05). Corrections made on the four old tabs now reach `data.trackedData` by **transcription at the setter** — the mirror copies the value the legacy store just wrote, with that record's own timestamp and day, and never computes one. A one-shot idempotent backfill in `load2fix()` picks up attendance marked since 2c's cutoff and the whole tracker history; homework is deliberately not back-filled (2c settled that it resets) and passes have no history to back-fill from.

⚠️ **#185 is now unblocked but still hidden — un-hiding is its own PR, by design.** That was decision 5 of the proposal: this change writes to a store holding real records, and un-hiding is a one-line `navHidden` seed. Two verifiable PRs rather than one that changes the data and reveals it in the same breath. **Read `data.mirrorBackfill` on a real save before un-hiding** — it is the receipt saying what came across.

⚠️ **Voice notes (draft #222) ship dark on purpose — and switching them on later is NOT a one-word change.** Speak a note onto the scan you just made; it writes `entry.note`, the same field History's "Add note" has always used, so nothing new is stored but the setting itself. `data.voiceNotes` defaults **false** so there is a classroom day before other rebbeim meet it. **The trap:** `load2fix()` fills that field only when it is *absent*, so any save that has once loaded this build keeps a stored `false` for good and flipping the literal reaches nobody. Turning it on needs a one-shot seed with its own flag — the `miniContestUnhidden` shape — because a stored `false` is indistinguishable from a rebbi who tried it and switched it off. There is a comment at the backfill line saying exactly this. **All moot if #222 never merges while off**, since no save carries the field yet.

**On the horizon:** the Firebase/Firestore rebuild is fully scoped in `docs/Firebase_Rebuild_Scope.md` — real accounts, Firestore replacing localStorage, three tiers, incremental-write data model, converter tool, 8-step build order. Not started; step 1 (data model design session) hasn't begun.

Its phase mapping was reconciled against the code on 2026-08-04 and it now carries an **"Open questions for step 1"** list — read that first when the rebuild becomes the active queue item. Two things were locked in that pass: **2d runs before step 1**, and Secretary Mode folds into the rebuild. Per-phase status for everything else lives in `Menchmark_Phased_Build_Plan.md`, which is the authority on what has shipped.

---

## Next, in order

**0. Un-hide the Gradebook (#185).** The mirror gap is closed, so the blocker is gone. This is a one-shot `navHidden` un-seed with its own flag — the same shape as `miniContestUnhidden` (#210), so a rebbi who switched the tab on by hand is not overruled either way. **Before doing it:** load a real save, read `data.mirrorBackfill`, and check its numbers against the Attendance and Tracker tabs. The receipt exists precisely so this is checked rather than trusted.

Two things to settle in that PR, both deliberately left open here:
- The Gradebook's pass column reads **all time** while the Passes tab reads **this period** (proposal decision 3, accepted knowingly). Decide whether the column needs a word of explanation on screen.
- `refreshLiveViews()` does not re-render the Gradebook, because nothing wrote the mirror when it was built. It does now, so the hook should probably learn the `gradebook` case.

**1. Offline resync** — read-only investigation first, then PROPOSE FIRST
The snapshot recovers after being offline; logged scans do not unless "resync all scans" is pressed. Want it automatic on reconnect and periodically.
**Retry safety differs per tab.** The Log dedups by ID so re-pushing is safe. The Attendance Log has no dedup, so a retry duplicates rows. Confirm per tab before proposing.
**In the Firestore era this asymmetry dissolves** — see the rebuild doc's open question 3 (deterministic client-generated write ids make every retry idempotent). That does not answer the question here; the localStorage/Apps Script investigation is still owed as written.

**2. Warning flash, and the sticky raffle removal**
What is left of the old "small standalone features" item once Freeze and the raffle note shipped. **Not the behavior ladder** — no marks store, no rung counting, no reset periods. Those stay in `docs/Behavior_Ladder_Spec.md`.
- Warning flash: reuses the minus flash, **records nothing**. A recorded warning implies a count, a count implies rungs, and rungs are the ladder. Verified not started — nothing in `app.html` matches.
- The raffle removal *note* shipped (`renderRaffleAdjustNote()`, "N students removed … from past wins"). What did **not** ship is the question it was filed with: report how a removal could clear itself after the next draw rather than staying sticky. Still open, still a report before a change.

---

## Not code, still owed

- **Physical workflow write-up.** Where codes actually live in a room: Avery labels on index cards, one per boy, boys take them out at the start; rebbi holds a clipboard with the seating chart and activity codes; arm an activity then scan the boy; homework code on the folder. A beta rebbi asked and nothing in the app or docs answers it.
- **Onboarding video: using it in a class** — the most-asked one (four of eight beta replies). `docs/Onboarding_Video_Scripts.md` calls it **Video B**; the beta tally called it **C**. Same video, script already written.
  **Video A shipped 2026-08-05** — setup from scratch *plus* the whole Record group, wider than the script's last two beats. Not linked anywhere yet: nothing in `quick-start.html`, `home.html`, or the app points to it, so a beta rebbi can't find it. That link is the open half of this item.
- **Announce the print fix and the Apps Script redeploy instruction** to existing rebbeim. This used to be bundled with a Lean mode announcement; Lean is retired, so the other two still need sending on their own.

---

## Standing rules that keep coming up

- **Hide what isn't ready — don't build a mode around it.** A feature showing wrong numbers or with no path forward gets a one-shot `navHidden` seed in `load2fix()`, hidden but never removed — Gradebook (#185) is the one currently hidden, Contest (#133) is the worked example that came back: hidden when its totals were underivable, un-hidden by the stored-totals rework in #210. **A hide is a loan, not a burial** — the return trip is the half that proves the model. **Lean/Simple mode is not the model.** It was built and merged (#121 / PR #150) and reverted the same day — correct logic, but with one visible tab per group the subtab row rendered empty and the header wasted a second row. Decided 2026-08-05: not coming back. It leaves the onboarding half of #121 unsolved on purpose — a new rebbi still opens on 4 groups and ~18 tabs, 11 of them in Run.
- **Browser-verify before merging anything that touches data.** A Node stub run is not a browser pass. Serve over http or the harness drift check goes amber.
- **Additive fields only** where possible: `load2fix()` backfill, no `DATA_VERSION` bump.
- **PROPOSE FIRST** for anything that reshapes a store holding real records.
- **Never nest new fields into a parked store** — it breaks 2a's byte-identity guarantee (lesson from #124).
- **Ask what happens when the data is gone or wrong** before shipping. Contest's model was sound and it still lost data, because totals were only derivable from a wipeable 500-entry log.
- Every branch that edits `CHANGELOG.md` will conflict with every other one. Keep both sets of entries; it is never a real conflict.

---

## Phase 2 status

2a and 2b shipped. **2c is partial** — only `data.attendance` was converted (#138); `data.hw` resets, `data.trackerLog` and `data.passes` are still TBD, and all four old tabs are still visible. The remainder is re-scoped in #122. **2d shipped 2026-08-05** in two parts (#208 + the badges) — see "Doing now". The count value shape it was holding up is settled: an entry stores the step it contributed.

**2d has cleared the Firebase rebuild's step 1** (locked 2026-08-04): the data-model session was waiting on `trackedData`'s count shape so it would not be modelled against 2b's guess and then done twice. It now has a real answer to model.

**The Gradebook tab is hidden (#185) but no longer blocked.** Both reasons it was hidden are now gone: 2d gave `data.trackedData` a writer, and the mirror-gap fix means a correction on one of the old tabs reaches it too, so the grid can no longer contradict the tab a rebbi just fixed. Un-hiding is item 0 in "Next, in order" — a one-shot `navHidden` un-seed, kept as its own PR on purpose (proposal decision 5) so the data change and the reveal are verified separately. The attendance forward-port question is settled: the backfill re-runs 2c's merge idempotently, and `data.mirrorBackfill` is the receipt.

Instances for worksheets and quizzes are #120, deliberately separate from 2c so two migrations stay small.

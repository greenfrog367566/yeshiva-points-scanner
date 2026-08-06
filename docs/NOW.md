# NOW

The current working queue. Read this at the start of a session.

**Keep it short.** This is what is happening now, not a history. When something ships, delete it from here — `CHANGELOG.md` is the record. When something is decided but not next, it belongs in an issue or a spec in `docs/`, not here.

---

## Doing now

**#127 → #128: batch undo, then whole-class award.** Unblocked 2026-08-06 when #129 raised the log cap. Build them as one piece, **in that order** — #127 is #128's safety net, and shipping the award first would hand rebbeim a way to create 25-entry batches that nothing can reverse.

- **#127 — a batch award cannot be undone as a batch.** Undo does not delete, it *appends* a correction per boy, so reversing a 25-boy award by hand is 25 separate clicks and there is no handle on the batch itself. Needs a batch id stamped at write and an undo that reads it.
- **#128 — award an activity to the whole class in one action.** **Write once at the end, not per student.** `save()` measures ~24 ms against a full log, so a 30-boy award that calls `awardWith()` per boy pays ~720 ms in saves alone. That was measured while sizing #129 — don't re-derive it.

**Why #129 was the blocker, now that it is gone:** undo locates its target by scanning `data.log`, so at the old 500-entry cap a batch's own entries could roll off the end *before* the rebbi undid them, leaving nothing to reverse. The cap is now 5000, with tracked scans on their own separate 1500 budget so they can never evict a point scan (#225 + #226, both merged 2026-08-06).

⚠️ **Voice notes shipped dark (#222, merged 2026-08-06) — switching them on for everyone now REQUIRES a one-shot seed.** Speak a note onto the scan you just made; it writes `entry.note`, the same field History's "Add note" has always used, so nothing new is stored but the setting itself. `data.voiceNotes` merged defaulting **false**, on purpose, so there was a classroom day before other rebbeim met it.

**Because it merged while off, the trap is live rather than hypothetical.** `load2fix()` fills that field only when it is *absent*, so every save that has once loaded this build now carries a stored `false` for good, and changing the literal reaches nobody. Turning it on needs a one-shot seed with its own flag — the `miniContestUnhidden` shape — because a stored `false` is indistinguishable from a rebbi who tried it and switched it off. There is a comment at the backfill line saying exactly this. **Note it is off on every device separately**, localStorage being per-origin: testing on localhost does not carry to `menchmark.app`.

**On the horizon:** the Firebase/Firestore rebuild is fully scoped in `docs/Firebase_Rebuild_Scope.md` — real accounts, Firestore replacing localStorage, three tiers, incremental-write data model, converter tool, 8-step build order. Not started; step 1 (data model design session) hasn't begun.

Its phase mapping was reconciled against the code on 2026-08-04 and it now carries an **"Open questions for step 1"** list — read that first when the rebuild becomes the active queue item. Two things were locked in that pass: **2d runs before step 1**, and Secretary Mode folds into the rebuild. Per-phase status for everything else lives in `Menchmark_Phased_Build_Plan.md`, which is the authority on what has shipped.

---

## Next, in order

**0. The two-tier data custody question (#218)** — a decision, not a build, and it is now the thing gating the biggest piece of work left.

It challenges the Firebase rebuild's core premise: every rebbi's student records in one person's Firebase project, for schools with no relationship or agreement. It proposes splitting custody by institutional relationship — full Firebase for schools that sign on, local + the rebbi's **own** Google Drive for everyone else.

Why it is item 0 rather than something to get to: it says the split has to be settled **before** step 1's collection design, because it decides whether the storage seam has one implementation behind it or two — and building that seam twice is the cost of deciding late. It also makes the rule-3-vs-Firebase-SDK conflict much easier, since tier 2 would never load the SDK at all. It carries five open questions of its own.

It also names a piece that could start immediately and independently: **spike the Drive OAuth + `drive.file` write flow** against a throwaway Google Cloud project. No dependency on accounts, Firestore or the data model, and it de-risks the one real unknown — the re-auth UX in classroom conditions, not the API.

**1. Finish Phase 2c: give the Gradebook a writer, then drop the four old tabs (#227)** — the biggest build item left, and it was missing from this list entirely until 2026-08-06.

Every `gb*` function only reads. Until the grid can edit a cell, the Attendance / Homework / Passes / Tracker tabs cannot go, because their setters are the only thing feeding the mirror — see the Phase 2 status section for what each store already did. **Give it its own session**: it needs a cell editor plus setters, and it touches the transcription seam, so it is the riskiest thing currently on the board. When a tab does go, delete its `TRACKED_LEGACY` row, its badge-table row **and** that store's `mirrorTracked()` call together.

**2. Offline resync** — read-only investigation first, then PROPOSE FIRST
The snapshot recovers after being offline; logged scans do not unless "resync all scans" is pressed. Want it automatic on reconnect and periodically.
**Retry safety differs per tab.** The Log dedups by ID so re-pushing is safe. The Attendance Log has no dedup, so a retry duplicates rows. Confirm per tab before proposing.
**In the Firestore era this asymmetry dissolves** — see the rebuild doc's open question 3 (deterministic client-generated write ids make every retry idempotent). That does not answer the question here; the localStorage/Apps Script investigation is still owed as written.

**3. Warning flash, and the sticky raffle removal**
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

- **Hide what isn't ready — don't build a mode around it.** A feature showing wrong numbers or with no path forward gets a one-shot `navHidden` seed in `load2fix()`, hidden but never removed. **Nothing is currently hidden**: Contest (#133) came back via #210's stored totals, and the Gradebook (#185) came back once 2d and the mirror-gap fix gave it a writer. **A hide is a loan, not a burial** — the return trip is the half that proves the model, and it has now been walked twice, both times with the feature intact rather than rebuilt. **Lean/Simple mode is not the model.** It was built and merged (#121 / PR #150) and reverted the same day — correct logic, but with one visible tab per group the subtab row rendered empty and the header wasted a second row. Decided 2026-08-05: not coming back. It leaves the onboarding half of #121 unsolved on purpose — a new rebbi still opens on 4 groups and ~18 tabs, 11 of them in Run.
- **Browser-verify before merging anything that touches data.** A Node stub run is not a browser pass. Serve over http or the harness drift check goes amber.
- **Additive fields only** where possible: `load2fix()` backfill, no `DATA_VERSION` bump.
- **PROPOSE FIRST** for anything that reshapes a store holding real records.
- **Never nest new fields into a parked store** — it breaks 2a's byte-identity guarantee (lesson from #124).
- **Ask what happens when the data is gone or wrong** before shipping. Contest's model was sound and it still lost data, because totals were only derivable from a capped, wipeable log. **Raising that cap to 5000 (#226) did not retire this rule** — the log is still capped and still wiped by "Reset all scores", so anything whose totals are only *derivable* from it is still built on sand. Store the total.
- Every branch that edits `CHANGELOG.md` will conflict with every other one. Keep both sets of entries; it is never a real conflict.

---

## Phase 2 status

2a and 2b shipped. **2c's data is done; its tabs are not.** Attendance converted (#138), homework resets by decision, and #219 answered the two that were TBD — tracker copied over in full, passes had no history to copy. **All four old tabs are still there.** Removing them is blocked: the Gradebook can't write, and those tabs' setters are the only thing feeding the mirror. Now #227 (#122 is closed). **2d shipped 2026-08-05** in two parts (#208 + the badges) — see "Doing now". The count value shape it was holding up is settled: an entry stores the step it contributed.

**2d has cleared the Firebase rebuild's step 1** (locked 2026-08-04): the data-model session was waiting on `trackedData`'s count shape so it would not be modelled against 2b's guess and then done twice. It now has a real answer to model.

**The Gradebook is UN-HIDDEN (#185, shipped 2026-08-05)** — this section said "hidden" for a day after it stopped being true, so read the date before trusting it. Both reasons it was hidden are gone: 2d gave `data.trackedData` a writer, and the mirror-gap fix means a correction on one of the old tabs reaches it too, so the grid can no longer contradict the tab a rebbi just fixed. The attendance forward-port question is settled: the backfill re-runs 2c's merge idempotently, and `data.mirrorBackfill` is the receipt.

**The Homework column starts at the ship date, and that is a non-issue — kept here so nobody re-litigates it in November.** Mirror-gap decision 2 excluded `data.hw` from the backfill, so Attendance and count items carry their history and Homework does not. That was flagged as a possible "looks broken" moment, and it isn't, for a reason not visible in the code: **the beta cohort onboarded on v0.9.0 (2026-07-18), in the summer, so no rebbi has any homework history for the backfill to have missed.** The column fills from the first day of the school year, which is also the first day anyone marks homework. Nothing to fix.

Instances for worksheets and quizzes are #120, deliberately separate from 2c so two migrations stay small.

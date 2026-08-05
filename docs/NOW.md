# NOW

The current working queue. Read this at the start of a session.

**Keep it short.** This is what is happening now, not a history. When something ships, delete it from here — `CHANGELOG.md` is the record. When something is decided but not next, it belongs in an issue or a spec in `docs/`, not here.

---

## Doing now

**Phase 2d — the armed-item scan mechanic (#123).** Started 2026-08-05.

It is the critical path, per `Menchmark_Phased_Build_Plan.md`: the last slice of the keystone, and the gate on three separate things — un-hiding the Gradebook (#185), Phase 5's grade storage, and the Firebase rebuild's step 1. It was missing from this queue entirely while smaller items sat above it; that is the discrepancy this entry fixes.

It also decides the **count value shape**, which nothing has ever written. 2b's `gbCountOf()` carries a guess to cover it — the only place in the Gradebook that guesses at data rather than reading it — and that fallback collapses once 2d chooses. Same question: whether `config.step` is baked into the stored value or applied on read. **PROPOSE FIRST on the shape**, even though the writes themselves are expected to be additive.

**On the horizon:** the Firebase/Firestore rebuild is fully scoped in `docs/Firebase_Rebuild_Scope.md` — real accounts, Firestore replacing localStorage, three tiers, incremental-write data model, converter tool, 8-step build order. Not started; step 1 (data model design session) hasn't begun.

Its phase mapping was reconciled against the code on 2026-08-04 and it now carries an **"Open questions for step 1"** list — read that first when the rebuild becomes the active queue item. Two things were locked in that pass: **2d runs before step 1**, and Secretary Mode folds into the rebuild. Per-phase status for everything else lives in `Menchmark_Phased_Build_Plan.md`, which is the authority on what has shipped.

---

## Next, in order

**1. Offline resync** — read-only investigation first, then PROPOSE FIRST (after 2d)
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
- **Onboarding video A** (setup from scratch), then **C** (using it in a class). Beta tally across 8 replies: C four, A three, B two. A first because two rebbeim are stuck before they can start.
- **Announce the print fix and the Apps Script redeploy instruction** to existing rebbeim. This used to be bundled with a Lean mode announcement; Lean is retired, so the other two still need sending on their own.

---

## Standing rules that keep coming up

- **Hide what isn't ready — don't build a mode around it.** A feature showing wrong numbers or with no path forward gets a one-shot `navHidden` seed in `load2fix()`, hidden but never removed (Contest #133, Gradebook #185). **Lean/Simple mode is not the model.** It was built and merged (#121 / PR #150) and reverted the same day — correct logic, but with one visible tab per group the subtab row rendered empty and the header wasted a second row. Decided 2026-08-05: not coming back. It leaves the onboarding half of #121 unsolved on purpose — a new rebbi still opens on 4 groups and ~18 tabs, 11 of them in Run.
- **Browser-verify before merging anything that touches data.** A Node stub run is not a browser pass. Serve over http or the harness drift check goes amber.
- **Additive fields only** where possible: `load2fix()` backfill, no `DATA_VERSION` bump.
- **PROPOSE FIRST** for anything that reshapes a store holding real records.
- **Never nest new fields into a parked store** — it breaks 2a's byte-identity guarantee (lesson from #124).
- **Ask what happens when the data is gone or wrong** before shipping. Contest's model was sound and it still lost data, because totals were only derivable from a wipeable 500-entry log.
- Every branch that edits `CHANGELOG.md` will conflict with every other one. Keep both sets of entries; it is never a real conflict.

---

## Phase 2 status

2a and 2b shipped. **2c is partial** — only `data.attendance` was converted (#138); `data.hw` resets, `data.trackerLog` and `data.passes` are still TBD, and all four old tabs are still visible. The remainder is re-scoped in #122. **2d** (armed-item scan mechanic) is the last slice and is **in flight as of 2026-08-05** — see "Doing now". It also pins down the count value shape, which is still undefined — the 2b gradebook carries a guess that should collapse when 2d lands.

**2d now runs ahead of the Firebase rebuild** (locked 2026-08-04): the rebuild's data-model session has to model `trackedData`, and modelling it against 2b's guess means doing it twice.

**The Gradebook tab is hidden until 2d lands (#185).** Nothing writes `data.trackedData` except the one-shot 2c attendance conversion, so the grid froze at the migration and showed every day since as missing — a working-looking feature with wrong numbers. Hidden the same one-shot `navHidden` way as Contest, no data touched. **Un-hiding is gated on 2d, not on anything cosmetic** — not tidier empty columns, not #119's item tabs. When 2d lands, decide at the same time whether it forward-ports attendance from the cutoff; `data.attConversion` holds the receipt needed to do that safely.

Instances for worksheets and quizzes are #120, deliberately separate from 2c so two migrations stay small.

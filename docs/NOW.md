# NOW

The current working queue. Read this at the start of a session — **after**
running `node scripts/wip-audit.js`, not before. That audit answers "what is
already half-baked," and on most days that question outranks "what's next."

**Keep it short.** This is what is happening now, not a history. When something
ships, delete it from here — `CHANGELOG.md` is the record, `docs/*.md` are the
design record, and `Menchmark_Phased_Build_Plan.md` is the authority on phase
status. When something is decided but not next, it belongs in an issue or a
spec, not here.

> **Rewritten 2026-08-20**, from 4,554 words back to a queue. It had become a
> chronicle of finished work, which is exactly why "what's half-baked?" was
> unanswerable from it. Nothing was deleted without a home: the live-Firebase
> setup account and the three GCP console gaps moved to
> `Firebase_Rebuild_Scope.md`; per-slice build history is in `CHANGELOG.md`.

---

## Doing now

**Open PRs — 3 of 5** (`CLAUDE.md` → "Finishing work"). Under the cap.

| PR | What | Owed before ready |
|---|---|---|
| #370 | Photo crop wizard, Choose photo button, bigger avatars | review |
| #371 | Release-drift check that stays quiet until a release is due | review |
| #377 | Chavrusa Dashboard integration (Phase 8 slice 3) + tables-flash fix + From tables | Ben's click-through |

**Phase 8 (Chavrusa Mode) is the active build.** Slices 1 and 2 have both
merged: manual/automatic group-building, Past Chavrusas, and Individual point
mode (slice 1); Entire Group / Group Entity point-target modes + Resolve
(slice 2, #358, merged 2026-08-21). **Slice 3 (Dashboard visual integration)
is open as PR #377** — target confirmation, grouped-tile rings in List +
Class view (List mode also clusters into brackets), and a dismissible
unresolved-pool strip, all gated on point-target mode not being Individual.
Also in #377: a "🪑 From tables" quick group-builder, and a fix for an
unrelated CSS-specificity bug where a scan's award flash never showed its
color on a student seated at a seating-tables table. **The rule editor is the
last slice left after #377 lands** (planned as a full tag-based system —
freeform per-student tags + rules referencing them, not just a never-pair
blocklist). See `Menchmark_Phased_Build_Plan.md` → Phase 8 for the full
status line.

**The Firebase/Firestore rebuild is built and deployed.** All 8 build-order
steps merged (PRs #290, #292, #300, #303, #309) and `firebase deploy` is live
against `menchmark-backend`. **Step 8 — migrating the real beta cohort — is
the only *step* left**, and it waits on the verification runs listed under
"Merged, not done" — **which also now carries a bigger one**: tier-1 has no
live write-sync path yet, so step 8 as currently scoped would move rebbeim
onto real accounts without moving their day-to-day data onto Firestore.
Everything else about the rebuild lives in `docs/Firebase_Rebuild_Scope.md`,
including the live-project setup and the console-only gaps that cost a day.

---

## Merged, not done

**Shipped code that has not finished shipping.** A merge is rung 1 of 5 — see
`CLAUDE.md` → "Merged is not done." Nothing here is *next*; all of it is
**owed**, and mixing the two lists is what let these sit.

- **Link the onboarding video.** Video A shipped 2026-08-05 and is linked from
  nowhere — not `quick-start.html`, not `index.html`, not the app. A rebbi
  cannot find it, so as far as the cohort is concerned it did not ship.
- **`docs/user-guide.md` still says "Backup & Sheets" in 6 places** (lines 229,
  679, 685, 700, 712, 739 — including two image captions). The in-app rename is
  complete; the guide still names a tab that no longer exists.
- **Managed-Chromebook verification runs** for build step 0c (folder backup,
  #249) and step 7 (fragile-storage warning). Cannot be simulated — Ben's own
  hardware. **Step 7 must not reach beta rebbeim until this passes.**
- **One real end-to-end sign-in click-through**, plus step 3b's
  `already-exists` / `ALREADY_EXISTS` status-string shape, still unconfirmed
  against the live project (it was verified against a mocked `fetch()`).
- **`CHANGELOG.md`'s `[0.10.0]` carries 8 section headings** (3× Added, 3×
  Changed, 2× Fixed) where CLAUDE.md allows one of each. A careful editorial
  merge, not a mechanical one — the entries are long and rebbi-facing.
- **Announce the print fix and the Apps Script redeploy instruction.** Pasting
  new Apps Script code is not enough; teachers must trigger "Manage deployments
  → New version" themselves, and nobody has told them.
- **Tier-1 classes have no live Firestore sync — the rebuild's headline
  promise ("becomes a real multi-user product with … a real database") isn't
  true yet for day-to-day use.** Verified 2026-08-20 by grepping `app.html`:
  the only Firestore function anywhere in the file is `fetchClassFromFirestore()`
  (line 7284) — a *read*, called exactly once (line 25050), for admin's Class
  Book view and superadmin's view-as. There is no write path. A rebbi's scans,
  points, and gradebook entries still live only in `localStorage`, exactly as
  before the rebuild. The only data that has ever reached Firestore is a
  one-time snapshot pushed through the converter tool at import time; nothing
  keeps it current afterward. `Firebase_Rebuild_Scope.md`'s step 7 text already
  names this ("tier-1 … needs a live Firestore write-sync path from a rebbi's
  own scans that doesn't exist anywhere yet"), but it was never carried here.
  **Migrating the real beta cohort (step 8) before this exists moves their
  accounts, not their safety** — real auth and security rules, but their
  actual class data is exactly as fragile as it is today.

---

## Unfinished, and nothing was tracking it

Originally found by the 2026-08-20 worktree audit; re-run 2026-08-21 —
**seating tables (#364) and `feat/board-fab`/`fix/seats-fullscreen-topbar`
have since landed** (as #364, #331, and #351 respectively) and are off this
list. What the re-run still shows, plus two new ones the same audit surfaced.
Verify each with the `branch-merge-audit` skill before concluding either way.

- **`fix/theory-audit-batch-1`** — removes Backup's "Send standings now"
  button. Still on `main`. **This is a tab-audit item counted as closed.**
- **`steinerman/hadroom-camera-test`** (same worktree as the old
  `steinerman/chazaroom` entry, branch renamed since) — 4 commits of Chazaroom
  PTZ work, including "the PTZ tick now tells the truth, continuously." This is
  what #240 actually contains.
- **`feat/shelves-toggle`** — 1 commit pushed *after* PR #354 merged: 3 fixes
  from a code review (a stale-hint bug, a dropdown that didn't close, an
  un-truncated name) that never made it in.
- **`fix/backup-label-mismatch-live`** — 1 commit, PR #329 closed unmerged.
  Finishes the "Backup & Sheets" → "Backup & Restore" rename in the places
  PR #301 missed (toast/status text, the embedded user guide, setup.html).
- **10 of 18 worktrees are dead** and safe to clear (landed, unlocked, clean) —
  down sharply from 81-of-92, so the 2026-08-20 cleanup mostly happened.
  Removal is a stop-and-ask action — `node scripts/wip-audit.js --stale` prints
  the list and the commands; it never runs them.

---

## Next, in order

**1. Finish Phase 2c: drop the four old tabs (#227)** — the biggest build item
left, and the standing candidate for the subtraction quota in `CLAUDE.md`.

The **write side is complete**: all four legacy stores (Attendance, Homework,
Tracker, Pass) now have a Gradebook write path. What remains is removing the
tabs, and **that is much bigger than adding a column** — the trap in this item.
The Attendance tab especially: its Sheet push, the seating-chart badges and
"Mark the rest Present" all read the legacy store directly, and each has to
move to the mirror first or it fails **silently**.

When a tab finally goes, delete its `TRACKED_LEGACY` row, its badge-table row,
**and** that store's `mirrorTracked()` call together. Pass is editable for the
current week only, by decision — `data.passCount` has no per-day history.

**2. Offline resync — proposal written, waiting on Ben.**
`docs/Offline_Resync_Proposal.md`. Pesukim, Tracker and Homework Logs have **no
recovery path at all**: a failed push is permanently lost with no error shown.
Attendance Log stamps `_sentAt` even when the push failed, so the normal resend
never retries it.

Recommendation: ship the **dedup fix** as a normal EXECUTE-FREELY PR (additive,
no migration). Hold the automatic-retry-on-reconnect piece — it is real scope,
and Firestore's deterministic write ids make it unnecessary, so there is a case
for folding it into the rebuild rather than building it twice.

**3. The sticky raffle removal** — the last open piece of the small-features
item. A **report before a change**: how could a removal clear itself after the
next draw instead of staying sticky? Not the behavior ladder — that stays in
`docs/Behavior_Ladder_Spec.md`.

**4. Tab audit — 25 of 27 closed** (`docs/UI_Theory_Tab_Audit.md`). Item 24
(Dashboard default layout) is Ben's, separately. Item 26 (Run-row section
separators) is blocked on #227 — pull it once that lands. ⚠️ Re-check this
count against `fix/theory-audit-batch-1` above, which never landed.

**7. Homework tab: still a boolean, not the four-state credit cycle (#361).** `ti-homework` is already seeded with `unchecked / full credit / partial credit / no credit`, and the mirror write, the History "notable exception" gate, and `GB_FIXED_TONES` cell-tinting are all already written generically against all four states — but the Homework tab's own UI (`renderHomework()`) still only offers a "Mark checked / Mark unchecked" toggle, so "partial credit" and "no credit" have no writer anywhere. **Not the same thing as #227** (the Gradebook's *own* homework cell editor, shipped in #227 slice 2, is deliberately two-state pending this). Three `app.html` comments previously cited the wrong, unrelated, closed issue #122 (Phase 2c's tab-retirement/data-migration work) for this — corrected 2026-08-20 to point at #361, the real tracking issue.

---

## Waiting on Ben

Roughly in the order of what they unblock. Nothing here is a task Claude can take.

1. **The privacy note** — `docs/Account_Privacy_Note.md`. Drafted; all six
   blanks decided 2026-08-13 and filled in. Owed: a read-through of the prose
   and the three flagged judgment calls, nothing else. **The earliest gate in
   the whole sign-in plan** — it blocks self-serve signup in *either* tier,
   including Ben's own school. `privacy@menchmark.app` is live and tested.
2. **A yes on the offline resync proposal** before the dedup-fix PR is built.
3. **Q3: what a school signs.** Gates onboarding school #2; blocks no code.
4. **A yes on clearing the 10 dead worktrees** (`node scripts/wip-audit.js
   --stale` for the list). Stop-and-ask by policy. The seating-tables lines
   this item used to name are resolved — committed, rebased, and merged as
   #364.

✅ **Cleared 2026-08-21 — Ben told the rebbeim on old offline copies to
re-download** (#244). That was the one item on this page with real classroom
data at risk, and the only fix for it — a `file://` copy has no update path,
so no code change could ever have reached it. Don't re-add this to the queue;
if a rebbi turns up still on a stale copy, that's a one-off follow-up, not a
reopening of this item.

✅ **Cleared 2026-08-12 — six decisions taken, don't re-ask.** The rule-3 /
Firebase SDK call (vendored, same-origin, tier 1 only), deterministic write
ids, photos stay inline, `_headers` for update-check CORS, the folder backup
pulled forward to step 0c, and the Drive spike's hardcoded client ID removed.
All recorded in `Firebase_Rebuild_Scope.md` and `CLAUDE.md`.

---

## Not code, still owed

- **What a school has to agree to, to become tier 1** (#218 Q3). A liability
  and relationship question, not an architecture one. Nothing in code is
  blocked, but it gates onboarding school #2 — school #1 is Ben's own, where
  the relationship exists by virtue of him being staff. Something short in
  writing before any outside school's data lands in Firestore: data ownership,
  deletion on request, breach notification (72 hours, per the privacy note),
  who to contact.
- **Physical workflow write-up.** Where codes actually live in a room: Avery
  labels on index cards, one per boy, taken out at the start; rebbi holds a
  clipboard with the seating chart and activity codes; arm an activity, then
  scan the boy; homework code on the folder. A beta rebbi asked and nothing in
  the app or docs answers it.
- **Onboarding video B** — "using it in a class," the most-asked of the eight
  beta replies (four asked for it). Script already written in
  `docs/Onboarding_Video_Scripts.md`. (The beta tally called this one "C" —
  same video.)

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

**Open PRs — 2 of 5** (`CLAUDE.md` → "Finishing work"). #373, #377 and #379
(all listed here earlier 2026-08-21) have since merged — checked 2026-08-21
evening:

| PR | What | Owed before ready |
|---|---|---|
| #378 | Homework Checked can optionally also move points | Not ready per its own checklist — untested against a live contest/mini-contest or Shulchani (prutot) mode running concurrently. Also amends CLAUDE.md's "tracked activities never award points" hard rule, which is PROPOSE-FIRST territory on its own. |
| #383 | COM setup codes shortcut on the Settings scanner card | Not reviewed this session — check its own body/checklist before acting on it. |

**Ready to start now that #373 merged: a locked Drive snapshot for the erase
feature (#373's one deferred piece).** #373 shipped the erase-and-restore
feature with a **locked snapshot** (`menchmark-saved-…`, never rewritten
again) for the **folder** backup path — the safety property Ben found was
missing by testing it himself, and has now hardware-verified twice. Erasing
via **Google Drive** still writes the ordinary rolling backup, because a
parallel `driveWriteSnapshot()` was written and found to be completely
unexercised — no one has ever run it against a real account — and was cut
rather than shipped untested. Open a **fresh** PR against `main` (never stack)
adding it back: create a new Drive file (never PATCH) before an erase, **plus
a read-back** — fetch the file after writing and confirm it parses with the
expected student count — before the erase is allowed to proceed, the same
verify-after-write discipline `writeClassAndVerify()` already uses
server-side. Until this lands, a rebbi with Drive connected and no backups
folder has only the ordinary rolling Drive backup protecting an erase, not a
locked one.

**Phase 8 (Chavrusa Mode) is the active build.** Slices 1, 2, and now 3 have
all merged: manual/automatic group-building, Past Chavrusas, and Individual
point mode (slice 1); Entire Group / Group Entity point-target modes + Resolve
(slice 2, #358); Dashboard visual integration — shared-color group rings,
target-confirmation toast, unresolved-points strip, "From tables" button
(slice 3, #377, merged 2026-08-21). **The rule editor is the only piece
left** (planned as a full tag-based system — freeform per-student tags +
rules referencing them, not just a never-pair blocklist). See
`Menchmark_Phased_Build_Plan.md` → Phase 8 for the full status line.

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

> **Re-verified 2026-08-21, at the close of the finishing-system session.**
> Every item below was checked against `main` rather than carried forward on
> trust, because a list of owed work that is itself stale is the problem it
> exists to solve. What was checked, and what it said:
>
> | claim | how it was checked | verdict |
> |---|---|---|
> | `[0.10.0]` has 8 headings | counted `### ` in that section on `main` | **8 — still true** |
> | `fix/theory-audit-batch-1` never landed | grepped `main` for "Send standings now" | **2 hits — still on main** |
> | release is drifting | `scripts/release-drift.js` | **70 merges past 0.10.0** |
> | video A linked | shipped as #382 | **done, struck below** |
> | `user-guide.md` rename | shipped as #381 | **done, removed** |
> | #244 re-download message | marked sent by #375 | **done, removed** |
>
> **The single loudest thing owed is a release cut.** 0.10.0 was cut on
> 2026-08-19 and **70 merges** have landed since — everything from the tables
> work to Chavrusa Dashboard integration. An *online* rebbi already has all of
> it (`sw.js` serves HTML network-first), so nothing is broken; but the
> "Check for updates" card tells him he is current when he is not, and
> `CACHE_VERSION` has not moved, so an *offline* copy is still serving 0.10.0's
> files. One command: `node scripts/bump-version.js 0.11.0`.

- **#373 (erase a class off a borrowed computer, restore it back) — merged
  2026-08-21T18:14:07Z, rung 2 done, rung 3 owed.** Verified live the same
  session (`eraseThisComputerBtn` present on `menchmark.app/app.html`,
  `this-computer-block` present on `setup.html` — checked ~3 minutes after
  merge, `-L` and `--ssl-no-revoke`). **Never browser-tested against the real
  deployed site** — every click-through this session was on localhost. Owed:
  pick a real backups folder, back up, erase as "Mine," restore from this
  computer, on `menchmark.app` itself. Doc restamp already done inline in the
  PR (`Firebase_SignIn_UI_Design_Proposal.md` §4).

- ✅ **Link the onboarding video — DONE (#382).** Video A had shipped
  2026-08-05 and was linked from nowhere, so as far as the cohort was concerned
  it had not shipped at all. It now plays **in a viewer on `quick-start.html`**
  (Drive's `/preview` in a modal, loaded only when opened and stopped on close)
  and is linked from `index.html` under the four setup steps. **Still not in the
  app itself** — that is `app.html`, and adding it there would collide with the
  open PRs that touch it; worth a small follow-up when that file is quiet.
- **Cut 0.11.0.** See the box above — 70 merges deep, and `release-drift.js`
  now says so at the start of every session until it is done.
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
- **#370 (photo crop wizard, Choose photo… button, bigger avatars, seating
  chart Face size dial, Avatar-defaults-to-None-until-a-photo-exists) —
  merged and verified live 2026-08-21, but the browser pass on the real
  deploy was deliberately partial.** Confirmed against `menchmark.app` on
  Ben's own live account (30 real students): the **Choose photo…** button
  and the bigger avatar sizes render correctly on the Students tab, and the
  seating chart's toolbar (Setup & arrange, Give to all, Display) matches
  local testing exactly. **Not exercised live**, on purpose — every other
  path touches real data or a real persisted setting: uploading an actual
  photo through the crop wizard, dragging/resizing the crop circle, the
  Face size −/+ dial, toggling Setup & arrange, and switching Avatar modes.
  All of that was verified thoroughly against local dev-server test data
  earlier in the same session (drag/resize/save, every Face-size step 50%
  through 150% in both a wide and a narrow layout, the None→photo one-shot
  auto-turn-on and its manual-override respect) — just never against Ben's
  own roster. Low risk (nothing destructive; worst case is a photo or a
  display setting that needs re-editing), but still genuinely un-run on the
  one dataset that matters. **One real interactive pass — upload a photo
  for a real student, confirm the crop lands where expected, nudge Face
  size — closes this.**
- **Same PR, a scope decision flagged for Ben, not a bug: should the
  printed seating sheet's photo size also go up?** The live-chart sizes
  went up (¹⁄₂×–1¹⁄₂× dial, new default = old dial's former max) but the
  **printed** sheet's photo caps (60/96/64/76px) were deliberately left
  untouched — `app.html`'s own CSS comments document raising them as a
  *pagination* change (a photo sheet gets taller), requiring the
  maintainer's say-so first, same as the last time this exact cap moved.
  Still open; no PR started.
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
  - **It has a DESIGN now — `docs/Firebase_TierOne_WriteSync_Design_Proposal.md`,
    merged 2026-08-21 as #379.** That changes the shape of this item but not its
    size: **nothing is built.** This is still the largest piece of unfinished
    work in the repo, and the only one recorded anywhere as "shipped" when it
    is not. Everything else on this page is a check, a click-through, or a
    tidy-up; this is a build.
  **Migrating the real beta cohort (step 8) before this exists moves their
  accounts, not their safety** — real auth and security rules, but their
  actual class data is exactly as fragile as it is today.
  **Design decided 2026-08-21 by Ben:**
  `docs/Firebase_TierOne_WriteSync_Design_Proposal.md`. Checked with the two
  other sessions in this repo first — neither was working on it, no
  duplicate effort. Full parity (every class-data field Drive backup
  carries, not just roster + scores + tracked entries), writing through the
  vendored Firestore SDK client (inherits offline queue/retry for free)
  instead of hand-rolled REST, and build the complete design before step 8
  — no staged MVP. Full parity adds three new `state/*` docs (seating,
  raffle, settings) beyond the original four collections, first-draft only
  and flagged for review before building, plus a `firestore.rules` change
  the narrow scope wouldn't have needed. **Prize Ledger sync is the one
  named exception — joins once Phase 4 (0-of-3, unbuilt) ships on its own
  schedule, not a blocker for step 8.** Nothing left open. Not yet
  built — this is design only.

---

## Unfinished, and nothing was tracking it

Originally found by the 2026-08-20 worktree audit; re-run 2026-08-21 —
**seating tables (#364), `feat/board-fab`/`fix/seats-fullscreen-topbar`, and
`feat/shelves-toggle`'s 3 stranded fixes have since landed** (as #364, #331,
#351, and #376 respectively) and are off this list. What the re-run still
shows. Verify each with the `branch-merge-audit` skill before concluding
either way.

- **`fix/theory-audit-batch-1`** — removes Backup's "Send standings now"
  button. Still on `main`. **This is a tab-audit item counted as closed.**
- **`steinerman/hadroom-camera-test`** (same worktree as the old
  `steinerman/chazaroom` entry, branch renamed since) — 4 commits of Chazaroom
  PTZ work, including "the PTZ tick now tells the truth, continuously." This is
  what #240 actually contains. **It is two separable things, and only one is
  owed work** (verified 2026-08-21): the **PTZ bridge improvements** are
  finished and landable on their own — `insta360-ptz/ptz-bridge.ps1` is 138
  lines on the branch against 107 on `main` (a stale-camera-handle self-heal,
  and no longer trusting a bare HTTP 200), in a standalone file that touches
  no `app.html`. The **room map** is not landable: its own commit message says
  `INCOMPLETE - pan is wrong`, and `cornerCode` / `roomMap` / `tiltFor` all
  return zero on `main`. Land the bridge, land
  `docs/Chazaroom_Room_Map_Spec.md` so the thinking survives, and leave the
  room-map code as a decision rather than a debt.
- **`fix/backup-label-mismatch-live`** — 1 commit, PR #329 closed unmerged.
  **Content-dead: nothing is owed here.** Verified 2026-08-21 by grepping
  `main` — `app.html` and `setup.html` both contain **zero** occurrences of
  "Backup & Sheets", so the rename this branch would have done (toast/status
  text, the embedded user guide, `setup.html`) already landed via the
  Backup & Restore redesign, PR #325. The branch shows up in this lane because
  `wip-audit.js` compares commit *dates* against the merge, which cannot see
  content that reached `main` by another route — a limit the `wip` skill flags
  itself. Safe to delete whenever the branch list gets swept; it is here only
  so nobody re-derives this a third time.
- **`worktree-feat+print-footer-same-grid` — the biggest thing on this list, and
  it was hiding behind a correctly-closed PR.** The branch holds two commits.
  The first is PR #179, which Ben closed with "included in #181" — that content
  landed and nothing is owed for it. The second, **`718565f`, was never
  proposed at all**: the **⚙ Customize** grid wizard on the seating-chart
  toolbar — per-section 1/2/3 widths, codes draggable between sections, a
  🗑 Removed bin, writing the one shared arrangement so the chart and the
  printed sheet agree. 180 lines, a finished CHANGELOG entry in the house
  voice, and two additive fields backfilled in `load2fix()`
  (`data.actFooterSectionCols`, `data.actFooterCustomizing`, no
  `DATA_VERSION` bump). Verified absent from `main` 2026-08-21 — all four of
  its identifiers return zero. **Re-landing it is PROPOSE FIRST**, not
  execute-freely: it is a UI feature with new stored fields that has been
  absent three weeks, and #344's layout customizer now covers adjacent ground.
- **`docs/claude-md-trim`** — 453 insertions across `CLAUDE.md` plus two new
  skills (`verify-deploy`, `worktree-audit`). **No PR was ever opened.** Both
  skill directories are absent from `main`. Worth redoing rather than
  restoring — see the replay hazard below — and check first whether
  `worktree-audit` is now redundant against `scripts/wip-audit.js`, which did
  not exist when the branch was written.

**⚠️ Do not rebase or cherry-pick anything in this lane.** Measured
2026-08-21: these branches are **398 to 735 commits behind `main`**, on an
`app.html` that has grown by roughly 14,000 lines since the oldest was cut.
Read each commit's diff as a *specification* and reimplement against current
code. The `docs/claude-md-trim` case is the sharp one — it trims `CLAUDE.md`
as it stood on 2026-08-03, so **replaying that patch would delete the entire
WIP-cap and ship-ladder section added on 2026-08-20.**

**Suggested order, if these are picked up.** The binding constraint is not the
5-PR cap (there is room) but the one-`app.html`-feature-PR-at-a-time rule:
**(1)** the "Send standings now" removal — six lines, no data model, and it
pays into the every-third-UI-PR-is-a-subtraction quota nothing has been paying
into; **(2)** in parallel, since neither touches `app.html` — the `CLAUDE.md`
retrim and the Chazaroom PTZ-bridge half; **(3)** the ⚙ Customize wizard last,
alone, and only after a yes, since it is the one item here that touches
`app.html` *and* adds stored fields.

- **14 of 26 worktrees are dead** and safe to clear (landed, unlocked, clean) —
  re-counted 2026-08-21. Still far below the 81-of-92 the cleanup started from,
  but climbing again: 26 worktrees where there were 18, because `testbench.js`
  now makes one per open PR and per spike on purpose. That is the system
  working, not sprawl returning — the set is bounded by what is alive, so it
  cannot run away the way it did before.
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

**A second Attendance-tab gap found 2026-08-21, not yet in this issue's own
plan:** the "✉ Email this day…" panel (`attEmailBtn`/`attEmailPanel`) also
reads `data.attendance[dateKey]` directly and has no home in the removal plan
— #227 only ever names `sendAttendance()` (the Sheets push) as needing one.
Proposed fix, posted as a comment on #227: keep a slimmed-down Attendance tab
that drops the per-student correction grid (the Gradebook owns that now) but
keeps Email-this-day and the Sheets push as a reporting/sending surface — both
can keep reading `data.attendance` unchanged, since that store and its setter
stay alive regardless of which UI writes to it.

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

**5. Homework tab: still a boolean, not the four-state credit cycle (#361).** `ti-homework` is already seeded with `unchecked / full credit / partial credit / no credit`, and the mirror write, the History "notable exception" gate, and `GB_FIXED_TONES` cell-tinting are all already written generically against all four states — but the Homework tab's own UI (`renderHomework()`) still only offers a "Mark checked / Mark unchecked" toggle, so "partial credit" and "no credit" have no writer anywhere. **Not the same thing as #227** (the Gradebook's *own* homework cell editor, shipped in #227 slice 2, is deliberately two-state pending this). Three `app.html` comments previously cited the wrong, unrelated, closed issue #122 (Phase 2c's tab-retirement/data-migration work) for this — corrected 2026-08-20 to point at #361, the real tracking issue.

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
- **A decision on the prefix/suffix (dikduk) library format.** A rebbi built
  a full word-by-word prefix/shoresh/suffix breakdown for Noach–Vayeira,
  styled after Torah Umesorah's linear-translation PDFs; sample saved at
  `docs/library-sources/`, scope written up in
  `docs/Library_PrefixSuffix_Proposal.md`. Depends on Phase 6a (the library
  loader) existing first — nothing reads `library/` yet either way.

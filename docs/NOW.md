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

⚠️ **Open PRs — 6, one OVER the cap of 5** (`CLAUDE.md` → "Finishing work").
All drafts. **Merge or close one before opening anything new** — and note the
three that touch `app.html` (#358, #360, #364) conflict with each other by
construction, so the order they land in matters.

| PR | What | Owed before ready |
|---|---|---|
| #358 | Chavrusa: Entire Group / Group Entity point-target modes + Resolve | browser pass |
| #359 | Tie `sw.js` `CACHE_VERSION` to the release number, gate it in CI | review |
| #360 | Seating chart: move "Close full screen" next to Setup & arrange | unblock CI |
| #362 | Fix stale #122 references for the Homework four-state work | review |
| #363 | This: the WIP audit, the cap, the ship-tail | review of the rules |
| #364 | Seating tables (recovered + rebased 93 commits) | browser pass on the feature |

**Phase 8 (Chavrusa Mode) is the active build.** Slice 1 (manual/automatic
group-building, Past Chavrusas, Individual point mode) has merged; #358 is the
point-target modes. Still to come as separate slices: the rule editor and the
Dashboard visual integration (confirmed *not* blocked by the rest of Phase 3 —
see `Menchmark_Phased_Build_Plan.md`).

**The Firebase/Firestore rebuild is built and deployed.** All 8 build-order
steps merged (PRs #290, #292, #300, #303, #309) and `firebase deploy` is live
against `menchmark-backend`. **Step 8 — migrating the real beta cohort — is
all that remains**, and it waits on the verification runs listed under "Merged,
not done." Everything else about the rebuild lives in
`docs/Firebase_Rebuild_Scope.md`, including the live-project setup and the
console-only gaps that cost a day.

---

## Merged, not done

**Shipped code that has not finished shipping.** A merge is rung 1 of 5 — see
`CLAUDE.md` → "Merged is not done." Nothing here is *next*; all of it is
**owed**, and mixing the two lists is what let these sit.

- **Tell rebbeim on old offline copies to re-download** (#244). A `file://`
  copy has no update path, and the #252 update check cannot reach a file
  downloaded before the check existed. **Only a person can do this**, and it is
  the one item on this page with real classroom data at risk.
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

---

## Unfinished, and nothing was tracking it

Found by the 2026-08-20 worktree audit. **These are not stale — they are
built work that never landed**, invisible to every list until now. Verify each
with the `branch-merge-audit` skill before concluding either way.

- ✅ **Seating tables — RECOVERED, REBASED AND PROPOSED 2026-08-20, now PR #364.**
  It was 749 uncommitted lines with no commit, no branch and no remote copy —
  one `rm` from gone, since its proposal PR #337 had already merged. Recovered
  as `8159f8f` on `docs/seating-tables-proposal` (left there as a recovery
  point), then rebased 93 commits onto `main` as `feat/seating-tables`.
  Harness re-run in a browser on the rebased tree: **371 passed, 0 failed**,
  all 9 `tables→` tests green. **One judgment call to confirm by eye:**
  multi-band print landed on `main` after this feature was written, so neither
  side of the `app.html` conflict spoke to it — the tables toolbar is gated to
  one per sheet rather than one per band. **Still owed: a real browser pass on
  the feature's interaction**, which is why it is still a draft.
- **`feat/board-fab`** — removes the redundant "Close board" pill on a solo
  box. `main` still shows it twice.
- **`fix/seats-fullscreen-topbar`** — shrink-to-fit grid so full-screen seating
  rows are not cut off. Not on `main`.
- **`fix/theory-audit-batch-1`** — removes Backup's "Send standings now"
  button. Still on `main`. **This is a tab-audit item counted as closed.**
- **`steinerman/chazaroom`** — 4 commits of Chazaroom PTZ work, including "the
  PTZ tick now tells the truth, continuously." This is what #240 actually
  contains.
- **81 of 92 worktrees are dead** and safe to clear (landed, unlocked, clean).
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

---

## Waiting on Ben

Roughly in the order of what they unblock. Nothing here is a task Claude can take.

1. **The re-download message** (#244) — see "Merged, not done." Most urgent
   thing on this page.
2. **The privacy note** — `docs/Account_Privacy_Note.md`. Drafted; all six
   blanks decided 2026-08-13 and filled in. Owed: a read-through of the prose
   and the three flagged judgment calls, nothing else. **The earliest gate in
   the whole sign-in plan** — it blocks self-serve signup in *either* tier,
   including Ben's own school. `privacy@menchmark.app` is live and tested.
3. **A yes on the offline resync proposal** before the dedup-fix PR is built.
4. **Q3: what a school signs.** Gates onboarding school #2; blocks no code.
5. **Commit or discard the 749 uncommitted seating-tables lines**, and a yes on
   clearing the 81 dead worktrees. Both are stop-and-ask by policy.

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

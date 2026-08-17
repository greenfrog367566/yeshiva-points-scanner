# NOW

The current working queue. Read this at the start of a session.

**Keep it short.** This is what is happening now, not a history. When something ships, delete it from here — `CHANGELOG.md` is the record. When something is decided but not next, it belongs in an issue or a spec in `docs/`, not here.

---

## Doing now

**Shipped and verified live 2026-08-09/10:** **#244** — the downloaded offline copy was destroying a rebbi's work on every reopen (found by reproduction, not by reading); **#248** — Gradebook attendance cells are now editable, which is slice 1 of #227; **#242** and **#247** — two-tier custody and universal sign-in recorded as accepted; **#243** — the Drive OAuth spike. See `CHANGELOG.md` for what each did.

**#244 is why the first item under "Waiting on Ben" is the most urgent thing on this page.** The fix is in the repo and it cannot reach a copy already sitting on a rebbi's machine — a `file://` copy has no update path at all. Someone has to tell those rebbeim to re-download.

**Open drafts:** **#249** (offline capability probe + automatic folder backup) needs one run on a managed Chromebook before anything relies on it — and it **moved up the queue on 2026-08-12**: the folder backup is now build-order step **0c**, shipping *before* the cutover rather than after the rebuild, because it depends on nothing and shipping it late leaves a window with no automatic backup at all once Sheets retires. Two findings from it worth not re-deriving: `showDirectoryPicker` **does** work on `file://` and the folder permission survives a reopen with no prompt — that reversed the prediction going in, and is the only reason the folder backup exists at all — and the backup nudge has no network dependency, so it already works offline. **#250** (fetch & generate whole chapters) is in flight from another session. **#240** (hadroom camera diagnostic) predates this queue and is conflicting.

**The Firebase/Firestore rebuild's full design phase is DONE (2026-08-14).** All 8 build-order steps (0 through 7) now have an approved, locked design — `docs/Firebase_Rebuild_Scope.md`'s "Open questions for step 1" list is fully resolved, and each subsequent step has its own design doc: `Firebase_DataModel_Design_Proposal.md` (1), `Firebase_Step2_Auth_Rules_Design_Proposal.md` (2), `Firebase_Step3_Converter_Tool_Design_Proposal.md` (3), `Firebase_Step3b_Existing_Cohort_Upload_Design_Proposal.md` (3b — the sign-in gate), `Firebase_Step4_Routing_Design_Proposal.md` (4), `Firebase_Step5_Superadmin_Tools_Design_Proposal.md` (5), `Firebase_Step6_Admin_Gradebook_View_Design_Proposal.md` (6), `Firebase_Step7_Fragile_Storage_Warning_Design_Proposal.md` (7).

**Implementation started 2026-08-16, once Ben created the real `menchmark-backend` Firebase/GCP project.**

**Steps 2, 3, and the sign-in UI are MERGED to `main`** (PR #290, `feat/firebase-step2-auth-rules`) — the backend is real, not draft, from here on: `firestore.rules`' full tier-gating matrix; three Cloud Functions (`redeemCode`, `provisionRebbi`, `viewAs`) as the only writers of `accounts`/`codes.usedBy`; `provisionRebbi`'s `admin-invite`/`roster`/`backup` mode dispatch (admin-driven or self-serve) with a chunked-write-plus-verification-receipt engine; the Firebase SDK vendored for real (`vendor/firebase/`); a superadmin converter UI (`tools/admin-convert.html`); and the full SDK-free-until-tier-1 sign-in flow in `app.html` itself (OAuth redirect, code entry, same-device adoption offer, self-serve roster). `firestore.rules.test.js` (31/31), `provisionRebbi.test.js` (8/8), and `httpCallable.test.js` (5/5) all passing in CI.

**Step 4** (routing/back-button + tier guard), built and in review — PR #292, draft, CI green: all 5 PRs of its own incremental sequence, **including the tier-aware route guard**, which shipped without waiting on step 2's merge — it doesn't need a real signed-in session to be correct, only to ever reach its tier-1 branch. Real hash-based routing, working Back/Forward, deep links, a fail-closed `view-routeError` screen for a bad/unknown classId, and every user-clickable tab-jump routed through `router.go()`. **Not yet merged** — `main` currently has PR1/PR2/PR3/PR5's router code (it reached main independently, ahead of PR4) but not the tier guard itself; that only exists on `feat/step4-router-pr1` until #292 merges.

**Steps 5 and 6, both built together on this branch — `feat/step5-superadmin-tools`, since step 6 turned out to need the one thing step 5 was missing.**

**Step 5** (superadmin tools): a new standalone `admin.html` (server-gated on every call, never by the page itself). Activity overview reads a new `activitySummary` collection (populated by two new Firestore triggers plus `redeemCode`'s existing unconditional-on-every-sign-in call, extended with a `stampSignIn()` stamp — no new client call needed). View-as is wired end to end — mint, `sessionStorage` handoff (not a query string, since step 4's router only ever parses the hash), a second isolated `initializeApp(config,"viewAs")` instance in the opened tab, a persistent "Viewing as…" banner, Exit closes the tab. Email export is one server-side CSV function. A new `auditLog` collection (kept separate from step 2's `viewAsLog` rather than touching already-shipped code) covers activity loads, exports, and — logged even when the UI never renders — failed authorization attempts.

**Step 6** (admin's Class Book): building it surfaced that **no step had ever built a way to read a class's real Firestore content into `app.html` at all** — flagged as a known limitation when step 5 was first built, closed here. `fetchClassFromFirestore()` reads a class + students/trackedItems/trackedEntries and reshapes them into the exact shapes the rebbi's own Gradebook already trusts; a new `#/admin/classes/{classId}/book` route (outside step 4's `#/c/...` grammar, its own small router addition) reuses the **real Gradebook rendering code** (`gbBuildTable()` etc. — confirmed fully parameterized before reusing, not assumed) rather than a second implementation. `trackedItems.book: 'class'|'teacher'` (set via the same name-match predicates `trackedActIdsStamped` already uses) plus updated `firestore.rules` (`itemVisible()`) gate what an admin can see; a per-column `🔓 shared` badge marks anything visible only via the whole-book `sharedWithAdmin` override. **This also retroactively completes step 5's own view-as** — `viewAsBootFromHandoff()` now lands the opened tab straight on the target's real Class Book instead of a banner over nothing. **Deliberately minimal entry point:** no "Schools" browsing list yet (a real second UI surface the design doc calls for) — a plain classId-entry field stands in, fully gated and functional, just not browsable. **Still out of scope on purpose:** the rebbi-facing tabs (Scan, Standings, Rewards…) still assume local `data` throughout the file — view-as shows the real Class Book, not the full app the way the rebbi sees it.

**Test suites written but not run locally, both steps** — this machine has no Java runtime (the Firestore/Auth emulators need one); CI's `ubuntu-latest` job runs them for real, same as every prior emulator-based suite in this rebuild.

**Nothing deployed to the live project yet** (`firebase deploy` needs Ben's `firebase login`) — PR #292 (step 4) and this step-5 branch's own draft PR are both still open/draft.

Its phase mapping was reconciled against the code on 2026-08-04. Two things were locked in that pass: **2d runs before step 1**, and Secretary Mode folds into the rebuild. Per-phase status for everything else lives in `Menchmark_Phased_Build_Plan.md`, which is the authority on what has shipped.

---

## Next, in order

**0. The existing-cohort upload path — custody (#218) AND universal sign-in are both decided, and this is the gate they now sit behind.**

**Ben took the split on 2026-08-09:** custody follows institutional relationship. Tier 1 (schools with a real relationship, starting with his own) gets the Firebase rebuild as scoped; tier 2 (an independent rebbi) stays local — localStorage as today, plus a backup to **his own** Google Drive. The deciding argument was sequencing, not liability: step 1 has to replace whole-blob `save()` with incremental writes anyway, so the seam is being cut regardless, and the split only decides whether it has one implementation behind it or two. **The fallback stays open** — if two implementations prove too costly, tier 2 promotes into a gated single backend ("the middle tier") via the tier-migration path that already exists. Don't re-litigate the split; read `docs/Data_Custody_Decision.md` §1, which records the reasoning *and* the risks accepted knowingly.

**Q1/Q2/Q4/Q5 are adopted as recommended; Q3 is still on Ben** (what a school has to sign — see "Not code, still owed"). The rebuild scope is amended to match: the split is its first locked decision, Path B is reframed (self-serve defaults to tier 2, a school code promotes to tier 1), and open question 1 is narrowed to a clear recommendation.

**The spike is DONE (PR #243, merged 2026-08-10) and it answered its question.** The whole Drive API surface worked first time with no SDK and no external script — folder, 509-byte write in ~1.1s, read-back, in-place update, and a 3599s token. Silent re-auth **works**, invisibly, and recovers from a real 401 — but **only when the app sends a `login_hint`**. Without it, `prompt=none` fails on any browser holding more than one Google account, which is the normal case and which cost an hour of wrong conclusions before it was found. The 60-minute token cannot be lengthened (a refresh token needs a client secret, and Google uniquely won't accept PKCE instead) and no longer needs to be. Still owed there: **one run on a shared/logged-out Chromebook.** The hardcoded client ID is dealt with (2026-08-12) — the spike now takes it from a box in step 1 and remembers it in `localStorage`, which is what the redirect flow needed and why it was hardcoded to begin with.

**Also decided 2026-08-09: universal sign-in** (`docs/Universal_SignIn_Proposal.md`, ACCEPTED). Ben's read of the tier-2 story was that it looked "half baked and not professional" — correct, and the audit located the fault precisely: the Drive-JSON storage pattern is fine (it is WhatsApp's chat-backup architecture, and local-first is mainstream), but **tier 2 had been sketched anonymous**, and no comparable product ships browser-profile-as-account. So **every rebbi signs in, both tiers, same Google button; the tier decides only where class data lives.** Firestore holds an account row for a tier-2 rebbi — email, name, tier — and no student records ever. Custody is unchanged. It costs nothing architecturally (the spike already proved no-SDK sign-in; Firestore's REST API takes plain `fetch`) and it solves the `login_hint` requirement structurally, since the account *is* the hint.

**Carried into `Firebase_Rebuild_Scope.md` and `Data_Custody_Decision.md`** — identity-is-universal in the custody and tiers sections, the converter ungated for own-account restore, OQ11's sub-question 4 shrunk to a field flip, build order step 3b.

**The existing-cohort upload path is now DESIGNED and locked (build order step 3b, approved 2026-08-14) — `docs/Firebase_Step3b_Existing_Cohort_Upload_Design_Proposal.md`.** Ben's condition on accepting sign-in — *"make sure to include a data upload for current beta rebbeim."* The beta cohort onboarded on v0.9.0 (2026-07-18) and has real classes in `localStorage` **today**, so sign-in shipping first would mean a rebbi signs in and his class isn't there. **No beta rebbi is asked to sign in until this is BUILT** (design alone doesn't satisfy the gate). Three routes, all collapsing into one payload-sourcing pattern in front of step 3's converter Cloud Function: same-device adoption (the common case — detect the local class, one tap to claim it, no file), self-serve backup upload, and Drive restore. The original spec is `Universal_SignIn_Proposal.md` §10; its safety properties are carried forward into the locked design, each a lesson already paid for (the #244 seed-guard shape especially — never silently overwrite a class already in the account).

**The earliest gate of all, and its six answers are now DECIDED:** a plain-language privacy note for the account record itself. Smaller than Q3's school agreement, but it comes first — it is needed before *any* self-serve signup in *either* tier, including his own school. **Drafted 2026-08-12 — `docs/Account_Privacy_Note.md` — and Ben answered all six blanks 2026-08-13** (recorded with rationale in the note's Part 2, section A): `privacy@menchmark.app` / 30 days / an entity will be formed before launch / **view-as is logged server-side AND shown in the rebbi's settings** (now a build requirement for the Firebase rebuild's step 1) / 72 hours breach notification (Q3's agreement must reuse this number) / Firestore region `nam5`. Part 1 has no placeholders left except the publication date. **Remaining before it can ship:** Ben's read-through of the prose and the three flagged judgment calls — nothing else. `privacy@menchmark.app` is live and delivery-tested (Cloudflare Email Routing → Ben's Gmail, 2026-08-13).

**1. The app update check — fully designed, not started, blocked on one call.**

A `version.json` served next to the app plus an `APP_VERSION` constant in it, and **two different banners, because the two copies fail differently**: the PWA can reload itself, the downloaded `file://` copy can only be told to download a fresh one. **Built — PR #252, open as a draft.** The CORS route is settled (`_headers`, scoped to that one path); the one thing that cannot be checked before merging is whether the header actually comes back off the live site, so run the `curl` in that PR once it lands.

⚠️ **It cannot reach a copy downloaded before it ships.** That file contains no checking code and never will. This makes every *future* stale copy self-announcing — it does nothing for the ones already on rebbeim's machines. An earlier version of this line claimed the opposite and it was wrong; the re-download message below is still the only thing that reaches them.

**2. Finish Phase 2c: the remaining Gradebook writers, then drop the four old tabs (#227)** — the biggest build item left.

**Slice 1 shipped (#248): attendance cells are editable.** Three slices left, and it is **one PR per tab**, because the four legacy setters differ in what they can even record: **only `setAttendance()` takes a date.** `setHw()` writes to a global, `setPass()` keeps no per-use history, and `trackerLogAdd()` stamps `now`. **Homework is next, and it is the cheap one** — one optional `dateKey` parameter on `setHw()`, then it reuses everything slice 1 established. **Passes may not be correctable at all** without first giving that store real history, which is a bigger question than a column.

**Removing a tab is much bigger than adding its column**, and that is the trap in this item. The Attendance tab especially: the Sheet push, the seating-chart badges and "Mark the rest Present" all read that store directly, and every one of them has to move first or it fails silently. When a tab finally does go, delete its `TRACKED_LEGACY` row, its badge-table row **and** that store's `mirrorTracked()` call together.

**3. Offline resync — investigation DONE, proposal written, waiting on Ben.** `docs/Offline_Resync_Proposal.md`. The asymmetry is wider than "Log vs. Attendance Log": Pesukim Log, Tracker Log and Homework Log have **no recovery path at all** today — a failed push there is permanently lost, no error ever shown. Attendance Log has a second bug stacked on "no dedup": `_sentAt` gets stamped even when the push failed, so the normal resend path never retries it (only the manual, duplicate-warned `resendAttendanceDay()` escape hatch does). **Recommendation: ship the dedup fix (extend Log's id-based dedup to the three unprotected tabs, fix the five id-less Log call sites, fix Attendance's premature `_sentAt` stamp) as a normal EXECUTE-FREELY PR — additive, no migration.** Hold the actual automatic-retry-on-reconnect piece for a separate call: it's real scope, and it's also the exact thing the Firestore rebuild's deterministic write ids make unnecessary, so there's a legitimate case for folding it into step 1 instead of building it twice.

**4. Warning flash, and the sticky raffle removal**
What is left of the old "small standalone features" item once Freeze and the raffle note shipped. **Not the behavior ladder** — no marks store, no rung counting, no reset periods. Those stay in `docs/Behavior_Ladder_Spec.md`.
- Warning flash: reuses the minus flash, **records nothing**. A recorded warning implies a count, a count implies rungs, and rungs are the ladder. Verified not started — nothing in `app.html` matches.
- The raffle removal *note* shipped (`renderRaffleAdjustNote()`, "N students removed … from past wins"). What did **not** ship is the question it was filed with: report how a removal could clear itself after the next draw rather than staying sticky. Still open, still a report before a change.
- **Double-scan detection** (adopted 2026-08-14 from the external UI review — `Menchmark_UI_Redesign_Summary.md` §12): a soft inline "scanned a moment ago — again?" nudge when the same student is scanned twice within ~2 seconds. Never a modal, records nothing, blocks nothing — the second scan still lands unless the rebbi undoes it. Not started.

---

## Waiting on Ben

Roughly in the order of what they unblock. Nothing below is a task Claude can take.

1. **Tell rebbeim holding an old offline copy to re-download** (#244). The only item on this page with real data at risk, and **nothing in code can ever substitute for it** — the update check in #252 cannot reach a file that was downloaded before the check existed. This one is a message from a person or it does not happen.
2. **The privacy note for the account record** (item 0 above) — **drafted, `docs/Account_Privacy_Note.md`, six answers DECIDED 2026-08-13 and filled in.** Still on Ben: a read-through of the prose and the three flagged judgment calls — nothing else; `privacy@menchmark.app` is already live and delivery-tested. The earliest gate in the whole sign-in plan: it blocks any self-serve signup in *either* tier, including Ben's own school. **With the six decisions below taken, this is now the only thing gating the sign-in work.**
3. **Q3: what a school signs** (detail below). Gates onboarding school #2; blocks no code.
4. **A yes on the offline resync proposal** (item 3 above, `docs/Offline_Resync_Proposal.md`) before the dedup-fix PR gets built.

✅ **Cleared 2026-08-12 — six decisions taken, don't re-ask.** All recorded in
`Firebase_Rebuild_Scope.md` and `CLAUDE.md`:
1. **The rule-3 / Firebase SDK call.** Vendor the SDK as a **separate
   same-origin file, tier 1 only, precached in `sw.js`** — `app.html` stays one
   file, no build step, offline holds for both tiers, tier 2 never loads it.
   Rule 3 amended inline, scoped to the SDK and nothing else. **This was the
   last gate on rebuild step 1, and step 1 is now unblocked.**
2. **Deterministic write IDs** — locked. Client-generated `device+ts+seq`,
   written with `set()` not `add()`. Retries idempotent by construction; the
   Log-vs-Attendance-Log dedup asymmetry dissolves.
3. **Photos stay inline; Firebase Storage is out of scope** — locked.
4. **CORS for the update check: `_headers`** — which is how #252 was already
   built, so this was a confirmation rather than a change.
5. **The File System Access folder backup is pulled forward** to *before* the
   cutover (new build-order step 0c). It depends on nothing, and shipping it
   late would leave a window with no automatic backup at all.
6. **The Drive spike's hardcoded client ID is gone** — it now comes from a box
   and is remembered in `localStorage`, which survives the redirect the
   silent-re-auth test depends on.

---

## Not code, still owed

- **What a school has to agree to, to become tier 1** (#218 Q3). The last open question from the custody decision, and the only one that stayed on Ben by design — it's a liability and relationship question, not an architecture one. Nothing in code is blocked on it, but **it gates onboarding school #2**: school #1 is Ben's own, where the relationship exists by virtue of him being staff. Something short in writing before any outside school's data lands in Firestore — data ownership, deletion on request, breach notification, who to contact.
- **Physical workflow write-up.** Where codes actually live in a room: Avery labels on index cards, one per boy, boys take them out at the start; rebbi holds a clipboard with the seating chart and activity codes; arm an activity then scan the boy; homework code on the folder. A beta rebbi asked and nothing in the app or docs answers it.
- **Onboarding video: using it in a class** — the most-asked one (four of eight beta replies). `docs/Onboarding_Video_Scripts.md` calls it **Video B**; the beta tally called it **C**. Same video, script already written.
  **Video A shipped 2026-08-05** — setup from scratch *plus* the whole Record group, wider than the script's last two beats. Not linked anywhere yet: nothing in `quick-start.html`, `index.html`, or the app points to it, so a beta rebbi can't find it. That link is the open half of this item.
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

2a and 2b shipped. **2c's data is done; its tabs are not.** Attendance converted (#138), homework resets by decision, and #219 answered the two that were TBD — tracker copied over in full, passes had no history to copy. **All four old tabs are still there.** Removing them was blocked on the Gradebook being read-only; **#248 broke that open for Attendance** (slice 1 of 4), so the block is now per-tab rather than total — the three stores without a writer still have their setters as the only thing feeding the mirror. Now #227 (#122 is closed). **2d shipped 2026-08-05** in two parts (#208 + the badges) — see "Doing now". The count value shape it was holding up is settled: an entry stores the step it contributed.

**2d has cleared the Firebase rebuild's step 1** (locked 2026-08-04): the data-model session was waiting on `trackedData`'s count shape so it would not be modelled against 2b's guess and then done twice. It now has a real answer to model.

**The Gradebook is UN-HIDDEN (#185, shipped 2026-08-05)** — this section said "hidden" for a day after it stopped being true, so read the date before trusting it. Both reasons it was hidden are gone: 2d gave `data.trackedData` a writer, and the mirror-gap fix means a correction on one of the old tabs reaches it too, so the grid can no longer contradict the tab a rebbi just fixed. The attendance forward-port question is settled: the backfill re-runs 2c's merge idempotently, and `data.mirrorBackfill` is the receipt.

**The Homework column starts at the ship date, and that is a non-issue — kept here so nobody re-litigates it in November.** Mirror-gap decision 2 excluded `data.hw` from the backfill, so Attendance and count items carry their history and Homework does not. That was flagged as a possible "looks broken" moment, and it isn't, for a reason not visible in the code: **the beta cohort onboarded on v0.9.0 (2026-07-18), in the summer, so no rebbi has any homework history for the backfill to have missed.** The column fills from the first day of the school year, which is also the first day anyone marks homework. Nothing to fix.

Instances for worksheets and quizzes are #120, deliberately separate from 2c so two migrations stay small.

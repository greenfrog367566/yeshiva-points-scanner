# Menchmark: the Firebase rebuild — final scope

Everything decided across this conversation, in one place. This is the document to hand a fresh design session or a build prompt. Nothing here is open unless explicitly marked open.

---

## What's changing, in one sentence

The app stops being a file that remembers things in one browser, and becomes a real multi-user product with real accounts, a real database, and real permissions — while still feeling, day to day, like the same offline-capable classroom tool it is now.

## Why (the three bugs that are really one bug)

Attendance sends that lied about succeeding. A class that couldn't move from Braun to Weinberg. Data that vanishes on a wiped Chromebook. All three are the same root cause: no real source of truth, no real identity. This rebuild makes those failures structurally impossible rather than patching them a third time. Independently validated by a rebbi who has shipped successful chazara apps: "make it real" — Firebase, Firestore, gated app, real navigation.

---

## Locked decisions

### Backend and auth

- **Firebase Auth + Firestore.** Firestore replaces localStorage-as-database.
- **Two sign-in paths, both real:**
  - **Path A, provisioned (magic link):** superadmin/admin creates the account and class ahead of time; rebbi clicks a link, he's in. For individual outreach.
  - **Path B, self-serve (Google Sign-In + beta code):** rebbi taps Sign in with Google, enters a code, provisions himself on the spot. For batches and live rooms (the YBH PD). The code IS the approval — no per-person checkbox step.
- **Offline promise, restated precisely:** one connected moment to log in per device, ever. After that, fully offline via Firestore's persistent local cache, syncing when connectivity returns. Most rebbeim can get wifi once; nobody needs it daily.
- **The old approval-Sheet automation retires** for the bulk beta invite. Berel has the full beta list; the provisioning tool gets a **bulk mode** — feed the whole list in, accounts created and codes/links sent in one pass.

### Tiers and gating

- **Three tiers: rebbi, admin, superadmin.**
  - Rebbi: sees and touches only his own class. Nothing to configure to get started.
  - Admin: sees his school's rebbeim and classes. **Can provision rebbeim himself** (as of now — revisit at scale).
  - Superadmin (Berel): everything, everywhere, plus the shared content layer.
- **Gating is enforced in Firestore security rules**, not hidden in UI. A rebbi's rules physically cannot read another class.
- **Activity overview for superadmin:** a light dashboard — who's logged in, who's active, who hasn't touched it since the invite. Distinct from "view as."
- **"View as this rebbi" (superadmin):** pull up a rebbi's real state to debug his actual problem instead of reconstructing it from an email. This is the single biggest killer of the support-email burden.

### Data model (the hard part, and why)

- **NOT one JSON blob per class.** Two independent reasons, both confirmed:
  - Firestore's 1 MiB per-document limit — a real roster with photos plus a few hundred log entries approaches it, and the failure is a hard write rejection.
  - Whole-blob sync = silent clobbering — two devices last-write-wins over each other's entire dataset. Today's per-device Sheet rows are accidentally safe; a naive port would be a regression.
- **Instead: real collections, incremental writes.** Students, log entries, tracked items, attendance as their own records. Ongoing sync sends **small incremental updates** (recent logs, recent changes) plus a **forced flush on app close**. This was Berel's own design instinct and it solves both problems above as a side effect.
- **One-time full import happens through the converter tool**, not through sync.
- **Two-device same-record edge case:** stamp writes with device id + timestamp; if the target record was more recently touched by a different device, warn and let the rebbi choose. Design already exists from the PWA sync notes — adapt, don't reinvent. Not urgent, build after the core works.
- **Students get real `firstName` / `lastName` fields.** The current single free-text name with last-word guessing breaks on anything unusual. Manual add and paste require both. Sorting and display read structured fields.
- **Roster paste handles three columns** — a Google Sheets copy of Last / First / Class pastes directly (the tab-detection is already half-built; extend it).
- **Archive, not delete:** a student who leaves mid-year is archived — off the active roster, history intact everywhere. Delete stays for genuine mistakes only, behind type-to-confirm. Un-archive restores a returning student with his history attached.
- **The Gradebook migrates faithfully — but there is less to migrate than this doc once claimed.** Phase 2a/2b shipped, so `data.trackedItems` / `data.trackedData` exist and are real stores. But **the Gradebook tab is hidden (#185) and `trackedData` has been frozen since the one-shot 2c attendance conversion** — nothing writes to it in normal use. So it is a live *store* with almost no live *data*, and the shape it will carry is a 2d output, not a settled fact. The Firestore model still carries tracked items the same way it carries scores and rosters; it just cannot be designed until 2d lands. See "Open questions for step 1".

### Who builds the roster — a real gap, now closed

The doc as first written assumed someone else always builds the roster before a rebbi ever sees the app. That's only true for **Path A**. **Path B (self-serve)** has no one pre-building anything — a rebbi authenticating himself at a live PD lands on nothing unless there's a real first-run step.

- **Path A (provisioned):** admin/superadmin builds the class through the converter tool ahead of time. Rebbi clicks a link, it's already there.
- **Path B (self-serve):** after authenticating, a **first-run setup screen** — name the class, then build the roster (manual add, or paste three columns straight from a Google Sheet).
- **One roster-entry component, two mount points.** The converter tool already needs a roster-builder UI for admin's provisioning flow. That exact component becomes the rebbi's own first-run screen for Path B — not a second, separately-built thing that can drift out of sync with the first.
- **No approval gate on a self-built roster.** A rebbi who authenticates via a valid code is trusted the same way any provisioned rebbi is — the code was the gate, not a second review step after.

### The converter tool

- **One standing tool, real interface, two input modes:**
  - Roster-only: type/paste a class, get an account + link/code. For new rebbeim.
  - Backup-upload: feed an existing tester's JSON export, seed his account with his real class exactly as it stands. Includes activities and the full history — "starter class" for an existing rebbi means his actual class.
- **Bulk mode** for the full beta list (above).
- **Doubles as the recovery path:** account breaks → re-run from a fresh backup. This is why it's a tool, not a one-time script. Superadmin-gated at minimum.
- **Old localStorage retires on conversion:** the app detects a converted device and shows a one-time "your class has moved" screen instead of quietly running a stale local copy alongside the real one. No forks.

### What retires, what it's replaced by

- **The file:// offline-copy download retires.** Firebase Auth cannot work from a file:// origin — hard incompatibility, confirmed. Replacement: **PWA install** (already live), which delivers the same offline promise through a real persistent install. The fresh-copy-banner branch was dropped for exactly this reason.
- **Sheets stops being the database. Replacement: CSV export.** A download button producing a file any rebbi opens in Sheets/Excel — keeps the "I can see my own data" trust value with zero Apps Script, zero OAuth, zero redeploy pain. A live-updating Sheet is explicitly NOT in this build; if people ask for it later, it's its own project.
- **Apps Script goes away entirely** with it — no more "redeploy and email twelve rebbeim," no version drift.

### Gradebook visibility for admin (settled — the capstone question)

- **Admin sees the Class Book by default.** Homework, attendance, recognition — real oversight without touching private notes.
- **The Teacher's Book stays private unless the rebbi explicitly shares** — a specific item or the whole book, marked shared on purpose. Same promote-to-visible confirm pattern the Gradebook design already uses for class-facing exposure, pointed at admin instead. Private notes stop being honest the moment they're watched by default; this preserves that.
- Data model carries a `sharedWithAdmin` flag per item/book; security rules enforce it, not the UI.

### Chromebook / fragile-storage warning

- On startup, check whether persistent storage was actually granted (`navigator.storage.persisted()`). If not — the managed-Chromebook case — tell the rebbi honestly: data isn't guaranteed safe here, get on wifi so it syncs, or export a backup now (the CSV export is the fallback the warning points to). A visible choice instead of a silent risk.

### The old phased Gradebook plan — where it actually fits

Phase 2 of the original 9-phase plan had four slices: 2a (tracked-item data model + migration, PR #107) and 2b (Gradebook UI, PR #115) are **shipped** — with the hidden-and-frozen caveat above.

- **2c — retiring the old standalone tabs** (Attendance/Homework/Passes/Tracker): **partially shipped, not "safe to do anytime."** The attendance conversion landed (PR #138, receipt in `data.attConversion`), but only attendance. All four stores are settled now: attendance converted, homework resets, tracker copied over by #219, passes had nothing to copy. What's left is **removing the tabs**, and that's blocked — the Gradebook can't write, and those tabs' setters are the only thing feeding `data.trackedData`. Now #227. Still independent of this rebuild, but it's a feature with a live blocker, not a free cleanup.
- **2d — armed-item scan mechanic + staleness badges** (scan-to-arm, tap-to-arm, "last:3d/never" indicators): **LOCKED — 2d is sequenced *before* rebuild step 1** (decided 2026-08-04). Two reasons, and the second is the one that moved it. First, as originally noted, it lives in the territory the rebuild restructures — real routing (step 4) touches how Record/Scan works, admin's gradebook view (step 6) decides how tracked items get read. Second, and decisively: **2d pins down the count value shape, which is still undefined.** The 2b gradebook carries a guess. Step 1 designs the Firestore collections — designing `trackedData`'s shape against a guess that 2d is about to collapse means designing it twice. 2d is a step-1 *input*, not merely an interaction-design overlap. It also un-hides the Gradebook (#185) and settles whether attendance forward-ports from the cutoff.

### The rest of the 9-phase plan — full mapping

> **Which doc is authoritative for what:** *Status* (what has shipped, partially shipped, or not started) lives in the per-phase status stamps in `Menchmark_Phased_Build_Plan.md` — update those, and only those, when a phase moves. *Sequencing and dependencies* live in the same doc's dependency map. *Rebuild scope* (what this build includes, folds in, retires, or defers) lives here. *The immediate queue* lives in `docs/NOW.md`. When these disagree, the build plan wins on status, this doc wins on rebuild scope, and the disagreement itself is a bug — file it.

**Reconciled against the code on 2026-08-04.** The previous version of this section was written from the planning docs rather than the repo, and four of its claims were wrong: Phase 5 was called unblocked, Phase 6 was called shipped, Phase 7d was called blocked, and Phase 8 was called isolated. Buckets are dated because they rot; re-verify before trusting one.

**1 · Shipped —** Phase 1 (five-R tab restructure). Phase 2a (#107) and 2b (#115), with the hidden/frozen caveat above. Phase 3's Dashboard List/Seating toggle (#195). Phase 7b's Shulchani coin cards (#197 / #201 / #203) — denomination cards and the printable Coin Guide, though **per-student coin codes were never built**. Phase 7c's Scanner Setup sheet (reference-only, no Tera barcodes reproduced). The Shulchani coin engine itself (predates Phase 4's own items). Daily-Backup PR A, the staleness nudge.

**2 · Partial / in-flight —**
- **Phase 2c** — data done; removing the tabs is left, blocked on the Gradebook being able to write (#227).
- **Phase 6a (the Library)** — **shipped as data and orphaned.** `library/index.json` plus Vayelech exist, but **nothing in `app.html` references `library/` at all** (#187). The Pesukim and Mishnayos tabs still source from the AI proxy or manual entry. This doc previously called Phase 6 "parts 1–4 shipped"; that was wrong on both counts — 6a has no loader and **6b (the Review Wizard) was never built.**

**3 · Blocked on 2d —**
- **Phase 5 (Quiz & Speed Round)** — previously called "unblocked now" on the reasoning that 2a/2b shipped. Wrong: Phase 5 stores quiz results **as Grade-type tracked items feeding Gradebook columns**, and that store is the frozen, hidden one. Its real gate is 2d, which pins the value shape Phase 5 would write into. The rest of the old claim stands — it's offline by design and touches nothing Firestore does.

**4 · Fold into the rebuild rather than build twice —**
- **2d** — now locked *ahead of* step 1 (see above). Still in this bucket for interaction design; the sequencing is what changed.
- **Phase 3's remaining interaction part** — the floating Points panel fix. (The List/Class toggle shipped outside the rebuild, so this bucket shrank to one item.)
- **Phase 7d's Secretary Mode** — **LOCKED, folded in** (decided 2026-08-04). The build plan describes it as "upload-for-others with saved rebbi roster … **the first multi-user feature**, build carefully & last." That is precisely this rebuild's territory: real accounts, tiers, and permissions. Building it first on the no-accounts model and rebuilding it on real accounts after is the exact trap the 2d reasoning exists to avoid. `Offline_NoComputer_Secretary_Spec.md` carries a banner pointing here.

**5 · Independent — build whenever, no conflict either way:**
- **Phase 3's non-interaction parts** — Trends redesign, History's contest include/exclude filter, bulk-undo. All still unbuilt. Pure display and filtering, no storage-layer dependency.
- **Phase 4** — and note it is **0 of 3**: Prize Ledger, the Auction audit-log fix, and Coin Deposit/Withdraw are all absent. This doc previously implied Phase 4 was done because the *coin engine* is. See open question 9 on the Prize Ledger.
- **Phase 7a (Print Wizard shell)** — not built; pure UI.
- **Phase 7d's Offline Mode + Batch Import parser** — **UNBLOCKED.** This doc previously said "still blocked on the real scanner timestamp test, exactly as before." That blocker cleared: the format is confirmed (`YYYY/MM/DD HH:MM:SS`, 1-sec resolution) and the build plan has said so for some time. Only the Secretary Mode slice folds into the rebuild; the parser and Offline Mode are free to build now.
- **Phase 8 (Chavrusa Mode)** — independent in *scope*, but **no longer "isolated."** Its Dashboard integration builds on Phase 3's Dashboard, parts of which this rebuild absorbs. Sequence it after the rebuild's routing work rather than treating it as orthogonal.

**6 · Decide before step 1 —** see "Open questions for step 1" below.

**Phase 6's share-back, corrected:** the deferred **share-back** is indeed what Firebase unlocks, and it stays deferred. But this doc previously filed it as "already handled, nothing new needed" — which assumed 6b existed. It doesn't. Share-back is downstream of a Review Wizard that was never built, so the dependency chain is 6a loader → 6b Wizard → share-back, and only the last link is a Firebase question.

### Do this first, before any building

**Issue #154 is now folded in (2026-08-04).** There is no separate sync-architecture doc — `docs/Sync_Architecture_Direction.md` does not exist and never did (verified: not on any branch, no commit history, nothing similar under another name). The Firebase thinking lived in two places:

- **Issue #154** — the substantive investigation: what Firestore would replace, SDK cost against the single-file/no-build constraint, the offline queue, auth and the anonymous-UID orphaning risk, whole-blob clobbering, the 1 MiB ceiling, and the cost curve at 12 / 100 / 1000 rebbeim. Its findings are now carried here: the SDK-vs-single-file tension became open question 1, whole-blob clobbering and the 1 MiB ceiling were already locked into the incremental-write model, the retry/dedup problem became open question 3, and the two-disagreeing-caches problem from its §5 became open question 5.
  - **Two of its findings were corrected on the way in.** (a) **The anonymous-UID orphaning risk is moot.** This doc previously flagged it as "not addressed anywhere in this scope" — but both locked sign-in paths (magic link, Google) use real identity, and anonymous auth appears nowhere in this design. The risk it describes cannot occur. (b) **The cost curve needs recomputing.** Its 12 / 100 / 1000-rebbeim write volumes were derived from the current 30-second whole-blob snapshot. The locked incremental-write model has a completely different write profile — many small writes rather than a few large ones. The *shape* of the concern survives (document limit bites first, then daily writes, then storage never); the numbers do not. Recompute during step 1.
  - **#154 can now be closed pointing here.**
- **`docs/NOW.md` item 2, "Offline resync"** — the narrower retry-safety question: the Log dedups by ID so re-pushing is safe, but the Attendance Log has no dedup, so a retry duplicates. That asymmetry needs a real answer in the Firestore model, since incremental writes make retries routine rather than exceptional. **Proposed answer in open question 3** — the asymmetry dissolves rather than needing per-tab handling. The narrower localStorage-era investigation is still owed as written in NOW.md.

---

### Open questions for step 1

Not features — the decisions the data-model session cannot start without, plus the ones that change what gets built. **Work this list at the top of step 1.** Two items that were on it are now locked and have moved into the body of this document: 2d is sequenced before step 1, and Secretary Mode folds into the rebuild.

**1. Single file, or split?** `CLAUDE.md` rule 3 says `app.html` stays one file with no build step. Firebase Auth + Firestore cannot honor that untouched: the modular SDK is ESM built for bundlers, so it's either a CDN `<script type="module">` (forbidden, and breaks the offline promise) or a vendored compat bundle inlined the way the QR library already is — a few hundred KB onto a file that is already ~1.2 MB and served network-first by `sw.js`, so every deploy re-downloads all of it.

  **Two things this decision is NOT about,** both of which the old Navigation section implied it was:
  - *The back button.* Real routing needs the History API — `pushState`/`popstate` or hash routing — and that works identically in one file or twenty. Step 4 costs the same either way. Only a multi-*page* app gets "native" back, and that's the worst option here: full reload per tab switch on classroom Chromebooks, shared state through storage on every navigation.
  - *Security.* Firebase API keys are public by design; they identify the project and authorize nothing. All real gating is Firestore security rules enforced server-side, which is already locked above. An attacker reads the client either way. The one genuine difference is Content-Security-Policy — separate script files allow a strict `script-src 'self'`, while a large inline script needs hashes or `'unsafe-inline'`. The app ships no CSP today, so either path is an improvement.

  **What it IS about:** deploy re-download size, merge-conflict surface on a 22,450-line file, and one-time restructuring risk — against the simplicity that made rule 3 worth having. Note that rule 3's original justification ("download one file, double-click it") **does not survive this rebuild regardless**, because Firebase Auth cannot work from a `file://` origin. What's left to protect is the no-build-step simplicity, which is achievable either way (plain local `<script src>` files need no bundler). Decide, then amend whichever document loses.

  **Correction, 2026-08-07:** the "does not survive this rebuild regardless" line above was written before the two-tier split (#218) existed, when every user was assumed to authenticate through Firebase. Under that split it's only true for **tier 1**. Tier-2 rebbeim never touch Firebase Auth, so the raw-`file://`, no-server-ever, double-click use case rule 3 protects stays fully intact for them — scope this line to tier 1 only, don't read it as retiring rule 3's justification app-wide. See `docs/Data_Custody_Decision.md`.

  **Narrowed 2026-08-07 (maintainer requirement):** tier-1 rebbeim must be able to install and use the app as an offline-capable PWA, not just a logged-in web session — the same guarantee tier 2 already has. That rules the CDN `<script type="module">` option out for a second, independent reason beyond "forbidden by rule 3": a service worker cannot reliably guarantee a cross-origin CDN script survives offline (no precache control, opaque responses, CDN outages), so a tier-1 rebbi who lost signal mid-lesson could lose the whole app, not just Firestore sync. Both remaining options — inlining the vendored bundle into `app.html` itself, or vendoring it as a same-origin file loaded only for tier 1 and precached in `sw.js` — satisfy the PWA requirement equally. The choice between *those* two now turns entirely on deploy-size cost to tier 2 (who'd re-download the inline option's bytes for nothing), not on offline capability.

**2. A "class" does not exist in the data model.** Students are `{id, name, group}` with a single top-level `className`. There is no class entity — `group` is a free-text label on each student. But the entire tier design rests on one ("a rebbi's rules physically cannot read another class"), and so does the motivating story of a class that couldn't move from Braun to Weinberg. Step 1 must design the entity **and** decide what existing `group` values become: separate classes, or subdivisions within one. This has roster, permission, and migration consequences and is currently unwritten anywhere.

**3. Deterministic write IDs — proposed, promote to locked.** Give every appendable record a client-generated deterministic id (device id + timestamp + sequence) and write it with `set()` at that path rather than `add()`. Every retry then overwrites its own prior write instead of creating a duplicate — idempotent by construction, no server-side dedup, and **the Log-vs-Attendance-Log asymmetry disappears entirely** rather than needing per-tab handling. Since incremental writes make retries routine, this wants deciding at model-design time, not after.

**4. Photos: inline, and drop Firebase Storage.** Student photos are 128px JPEG data URLs at q0.72 — roughly 4–8 KB each. Inside a per-student document that is comfortable, so they can stay exactly where they are. #154 raised Firebase Storage only because it assumed one blob per class; the collections model removes the reason. Confirm and drop Storage from scope.

**5. Cutover detection is one sentence for a hard problem.** "The app detects a converted device and shows a one-time 'your class has moved' screen" — the mechanism is unspecified. Related and entirely absent from this doc: #154's §5 point that during transition `localStorage` remains the working store while Firestore's IndexedDB cache becomes a second persistence layer, and the two can hold different versions of the same class. This is where data actually gets lost in practice. Design it explicitly.

**6. The converter tool has to become the new Phase 0 gate.** The build plan's foundational rule is that data safety gates every phase, enforced by `test-migration.html`. That harness tests `migrateData()` / `load2fix()` against localStorage and has **no Firestore analogue** — none of it applies to a Firestore write. This rebuild is the largest data migration in the project's history and currently has no verification harness at all. Step 3's converter should be scoped as *migration tool plus verification harness*, not just a tool.

**7. Step 4 is the biggest hidden scope in the build order.** "Real routing / back button" is one line between two much smaller steps, but it is a rewrite of the tab system **and** the landing zone for 2d's interaction design and Phase 3's floating-panel fix. Break it into its own sub-scope before starting it, or it will quietly become the longest step.

**8. Count value shape — the handoff from 2d.** 2d now lands first (locked). Step 1's agenda should open with *reading* what 2d settled: the count value shape, whether attendance forward-ports from the conversion cutoff, and what `data.attConversion`'s receipt makes possible. Sequencing is decided; the handoff itself still needs to happen deliberately.

**9. The Prize Ledger isn't built — decide its shape here.** Phase 4's Prize Ledger unifies Store / Auction / Raffle wins and carries the Auction audit-log fix. That is transaction-integrity data the Firestore model has to hold. Cheaper to design its collection during step 1 than to bolt it on afterward.

**10. Student View means something different now.** The build plan lists it among undesigned gaps. A student-facing screen under real accounts and three tiers is a fundamentally different design than one under a single shared localStorage — it becomes an access-control question, not just a UI. Revisit after step 2, not before.

**11. What does the signup code actually *decide*? (raised 2026-08-07, PROPOSED — not settled.)** Path B above says "rebbi taps Sign in with Google, enters a code" and treats that code as **the approval gate** — the thing that replaces a per-person checkbox. The proposal here is that the same code does a second job it is currently silent about: it decides **where the new account lands**.

  - **A beta tester gets a PIN** at account creation — he has no school in the system to attach to, so the code creates a **standalone** account (which, if the two-tier split in `Data_Custody_Decision.md` is accepted, is exactly a **tier-2** account).
  - **Everyone else is included in their school** — the code he types is his *school's* code, and it drops him inside that school's space, visible to that school's admin, from his very first sign-in (tier 1).

  One field on the signup screen, two outcomes, decided by which code was typed. **This is the concrete mechanic behind the "Path B reframing" that `Data_Custody_Decision.md` §3 lists as a consequence of the split** — that doc names the reframe ("self-serve defaults to tier 2, code promotes to tier 1") but deliberately leaves the mechanic to this document. It is written here as an open question rather than folded into Locked decisions above, because the same doc says the Path B amendment waits on Ben's yes to the split itself.

  **Why it is worth deciding at step 1 and not at step 2:** "which school does this account belong to" is a *field on the account record and a term in every security rule*, not a signup-screen detail. Deciding it late means either retrofitting a `schoolId` onto accounts that were created without one, or discovering that a rebbi who signed up standalone can never be adopted into his school without a migration.

  **What it does NOT mean:** this is a **join/scoping code typed once at account creation**, not a device-unlock PIN for a shared classroom Chromebook. A screen-lock PIN is a separate idea and is not in this build.

  **The sub-questions, each cheap to answer now and expensive later:**
  1. **One code namespace or two?** Recommend one field where the code itself carries its type (school code vs. beta PIN), so the rebbi never has to know which kind he was handed and the screen never grows a "what kind of code is this?" radio button.
  2. **Per-person PIN or per-batch code?** These pull in opposite directions and the answer probably differs by path: a **live PD room** wants one batch code readable off a projected screen (this is what Path B was written for), while an **individually-invited beta tester** wants a per-person, single-use, revocable PIN so a leaked code can't provision strangers. Supporting both is one field on a `codes` collection (`maxUses`, `usedBy`, `revoked`), not two systems.
  3. **What if a rebbi has no code at all?** Recommend: he still gets in and lands standalone — never a free-text "type your school name" box, which manufactures duplicate schools that an admin then has to merge by hand. A school claims him later (sub-question 4); he never types its name.
  4. **Adoption, the reverse direction.** A standalone rebbi whose school signs on afterwards has to become part of it. That is **Q2 in `Data_Custody_Decision.md`** (tier migration via the converter tool's backup-upload mode) viewed from the account side — same event, two halves: his *data* moves, and his *account* gets a `schoolId`. Confirm both halves are covered, don't assume the data half implies the account half.
  5. **Does the code carry a role?** An admin's account has to be created somehow too. Either the code carries the tier (school-admin code vs. school-rebbi code), or admins stay Path A / provisioned-only. Recommend the latter to start — the fewer things a typed string can grant, the better.

### File System Access API — local backup safety net

- **Not truly silent from first launch — one real permission click, then silent after that.** Browsers sandbox web apps on purpose; a site writing to disk with zero prompt ever is exactly what that sandboxing exists to prevent. The File System Access API gets close: rebbi picks a folder once, grants permission once, and after that the app writes backup files into it with no further prompts.
- **Chromium-only (Chrome, Edge) — no Safari, no Firefox.** This happens to line up exactly with the fragile-storage audience already at the center of this build: Chromebooks run Chrome. Not a generic nice-to-have, a targeted fit.
- **A third layer, not a replacement.** Firestore stays the real source of truth. CSV export stays the "I can open and read this myself" option. This becomes a quiet local safety net underneath both — a real file on the rebbi's own disk regardless of what the cloud is doing.
- **Sequencing:** after the core rebuild (steps 1–8 below), not part of it. Small, self-contained addition once accounts and sync exist.
- **Challenged by `docs/Daily_Backup_Spec.md` — and half of that challenge is already answered.** A beta rebbi pointed out that retiring Sheets removes the only *automatic* backup the app has (the 30-second snapshot push), and that the named replacement above — a CSV export button — is manual. That spec proposed two layers: a browser-universal staleness nudge, and this File System Access folder backup.
  - **The nudge shipped** (its PR A — `data.lastBackupAt` / `backupNudgeSince` are in `defaults`), so the app can now tell a rebbi he is weeks stale. That gap is closed.
  - **Still open: this section's own sequencing.** The spec argues for pulling File System Access forward to *before* the cutover, since it has no dependency on accounts or Firestore and otherwise leaves a window where the automatic Sheet snapshot is gone and nothing automatic has replaced it. Decide before step 1.

### Navigation

- **Tabs become real routable states.** Back button (browser or hardware) moves through the app instead of doing nothing or exiting. Raised independently by the chazara-app rebbi; it's what makes the app feel like an app.
- **This does *not* require splitting the file.** An earlier version of this line read "same restructuring 'not everything on one HTML' implies," which quietly assumed a multi-file app and conflicted with `CLAUDE.md` rule 3 without ever saying so. Routing needs the History API, which works identically in one file or many — see open question 1, where the single-file decision is stated properly and separated from the things that don't depend on it.

### Communications

- **Mass-email = export the list, don't build a mailer.** A superadmin screen exporting current user emails as CSV, sent through whatever Berel already uses. No sending infrastructure, no unsubscribe/deliverability burden. Revisit only if the export proves genuinely insufficient.

---

## Explicitly deferred (on purpose — do not let these creep in)

- **Shared pasuk library / share-back.** Firestore makes it natural later (a reviewed text becomes a write to a shared collection superadmin curates — the concrete version of "he makes the data for everyone"). Build ON TOP of the foundation, with its own scoping pass. Not in this build.
- **Live Google Sheets sync.** Separate project, only if asked for.
- **In-app mass mailer.** Only if the CSV export proves insufficient.
- **Class-vs-Subject multi-context model, school-wide attendance, ParentLocker** — still the school-platform tier, still later, even though this build lays its foundation.
- **No changes to scanning mechanics, activities, points logic, or the Gradebook's design** (value types, two-books split, 2c/2d as spec'd). This build carries that data and decides who sees it; it doesn't redesign it.
- **`storage-safety-net` branch:** open question whether it lands as a stopgap or gets dropped like fresh-copy-banner — same reasoning applies, decide before the rebuild starts. (Last dormant item; `story-page` deleted, `fresh-copy-banner` dropped.)
- **Phone-as-a-scanner** (Bluetooth case sled + a phone signed into the rebbi's account, running the installed PWA). Confirmed compatible with zero app changes: every scan path in `app.html` converges on `handleScannedCode()`, and the one a sled needs is keyboard-wedge input (`#scanInput`'s keydown handler plus the global key-buffer fallback) — exactly what these sleds emulate. No camera scanning exists or is needed. The sync it needs is just Firestore's normal incremental-write model; `armed` is a local, unsynced JS variable and each scan appends a new log entry rather than editing an existing one, so this barely touches the two-device same-record conflict case above. Not a rebuild step on its own — it falls out of Firestore sync. The one real gap is phone-specific, not backend-shaped: screen lock and app-backgrounding silently drop Bluetooth keystrokes in a way a stationary laptop never hits. Try the Wake Lock API in the PWA first (iOS 16.4+ Safari supports it in standalone/home-screen mode) before reaching for anything heavier.
  - ⚠️ **Two corrections, 2026-08-05 — this bullet was wrong twice, and the first one has already misled a session.**
    - **(a) `app.html` has TWO scan input paths, not one.** This bullet used to read "scanning in `app.html` is 100% Bluetooth-HID keyboard-wedge input." That is false. Alongside the keyboard-wedge path there is a fully-shipped **Web Serial** path — Settings → *"Barcode/QR Scanner — connect directly (Serial/COM)"*, `navigator.serial.requestPort()` + `serialReadLoop()` (`app.html:6524`), with a baud picker, auto-reconnect on replug, and graceful fallback where unsupported. It feeds the same `handleScannedCode()` entry point, and it reads **straight from the port**, which is the whole point of it. Be precise about the difference: the keyboard path is app-wide too — a global keydown capture (`app.html:10839`) deliberately catches wedge scans on any tab with nothing focused — but it **stands down whenever focus is in an input, textarea, select or contenteditable** (so a scan fired while the rebbi is typing in a search or name field is swallowed as typing), and it needs the browser window to hold OS keyboard focus at all. Serial has neither constraint. Documented in `docs/scanner-setup.md`, `docs/user-guide.md` §2.4 and §22.1, and `README.md`. None of this changes the phone-sled conclusion — a sled emulates HID, so the keyboard path is still the relevant one — but the sentence was written as a flat claim about the whole app, and read that way it says COM scanning does not exist. It does, and rebbeim use it.
    - **(b) Lean mode is gone.** This bullet assumed the phone would run "the installed PWA in Lean mode" and that the feature "falls out of Firestore sync + Lean mode." Lean was built (#121 / PR #150) and reverted the same day in `61aa722`; settled 2026-08-05 as not coming back. So a phone opens on the full 4-group, ~18-tab shell with no small-screen mode behind it. That is a real open UI question — tracked in **#63** (mobile scanner mode) and **#62** (mobile-friendly layout) — not something this bullet may assume away.

---

## The rebbi's experience (the actual point)

Day one, new rebbi at a PD: taps Sign in with Google, types the code from the screen, and his class is either already there (provisioned) or a two-minute paste away (roster paste, three columns, straight from a Google Sheet). No Apps Script, no deployment, no setup guide.

Day one, existing tester: clicks a link, and his actual class — scores, history, gradebook — is just there. Nothing re-entered. The old copy on his machine tells him it's moved.

Every day after: opens the installed app, works normally, wifi or not. When he's stuck, Berel looks at his actual screen state in thirty seconds instead of a week of email. When a student leaves, archive; when he returns, un-archive. When the menahel wants to see how homework is going, he can — and the rebbi's private notes stay private unless he chooses otherwise.

That's "make it real."

---

## Build order

0. **Phase 2d, first.** Locked 2026-08-04 — it pins the count value shape step 1 has to model, and un-hides the Gradebook. Not a rebuild step, but a prerequisite to one.
1. **Data model design session** — the collections, the incremental-write shape, the migration map from the current `data` object (including tracked items), `firstName`/`lastName`, archive states, the `sharedWithAdmin` flag. **This is its own real session, the biggest single step, and everything else stands on it.** Do not compress it into a prompt. **Open the session by working the "Open questions for step 1" list above** — the class entity (question 2) and the write-id model (question 3) in particular are inputs to the collection design, not follow-ups to it.
2. **Auth + tiers + security rules** — both sign-in paths, the three tiers, gating proven with no real UI yet.
3. **The converter tool** — both modes plus bulk. Prove the migration carries a real class (with gradebook data) on a throwaway account.
4. **Real routing / back button.**
5. **Superadmin tools** — view-as, the activity overview, the email export.
6. **Admin's gradebook view** — Class Book default, Teacher's Book where shared.
7. **The fragile-storage warning.**
8. **Migrate the real beta testers, last** — bulk invite, codes out, old copies retired — only after everything above has been proven on throwaway accounts.

Each step is a branch or a session. One at a time, same as always.

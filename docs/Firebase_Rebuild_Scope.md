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
- **The live Gradebook migrates faithfully.** Phase 2a/2b are shipped and in production — tracked items are live data, not a future spec. The Firestore model carries them the same way it carries scores and rosters.

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

Phase 2 of the original 9-phase plan had four slices: 2a (tracked-item data model + migration) and 2b (Gradebook UI) are **shipped, live in production** — this is the "live Gradebook data" referenced above, already accounted for in the migration.

- **2c — retiring the old standalone tabs** (Attendance/Homework/Passes/Tracker, now redundant since the Gradebook covers them): pure UI cleanup, data already unified in 2a, doesn't touch the data model. **Independent of this rebuild — safe to do anytime, before, during, or unrelated to it.**
- **2d — armed-item scan mechanic + staleness badges** (scan-to-arm, tap-to-arm, "last:3d/never" indicators): genuinely new interaction design, and it lives in the same territory the rebuild already restructures — real routing (step 4) touches how Record/Scan works, admin's gradebook view (step 6) decides how tracked items get read and interacted with. **Fold this into the rebuild's interaction design rather than building it on the old model and redoing it after.** Don't build 2d twice.

### The rest of the 9-phase plan — full mapping

**Already shipped, needs nothing from this rebuild:** Phase 1 (tab restructure into the five R's). Phase 4 (Shulchani coin engine — worth a status check on the Prize Ledger consolidation specifically, but the coin system itself is done). Phase 6 parts 1–4 (the Library, draft/partial/reviewed states, the Review Wizard).

**Fully independent — build whenever, before or after, no conflict either way:**
- **Phase 5 (Quiz & Speed Round)** — depended on Phase 2 for grade storage; 2a/2b are shipped so it's unblocked now. Fully offline by design (pre-baked distractor pools), touches nothing Firestore does.
- **Phase 7 (Print Wizard + No-Computer)** — the print-wizard piece (Avery label offsets etc.) is pure UI. The No-Computer batch-import piece is still blocked on the real scanner timestamp test, exactly as before; the rebuild changes nothing about that dependency.
- **Phase 8 (Chavrusa Mode)** — already scoped as biggest-and-isolated. Still isolated.
- **Phase 3's non-interaction parts** — Trends redesign, History's contest include/exclude filter and bulk-undo. Pure display and filtering, no storage-layer dependency.

**Fold into the rebuild rather than build twice (same logic as 2d):**
- **Phase 3's interaction parts** — the Dashboard List/Class-view toggle and the floating Points panel fix. Both live in the Record/Scan territory that the rebuild's real-routing step (step 4) restructures anyway.

**Already handled elsewhere in this doc:** Phase 6's remaining piece — the Library's deferred **share-back** — is exactly what Firebase unlocks, and it's already in the deferred section above. Nothing new needed.

### Do this first, before any building

**Fold issue #154 into this document.** There is no separate sync-architecture doc — `docs/Sync_Architecture_Direction.md` does not exist and never did (verified: not on any branch, no commit history, nothing similar under another name). The Firebase thinking lives in two places instead:

- **Issue #154** — the substantive investigation: what Firestore would replace, SDK cost against the single-file/no-build constraint, the offline queue, auth and the anonymous-UID orphaning risk, whole-blob clobbering, the 1 MiB ceiling, and the cost curve at 12 / 100 / 1000 rebbeim. Most of its findings are already reflected in this document, but it deliberately stopped short of recommending anything, so it's raw material rather than decisions. Worth reading once alongside this doc to catch anything that didn't make it across — **the anonymous-UID orphaning risk in particular is not addressed anywhere in this scope**, and it's the kind of thing that matters once real accounts exist.
- **`docs/NOW.md` item 3, "Offline resync"** — the narrower retry-safety question: the Log dedups by ID so re-pushing is safe, but the Attendance Log has no dedup, so a retry duplicates. That asymmetry needs a real answer in the Firestore model, since incremental writes make retries routine rather than exceptional.

Once both are folded in, this document is the single source for the rebuild and #154 can be closed pointing at it.

### File System Access API — local backup safety net

- **Not truly silent from first launch — one real permission click, then silent after that.** Browsers sandbox web apps on purpose; a site writing to disk with zero prompt ever is exactly what that sandboxing exists to prevent. The File System Access API gets close: rebbi picks a folder once, grants permission once, and after that the app writes backup files into it with no further prompts.
- **Chromium-only (Chrome, Edge) — no Safari, no Firefox.** This happens to line up exactly with the fragile-storage audience already at the center of this build: Chromebooks run Chrome. Not a generic nice-to-have, a targeted fit.
- **A third layer, not a replacement.** Firestore stays the real source of truth. CSV export stays the "I can open and read this myself" option. This becomes a quiet local safety net underneath both — a real file on the rebbi's own disk regardless of what the cloud is doing.
- **Sequencing:** after the core rebuild (steps 1–8 below), not part of it. Small, self-contained addition once accounts and sync exist.

### Navigation

- **Tabs become real routable states.** Back button (browser or hardware) moves through the app instead of doing nothing or exiting. Raised independently by the chazara-app rebbi; it's what makes the app feel like an app. Same restructuring "not everything on one HTML" implies — one rebuild, one more requirement.

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
- **Phone-as-a-scanner** (Bluetooth case sled + a phone signed into the rebbi's account, running the installed PWA in Lean mode). Confirmed compatible with zero app changes: scanning in `app.html` is 100% Bluetooth-HID keyboard-wedge input (`#scanInput`'s keydown handler plus the global key-buffer fallback) — exactly what these sleds emulate, no camera scanning exists or is needed. The sync it needs is just Firestore's normal incremental-write model; `armed` is a local, unsynced JS variable and each scan appends a new log entry rather than editing an existing one, so this barely touches the two-device same-record conflict case above. Not a rebuild step on its own — it falls out of Firestore sync + Lean mode. The one real gap is phone-specific, not backend-shaped: screen lock and app-backgrounding silently drop Bluetooth keystrokes in a way a stationary laptop never hits. Try the Wake Lock API in the PWA first (iOS 16.4+ Safari supports it in standalone/home-screen mode) before reaching for anything heavier.

---

## The rebbi's experience (the actual point)

Day one, new rebbi at a PD: taps Sign in with Google, types the code from the screen, and his class is either already there (provisioned) or a two-minute paste away (roster paste, three columns, straight from a Google Sheet). No Apps Script, no deployment, no setup guide.

Day one, existing tester: clicks a link, and his actual class — scores, history, gradebook — is just there. Nothing re-entered. The old copy on his machine tells him it's moved.

Every day after: opens the installed app, works normally, wifi or not. When he's stuck, Berel looks at his actual screen state in thirty seconds instead of a week of email. When a student leaves, archive; when he returns, un-archive. When the menahel wants to see how homework is going, he can — and the rebbi's private notes stay private unless he chooses otherwise.

That's "make it real."

---

## Build order

1. **Data model design session** — the collections, the incremental-write shape, the migration map from the current `data` object (including tracked items), `firstName`/`lastName`, archive states, the `sharedWithAdmin` flag. **This is its own real session, the biggest single step, and everything else stands on it.** Do not compress it into a prompt.
2. **Auth + tiers + security rules** — both sign-in paths, the three tiers, gating proven with no real UI yet.
3. **The converter tool** — both modes plus bulk. Prove the migration carries a real class (with gradebook data) on a throwaway account.
4. **Real routing / back button.**
5. **Superadmin tools** — view-as, the activity overview, the email export.
6. **Admin's gradebook view** — Class Book default, Teacher's Book where shared.
7. **The fragile-storage warning.**
8. **Migrate the real beta testers, last** — bulk invite, codes out, old copies retired — only after everything above has been proven on throwaway accounts.

Each step is a branch or a session. One at a time, same as always.

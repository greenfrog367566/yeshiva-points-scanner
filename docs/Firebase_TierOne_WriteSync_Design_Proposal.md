# Firebase Rebuild — Tier-1 Write-Sync Design (Proposal)

## Status

**🟡 PROPOSED 2026-08-21.** Not one of the original 8 build-order steps —
it's a gap step 7 found and explicitly punted on: *"tier-1's suppression
branch … needs a live Firestore write-sync path from a rebbi's own scans that
doesn't exist anywhere yet — building that is out of scope here."*
`docs/NOW.md` carries it under "Merged, not done" as the biggest item on that
list. This doc is the design step that item is waiting on, written the same
way steps 1–7 were: a recommendation plus the open questions only Ben can
close.

**Do not build from this doc until it has a yes.** Two questions below
(scope fork, REST-vs-SDK) change the shape of the work enough that starting
early risks a rebuild of the rebuild.

## Confirmed before writing this

Checked with two other sessions working in this repo concurrently
(`google sign-on flow`, `Menchmark updates for rebbeim`) — neither is
touching the write path; both independently confirmed the finding below by
their own grep. No collision, no duplicate work in flight.

**`app.html` has exactly one Firestore function that touches the network:
`fetchClassFromFirestore()` (line ~7397), a read, called once, for admin's
Class Book and superadmin's view-as.** Every scan, every point, every
Gradebook entry a rebbi produces still lands only in `localStorage`, exactly
as before the rebuild. The only data that has ever reached Firestore is the
one-time snapshot the converter tool pushes at import/provisioning time
(`functions/classWriter.js`) — nothing keeps it current after that.

## What already exists to build on

More than NOW.md's one-line summary suggests — the gap is narrower than "no
Firestore write code exists anywhere":

- **`firestore.rules` already permits every write this needs.** `students`,
  `trackedItems`, `trackedEntries`, `activities`, `log` and `prizeLedger`
  under `classes/{classId}` all have `allow write: if isOwner(...) ||
  isSuperadmin()` (or `canWriteClassContent`) already live in production.
  Step 2 is done; there is no rules work here, only client code that uses
  the permission that's already granted.
- **`classId` is deterministic and already derivable:** `${uid}_1`
  (`nextAvailableClassId()`, `functions/index.js`). No account-side pointer
  to look up, no new field on `accounts/{uid}`.
- **The write-id shape is already locked and already has a reference
  implementation.** `Firebase_Rebuild_Scope.md`'s "Write identity" decision
  (device id + timestamp + sequence, `set()` never `add()`) is exactly what
  `classWriter.js` already does for two of the four collections this needs:
  `log` docs id as `${sid}_${ts}`, `trackedEntries` docs id as
  `${itemId}_${studentId}_${ts}`. A live sync path should reuse these exact
  id shapes, not invent new ones — a rebbi whose class gets re-provisioned
  or re-converted must not duplicate rows that live sync already wrote.
- **The Firestore SDK is already vendored, loaded, and initialized for tier
  1** (`loadFirebaseSdk()`, step 5) — it's currently only used for
  `signInWithCredential`/`signInWithCustomToken`. Nothing today calls
  `firebase.firestore()` to read or write a document; every existing
  Firestore call in `app.html` is a hand-rolled `fetch()` against the REST
  API instead (`firestoreGetAccount`, `firestoreListCollection`,
  `fetchClassFromFirestore`). See open question 2 — this matters more than
  it looks.

## The scope fork (open question 1 — decide this first)

`fetchClassFromFirestore()` only ever reshaped `classes/{id}` plus
`students` / `trackedItems` / `trackedEntries`. There is **no `activities`,
no `log`, no `prizeLedger`, no raffle/reward history, no settings** in what
it reads back — confirmed independently by the `google sign-on flow`
session, which sources new-device restore from the Drive backup (a full
161-key `data` blob) specifically *because* Firestore today cannot
reconstitute a class on its own.

So the real question isn't "does write-sync exist" — it's **how much of
`data` is Firestore's job to mirror, ever:**

- **Option A — narrow, matches what's already designed.** Firestore stays
  roster + scores + tracked entries + (once built) the Prize Ledger — the
  four collections step 1 actually specified shapes for
  (`Firebase_DataModel_Design_Proposal.md` explicitly lists
  "prizeLedger, seating, and Settings" as out of scope for exactly this
  reason). Drive backup remains the full-fidelity copy. This is the
  **minimum that makes the rebuild's headline promise true**: admin's Class
  Book and superadmin's view-as already only read these four collections,
  so this is also the *only* scope that actually pays off existing shipped
  code.
- **Option B — full parity.** Firestore eventually mirrors everything Drive
  backup carries (raffle/auction/store history beyond the ledger, seating,
  settings). Bigger, re-opens the "not one JSON blob per class" collection
  design for every field `classWriter.js`'s own comment flags as
  deliberately unmapped, and duplicates work Drive backup already does for
  tier 1 today (the fragile-storage warning already treats a tier-1 Drive
  backup as sufficient).

**Recommendation: Option A.** It's smaller, it's what step 1 already
designed collection shapes for, and it's what makes the two already-shipped
read features (Class Book, view-as) actually show live data instead of a
snapshot frozen at signup. Nothing about Option A blocks Option B later —
new collections are additive, same as everywhere else in this app's data
model.

## Recommended design (Option A scope)

### Hook points — semantic setters, not `save()`

`save()` (`app.html:6106`) fires on every mutation and writes the *whole*
localStorage blob — it's the wrong hook for Firestore, which needs
*collection-aware* incremental writes, not a blob diff. The right hook
points are the setters that already know exactly what changed and where it
belongs:

- **`applyScore()`** (`app.html:14645`) — the single choke point for every
  point-affecting scan. Already calls `addLogEntry()` and `save()`, and
  already has a parallel-system precedent: `pushToSheet({type:"scan", ...})`
  fires from right here when `data.autoSheet` is on. A Firestore push is the
  same shape of side-effect, gated on tier 1 instead of `data.autoSheet`:
  write `classes/{classId}/log/{sid}_{ts}` (matching `classWriter.js`'s id
  shape exactly) and update `classes/{classId}/students/{sid}.score` via
  `FieldValue.increment(delta)` — atomic, offline-safe, no read-modify-write
  race between two devices scoring the same student.
- **`mirrorTracked()`** (`app.html:5720`) — already the single place every
  legacy setter (`setAttendance`, `setHw`, `markHwCheckedToday`, `setPass`,
  `trackerLogAdd`) funnels through, and it already returns `{added, entry}`
  with its own dedup key computed. A Firestore push belongs right where
  `added===true` — write `trackedEntries/{itemId}_{studentId}_{ts}`, the
  same id shape `classWriter.js` already uses. `unmirrorTracked()` gets the
  matching delete.
- **Activity / tracked-item CRUD** (add/edit/delete an activity or tracked
  item) — low-frequency, sync straightforwardly at the point of edit; no
  debouncing needed at this volume.

This deliberately does not touch `save()` itself. A rebbi's settings,
`navHidden` flags, seating layout, and everything else `save()` persists
stays localStorage-only, matching Option A's scope line exactly.

### Gate: tier 1, and only after cutover confirms

Every hook above is a no-op unless `data.firebaseClaimedBy` is set (tier 1)
**and** the one-time cutover push (`Firebase_DataModel_Design_Proposal.md`'s
"conversion is one atomic operation, not a background sync") has already
completed and verified. Firing incremental writes into a class that hasn't
finished its one-time full push yet is exactly the divergent-copies risk
that design already went out of its way to close.

### Don't repeat the Attendance Log bug

`docs/NOW.md`'s "Offline resync" item is the cautionary tale sitting right
next to this one: the Attendance Log stamps `_sentAt` even when the Sheets
push *failed*, so the normal resend logic never retries it — a silent,
permanent drop. Whatever queues or marks a Firestore write as sent must only
do so **after a confirmed successful write**, never optimistically. This is
also the strongest argument for open question 2 below.

## Open question 2 — write through the SDK client, not hand-rolled REST

Every existing Firestore call in `app.html` is `fetch()` against the REST
API with a bearer token. That was a reasonable shortcut for a handful of
one-shot reads. It is the wrong foundation for an *ongoing* write path,
because the vendored SDK — already loaded for every tier-1 session — gives
this away for free:

- **Offline queueing and retry-on-reconnect**, which is precisely the
  mechanism `Firebase_Rebuild_Scope.md`'s "Backend and auth" section already
  promised ("fully offline via Firestore's persistent local cache, syncing
  when connectivity returns") but nothing has actually wired up yet.
- It directly **absorbs the automatic-retry half of the Offline Resync
  proposal** (`docs/NOW.md` item 2) — that proposal's own recommendation was
  to hold the retry-on-reconnect piece because "Firestore's deterministic
  write ids make it unnecessary, so there is a case for folding it into the
  rebuild rather than building it twice." This is that fold-in.
- No hand-rolled retry/backoff/dirty-flag bookkeeping to get wrong in the
  way the Attendance Log bug above got it wrong — the SDK's write queue
  already only marks a write "sent" once it actually lands.

**Recommendation: use `firebase.firestore().collection(...).doc(...).set()`
/ `FieldValue.increment()` for every write this design adds**, and leave the
existing REST-based reads (`fetchClassFromFirestore` etc.) exactly as they
are — migrating reads to the SDK client is separable scope, not a
prerequisite, and shouldn't ride along with this PR.

## Explicitly deferred (do not let these creep in)

- **Full `data.*` parity with the Drive backup** (raffle/auction/store
  history beyond the Prize Ledger, seating, settings) — option B above,
  not this build.
- **Two-device same-record conflicts.** Already flagged in the locked data
  model as "not urgent, build after the core works" — this design doesn't
  need to solve it either; `FieldValue.increment()` on scores sidesteps the
  worst case (lost points) even before a real conflict UI exists.
- **Real-time listeners / live multi-device view.** This is a write-sync
  path, not a live-collaboration feature. `fetchClassFromFirestore()` stays
  a pull, on the cadence it already runs at.
- **Migrating existing REST reads to the SDK client.** See open question 2.
- **Prize Ledger sync** — real, additive, same shape as everything else
  here, but gated on the Prize Ledger feature itself existing first (Phase 4
  is 0-of-3; nothing writes a ledger entry anywhere yet). Not a blocker for
  shipping log/score/trackedEntries sync first.

## Open questions for Ben

1. **The scope fork above — Option A (roster + scores + tracked entries,
   Drive stays full-fidelity) vs. Option B (eventual full parity).**
   Recommend A.
2. **Write through the vendored Firestore SDK client instead of hand-rolled
   REST.** Recommend yes — see above.
3. **Does step 8 (migrating the real beta cohort) need this whole design
   before it's safe, or is `log` + `students.score` sync (the "Recognize"
   headline feature) enough to unblock it, with `trackedEntries` following
   as a fast follow?** This doc doesn't take a position — it changes how
   step 8 is staged, not whether this design is right.
4. **Verification harness.** Every other write path in this rebuild
   (converter tool, step 3b's cohort upload) shipped with a verify pass —
   count parity, spot check, idempotence-rerun. An ongoing per-scan sync has
   no natural "verify once and done" moment the way a bulk import does.
   Worth a lighter version (e.g. a debug-only comparison of local vs.
   Firestore counts) before this reaches the beta cohort, or is trusting the
   SDK's own offline-queue guarantees enough? Flagging rather than deciding
   — this is exactly the kind of judgment call CLAUDE.md reserves for Ben.

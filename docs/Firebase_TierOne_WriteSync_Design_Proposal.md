# Firebase Rebuild — Tier-1 Write-Sync Design (Proposal)

## Status

**✅ DECIDED 2026-08-21 by Ben** on all four open questions — full parity
(not the narrow scope this doc originally recommended), the SDK client for
writes, build the complete design before step 8 (no staged MVP), and the
verification harness stays deferred. Not one of the original 8 build-order
steps — it's a gap step 7 found and explicitly punted on: *"tier-1's
suppression branch … needs a live Firestore write-sync path from a rebbi's
own scans that doesn't exist anywhere yet — building that is out of scope
here."* `docs/NOW.md` carries it under "Merged, not done."

**The full-parity decision reopens design work the narrow scope would have
skipped** — `classWriter.js`'s own comment flags seating, settings, and
raffle/auction/store history as "deliberately NOT yet covered … writing an
untested mapping for them would be worse than a clean omission." Sections
below marked **first-draft, not yet reviewed** propose shapes for those so
this doc is buildable, but they haven't had the scrutiny the original four
collections got in step 1's design-panel session — confirm before building
against them, don't treat them as equally locked.

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
  `fetchClassFromFirestore`). See "Decided: write through the SDK client"
  below — this matters more than it looks.

## Decided: full parity — what that means concretely

`fetchClassFromFirestore()` only ever reshaped `classes/{id}` plus
`students` / `trackedItems` / `trackedEntries`. There is **no `activities`,
no `log`, no `prizeLedger`, no raffle/reward history, no settings** in what
it reads back — confirmed independently by the `google sign-on flow`
session, which sources new-device restore from the Drive backup (a full
161-key `data` blob) specifically *because* Firestore today cannot
reconstitute a class on its own. **Ben's call: close that gap for real —
Firestore should mirror everything Drive backup carries, not just the four
collections step 1 originally specified shapes for.**

**"Full" means every *class-data* field, not every `localStorage` key.**
A literal mirror of all 161 top-level keys would sync things that must
never leave one device — `navHidden` one-shot seeds, dismissed-banner
flags, `_sentAt` stamps, cached UI state. Two devices fighting over which
banner the other already dismissed is a regression, not parity. The
working definition: **if a rebbi would recognize it as "my class's
information" — something an admin's Class Book or a restored backup should
show — it syncs; if it's this-browser bookkeeping, it doesn't.** This
matches the same split `classWriter.js` already draws for the four
collections it does write.

**Three new pieces beyond the original four collections, first-draft
shapes below:**

- **`classes/{classId}/state/seating`** — one doc, mirroring
  `data.seating[data.currentClass]` (`{rows, cols, seats:[...],
  tables:[...]}`, `app.html:16904`). Snapshot state, not an append-only
  log — small and bounded by roster size, so a whole-doc `set()` on every
  change is simpler and cheap enough, unlike `log`/`trackedEntries` which
  need per-entry ids.
- **`classes/{classId}/state/raffle`** — one doc, mirroring `data.raffle`
  (`{mode, entries:{}, winners:[]}`, `app.html:30887`). Same
  whole-doc-`set()` reasoning as seating.
- **`classes/{classId}/state/settings`** — one doc for class-level
  preferences an admin or a restore would need: `shulchaniMode` and its
  seeded/stamped flags, point-value config, and any other *class*
  preference (not per-device UI state — see the split above). Exact field
  list needs a pass against `defaults` the same way `classWriter.js`'s
  `classifyBook()` was built against real predicates, not guessed — flagged
  here rather than enumerated, since guessing wrong here just means a
  second migration later.
- **`classes/{classId}/prizeLedger/{deviceId_ts_seq}`** — shape already
  locked (`Firebase_Rebuild_Scope.md` open question 9), and
  `firestore.rules` already has its `allow read, write: if isOwner(...) ||
  isSuperadmin()` block live. **But nothing writes a ledger entry anywhere
  in the app yet** — Phase 4 (Prize Ledger, Store/Auction/Raffle unification)
  is 0-of-3, unbuilt. This is a real sequencing question, not a detail —
  see "Open questions for Ben" below.

**New `firestore.rules` work, unlike the narrow scope.** The `state`
subcollection above doesn't exist in the live rules file — it needs its own
`match /state/{doc}` block (`allow read: if canReadClass(...)`, `allow
write: if isOwner(...) || isSuperadmin()`, mirroring the `students` pattern
already there). This is the one place full parity costs something the
narrow scope wouldn't have: a rules change, not just client code against
permissions already granted.

## Recommended design

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
- **Seating, raffle, settings** — the three new `state/*` docs above are
  snapshot state, not append-only, so they sync at their own natural edit
  points instead of `applyScore()`/`mirrorTracked()`: seating writes wherever
  `data.seating[k]` is mutated (drag/resize/table edit), raffle at spin/draw
  and entry changes, settings wherever the underlying preference is set
  (e.g. `data.shulchaniMode=...`). Each is a whole-doc `set()`, not a diff —
  simpler than the append-only collections, and cheap at this size.

This still deliberately does not touch `save()` itself, even under full
parity — `navHidden` seeds and other this-browser-only bookkeeping never
sync, per the data-vs-device split above. Full parity means every *class*
field gets a home in Firestore; it doesn't mean every `localStorage` key
does.

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
also the strongest argument for the SDK decision below.

## Decided: write through the SDK client, not hand-rolled REST

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

**Decided: use `firebase.firestore().collection(...).doc(...).set()` /
`FieldValue.increment()` for every write this design adds**, and leave the
existing REST-based reads (`fetchClassFromFirestore` etc.) exactly as they
are — migrating reads to the SDK client is separable scope, not a
prerequisite, and shouldn't ride along with this PR.

## Decided: build the complete design before step 8 — no staged MVP

The original draft of this doc raised whether `log` + `students.score`
sync alone (the "Recognize" headline feature) could unblock step 8 early,
with the rest following as a fast follow. **Ben's call: no — build fully
first.** Step 8 (migrating the real beta cohort) waits on all of this,
including the first-draft `state/*` pieces above, not a partial slice.

**This surfaces a real sequencing tension worth flagging rather than
silently resolving:** "build fully first" and "prizeLedger sync is gated on
the Prize Ledger feature existing" (Phase 4, currently 0-of-3, unbuilt)
can't both be satisfied without either (a) building Phase 4 first — a whole
separate feature, not part of this design — or (b) reading "fully" as
"everything that has somewhere to write today," which excludes prizeLedger
until Phase 4 lands regardless of how this write-sync design is staged.
**Recommend (b)**, since Phase 4 was never in this doc's scope and gating
step 8 on an unrelated, unbuilt feature would be a scope creep this doc
didn't ask for — but this needs an explicit yes, not an assumption. See
"Open questions for Ben" below.

## Explicitly deferred (do not let these creep in)

- **Two-device same-record conflicts.** Already flagged in the locked data
  model as "not urgent, build after the core works" — this design doesn't
  need to solve it either; `FieldValue.increment()` on scores sidesteps the
  worst case (lost points) even before a real conflict UI exists.
- **Real-time listeners / live multi-device view.** This is a write-sync
  path, not a live-collaboration feature. `fetchClassFromFirestore()` stays
  a pull, on the cadence it already runs at.
- **Migrating existing REST reads to the SDK client.** Writes move to the
  SDK (decided above); reads stay REST for now — separable scope.
- **A verification harness.** Deferred per Ben — see below, not dropped.

## Open questions for Ben

1. **The Phase-4 sequencing tension above.** Does "build fully first" mean
   step 8 also waits on Prize Ledger (Phase 4, 0-of-3, unbuilt) existing as
   a feature, or does prizeLedger sync simply join this design once Phase 4
   ships on its own schedule, with step 8 gated on everything *else* here?
   Recommend the latter.
2. **The three first-draft `state/*` shapes** (seating, raffle, settings) —
   sketched above to make full parity buildable, but not run through the
   same design-panel scrutiny step 1's four collections got, and the
   settings doc's exact field list is explicitly unenumerated pending a
   pass against `defaults`. Worth a dedicated look before building, or is
   the sketch above sufficient to start from?
3. **Verification harness — deferred, per Ben's answer ("figure out
   later"), but flagging the same "before it reaches the beta cohort" line
   every other write path in this rebuild held to** (converter tool, step
   3b's cohort upload each shipped with count-parity/spot-check/idempotence
   passes). Revisit before step 8, not before build starts.

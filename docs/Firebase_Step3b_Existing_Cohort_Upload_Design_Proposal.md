# Firebase Rebuild — Step 3b Existing-Cohort Upload Path Design (Proposal)

## Status

**✅ APPROVED 2026-08-13 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 3b's design. This doc is now the reference for the same-device adoption, Drive-restore, conflict-resolution, and tier-2 custody decisions below.

## Recommended design

### Same-device adoption

**Detection** (Design C): pre-sign-in, read `localStorage["qrPointsData_v1"]` directly, run `load2fix()` in-memory to normalize — no new storage probe, no network call to build the offer. But add Design B's three-way gate before showing it: (a) local data non-trivial, (b) `data.firebaseClaimedBy !== uid` (not already adopted), (c) skip if this is plainly a second-device scenario. Without (b)/(c), the offer nags forever or fights Drive-restore for the same slot.

**Offer:** "This device has a class — {className}, {N} boys, last scan {relTime}. Add it to your account?" Accept / Not now — computed straight from the in-memory `data` object, zero round trip.

**Accept:** `provisionRebbi({mode:"backup", self:true, payload:normalizedBlob})` (= `restoreOwnClass`) — Design C's core insight: **no new mode, no new function.** This is backup-upload with the payload sourced from `localStorage` instead of a file input. Overwrite-refusal gate, atomic batch, server-side `importReceipts` verification all run unmodified. On `status:"verified"`, take Design A's lighter confirmation — one line ("24 students added") with a "see details" disclosure into the existing receipt table, not the full diff grid — because the data never left the device, so it earns less ceremony, not zero ceremony. Stamp `data.firebaseClaimedBy=uid` and `data.firebaseMigrated=runId` (Design B) — this is the field that makes gate (b) work and is the one real new surface this flow needs.

**Decline:** nothing writes; reuse the `backupNudgeSince`-style cadence (Design C) rather than inventing a dismissal-counter field — one fewer new piece of state, and it already does exactly this job for a different nudge.

### Drive restore

**Gating (Design B):** only offered when same-device adoption did *not* fire — no unclaimed local match. If both a local class and a Drive backup exist and disagree, don't silently prefer either: show both timestamps and force an explicit pick. This is the one place I'd keep Design B's extra screen over A's default-trust — a same-device class beats a Drive file by freshness/proximity, but a genuine conflict is a data-loss risk not worth resolving by convention.

**Flow (Design C):** client-side, using 0b's proven `fetch`+token surface — list the `drive.file`-scoped folder, take newest by `modifiedTime`, fetch, run through `load2fix()` (it isn't live state, so it needs the same normalization a file upload would get). Offer: "Found a backup in your Drive from Aug 9 — restore it?" Full diff-table confirmation (Design A/C agree here) since the source isn't the device in front of the rebbi.

**Accept:** identical `provisionRebbi({mode:"backup", self:true, payload})` call, Drive JSON as payload — same function, same receipt, same gate.

### Why this is one function, not three

All three flows — manual upload, same-device, Drive — are payload *sourcing* in front of one Cloud Function body and one `importReceipts` shape (Design C's central claim, which A and B both implicitly agree with by routing through `restoreOwnClass`). The only real new surfaces are: `data.firebaseClaimedBy` (from B, needed to gate re-offering), the lighter same-device confirmation UI (from A), and the conflict-pick screen for the rare both-present case (from B). Everything else — overwrite gate, atomic batch, verification harness, diff-table component — is pure reuse, mounted a third and fourth time rather than rebuilt.

## Same-device detection mechanism

Three checks, all required, computed pre-sign-in from `localStorage["qrPointsData_v1"]` run through in-memory `load2fix()`.

1. **Presence** — key exists, parses, `load2fix()` doesn't reject its shape.
2. **Non-trivial** — reject demo/sample/empty state: `data.students.length > 0` AND `data.log.length > 0` (a roster with zero scans is indistinguishable from someone who imported the sample roster and never used it — no scan, no offer). This also kills the fresh-install/sample-backup case, since `sample-backup.json` is never auto-loaded into a real `qrPointsData_v1` key — but require it anyway as a cheap belt-and-suspenders check against a rebbi who loaded the sample file deliberately to explore.
3. **Recent** — `data.log`'s most recent `ts` (or `lastBackupAt`/last-activity proxy, whichever is more recent) is within a bounded window, e.g. **30 days**. A class with real history but no scan in 4 months reads as abandoned/replaced, not "this device's active class" — better to fall through to Drive restore or manual upload than assert a stale claim.

**Gate (unchanged from the recommended design):** `data.firebaseClaimedBy !== uid` — if this device's blob was already adopted by this account (or any account), never re-offer.

**Why this avoids false positives on stale/demo data specifically:**
- Sample data fails check 2 outright (no real scan activity ever accumulates on an unopened sample).
- A genuinely stale class (rebbi switched devices months ago) fails check 3 — recency, not just existence, is required.
- A trivial/abandoned local copy (imported once, never scanned) fails check 2's log-length requirement even though `students` may be populated.

No new storage probe and no network call: all three checks read fields already in `data` after the existing `load2fix()` pass, so the offer is computed for free before sign-in UI even renders.

## Two-device conflict resolution

Device 2's local data is never discarded and never silently written. The overwrite-refusal gate already blocks a second `provisionRebbi({mode:"backup", self:true})` call from clobbering the account's existing class, so the unsafe path is structurally closed — the only question is what UI covers the gap that leaves.

**Flow:** on sign-in, device 2 runs the same in-memory `load2fix()` detection. It finds local data *and* finds (via the account doc) that this uid already has a claimed class. That's a different case from "no cloud class yet," so it never falls into the plain same-device offer. Instead: show both side by side — "Your account already has {cloudClassName}, {N} students, last scan {t1}. This device also has {localClassName}, {M} students, last scan {t2}. These look different." Two choices only, both non-destructive:

- **"Use my account's class here"** — device 2 just starts reading/writing the cloud class; local data is left untouched in `localStorage`, not deleted, not merged.
- **"Add this device's data as a separate class"** — same `provisionRebbi({mode:"backup"})` call, but writes a *new* class doc (new deterministic id) rather than overwriting the existing one. Safe by construction — same atomic-batch/receipt/idempotence machinery, just no collision.

**Why not merge:** merging two independently-scored logs (duplicate students, diverging point totals, overlapping-but-different `ts`) has no correct automatic resolution, and a wrong automatic merge is unrecoverable and invisible to a non-technical rebbi. **Why not silent discard:** discarding a real class's scan history is exactly the failure the safety properties exist to prevent. **Why not silent adopt:** would violate the overwrite gate's whole purpose. Forcing an explicit, low-jargon two-button choice — with the technical damage (overwrite) structurally impossible regardless of which button he picks — is the only option that's both safe and simple enough for the audience.

## Drive-restore flow

Drive restore is a **variant of the payload-sourcing pattern, not a third flow** — same `provisionRebbi({mode:"backup", self:true, payload})` call, same receipt, same overwrite gate. What's new is entirely pre-payload: where the JSON comes from and how much ceremony the offer earns.

**When it checks:** Post-sign-in, only after same-device adoption has resolved (fired-and-declined, or found no local match — Design B's ordering). Never on every load: query Drive once per session, gated on `data.firebaseClaimedBy !== uid` still being true (same reuse of the adoption gate — if the account's already claimed, there's nothing to offer). Uses 0b's proven surface: silent token refresh via hidden iframe with `login_hint` set from the signed-in account (the exact gap 0b flagged as solved by universal sign-in supplying the hint structurally), then list the `drive.file`-scoped folder, take newest by `modifiedTime`.

**Offer text:** "Found a backup in your Drive from {date} — restore it?" — then the *full* diff-table confirmation (Step 3's existing before/after grid), not the lighter same-device summary. The data left the device (or was never there), so it earns the ceremony same-device explicitly skips.

**Conflict case:** if same-device adoption *also* has an unclaimed local match at this point, that means the rebbi declined it — don't silently fall through to Drive. Show both timestamps side by side and force an explicit pick; don't resolve by recency convention.

**Operationally vs. same-device:** same-device reads `localStorage` directly, zero network, one-line confirm. Drive-restore is a Drive API list+fetch, runs the result through `load2fix()` (0c's insight: a fetched blob needs the same normalization a file upload gets, since it isn't live in-memory state), and gets the full diff screen. Vs. backup-upload (step 3): identical downstream — same function, same `importReceipts`, same overwrite-refusal gate — the only difference is the payload's source is a Drive `fetch` instead of a `<input type=file>` read. No new Cloud Function surface; the one new client-side piece is the Drive list-and-pick step itself.

## Tier-2 custody: what "claiming" actually writes

"Claims it" for tier 2 = an `accounts/{uid}` field write, nothing else. No `classes`/`students`/`trackedEntries` writes ever happen — there is no collection to write them into.

**The write:** a small callable (`claimDevice({uid})` — or a `mode:"claim"` branch on the same account-writing function from step 2, not `provisionRebbi`/`restoreOwnClass`, since those exist to populate a `classes` doc that tier 2 doesn't have) sets `accounts/{uid}.driveBackupEnabled = true` and stamps a `driveFolderId` once 0b's folder-create step runs. That's the entire Firestore footprint. `accounts/{uid}` stays `allow write:if false` for clients, so this one field-set is the only server-side write in the whole tier-2 flow — no batch, no atomic multi-collection commit, because there's nothing to commit atomically.

**Locally**, same stamp as tier 1 for symmetry and to gate re-offering: `data.firebaseClaimedBy = uid`. No `data.firebaseMigrated = runId` — there's no `importReceipts` doc to point at, because no import ran.

**What the screen actually does differently:** same UI shell (Design A's one-line confirmation), but "24 students added" becomes "Backups now saving to your Drive" — because nothing was added anywhere; the local blob is untouched. The Drive write itself is 0b's proven `fetch`+token surface writing the JSON blob straight to Drive, not through any Cloud Function.

**Operationally versus tier 1 on the same screen:**
- Tier 1: data now lives in Firestore, readable from any signed-in device, gated by the overwrite-refusal/verification harness, produces a receipt.
- Tier 2: data still lives only on this device. Signing in elsewhere shows nothing. What changed is durability (Drive has a copy) and `lastBackupAt`-style staleness tracking, not availability. The rebbi must be told this explicitly — "your class stays on this computer; this Chromebook now backs it up automatically" — or he'll assume tier-1 semantics from an identical-looking screen.

## What this unblocks

With 3b's same-device adoption, two-device conflict handling, Drive restore, and tier-2 claim semantics settled, step 8 (migrating the real beta testers) has an upload path that covers every shape their existing local data can take — fresh single-device rebbeim, rebbeim who've already switched devices mid-year, and tier-2 classrooms with no Firestore footprint at all — without inventing new server-side surface beyond `provisionRebbi`/`restoreOwnClass` and the one `accounts/{uid}` claim field. That closes the last open design gap step 8 was waiting on.

The gate stands unchanged: **no beta rebbi signs in until this ships.** A beta rebbi hitting universal sign-in before 3b exists would either get no path back to their existing class data or, worse, an unguarded upload with no overwrite protection — exactly the data-loss scenario this design exists to prevent.

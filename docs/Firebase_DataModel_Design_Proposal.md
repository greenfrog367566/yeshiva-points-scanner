# Firebase Rebuild — Step 1 Data Model Design (Proposal)

## Status

Draft proposal from an ultraplan design-panel session, pending Ben's review — not yet a locked decision like the rule-3/SDK items in `Firebase_Rebuild_Scope.md`.

## Recommended class entity design

**`classes/{classId}`** — id = `ownerId_seq` (Design C: deterministic, consistent with the locked write-id pattern)
```
{
  ownerId: string,          // uid (tier-1) or "local" (tier-2) — B: makes rebbi-move a field write
  schoolId: string|null,    // null = tier-2/standalone (custody split)
  name: string,             // was className
  sectionOf: classId|null,  // B: lets a class subdivide another without inventing a second entity type
  archived: boolean,
  sharedWithAdmin: boolean, // C: gradebook-sharing flag belongs on the class, not bolted on later
  lastWriteDevice: string,  // B: feeds the two-device conflict check already scoped for step 1
  createdAt, updatedAt: number
}
```

**Roster** — `classes/{classId}/students/{studentId}` (A+B: subcollection, not array — avoids the 1MiB wall, gives rules free scoping by path segment, and the converter is a dumb per-student `set()` loop). Fields: `firstName, lastName, photo, section, archived, joinedAt, archivedAt` — `section` is A's insight taken literally: **`group` never becomes a second class-like entity**, it becomes a plain subdivision field on the student, because there is zero evidence of one-rebbi/multiple-classes today and no reason to invent classification logic the converter would have to guess at.

**Migration of `group`:** always 1:1, always mechanical (A's "loop and copy, no transform" wins over B's co-occurrence heuristic) — every existing save becomes exactly one `classes` doc, `group` copies verbatim into `student.section`. Design B's ambiguous "infer class boundaries from co-occurrence" is explicitly rejected: it's a lossy judgment call in a converter that must be provably safe, and nothing in the current app needs it.

**Tracked entries** — flat subcollection, not nested under student (C, refined from A): `classes/{classId}/trackedEntries/{entryId}`, `entryId = deviceId_ts_seq` (locked pattern), doc `{itemId, studentId, value, ts, date, src}`. Flat beats per-student nesting (A's original placement) because it gives a single collection-group-free query for "all entries for item X" without composite indexes — the thing A's design conceded as a cost. `trackedItems` → `classes/{classId}/trackedItems/{itemId}`, unchanged shape.

**Storage seam** — C's adapter is adopted wholesale for the *interface*, not baked into the entity shape itself: `listStudents/upsertStudent/archiveStudent/entriesFor(classId, …)` as the only thing feature code calls, backed by a Firestore subcollection query for tier-1 and a `.filter()` over `localStorage.classes[id]` (identical field shapes) for tier-2. This is what makes the entity design above tier-agnostic on paper — same JSON shape serializes to either backend — without deciding tier-2's storage format is Firestore-shaped by accident.

**What each design contributed:** A → migration-safety discipline (loop-and-copy, no inference) and the reason `group` must NOT become a second entity. B → `sectionOf`, `lastWriteDevice`, subcollection roster, and rejecting top-level `students` with denormalized `classId`. C → `sharedWithAdmin`, deterministic `classId`, flat `trackedEntries`, and the adapter seam that makes the whole design tier-agnostic.

## Answers to the remaining open questions

### Cutover detection mechanism

**Source of truth: the account doc's `schoolId` field, not a local flag.** Every sign-in reads `accounts/{uid}.schoolId` (one cheap doc, cached in memory for the session). `null` → tier-2 behavior; set → tier-1. This is already the field the join-code mechanic (signup code mechanics, below) writes, so cutover detection is free — it's the same read the tier-gating logic needs anyway.

**The trigger is the *edge*, not the level.** Store a local shadow, `localStorage.lastKnownSchoolId` (`null` until promoted). On each load: if account doc's `schoolId` differs from the shadow *and* the shadow was `null`, that's a fresh promotion — the one-shot "your class has moved" screen fires exactly once. Any other combination (both null, both equal, already migrated) is silent.

**The conversion is one atomic operation, not a background sync.** On the promotion edge: run the converter's push-mode inline (loop-and-copy `data.students`→`classes/{id}/students`, per the locked class-entity design), using deterministic write ids so a retry after a dropped connection overwrites instead of duplicating. Only after every write confirms does the app flip a local `cutoverState:"done"` flag and switch its storage-seam adapter from the localStorage implementation to the Firestore one.

**This directly closes the #154 §5 risk** (localStorage vs. Firestore's IndexedDB cache disagreeing): during conversion, localStorage stays the *only* writable store — Firestore isn't touched incrementally, it receives one full push. There is no window where both are simultaneously live and divergent; the adapter switch happens after, not during, the write. localStorage itself is never wiped — kept read-only as a local backup, consistent with archive-not-delete.

### Converter tool scope

**Reads:** one `localStorage` blob (`data`), post-`migrateData()`/`load2fix()` so it operates on the same normalized shape the app trusts.

**Writes (Firestore, tier-1 path):**
1. One `classes/{ownerId_seq}` doc from `school`/`className`, `sharedWithAdmin:false`, `archived:false`, `sectionOf:null`.
2. `classes/{id}/students/{studentId}` — one `set()` per entry in `data.students`, splitting `name`→`firstName`/`lastName` (last-word heuristic, flagged for manual review, never silently dropped), `group`→`section` verbatim, `photo` copied as-is.
3. `classes/{id}/trackedItems/{itemId}` — one `set()` per `data.trackedItems` entry, unchanged shape.
4. `classes/{id}/trackedEntries/{deviceId_ts_seq}` — flatten `data.trackedData[itemId][studentId][]` into individual docs, `entryId` synthesized deterministically from existing `ts` (+ itemId/studentId as tiebreaker) so a re-run overwrites rather than duplicates.
5. Scores/log/activities/raffle/etc. get their own collections by the same loop-and-copy rule (out of scope to enumerate here, but same pattern: no inference, no merging).

**Verification harness (the part `test-migration.html` has no analogue for):**
- **Count parity:** `students.length`, total tracked-entry count, total log-entry count, total score sum — computed from localStorage pre-write and from a read-back Firestore query post-write. Any mismatch fails the run, nothing is marked complete.
- **Per-student spot check:** for every student, confirm `firstName+lastName` round-trips to something a human confirms still matches `name`, and `section===group`.
- **Idempotence check:** run the converter twice against the same source; second run must produce zero new documents (proves the deterministic-id/`set()` design actually prevents duplication in practice, not just on paper).
- **Manual diff report:** a rendered before/after summary (counts + sample rows) the rebbi or Ben eyeballs before the old copy is ever treated as retired — nothing about this step is fire-and-forget.

Failure mode it must never allow: partial write treated as success. All writes for one class should be verified as a batch before the run is reported "done."

### Step 4 scope breakdown

**Route shape:** hash or History-API path must carry `classId`, not just tab — `#/class/{classId}/scan` (or `?class=` query). Today's nav is tab-only because there's one implicit class; multi-class means the URL is the source of truth for "which class am I in," not a dropdown backed by in-memory state.

**Concrete sub-scopes:**

1. **Route parser/builder** — encode/decode `{classId, group, tab, subtab}` to/from the URL; replace whatever currently drives `TAB_GROUPS` state with a router that reads this on load and on `popstate`.
2. **Class switcher as navigation, not a setting** — switching classes must push a history entry (back button should undo a class switch, same as a tab switch). This is new: today there's no multi-class state to leave a trail of.
3. **Tier-aware guards at the route boundary** — a route to a `classId` the signed-in uid doesn't own must fail closed before render, not after data fetch starts (defense in depth on top of security rules, since UI state shouldn't even attempt the fetch). Tier-2 routes never carry a real `classId` from Firestore — they resolve against the local adapter instead, so the router needs to know which backend a given `classId`/`ownerId` resolves through (the storage-seam adapter from the entity design) before it queries anything.
4. **Deep-link/reload safety** — loading `#/class/{classId}/gradebook` cold must hydrate that class's data before rendering the tab, not assume `data` is already populated (today's model always has data by the time tabs exist).
5. **2d's interaction design and Phase 3's floating-panel fix land on this router** — both need to be re-anchored to "current class" rather than "the app's single dataset," so their state must key off `classId` too.

**Explicitly out of scope for step 4:** the class-switcher UI itself (picker, admin's multi-class view) — that's product surface for step 6/admin work, not routing plumbing.

### Prize Ledger collection shape

`classes/{classId}/prizeLedger/{entryId}`, `entryId = deviceId_ts_seq` (locked write-id pattern — flat subcollection, same rationale as `trackedEntries`: one collection-group-free query for "all wins for this class," no composite indexes, safe retries).

```
{
  studentId: string,
  source: "raffle" | "auction" | "store",
  prize: string,        // "What did they win?" — defaults to "Raffle prize" / item name
  cost: number|null,     // ticket spend (manual raffle) or bid (auction) or price (store); null for auto-mode raffle draws — non-destructive, no real spend to record
  ts: number,
  date: string,          // for dedup key + date-grouped display, same pattern as trackedEntries
  src: string|null,      // links back to the originating raffle draw / auction round / store purchase record, mirrors trackedEntries' undo-trace use
  deviceId: string
}
```

Why flat, not nested under student or under a `raffles`/`auctions` collection: the ledger's entire purpose is a single unified read ("show me everything this class has ever given out"), across three otherwise-unrelated features. Nesting per-student would force a collection-group query to get the class-wide view (the exact cost the class design rejected for `trackedEntries`); nesting per-source would defeat the "unified" point of the ledger entirely — you'd be back to three separate logs with a UI illusion of one.

`source` + `src` together give traceability back to the transaction that created the entry (a raffle draw, an auction round, a store purchase) without the ledger needing to *be* that transaction's system of record — it's a derived, append-only receipt, written by whichever feature completes a win, same pattern as tracked-item mirroring: the owning feature writes it, the ledger never derives it by re-scanning other collections.

No `itemId`/`value` fields (unlike `trackedEntries`) — the ledger isn't a measurement, it's a receipt, so its shape stays flat and display-oriented rather than aggregation-oriented.

### Signup code mechanics

**One `codes` collection**, one field on the signup screen — no radio button:

```
codes/{code} = { type: "school"|"beta", schoolId: string|null, maxUses, usedBy: [uid], revoked: bool }
```

**Flow at first sign-in** (after Google auth, before any class exists):
1. User optionally types a code. Validate against `codes/{code}`: unrevoked, `usedBy.length < maxUses`.
2. **`type:"school"`** → create `accounts/{uid}` with `schoolId = codes[code].schoolId`, `tier:1`. Append `uid` to `usedBy`.
3. **`type:"beta"`** or **no code typed** → create `accounts/{uid}` with `schoolId: null`, `tier:2`. (A blank code and a beta PIN land in the exact same place — never a free-text school name field, avoiding manufactured duplicate schools.)
4. **Role**: codes never carry tier beyond school/beta — admin accounts stay Path A/provisioned-only. A `type:"school"` code always yields `role:"rebbi"`.

**Wiring into the class entity design:** `accounts/{uid}.schoolId` is the same value that populates `classes/{classId}.schoolId` when that account's first `classes` doc is created (fresh class, or via the converter for an existing cohort). `ownerId` on that doc is just `uid` either way — tier only decides *where* (`schoolId` null-or-not), never the class doc's shape, so promotion later is a field flip plus a converter run, not a schema change.

**Adoption:** a standalone rebbi whose school later gets a code re-enters it → `accounts/{uid}.schoolId` flips from `null` to the value, security rules re-evaluate immediately. Any existing `classes` doc with `ownerId=uid, schoolId=null` gets its `schoolId` set in the same write — one document, one field, no new class created, no data moved.

**Batch vs per-person:** same collection — `maxUses:1` for an individually-issued beta PIN, `maxUses:N` (or unbounded) for a PD-room school code on a projector. No second system.

## What this unblocks

With the class entity shape, storage-seam adapter, cutover trigger, converter scope, routing shape, prize-ledger shape, and signup-code mechanics all specified, **step 2 (security rules) and step 3 (the converter tool itself) can both start from a fixed target schema** instead of guessing at one — rules can be written against known collection paths (`classes/{id}`, `.../students/{id}`, `.../trackedEntries/{id}`, `.../prizeLedger/{id}`), and the converter's verification harness above gives step 3 its acceptance criteria up front rather than inventing them mid-build. Step 4 (routing) has its scope boundary drawn, so it won't creep into the class-switcher UI that belongs to step 6. Nothing here is committed until Ben signs off — this closes the *design* gap, not the build order.

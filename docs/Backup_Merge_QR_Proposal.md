# Combining backups, merging duplicate students, and reassigning QR codes

**Status: PROPOSE-FIRST. Nothing here is built.** Raised by Ben: a rebbi with
two backups of the same class (e.g. one from a home computer, one from a
school Chromebook) currently has no way to see what each holds before one
overwrites the other, and no way to merge a student who ended up entered
twice. A related question — QR codes currently can't be changed, is that on
purpose? — turned out to share no real mechanism with the first two once
looked at closely; it's folded in here because it was asked alongside them,
not because it's the same feature.

Related, not overlapping: **#373** ("Erase a class off a borrowed computer…")
already ships a single-source restore — pull the newest backup back from a
*folder this same rebbi already connected*. Nothing here duplicates it; that
PR never has two sources to reconcile, which is the entire problem this doc
is about.

---

## The three asks, and why they don't share one mechanism

All three were investigated together because they all touch "a student's
identity" — but they turn out to have three different blast radii, and
forcing them through one shared primitive is a trap worth naming explicitly
rather than falling into:

| | Inputs | If it's wrong | Bar for correctness |
|---|---|---|---|
| **Combine two backups** | Two JSON blobs, neither is the live save yet | Rebbi sees a bad preview and cancels — nothing was ever written | Get it right, but a mistake is cheap to catch |
| **Merge duplicate students** | The one live save, in place | Silent surgery on the only copy the rebbi has; a missed store is invisible until a boy's ticket/pass/contest total is just gone | Must be exhaustive — no second source to check against |
| **Reassign a QR code** | One student record | Depends entirely on which real problem prompted the ask (see below) | Turns out to need almost no surgery at all, if scoped right |

Combine can afford to be a pure, cancelable transform. Merge cannot — it's
permanent. Building one "rewrite this student's id everywhere" function and
using it for both would hand merge's high-stakes caller the same loose
assumptions that are perfectly fine for combine's cancelable one. They're
designed separately below on purpose.

---

## 1. Combining two backups

### Where this slots in

The tier-1 "Restore a class into your account" card (`app.html` ~3917,
`backupRestoreCard`) already has real conflict handling: it previews the
incoming file's student count and class name before anything is written, and
on an `already-exists` response from `provisionRebbi` it offers **Overwrite
it** / **Add as a separate class instead** / **Cancel** (~8094-8160). This
adds a fourth choice next to those two: **Combine with what's here.**

The plain local "Restore from a backup" card (`importBtn`/`importFile`,
~30690) has none of this — one `confirm()` ("This will replace everything
currently here") and a blind `data = migrateData(obj)`. It's the more
dangerous of the two restore paths for exactly the two-computers scenario,
and closing that gap (give it the same preview-before-commit shape the tier-1
card already has) is worth doing even before Combine exists, as its own
smaller PR.

### Mechanism: a disposable rebuild, not a live edit

This never touches the live `data` object until the rebbi confirms. It
builds a **third, throwaway `data`-shaped object** from the two inputs (the
current save + the uploaded backup), previews it, and only on confirm does
that become the real save. This is the same shape "Restore from a Log CSV"
(~30720-30793) already uses — it builds a fresh `data` from one source via
`findOrMakeStudent()`'s by-name matching rather than editing anything in
place. Combine is that same pattern with two sources instead of one.

**Student matching — reuse `importRoster()`'s existing rule.** Match by
lowercased name (`app.html:26717`, already the trusted precedent in this
codebase for "is this the same student"). No new identity heuristic needed.

- **Name matches on both sides** → same student, reconcile per below.
- **Name only in the incoming file** → new student, added fresh. If the
  incoming student's raw `id` collides with an unrelated existing student's
  id (two different backups both minted "S001" for two different boys —
  expected, since `nextStudentId()` just counts from 1 on each device), mint
  a new unused id for the incoming one **as part of building the throwaway
  object** — the same `findOrMakeStudent()`-style id-avoidance the Log CSV
  path already does, not a live rewrite of anything.

### Score/history reconciliation is the real design problem here

Two matched students each carry a `data.scores[sid]` total and a slice of
`data.log`. **Do not sum the two totals** — the Log-CSV restore path already
documents why in a comment (~30758-30766): summing deltas double-counts
around Raffle spends, Store purchases, Auction spends, and Undos, and the
app's own recorded "New total" per scan is the only value that's provably
right, because it's what the app itself computed at scan time.

The generalization: **union the two logs by entry `id`, sort chronologically,
replay.** `data.log` entries already carry a globally-unique `id` (`newId()`
at write time — `app.html:5679` and every scan/correction site), so an
id-based union is well-defined and catches the one case that's cheap to
catch: the *same* backup, or overlapping history, uploaded twice. It does
**not** catch two independently-performed real-world scans of the same event
entered separately on two computers — those get two different `newId()`
values and look like two distinct entries. That's a real gap, not silently
solved; the honest read is that this scenario (a rebbi alternating between
two computers on different days) is normally disjoint in time anyway, so
double-entry of the identical event is the rare case, not the common one.
Worth one line in the preview UI rather than pretending it's handled.

**The honest cliff, named up front rather than discovered in a classroom:**
`data.log` is capped (5000 general / 1500 tracked, per #129/#226). If either
device's history has already fallen off that cap, the replay can't fully
explain that device's current score — the reconstruction is provisional on
that side, not verified. This is the same lesson CLAUDE.md already states for
Contest: *"anything whose totals are only derivable from the log is built on
sand."* The honest move is to surface this in the preview — "X's history on
this device only goes back to `<date>`; can't fully verify combined totals
before that" — rather than presenting a combined number with false
confidence.

### What Combine does NOT need

No sweep across attendance/homework/tracker/raffle/contest/chavrusa stores —
those are all rebuilt fresh from the two source objects while assembling the
throwaway `data`, exactly the way the Log-CSV path already rebuilds
`fresh.log`/`fresh.scores`/`fresh.activities` from scratch. This is what
keeps Combine in the "cheap to get right, cheap to cancel" column.

### Recommended scope for a first PR

1. Give the local "Restore from a backup" card the same preview-before-commit
   shape the tier-1 card already has (small, no new mechanism — closes the
   worse of the two gaps first).
2. Add "Combine with what's here" as a third choice on the tier-1 conflict
   screen, built on the by-name + log-replay approach above.
3. Do **not** attempt to also detect "possible duplicate scan" fuzzy matches
   in the first version — name it as a known gap in the preview copy instead.

---

## 2. Merging duplicate students

### Why this is the harder feature, not a smaller version of #1

A student's `id` (e.g. `"S001"`) is a foreign key referenced across at least
these live stores — enumerated by reading the setters directly, not
inferred, and called out as possibly incomplete (see "Before building"
below):

| Store | Shape | Merge rule needed |
|---|---|---|
| `data.scores[sid]` | running total | replay-based, see below — never naive sum |
| `data.log[]` | flat, `{id, ts, sid, delta, label, kind?}` | union by `id`, both students' entries kept, `sid` repointed to the survivor |
| `data.attendance[dateKey][sid]` | day-map, `{status, ts, id}` (`app.html:9246`) | per date: survivor's record wins if both days are marked; loser's-only days copied over |
| `data.homework[dateKey][sid]` | day-map, `{checked, ts, id}` (`app.html:10684`) | same as attendance |
| `data.trackerLog[]` | flat, `{id, ts, sid, actId, about}` (`app.html:10309`) | repoint `sid` to survivor |
| `data.trackedData[itemId][sid][]` | the Phase-2c Gradebook mirror | repoint key from loser's `sid` to survivor's, concatenate arrays |
| `data.passCount[sid]` / `data.passes.used[sid]` | rolling counters, no history | sum counts; take latest `used` timestamp |
| `data.raffle.entries[sid]` / `.adjust[sid]` / `.removed[sid]` | per-student maps | sum entries/adjust; `removed` OR's together |
| `data.contest.totals[sid]` / `data.miniContest.totals[sid]` | running totals, **stored, not log-derived** (this is exactly the store #133/#134 fixed for this reason) | sum — these are already the safe case, since they're not log-derived |
| `data.chavrusaSession.groups[].studentIds[]` / `data.chavrusaHistory[]…` | arrays of ids | replace loser's id with survivor's, dedupe if a group already had both |
| `data.printCodeSections[qrText]` / `data.printExcluded[qrText]` | keyed by the id string itself (a student's `qrText` **is** `s.id`) | move the loser's entry to the survivor's key if the survivor has none set |
| `data.earned[sid]` / `data.weekly[sid]` | trend history (`recordEarn`) | sum per period |
| `data.students[]` | the record itself | delete the loser's entry after everything above is repointed |

**This list is the working list, verified against the current setters — not
a guaranteed-exhaustive one.** Before any implementation, re-derive it by
grepping `\.sid\b`, `s\.id`, `studentIds`, and `qrText` fresh against
whatever `app.html` looks like at that time, the same way this list was
built, and diff against the table above. A merge PR that trusts this table
without re-checking is exactly the failure mode the table exists to prevent.

### Score reconciliation — same principle as Combine, higher stakes

Same rule as §1: **replay `data.log` by union-of-ids, never sum the two
`data.scores` totals.** But here the log-cap cliff is worse, because there is
no "cancel and try Overwrite instead" escape hatch — this is surgery on the
one save the rebbi has. If either student's true history predates what the
log still holds (5000/1500 cap), the merge cannot be verified as exactly
right, only as "as right as the surviving log allows." The confirmation
dialog must say this plainly — matching the standard this codebase already
holds itself to for Contest (CLAUDE.md: *"The data model was sound... but
contest totals were only ever computed by walking `data.log`, which is
capped... 'saving' a contest saved a label with no scores behind it."*) A
merge dialog that doesn't name this risk is repeating that exact mistake in
a new place.

### Recommended flow

1. Detect (don't auto-merge) exact-name duplicates in the Students tab —
   a small, dismissible note, not a blocking modal.
2. "Merge students" picks a survivor explicitly (never inferred) and shows
   both students' current scores/tallies side by side before confirming.
3. The confirm dialog states plainly: this can't be perfectly undone if
   either student's history has already fallen off the log cap, matching
   the CLAUDE.md `1. Never break saved data` four-question test (what
   happens if this feature's data is truncated or wrong; is there a way
   back). There isn't a full way back here beyond "restore from a backup
   taken before the merge" — say so.
4. This is a **data-model-adjacent change** under CLAUDE.md's PROPOSE-FIRST
   bucket even though it isn't `migrateData()` — same risk class (irreversible
   surgery on live saved data) and needs the same sign-off before code: show
   the exact per-store rewrite rule and get a yes before building.

---

## 3. Changing a student's QR code

### It isn't locked on purpose — there's just no field to unlock

A student's QR payload **is** their internal id — `makeQrCard(s.id, ...)`
(`app.html:11265`) encodes it directly, minted once by `nextStudentId()`
(`app.html:6346`) and matched back via `studentById()`'s exact-id lookup
(`app.html:6352`). There's no separate "code" field, so there's nothing in
the UI to make editable — this was never a deliberate restriction, just
never built. Reprinting a **lost or damaged sticker** already works fine
today ("Fill a sheet (1 student)," `app.html:33052`, just re-renders the same
code from the same id) — that part of "change my QR code" is not actually
missing.

### What's actually being asked determines whether there's a feature here at all

| Reading | Already solved? | Design if not |
|---|---|---|
| Sticker lost/damaged, need a new physical copy | ✅ yes, today | — |
| Rebbi wants a fresh/renumbered code for a student | ❌ | decouple code from id (below) |
| Two backups collided on the same raw id during Combine (§1) | Handled *inside* Combine already (id-avoidance while building the throwaway object) | not a standalone feature |
| A code was shared/leaked and should stop working | ❌ | decouple code from id, **and** needs a concept of a retired code — the current design (code = id) can't express "this code used to work and now doesn't" without deleting the student |

Three of four readings point the same direction, and the fourth is already
covered by §1. **Open question for Ben below** — this section assumes the
"decouple" answer, but the actual prompting scenario should confirm it
before anything is built.

### Recommended design: decouple `code` from `id`, don't rename `id` in place

Reassigning a code should **never** need the merge-style sweep from §2. Keep
`s.id` exactly as it is today — the permanent internal key every store above
already references — and add one new field:

```js
s.code   // the string a QR actually encodes; defaults to s.id for every
         // existing student (load2fix() backfill, purely additive, no
         // DATA_VERSION bump)
```

- `makeQrCard()` calls switch from `s.id` to `s.code`.
- `studentById()`'s lookup extends to check `code` as well as `id` — small,
  additive, no store above needs to change, because every one of them is
  keyed by `s.id`, which never moves.
- "Give this student a new code" = mint a fresh unused code string and set
  `s.code` to it. **No other store is touched.** This is the entire reason
  decoupling is worth the one extra field: it turns "reassign a QR code"
  from a 13-store sweep into a single-field edit.
- Optional, worth a yes/no of its own: keep retired codes in
  `s.retiredCodes[]` so an old sticker that resurfaces reads as "this code
  was retired for `<name>`" instead of either silently scoring the wrong
  thing or reading as a plain unknown code. Directly answers the
  shared/leaked-code reading above.

### Compatibility with the (already-approved) Firebase data model

`Firebase_DataModel_Design_Proposal.md`'s step 1 is **APPROVED and locked**
(`classes/{classId}/students/{studentId}` — `app.html`'s current `s.id`
scheme, deterministic write ids). That doc doesn't mention a code field
either way, so adding `code` here is additive to an already-locked schema,
not a reopening of it — one more field on the `students/{studentId}` doc,
same as `photo` or `section`. Flagging this so it's sequenced correctly:
this doc doesn't get to relitigate step 1, it slots into it.

---

## What this does not do

- Does not implement anything. Every mechanism above is a proposal.
- Does not touch `migrateData()` or bump `DATA_VERSION` — the one additive
  field in §3 (`s.code`) is a `load2fix()` backfill only, same class of
  change as `lastBackupAt` in the Daily Backup spec.
- Does not solve fuzzy same-event duplicate detection across two devices
  (§1) — named as a gap, not silently handled.
- Does not build a shared "rewrite a student's id everywhere" primitive.
  That idea was considered and rejected: Combine and QR-reassignment don't
  need it (both avoid live rewrites by construction), and Merge's live-edit
  correctness bar is too high to inherit assumptions from callers that don't
  share it.

---

## Open questions for the maintainer

1. **QR codes (§3):** which of the four readings actually prompted this —
   specifically, is there a real "a code got shared/leaked" scenario, or is
   it "I want cleaner-looking codes"? Either way the recommendation is the
   same (decouple `code` from `id`), but it decides whether `retiredCodes[]`
   is worth building alongside it.
2. **Combine (§1):** should the local "Restore from a backup" card get the
   preview-before-commit treatment as its own smaller PR before Combine
   exists, or bundle them? Recommendation: ship the preview first — it's a
   strict safety improvement on its own and doesn't block anything.
3. **Merge (§2):** confirm the per-store rewrite rules in the table above
   before any code is written — this is the PROPOSE-FIRST data-model gate
   CLAUDE.md requires for anything touching live saved data that isn't
   purely additive.
4. **Sequencing:** two PRs are currently open (#373, #370), well under the
   5-PR WIP cap — no blocker there. Recommend landing in order of blast
   radius: restore-preview → Combine → QR decouple (small, additive) →
   Merge last, since it's the one with no cancel path and the highest cost
   of getting the store list wrong.

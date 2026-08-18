# The mirror gap — proposal

> 📦 **ARCHIVED 2026-08-18 — shipped and merged (PR #219).** Historical only
> from here on. The living summary of what this shipped is now CLAUDE.md's
> "mirror" code-pattern section.

**Status: ACCEPTED 2026-08-05 — all five decisions taken as recommended.
Implemented in PR #219.** Written 2026-08-05, after Phase 2d landed in two parts
(#208 + the tile badges), as the PROPOSE-FIRST document for the one piece 2d
deliberately left open.

Kept as written rather than rewritten into a description of what shipped: the
reasoning is the point, and §2's five verified facts are what the implementation
rests on. Two things worth knowing when reading it back:

- **§3's "out of scope for the first PR" did not survive contact.** Once the
  setters transcribe, `recordTrackedScan()` mirroring as well writes a *second*
  entry for one scan, so collapsing it was forced rather than optional. It went
  in with the rest.
- **The one thing #219 could not verify in a browser** is the Tracker "Reset"
  path from §6 decision 4, because it opens a `confirm()` and a modal dialog
  freezes the extension. Wording and behaviour are code-verified only.

Read `Menchmark_Phased_Build_Plan.md` §2 first for where this sits.

---

## 1. The gap, precisely

A tracked **scan** dual-writes: the legacy store (so the old tab is right) and
`data.trackedData` (so the Gradebook has something to read). That is what #208
built, and `TRACKED_LEGACY` is the table that does it.

A **correction made on one of the four old tabs does not.** Press "Mark the rest
Present" on the Attendance tab and `data.attendance` moves while
`data.trackedData["ti-attendance"]` keeps whatever it last heard from a scan.
Same for toggling a boy's homework on the Homework tab, giving a pass back on
the Passes tab, and undoing an entry on the Tracker tab.

**Why this blocks #185 and nothing else does.** The Gradebook reads the mirror.
Un-hide it today and a rebbi who fixes a boy on the Attendance tab gets a grid
that contradicts the tab he just fixed — the same class of fault that got the
tab hidden in the first place (a working-looking feature showing wrong numbers),
with a new cause. 2d moved the reason; it did not remove it.

**It is harmless right now.** The Gradebook is hidden, so nothing displays the
mirror. There is no live wrong number in front of any rebbi today. This is a
blocker, not an incident.

---

## 2. What the code actually says

Everything below was read out of `app.html` on 2026-08-05, not assumed. These
five facts are what the proposal rests on, and each one narrows the work.

**2.1 — The write funnels are narrow.** There are far fewer mutation sites than
"four tabs" suggests:

| Store | Adds / changes | Removes |
|---|---|---|
| `data.attendance` | **`setAttendance()` — the only one.** `attCycle()`, "Mark the rest Present", the scan path and the per-row buttons all funnel through it | — |
| `data.hw` | `setHw()` and `markHwCheckedToday()` | — |
| `data.passes` / `data.passCount` | `setPass(sid, true)` | `setPass(sid, false)` ("Give back"), and the period reset |
| `data.trackerLog` | `trackerLogAdd()` | `trackerUndoLast()`, `trackerUndoOne()`, `resetTrackedActivity()` |

Five add/change sites and five remove sites, total. "Mark the rest Present"
needs no special handling at all — it is a loop over `setAttendance()`.

**2.2 — The mirror entry already has the field a correction needs.** The
Gradebook groups entries into date columns like this:

```js
var k = (typeof e.date === "string" && e.date) ? e.date : gbDateKeyForTs(e.ts);
```

An entry may carry the school day it is **about**, separately from when it was
typed. 2c's converted attendance sets it; scan-time entries don't and fall back
to their timestamp. So a correction made on Wednesday to Monday's attendance
already has a correct home: `{value, ts: <Wednesday>, date: "<Monday>"}`. The
column is right and the audit trail is right, and no shape change is needed.

**2.3 — How each method reads, which decides what a correction may do.** From
`gbCellText()` / `gbTotalParts()`:

| Method | Cell reads | So a correction is… |
|---|---|---|
| `preselect` (Attendance, Homework) | **the LAST entry's value** | …an **append**. History intact, newest wins, nothing rewritten. |
| `count` (Tracker) | the **sum** of entry values | …a **removal**. Appending anything only inflates the sum. |
| `limited` (Passes) | **`entries.length`** vs cap | …a **removal**. Same reason. |

This is the crux. Attendance and Homework — the two stores a rebbi actually
corrects by hand all day — are append-only, which is the easy and safe case.
Only the two undo-shaped operations need to delete.

**2.4 — 2c already solved the hard half, idempotently.** The attendance
conversion in `load2fix()` merges `data.attendance` into the mirror with a
dedup key of `date@ts`, sorts by `ts` afterwards (because last entry is
current), and leaves a receipt in `data.attConversion` recording what came
across and what did not. Its own comment: a second run — a restored backup, a
corrupted receipt — **cannot duplicate a record.**

That routine is the template for the backfill in §4, and it is already proven
against real saves.

**2.5 — `setAttendance()` stamps a fresh `ts` on every change,** and returns
`false` without touching anything when the status is unchanged. So every
correction is a distinct `date@ts` pair. That is what makes the dedup in 2.4
work across corrections rather than collapsing them.

---

## 3. Design — two candidates, and the recommendation

### Option A — write-through at the setters

Each of the ten sites in 2.1 also updates the mirror.

- Immediate: the Gradebook is right the moment the rebbi presses the button.
- Cheap: one entry touched per operation.
- **Its whole risk is completeness.** Miss a site — today or in a year — and
  the gap comes back silently, in exactly the way that is hardest to notice.
  It also does nothing about records already written (§4).

### Option B — reconcile the mirror from the legacy store on read

Rebuild the projection when the Gradebook is opened.

- Cannot miss a mutation site, because it never looks at sites.
- **But it writes during a render**, which is precisely what the tile badges
  were just written to avoid, and it re-walks the whole store to answer a
  question about one cell.

### Recommended: A, implemented as *transcription*, plus a one-shot B for history

Take A's immediacy and completeness-by-narrowness, and take B's key property —
**the mirror never computes a value, it copies the one the legacy store just
wrote.**

```js
// after the legacy write, inside setAttendance():
mirrorTracked("ti-attendance", sid, { value: status, ts: day[sid].ts, date: dk });
```

This is not a re-derivation and does not contradict 2d's rule that the legacy
hook owns the value. It is the same rule from the other end: the legacy store
computed `status`, and the mirror records exactly that, with the legacy
record's own timestamp and day. Two cycles cannot advance independently,
because only one of them cycles.

It also makes the scan path and the correction path produce **byte-identical
entries** for the same underlying record, which is what lets the backfill in §4
dedup cleanly against them.

**One consequence worth stating plainly:** with transcription at the setter,
`TRACKED_LEGACY`'s separate mirror step becomes redundant for every store that
has a setter — the setter now mirrors on its own, including when a scan is what
called it. Collapsing that is a real simplification of #208's code, but it is a
change to code that shipped hours ago, so it is **out of scope for the first
PR** and noted here as a follow-up rather than smuggled in.

---

## 4. The historical gap — the part that is a migration

Going forward is not enough. There is a window of records already written that
the mirror never heard about:

- **Attendance** was converted once by 2c, up to that moment. Every tab-side
  mark and correction **since** that conversion is missing from the mirror.
- **Homework, Tracker, Passes** were never converted at all.

Un-hiding the Gradebook without addressing this shows a grid that is missing
days a rebbi knows he marked — the #185 fault again, from a third cause.

**Proposal: one further one-shot merge in `load2fix()`, reusing 2c's routine
verbatim,** gated on its own flag (`mirrorBackfill`) and leaving its own
receipt. Because the dedup key is `date@ts` and every legacy record carries its
own `ts`, this cannot duplicate anything 2c or a scan already wrote, and it can
be re-run safely if a receipt is ever lost.

Which stores it covers is **decision 2 below**, because `data.hw` was already
agreed in 2c to RESET rather than convert, and that agreement should not be
quietly reversed by a backfill.

---

## 5. Asking the four questions

From CLAUDE.md, before shipping anything that stores or destroys data.

**If this feature's data can be truncated or wiped, does it still behave
correctly?** Yes, and better than the thing it replaces. The mirror is not
capped (unlike `data.log` at 500, the fault that cost Contest its totals) and
`data.trackerLog` is capped at 2000 — so after this, the Gradebook's count
column outlives the Tracker tab's own history rather than decaying with it.

**Does anything destructive share a button with something benign?** No new
button is added. But see decision 4: an existing one — Tracker "Reset" —
becomes more destructive than its dialog says.

**Does any dialog promise something the code then destroys?** Today, no.
**After this change, "Reset" on the Tracker tab would also silently clear that
activity's Gradebook history**, while its confirm dialog still talks only about
"logged entries". That is the exact shape of the Contest fault (#131/#134) and
must not ship without the wording being fixed alongside it.

**Is there a way back?** For the backfill, yes — a receipt, same as
`data.attConversion`. For an undo mirrored as a deletion, no, and deliberately:
the Tracker tab's own undo is already permanent, so the mirror matches it
rather than inventing a recovery path the rebbi cannot see.

**Nothing in this proposal deletes from a legacy store, changes a legacy shape,
renames a field, or bumps `DATA_VERSION`.** The only mirror deletions are ones
the rebbi personally performed on the record being mirrored.

---

## 6. Decisions needed before this is built

**1 — Homework's `false`.** `setHw(sid, false)` unchecks a boy. The preset's
options are `unchecked` / `full credit` / `partial credit` / `no credit`, and
#208 already mirrors a scan's `true` as `"full credit"`. *Recommendation:*
`false` → `"unchecked"`, not `"no credit"` — the legacy boolean means "not
marked", and "no credit" is a judgement the rebbi never made. The four-state
preset can express both; the boolean store cannot.

**2 — Which stores get the historical backfill (§4).** *Recommendation:*
attendance **yes** (it is already half-converted, and the gap window is pure
loss); tracker **yes** (`data.trackerLog` is a real dated history and the
richest thing the Gradebook could show); homework **no** (2c agreed it resets,
and this should not reverse that by the back door); passes **n/a** — see 3.

**3 — Passes have no history to back-fill, and their reset must not propagate.**
`data.passCount` is a rolling counter for the current period; "Reset all passes"
clears it. The mirror, by contrast, is a dated history of every pass ever used.
*Recommendation:* `setPass(sid,true)` appends, `setPass(sid,false)` removes the
most recent entry, and **the period reset mirrors nothing** — it is a new
period, not a retraction. Consequence to accept knowingly: the Gradebook's pass
column then reads "all time" while the Passes tab reads "this period", and they
will legitimately disagree. That is the Gradebook being the record and the tab
being the working surface, but it is a real difference a rebbi could notice.

**4 — Tracker "Reset" and the dialog.** *Recommendation:* mirror the wipe (the
grid must not keep entries the rebbi deleted) **and** rewrite the confirm text
in the same PR to say the Gradebook history goes with it. Shipping the first
half without the second is the Contest fault.

**5 — Does #185 un-hide in this PR or the next one?** *Recommendation:* **the
next one.** This PR is a data change to a store holding real records; un-hiding
is a one-line `navHidden` seed with its own flag, and it should follow once the
backfill receipt has been read on a real save. Two small PRs, each verifiable,
rather than one that changes the data and reveals it in the same breath.

---

## 7. If approved, what ships

1. `mirrorTracked(itemId, sid, entry)` — one append helper, dedup on `date@ts`
   so a setter firing twice cannot double-write.
2. Transcription calls in `setAttendance()`, `setHw()`, `markHwCheckedToday()`,
   `setPass()`, `trackerLogAdd()`.
3. Removal in `setPass(sid,false)`, `trackerUndoLast()`, `trackerUndoOne()`,
   `resetTrackedActivity()` — with `src` (the legacy entry's id) stored on
   tracker mirror entries so an undo removes exactly the right one rather than
   guessing.
4. The one-shot backfill of §4 in `load2fix()`, with a receipt.
5. The Tracker "Reset" dialog wording (decision 4).

**Data:** additive only — a new optional `src` on new tracker entries, plus
existing `{value, ts, date}`. `load2fix()` backfill, **no `DATA_VERSION` bump**,
nothing renamed, nothing converted destructively.

**Verification owed before it is marked ready:**
- `test-migration.html` run in a browser, its copies synced first, including
  "Corrupted data" — this touches `load2fix()`.
- Harness assertions for: idempotence of the backfill across two runs, a
  correction landing in the corrected day's column rather than today's, an undo
  removing exactly one entry, and the pass reset leaving history alone.
- A browser pass driving each of the four tabs and reading the result in the
  Gradebook — the badge work proved a Node run is not sufficient on its own.

---

## 8. What this deliberately does not do

- It does not retire any of the four tabs. That is #122 and stays out.
- It does not un-hide the Gradebook (decision 5).
- It does not collapse `TRACKED_LEGACY`'s now-redundant mirror step (§3).
- It does not touch the Firebase rebuild, though it is worth knowing that
  rebuild's open question 3 dissolves this whole class of problem later with
  deterministic client-generated write ids.

# Offline resync — investigation + proposal

*Scoped 2026-08-16, closing `docs/NOW.md` item 3: "read-only investigation
first, then PROPOSE FIRST." The investigation below is complete — every claim
is checked against the live code, with `app.html` line numbers. The proposal
section is new judgment, not yet agreed to.*

**Status: PROPOSE-FIRST.** Nothing here is built. It needs a yes before
implementation.

---

## The question this answers

From NOW.md: *"The snapshot recovers after being offline; logged scans do not
unless 'resync all scans' is pressed. Want it automatic on reconnect and
periodically. Retry safety differs per tab. The Log dedups by ID so
re-pushing is safe. The Attendance Log has no dedup, so a retry duplicates
rows. Confirm per tab before proposing."*

The confirmation is below, and it's worse than the one-line summary: the
asymmetry isn't Log-vs-Attendance-Log, it's Log-vs-*five other things*, and
Attendance Log has a second, independent bug stacked on top of "no dedup."

## Headline findings

1. **There is no queue, no retry, no online listener, no background sync —
   anywhere in the app.** `navigator.onLine` appears zero times in
   `app.html`. No `addEventListener("online"|"offline")`. No
   `SyncManager`/background sync. `sw.js` never even sees a Sheets POST — it
   bails on non-GET requests (line 46) and on cross-origin requests (line
   51).
2. **The snapshot "recovers" only because it's a whole-state overwrite that
   re-fires constantly** — every `save()` re-arms a 30-second debounce
   (`scheduleAutoSnapshot()`, `app.html:22143-22150`), and every tab-hide
   (`visibilitychange`, `pagehide`) fires an additional attempt
   (`pushSnapshotOnClose()`, `22159-22191`). It isn't a retry mechanism; it's
   an idempotent full-state re-send that happens to run again soon after any
   failure, because normal use of the app keeps triggering it. A rebbi who
   closes the laptop lid right after scanning offline could still miss the
   window.
3. **Log-tab pushes are dedup'd server-side by id (Sheet column G) — but 5 of
   13 `type:"scan"` call sites send no id at all**, so those rows bypass
   dedup entirely: Bathroom pass (`5848`), weekly pass reset (`5929`), raffle
   ticket purchase (`15421`), raffle refund (`15439`), Shorashim game
   (`18068`). A resync after one of these fails duplicates it every time.
4. **The Attendance Log is worse than "no dedup."** `sendAttendance()`
   stamps `day._sentAt = Date.now()` unconditionally, right after firing a
   fire-and-forget POST (`app.html:6285-6288`) — before the app has any idea
   whether the push landed. A push that fails offline gets marked sent
   anyway, and the normal (diff-based) resend path will **never** try that
   day again. This is why `resendAttendanceDay()` had to be built as a
   separate, manual, duplicate-warned escape hatch (`6327`, confirm dialog at
   `6322-6325`) — it's a workaround for a bug in the primary path, not a
   parallel feature.

## Where the pushes actually come from

Two mechanisms carry everything:

- **`pushToSheet(payload)`** (`app.html:21962-21978`) — one POST per event
  (a scan, a correction, an attendance batch, a note, a pasuk, a tracker tap,
  a homework check). `mode:"no-cors"`, so a *resolved* promise only means the
  request left the browser — Apps Script could 500, the deployment could be
  stale, the URL could be wrong, and the app would never know
  (`21948-21953`, and this is the exact prior failure mode that let
  `_sentAt` get stamped on a dead request in the first place).
- **`pushSnapshot(silent)`** (`app.html:22048-22087`) — the entire `data`
  object, `JSON.stringify`'d, sent as one row. Same `no-cors` ceiling on
  confirmation, but because it carries whole state, the *next* successful
  send heals everything before it, which is the only reason "offline
  recovers" reads as true today.

Neither has a timeout, an `AbortController`, or a queue. Failure handling is
one `console.warn`, deduped per distinct reason per session
(`pushToSheetWarned`, `21961-21976`) — invisible to the rebbi unless they
have devtools open.

## The Apps Script side

`apps-script/beta-signup.gs` is the beta signup form, unrelated. **The sync
Apps Script is committed as a copy-paste `<pre>` block inside `app.html`
itself** (`3156-3507`, plus the manifest at `3513+`) — the setup tab renders
it, and the rebbi pastes it into their own Google project. That embedded
script is the literal source of truth for every dedup/append/replace
decision below.

Dedup, where it exists, lives entirely server-side:

```js
// app.html:3224-3231
function logHasId(log, id) {
  if (!id) return false;
  var last = log.getLastRow();
  if (last < 2) return false;
  var ids = log.getRange(2, 7, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) { if (ids[i][0] === id) return true; }
  return false;
}
```

Two things worth knowing about it: `if (!id) return false` means an id-less
push (see finding 3 above) is *never* dedup'd — it always appends. And it's
read-then-append with no lock (`LockService` at `3324-3338` only guards the
header write, per its own comment), so two genuinely concurrent pushes of
the same id — a double-click of "Resync all scans", or a resync racing a
live scan — can both read "absent" and both append. Dedup is safe against
*sequential* retry, not concurrent retry.

## Per-tab retry-safety table

The core deliverable. Every Sheet tab `doPost` can write to, what triggers
each push, and what a retry does to it.

| Sheet tab | Trigger | Retry safety | Notes |
|---|---|---|---|
| **Log** (id-bearing) | every real scan/correction (`10354`, `10739`, `16132`, corrections, "Resync all scans") | ✅ safe — server dedups on id (col G) | The only tab with both a resync button *and* real protection |
| **Log** (id-less) | bathroom pass, weekly pass reset, raffle purchase/refund, Shorashim game (5 sites) | ❌ unsafe — dedup bypassed by design (`!id` check) | A resync (or any retry) duplicates these every time |
| **Log** notes (col I) | `setEntryNote`, voice notes, note-undo | ✅ update-in-place, no append | But depends on the *parent* scan row already existing — no ordering guarantee between them |
| **Attendance Log** | `sendAttendance()` (diff-based auto-send) | ❌ unsafe, and worse: marked "sent" even on failure | `_sentAt` stamped unconditionally at `6286`, before knowing whether the POST landed |
| **Attendance Log** | `resendAttendanceDay()` (manual force) | ❌ unsafe (plain append) but at least self-aware | `_sentAt` deliberately *not* stamped on failure (`6335-6338`); user is shown an explicit duplicate warning before clicking |
| **Snapshot** | every `save()` (30s debounce) + tab hide/`pagehide` + manual button | ✅ effectively safe | Whole-state append, trimmed to last 5 rows/device (`SNAPSHOT_MAX_PER_DEVICE=5`); a duplicate is just an extra history row that trimming reaps |
| **Standings** | manual "Send standings" button only | ✅ safe | Full clear + rewrite (`3387-3392`) |
| **Leader Board** | derived, on every successful Log write | ✅ safe | Rebuilt from the Log itself (`rebuildLeaderBoard()`) |
| **Pesukim Log** | pasuk grid tap / scan | ❌ unsafe, **and no resync path exists at all** | Plain `appendRow` (`3394-3397`); a failed push is permanently lost to the Sheet, full stop |
| **Pesukim Chart** | manual "send chart" button | ✅ safe | Full clear + rewrite (`3399-3407`) |
| **Tracker Log** | tracker tap | ❌ unsafe, **no resync path** | Plain `appendRow` (`3469-3472`) |
| **Homework Log** | homework check / HW personal-QR scan | ❌ unsafe, **no resync path** | Plain `appendRow` (`3474-3477`) |

**The asymmetry NOW.md asked to confirm is real, and it's wider than
"Log vs. Attendance Log":** three tabs — Pesukim Log, Tracker Log, Homework
Log — have *no* recovery path whatsoever today. A rebbi who scans those
offline and never manually resends (there's nothing to click — "Resync all
scans" only replays `data.log`, gated on `!e.kind`, i.e. plain point
scans/corrections) has simply lost that Sheet data, permanently, with no
error ever surfaced.

## What "automatic on reconnect and periodically" would actually need

Given the table above, an automatic retry loop *by itself* would make things
**worse**, not better, on five of these tabs — it would faithfully duplicate
every unsent Attendance/Pesukim/Tracker/Homework row on every reconnect, and
duplicate every id-less Log entry too. The dedup gap has to close first, or
the automation just automates the duplication.

### Recommended order

1. **Give every push a stable id, and make the server dedup on it —
   everywhere, not just Log.** Concretely:
   - Fix the 5 id-less Log call sites to pass the entry's real `id` (they
     already have one in `data.log`; they just aren't sending it).
   - Extend Pesukim Log, Tracker Log, and Homework Log's Apps Script handlers
     to take the same `logHasId()`-style dedup Log already has, and have the
     client send an id on those pushes (their local stores don't currently
     mint one the way `newId()` does for `data.log` — that's the one piece
     of client-side work here beyond "send the id you already have").
   - This alone doesn't require retry automation to be useful — it makes
     "Resync all scans"-style manual buttons safe to extend to those three
     tabs immediately, which is a real fix on its own even before step 2.

2. **Fix the Attendance Log's `_sentAt` bug.** Only stamp `_sentAt` once the
   push is known to have left the browser successfully — i.e., move the
   stamp into the `.then()` the way `pushSnapshot()` already does for
   `_lastSnapshotAt` (`22079-22080`), not unconditionally after firing the
   `fetch`. This is the smallest, highest-value fix in this whole document:
   it's what makes `resendAttendanceDay()`'s manual workaround unnecessary
   as anything but a last resort, and it's a same-shaped bug to one this
   codebase has already fixed once (the comment at `21948-21953` says as
   much — this *is* that bug, just in the one place the fix didn't reach).

3. **Only then, add the automatic retry itself:** an `online` event listener
   plus a periodic timer (e.g. every few minutes while the tab is visible
   and online) that re-attempts anything not yet confirmed. This needs a
   lightweight "still pending" signal per store — not a full queue
   reimplementation, since `data.log`/`data.attendance`/etc. already *are*
   the durable local record. A `pending: true`/absent marker (attendance
   already has the shape via `_sentAt` presence/absence; the others would
   need the equivalent) is enough to know what to retry without inventing a
   second data structure to keep in sync with the first.

4. **Flag, don't fix, the confirmation ceiling.** `mode:"no-cors"` means
   "the fetch resolved" is the strongest signal available without changing
   the endpoint's CORS posture — Apps Script errors and stale deployments
   will keep looking like success. Fixing that is a bigger, separate
   question (it would need the Apps Script to respond in a way the browser
   can read, or a different transport) and isn't in scope for a resync
   proposal; it just means step 3's "confirmed" always means "left the
   browser," never "Apps Script accepted it" — the same limit the comment at
   `21948-21953` already documents.

### Why not skip straight to the Firestore rebuild instead

NOW.md's own pointer is right that this whole asymmetry **dissolves** once
the rebuild's deterministic client-generated write ids
(`device+ts+seq`, written with `set()` not `add()`) land — every store
becomes idempotent by construction, and this entire per-tab table stops
mattering. That's a real reason to consider *not* investing further here.

But the rebuild's step 1 (data-model design session) hasn't started, and
`docs/Firebase_Rebuild_Scope.md` puts real classrooms on this
localStorage/Apps-Script architecture for the whole build-out window — the
beta cohort has been live on it since 2026-07-18. Item 1 above (extend
dedup to the three tabs that currently have *zero* recovery path) is cheap,
additive, needs no data-model change, and closes the worst gap — "some
scans are unrecoverable if the Sheet push fails" — regardless of how long
the rebuild takes. Item 2 (the `_sentAt` bug) is a one-line-shaped fix to a
bug already fixed once elsewhere. Item 3 (the actual automatic retry) is the
one piece worth deferring judgment on: it's real scope, and it's also the
piece the rebuild replaces outright, so there's a legitimate argument for
doing 1 and 2 now and leaving 3 for whichever lands first — the rebuild, or
a future PROPOSE-FIRST round once 1 and 2 are in.

## Recommendation

Ship 1 and 2 as a normal PR (additive, no migration, no data-model change —
EXECUTE-FREELY once this document is approved). Hold 3 for a separate
decision: either fold it into the rebuild's step 1 idempotent-write design
(cheapest, since it's being built anyway) or scope it as its own small
PROPOSE-FIRST follow-up if the rebuild's timeline turns out to be long
enough that beta rebbeim need it sooner. Not proposing 3 be built today.

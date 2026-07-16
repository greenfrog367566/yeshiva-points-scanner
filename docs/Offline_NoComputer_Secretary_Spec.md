# Menchmark — Offline Mode, Batch Import & Secretary Mode

*The complete Phase 7 "no-computer / offline" spec. Grounded in a real Tera 1300 storage-mode test dump and the app's actual primitives (`addLogEntry`, `undoEntryById`, `save`, verified in app.html). This unblocks Phase 7d — the scanner timestamp format is now known.*

---

## Why this is one spec, not four

There are four distinct offline situations, but they share one engine (a **readiness-check system** + the **batch-import parser**) and two of them layer extra concerns on top. Building them as one coherent system avoids four overlapping half-wizards.

| Scenario | Computer in room? | Internet? | Extra need |
|---|---|---|---|
| **Standard** | Yes | Yes | none |
| **Computer offline** | Yes | No | pre-download everything internet-dependent before disconnecting |
| **Scanner only** | No | (setup done elsewhere) | Personal Scoring Pages, storage mode, batch upload |
| **Fully off-grid** | No | No | both of the above stacked |

**The one principle under all of it:** *anything that needs internet must happen while you still have it.* Offline, "I forgot to generate the QR codes" is unrecoverable until you're back online. The readiness wizard's whole job is to force every internet-dependency to happen first.

---

## The real scanner data format (Tera 1300, verified)

A storage-mode dump with **Timestamp Suffix** enabled looks like this (real test scan):

```
S005 2026/07/16 09:56:42
S014 2026/07/16 09:56:42
S011 2026/07/16 09:56:43
S006 2026/07/16 09:56:44
S006 2026/07/16 09:56:44
ACT:a2 2026/07/16 09:56:53
ACT:a3 2026/07/16 09:56:53
ACT:a6 2026/07/16 09:56:53
9781422638903 2026/07/16 09:56:55
```

**Format:** `<barcode><space>YYYY/MM/DD HH:MM:SS`, one scan per line, timestamp appended (suffix). Sortable, unambiguous.

### Three findings this real data revealed (the reason the test mattered)

1. **Timestamp resolution is one second — collisions are normal.** Two scans in the same second (`S005`/`S014` both at 09:56:42; `S006`/`S006` both at 09:56:44) can't be ordered by time alone. **The parser must preserve original file order as the tiebreaker.**

2. **Same-code-same-second duplicates are genuinely ambiguous.** `S006` twice at 09:56:44 could be intentional (scanned a student twice on purpose) or an accidental double-fire. The scanner cannot tell you which. **The parser must NOT guess — it flags these for human decision at review time** (this is the "double-scan detection" gap from the design docs, surfacing for real).

3. **Stray/unknown codes happen.** `9781422638903` is an EAN-13 (a book's ISBN) — something with a barcode got scanned by accident. **Unknown codes are flagged, never silently dropped or applied.**

### The architectural consequence — Personal Scoring Pages, not arm-then-scan

Note the dump order: all **students** scanned first (09:56:42–44), then **activities** (`ACT:` codes) at 09:56:53. That's backwards from live scanning (arm activity → scan students). In a flat stored list with unreliable sub-second ordering, **the "what was armed when this student was scanned" model falls apart** — there's no live armed-state to attach.

**Therefore the no-computer workflow MUST use Personal Scoring Pages** — self-contained codes where student + activity are baked into one QR (e.g. one scan = "Yaakov, Davening, +1"). These have no ordering dependency and survive a batch intact. The `ACT:`-then-student model is only reliable live, on-screen. This is not a preference — the test data proves arm-then-scan is unreliable in batch.

---

## Part 1 — Offline Mode (the preference + its two doors)

A stored preference plus a readiness-check engine, reachable from two places.

### Data model
```js
// in `data`, backfilled in load2fix():
data.offlineMode = {
  enabled: false,
  kind: null,            // "computerOffline" | "scannerOnly"
  lastReadyCheck: null   // timestamp of last passed readiness check
};
```
(Additive, migration-safe — defaults in on load per the CLAUDE.md migration rule.)

### Door 1 — Onboarding (setup.html), LIGHT
After the class/students steps, a "how will you use this?" question:
```
How will you use Menchmark day-to-day?
  🖥️  Computer in the room, online       (most common)
  💻  Computer, but sometimes no internet
  📇  Scanner only, no computer in the room
```
- Picking a non-standard option sets `offlineMode.enabled = true` and `.kind`.
- Onboarding **does not run the full readiness check** (printing pages, test-scanning a timestamp is too much for a 2-minute flow). It *plants the flag*, explains the model in a sentence, and hands off: *"You're set for offline use — before each offline day, open Manage → Offline Mode to make sure you're ready."*
- Fully skippable; standard is the default.

### Door 2 — Manage → 📴 Offline Mode (app.html), the REAL home
A permanent Manage tile — the recurring launch point, not a one-shot:
```
📴 Offline Mode                         [ Off | On ]

  How you work offline:
    ◉ Computer, sometimes no internet
    ○ Scanner only, no computer

  [ 🧭 Check I'm ready to go offline ]   ← opens the readiness wizard
  Last checked: this morning ✓
```
- Toggle + sub-mode choice, changeable anytime (a rebbi going on a trip enables it that week).
- **"Check I'm ready" opens the readiness wizard** — re-runnable before every offline day. This is the key reason it lives in Manage, not just onboarding: the check is *recurring*, not once.
- **Not a hard fork:** like Shulchani Mode, this reshapes emphasis (surfaces offline tools, reminds to prepare) but walls nothing off. Standard features stay available; a rebbi can work online some days, offline others.

---

## Part 2 — The Readiness Wizard (the engine)

Runs the checks appropriate to `offlineMode.kind`. Advisory, not blocking (matches the low-friction philosophy) — but strongly nudges the one invisible-until-too-late check (timestamp).

### For "Computer offline" — pre-download everything internet-dependent
```
📴 Going offline? Let's make sure you have everything.

  ✓ Student QR codes generated (needs internet once — done ✓)
  ⚠ Library text "Vayelech" not downloaded — [Load now while online]
  ✓ Roster is current
  ⚠ Offline copy is stale — 2 students added since last download
      [Download fresh offline copy]
  ○ Device charged (you check this)

  Once offline, everything above works with zero internet.
  [ I'm ready ]
```
Checks: QR codes generated (your app already notes QR gen needs internet once), any library texts the rebbi uses are loaded locally, roster current, the "Download offline copy" is freshly regenerated (stale if students changed since), CDN assets self-contained.

### For "Scanner only" — the physical-day checklist
```
📇 Ready for a no-computer day?

  ✓ Personal Scoring Pages printed for all 24 students
      ⚠ 2 students added since last print — [Reprint pages]
  ○ Scanner set to Storage Mode          [How? — scan this code]
  ○ Storage cleared from last time        [Clear — scan this code]
  ○ Timestamp enabled & correct           [Test scan to verify →]
  ○ Scanner charged (you check this)

  [ I'm ready — start the offline day ]
```
The **timestamp test-scan** is the clever, high-value step: rebbi scans one code, pastes the result, wizard checks the embedded timestamp against the computer clock — catching the "wrong time / needs Tera Time Sync Utility" failure *before* the day, not after. (Your test dump is exactly what this validates: `2026/07/16 09:56:42` compared to actual time.)

### What the wizard honestly CANNOT check (must warn, not guarantee)
- Can't read the scanner's actual state — it *instructs* "scan Storage Mode," can't confirm it took. Trust + instruct.
- Can't verify battery or storage capacity — manual checkboxes, not auto-checks.
- Can't prevent mid-day mistakes (wrong page scanned, stray barcode) — those surface at review time (Part 3), not here.
The wizard's honest job: catch the checkable, clearly instruct the uncheckable, make the un-checkable risks *visible* so the rebbi accepts them knowingly.

---

## Part 3 — Batch Import (the parser + review-before-commit)

The end-of-day ingest. Same engine whether the rebbi does it themselves or a secretary does (Part 4).

### Flow
1. Paste the storage dump into a textarea (or upload a .txt).
2. **Parse** each line: split on the last space before the `YYYY/MM/DD HH:MM:SS` pattern → `{code, timestamp, fileOrder}`.
3. **Classify** each code:
   - Student (`S###` or matches a student ID)
   - Self-contained scoring code (from a Personal Scoring Page → resolves to student + activity + delta)
   - `ACT:` / `CTRL:` control code (only meaningful if arm-then-scan was used — discouraged, but parse if present)
   - **Unknown** (like the ISBN) → flagged
4. **Order** by timestamp, with **file order as tiebreaker** (sub-second collisions).
5. **Flag for review:**
   - Same-code-same-second duplicates (keep both? drop one? — rebbi decides)
   - Unknown codes (skip? — shown, never applied)
   - Any timestamp that parses to a wildly wrong date (clock-off detection)
6. **Review-before-commit screen** — a preview list showing exactly what will be applied, with the flags surfaced and editable. *Nothing touches real data until the rebbi confirms.*
7. **Commit** — each scan applied via the existing `addLogEntry` primitive, carrying its real timestamp (`ts` from the parsed value, not `Date.now()`), and **tagged with a batch ID** (see Part 4 revert).

### Timestamp handling
- Parse `YYYY/MM/DD HH:MM:SS` as **local time**.
- Per Tera's note, if the scanner clock is off, times are wrong — the review screen's date-sanity flag catches gross errors; the pre-flight test-scan (Part 2) catches it earlier. If times are systematically off, the rebbi needs Tera's Time Sync Utility (contact Tera). Document, don't try to auto-correct.

---

## Part 4 — Secretary Mode (bulk upload on behalf of others)

**⚠ This is the point where Menchmark stops being purely single-user.** One person (secretary) touches many rebbeim's data from one station. Real need (rebbeim who won't touch a computer), real new risks (wrong-target uploads, data isolation). Build carefully; it's a distinct, later sub-phase. **No accounts, no server, still local-first** — the roster is saved data on the secretary's device; each upload goes to that rebbi's *own* existing Sheet via a stored link.

### The saved-rebbi roster
```
📥 Secretary Mode — upload for someone else

  Uploading for:  [ Rabbi Cohen — 5A ▾ ]
    Rabbi Cohen — 5A          (sheet ✓ saved)
    Rabbi Levy — 6B           (sheet ✓ saved)
    Rabbi Goldwasser — 4A     (sheet ✓ saved)
    + Add a rebbi…            (name + their Apps Script / Sheet link)

  Paste today's stored scans for Rabbi Cohen:
  [ scanner dump textarea ]
  [ Review before uploading ]
```
```js
// data.secretary = {
//   roster: [ { id, name, className, sheetUrl }, ... ]
// }
```

### Guarding the #1 error: uploading to the wrong rebbi
- The selected rebbi is shown **large and repeated at every step**, especially on the review-before-commit screen: **"Uploading 37 scans to Rabbi Cohen — 5A"** — hard to misread.
- Because each rebbi has their own Sheet (the app already enforces "every teacher needs their own sheet"), the upload writes to the *selected* rebbi's link only. Picking wrong = wrong Sheet, so the confirmation is the safety gate.
- **Privacy note:** the secretary's device now holds several rebbeim's Sheet links (semi-sensitive). It should be a trusted office computer, not a shared/public one. The wizard should say so once.

### Batch tagging + Revert (honest about limits)
Every batch upload is a **discrete tagged unit**:
```js
// each committed scan carries: batchId, uploadedFor (rebbi id), uploadedAt
{ ts, sid, label, delta, batchId: "b47", ... }
```
This enables **"Revert last batch"** — find all entries with that `batchId` and reverse them, reusing the existing safe `undoEntryById` pattern (which writes correction entries, not hard deletes — consistent with how the app already undoes).

**Honest revert limits (do NOT over-promise):**
- ✅ **Reliable immediately after upload** — batch is fresh, tagged, nothing built on top. This covers the common "oops, wrong rebbi / wrong file" mistake — the case that matters.
- ⚠️ **Riskier once it's propagated to the rebbi's Google Sheet** — revert must also un-write those Sheet rows, which is harder and may lag.
- ⚠️ **Entangled once the rebbi has opened their app and scanned more on top** — the batch is no longer cleanly separable.
- **So:** revert is presented as "safest right after you notice," not "undo anything anytime." The review-before-commit screen is the *primary* defense (catch it before it's written); revert is the backstop.

---

## Build order within Phase 7

1. **Batch Import parser + review-before-commit** (Part 3) — the core engine, now fully spec'd against real data. Everything else layers on this.
2. **Readiness Wizard** (Part 2) — the pre-flight checks; depends on nothing but the preference.
3. **Offline Mode preference + Manage tile + onboarding question** (Part 1) — wires the doors to the wizard.
4. **Secretary Mode** (Part 4) — LAST, and carefully. It's the multi-user layer on top of the parser; build only once the single-user batch flow is proven solid.

Personal Scoring Pages (already in the app, preserved through the Phase 1 print reorg) are a hard prerequisite for the scanner-only path — confirm they survive and print correctly before building the scanner-only wizard.

---

## What's now unblocked

Phase 7d was "blocked on real scanner timestamp test." **That test is done** (format confirmed: `YYYY/MM/DD HH:MM:SS` suffix, 1-second resolution, `ACT:` codes survive, stray barcodes possible). The parser can be built against reality, not assumption. The three findings (file-order tiebreaker, same-second duplicate flagging, unknown-code handling) are the correctness spine of the parser.

The remaining external dependency is only for the *print* side: reproducing Tera's config barcodes on the scanner-setup sheet still needs Tera's permission (email drafted). Until then, that sheet references the manual. This does not block the import/parser/secretary work at all.

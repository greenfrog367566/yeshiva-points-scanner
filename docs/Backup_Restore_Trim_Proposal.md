# Backup & Sheets → Backup & Restore — trim proposal

*Scoped 2026-08-14, at Ben's request following the UI theory tab audit
(`docs/UI_Theory_Tab_Audit.md`), which recommended keeping this tab's card
count as-is ("each earned its place... don't invest"). Ben overrode that:
Backup stays visible by default for new users (per CLAUDE.md's "never bury
the backup path" rule), **but its internals need trimming first.** This is
that trim, scoped as a proposal — no code written.*

**Status: PROPOSE-FIRST.** Nothing here is built. It needs a yes before
implementation.

---

## The twist: this was already decided once

`Menchmark_UI_Redesign_Summary.md` §6 already settled this exact
consolidation in July 2026 — "Backup & Sheets → simplified to 'Backup &
Restore'" — and it was never implemented. So this isn't a new design
question; it's **closing a gap between a locked decision and the shipped
code**, which makes most of it EXECUTE-FREELY once approved, not a fresh
PROPOSE-FIRST design.

The one piece of real scoping work: **three cards were added after that
spec was written** (Phase 2d era) and were never reconciled against its
5-bucket model. That reconciliation is what this document does.

## Current state (live code, `app.html` ~line 3009)

12 cards in a plain 2-column grid (`.backup-grid`, CSS ~line 828 — no
section-heading mechanism, just cards in a row), followed by a separate
"Sync to Google Sheets" section (link config, buttons, a collapsed
first-time-setup `<details>` with two Apps Script code blocks):

| # | Card | In the 2026-07 spec? |
|---|---|---|
| 1 | Save everything to Google Sheet | ✅ spec'd |
| 2 | Restore everything from Google Sheet | ✅ spec'd |
| 3 | Back up everything (download file) | ✅ spec'd |
| 4 | Back up to a folder automatically | ❌ added later (Phase 2d era) |
| 5 | Install Menchmark as an app (PWA) | ❌ added later |
| 6 | Download a separate offline copy | ✅ spec'd ("nearby callout") |
| 7 | Restore from a backup (file) | ✅ spec'd |
| 8 | Restore from a Log CSV | ✅ spec'd (demote to `<details>`) |
| 9 | Export standings (CSV) | ✅ spec'd |
| 10 | Reset spendable points | ✅ spec'd (§4: "moved to Manage") |
| 11 | Start a new period | ✅ spec'd |
| 12 | Clear ALL data | ✅ spec'd |
| — | "Send standings now" button (Sync section) | ✅ spec'd removed — **being fixed in PR #275**, it was still live |

Only #4 and #5 are genuinely new territory.

## Proposed structure

Five sections, in this order, closing the gap between spec and code:

**1. Backup & Restore** (the core 2×2, unchanged from spec, cards #1/#2/#3/#7)
- Row 1: Save to Sheet now | Restore from Sheet
- Row 2: Download backup file | Restore from backup file

**2. Also backing up automatically** (new section, not in the original spec — houses cards #4 and #5, which are both "durability without a manual action" cards but via different mechanisms — folder writes vs. persistent-storage install. Neither is a restorable backup *format* the way #1–#3 are, so neither belongs inside the core 2×2; grouping them together under a shared "you don't have to remember to do this" framing is more honest than forcing either into "Backup & Restore" or inventing a third bucket for one card each.)
- Back up to a folder automatically (card #4, self-hides when unsupported — unchanged)
- Install Menchmark as an app (card #5, unchanged)
- The existing "Download a separate offline copy" callout (card #6) sits here too, per the spec's own instruction to keep it "nearby" but visually distinct — it's a working copy, not a backup format, and its own red warning text already makes that clear.

**3. Other exports** (card #9, unchanged from spec) — "Export standings CSV," small, labeled "not a backup."

**4. Emergency recovery** (card #8, unchanged from spec) — Restore from Log CSV, demoted to a collapsed `<details>` (the Text-tab setup-card collapse in PR #275 is the precedent for this exact pattern in this codebase).

**5. Danger zone** (cards #10/#11/#12, unchanged from spec, already visually separated via `.danger-zone` CSS) — Reset spendable points, Start a new period, Clear ALL data. Already isolated at the bottom; no change needed beyond what's already there.

**Sync to Google Sheets** section stays below all five, essentially as-is — link config, Resync all scans, the auto-send checkbox, first-time-setup instructions already collapsed behind `<details>`. Its "Send standings now" button is the redundant one PR #275 already removes; no further action needed here once that merges.

## What does NOT change

- No card is deleted. "Trim" means regroup and re-label, not remove capability — matches your instruction and CLAUDE.md's explicit rule against burying the backup path.
- No new mechanism, no new data field, no migration.
- The Sync-to-Sheets section's content is untouched beyond the already-in-flight button removal.
- `#folderBackupCard`'s existing self-hide-when-unsupported behavior is untouched.

## The one small companion fix worth bundling

`UI_Theory_Tab_Audit.md` item 22 (unaddressed, tiny): the subtab label reads
"Backup & Restore" (`TAB_LABELS.backup`) while the page's own `<h2>` still
reads "Backup & Sheets" — a rebbi clicks one name and lands on another.
Renaming the `<h2>` to "Backup & Restore" is a one-string fix and belongs in
the same PR as this trim, since the trim is what finally makes "Backup &
Restore" the accurate name for the page.

## Minimal-diff implementation plan (once approved)

Pure markup reorganization inside `view-backup` — no id changes, so **zero
JS changes**: every button/input id (`pushSnapshotBtn`, `exportJson`,
`folderBackupPick`, `resetScores`, etc.) stays exactly where its listener
already looks for it. This is:

1. Add five `<h3>` section headers inside `view-backup`, splitting the
   current single `.backup-grid` into five groups (or five smaller grids) in
   the order above.
2. Move the existing 12 `.bk-card` blocks under their new headers —
   cut/paste, no attribute changes.
3. Wrap card #8 (Restore from a Log CSV) in a `<details>`, matching the
   pattern already used for the Text tab's setup card (PR #275).
4. Rename the `<h2>` from "Backup & Sheets" to "Backup & Restore."
5. No `load2fix()` involvement, no `DATA_VERSION` bump, no
   `test-migration.html` implications — this never touches `data`.

Checks: JS syntax check (unaffected, but run per the validate skill anyway),
and a browser pass confirming every one of the 12 cards' buttons still work
in their new positions — this is the one place where "surgical edit" still
needs a real click-through, since a copy/paste HTML move is exactly the kind
of change that *looks* safe and occasionally isn't.

## Open question for Ben

The "Also backing up automatically" section name is a placeholder — happy to
take a better one. The other four section names are taken verbatim from the
already-approved 2026-07 spec.

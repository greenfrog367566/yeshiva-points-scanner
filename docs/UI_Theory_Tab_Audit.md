# UI Theory Tab Audit — the shipped app vs the design theory

*Produced 2026-08-14 by a six-agent audit (one per tab group + one for the
global chrome), each reading `UI_Design_Theory.md`, the redesign summary, and
the actual shipped code in `app.html`/`setup.html`. Line numbers are against
this branch's `app.html` and drift as the file changes — grep the named
function, don't trust the number.*

> 📌 **Tracked as one line in `docs/NOW.md`'s "Next, in order"** (a 27-item
> ranked punch list, this doc for the detail) rather than 27
> individual entries — NOW.md is deliberately terse and this doc is the
> backing reference. This is a **dated snapshot** — findings #25 and #26 are
> individually cited from `Onboarding_Starter_Tabs_Proposal.md` and
> `Left_Rail_Nav_Decision.md`/`UI_Design_Theory.md` respectively, which is why
> the file stays in place rather than folding into either of those. Re-verify
> any item against the real code before acting; line numbers are not durable.
>
> ✅ **Status as of 2026-08-19: 23 of 27 done.** Items 1–22 and 27 all shipped
> — items 1–6 in commit `0bf9778` (2026-08-14, though its own message
> over-claimed item 5, which PR #301 actually delivered), items 7–22 in
> **PR #301** (merged 2026-08-18), and item 27 (double-scan detection)
> separately in **PR #287** (merged 2026-08-16). Each closed item below is
> marked ✅ **DONE** with its PR/commit. **Only 23, 24, 25, 26 remain open** —
> see "Ranked shortlist" section E and the tail of section D.

**Status: everything here is a finding, not a commitment.** Items are marked:

- ✅ **settled-spec** — already decided in the design record; implementing is
  EXECUTE-FREELY territory
- 🐛 **bug** — behaves wrongly today, independent of any theory
- 🟡 **propose** — needs Ben's yes before building

---

## The headline

**The theory is already substantially shipped, and the punch list is now
mostly closed too.** The global scan bar is the cockpit model built
literally: armed pill, live strip with inline undo, sticky on every working
tab, hidden on admin tabs. Auto-arm on load, never-truncated tiles, collapsed
setup drawers, navHidden with locked escape hatches, the wizard's four steps,
contest fear-answering copy — the audit's "matches" lists are long
everywhere. Of the 27 findings this audit itself produced, 23 have since
shipped (see the status callout above); **what remains is items 23–26** —
one small comment/array inconsistency and three sequenced bigger items, one
of which (26) is explicitly blocked on #227.

## Ranked shortlist

### A. Bugs found along the way 🐛

1. ✅ **DONE (commit `0bf9778`, 2026-08-14) — Mishnayos tab silently teaches Pesukim content.** With zero mishna sets,
   `applyPesukMode` empties the dropdown but never switches the active set, so
   `pmNumbers()` still reads the active *pesukim* set — the Mishnayos tab
   shows pesukim phrases under an empty selector. Fixed: when
   `filteredSets(kindFilter)` is empty, the teach panel now hides and shows "No
   Mishnayos sets yet — add one on the Text tab."
2. ✅ **DONE (commit `0bf9778`, 2026-08-14) — Store's pending count goes stale when the log empties.**
   `renderStoreHistory()` early-returned on an empty `data.store.log` before
   updating `#storePendingCount`, so after Clear history or refunding the last
   purchase, the old "N prizes not yet picked up" stuck on screen. Fixed: the
   count assignment now runs before the early return.

### B. Already-decided spec items the code never got ✅ settled-spec

3. ✅ **DONE (commit `0bf9778`, 2026-08-14) — Remove the Trends "Send totals to Sheet" button** (`#trSendSheet` + its
   handler). The redesign summary §4 already ruled it actively harmful (pushes
   to a second, manually-triggered sheet tab that silently goes stale); it had
   shipped anyway and stuck around until this fix.
4. ✅ **DONE (commit `0bf9778`, 2026-08-14) — Shorashim emoji toggle: default OFF.** Spec decision (summary §7); the
   shipped default was ON (`shorEmoji=true`, `checked` on the toggle) until this
   fix. Session-only variable, no migration.
5. ✅ **DONE (PR #301, merged 2026-08-18) — Collapse the Text tab's setup card once real text sets exist** — the
   exact "same fix applied to Students" the summary §7 endorsed; Students had
   it, Text didn't. **Note:** `0bf9778`'s own commit message claimed this one too, but its diff never actually implemented it — PR #301 is what really shipped it.
6. ✅ **DONE (commit `0bf9778`, 2026-08-14) — Auction draws write nothing to the permanent log.** The spec'd audit fix
   (summary §5): `auFinishSpin()` recorded the winner only in mutable auction
   state — auction spending was invisible in History, never reached the Sheet,
   and failed CLAUDE.md's "is there a way back — a log entry" test. Fixed at the
   draw moment, per spec.

### C. Copy fixes — the "Tracked Items" leak, located ✅ DONE (PR #301, merged 2026-08-18)

Open item 2 of `UI_Design_Theory.md`. The engine term reached rebbeim in four
strings; all four, plus one positioning leak, are reworded now:

7. Gradebook view-note ("Columns come straight from your tracked items…" —
   used the term three times) — reworded in plain rebbi language.
8. Gradebook empty state: "No tracked items yet." — reworded.
9. Gradebook empty-range note: "Tracked items are the new shared record…" — reworded.
10. Activities tab pill badge: **"Tracked (non-point)"** → **"No points"**.

Plus one positioning leak: setup.html's restore screen said "Every **teacher**
needs their own sheet" — the one "teacher" in a file that otherwise says
rebbi. Fixed.

### D. Small disclosure/cockpit fixes — 11–22 ✅ DONE (PR #301, merged 2026-08-18), 23 🟡 propose, still open

11. ✅ **DONE — Cap the Dashboard's live Leaderboard panel at ~8 rows** with a "See
    all in Standings →" link. Previously `renderScanBoard` rendered every
    student, open by default — half the cockpit spent on a twice-a-class
    glance.
12. ✅ **DONE — Hide the Leader Board's empty-contest card.** When no contest ran,
    "🏆 No contest running right now — Start a contest…" was the *first
    element* on the most-projected page, above the leader line. Now the
    card only shows once a contest is actually running.
13. ✅ **DONE — Mark the in-progress week honestly in Trends.** The current partial week
    used to render a "▼ −N" arrow against last completed week — the exact "Dovid is
    DOWN 50% on a Tuesday" trust-destroyer. Now renders as neutral "+N so far".
    (The full Option C fix is still blocked on per-day data; this isn't that.)
14. ✅ **DONE — Cap History's initial render** (~200 rows + "Show older") — previously every
    keystroke re-rendered up to 5000 rows with 3–4 buttons each.
15. ✅ **DONE — History's search now matches activity labels and notes**, not just the
    student name.
16. ✅ **DONE — Review group's first click now lands on Pesukim instead of Text**
    (tab order unchanged — Text still reads first); **Shorashim now opens on
    Match instead of Words.**
17. ✅ **DONE — The floating points panel now seeds from the globally-armed
    activity on open**, instead of defaulting to the first activity in its own
    list.
18. ✅ **DONE — The floating-points glyph is now 🎯** (button, panel header, scan-context
    label) — previously a bare "↗" that conveyed nothing next to ⏱/🎡's
    self-explanatory pictographs.
19. ✅ **DONE — Store's Clear-history confirm now mentions pending prizes** when
    pending > 0.
20. ✅ **DONE — Raffle: the two set-once checkboxes** (spread tickets / instant
    draw) are now folded into a collapsed "Wheel options" block, matching the
    existing "Who's in this draw" pattern.
21. ✅ **DONE — Settings: the Serial/COM scanner card moved off the top** (to the
    bottom; markup reorder only).
22. ✅ **DONE — Backup tab label vs page title disagreement fixed** — both read
    "Backup & Sheets" as of PR #301. **Note:** as of `feat/backup-sheets-redesign`
    (PR #320, in review), the page is being renamed again to "Backup & Restore" —
    that PR updates `TAB_LABELS.backup` to match, so the two stay in agreement;
    watch for this item resurfacing if a future change touches one side without
    the other.
23. **Scan-bar hidden-tabs comment contradicts its array** — the comment says
    the bar stays on Students/Activities; the array hides it there. Fix the
    comment (or the array, if the old rationale stands). *(tiny)* **Still open —
    verified 2026-08-19: `GLOBAL_SCAN_BAR_HIDDEN_TABS` (app.html ~line 6870)
    still includes `"students"` and `"activities"`, while the comment above it
    still says the bar is "Visible everywhere else, including Students/Activities
    management."**

### E. Bigger items, sequenced — 24–26 🟡 propose, still open; 27 ✅ DONE

24. **Dashboard default layout still ships the two panels the spec cut.** The
    default includes a second scan input (panel-scanbar) and a Recent-scans
    panel duplicating the strip — three scan histories, two scan inputs, and
    three undo buttons on one screen. Honest route: per-panel hide toggles in
    Customize, relax `validScanLayout` to accept absent panels, drop both from
    the *default for new users only* (existing layouts untouched). *(medium)*
25. **First-run navHidden seed (open item 4) — the hook already exists.** The
    wizard bridge already seeds `navHidden.groups.learn = true` for fresh
    setups only, restore path skipped. Extending to a fuller beginner set
    (contest, trends, auction, spinner, brachos…) is one line per tab in the
    same guarded block. No new mechanism, zero risk to existing users.
    *(small)*
26. **Run-row section separators (open item 3) — after #227.** The row's 12
    tabs drop to 8 when the legacy tabs go; a tiny `MANAGE_SECTIONS` constant
    in `renderSubTabs()` gives Class/Classroom/System separators with no
    reorder and no persisted state. Sequence it after #227 so we don't style a
    row about to lose four members.
27. ✅ **DONE (PR #287, merged 2026-08-16) — Double-scan detection (open item
    1).** Built via the natural hook this note anticipated: `isDoubleScan()`
    checks same-sid-within-~2s and shows a soft, non-blocking "scanned a
    moment ago — again?" toast. No new state model, no modal, records
    nothing, blocks nothing.

## Explicitly not doing (and why)

- **Rebuilding the Dashboard to the spec's List/Class-view toggle** — what
  shipped is a different, working architecture (movable panels, per-device
  saved layouts in the field). Converging would be a redesign + migration.
- **History's spec'd contest filter and bulk undo** — would be controls 8 and
  9 on a seven-control toolbar, and the contest system was reworked (#210)
  since the spec; needs re-specifying first.
- **Full Trends redesign / Option C** — blocked on data granularity
  (`data.weekly` has no per-day breakdown); a real project, queued behind
  Firebase.
- **Shorashim six-mode trim, unified Quiz, Prizes ledger, Raffle prize
  tracking** — all settled-spec but real phase work (Phases 3–4), and
  removing shipped features is stop-and-ask. Raffle prize capture without the
  ledger would collect data that goes nowhere.
- **Contest tab** — came back clean; zero cheap fixes. The spec's "Today"
  duration is superseded by the mini contest having no duration at all.
- **Legacy tabs (Attendance/Homework/Tracker/Passes)** — the group's biggest
  80/20 violation, and exactly #227's job; they're the authoritative writers
  until the Gradebook can write, so spend nothing there. No "moving soon"
  notice either — worry for beta rebbeim, zero present benefit.
- **Brachos in the admin group** — a daily-layer page in the hidden layer, but
  no other group fits better; cost is one click after snack.
- **Three FABs on by default** — flipping the default would take a working
  tool away from existing users, the exact failure the seeds exist to avoid.
- **Auction setup card always visible** — spec explicitly ruled "no UI
  redesign, a data-integrity fix." Settled.

## What already matches (leave alone — the load-bearing wins)

Recorded so nobody "fixes" them: auto-arm on load; the scan strip's inline
per-entry undo; never-truncated activity tiles; tracked tiles with no
misleading "+0"; the seating chart's nine display options behind one ⚙; the
seat-list fallback for chart-less classes; History refusing undo/edit on
tracked rows with a reason; the Leader Board fitting a whole class on one
projector screen with the leader line first; mini-contest's two finish buttons
with two honest confirms; Coin Deposit's no-banking-language copy and
Shulchani-only visibility; Store's pending-prize visibility; Students' bulk-add
behind a details and batch bar disabled until selection; Backup's danger-zone
separation and self-hiding folder card; Settings' per-feature relocations;
single-visible-tab groups collapsing the subtab row (the Lean-mode chrome
lesson, applied); `lastTabInGroup`; the wizard ending on "Print my class
sheet"; the scan bar's context-aware pill; PiP's scoped undo.

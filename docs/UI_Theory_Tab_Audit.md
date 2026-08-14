# UI Theory Tab Audit — the shipped app vs the design theory

*Produced 2026-08-14 by a six-agent audit (one per tab group + one for the
global chrome), each reading `UI_Design_Theory.md`, the redesign summary, and
the actual shipped code in `app.html`/`setup.html`. Line numbers are against
this branch's `app.html` and drift as the file changes — grep the named
function, don't trust the number.*

**Status: everything here is a finding, not a commitment.** Items are marked:

- ✅ **settled-spec** — already decided in the design record; implementing is
  EXECUTE-FREELY territory
- 🐛 **bug** — behaves wrongly today, independent of any theory
- 🟡 **propose** — needs Ben's yes before building

---

## The headline

**The theory is already substantially shipped.** The global scan bar is the
cockpit model built literally: armed pill, live strip with inline undo, sticky
on every working tab, hidden on admin tabs. Auto-arm on load, never-truncated
tiles, collapsed setup drawers, navHidden with locked escape hatches, the
wizard's four steps, contest fear-answering copy — the audit's "matches" lists
are long everywhere. What remains is a short list of cheap fixes, two bugs,
and a few known big items that are already queued elsewhere.

## Ranked shortlist

### A. Bugs found along the way 🐛

1. **Mishnayos tab silently teaches Pesukim content.** With zero mishna sets,
   `applyPesukMode` empties the dropdown but never switches the active set, so
   `pmNumbers()` still reads the active *pesukim* set — the Mishnayos tab
   shows pesukim phrases under an empty selector. Fix: when
   `filteredSets(kindFilter)` is empty, hide the teach panel and show "No
   Mishnayos sets yet — add one on the Text tab." *(small)*
2. **Store's pending count goes stale when the log empties.**
   `renderStoreHistory()` early-returns on an empty `data.store.log` before
   updating `#storePendingCount`, so after Clear history or refunding the last
   purchase, the old "N prizes not yet picked up" stays on screen. Move the
   count assignment above the early return. *(tiny)*

### B. Already-decided spec items the code never got ✅ settled-spec

3. **Remove the Trends "Send totals to Sheet" button** (`#trSendSheet` + its
   handler). The redesign summary §4 already ruled it actively harmful (pushes
   to a second, manually-triggered sheet tab that silently goes stale); it
   shipped anyway and is still there.
4. **Shorashim emoji toggle: default OFF.** Spec decision (summary §7); the
   shipped default is still ON (`shorEmoji=true`, `checked` on the toggle).
   Session-only variable, no migration. *(tiny)*
5. **Collapse the Text tab's setup card once real text sets exist** — the
   exact "same fix applied to Students" the summary §7 endorsed; Students got
   it, Text didn't. *(small)*
6. **Auction draws write nothing to the permanent log.** The spec'd audit fix
   (summary §5): `auFinishSpin()` records the winner only in mutable auction
   state — auction spending is invisible in History, never reaches the Sheet,
   and fails CLAUDE.md's "is there a way back — a log entry" test. Fix at the
   draw moment, per spec. *(medium; touches the log — show the diff first)*

### C. Copy fixes — the "Tracked Items" leak, located 🟡 propose (tiny each)

Open item 2 of `UI_Design_Theory.md`, now with exact locations. The engine
term reaches rebbeim in exactly four strings:

7. Gradebook view-note ("Columns come straight from your tracked items…" —
   uses the term three times)
8. Gradebook empty state: "No tracked items yet."
9. Gradebook empty-range note: "Tracked items are the new shared record…"
10. Activities tab pill badge: **"Tracked (non-point)"** → something like
    "Records only, no points"

Plus one positioning leak: setup.html's restore screen says "Every **teacher**
needs their own sheet" — the one "teacher" in a file that otherwise says
rebbi. *(tiny)*

### D. Small disclosure/cockpit fixes 🟡 propose

11. **Cap the Dashboard's live Leaderboard panel at ~8 rows** with a "Full
    leader board →" link to Standings. Today `renderScanBoard` renders every
    student, open by default — half the cockpit spent on a twice-a-class
    glance. *(small)*
12. **Hide the Leader Board's empty-contest card.** When no contest runs,
    "🏆 No contest running right now — Start a contest…" is the *first
    element* on the most-projected page, above the leader line. Keep the
    active-contest banner; drop or demote the inactive state. *(tiny)*
13. **Mark the in-progress week honestly in Trends.** The current partial week
    renders a "▼ −N" arrow against last completed week — the exact "Dovid is
    DOWN 50% on a Tuesday" trust-destroyer. Cheap version: render the current
    week as neutral "+N so far" instead of an arrow. (The full Option C fix is
    blocked on per-day data; this isn't that.) *(tiny)*
14. **Cap History's initial render** (~200 rows + "Show older") — today every
    keystroke re-renders up to 5000 rows with 3–4 buttons each. *(small)*
15. **Make History's search match activity labels and notes** — today it
    matches only the student name, duplicating the dropdown beside it.
    *(tiny)*
16. **Land Review-group first click on practice, not setup** — first-ever
    click lands on the Text (setup) tab; fall back to Pesukim when real sets
    exist. Similarly, **Shorashim lands on Words (setup) every session** even
    with a full word list — default to Match when words exist. *(small each)*
17. **Seed the floating points panel's armed activity from the global one on
    open** — today `fpActId` is independent, so the panel can silently award a
    different activity than the rebbi just armed on the scan bar. Seed on
    open, stay independent after. *(small)*
18. **Give the floating points FAB a legible glyph** — "↗" says nothing;
    its siblings ⏱ and 🎡 pass the three-second test, this one doesn't.
    *(tiny)*
19. **Store's Clear-history confirm should mention pending prizes** — clearing
    destroys the only record of who is still owed a prize, and the confirm
    doesn't say so when pending > 0. *(tiny)*
20. **Raffle: fold the two set-once checkboxes** (spread tickets / instant
    draw) into a collapsed details block, matching the existing
    "Who's in this draw" pattern, so the class-facing screen is mode → wheel →
    Spin. *(small)*
21. **Settings: move the Serial/COM scanner card off the top.** The first
    thing every rebbi sees on Settings is baud rates — a card whose own copy
    says most scanners need no setup. Markup reorder only. *(small)*
22. **Backup tab label vs page title disagree** — subtab says "Backup &
    Restore", the page h2 says "Backup & Sheets". Pick one. *(tiny)*
23. **Scan-bar hidden-tabs comment contradicts its array** — the comment says
    the bar stays on Students/Activities; the array hides it there. Fix the
    comment (or the array, if the old rationale stands). *(tiny)*

### E. Bigger items, sequenced 🟡 propose

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
27. **Double-scan detection (open item 1) — implementation note.** The natural
    hook exists: `renderSeatsScanBar()` already detects new scans via
    `lastSeatsScanId`, and `award()` has sid+ts — a same-sid-within-2s check
    before the flash gives the soft "was just scanned — again?" with no new
    state model and no modal.

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

# Left-rail navigation — can it work? (PROPOSE-FIRST, not a spec)

*Written 2026-08-15 against the "Menchmark nav — before / after mockup"
artifact (2026-08-11) — a clickable sidebar-rail proposal built from
`app.html`'s real tab inventory. This doc checks that proposal against the
settled design record and `docs/NOW.md`, and against `UI_Design_Theory.md`
(the ChatGPT pieces Ben shared 2026-08-14). Nothing here is decided; it's the
PROPOSE-FIRST case plus the specific questions that need Ben's yes/no.*

---

## 1. Short answer

**Mechanically, yes — the tab system was built decoupled enough that a
sidebar is a real layout swap, not a rearchitecture.** But the mockup smuggles
in one change that isn't just layout: **splitting "Run" into Tools/Setup
would undo a deliberate, already-shipped, ChatGPT-endorsed decision** to hold
the line at exactly 5 top-level groups. That's not a CSS question — it needs
an explicit yes from Ben before anything gets built, and this doc treats it as
the central open item rather than something the mockup gets to assume.

There's also a live process question: the Firebase rebuild is mid-design with
routing (step 4) already locked around the current group/tab keys, and
`docs/NOW.md` has a real queue. This section of the doc says where a nav
rework would sit in that queue, not just whether it's buildable.

---

## 2. What the code actually supports (feasibility)

Checked against `app.html` ~5450–5610:

- **`TAB_GROUPS`/`GROUP_ORDER`/`TAB_LABELS`** are pure data — label, icon,
  ordered tab list — with no assumption baked in about a horizontal strip.
  `renderGroupTabs()` writes into `#groupTabs`, `renderSubTabs()` writes into
  `#subTabs`. A sidebar swaps what container those two render into (one nav
  column instead of two stacked rows) without touching the data shape, the
  persisted internal keys, or `activateTab()`'s dispatch body. This is a
  **CSS/DOM change, not a data-model change** — CLAUDE.md's migration rules
  don't engage.
- **`isGroupVisible()` / `groupVisibleTabs()` / `navHidden()`** are already
  visibility-only logic, independent of layout. The sidebar's collapsible
  group headers can call these exactly as the top-strip version does.
- **One real landmine, already paid for once:** `renderSubTabs()` returns
  early — no subtab row at all — when a group has fewer than 2 visible tabs
  (`app.html` line ~5563, comment: *"single-tab groups (or all-but-one hidden)
  show no subtab row"*). This is the exact lesson from Lean/Simple mode
  (#121, PR #150, reverted same day 2026-08-05): one visible tab per group
  left an empty subtab row and a wasted header row. **The sidebar mockup's
  collapsible group headers (`.sbg-head`/`.sbg-items`) already dodge this** —
  a group with one tab just doesn't need an expand arrow — but any real build
  must keep testing against that specific chrome failure, not just the
  philosophy.
- **The router (Firebase step 4, approved 2026-08-13) is nav-shape-agnostic.**
  `#/c/{classId}/{group}/{tab}` reads `{group}`/`{tab}` as the same persisted
  internal keys regardless of what widget triggers `router.go()`. A sidebar
  click handler calling `router.go({classId, group, tab})` instead of a
  top-tab click handler is exactly the "one extra line per call site"
  discipline that doc already commits to. **No conflict, no rework needed on
  the routing design** — but seeing that doc already generalized on this
  point supports building the sidebar structurally as "a `router.go` caller,"
  which the mockup's plain `onclick` handlers aren't yet.
- **Global scan bar, FABs, and `applyGlobalScanBarVisibility()`** hide the
  scan bar on a fixed tab list (Settings, Backup, Students, Activities, the
  Print group, Text). None of that logic reads DOM position — it toggles a
  class on `#globalScanBar` by tab name. Fully portable to a sidebar layout.

**Net: the rail/collapse mechanic, the icon-only 54px state, and the
render-target swap are all buildable against the existing tab-group engine
with no data risk.** The open questions below are about product shape and
sequencing, not about whether the code can hold it.

---

## 3. The one decision the mockup assumes but hasn't been asked for

`UI_Design_Theory.md` §2 records that the ChatGPT review of the July redesign
**specifically endorsed "keep exactly 5 tabs and add no more"** as one of its
ranked wins — and `Menchmark_UI_Redesign_Summary.md` §1 records that the
5-group structure itself was a deliberate *reduction* from an earlier 6-group
structure that had **separate Tools and Setup groups**, folded together
specifically to cut the count. `app.html`'s `GROUP_REMAP` (`{tools:"manage",
setup:"manage", print:null}`) is the fossil of that exact prior structure —
saved data from before the consolidation still remaps `tools`/`setup` onto
`manage` today.

The mockup's "After" state re-introduces that split — `GROUPS_AFTER` in the
artifact carries `tools` and `setup` as two groups instead of one `manage`,
i.e. **6 top-level groups, the same shape that was already tried and
deliberately un-shipped.** That doesn't make it wrong — a sidebar changes the
cost of an extra group (it's one more collapsible header, not one more tab
squeezed into a finite-width strip, which was arguably *why* 5-groups mattered
under the old layout) — but it does mean:

> **The split-Run-into-Tools/Setup decision needs to be re-litigated on its
> own, explicitly, not adopted as a side effect of "let's try a sidebar."**
> The two proposals are separable: a sidebar can ship with `manage` intact as
> one collapsible group of 12, and the Tools/Setup split can be evaluated
> independently of layout.

Worth naming precisely what changes if the split happens: `GROUP_ORDER` grows
from 5 to 6 keys, `TAB_GROUPS.manage`'s 12-tab array splits into two, and
`groupOfTab()` and every place that special-cases `"manage"` by name (the
`isGroupVisible`/`firstVisibleTab` `g==="manage"` checks, the router's
`schoolId`-agnostic group lookups) needs a second special-cased key alongside
it, or a rule that stops hardcoding "manage" and reads "the group holding
Settings" instead. Small, but it's exactly the kind of thing CLAUDE.md's
"surgical edits only" rule wants named before it's touched, not discovered
mid-PR.

---

## 4. Cross-check against `UI_Design_Theory.md`'s actual theory

The theory's core claims, and how the sidebar mockup does or doesn't answer
them:

- **Cockpit model / one-handed rule** — the mockup keeps the global scan bar
  pinned under the top line on every Record-group screen and doesn't touch
  the armed-pill/undo mechanics. Neutral: the sidebar is a navigation change,
  not a scan-flow change, so this claim isn't really being tested by it.
- **"Hide half the controls" / progressive disclosure** — the mockup's
  Customize-mode toggle for the reorder arrows (dot 3 in the legend) is new
  and is a genuine disclosure win: 31 controls → 13 at rest on the Dashboard,
  with nothing removed, only deferred behind an explicit toggle. This is
  *exactly* the theory's closing diagnosis ("hide half the controls") applied
  correctly — worth evaluating on its own merits independent of the
  rail/sidebar question, since it doesn't require the sidebar to ship.
- **"Don't punish beginners for power users"** — the sidebar's collapse-to-
  rail state and per-group collapsible headers are a real answer to this that
  the current top-strip layout structurally can't offer (a top strip has
  nowhere to hide 12 Run tabs except a second scrollable row). This is the
  strongest genuine argument *for* the sidebar specifically, not just for
  decluttering in general.
- **Three-second rule** — actually a small regression risk worth flagging:
  the mockup's default state opens on the Record group with the sidebar
  expanded (212px), which eats horizontal width from the Dashboard's
  List/Class-view toggle that the July spec already fought to keep unscrolled
  on a projector. The theory's own "no scrolling" complaint (already
  addressed once, per redesign summary §10) could regress if the rail isn't
  collapsed by default on first load, or on the seating-chart fullscreen
  path specifically. Needs a call: does Record/Dashboard force rail-collapsed
  state regardless of the rebbi's last choice?
- **ChatGPT was reasoning from a stale snapshot ("7,000-line app")** — worth
  repeating here because it applies again: any fresh review of *this* mockup
  should be checked against the shipped code the same way `UI_Theory_Tab_Audit.md`
  did for the redesign spec, not taken as ground truth on its own.

---

## 5. Where this sits against `docs/NOW.md`

`NOW.md`'s "Doing now" is the Firebase rebuild (design phase done 2026-08-14,
next is an implementation session gated on a real Firebase/GCP project — Ben's
action) plus the #227 legacy-tab removal, the update-check PR, offline resync,
and the small standalone items. **A nav layout rework isn't in that queue at
all right now.** Two sequencing questions worth naming rather than assuming:

- **Does a sidebar rebuild happen before or after #227** (dropping the four
  legacy Attendance/Homework/Tracker/Passes tabs from `manage`)? Building the
  sidebar against a 12-tab Run group that's about to shrink to 8 means either
  redoing the sidebar's Run/Tools/Setup grouping once #227 lands, or building
  it deliberately after. `UI_Theory_Tab_Audit.md` finding #26 already flagged
  this exact ordering for the (smaller, non-sidebar) section-separator idea —
  same logic applies here, more so.
- **Does it happen before or after the Firebase rebuild's step 6** (the
  admin's cross-class Gradebook view, which is speced to build its own class
  picker against `router.switchClass`/`currentClassId`/`listSwitchTargets`)?
  The sidebar mockup's top-line class-switcher pill is cosmetically similar to
  what step 6 needs but isn't wired to the router primitives at all yet — it's
  a static label. If the sidebar ships first, step 6's picker has a home to
  build into; if the rebuild's routing lands first, the sidebar gets to build
  its switcher against real `router` calls instead of guessing the contract.
  Either order works technically; it's a "which first" call, not a blocker.

Neither of these is a reason not to do it — they're both "pick an order"
questions, the kind CLAUDE.md's agentic-work-mode section calls PROPOSE-FIRST
because the answer is a judgment call about priorities Ben holds, not
something derivable from the code.

---

## 6. What would need to be true to start building

If this gets a yes, the honest phased-implementation shape (matching the
theory's own "phased implementation rather than one big pass," which the
review ranked as a specific win):

1. **Layout swap only, `manage` unsplit.** Replace the two top strips with
   one sidebar, same 5 groups, same tabs, collapse-to-rail working. Zero data
   risk, testable entirely in the browser, no router changes needed. This
   alone answers the "beginner sees 12 Run tabs in one flat row" problem by
   moving them into a collapsible column — worth checking whether that's
   enough before touching the group count at all.
2. **Customize-mode disclosure** (dashboard reorder arrows behind a toggle) —
   separable, ships with or without the sidebar, smaller review surface.
3. **Tools/Setup split** — only after (1) is evaluated and Ben explicitly
   re-affirms leaving the 5-group decision, given it was deliberately
   consolidated once already with ChatGPT's blessing on the 5-group count
   specifically.
4. **Class-switcher wiring** — sequenced against Firebase step 4/6 per §5
   above, not before.

## 7. Open items needing Ben's yes/no

- Does the Tools/Setup split happen at all, given it reverses a decision the
  ChatGPT review specifically praised? (§3)
- Does the sidebar force rail-collapsed on first load / on Record, or respect
  whatever the rebbi last set? (§4, three-second-rule risk)
- Sequencing: before or after #227? Before or after Firebase step 4/6? (§5)
- Is a full sidebar worth building now, given `NOW.md`'s actual queue is the
  Firebase rebuild + #227 + several small items — or does this wait?

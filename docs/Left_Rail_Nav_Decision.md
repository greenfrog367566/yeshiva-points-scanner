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

---

## 8. Second review (ChatGPT, 2026-08-15) — converges, sharpens the default state

Ben ran this doc back through ChatGPT. The verdict: **yes to the rail, no to
the Tools/Setup split, not immediately** — independently landing on the same
split this doc argued for in §3 and §6-step-1 (evaluate `manage` unsplit
before touching group count), which is worth recording as real convergence
rather than one source echoing the other. Three things from that pass are
worth folding in:

**Default state should be icon-only, not the mockup's 212px expanded rail.**
This doc's §4 already flagged the expanded-by-default state as a
three-second-rule regression risk against the Dashboard/seating-chart
horizontal space the July redesign fought to protect — the second review
independently reached the same conclusion and is more specific about the
fix: **default to the icon rail (54px), expand only the active group's items
on click, and use hover for a label tooltip in icon state.** That resolves
§7's open "does the sidebar force rail-collapsed" question with a concrete
answer rather than leaving it open — collapsed-with-active-group-open is the
proposed default, not merely "collapsed" or "whatever was last set."

**Sequencing: after #227, not after the whole `NOW.md` queue.** §5 asked
"before or after #227 / before or after Firebase step 4/6" without picking a
side. The second review's argument for a specific answer: Firebase (auth,
Firestore, routing) doesn't change what the *nav* looks like or how many Run
tabs there are, so waiting on it buys nothing for evaluating a sidebar —
whereas #227 directly changes the Run group's tab count (12 → 8), and
evaluating a sidebar's "12 tabs in one flat row vs. one vertical accordion"
premise against a Run group that's about to shrink means either re-evaluating
after or building against a stale count. **Proposed order: finish #227 →
build a CSS-only sidebar prototype → use it for a real week of class →
revisit the Tools/Setup question with real usage data instead of a mockup
guess.** This still leaves the sidebar *behind* #227 in the queue, not ahead
of Firebase generally — Firebase's own step 6 (admin cross-class picker) can
still land its `router.switchClass`-wired class switcher into the sidebar
whenever that step is actually built, per §5's second bullet.

**The falsifiable prediction worth testing, not assuming.** Both reviews now
agree on a specific hypothesis rather than a vibe: *the Run group's problem
was never really "12 tabs," it was "12 tabs in one horizontal strip with no
overflow behavior."* A vertical accordion may make that problem disappear
without a group split at all. That's exactly the kind of claim a week of real
classroom use answers and a mockup can't — which is the concrete reason to
build step 1 (unsplit sidebar) before spending any more design time on step 3
(the split).

**Updated §7 answers, pending Ben's final confirmation:**
- Tools/Setup split → **not now**; revisit only after a real week with the
  unsplit sidebar, per the prediction above.
- Default rail state → **icon-only (54px), active group expands on click,
  hover shows a label tooltip in collapsed state** — not the mockup's
  always-212px default.
- Sequencing → **after #227, independent of the Firebase timeline** — #227
  changes what's being evaluated; Firebase doesn't.
- Still genuinely open: is this worth scheduling into `NOW.md` at all right
  now, or does it wait behind #227 as a "next, in order" item rather than
  jumping the queue? That's the one question neither review answers for Ben.

---

## 9. Third review (ChatGPT, 2026-08-15) — rollback safety, reframing the test, one parked idea

Two concrete process improvements worth adopting into the plan, plus one idea
explicitly marked "not now" that shouldn't quietly become scope creep.

**Ship it behind a settings toggle, not as a replacement.** §6's step 1
("layout swap only") didn't say how the old and new nav coexist during
evaluation. The concrete answer: a `navHidden()`-adjacent Settings checkbox
("Use experimental left navigation") that renders the same `TAB_GROUPS` data
into whichever layout is selected, defaulting off. Ben is the only daily user
of this app in a real classroom during the evaluation week — a one-setting
rollback beats "revert the branch" if the sidebar has one bad day mid-lesson.
This also sidesteps a version of the Lean-mode lesson from §2: ship the new
chrome as a switchable mode from day one rather than a flag day, since the
Lean-mode revert (#121) cost a same-day rebuild specifically because there
was no in-between state to fall back to.

**Reframe what "evaluate for a week" is actually testing.** Not "does the CSS
render correctly" (that's a five-minute browser check) but a specific list of
classroom questions: *Can Attendance be reached faster? Can Store? Does the
seating chart feel less crowded with the strips gone? Can navigation happen
one-handed while teaching, per the theory's own one-handed rule?* Framing the
evaluation as a Yes/No against these specific questions — not a vague
"how does it feel" — is what makes the week produce an actual answer to the
falsifiable prediction in §8, rather than an impression.

**Parked, explicitly not adopted here:** the review also floated a much
bigger idea — that Menchmark, Chazaroom, and a future quiz/assessment system
share one underlying pattern (physical code → scan → immediate feedback →
automatic recording), and that the top-level nav could eventually reflect
that as something like `SCAN / REVIEW / ASSESS / REWARDS / MANAGE` across
products rather than five groups inside one app. **This is out of scope for
this doc and this PR on purpose** — it's a cross-product architecture
question (this repo's `manage`/`learn`/etc. groups are Menchmark-internal;
Chazaroom is a separate codebase per this repo's recent branch history), it
has no bearing on whether the sidebar ships, and treating it as live scope
here would be exactly the kind of "reorganize the world because a mockup
suggested it" mistake §3 already flagged once. Recorded here only so it isn't
lost, and only so a future session doesn't rediscover it as if new.

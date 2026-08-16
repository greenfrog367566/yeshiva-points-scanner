# Onboarding Starter Tabs — Proposal

*Drafted 2026-08-14. Status: **PROPOSED** — nothing here is built. This is the
design for the onboarding half of #121, the part the Lean-mode revert
deliberately left unsolved: a new rebbi still opens on 4 groups and ~20 tabs,
11 of them in Run.*

---

## 1. The problem, restated precisely

A brand-new rebbi finishing the setup wizard lands on:

| Group (label) | Visible tabs today, fresh setup |
|---|---|
| Record | Dashboard, History |
| Recognize | Leader Board, Trends, Contest |
| Reward | Raffle, Auction, Store (+ Coin Deposit if Shulchani) |
| Review | *(already hidden — see §3)* |
| Run | Seating chart & print, Students, Activities, Brachos, Spinner, Passes, Attendance, Tracker, Homework, Gradebook, Backup & Restore, Settings |

That is ~19 leaf tabs on day one, 12 of them in Run. Nothing is wrong with any
individual tab; the day-one *experience* is a toolbox. The frequency argument
is the familiar one: during a class, a rebbi scans constantly, changes
activities occasionally, glances at the leaderboard, marks attendance once —
and touches Spinner, Brachos, Tracker, Contest, Auction approximately never.
The first-open screen should reflect those frequencies.

## 2. What this is NOT (settled ground, not re-litigated)

- **Not Lean/Simple mode.** #121's mode was built (PR #150) and reverted the
  same day; decided 2026-08-05, not coming back. A *mode* derives visibility
  live and fights the rebbi's own choices. This proposal writes nothing live.
- **Not hide-until-ready.** The `load2fix()` `navHidden` seeds
  (`contestHiddenSeeded`, `gradebookHiddenSeeded`) hide features that are
  *broken or unfed*, and deliberately fire for existing saves. This proposal
  hides features that are merely *advanced*, and must **never** touch an
  existing save. Different mechanism, different trigger point, kept apart on
  purpose.
- **Not a new visibility system.** Everything rides on `data.navHidden` and
  the Settings → "Tabs shown" checkboxes that already exist
  (`renderNavVisibilitySettings()`, app.html ~8493). Zero new state shape.

## 3. The precedent this extends (already shipped)

The setup wizard **already does exactly this for one group.** In the wizard
apply block (app.html ~23745), a fresh setup writes
`data.navHidden.groups.learn = true` — Review starts hidden — with three
properties this proposal inherits wholesale:

1. **One-time WRITE at first-run, not a live preset.** The code comment there
   spells out why this is the shape that doesn't repeat Lean's mistake: a
   rebbi's later un-hiding is his own saved answer and never gets stomped.
2. **Wizard-only, and skipped when `restoring`.** A rebbi coming back from a
   backup or his Sheet already has his own answer saved in the data being
   restored; a fresh-install default must not overrule it. Existing rebbeim
   are structurally untouchable — this code path only runs for a setup that
   came through the wizard.
3. **Fully reversible in Settings**, where `manage`/`settings` are locked
   visible so there is always a way back.

The proposal is: **extend that one-line seed to a starter set.**

## 4. The starter set (the actual design decision)

On a fresh, non-restoring wizard completion, seed `data.navHidden.tabs` so the
first open shows:

| Group | Day-one tabs | Seeded hidden |
|---|---|---|
| Record | Dashboard, History | — |
| Recognize | Leader Board | Trends, Contest |
| Reward | Raffle, Store | Auction |
| Review | *(group hidden — unchanged, existing seed)* | — |
| Run | Seating chart & print, Students, Activities, Attendance, Backup & Restore, Settings | Brachos, Spinner, Passes, Tracker, Homework, Gradebook |

**~11 tabs instead of ~19, and Run drops from 12 to 6.**

Reasoning per line, so each can be overruled individually:

- **Dashboard + History stay.** History is the "did that scan register /
  undo a mistake" surface — part of the in-class loop, not admin.
- **Leader Board stays; Trends and Contest hide.** The leaderboard is the
  daily motivator. Trends is a review tool for later weeks; Contest is an
  event a rebbi runs deliberately, and it went an entire hide/un-hide cycle
  (#133 → #210) without anyone losing it.
- **Raffle and Store stay; Auction hides.** *(Decided by Ben, 2026-08-14 —
  overrules the original draft, which hid Store.)* Points need somewhere to
  spend/redeem from day one beyond the raffle draw, and Store is the direct
  "points → reward" surface a new rebbi is likely to set up alongside the
  roster. Auction is the one-off/occasional mechanic and stays hidden. Coin
  Deposit already live-gates on Shulchani Mode and is untouched.
- **Seating chart & print stays** — non-negotiable: it prints the codes;
  without it there is nothing to scan. Same for **Students** and
  **Activities** (roster and point values are day-one setup), and
  **Settings** (locked visible anyway).
- **Backup & Restore stays.** RISK CALIBRATION forbids demoting or burying the
  Sheet backup path; hiding this tab at first run would bury it exactly when a
  new rebbi should be wiring it up. It stays, full stop.
- **Attendance stays; Passes, Tracker, Homework, Gradebook hide.** Attendance
  is the one legacy-store tab with a genuine daily cadence, and "Mark the rest
  Present" plus the seating badges assume the habit. The other three are
  either weekly (Homework), occasional (Passes), or power-user (Tracker), and
  the Gradebook is their *review* surface — meaningful once there is data,
  noise on day one. **#227 interaction:** when a legacy tab is removed by #227,
  its line simply leaves this seed list, and Gradebook should move to the
  day-one column at that point (it becomes the only attendance/homework
  surface). The seed list is one array; that edit is a one-liner per slice.
- **Brachos and Spinner hide.** Self-contained tools a rebbi finds when he
  wants them.

Renders cleanly with today's code: `renderSubTabs()` already suppresses the
subtab row for single-tab groups (the guard at ~5560 — the empty-row half of
what killed Lean mode is already fixed), and `isGroupVisible()` already drops
a fully-hidden group from the nav.

## 5. Discoverability — how the hidden 9 get found

Two pieces, one required, one recommended:

1. **(Required, near-free) One sentence on the wizard's finish screen:**
   *"Menchmark starts you with the essentials. Turn on more tools any time in
   Settings → Tabs shown."* Honest, sets the expectation, costs one string in
   `setup.html`.
2. **(Recommended) A "＋ More" affordance at the end of the group-tab row** —
   a small, visually-quiet pseudo-tab rendered by `renderGroupTabs()` whenever
   at least one group or tab is hidden (by seed *or* by the rebbi — no
   distinction, no extra state), which jumps to Settings scrolled to the
   "Tabs shown" card. This is what turns "hidden" into "one click away"
   instead of "gone." It also retroactively helps the already-shipped Review
   hide, which today has no in-nav breadcrumb at all.

   If the always-on version feels noisy for power users who hid tabs on
   purpose, the fallback is to show it only while `data.navHidden` still
   matches the untouched seed — but that needs a "seed fingerprint" and is
   more state for a marginal win. **Recommendation: always-on when anything
   is hidden.** It is one small button, and it doubles as a feature.

**Deliberately no wizard question** ("start simple vs. show everything").
The Review-group seed shipped silently and nobody has asked for the group
back-by-default; a question adds a decision to the exact flow this proposal
exists to lighten. Settings is the change-your-mind path, same as Shulchani.

## 6. Data-safety answers (the four standing questions)

- **Data gone or wrong?** No store is touched, created, or read differently.
  Hidden tabs' stores keep working — attendance scanning, tracked activities,
  and the mirror are all independent of tab visibility (Contest and Gradebook
  both proved this through full hide/un-hide cycles).
- **Destructive sharing a button with benign?** Nothing destructive exists
  here; the seed is additive keys in `navHidden.tabs`, each reversible by its
  existing Settings checkbox.
- **Dialog promising what code destroys?** No dialog.
- **Way back?** Settings → Tabs shown (locked reachable), plus the §5 "＋ More"
  affordance.

Migration surface: **zero.** No new `data` fields, no `load2fix()` change, no
`DATA_VERSION` bump — `navHidden` and its guards already exist. The only
writes are inside the existing wizard-apply block, behind the existing
`!restoring` guard. `test-migration.html` is unaffected (nothing in
`migrateData()`/`load2fix()` moves), though the browser pass should still
walk: fresh wizard → starter nav; restore-from-backup → full nav untouched;
Settings re-enable → sticks.

## 7. Build shape (if accepted)

One PR, small:

1. `app.html` wizard-apply block (~23745): extend the existing `!restoring`
   seed with the §4 tab list (a `["trends","contest","auction",
   "brachos","spinner","passes","tracker","homework","gradebook"]` loop next
   to the `learn` line, same comment discipline).
2. `app.html` `renderGroupTabs()`: the "＋ More" pseudo-tab (§5.2) — renders
   when anything is hidden, `activateTab("settings")` + scroll to
   `navVisibilityBox`.
3. `setup.html` finish screen: the one sentence (§5.1).
4. CHANGELOG under `[Unreleased]` → `### Added`, in the rebbi-facing voice:
   why the app starts smaller, that nothing was removed, where the switch is,
   and that existing rebbeim see no change at all.

## 8. Open for Ben (the judgment calls)

1. **Attendance in or out of the day-one set?** In, as drafted — it is the
   one daily-cadence tab. Out would make day-one purely scan/points.
2. **Raffle in, or hide the whole Reward group day one?** In, as drafted —
   rewards are the motivator half of the pitch.
3. **The "＋ More" affordance: always-on (as recommended) or seed-only?**
4. Any tab you'd move between columns in §4 — the list is the proposal.

✅ **Decided 2026-08-14 (Ben): Store joins the day-one set, moved out of
seeded-hidden.** §4's table and reasoning updated above; Auction stays hidden
alone in Reward. Everything else in this section is still open.

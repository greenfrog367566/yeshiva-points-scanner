# Changelog

All notable changes to this project are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't follow strict semantic versioning (it's a classroom tool, not a library), but version numbers roughly mean:

- **Major (v1.0.0 → v2.0.0):** big changes, possibly a new data format
- **Minor (v1.0.0 → v1.1.0):** new features
- **Patch (v1.0.0 → v1.0.1):** bug fixes only

## [Unreleased] — v0.4.0

### Added

- **Scan history strip in the global header bar.** The old green/red flash box is replaced by an inline strip showing the 3 most recent scans (or however many fit the bar width) fading from bold to muted left-to-right. The most recent entry shows a running total ("→ 9 pts"). Each entry has its own ↩ Undo button. Activity-change events (arming a different activity) also appear inline as brass-colored chips, pushing older scans to the right. The strip fills the available bar width dynamically — wider screens show more entries.
- **Contest history.** A "💾 Save to history" button saves any active contest as a snapshot. Contests are also auto-saved when cleared. The new **Past Contests** section (always visible at the bottom of the Contest tab) shows each saved contest as a card with: ranked per-student totals as chips, a student filter dropdown that shows that student's individual contest total prominently, a **Merge into main score** action (for contest-only contests), and a **Delete from history** action. The active contest's history list also gains a student filter with a running total banner.
- **Learn section restructured into 5 proper sub-tabs** (Text / Chart / Pesukim / Mishnayos / Shorashim), replacing the old two-tab "Learn / Shorashim" layout. These appear in the main sub-tab nav bar — no more inline mode buttons inside the view.
  - **Text tab** — the full import panel (AI prompt builder, CSV paste, set manager, stitch tool), accessible from one dedicated tab instead of always sitting above the chart.
  - **Chart tab** — the testing chart, unchanged, showing all sets.
  - **Pesukim tab** — Teach and Matching game, filtered to Pesukim (`kind="pasuk"`) sets only. Contains its own **Teach / Matching game** toggle. The teach view has a pasuk dropdown with ‹ › prev/next buttons; the matching game has the same.
  - **Mishnayos tab** — same Teach and Matching game, filtered to Mishnayos (`kind="mishna"`) sets only. Shows "No Mishnayos sets yet — add one in the Text tab" when none exist.
  - **Shorashim tab** — the existing Shorashim section, unchanged.
  - The tap panel ("Tap a name to give points") is removed from the Pesukim and Mishnayos pages.
- **Spinner: student selection and saved lists.** In Class names mode, each student now has a checkbox — uncheck to exclude from the spin. **All** / **None** quick-select buttons and a selected-count label ("14 selected") appear above the list. A **💾 Save selection as list…** button saves the current checked subset as a named list. The custom list box also has its own **💾 Save as list…** button. A new **Saved lists** mode shows all saved lists (class subsets and custom item lists), each with a **Use this list** button and a **Delete** button.
- **Seating chart setup controls now collapsible.** In Seating chart view, the Rows/Cols inputs, Print button, and Arrange button sit behind a **⚙ Setup** toggle — the chart itself is always visible. Preference is saved.
- **Scan bar hidden on all Setup tabs** (Students, Activities, Backup & Sheets, Settings) in addition to the Print tabs it was already hidden on.
- **Teach and Shorashim tap panels: activity picker.** Both "Tap a name to give points" panels now have a dropdown to pick which activity to award on tap, instead of always using the globally armed activity. The first option ("current") uses the armed activity as before; selecting any other awards that activity regardless of what's armed elsewhere.

### Changed

- **Scan input bar halved in width** to give the history strip more room.
- **Header scan bar 10% larger** — slightly bigger text and padding throughout.
- **Print bug fix: scan bar and sub-tab icons no longer appear on any printed output.** The `#globalScanBar` element and the `.subtabs-row` / `.subtabs-icons` elements are now explicitly hidden in all `@media print` rules. Previously they leaked into every print job, appearing as stray icons at the top of the page.
- **Seating chart print bug fix:** same class as above — the scan bar was appearing at the top of seating chart prints.
- **Spinner: "No students selected" shown on empty wheel** instead of "No students in this class" when all students are unchecked.

## [0.3.0] — 2026-07-10

### Added
- **Print the seating chart with names and QR codes** (QR Labels tab, moved to the top of that tab for easy access): prints the current class's seating chart full-page, laid out like the chart on the Scan tab — each seat shows the student's name and their scoring QR code, sized compactly (not stretched to fill the page), with a title showing which class it's for. Empty seats print blank. Choose **Portrait** or **Landscape**, both of which now correctly use the full page width for their orientation.
- **Chinese Auction: each prize can now have its own point cost per ticket**, instead of every ticket always costing a flat 1 point. Set it when adding a prize ("Pts/ticket"), or click the cost tag on an existing prize to change it. Only applies in "Each student's points" mode. **"Divide ALL students evenly"** now correctly accounts for each prize's own cost when splitting a student's points.
- **New label template: Avery 5911** (Business Cards, 2"×3½", 10/sheet) — available everywhere Avery printing already works.
- **QR code printing now follows the class picked in the header.** Student labels, the Activity menu, and Personal scoring pages all automatically filter to the currently selected class. The per-tab group dropdowns still work as a manual override, which sticks until the header class actually changes again.
- **Raffle: after-win options.** Once a winner is drawn, choose **Keep that ticket in the pool** (default), **Remove that one ticket**, or **Remove [name] from the pool** — works the same in both raffle modes. An **"↺ Un-remove everyone"** control clears all removals to start fresh.
- **Raffle: "Spread tickets around the wheel" checkbox** — spreads each student's tickets into individual thin slices, shuffled around the wheel, instead of one grouped slice. Purely visual; odds are unaffected.
- **QR-code mode in the floating Points popup** (**⬛ QR** button): shows a grid of QR codes on screen — activities, then students — so you can scan the screen itself instead of needing printed labels.
- **Per-activity group filtering.** Each activity can be restricted to specific groups via a checklist on the Activities tab. The Scan tab's buttons only show what applies to the current class, and scanning a student outside an activity's allowed groups shows a short error instead of awarding points.
- **Customizable Scan-tab layout.** Five movable sections (Activities, Scan box, Recent scans, Leaderboard, Class list) instead of one fixed arrangement. **⚙ Customize layout** to drag-and-drop or use ▲▼⇄ buttons; choose **2 or 3 columns**; **↺ Reset layout** restores the default. Scanning automatically exits Customize mode.
- **Persistent header scan bar**, on every tab: a label shows what a scan will currently do (Points, Store, Passes, Pesukim, Game Show, Save board, etc.), computed from whichever tab is open. In Points context it's a live activity pill — click to open a dropdown and arm a different activity from anywhere. A brief confirmation flash appears after every scan. Points/Timer/Picker are now icon-only buttons (↗ / ⏱ / 🎡) to make room for it.
- **Teach mode phrase-by-phrase navigation** (Pesukim tab): ← → keys, ‹/› buttons, and two QR codes (**CTRL:PASUKPREV** / **CTRL:PASUKNEXT**) step through a pasuk's phrases, highlighting the active one and auto-revealing its translation. A **↻ Repeat pasuk / → Continue on** toggle controls what happens at the last phrase.
- **Setting: "Tapping a student shows their points breakdown instead of giving points"** (Settings tab, off by default).
- **Avery-label printing** for Print point cards, the Activity menu, and Personal scoring codes.
- **Settings: "Show the Points / Timer / Picker shortcut buttons"** and **"Show the Hebrew date next to the regular date"** (both on by default).
- **`data.version` field and a `migrateData()` function**, following the pattern already documented in CONTRIBUTING.md.

### Changed
- **The custom-amount controls now live with the activity buttons**, under one "Activities" section.
- **Trimmed explanatory text on the Scan tab** to one short line under the title.
- **The header is now a single bar, locked to the top of the page**, so the scan bar is never scrolled out of reach.
- **`sample-backup.json` is now a realistic fixture** with sample students and scan history, useful for testing import/export.

### Fixed
- **The "Customize layout" button no longer looks stuck-highlighted after finishing** — it was a lingering focus ring, not an actual stuck state.
- **The Leader Board tab now updates live after each scan**, not just on tab-switch.
- **Activity menu and Personal scoring pages printing had extra blank space at the top of the page** from an inline margin never reset for print.
- **Activity menu printing (tile view): rows could look misaligned** when a long subtitle wrapped to two lines. Added text truncation.
- **Print point cards: fixed a visibility-timing bug** where the print-preview grid could render on the live tab instead of staying hidden until printing.
- **Personal scoring pages: removed a leftover print-CSS workaround** that would have broken the Avery-format toggle.
- **Tap Panel: clicking a seating-chart tile scrolled the page to the top** — seating tiles are `<div>`s, not `<button>`s, so the scan-focus handler didn't recognize them. The whole Tap Panel is now excluded from that behavior.
- **Points breakdown: Store purchases were being counted twice** — once from the scan log, once from the Store tab's own history list. Now reads only from the scan log.
- **Switching classes in the header dropdown now repopulates the activity buttons immediately**, respecting group restrictions.

## [0.2.0] — 2026-07-08

### Added
- **Personal scoring pages** (QR Labels tab): print a page per student with a QR code for every activity, already linked to that student — scanning one code awards that exact activity to that exact student in a single scan, no arming step needed. Includes a "Custom" card that adds whatever amount is currently in the Custom box at scan time. Filter by group, and choose "Actual size" or "Fill page" before printing.
- **Points breakdown by activity** (Students tab): click "▾ Breakdown" next to any student to expand a mini panel showing points broken down by activity — including deductions, Store purchases, and points currently tied up in Auction tickets — with a "Net total" at the bottom. A period selector at the top of the Students tab ("All time" / "This week" / "Last 7 days" / "Last 30 days") controls every open breakdown panel. Auction tickets have no timestamp, so that line always shows the full current total regardless of the period selected.
- **Live Custom QR codes** (Activity menu print): two QR codes let you scan to arm +Custom or −Custom instead of clicking a button — using whatever amount is currently typed in the Custom box, at scan time. Printed on the Activity menu (QR Labels tab) alongside the regular activity and Undo codes.

### Changed
- Scan tab: the Custom Add/Subtract buttons now look and behave like the regular activity buttons (highlighting to show when armed) instead of small green/red pill buttons with QR codes next to them. The QR-code option for Custom now lives only on the printed Activity menu, not on the Scan tab itself.

### Fixed
- Personal scoring pages: the "Personal scoring pages" section heading was being printed at the top of the first physical page (it wasn't marked as screen-only), which pushed the first student's page down and could cause their name to print at the bottom of the page before their QR grid, instead of both staying together at the top of their own page. The heading is now hidden when printing, and each student's page is set to reliably start on a fresh page.

## [0.1.0] — 2026-07-08

Initial public release. Migrated from local file-sharing to GitHub.

### Added
- Point tracking via handheld scanner (USB keyboard-emulation or serial/COM)
- Activities with configurable point values
- Raffle (auto and manual modes)
- QR code label generation and printing
- Google Sheets sync (scan log + live standings)
- Backup/restore via JSON export/import
- Rebuild-from-Sheet-log recovery option
- Seating chart, spinner, and pass-tracking tools
- Settings for serial scanner baud rate and auto-reconnect

### Changed
- Genericized terminology throughout the app: "camp" → "school", "camper(s)" → "student(s)"
- Removed identifiable default values (real camp/bunk names) in favor of generic placeholders ("Sample School", "Sample Class 1")
- Removed the hardcoded Parshas Vayelech text from the app itself. The Pesukim tab now starts with an empty starter set; Vayelech is available as an importable example at `samples/vayelech-parsha-sample.csv`

### Notes
- This version does not yet include a `data.version` field or migration function. Adding one is a priority for the next release — see CONTRIBUTING.md for the pattern to use.

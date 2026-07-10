# Changelog

All notable changes to this project are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't follow strict semantic versioning (it's a classroom tool, not a library), but version numbers roughly mean:

- **Major (v1.0.0 → v2.0.0):** big changes, possibly a new data format
- **Minor (v1.0.0 → v1.1.0):** new features
- **Patch (v1.0.0 → v1.0.1):** bug fixes only

## [Unreleased]

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
- **Personal scoring pages** (QR Labels tab): one page per student with a QR code for every activity, already linked to them — one scan awards that activity to that student. Includes a live "Custom" card.
- **Points breakdown by activity** (Students tab): "▾ Breakdown" expands a panel showing points by activity, including deductions, Store purchases, and Auction tickets, with a Net total and a time-period selector.
- **Live Custom QR codes** on the printed Activity menu, using whatever amount is in the Custom box at scan time.

### Changed
- **The custom-amount controls now live with the activity buttons**, under one "Activities" section.
- **Trimmed explanatory text on the Scan tab** to one short line under the title.
- **The header is now a single bar, locked to the top of the page**, so the scan bar is never scrolled out of reach.
- **`sample-backup.json` is now a realistic fixture** with sample students and scan history, useful for testing import/export.
- Scan tab: Custom Add/Subtract buttons now look and behave like the regular activity buttons instead of separate pill buttons with their own QR codes (those QR codes now live only on the printed Activity menu).

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
- **Personal scoring pages: the section heading was printing at the top of the first physical page**, pushing the first student's content down. Now hidden when printing, with each student reliably starting on a fresh page.

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

# Changelog

All notable changes to this project are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't follow strict semantic versioning (it's a classroom tool, not a library), but version numbers roughly mean:

- **Major (v1.0.0 → v2.0.0):** big changes, possibly a new data format
- **Minor (v1.0.0 → v1.1.0):** new features
- **Patch (v1.0.0 → v1.0.1):** bug fixes only

## [Unreleased]

### Added
- **QR-code mode in the floating Points popup.** A new **⬛ QR** button shows a grid of QR codes right on screen — activities first (bigger codes, scan to arm), then every student in the current class (scan to award). Lets you scan the *screen itself* instead of needing printed labels, handy for testing or when labels aren't on hand. Only shows activities that apply to the current class (respects the group filter below).
- **Per-activity group filtering.** On the Activities tab, each activity now shows a small group checklist — "All" (default) means every group sees it; tick specific groups to restrict that activity to just those groups. The Scan tab's activity buttons only show what applies to the currently selected class. Scanning a student whose group isn't allowed for the currently armed activity shows a short error ("Not in this activity's groups") instead of awarding points. If no groups are checked (e.g. after unchecking the last one), it reverts to "All" automatically.
- **3-column option for the Scan-tab layout.** In Customize layout, a "2 columns / 3 columns" switch lets you spread the sections across the full width of the page. Drag a section into an empty column (shows a "Drop a section here" zone), or use ⇄, which now cycles a section through all active columns. Dropping from 3 to 2 columns safely folds anything from the third column into the second. Existing saved 2-column arrangements migrate over automatically.
- **Customizable Scan-tab layout.** The Scan tab is a layout of five movable sections — Activities, Scan box, Recent scans, Leaderboard, and Class list — instead of one fixed arrangement. Tap **⚙ Customize layout** to rearrange: drag a section onto another to place it there, use ▲ ▼ to reorder within a column, ⇄ to move to another column. **↺ Reset layout** restores the default. Your arrangement is saved. Built so a section can never be lost or duplicated — an invalid saved layout quietly falls back to the default. Scanning automatically exits Customize mode, so you're never left mid-rearrange after scoring a student.
- **Persistent header scan bar**, on every tab, replacing the old floating-only approach: a small label next to it shows what a scan will currently do (Points, Store, Hall passes, Pesukim, Game Show, Save board, etc.), computed automatically from whichever tab is open. When the context is Points, the label becomes a live pill showing the currently armed activity — **click it to open a dropdown of every activity** and arm a different one right from the header. A brief confirmation flash appears next to the bar after every scan. Calls the same routing logic every other scan box already used, so behavior stays consistent everywhere.
- **Points/Timer/Picker are icon-only buttons** in the header (↗ / ⏱ / 🎡, no text labels), freeing up room for the scan bar.
- **Teach mode phrase-by-phrase navigation** (Pesukim tab): ← → arrow keys, on-screen ‹/› buttons, and two QR codes (**CTRL:PASUKPREV** / **CTRL:PASUKNEXT**, on the printable Activity menu) step through a pasuk's phrases one at a time, highlighting the active one and auto-revealing its translation — passed phrases stay revealed, upcoming ones stay hidden. A **↻ Repeat pasuk / → Continue on** toggle controls what happens at the last phrase.
- **Setting: "Tapping a student shows their points breakdown instead of giving points"** (Settings tab, off by default). Scanning a QR code always scores normally regardless of this setting.
- **Avery-label printing** for "Print point cards" (Leader Board), the Activity menu (QR Labels tab), and Personal scoring codes — each got a format dropdown to print on standard Avery label sheets instead of only a plain-paper grid/pages.
- **Setting: "Show the Points / Timer / Picker shortcut buttons"** (Settings tab, on by default) and **"Show the Hebrew date next to the regular date"** (Settings tab, on by default, computed entirely in-browser, no internet needed).

### Changed
- **The custom-amount controls now live with the activity buttons**, both under one "Activities" section, instead of being split across two sections.
- **Trimmed explanatory text on the Scan tab** — a long scanner tip and a "Pick what you're scoring…" line were replaced with one short combined line under the title.
- **The header is now a single bar, locked to the top of the page.** Previously two stacked rows; now one row that stays pinned as you scroll, so the scan bar is never scrolled out of reach.
- **`sample-backup.json` is now a realistic fixture** — 4 demo students, sample scan history including a deduction, a Store purchase, a Raffle purchase, and an undone/corrected scan — useful for testing import/export, not just a placeholder.

### Fixed
- **The "Customize layout" button no longer looks stuck-highlighted after finishing** — it was a lingering keyboard focus ring, not an actual stuck state; the button now drops focus when the mode toggles.
- **The Leader Board tab now updates live after each scan** instead of only refreshing when you switch tabs away and back.
- **Activity menu and Personal scoring pages printing had extra blank space at the top of the page** — an inline `margin-top: 30px` meant for on-screen spacing was never reset for print. Now zeroed out specifically when printing.
- **Activity menu printing (tile/grid view): rows could look misaligned** when a subtitle was long enough to wrap to two lines, making that card taller than its neighbors. Added text truncation and shortened the longest subtitles.
- **Print point cards: fixed a visibility-timing bug** where the print-preview grid could render visibly on the live Leader Board tab instead of staying hidden until the actual print action.
- **Personal scoring pages: removed a leftover print-CSS workaround** that would have overridden the new Avery-format toggle.
- **Tap Panel: clicking a seating-chart tile scrolled the page to the top.** Seating-chart tiles are plain `<div>`s, not `<button>`s, so the Scan tab's "keep the scanner input focused" handler didn't recognize them and refocused the scan box near the top of the page instead. The whole Tap Panel is now excluded from that behavior.
- **Points breakdown: Store purchases were being counted twice** — once from the normal scan log, once from the Store tab's own separate purchase-history list. The breakdown now reads Store spending only from the scan log, matching the real balance exactly.
- **Switching classes in the header dropdown now repopulates the activity buttons immediately**, respecting each activity's group restrictions — previously required a tab switch to refresh.



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

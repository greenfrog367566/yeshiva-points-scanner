# Changelog

All notable changes to this project are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't follow strict semantic versioning (it's a classroom tool, not a library), but version numbers roughly mean:

- **Major (v1.0.0 → v2.0.0):** big changes, possibly a new data format
- **Minor (v1.0.0 → v1.1.0):** new features
- **Patch (v1.0.0 → v1.0.1):** bug fixes only

## [Unreleased]

### Added
- **Setting: "Tapping a student shows their points breakdown instead of giving points"** (Settings tab, off by default). When turned on, tapping a name in the Scan tab's Tap Panel (list view or seating chart) pops up that student's points breakdown — same data as the Students tab's "▾ Breakdown," with its own time-period selector — instead of scoring them. Scanning a QR code still always scores normally regardless of this setting; it only changes what a tap on the Tap Panel does.
- **Setting: "Show the Points / Timer / Picker shortcut buttons in the top-right corner"** (Settings tab, on by default — this is how the header already looked, so nothing changes unless you turn it off). Hides those three floating-tool shortcut buttons to simplify the header for schools that don't use them; the class dropdown and sound button are unaffected.
- **Hebrew date in the header** (Settings tab: "Show the Hebrew date next to the regular date," on by default). Computed entirely by the browser (via `Intl.DateTimeFormat` with the Hebrew calendar) — no internet connection or external data needed. On a browser that doesn't support it, it's simply left off with no effect on anything else.

### Fixed
- **Tap Panel: clicking a seating-chart tile scrolled the page to the top.** The Scan tab has a "keep the scanner input focused" click handler that already knew to leave regular buttons alone, but seating-chart tiles are plain `<div>`s rather than `<button>`s, so it didn't recognize them — clicking one refocused the scan box near the top of the page, which the browser scrolls into view automatically. This showed up most noticeably with the new points-breakdown popup, but affected normal seating-chart scoring too. The whole Tap Panel is now excluded from that refocus behavior.

### Changed
- **`sample-backup.json` is now a realistic fixture, not just a blank shell.** It now includes 4 demo students across 2 groups, a few days of sample scan history (including a deduction, a Store purchase, a Raffle ticket purchase, and an example of an undone/corrected scan), matching Store and Raffle sections, and a comment explaining the log entry format — so it's actually useful for testing import/export and understanding the data shape, not just a placeholder. Still entirely fictional data, safe to commit.

### Fixed
- **Points breakdown: Store purchases were being counted twice.** Store purchases already get logged into the normal scan history (`storeBuy()` calls the same `addLogEntry()` everything else does), but the breakdown was *also* separately pulling from the Store tab's own purchase-history list and adding a second "Store purchases" line on top — doubling the deduction for every unrefunded purchase and throwing off the Net Total. The breakdown now reads Store spending only from the scan log (each item shows as its own "Store: <item name>" line, same as before), matching the real balance exactly. As a side effect, this also makes the breakdown immune to the Store tab's "Clear history" button — that only clears the visible list on the Store tab, and never affected real balances, but now it can't make the breakdown's numbers look wrong either. Raffle ticket purchases/refunds were already logged correctly and needed no change. Auction remains the one category computed separately (ticket placement has no timestamp and isn't logged at all), clearly labeled as such.

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

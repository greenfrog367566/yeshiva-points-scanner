# Changelog

All notable changes to this project are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't follow strict semantic versioning (it's a classroom tool, not a library), but version numbers roughly mean:

- **Major (v1.0.0 → v2.0.0):** big changes, possibly a new data format
- **Minor (v1.0.0 → v1.1.0):** new features
- **Patch (v1.0.0 → v1.0.1):** bug fixes only

## [Unreleased]

### Added
- **Personal scoring pages** (QR Labels tab): print a page per student with a QR code for every activity, already linked to that student — scanning one code awards that exact activity to that exact student in a single scan, no arming step needed. Includes a "Custom" card that adds whatever amount is currently in the Custom box at scan time. Filter by group, and choose "Actual size" or "Fill page" before printing.
- **Points breakdown by activity** (Students tab): click "▾ Breakdown" next to any student to expand a mini panel showing their lifetime points broken down by activity (points and number of times earned), with a total at the bottom.
- **Live Custom QR codes** (Scan tab + Activity menu print): two small QR codes next to the Custom amount box let you scan to arm +Custom or −Custom instead of clicking the buttons — using whatever amount is currently typed in, at scan time. The same two codes are now included on the printable Activity menu (QR Labels tab) alongside the regular activity and Undo codes.

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

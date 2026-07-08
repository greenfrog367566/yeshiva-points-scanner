# Davening & Learning Points — Classroom Points Scanner

A single-file, offline-friendly web app for tracking classroom/bunk points with a handheld barcode/QR scanner. Built by Rebbeim, for Rebbeim.

**Live app:** `https://<your-org>.github.io/<your-repo>/` *(fill in once GitHub Pages is on)*

## What it does

- **Scan-based point tracking** — works with any USB scanner (keyboard-emulation, no setup) or a serial/COM scanner (Chrome/Edge, configurable baud rate)
- **Activities & scoring** — define activities with point values, award/deduct points per student
- **QR labels** — print QR codes per student for scanning
- **Raffle** — auto or manual raffle entries tied to points
- **Google Sheets sync** — push scans and live standings to your own Sheet
- **Backup & restore** — export/import all data as JSON; rebuild from a Sheet's log CSV if needed
- **Seating charts, spinner, pass tracking, and other classroom tools**

## Who this is for

Any Rebbi/teacher who wants a fast, low-friction way to track points without paying for or configuring a commercial classroom-management tool.

## Quick start (use it today, no setup)

1. Download `index.html` from this repo (or open the [live version](https://<your-org>.github.io/<your-repo>/)).
2. Open it in any browser.
3. Set your school/class name in the header, add students and activities, and start scanning.
4. Your data is saved locally in your browser (`localStorage`) — nothing is sent anywhere unless you turn on Google Sheets sync yourself.

## A note on AI

This program runs entirely on its own — **you do not need AI or an internet connection to use it.** Scanning, scoring, raffles, QR labels, seating charts, and everything else on the core tabs work completely offline.

AI is only relevant if you want to go further:
- **Contributors** use it to help build and upgrade features (see [CONTRIBUTING.md](CONTRIBUTING.md))
- **Teachers** can optionally use it to generate new Pesukim/Mishnayos text sets (see "Adding a parsha or mishnayos text set" below)

Using AI for either of these is optional, not required, and not something this project takes responsibility for or specifically endorses — **if you have a question about whether using AI is appropriate for you, ask your own shayla.**

## Important: your data stays yours

This repo contains only the **app code**. It does **not** contain:
- Real student names or scores
- Anyone's Google Sheet URL
- Any school-specific data

Each teacher's roster, scores, and history live in **their own browser** (and optionally their own private Google Sheet or a backup JSON file they keep). Updating the app should never touch or erase your data — see [CONTRIBUTING.md](CONTRIBUTING.md) for the rule we follow to guarantee that.

**Never commit a real backup file, real student names, or a real Google Sheet link to this repo.** Use `sample-backup.json` as a template — it contains only placeholder/demo data.

## Adding a parsha or mishnayos text set (Pesukim tab)

The app ships with **no parsha pre-loaded** — you add your own text set(s) right from the Pesukim tab (**+ New/import**), either by:

- Pasting a ready-made CSV (format: `num,full,hebrew,english`), or
- Using the built-in "Build AI prompt" button, which generates a prompt you can paste into any AI to produce that CSV for a parsha or mishnayos section of your choosing.

`samples/vayelech-parsha-sample.csv` in this repo is a ready-to-import example (Parshas Vayelech, Devarim 31, all 30 pesukim, phrase-by-phrase with translations) — import it to see the feature in action, or as a starting point.

## Project structure

```
index.html          the app (currently a single file)
sample-backup.json  blank/demo backup file — safe template, no real data
samples/
  vayelech-parsha-sample.csv   example text set, ready to import via the Pesukim tab
docs/
  scanner-setup.md   how to connect a USB or serial scanner
  user-guide.md      full feature walkthrough for teachers
CHANGELOG.md         what changed in each version
CONTRIBUTING.md      how to propose changes safely
LICENSE              MIT license
```

As the app grows, code may get split into `/src` (`app.js`, `scanner.js`, `qr.js`, `storage.js`, `sheets.js`, `raffle.js`) and `/styles`. No need to do that yet — start simple.

## Contributing

We welcome bug reports, feature suggestions, and pull requests from other teachers and developers. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — the short version is: **don't edit `main` directly, work in a branch, open a pull request.**

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and share; please keep the license notice.

## Maintainers

- [Your Name] — [your GitHub username]
- Rabbi B. Steinerman — [his GitHub username]

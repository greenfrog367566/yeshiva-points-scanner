# Davening & Learning Points — Classroom Points Scanner

A single-file, offline-friendly web app for tracking classroom/bunk points with a handheld barcode/QR scanner. Built by Rebbeim, for Rebbeim.

**Live app:**  ( https://greenfrog367566.github.io/yeshiva-points-scanner/)

## What it does

- **Scan-based point tracking** — works with any USB scanner (keyboard-emulation, no setup) or a serial/COM scanner (Chrome/Edge, configurable baud rate)
- **Activities & scoring** — define activities with point values, award/deduct points per student
- **QR labels** — print QR codes per student for scanning, or print one-page-per-student "personal scoring pages" where every activity's QR is already linked to that student for one-scan awarding
- **Raffle** — auto or manual raffle entries tied to points
- **Google Sheets sync** — push scans and live standings to your own Sheet
- **Backup & restore** — export/import all data as JSON; rebuild from a Sheet's log CSV if needed
- **Seating charts, spinner, pass tracking, and other classroom tools**

## Who this is for

Any Rebbi/teacher who wants a fast, low-friction way to track points without paying for or configuring a commercial classroom-management tool.

## Quick start (use it today, no setup)

1. Open the [live version](https://greenfrog367566.github.io/yeshiva-points-scanner/) — or clone the repo and open `index.html` (the landing page) locally.
2. Click **Get Started** to run through the 2-minute setup wizard, or **Skip & Start Now** to jump straight in.
3. Set your school/class name, add students, and start scanning.
4. Your data is saved locally in your browser (`localStorage`) — nothing is sent anywhere unless you turn on Google Sheets sync yourself.

## Recommended hardware

Any USB barcode/QR scanner that acts as a keyboard (the cheap, common kind — no drivers, no setup) works with this app. If you want a **2D scanner** specifically (needed to read the QR codes this app generates, not just old-style 1D barcodes), we've used and can recommend the **[Tera Wireless Barcode Scanner 1300 series](https://a.co/d/00s5Fr7u)** (1D/2D QR scanner, USB Wired/2.4G Wireless/Bluetooth) — plug-and-play over USB in its default keyboard-emulation mode, and also supports an advanced serial/COM connection mode if you want the app to read scans directly (see the user guide for setup).

This is just what's worked well for us, not a paid endorsement or an exclusive recommendation — any 2D/QR-capable USB scanner should work the same way. See [docs/scanner-setup.md](docs/scanner-setup.md) for setup details and troubleshooting.

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

**Never commit a real backup file, real student names, or a real Google Sheet link to this repo.** Use `sample-backup.json` as a template — it contains only placeholder/demo data (fictional students, a few days of sample scan history, a Store purchase, and a Raffle entry, so it demonstrates the real data shape without any real information).

## Adding a parsha or mishnayos text set (Pesukim tab)

The app ships with **no parsha pre-loaded** — you add your own text set(s) right from the Pesukim tab (**+ New/import**), either by:

- Pasting a ready-made CSV (format: `num,full,hebrew,english`), or
- Using the built-in "Build AI prompt" button, which generates a prompt you can paste into any AI to produce that CSV for a parsha or mishnayos section of your choosing.

`samples/vayelech-parsha-sample.csv` in this repo is a ready-to-import example (Parshas Vayelech, Devarim 31, all 30 pesukim, phrase-by-phrase with translations) — import it to see the feature in action, or as a starting point.

## Project structure

```
index.html          landing/marketing page — what visitors see first
app.html            the actual classroom app (single file)
setup.html          first-run setup wizard — routes new users through onboarding
sample-backup.json  demo backup with sample scan/Store/Raffle history — safe template, no real data
samples/
  vayelech-parsha-sample.csv   example text set, ready to import via the Pesukim tab
docs/
  scanner-setup.md   how to connect a USB or serial scanner
  user-guide.md      full feature walkthrough for teachers
CHANGELOG.md         what changed in each version
CONTRIBUTING.md      how to propose changes safely
LICENSE              MIT license
```

**Branches:**
- `main` — the safe, tested version. Only promote here when something is confirmed working in production.
- `dev` — active development and experiments. All new features, Claude Code sessions, and untested changes go here first.
- Feature branches — short-lived, named `steinerman/description` or `fix/description`, branched off `dev` and merged back into `dev`. Only merge to `main` deliberately.

**Never work directly on `main`.** If something breaks on `dev` and you need to reset it:
```bash
git checkout dev
git reset --hard main
git push origin dev --force
```

## Contributing

We welcome bug reports, feature suggestions, and pull requests from other teachers and developers. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

**Short version:**
- Never commit directly to `main`
- Branch off `dev` for new work (`steinerman/feature-name`, `fix/bug-name`)
- Test on `dev` before promoting to `main`
- Open a pull request from your branch → `dev`, then `dev` → `main` when ready
- **Data safety rule:** never break `migrateData()` / `load2fix()` — teachers' localStorage must survive every update

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and share; please keep the license notice.

## Maintainers

- [Rabbi B. Steinerman](https://github.com/greenfrog367566)
- [Rabbi Goldwasser](https://github.com/REPLACE-WITH-HIS-USERNAME)

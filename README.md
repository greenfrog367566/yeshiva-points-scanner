# Menchmark

**Run your classroom like a mensch.**

A free, open-source classroom assistant for Yeshiva and Jewish Day School rebbeim. Recognize Middos and Derech Eretz with a QR scan — right in the flow of teaching, not as a separate activity. Works offline, syncs to your own Google Sheet, no student logins required.

🌐 **Live:** [menchmark.app](https://greenfrog367566.github.io/yeshiva-points-scanner)

---

## What Menchmark does

One scan of a QR code recognizes good davening, derech eretz, helping a chavrusa, or any middah you define — without stopping the shiur. The same scan engine handles attendance, homework, passes, and rewards. Everything saves to your own device and your own Google Sheet.

**Optional: Shulchani Mode** — Points become Sela, Dinar, Ma'ah, and Prutah, the coin denominations from the Mishnah, broken down largest-coin-first the way real money works.

## Quick start

1. Open [the app](https://greenfrog367566.github.io/yeshiva-points-scanner/app.html)
2. Enter your student names (Manage → Students)
3. Print QR codes — the 🖨 button on Manage → Students
4. Start scanning!

For Google Sheets sync setup, see the [User Guide](docs/user-guide.md).

## Project structure

```
index.html             Landing page (what visitors see first)
app.html               The Menchmark app
setup.html             Onboarding / first-time setup wizard
test-migration.html    Migration test harness (for contributors)
docs/
  user-guide.md        Full feature walkthrough for teachers
samples/
  vayelech-parsha-sample.csv   Example text set, ready to import
sample-backup.json     Demo backup with placeholder data (no real students)
CHANGELOG.md           What changed in each version
CONTRIBUTING.md        How to propose changes safely
CLAUDE.md              Project rules for Claude Code sessions
LICENSE                MIT license
```

## Features

- **Scan** — Walk around, scan QR codes, award recognition in real time
- **Standings** — Live leaderboard, weekly trends, contests, podium view
- **Rewards** — Prize store, raffle wheel, Chinese auction
- **Manage** — Attendance, homework, bathroom passes, tracked activities, seating charts
- **Learn** — Pesukim and Mishnayos with phrase-by-phrase translation, teach mode, and matching games
- **Shulchani Mode** — Talmudic coin denominations (optional)
- **Google Sheets sync** — Your data in your Sheet, across all your devices
- **Works offline** — No internet? No problem. Sync when you're back.

### On the roadmap

- **Gradebook** — attendance, homework, and grades unified in one searchable record
- **Quiz engine** — one quiz across Chumash, Mishna, and Shorashim, with printable answer cards
- **Chavrusa Mode** — pair the room in seconds with compatibility rules
- **Text library** — pre-built, reviewed pasuk sets you can load with one tap
- **Print Wizard & paper kit** — run the whole system with no computer in the room

## Scanner hardware

Any cheap USB barcode/QR scanner that types like a keyboard works with zero setup — plug it in and scan. We use and recommend the **Tera Wireless Barcode Scanner 1300 series**; it also supports an optional COM-port (serial) mode for advanced setups. See the [User Guide](docs/user-guide.md) for details.

## Contributing

We welcome bug reports, feature suggestions, and pull requests from other rebbeim and developers. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — the short version is: **work in a branch, don't edit `main` directly, and never break saved data.**

## Maintainers

- [Rabbi B. Steinerman](https://github.com/greenfrog367566)
- [Rabbi Goldwasser](https://github.com/AuH2O613)

## License

[MIT](LICENSE) — Free to use, modify, and share. Please keep the license notice.

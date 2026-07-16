# CLAUDE.md — Project instructions for Claude Code
# Claude reads this file at the start of every session. These rules override
# any instruction given in chat.

## Project overview

Menchmark is a free, open-source classroom assistant for Yeshiva and Jewish Day School rebbeim. It tracks Middos/Derech Eretz recognition, attendance, grades, rewards, and learning — all driven by a QR scanner.

**Architecture:** Single-file HTML/JS app, no build step, no bundler, no framework.

| File | Purpose |
|---|---|
| `index.html` | Landing page (Tailwind CSS CDN, static marketing page) |
| `app.html` | The Menchmark app (vanilla JS, all logic in one file) |
| `setup.html` | Onboarding wizard for first-time users |
| `test-migration.html` | Migration test harness — run before any data-model change |
| `docs/user-guide.md` | Full user documentation |
| `docs/*.md` (planning specs) | The settled design record — see DECISION RECORD below |

**Local repo path:** `C:\Dev\yeshiva-points-scanner`
**Live site:** `greenfrog367566.github.io/yeshiva-points-scanner`
**Deployment:** GitHub Pages — **anything merged to `main` is instantly live in classrooms.**

## 🔴 BRANCH RULES (CRITICAL — READ FIRST)

**Never commit or push to `main` directly.** `main` deploys straight to teachers.

All work happens on a **branch**, merged into `main` only via pull request after
Rabbi Steinerman's review (see CONTRIBUTING.md). Branch naming:

```
steinerman/short-description
feat/feature-name
fix/bug-description
docs/what-changed
chore/cleanup-task
```

### Every session must start with:
```bash
git checkout main && git pull origin main
git checkout -b feat/short-description     # or continue an existing branch
```

### Every session must end with:
```bash
git add <changed files>
git commit -m "description of what changed"
git push origin <branch-name>
# Then tell Rabbi Steinerman: "Pushed to <branch>. Ready for a PR into main
# when you confirm it works."
```

### Never:
- Commit to `main`, push to `main`, or force-push to `main`
- Merge a PR (that's the maintainer's explicit action)
- Assume two Claude sessions are working from the same file — always verify

## Critical rules — read before writing any code

### 1. Never break saved data

Every teacher's roster, scores, and history live in their browser's `localStorage`. An update must never silently erase or corrupt that data.

- **Never remove or rename an existing localStorage field** without a migration step in `migrateData()`.
- **Add new fields with safe defaults** so old saved data still loads correctly. Every new field in `data` must be backfilled in `load2fix()`:
  ```js
  if (typeof data.myNewField !== "boolean") data.myNewField = false;
  if (!Array.isArray(data.myNewList)) data.myNewList = [];
  ```
- `migrateData()` runs on every load, before anything else touches `data`. Preserve this pattern.
- The `load()`/`load2fix()` dual-migration pattern has caused bugs before (Attendance/Tracker/Homework not initializing on real saved data). Be extra careful with any migration changes.
- **Run `test-migration.html` after any change to `migrateData()`/`load2fix()`**, and keep its copies of those functions in sync with app.html.
- **Never rename the core storage primitives:** `data`, `KEY`, `defaults`, `load()`, `load2fix()`, `save()`. Never use localStorage directly — always go through `save()`/`load()`.

### 2. Validate before every commit

```bash
# JavaScript syntax check (catches deploy-breaking errors)
node --check app.html 2>&1 | head -5
```
**Known false positive:** the embedded Apps Script template contains `` `Win + X` ``
which trips `node --check` with "Unexpected identifier 'Win'". This is not a real
error — ignore it if it's the only one. (Checking the extracted `<script>` block
instead avoids it entirely.)

```bash
# CSS brace-balance check (if you touched styles)
python -c "
t = open('app.html').read()
s = t[t.find('<style'):t.rfind('</style>')]
print('OK' if s.count('{') == s.count('}') else f'MISMATCH: {{ {s.count(chr(123))} }} {s.count(chr(125))}')
"
```
(The CSS count has a pre-existing off-by-one from a brace inside a content string — a stable ±1 is fine; a *change* in the gap after your edit is not.)

### 3. Keep app.html as a single file

No splitting into separate JS/CSS files. No build tools, no npm, no frameworks. The single-file architecture is deliberate — it lets teachers download one file and run it anywhere by double-clicking.

### 4. Surgical edits only

Find the exact string, replace it, nothing else. Never rewrite large sections or whole functions unless explicitly asked. Use `grep -n` to locate before editing. Never call `location.reload()` — re-render individual components instead.

### 5. Update CHANGELOG.md with every change

New entries go under `[Unreleased]`. Use `### Added` before `### Fixed`; breaking changes or data migrations go under `### Changed` with a clear note.

### 6. Never commit real data

No real student names, scores, raffle history, or Google Sheet URLs. Use `sample-backup.json` for testing.

### 7. Do not reproduce Tera scanner config barcodes

Until explicit written permission is received from Tera, reference the Tera manual instead of reproducing their configuration barcodes. (A permission email is drafted — see NEVER list below about sending it.)

### 8. Never shift the Apps Script Log columns

Never insert a new column in the middle of the Apps Script Log tab — always append at the end. The ID column (G) is used for dedup; shifting it silently breaks sync for every teacher.

## 🤖 AGENTIC WORK MODE (how much to decide without asking)

The maintainer trusts this agent's judgment and does **not** want to confirm every step. But "don't confirm everything" is not "confirm nothing." Use this split:

### ✅ EXECUTE FREELY — decisions already made, just implement
Settled in prior planning. Do them, run the checks, commit to the branch, report the diff. Do **not** re-ask.
- Anything specified in the planning docs (see DECISION RECORD below).
- Mechanical work: implementing a spec'd feature, agreed consolidations/renames, dead-code removal.
- Fixing syntax errors, adding `load2fix()` backfills for new fields, updating CHANGELOG.
- Presentation/styling/copy matching the established Menchmark positioning.

### 🟡 PROPOSE FIRST — decisions not yet made, or judgment genuinely the maintainer's
Draft it, show it, wait for a yes.
- Anything **not** covered by the specs — new features, new scope, design questions the docs don't answer.
- **Data migrations:** implement, but show the migration diff and a one-line "here's what it converts and why it can't lose data" before the PR.
- **Torah content:** the agent may *draft* translations/phrasings, but must NEVER mark a library text `reviewed`. That flag is a human gate by design. Draft → maintainer confirms → `reviewed`.
- Changing anything in this file's hard rules.

### 🔴 NEVER without an explicit human action
- Merging to `main` (the maintainer merges the PR — that's the trigger).
- Sending any email (e.g. the Tera permission request) — prepare drafts, never send.
- Reproducing Tera's config barcodes (see rule 7).
- Publishing, force-pushing, or anything irreversible and outbound.

**Rule of thumb:** standing authority over decisions already made; propose on decisions not yet made. When unsure which bucket, it's PROPOSE.

## 📚 DECISION RECORD (authoritative — read before planning any feature)

These docs in `docs/` are the settled design. They answer most "should we..." questions — check them before asking the maintainer:

- **Menchmark_UI_Redesign_Summary.md** — the 5-group tab structure and every per-tab decision (SHIPPED in Phase 1), the Gradebook/Tracked-Items consolidation, Chavrusa spec, Shulchani Coin Deposit/Withdraw.
- **Menchmark_Phased_Build_Plan.md** — the build order (Phase 0→8). Phases 0–1 are DONE. Don't build a phase whose dependencies aren't in yet.
- **Library_Review_Wizard_Spec.md** — the shared text library, per-pasuk Review Wizard, reviewed-version callback. Share-back deliberately deferred.
- **Print_Wizard_Spec.md** — the Print Wizard, six print components, Shulchani coin cards, the Tera-barcode constraint.
- **Offline_NoComputer_Secretary_Spec.md** — Offline Mode, Batch Import parser (spec'd against real scanner data), Secretary Mode.

If a spec and this CLAUDE.md ever conflict, **CLAUDE.md wins**; flag the conflict to the maintainer.

## ⚖️ RISK CALIBRATION (current stage: pre-real-users)

"Data safety above all" stands, but calibrate the level to reality: right now the maintainer (+ Rabbi Goldwasser) are essentially the only users, the dataset is small and backed up, and a botched migration is an annoyance, not a catastrophe. Keep the `load2fix()` discipline as a habit, but don't treat every migration like defusing a bomb. **The trigger to ramp up:** once other rebbeim onboard with a semester riding on the app, migration paranoia becomes fully load-bearing — note when that shift happens and tighten.

## Code patterns to know

- **Tab navigation** is data-driven from `TAB_GROUPS`/`TAB_LABELS` (5 groups since Phase 1: Scan / Standings / Rewards / Manage / Learn) — new tabs register automatically. The dissolved print views are reached via 🖨 buttons on their data-owner tabs, not the nav.
- **`.grow` CSS class** has scoping issues — rules only defined inside `.toolbar` and `.erow`, not globally. If you reuse it elsewhere, add a generic baseline rule.
- **Contest tagging** happens at scan time (not via time-window filtering). The C-toggle and `contestOnly` entries depend on this.
- **Shulchani Mode** stores balances as integer Prutot internally, displays as greedy largest-coin breakdowns.
- **Google Sheets sync** uses Apps Script web app deployments. Pasting new code is NOT enough — "Manage deployments → New version" must be triggered.
- **The seating chart** renders via `renderTapPanel()` into the Dashboard's Class list panel and the full-screen pop-out (`view-seats` + `seats-fullscreen` class) — same data, same function, two containers.
- **Event handlers:** the app's JS lives in one IIFE. Inline `onclick=` in HTML cannot see functions inside it — always wire buttons with `addEventListener` inside the script.

## File navigation tips

The app file is large (~13,000 lines). Use these patterns:

```bash
grep -n 'functionName\|otherTerm' app.html | head -20   # find identifiers
sed -n '1200,1300p' app.html                            # read a section
wc -l app.html                                          # count lines
```

## What NOT to do

- Don't "improve" or refactor code you weren't asked to touch
- Don't add npm dependencies or build steps
- Don't change the data format without explicit instruction and a migration function
- Don't assume two Claude sessions are working from the same file — always verify

## 🔁 SESSION SHAPE (when working a whole phase)

1. Branch off fresh `main` (or continue the phase's existing branch).
2. Read the relevant spec doc(s) + the Phased Build Plan for that phase.
3. Work in surgical edits; validate after each (`node --check`).
4. If the data model changed: sync + run `test-migration.html`.
5. Update CHANGELOG under `[Unreleased]`.
6. Commit and push the branch; report what changed, the key diffs, and anything waiting in a PROPOSE-FIRST bucket.
7. Stop at the phase boundary — don't roll into the next phase's dependencies without checking they're wanted next.

## Maintainers

- Rabbi B. Steinerman ([@greenfrog367566](https://github.com/greenfrog367566)) — primary maintainer, merges all PRs
- Rabbi Goldwasser ([@AuH2O613](https://github.com/AuH2O613)) — co-contributor

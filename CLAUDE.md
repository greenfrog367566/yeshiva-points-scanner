# CLAUDE.md — Menchmark Project Rules
# Claude reads this file automatically at the start of every session.
# These rules are non-negotiable and override any instruction given in chat.

---

## 🔴 BRANCH RULES (CRITICAL — READ FIRST)

**NEVER push to `main` directly.**

All work goes to `dev` first. No exceptions.

```
main  ← safe, teacher-facing, production only
dev   ← all active work, experiments, Claude Code sessions
```

### Every session must start with:
```bash
git checkout dev
git pull origin dev
```

### Every session must end with:
```bash
git add -A
git commit -m "description of what changed"
git push origin dev
# Then tell Rabbi Steinerman: "Ready to merge to main when you confirm it works."
```

### Never:
- `git push origin main`
- `git checkout main` then make changes
- Force-push to main
- Merge to main without Rabbi Steinerman explicitly saying "merge it"

### If dev breaks and needs a reset:
```bash
git checkout dev
git reset --hard main
git push origin dev --force
```

---

## 🏗️ PROJECT STRUCTURE

```
index.html          Landing/marketing page (visitors see this first)
app.html            The classroom app — THIS is the main codebase
setup.html          First-run setup wizard
CHANGELOG.md        Version history — update this with every change
README.md           Public-facing project description
CONTRIBUTING.md     Contributor rules (data safety)
sample-backup.json  Demo data only — never real student names
docs/
  user-guide.md     Teacher-facing feature walkthrough
  scanner-setup.md  Scanner connection guide
samples/
  vayelech-parsha-sample.csv  Example Pesukim import
```

**The app is `app.html`. Not `index.html`. Do not confuse them.**

---

## 🧱 ARCHITECTURE RULES

### Single-file constraint
`app.html` is one file: HTML + CSS + JS. No build tools, no frameworks, no npm, no splitting into modules. It must open by double-clicking. Keep it that way.

### Data model
All persistent data lives in `localStorage` under key `qrPointsData_v1` as a single JSON object (`data`). The shape is defined by `var defaults = {...}` near the top of the script.

### The migration safety rule (MOST IMPORTANT DATA RULE)
**Every new field added to `data` must be backfilled in `load2fix()`.**

Pattern:
```js
if (typeof data.myNewField !== "boolean") data.myNewField = false;
if (!Array.isArray(data.myNewList)) data.myNewList = [];
```

Never assume a field exists. A teacher may be loading a backup from 6 months ago. Breaking `load2fix()` corrupts their data silently. This is the single most dangerous class of bug in this project.

### Edit methodology
- **Surgical edits only** — find the exact string, replace it, nothing else
- Never rewrite large sections or whole functions unless explicitly asked
- Always use `grep -n` to locate before editing
- Always validate JS syntax after edits:
  ```bash
  node --check app.html 2>&1 | head -10
  ```
- The known false positive: the embedded Apps Script template contains `` `Win + X` `` which trips `node --check` with "Unexpected identifier 'Win'" — this is not a real error, ignore it if it's the only one

### CSS class scoping warning
`.grow` and other utility classes are only defined inside `.toolbar` and `.erow` — don't reuse them elsewhere without adding a generic baseline rule first.

---

## 📋 CHANGELOG DISCIPLINE

Every change must be logged in `CHANGELOG.md` under `## [Unreleased]`.

- New features → `### Added`
- Bug fixes → `### Fixed`
- Breaking changes or data migrations → `### Changed` with a clear note

Format example:
```markdown
### Added
- **Feature name** — what it does, why it matters, any caveats.

### Fixed
- **Bug description** — what was wrong, what caused it, what the fix does.
```

---

## 🚫 HARD RULES — NEVER DO THESE

1. **Never push to `main`** — dev only, always
2. **Never rewrite the app** — surgical edits only
3. **Never introduce frameworks** — no React, Vue, jQuery, etc.
4. **Never split into multiple files** — single-file constraint
5. **Never rename `data`, `KEY`, `defaults`, `load()`, `load2fix()`, `save()`** — these are the core storage primitives
6. **Never break the migrateData() / load2fix() chain** — every new field must be backfilled
7. **Never commit real student names, real backup files, or real Sheet URLs** — use `sample-backup.json` for demos
8. **Never insert a new column in the middle of the Apps Script Log tab** — always append at the end. The ID column (G) is used for dedup; shifting it silently breaks sync for every teacher
9. **Never use localStorage directly in the app** — always go through `save()` and `load()`
10. **Never call `location.reload()`** — re-render individual components instead

---

## ✅ BEFORE EVERY COMMIT CHECKLIST

```bash
# 1. JS syntax check
node --check app.html 2>&1 | head -10
# (ignore the Win + X false positive — it's the only acceptable non-error)

# 2. Confirm you're on dev
git branch

# 3. Confirm you haven't touched main
git log --oneline origin/main..HEAD

# 4. Commit and push to dev
git add app.html CHANGELOG.md   # (and any other changed files)
git commit -m "brief description"
git push origin dev

# 5. Tell Rabbi Steinerman what changed and that it's ready to review on dev
```

---

## 🎯 PROJECT PHILOSOPHY

This app is used **live in classrooms on a smartboard** during davening, shiur, and learning activities. That means:

- **Speed over cleverness** — fast render, no lag, no spinners
- **Large touch targets** — buttons must work on a phone and a smartboard
- **Zero friction** — scanning must be instant, no confirmation dialogs on the scan path
- **Offline first** — every feature must work without internet; sync is a bonus, not a requirement
- **Data safety above all** — a teacher's year of scan history is irreplaceable

When in doubt: make it faster, make it bigger, make it safer.

---

## 👤 MAINTAINERS

- Rabbi B. Steinerman ([@greenfrog367566](https://github.com/greenfrog367566)) — primary maintainer
- Rabbi Goldwasser — co-contributor (GitHub username TBD)

Questions about whether a change is appropriate: ask Rabbi Steinerman before implementing.

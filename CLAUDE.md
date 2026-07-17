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
- **Data safety above all** — protect scan history; keep the migration discipline (but calibrate paranoia to stage — see AGENTIC WORK MODE → RISK CALIBRATION below)

When in doubt: make it faster, make it bigger, make it safer.

---

## 👤 MAINTAINERS

- Rabbi B. Steinerman ([@greenfrog367566](https://github.com/greenfrog367566)) — primary maintainer
- Rabbi Goldwasser — co-contributor (GitHub username TBD)

Whether a change needs confirmation depends on which bucket it falls in — see AGENTIC WORK MODE below. Settled decisions: execute and report. Unsettled decisions or genuine judgment calls: propose to Rabbi Steinerman first.

---

## 🤖 AGENTIC WORK MODE (how much to decide without asking)

The maintainer trusts this agent's judgment and does **not** want to confirm every step. But "don't confirm everything" is not "confirm nothing." Use this split:

### ✅ EXECUTE FREELY — decisions already made, just implement
These were settled in prior planning. Do them, run the checks, commit to `dev`, then report the diff. Do **not** re-ask.
- Anything specified in the planning docs (see DECISION RECORD below) — the design questions are already answered there.
- Mechanical work: implementing a spec'd feature, refactors that consolidate duplicate logic we agreed to consolidate, renaming labels, folding Chart mode into Gradebook, tab restructuring, dead-code removal, the AI→"automatic" language sweep.
- Fixing syntax errors, adding the `load2fix()` backfill for a new field, updating CHANGELOG.
- Presentation/styling/copy that matches the established Mensch positioning.

### 🟡 PROPOSE FIRST — decisions not yet made, or judgment genuinely the maintainer's
Draft it, show it, wait for a yes. Don't just pick.
- Anything **not** covered by the specs — new features, new scope, design questions the docs don't answer.
- **Data migrations**: implement, but show the migration diff and a one-line "here's what it converts and how it can't lose data" before merging. (Low stakes today — see risk note — but build the habit now.)
- **Torah content**: the agent may *draft* translations/phrasings, but must NEVER mark a library text `reviewed`. That flag is a human gate by design. Draft → maintainer confirms → `reviewed`.
- Changing anything in the "HARD RULES — NEVER DO THESE" list above.

### 🔴 NEVER without an explicit human action
- Merging to `main` (maintainer says "merge it" — that's the trigger).
- Sending any email (e.g. the Tera permission request) — prepare drafts, never send.
- Reproducing Tera's scanner config barcodes in the app until the maintainer confirms Tera gave permission. Until then, the Scanner Setup sheet **references** the manual, it does not reproduce the barcode images.
- Publishing, force-pushing to main, or anything irreversible and outbound.

**The rule of thumb:** the agent has standing authority over decisions already made; it proposes on decisions not yet made. When unsure which bucket something is in, it's PROPOSE.

---

## Confirmation policy

Ben trusts Claude Code's technical judgment and does not want a second opinion on routine implementation decisions (variable names, exact CSS values, minor refactors, which function to edit). Proceed with the best reasonable choice and note it in the commit message rather than asking.

Still stop and explicitly ask Ben before:
- Merging to main
- Force-pushing or rewriting shared git history
- Deleting any file, branch, or data
- Any change to the data model or migrateData() that isn't purely additive
- Anything Ben's instructions in this session left ambiguous about intent (not implementation)

---

## 📚 DECISION RECORD (authoritative — read before planning any feature)

These docs are the settled design. They answer most "should we..." questions — check them before asking the maintainer. They live in `docs/`:

- **Menchmark_UI_Redesign_Summary.md** — the full tab-by-tab restructure: 5-group nav (Scan / Standings / Rewards / Manage / Learn), every per-tab decision, the Gradebook/Tracked-Items consolidation, Chavrusa spec, Shulchani Coin Deposit/Withdraw, etc.
- **Library_Review_Wizard_Spec.md** — the shared text library (draft/partial/reviewed status), per-pasuk Review Wizard, reviewed-version callback. Share-back is deliberately deferred.
- **Print_Wizard_Spec.md** — the Print Wizard, the six print components, color-matched Shulchani coin cards, the No-Computer paper kit, and the Tera-barcode redistribution constraint.
- **Menchmark_Phased_Build_Plan.md** — the build order (Phase 0→8) and what depends on what. Spine is 0→1→2. Follow this ordering; don't build a phase whose dependencies aren't in yet.

If a spec and this CLAUDE.md ever conflict, **CLAUDE.md wins** (it's the operational law); flag the conflict to the maintainer.

---

## ⚖️ RISK CALIBRATION (current stage: pre-real-users)

The "data safety above all" rule stands, but calibrate the *level* to reality:
- **Right now:** the maintainer (+ Rabbi Goldwasser) are essentially the only users. The dataset is small (weeks, not a year) and backed up. A botched migration is an annoyance, not a catastrophe — restore the backup and retry. So: keep the `load2fix()` discipline as a **habit** (it must be second nature before real users arrive), but don't treat every migration like defusing a bomb. Move at a reasonable pace.
- **The trigger to ramp up caution:** once other rebbeim onboard and have a semester riding on the app. From that point, migration paranoia becomes fully load-bearing. The agent should note when that shift has happened and tighten accordingly.

(Earlier versions of this file said a teacher's "year of scan history is irreplaceable." That's the *future* state, not today's. Design for it, but don't let it paralyze early iteration.)

---

## 🔁 AGENTIC SESSION SHAPE (when working a whole phase)

For a delegated phase (e.g. "do Phase 1"):
1. `git checkout dev && git pull origin dev`
2. Read the relevant spec doc(s) + the Phased Build Plan for that phase.
3. Work in surgical edits; validate after each (`node --check app.html`).
4. Update CHANGELOG under `[Unreleased]`.
5. Commit to `dev` with a clear message.
6. Report back: what changed, the key diffs, anything that hit a PROPOSE-FIRST bucket and is waiting on the maintainer.
7. Stop at the phase boundary — don't roll into the next phase's dependencies without checking they're wanted next.

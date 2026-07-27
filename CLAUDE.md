# CLAUDE.md — Project instructions for Claude Code
# Claude reads this file at the start of every session. These rules override
# any instruction given in chat.

## Project overview

Menchmark is a free, open-source classroom assistant for Yeshiva and Jewish Day School rebbeim. It tracks Middos/Derech Eretz recognition, attendance, grades, rewards, and learning — all driven by a QR scanner.

**Architecture:** Single-file HTML/JS app, no build step, no bundler, no framework.

| File | Purpose |
|---|---|
| `app.html` | The Menchmark app (~13,800 lines of vanilla JS, all logic in one IIFE) |
| `index.html` | Site front door — the scroll-driven GSAP brand-story intro, with Skip → `home.html` |
| `home.html` | The landing/marketing page (Tailwind CDN) — was `index.html` before the intro swap |
| `setup.html` | Onboarding wizard for first-time users |
| `quick-start.html` | 15-minute zero-to-first-scan guide for beta rebbeim (linked from the app header) |
| `beta.html` | Beta signup form → posts to `apps-script/beta-signup.gs` |
| `test-migration.html` | Migration test harness — holds **copies** of `migrateData()`/`load2fix()` that must stay logically identical to app.html's (indentation differs: app.html's live inside the IIFE) |
| `sw.js` + `manifest.webmanifest` | PWA shell — installable app, offline cache, persistent storage |
| `library/` | Shared text library (`index.json` + per-parsha JSON/CSV) the Pesukim/Mishnayos tabs pull from — no runtime fetch, no AI |
| `apps-script/beta-signup.gs` | Apps Script backend for beta signups (deploy instructions in the file header) |
| `docs/ai-proxy-worker.js` | Cloudflare Worker that holds the Gemini key for the optional AI text-import (`AI_PROXY_URL` in app.html) |
| `docs/user-guide.md`, `docs/scanner-setup.md` | Teacher-facing documentation |
| `docs/*_Spec.md`, `docs/Menchmark_*.md` | The settled design record — see DECISION RECORD below |
| `branding/`, `icons/`, `favicon.svg` | Menchmark mark, PWA icons, tab favicon |
| `samples/`, `sample-backup.json` | Safe demo data — the only data allowed in this repo |

**Local repo path:** `C:\Dev\yeshiva-points-scanner`
**Live site:** `menchmark.app` (custom domain on GitHub Pages; `greenfrog367566.github.io/yeshiva-points-scanner` still resolves)
**Deployment:** GitHub Pages — **anything merged to `main` is instantly live in classrooms.**
`sw.js` serves HTML network-first, so a deploy reaches installed users immediately; bump `CACHE_VERSION` in `sw.js` on a release to purge the stale *offline* copy.

## 🔴 BRANCH RULES (CRITICAL — READ FIRST)

**Never commit or push to `main` directly.** `main` deploys straight to teachers.

All work happens on a **branch**, merged into `main` only via pull request after
Rabbi Steinerman's review (see CONTRIBUTING.md).

**⚠️ `dev` is stale — do not branch off it.** README.md and CONTRIBUTING.md still
describe a `dev` → `main` promotion flow, but actual practice since 2026-07-21
(PRs #96–#101) is **branch off `main`, PR into `main`**. `origin/dev` last moved
2026-07-21 and has diverged (11 commits never merged forward, 15 commits behind).
Branch off freshly-pulled `main` unless the maintainer says otherwise; the README
wording is a known open item to reconcile.

Branch naming:

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
- **`DATA_VERSION` is currently `4`** (`app.html` ~line 3114). A purely additive field needs only a `load2fix()` backfill — **no version bump**. Bump `DATA_VERSION` and add an `if(data.version===N)` branch only when existing saved values must be *converted*.
- **Guard with `typeof` / `Array.isArray`, never bare falsiness.** `if(!data.raffle)` let a truthy non-object through and bricked startup under `"use strict"` (fixed in #97). Match the `adjust`/`removed` guards' form.
- The `load()`/`load2fix()` dual-migration pattern has caused bugs before (Attendance/Tracker/Homework not initializing on real saved data). Be extra careful with any migration changes.
- **Run `test-migration.html` after any change to `migrateData()`/`load2fix()`**, and keep its copies of those functions in sync with app.html.
- **Never rename the core storage primitives:** `data`, `KEY` (`"qrPointsData_v1"` — the actual localStorage key, never change the string), `defaults`, `load()`, `load2fix()`, `save()`. Never use localStorage directly — always go through `save()`/`load()`.

### 2. Validate before every commit

**Python is NOT installed on this machine, and `node --check app.html` fails on
Node 24** (`ERR_UNKNOWN_FILE_EXTENSION` — it refuses `.html` outright, so it can
never pass and tells you nothing). Use these node-only commands instead; all three
are verified working as of 2026-07-27 on Node v24.18.0.

```bash
# 1. JavaScript syntax check — parses each <script> block on its own.
#    This also sidesteps the old `Win + X` false positive from the embedded
#    Apps Script template.
node -e "
const fs=require('fs'),vm=require('vm');
const blocks=[...fs.readFileSync('app.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let bad=0;
blocks.forEach((b,i)=>{try{new vm.Script(b)}catch(e){bad++;console.log('SYNTAX ERROR in script #'+(i+1)+': '+e.message)}});
console.log(bad?'FAIL':'JS OK — '+blocks.length+' script blocks parsed');
"
```
Expect `JS OK — 3 script blocks parsed`.

```bash
# 2. CSS brace-balance check (if you touched styles)
node -e "
const t=require('fs').readFileSync('app.html','utf8');
const s=t.slice(t.indexOf('<style'),t.lastIndexOf('</style>'));
const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;
console.log('CSS braces: '+o+' open / '+c+' close (gap '+(o-c)+')');
"
```
**Current baseline gap is `2`** (braces inside content strings, not real
imbalance). A gap that stays 2 is fine; a *change* in the gap after your edit is not.

```bash
# 3. If you touched migrateData()/load2fix(), confirm test-migration.html matches.
#    Compares normalized (comments + whitespace stripped) — the harness's copies
#    sit at column 0 while app.html's are indented inside the IIFE, so a
#    byte-for-byte diff is always noise.
node -e "
const fs=require('fs');
const grab=(f,n)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('function '+n+'(');
  let d=0,s=t.indexOf('{',i),j=s;
  for(;j<t.length;j++){if(t[j]==='{')d++;else if(t[j]==='}'){d--;if(!d){j++;break}}}
  return t.slice(s,j)};
const norm=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').replace(/\s+/g,' ').trim();
['migrateData','load2fix'].forEach(n=>{
  const a=norm(grab('app.html',n)),b=norm(grab('test-migration.html',n));
  console.log(n.padEnd(12)+(a===b?'IN SYNC':'DIFFERS — app '+a.length+' chars / harness '+b.length));
});
"
node --check sw.js          # if you touched the service worker (.js — works fine)
```
Then open `test-migration.html` in a browser and confirm every scenario passes — including "Corrupted data".

### 3. Keep app.html as a single file

No splitting into separate JS/CSS files. No build tools, no npm, no frameworks. The single-file architecture is deliberate — it lets teachers download one file and run it anywhere by double-clicking.

### 4. Surgical edits only

Find the exact string, replace it, nothing else. Never rewrite large sections or whole functions unless explicitly asked. Use `grep -n` to locate before editing. Never call `location.reload()` — re-render individual components instead.

### 5. Update CHANGELOG.md with every change

New entries go under `[Unreleased]`. Use `### Added` before `### Fixed`; breaking changes or data migrations go under `### Changed` with a clear note. **One heading of each kind per release section** — `[Unreleased]` has accreted duplicate `### Added`/`### Changed` blocks; merge into the existing heading rather than appending a new one.

Entries here are unusually long by design: they explain *why* to a rebbi, not just *what*, and data-model changes spell out what migrates and why nothing can be lost. Match that voice.

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
- **Torah content:** the agent may *draft* translations/phrasings, but must NEVER set a library text's `status` to `"reviewed"` in `library/index.json`. That flag is a human gate by design (`draft` → `partial` → `reviewed`); only a person who knows the material may promote it. Vayelech currently sits at `"partial"`.
- Changing anything in this file's hard rules.

### 🔴 NEVER without an explicit human action
- Merging to `main` (the maintainer merges the PR — that's the trigger).
- Sending any email (e.g. the Tera permission request) — prepare drafts, never send.
- Reproducing Tera's config barcodes (see rule 7).
- Publishing, force-pushing, or anything irreversible and outbound.

**Rule of thumb:** standing authority over decisions already made; propose on decisions not yet made. When unsure which bucket, it's PROPOSE.

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

These docs in `docs/` are the settled design. They answer most "should we..." questions — check them before asking the maintainer:

- **Menchmark_UI_Redesign_Summary.md** — the 5-group tab structure and every per-tab decision (SHIPPED in Phase 1), the Gradebook/Tracked-Items consolidation, Chavrusa spec, Shulchani Coin Deposit/Withdraw.
- **Menchmark_Phased_Build_Plan.md** — the build order (Phase 0→8). Don't build a phase whose dependencies aren't in yet. Status as of v0.9.0 + Unreleased: **Phase 0 and Phase 1 DONE**; **Phase 6a (the Library) partially in** — `library/index.json` exists with Vayelech at `status: "partial"`; **Phase 2 (the Gradebook engine / Tracked Items) NOT started** — it is the spine everything academic hangs off, so Phases 5, 6-chart-fold, and the Gradebook consolidation are all still blocked. Much of the recent work (seating picker, Homework/Bathroom Pass as Record-tab tiles, PWA, live-view refresh) is Phase 3-flavored polish landing ahead of Phase 2.
- **Library_Review_Wizard_Spec.md** — the shared text library, per-pasuk Review Wizard, reviewed-version callback. Share-back deliberately deferred.
- **Print_Wizard_Spec.md** — the Print Wizard, six print components, Shulchani coin cards, the Tera-barcode constraint.
- **Offline_NoComputer_Secretary_Spec.md** — Offline Mode, Batch Import parser (spec'd against real scanner data), Secretary Mode.

If a spec and this CLAUDE.md ever conflict, **CLAUDE.md wins**; flag the conflict to the maintainer.

## ⚖️ RISK CALIBRATION (current stage: beta rebbeim onboarding)

**The trigger has fired.** v0.9.0 (2026-07-18) is the version the first wave of beta rebbeim onboard onto, so real classrooms now have data in the app. Migration paranoia is load-bearing again:

- Every data-model change gets `test-migration.html` run, not just eyeballed — and its copies of `migrateData()`/`load2fix()` synced first.
- Prefer additive fields + `load2fix()` backfill over a `DATA_VERSION` bump wherever the behavior can be expressed that way.
- Show the migration diff and the "here's why it can't lose data" line before the PR (PROPOSE FIRST, below).

The Google Sheet backup remains the ultimate safety net — PWA persistent storage does *not* survive an admin-forced clear-on-exit or Guest-mode wipe on managed Chromebooks. Never demote or bury the Sheet backup path.

## Code patterns to know

- **Tab navigation** is data-driven from `TAB_GROUPS`/`TAB_LABELS` (`app.html` ~line 3408) — new tabs register automatically. The dissolved print views are reached via 🖨 buttons on their data-owner tabs, not the nav.
- **The 5 R's:** the five groups display as **Record · Recognize · Reward · Review · Run** (order from `GROUP_ORDER`). Their **internal keys are still the old names** — `scan` / `standings` / `rewards` / `learn` / `manage` — because those keys are persisted in saved state. Never rename a key to match its label. Each group also carries an `icon` string: the inner markup of a 16×16 monochrome line SVG that `renderGroupTabs()` wraps.
- **Tracked activities never award points.** The Tracker keeps its own log and Homework Checked / Bathroom Pass their own records. They are excluded from every arming surface (Record-tab buttons, floating scan panel, `ACT:` codes, printed Activity Menu) — with one deliberate exception: the seating-chart scan bar's dropdown keeps Homework Checked, because an armed Homework Checked is rerouted to the real homework record from any tab. Preserve that asymmetry; it's intentional, not an oversight.
- **`refreshLiveViews()`** is the single hook that re-renders whichever live/aggregate view is open (raffle wheel, standings, trends, history, contest) after any scan, tap, or undo. Call it rather than re-rendering ad hoc — and it deliberately never fires mid-spin.
- **`SeatPicker`** is a context-agnostic engine (inputs: cells / used / elig / config / interactive; outputs: `onLand` / `onEligChange` / `onExhausted`). Reuse it for future picker-shaped features instead of forking it.
- **No external runtime dependencies in `app.html`** — the QR library is inlined, not CDN-loaded, so a downloaded copy works fully offline. Don't add a `<script src>` to it.
- **`.grow` CSS class** has scoping issues — rules only defined inside `.toolbar` and `.erow`, not globally. If you reuse it elsewhere, add a generic baseline rule.
- **Contest tagging** happens at scan time (not via time-window filtering). The C-toggle and `contestOnly` entries depend on this.
- **Shulchani Mode** stores balances as integer Prutot internally, displays as greedy largest-coin breakdowns.
- **Google Sheets sync** uses Apps Script web app deployments. Pasting new code is NOT enough — "Manage deployments → New version" must be triggered.
- **The seating chart** renders via `renderTapPanel()` into the Dashboard's Class list panel and the full-screen pop-out (`view-seats` + `seats-fullscreen` class) — same data, same function, two containers.
- **Event handlers:** the app's JS lives in one IIFE. Inline `onclick=` in HTML cannot see functions inside it — always wire buttons with `addEventListener` inside the script.

## File navigation tips

The app file is large (~13,800 lines / ~800 KB) — never read it whole. Use these patterns:

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

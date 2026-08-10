# CLAUDE.md — Project instructions for Claude Code
# Claude reads this file at the start of every session. These rules override
# any instruction given in chat.

**Start here:** `docs/NOW.md` holds the current working queue — what is in flight and what is next. Read it at the start of every session.

## Project overview

Menchmark is a free, open-source classroom assistant for Yeshiva and Jewish Day School rebbeim. It tracks Middos/Derech Eretz recognition, attendance, grades, rewards, and learning — all driven by a QR scanner.

**Architecture:** Single-file HTML/JS app, no build step, no bundler, no framework.

| File | Purpose |
|---|---|
| `app.html` | The Menchmark app (~22,450 lines of vanilla JS, all logic in one IIFE) |
| `index.html` | The landing/marketing page (Tailwind CDN), served at `/` — was `home.html` until the SEO swap; carries the canonical meta description and the `SoftwareApplication` JSON-LD |
| `intro.html` | The scroll-driven GSAP brand-story intro, served at `/intro` — was `index.html` (the site front door) until the SEO swap. Skip → `/` |
| `_redirects` | Cloudflare Pages 301s. Points `/home`, `/home.html`, `/index.html` at `/` so every pre-swap address survives — Cloudflare's own clean-URL rewrite is only a 307, which does not consolidate search signals |
| `robots.txt` + `sitemap.xml` | SEO. **Read the `robots.txt` caveat below before assuming what is served** |
| `setup.html` | Onboarding wizard for first-time users |
| `quick-start.html` | 15-minute zero-to-first-scan guide for beta rebbeim (linked from the app header) |
| `beta.html` | Beta signup form → posts to `apps-script/beta-signup.gs` |
| `test-migration.html` | Migration test harness — holds **copies** of `migrateData()`/`load2fix()` that must stay logically identical to app.html's (indentation differs: app.html's live inside the IIFE) |
| `sw.js` + `manifest.webmanifest` | PWA shell — installable app, offline cache, persistent storage |
| `library/` | Shared text library (`index.json` + per-parsha JSON/CSV). **Shipped as data only — nothing in `app.html` references it yet (#187).** The Pesukim/Mishnayos tabs still source from the AI proxy or manual entry; the "browse & load" picker is Phase 6a's unbuilt half |
| `apps-script/beta-signup.gs` | Apps Script backend for beta signups (deploy instructions in the file header) |
| `docs/ai-proxy-worker.js` | Cloudflare Worker that holds the Gemini key for the optional AI text-import (`AI_PROXY_URL` in app.html) |
| `docs/user-guide.md`, `docs/scanner-setup.md` | Teacher-facing documentation |
| `docs/shulchani-coin-guide.html` | Printable Coin Guide for the class wall — standalone page, not part of the app |
| `docs/NOW.md` | The current working queue — read at the start of every session (see top of this file) |
| `docs/*_Spec.md`, `docs/Menchmark_*.md`, `docs/Positioning.md` | The settled design record — see DECISION RECORD below |
| `.github/workflows/validate.yml` | CI runs the `validate` skill's checks on every push — they are no longer only a local pre-commit habit |
| `branding/`, `icons/`, `favicon.svg` | Menchmark mark, PWA icons, tab favicon |
| `samples/`, `sample-backup.json` | Safe demo data — the only data allowed in this repo |

**Local repo path:** `C:\Dev\yeshiva-points-scanner`
**Live site:** `menchmark.app`, served by a **Cloudflare Pages project** built from
`main` — *not* GitHub Pages. GitHub Pages is still enabled and also builds from
`main`, so `greenfrog367566.github.io/yeshiva-points-scanner` resolves and serves
the same content, but it is **not** what rebbeim use. GitHub Pages has no custom
domain configured (`cname: null`, and there is no `CNAME` file in the repo); the
domain resolves straight to Cloudflare.

**Deployment:** merging to `main` reaches `menchmark.app` on its own — **treat
anything merged as live in classrooms.** It takes **about a minute**: measured on
the #155 merge, GitHub Pages rebuilt 38 seconds after the merge commit and
`menchmark.app` was serving the new content inside two minutes. Fast, but *not*
instant — don't promise a rebbi a fix has landed until you have loaded the page
and seen it.

**The deploy has failed silently before, and this is the thing to actually worry
about.** The Cloudflare project was once disconnected from the repo and kept
serving its last build for days — `main` was healthy, GitHub Pages was current,
every check was green, and rebbeim were running a build from 13 merges earlier.
Nothing in this repo reports that state. **After a merge that matters, verify
against the live site rather than assuming**, e.g.:

```bash
# does the deployed app actually contain the thing you just merged?
# -L is required: menchmark.app/app.html 307-redirects to /app (Cloudflare's
# clean-URL rewrite), so a bare curl follows nothing, fetches zero bytes, and
# grep -c reports 0 for a perfectly healthy deploy — indistinguishable from
# the failure this check exists to catch.
# grep -c, never grep -o: -c prints a number either way, so a miss is a visible
# 0. -o prints nothing at all on a miss, and silent failure reads as success.
curl -sL https://menchmark.app/app.html | grep -c 'someIdentifierFromYourChange'
```

**WAIT A MINUTE FIRST, AND RE-RUN BEFORE CONCLUDING ANYTHING.** A `0` from that
command is ambiguous four ways now — *not deployed yet*, *deploy stalled*,
*you checked too fast*, and *forgot `-L`* all look identical, and the last two
are the common cases. This has already caught someone twice: a check run about
a minute after the #155 merge returned `0`, and the same command a minute later
returned `10` — and on 2026-08-07 a `-L`-less check on the #230 merge returned
`0` for content that was already live, only caught by comparing byte counts
directly against `main`. The result only means something read against the
merge timestamp, so get that first (`gh pr view <n> --json mergedAt`) and give
it a minute before believing a zero.

`sw.js` serves HTML network-first, so once a deploy is out it reaches installed
users immediately; bump `CACHE_VERSION` in `sw.js` on a release to purge the
stale *offline* copy.

### ⚠️ `/robots.txt` lies about whether it exists

Cloudflare injects a **managed Content Signals `robots.txt`** when the origin
has none. Before this repo had its own, `GET /robots.txt` returned **200 with
1,248 bytes** — which reads exactly like a healthy file — but the body was
*entirely comments*: no `User-agent`, no `Allow`, no `Sitemap`. Meanwhile
`HEAD /robots.txt` returned **404**, the origin's real answer.

So a plain status check on that path proves nothing either way. **Read the body
and look for a directive**, don't trust the code:

```bash
# does the live robots.txt actually contain our rules, or just Cloudflare's comments?
curl -sL --ssl-no-revoke https://menchmark.app/robots.txt | grep -c '^Sitemap:'
```

The repo now ships `robots.txt`, which should win as a real origin asset — but
whether Cloudflare serves it verbatim, appends its content signals to it, or
overrides it is **unverified**, and only observable against the live site after
a deploy. Check the body, not the status code.

(`--ssl-no-revoke` is needed on this machine — without it curl fails the TLS
revocation check and reports `http=000`, which is indistinguishable from a dead
deploy.)

## 🔴 BRANCH RULES (CRITICAL — READ FIRST)

**Never commit or push to `main` directly.** `main` deploys straight to teachers.

All work happens on a **branch**, merged into `main` only via pull request after
Rabbi Steinerman's review (see CONTRIBUTING.md).

**There is no `dev` branch.** `main` is the only long-lived branch: every
worktree branches off freshly-fetched `origin/main` and PRs back into `main`.
The old `dev` → `main` promotion flow was retired — `dev` stopped moving 2026-07-21, its content was confirmed fully
present on `main` (squash-merged as PR #94), and the branch was deleted. Don't
recreate it or look for it; if a doc still mentions it, that doc is out of date.

### ⚠️ Squash-merges make merged branches look unmerged

A squash-merge strips commit ancestry while preserving content — `git log`,
`git status`, `git cherry`, and ahead/behind counts can all report a branch as
diverged or unmerged even when every line of its content is already on `main`.
**Never treat ancestry alone as evidence of unmerged work.** Use the
`branch-merge-audit` skill to verify content instead.

Branch naming:

```
steinerman/short-description
feat/feature-name
fix/bug-description
docs/what-changed
chore/cleanup-task
```

### Every code-changing session must start with a worktree

**One workflow, no exceptions — not for one-line fixes, not for "just a doc
tweak."** Every change happens in its own worktree under `.claude/worktrees/`.

**The shared checkout at `C:\Dev\yeshiva-points-scanner` stays on `main`,
always.** Never `git checkout -b` there, never park a branch there, never edit
there. That folder's only job is to show what is live.

Read-only sessions — questions, audits, "explain how X works", reading logs —
skip all of this and work in place. No worktree, no branch.

Two steps, in this order, **before the first edit**:

```
1. EnterWorktree { name: "feat/short-description" }   # feat/ fix/ docs/ chore/ steinerman/
2. git branch -m feat/short-description               # ← immediately, same breath
```

**Step 2 is not optional and must not wait until push time.** `EnterWorktree`
creates the branch as `worktree-feat+short-description` — it prefixes
`worktree-` and rewrites `/` as `+`. Rename before editing, or that name reaches
the remote and the PR. A large share of this repo's branches carry that prefix
purely because the rename was left as a thing to remember later, which is how
two branch-naming conventions ended up coexisting. Renaming inside a worktree is
safe: git updates the worktree's own HEAD, and the harness tracks the worktree
by path, not by branch name.

`EnterWorktree` branches from freshly-fetched `origin/main` by itself, so there
is **no `git checkout main && git pull` to run first** — that dance existed only
to keep the shared checkout honest, and a worktree is current by construction.
It also retires the "is the branch sitting here already merged?" trap: a fresh
worktree per change means there is never a stale branch to resume.

### Before starting new work: look at stale worktrees, never sweep them

Merged worktrees accumulate and are worth clearing — but this repo runs several
Claude sessions at once, and **removing a worktree out from under a live session
breaks it.** So this is a look-then-ask step, never an automatic cleanup:

```bash
git worktree list --porcelain | grep -E '^(worktree|branch|locked)'
```

A worktree is safe to propose for removal only when **all** of these hold:
- its PR is `MERGED` (check both names — the local branch may still be
  `worktree-feat+x` while the PR is `feat/x`; match on the directory name too)
- it is **not** `locked` — the lock reads `claude session … (pid N)` and means a
  session is live in it right now
- `git -C <path> status --porcelain` is empty
- no session has written to it recently

**List the candidates and ask before removing any.** Deleting is a stop-and-ask
action (see Confirmation policy).

### 🔴 EVERY PR TARGETS `main`. NEVER STACK ONE PR ON ANOTHER.

**A PR's base is always `main`.** Not another feature branch, not "the branch
this depends on." If work genuinely depends on unmerged work, either put it in
the same PR or wait for the other one to land.

**This has already cost a merge.** #211 was based on `feat/mini-contest` because
its changes only compiled against #210's code, and the merge order given was
"#210, then #211" — which is exactly backwards for a stack. #210 merged
`feat/mini-contest` into `main` first, so when #211 was merged afterwards it
landed in a branch that had *already delivered*. Its content went nowhere:
`main` had none of it, and the PR read as merged. It had to be re-opened
against `main` as #212. Nothing warned about any of this.

**The retarget everyone expects does not happen by default.** GitHub only
re-points a stacked PR at `main` when the base branch is **deleted** on merge.
Left undeleted, the PR quietly merges into the stale base instead.

**And a PR into a feature branch runs NO CI AT ALL.** `.github/workflows/validate.yml`
triggers on PRs targeting `main`, so a stacked PR has no gate whatsoever — #211
merged with zero checks having run. This alone is reason enough never to stack.

### PRs open as DRAFT

**Open every PR as a draft** (`gh pr create --draft`), and mark it ready only
once the browser pass is done and CI is green. GitHub refuses to merge a draft,
so "merged too early" stops depending on anyone remembering the state of it.

Say plainly, in the message that reports the branch, what is still owed before
it should be marked ready.

### Repo settings that enforce this

**Claude may change these, but only when asked to — never on its own
initiative**, and always saying plainly what changed. Branch protection is
exactly the kind of thing that must never move without the maintainer knowing.
If a merge went wrong and one of these is off, say so rather than adding a
convention on top of a missing guard:

- **Require the `validate` status check on `main`.** ✅ **ON since 2026-08-06.**
  It is a **ruleset** (`main-protection`), not classic branch protection — so it
  is edited via `gh api repos/:owner/:repo/rulesets/:id`, and Settings → Rules,
  not Settings → Branches. `bypass_actors` is empty, which means **nobody can
  merge past a missing check, including the owner** (`current_user_can_bypass`
  reads `never`). To land something while checks cannot run, the only route is
  to set `enforcement` to `evaluate` temporarily and back to `active` after.
  **The single highest-value guard** — a missing or red check now blocks the
  button, which is precisely what did not happen with #211, or with #226.
- **Automatically delete head branches.** Settings → General. Also makes
  GitHub retarget correctly in the case above, and stops dead branches piling up
  (`feat/mini-contest` outlived its own PR carrying a content-dead merge commit).

### Every session must end with:
```bash
git add <changed files>
git commit -m "description of what changed"
git push -u origin feat/short-description   # the RENAMED branch, never worktree-*
gh pr create --draft --base main --head feat/short-description   # DRAFT, always, base main
# Then tell Rabbi Steinerman: "Pushed to <branch>, draft PR #N into main.
# Ready to mark for review once you confirm it works."
```

Claude opens the PR **as a draft against `main`** and stops there. Marking it
ready for review and merging are both the maintainer's actions — the draft is
what keeps those two decisions his rather than a side effect of the PR existing.

### Never:
- Commit to `main`, push to `main`, or force-push to `main`
- Edit, branch, or park work in the shared checkout — it stays on `main`
- Push a `worktree-*` branch name; rename it at step 2 instead
- Remove a worktree that is `locked`, dirty, or in use by another session
- Merge a PR (that's the maintainer's explicit action)
- **Open a PR against anything but `main`**, or open one that isn't a draft
- Assume two Claude sessions are working from the same file — always verify

### The shared checkout now self-syncs (but don't lean on it)

`.claude/hooks/sync-main-checkout.sh` runs on `SessionStart` and `SessionEnd`
for every session in this repo — worktrees included — and fast-forwards the
shared checkout at `C:\Dev\yeshiva-points-scanner` to `origin/main`. That closes
the drift window that once left it 31 commits stale while every merge looked
healthy.

It is deliberately timid: it only acts when the shared checkout is on `main`
with nothing uncommitted. Parked on a branch, or holding uncommitted work, it
fast-forwards nothing and only prints how far behind the folder has fallen.

**This is exactly why the worktree rule above says the shared checkout stays on
`main`.** The two work together: keep that folder on `main` and the hook
silently keeps it current, so opening `app.html` there always shows what
rebbeim have. Park a branch there and the hook goes mute — which is the state
that once let the folder sit 31 commits stale while every merge looked healthy.

### Preview servers get reaped automatically — don't hand-kill node

Serving the repo over http to look at `app.html` (or to run `test-migration.html`,
which needs `fetch` and so cannot be opened over `file://`) leaves a node server
listening. Sessions never stopped them, and they piled up: thirteen at once on
2026-08-03, five of them a day old and already hung, twelve belonging to sessions
that no longer existed.

`.claude/hooks/reap-dev-servers.ps1` now handles it, wired to both session hooks:
**SessionStart** kills servers whose session is gone, **SessionEnd** kills the
ones this session started. Both layers are needed — SessionEnd never runs when a
session is force-quit, which is how they accumulated in the first place.

**So start preview servers freely and don't clean up after them.** What you must
*not* do is reach for `taskkill //IM node.exe` or `pkill node` when a port is
stuck — that kills the MCP servers and any sibling session's work along with it.
The reaper exists precisely so nobody needs the blunt instrument; run it by hand
instead, and look before you leap:

```bash
# what would it kill right now? (kills nothing)
powershell -ExecutionPolicy Bypass -File .claude/hooks/reap-dev-servers.ps1 -Mode Orphans -DryRun
```

It is deliberately conservative and will under-kill rather than risk a live
session: node only, must be listening on TCP (this is what protects the
stdio-based MCP servers), must look like a dev server, must be on a dev port or
name this repo, and never with a live `claude.exe` up its parent chain. A
30-minute grace period keeps a browser tab you still have open from being pulled
out from under you. Every kill lands in `.claude/reap-dev-servers.log`
(gitignored) with port, age and command line.

**One caveat worth knowing:** a server *you* started from your own terminal has
no Claude session above it, so the orphan sweep cannot tell it from an abandoned
one and will take it after the grace period. Pin its port and it is left alone
for good:

```bash
export MENCHMARK_REAP_SKIP_PORTS=8080,9000   # or -SkipPorts 8080,9000
```

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
- **`DATA_VERSION` is currently `5`** (`app.html` ~line 4165). A purely additive field needs only a `load2fix()` backfill — **no version bump**. Bump `DATA_VERSION` and add an `if(data.version===N)` branch only when existing saved values must be *converted*.
- **Guard with `typeof` / `Array.isArray`, never bare falsiness.** `if(!data.raffle)` let a truthy non-object through and bricked startup under `"use strict"` (fixed in #97). Match the `adjust`/`removed` guards' form.
- The `load()`/`load2fix()` dual-migration pattern has caused bugs before (Attendance/Tracker/Homework not initializing on real saved data). Be extra careful with any migration changes.
- **Run `test-migration.html` after any change to `migrateData()`/`load2fix()`**, and keep its copies of those functions in sync with app.html.
- **Never rename the core storage primitives:** `data`, `KEY` (`"qrPointsData_v1"` — the actual localStorage key, never change the string), `defaults`, `load()`, `load2fix()`, `save()`. Never use localStorage directly — always go through `save()`/`load()`.

**Before shipping any feature that stores or destroys data, ask what happens when its underlying data is gone or wrong.** Four questions:

- If this feature's data can be truncated, wiped, or overwritten, does the feature still behave correctly — or does it silently show wrong numbers?
- Does anything destructive share a button with something benign?
- Does any dialog promise something the code then destroys?
- Is there a way back — a log entry, a stored previous value, a backup path?

Learned from Contest (#131, #133, #134). The data model was sound: scans carried a `contestId`, merge stamped entries individually, undo read those flags correctly. But contest totals were only ever computed by walking `data.log`, which is capped (500 at the time, 5000 since #226) and is still wipeable — so "saving" a contest saved a label with no scores behind it. **The raise did not retire the lesson:** a bigger cap moves the cliff, it does not remove it, so anything whose totals are only *derivable* from the log is still built on sand. Store the total. Separately, ending a contest and resetting all scores shared one OK button, and the dialog promised the contest's history would survive while the code deleted the log it was computed from.

The same question is open elsewhere: **#130** (batch class assign writes with no trail) and **#125** (roster import silently overwrites classes). **#129** (the log cap) closed 2026-08-06 — the cap is now 5000, with tracked scans on a separate 1500 budget so they can never evict a point scan.

### 2. Validate before every commit

**Python is NOT installed on this machine, and `node --check app.html` fails on
Node 24** (`ERR_UNKNOWN_FILE_EXTENSION` — it refuses `.html` outright). Use the
`validate` skill for the node-only JS/CSS/migration checks instead of reaching
for Python or `node --check`.

**Watch for stray CSS comment delimiters especially** — a stray `*/` (or an
unclosed `/*`) silently kills every rule after it and has already shipped once
as a wrapped, broken scan bar. Neither the JS syntax check nor brace-balance
catches it; only exact open/close comment-delimiter counts do (see the skill).

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
- **Menchmark_Phased_Build_Plan.md** — the build order (Phase 0→8). Don't build a phase whose dependencies aren't in yet. **That doc is the authority on phase status** — it carries a dated status stamp per phase; read those rather than relying on a summary here, which is how this paragraph went two phases stale. As of 2026-08-05: **Phase 0 and 1 DONE**; **Phase 2 — 2a (#107) and 2b (#115) SHIPPED, 2c PARTIAL** (all four stores settled — attendance converted PR #138, homework resets, tracker copied by #219, passes had nothing to copy; removing the tabs is left, blocked on the Gradebook being read-only, #227), **2d SHIPPED (#123)** in two parts — the scan mechanic (#208) and the tile badges. **Contest is un-hidden again** (#210). **The Gradebook is UN-HIDDEN (#185) and Phase 2 is complete end to end** — the mirror gap is closed (`docs/Mirror_Gap_Proposal.md`), so corrections on the four old tabs transcribe into `data.trackedData` at the setter and a one-shot backfill carried the history across. **Homework is the one column that starts at the ship date rather than carrying history** (proposal decision 2) — which costs nothing, because the beta cohort onboarded in summer and has no homework history to carry. 2d has, however, cleared Phase 5 and the Firebase rebuild's step 1 — it settled the count value shape those were waiting on. **Phase 6a is data-only and orphaned (#187)**; 6b was never built. Phase 3 is 1-of-5, Phase 4 is 0-of-3.
- **Library_Review_Wizard_Spec.md** — the shared text library, per-pasuk Review Wizard, reviewed-version callback. Share-back deliberately deferred.
- **Print_Wizard_Spec.md** — the Print Wizard, six print components, Shulchani coin cards, the Tera-barcode constraint.
- **Offline_NoComputer_Secretary_Spec.md** — Offline Mode, Batch Import parser (spec'd against real scanner data), Secretary Mode.
- **Positioning.md** — settled copy decisions: the canonical self-description, "classroom economy" rejected as positioning (with its one permitted exception), "rebbeim" not "teachers", no licensing/free-forever language in user-facing copy, no AI framing. **Check it before writing or editing any user-facing copy.**
- **Firebase_Rebuild_Scope.md** — the settled scope for the upcoming Firebase/Firestore rebuild: real accounts, Firestore replacing localStorage-as-database, three tiers (rebbi/admin/superadmin), the incremental-write data model (not one JSON blob per class), the converter tool, what retires (file:// offline copy, Sheets-as-database, Apps Script), and the 8-step build order. **Not started — build order step 1 (data model design session) hasn't begun**, and **Phase 2d is locked to run before it.** Read before touching anything auth/sync/data-model shaped, and before assuming the current localStorage-only architecture described elsewhere in this file is the long-term plan. Its phase mapping was reconciled against the code on 2026-08-04; it now carries an **"Open questions for step 1"** list that has to be worked before the data-model session starts.
  - ⚠️ **Open conflict, unresolved by design — decide before step 1.** That rebuild needs the Firebase SDK, which cannot coexist with **rule 3 above** (single file, no build step) untouched: the modular SDK is ESM-for-bundlers, so it is either a forbidden CDN `<script src>` or a vendored compat bundle inlined into an already ~1.2 MB file. Neither rule wins by default. Per the conflict rule below, CLAUDE.md wins until a human decides otherwise — so **rule 3 stands, and the rebuild cannot start step 1 until this is settled.** The trade-offs are written up in the rebuild doc's open question 1; note that the back button and app security do *not* depend on this choice, though earlier drafts implied they did. **Narrowed 2026-08-07:** tier-1 rebbeim must get PWA/offline capability too, which rules the CDN option out for a second reason (a service worker can't reliably precache a cross-origin script) and leaves inline-vendored vs. same-origin-file-vendored as the only two live options — see the rebuild doc's open question 1 for the full narrowing, and `docs/Data_Custody_Decision.md` for why that choice is gated on the two-tier split rather than decided here.

If a spec and this CLAUDE.md ever conflict, **CLAUDE.md wins**; flag the conflict to the maintainer.

## ⚖️ RISK CALIBRATION (current stage: beta rebbeim onboarding)

**The trigger has fired.** v0.9.0 (2026-07-18) is the version the first wave of beta rebbeim onboard onto, so real classrooms now have data in the app. Migration paranoia is load-bearing again:

- Every data-model change gets `test-migration.html` run, not just eyeballed — and its copies of `migrateData()`/`load2fix()` synced first.
- Prefer additive fields + `load2fix()` backfill over a `DATA_VERSION` bump wherever the behavior can be expressed that way.
- Show the migration diff and the "here's why it can't lose data" line before the PR (PROPOSE FIRST, below).

The Google Sheet backup remains the ultimate safety net — PWA persistent storage does *not* survive an admin-forced clear-on-exit or Guest-mode wipe on managed Chromebooks. Never demote or bury the Sheet backup path.

## Code patterns to know

- **Tab navigation** is data-driven from `TAB_GROUPS`/`TAB_LABELS` (`app.html` ~line 4493) — new tabs register automatically. The dissolved print views are reached via 🖨 buttons on their data-owner tabs, not the nav.
- **The 5 R's:** the five groups display as **Record · Recognize · Reward · Review · Run** (order from `GROUP_ORDER`). Their **internal keys are still the old names** — `scan` / `standings` / `rewards` / `learn` / `manage` — because those keys are persisted in saved state. Never rename a key to match its label. Each group also carries an `icon` string: the inner markup of a 16×16 monochrome line SVG that `renderGroupTabs()` wraps.
- **Hide-until-ready is how an unfinished feature ships — not a simplified mode.** A feature that shows wrong numbers or has no path forward gets a **one-shot `navHidden` seed** in `load2fix()` (`contestHiddenSeeded` #133, `gradebookHiddenSeeded` #185): hide the tab once, set the flag, never look again — so a rebbi who deliberately switches it back on in Settings keeps it on. **Hidden, never removed:** no code deleted, no data touched, so the feature returns intact when its blocker lands. **The return trip is half the model, and it has now been walked twice** — Contest was hidden by #133 because its totals were only derivable from a wipeable log, and #210 un-hides it (`miniContestUnhidden`) once those totals are stored instead; the Gradebook was hidden by #185 because nothing wrote `data.trackedData`, and `gradebookUnhidden` brings it back once 2d and the mirror-gap fix gave it a writer. Both came back **intact**, because hiding never deleted anything. Un-hiding gets its own one-shot flag rather than clearing the original, so a rebbi who switched the tab back on by hand is not overruled either way. Deliberately **not** in `defaults`, so it fires for existing saves too — the opposite of the three-state `defaults` seam, which exists for presets that must never take a working tab away from someone using it. **Lean/Simple mode is not the model.** #121 built one (PR #150), reverted the same day in `61aa722`: the logic was right, but with one visible tab per group the subtab row rendered empty and the header sat on a wasted second row. Settled 2026-08-05 — don't propose it again.
- **Tracked activities never award points** — still true, and the only part of this rule Phase 2d left standing. **They are no longer excluded from arming surfaces.** Since 2d every tracked activity is armable everywhere (Record-tab buttons, floating scan panel, seating-chart dropdown, `ACT:` codes, printed Activity Menu), because `award()` routes a tracked scan to `recordTrackedScan()` rather than letting it fall through to the points path. The old Homework-Checked-only asymmetry in the seating-chart dropdown is gone — it existed solely because that one activity had a reroute and the others didn't. `reroutedActivity(a)` is now just `a.tracked===true`.
- **A tracked activity finds its record through `a.tiId`, never by name.** Stamped once in `load2fix()` (`trackedActIdsStamped`) using the old name tests, read forever after — so renaming an activity no longer turns it back into a plain 0-point one. `PASS_ACT_NAME` / `ATT_ACT_NAME` and the `homeworkActivity()`-style predicates survive **only** for that one-shot stamp and for wording; don't route on them. A tracked activity with no item gets one minted by `ensureTrackedItemFor()` when first armed. Freeze is deliberately itemless (#114).
- **The mirror is written at the LEGACY SETTER, by transcription — not at the scan.** 2c's tabs are still to go (#227), so the four old stores still drive four visible tabs and still own every value. `setAttendance()`, `setHw()`, `markHwCheckedToday()`, `setPass()` and `trackerLogAdd()` each call `mirrorTracked()` with the value they just wrote, that record's own `ts`, and the day it is **about** — never a recomputed one, and never `Date.now()` for a correction to a past day. A scan is simply another caller of those setters, which is why `recordTrackedScan()` no longer mirrors anything itself; doing both would write two entries for one scan. **`recordTracked()` is now only for items with no legacy store behind them.**
  - **Dedup is `date@ts`**, so every writer is safe to call twice — that is what makes the `load2fix()` backfill idempotent and what lets it run alongside 2c's own converter without double-counting.
  - **Corrections APPEND for preselect** (attendance, homework) and win by being last, which is how the Gradebook reads them; the two undo-shaped operations (pass "Give back", tracker undo) **remove**, because count and limited items are read as a sum and a length. Those are the only two places anything leaves the mirror, and both mirror a deletion the rebbi performed himself.
  - **The pass period reset deliberately does NOT propagate** — `data.passCount` is a rolling counter, the mirror is a dated history, and the two are meant to disagree after a reset.
  - When #227 removes a tab, delete its row from `TRACKED_LEGACY`, its row in the badge table, **and** the transcription call in that store's setter — and not before the Gradebook can write, because that setter is what feeds the mirror.
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

The app file is large (~22,450 lines / ~1.3 MB, verified against `main` 2026-08-07) — never read it whole.

## What NOT to do

- Don't "improve" or refactor code you weren't asked to touch
- Don't add npm dependencies or build steps
- Don't change the data format without explicit instruction and a migration function
- Don't assume two Claude sessions are working from the same file — always verify

## 🔁 SESSION SHAPE (when working a whole phase)

1. `EnterWorktree`, then `git branch -m <type>/<name>` — see BRANCH RULES.
2. Read the relevant spec doc(s) + the Phased Build Plan for that phase.
3. Work in surgical edits; validate after each (`node --check`).
4. If the data model changed: sync + run `test-migration.html`.
5. Update CHANGELOG under `[Unreleased]`.
6. Commit and push the branch; report what changed, the key diffs, and anything waiting in a PROPOSE-FIRST bucket.
7. Stop at the phase boundary — don't roll into the next phase's dependencies without checking they're wanted next.

## Maintainers

- Rabbi B. Steinerman ([@greenfrog367566](https://github.com/greenfrog367566)) — primary maintainer, merges all PRs
- Rabbi Goldwasser ([@AuH2O613](https://github.com/AuH2O613)) — co-contributor

---
name: wip
description: Show what is half-baked right now — open PRs against the WIP cap, uncommitted and unpushed worktrees, PRs closed without merging, branches whose content may never have landed, and dead worktrees. Run at the start of a working session, before opening a new PR, and any time "what's next?" feels like the wrong question because something is already unfinished.
---

`docs/NOW.md` says what we meant to do. `CHANGELOG.md` says what shipped.
**Nothing said what is stuck in between** — and that gap is where this repo
loses work.

Run this before asking "what's next," because half the time the honest answer
is "nothing new — finish something."

## Run it

```bash
node scripts/wip-audit.js            # the audit
node scripts/wip-audit.js --stale    # + dead worktrees and their removal commands
node scripts/wip-audit.js --json     # machine-readable
node scripts/wip-audit.js --no-fetch # skip the origin/main refresh (offline)
```

Takes 10-20 seconds — it runs `git status` once per worktree, and there are a
lot of worktrees. That runtime is itself a reading of how clean things are.

It **only reads.** It never commits, pushes, deletes a branch, or removes a
worktree. Anything destructive it can see, it prints as a command for a person
to run.

## What each lane means, and what to do about it

**OPEN PRS — n of 5 allowed.** The cap is a rule (`CLAUDE.md` → "Finishing
work"). Over it, the instruction is not "hurry" but **stop starting**: merge or
close something before opening anything new. Flags worth reacting to:
- `CONFLICTS` — rebase it now. Every `app.html` PR that stays open makes the
  next one conflict too; this is the mechanism by which the pile compounds.
- `idle Nd` — a draft nobody has touched in a week is not in flight, it is
  forgotten. Decide: finish, or close it and say so in the PR.

**UNCOMMITTED WORK.** The most losable thing in the whole report. These changes
exist in exactly one place, on one machine, and a worktree sweep would delete
them. Triage each: commit and push it, or discard it deliberately. A worktree
marked `LIVE SESSION` is locked by another running session — **leave it alone**.

**UNPUSHED COMMITS.** Real commits with no remote branch. They vanish with the
worktree and no PR list will ever mention them. `git push -u origin <branch>`
and open a draft PR, or discard on purpose.

**COMMITS THAT NEVER LANDED.** The nastiest lane, and the reason this script
exists rather than a one-liner: these look *completely finished* from `gh` and
from `docs/NOW.md`. The PR is merged and closed — but commits were pushed to
the branch afterwards that no PR ever carried, so `main` does not have them.
Four real examples on 2026-08-20 (`feat/board-fab`, `feat/shelves-toggle`,
`fix/theory-audit-batch-1`, the Chazaroom PTZ work) — one of which,
`fix/theory-audit-batch-1`, was a tab-audit item already counted as closed.

**Verify each with `branch-merge-audit` before concluding either way**, and
note the detection's limit: it is a *date* test (commits newer than the merge),
so it cannot see work whose commit predates the merge but still never reached
`main`. Only a content check finds that class — grep `main` for a line the
commit adds or removes.

**CLOSED WITHOUT MERGING.** Work that got done and then dropped. Some of these
are correct decisions (superseded, wrong approach). The failure mode is the
*undecided* ones — closed to clear the list, with the idea still wanted and no
record of it anywhere. If the idea is still wanted, it belongs in `docs/NOW.md`
or an issue; if it is not, nothing more is owed.

**BRANCHES POSSIBLY NEVER LANDED.** Not an ancestor of `main`, and no open or
merged PR. Squash-merges strip ancestry, so this lane can only ever say *check
me* — **use the `branch-merge-audit` skill to confirm before deleting anything.**
The ones that matter most read `(no PR ever)`: work that was branched, built,
and never even proposed.

**STALE WORKTREES.** Landed, unlocked, clean — dead weight. They slow this
script down and bury the live worktrees among the dead ones. Removing them is a
stop-and-ask action per `CLAUDE.md`: **list them for Ben, never sweep them.**

## When to run it

- **Start of any working session** — before reading `docs/NOW.md`, not after.
  NOW.md answers "what's next"; this answers "what's already unfinished," and
  that question outranks it.
- **Before opening a PR** — to see whether you are about to break the cap.
- **After merging** — the merged PR usually leaves a ship-tail behind (see
  `CLAUDE.md` → "Merged is not done").
- **When the pile feels bad.** That feeling is usually accurate and this
  quantifies it.

## Its counterpart: `scripts/testbench.js`

This skill tells you what is unfinished. **`testbench.js` makes it openable** —
one worktree per open PR and per `spike/*` branch, named after the branch:

```bash
node scripts/testbench.js        # create anything missing (idempotent)
node scripts/testbench.js --list # just show branch -> folder
```

The two are deliberately opposite halves and must stay that way: **testbench
only ever adds; only this skill's `--stale` proposes removals, and only ever as
a list for a human.** Nothing in either script deletes a worktree, because a
worktree is exactly where uncommitted work hides — the audit that prompted both
found 749 uncommitted lines that a sweep would have destroyed.

## What it deliberately does not cover

- **Stale doc status headers** — that is the `doc-audit` skill.
- **Whether a branch's content really landed** — that is `branch-merge-audit`.
- **Whether merged work actually works in a classroom** — nothing automated can
  tell you that. It is the ship-tail in `docs/NOW.md` → "Merged, not done."

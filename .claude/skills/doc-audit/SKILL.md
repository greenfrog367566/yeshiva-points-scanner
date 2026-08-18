---
name: doc-audit
description: Audit docs/*.md planning/design docs for drift — status headers that say PROPOSED/APPROVED for work that has actually shipped, sibling docs that should be merged, and load-bearing docs that no longer cross-link each other. Run periodically (see the doc-audit-monthly schedule) or on demand when the planning-docs pile feels stale.
---

Menchmark's `docs/` folder accumulates design/proposal docs faster than anyone
remembers to update them. The 2026-08-18 audit found 29 planning docs, 5 of
which had sat with stale `APPROVED`/`ACCEPTED` status headers for days after
the PRs implementing them merged, plus two pairs of docs that were really one
feature split across files, and the two most-cited docs in the whole set
(`Menchmark_Phased_Build_Plan.md` and `Menchmark_UI_Redesign_Summary.md`)
never referencing each other by filename despite being read together
constantly. This skill is that audit, made repeatable.

## When to run this

- On a schedule (see `doc-audit-monthly` in `/schedule` or `CronList`) — the
  point of scheduling it is that nobody has to remember.
- On demand, if `docs/` feels like it has too many overlapping proposals, or
  before a big planning push where stale status would mislead.

## The process

**1. List every doc in `docs/`.** `ls docs/*.md` (exclude non-planning files:
`user-guide.md`, `scanner-setup.md`, and anything under `docs/archive/` or
`docs/tera-scanner-codes/`). Cluster them by subject — Firebase rebuild, UI/nav,
feature specs, marketing/positioning are the clusters that existed as of
2026-08-18, but re-derive the clustering from what's actually there each time;
new docs may not fit the old buckets.

**2. Fan out a survey agent per cluster (in parallel, one message, multiple
`Agent` calls).** Each agent reads every doc in its cluster in full and cross-checks
against `CLAUDE.md`, `docs/NOW.md`, `Menchmark_Phased_Build_Plan.md`, and
`git log`/`gh pr view <n> --json state,mergedAt` for any PR number the doc
cites. For each doc, report: purpose (one line), status as stated vs. status
verified against merged PRs, size, what it overlaps/restates/is-superseded-by,
and a recommendation — KEEP STANDALONE / MERGE INTO \<other doc\> / ARCHIVE
(shipped, historical) / TRIM (cut a stale section to a pointer) / LINK (add a
missing cross-reference).

**Do not trust a doc's own status line without checking.** That's the entire
premise of this audit — a status line is a claim, not a fact, until a `gh pr
view` confirms the PR it names is actually merged.

**3. Synthesize.** Collect all cluster reports and produce one consolidated
list. Flag, specifically:
- Docs whose stated status contradicts a merged PR (the highest-value find —
  this is the drift the CLAUDE.md restamp rule exists to prevent, and its
  presence here means that rule got skipped somewhere).
- New sibling-doc pairs that cover the same feature and should merge.
- Any doc that isn't reachable from `docs/NOW.md` or
  `Menchmark_Phased_Build_Plan.md` by an explicit filename link — an orphaned
  doc is the real "did we lose track of this" risk.

**4. Report, don't silently fix.** This skill finds drift; it does not execute
consolidation moves on its own. When run interactively, present the findings
(a table is fine, an Artifact is fine for a large list) and ask before editing
anything — the same "propose first" pattern the 2026-08-18 consolidation
followed once. When run unattended on a schedule, the finished report is the
deliverable: summarize it in the session's final message so it's visible in
`/tasks` or wherever the scheduled run's output surfaces, and do not merge or
push anything without a human turn approving it first — a scheduled run has no
one to ask "yes, go ahead" in the moment.

## What "drift" looks like, concretely (examples from 2026-08-18)

- A doc's header says `**Status: ✅ APPROVED 2026-08-13 by Ben.**` and never
  mentions a PR number, but `git log` shows the feature merged three days ago.
  → restamp it (or flag it for a human to restamp — see CLAUDE.md rule 5).
- Two docs about the same tab/feature, one titled `..._Spec.md` and a newer
  one titled `..._Trim_Proposal.md`, where the newer one's own text says "this
  was already decided in the older doc and never implemented." → they're one
  feature, merge them.
- An index doc (`Menchmark_Phased_Build_Plan.md`) whose phases map 1:1 onto
  another doc's sections, but the index never names that doc's filename
  anywhere in its own text. → add the link both directions.

---
name: worktree-audit
description: Identify which worktrees under .claude/worktrees/ are safe to propose removing. Use before starting new work, or when asked to clean up worktrees — this repo runs several Claude sessions at once, so removing a live one breaks that session, and removal is always propose-then-ask, never automatic.
---

# Auditing stale worktrees

Merged worktrees accumulate and are worth clearing — but this repo runs several
Claude sessions at once, and **removing a worktree out from under a live session
breaks it.** So this is a look-then-ask step, never an automatic cleanup.

## List them

```bash
git worktree list --porcelain | grep -E '^(worktree|branch|locked)'
```

## Safe-to-propose criteria

A worktree is safe to propose for removal only when **all** of these hold:

- its PR is `MERGED` (check both names — the local branch may still be
  `worktree-feat+x` while the PR is `feat/x`; match on the directory name too)
- it is **not** `locked` — the lock reads `claude session … (pid N)` and means a
  session is live in it right now
- `git -C <path> status --porcelain` is empty
- no session has written to it recently

## Then stop

**List the candidates and ask before removing any.** Deleting is a stop-and-ask
action (see Confirmation policy in CLAUDE.md). Never remove a worktree that is
`locked`, dirty, or in use by another session.

## Related

Squash-merges make merged branches look unmerged — if you are judging whether a
worktree's branch actually landed, use the `branch-merge-audit` skill rather
than ahead/behind counts.

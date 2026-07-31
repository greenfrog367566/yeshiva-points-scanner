---
name: branch-merge-audit
description: Verify whether a branch's content already landed on main after a squash-merge — ahead/behind counts, git log, git cherry, and git merge-base --is-ancestor all falsely report a squash-merged branch as unmerged.
---

A squash-merge strips commit ancestry while preserving content. The squash commit
has a **single parent** (the merge-base), so git sees no link back to the branch —
and `git log`/`git status`/`git cherry` will report the branch as diverged, "N
commits ahead," or "never merged forward" even when **every line of its content is
already on `main`.**

**Never treat ahead/behind counts alone as evidence of unmerged work.** Before
assuming anything needs porting — or is at risk of being lost in a branch prune —
verify *content*, not ancestry:

```bash
git diff --stat <branch-tip> <suspected-squash-commit>   # empty = content is on main
git log -1 --format='%h parents:[%p]' <merge-commit>      # one parent = squash
git ls-tree -r --name-only <branch> | ...                 # any files only on branch?
```

`git cherry` and `git merge-base --is-ancestor` both answer the *ancestry* question,
not the content question — they will report a squash-merged branch as unmerged. That
is expected, not a warning sign.

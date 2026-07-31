#!/usr/bin/env bash
# Keep the shared main checkout current with origin/main.
#
# Why this exists: parallel Claude Code sessions each work in their own
# worktree under .claude/worktrees/ and merge their own PRs. None of them
# touch the shared checkout, so it silently drifts behind main — it was once
# 31 commits stale while every merge looked healthy, which reads exactly like
# a failed deploy when you open app.html and see old code.
#
# Wired to SessionStart and SessionEnd in .claude/settings.json, so any session
# anywhere in the repo re-syncs the shared checkout.
#
# This never destroys work. It fast-forwards only, and only when the shared
# checkout is sitting on main with nothing uncommitted. If you have parked
# branch work there, it leaves it completely alone and just tells you how far
# behind it has fallen.

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

# First entry of `git worktree list` is always the main working tree — the
# shared checkout — whether we're called from it or from a worktree.
main_checkout=$(git worktree list --porcelain 2>/dev/null |
  awk '/^worktree /{ print substr($0, 10); exit }')
[ -n "$main_checkout" ] && [ -d "$main_checkout" ] || exit 0

cd "$main_checkout" 2>/dev/null || exit 0

# Fetching is always safe — it moves refs, never files.
git fetch --quiet origin main 2>/dev/null || exit 0
remote=$(git rev-parse --quiet --verify FETCH_HEAD 2>/dev/null) || exit 0
[ -n "$remote" ] || exit 0

branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null)
dirty=$(git status --porcelain --untracked-files=no 2>/dev/null)

report_blocked() {
  behind=$(git rev-list --count "HEAD..$remote" 2>/dev/null) || return 0
  [ "${behind:-0}" -gt 0 ] || return 0
  printf '{"systemMessage":"Shared main checkout is %s commit(s) behind origin/main — left untouched (%s). Files in %s are stale until you resolve that.","suppressOutput":true}\n' \
    "$behind" "$1" "$main_checkout"
}

if [ "$branch" != "main" ]; then
  report_blocked "parked on ${branch:-a detached HEAD}, not main"
  exit 0
fi

if [ -n "$dirty" ]; then
  report_blocked "uncommitted changes present"
  exit 0
fi

before=$(git rev-parse HEAD 2>/dev/null) || exit 0
git merge --ff-only --quiet "$remote" 2>/dev/null || exit 0
after=$(git rev-parse HEAD 2>/dev/null) || exit 0

# Silent when there was nothing to do — the common case.
[ "$before" = "$after" ] && exit 0

moved=$(git rev-list --count "$before..$after" 2>/dev/null)
printf '{"systemMessage":"Synced the shared main checkout to origin/main (+%s commit(s), now %s).","suppressOutput":true}\n' \
  "${moved:-?}" "$(git rev-parse --short HEAD)"

#!/usr/bin/env bash
# Auto-commit + push after each agent task.
# Scoped strictly to the Beajee repo (github.com/4beajee/Beajee), branch main only.
# Registered as a Stop hook in .claude/settings.json.
set -uo pipefail

# Must be inside a git work tree
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Only the Beajee repo — match the GitHub origin, not just a folder name
origin_url=$(git config --get remote.origin.url 2>/dev/null || true)
case "$origin_url" in
  *4beajee/Beajee*) ;;
  *) exit 0 ;;
esac

# Only auto-commit on main (single-branch flow)
[ "$(git symbolic-ref --short -q HEAD || true)" = "main" ] || exit 0

# Skip if a merge/rebase/cherry-pick is in progress
gd=$(git rev-parse --git-dir)
if [ -f "$gd/MERGE_HEAD" ] || [ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ] || [ -f "$gd/CHERRY_PICK_HEAD" ]; then
  exit 0
fi

# Nothing to commit? then quietly stop
[ -n "$(git status --porcelain)" ] || exit 0

git add -A
files=$(git diff --cached --name-only | head -5 | tr '\n' ' ')
count=$(git diff --cached --name-only | wc -l | tr -d ' ')
git commit -q \
  -m "chore(auto): checkpoint $(date +'%Y-%m-%d %H:%M')" \
  -m "Auto-commit after agent task (${count} file(s)). Touched: ${files}" || exit 0

# Best-effort push; never fail the turn if offline or rejected
git push -q origin main 2>/dev/null || true
exit 0

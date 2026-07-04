# Automated commits

This repository auto-commits and pushes after each Claude Code task, so `main`
acts as a running log of changes.

- **Hook:** `.claude/hooks/auto-commit.sh`, registered as a `Stop` hook in
  `.claude/settings.json`.
- **Behaviour:** when an agent turn ends, if the working tree has changes **and**
  the current branch is `main` **and** the repo is `4beajee/Beajee`, it runs
  `git add -A`, creates a `chore(auto): checkpoint <timestamp>` commit, and
  pushes to `origin/main` (best-effort).
- **Safety:** skips while a merge/rebase/cherry-pick is in progress, never
  force-pushes, and only ever touches `main` in this repo.
- **To pause it:** remove the `Stop` block from `.claude/settings.json`
  (or delete `.claude/hooks/auto-commit.sh`).

The `main` branch is the single source of truth; there are no other branches.

---
id: s5-02-terraform-continues-its-open-pull-request
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill runs again while its earlier review request is still open, or after that one was merged or closed, where should its new work go?

## The decision, in plain words

An open request is continued, so there is only ever one; once the earlier one was merged or closed, the skill starts again from the main line under the same name.

## The options, in plain words

A. Continue the open request; after a merge or a close, start afresh from the main line, replacing what the earlier run left under that name.
B. Open a new request under a new, dated name on every run.
C. Stop and ask a person whenever an earlier run's work still exists under that name.

## What I had to decide

`branches.terraform` is one fixed name (default `docs/omni-terraform`, no placeholder), and `/omni:terraform --refresh` runs again later on the same repository. The spec says terraform opens one pull request on that branch, and does not say what happens when the branch, or its pull request, already exists.

## What I did meanwhile

Step 0 of `kit/plugin/skills/terraform/SKILL.md` runs `gh pr list --head <terraform branch> --base <repo.defaultBranch> --state open`. One open: `git worktree add -B <terraform branch> <worktrees>/terraform <remote>/<terraform branch>`, and step 6 rewrites that pull request's body. None open: the same command from `<remote>/<repo.defaultBranch>`, and step 6 pushes with `--force-with-lease`; a branch whose pull request is open is never forced.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. A forced push over a merged branch loses nothing, and a closed pull request's commits stay readable on GitHub.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person ever keeps unmerged work on that branch after closing its pull request, which starting afresh would replace.

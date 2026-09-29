---
id: s4-01-target-slice-worktree
prd: 563
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When several pieces of work land in the same other repository at once, where does each one get built on this computer?

## The decision, in plain words

Each piece gets its own working copy placed right beside that repository's shared copy, and the copy is removed once its pull request is open.

## The intro, for fun

Two builders, one workbench: somebody has to hand out the stools.

## The punchline, for fun

Everyone gets a stool next to the bench, and folds it away after.

## The options, in plain words

A. a worktree per slice at <worktrees>/targets/<name>--<slice>, removed once the sub-PR is open (built)
B. a worktree per slice inside the clone's own folder
C. build in the clone itself, one slice at a time per target

## What I had to decide

Whether each slice built in a target works in its own worktree beside the target's clone, or somewhere else.

## What I did meanwhile

do-work --target builds each slice in a worktree at <worktrees>/targets/<name>--<slice>, and pr --repo's claim detaches the clone after pushing so that worktree can check the branch out.

## What it costs to change later

A different place is a changed path in two skill texts; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'a worktree of that target's clone'; the path and the detach after the claim are mine (author).

---
id: s5-01-care-own-worktree
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

PR care changes and pushes code while it watches. Should it work in the person's own copy of the project, or in a separate copy of its own?

## The decision, in plain words

PR care works in a separate copy of its own, so the person's own copy is never switched or changed while it watches.

## The intro, for fun

Two cooks, one cutting board, and one of them keeps swapping the vegetables.

## The punchline, for fun

So PR care brought its own board.

## The options, in plain words

A. A. A worktree of its own, reset each round (built).
B. B. The person's checkout, refusing to start when it has changes.
C. C. A fresh clone in a temporary folder.

## What I had to decide

Where /omni:pr-care makes its conflict, CI and review fixes: the person's checkout, or a worktree of the feature branch; the spec does not say.

## What I did meanwhile

The skill adds a worktree at <worktrees>/pr-care-<n>, resets it to the feature branch at the start of every round, and removes it when the watch stops.

## What it costs to change later

A few lines in kit/plugin/skills/pr-care/SKILL.md; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people expect to see care's fixes appear in their own checkout is not known.

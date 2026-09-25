---
id: s11-02-plan-reuses-brainstorm-worktree
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When the idea session hands over to planning, should planning work in the same working copy the idea was written in, or open its own?

## The decision, in plain words

The same one. The idea session has just created the working copy for the feature, so planning continues there instead of trying to open a second copy of the same branch, which the tools refuse.

## The options, in plain words

A. Brainstorm tells plan to reuse its worktree; plan unchanged (built).
B. Change the plan skill's step 2 to detect a worktree already holding the branch, for every caller.
C. Brainstorm removes its worktree before handing over, so plan adds its own.

## What I had to decide

The plan skill's step 2 adds a worktree at worktrees/<topic> for the feature branch when it exists on the remote. The brainstorm skill has just created that exact worktree and pushed the branch, and git refuses a second worktree on a branch already checked out. Upstream brainstorming invoked its plan skill the same way and did not say.

## What I did meanwhile

Step 8 of the brainstorm skill follows /omni:plan from inside the feature worktree and tells it to use that worktree rather than add a second one. The plan skill itself is unchanged.

## What it costs to change later

A constant: if the answer is B, the plan skill's step 2 gains a line (a branch already checked out in a worktree is used there), and brainstorm's step 8 drops its sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No live run of brainstorm then plan has happened yet (author).

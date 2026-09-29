---
id: s5-01-target-pr-empty-commit
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

A pull request cannot open on a branch that holds nothing new yet. How should the build open each other repository's pull request before any work has landed there?

## The decision, in plain words

It adds one empty, signed starting commit to the new branch, so the draft pull request can open at once and be followed from the start.

## The intro, for fun

GitHub will not open a pull request for a branch with nothing to show.

## The punchline, for fun

So the branch arrives with an empty box and a polite label on it.

## The options, in plain words

A. A. One empty signed commit on the new branch, then the draft pull request at once, the option built.
B. B. Open each repository's pull request only after its first piece of work has landed there.

## What I had to decide

How /omni:ultra-yolo step 2 opens a draft target feature PR when the target's freshly cut feature branch equals its default branch, which GitHub refuses as a pull request with no commits.

## What I did meanwhile

The skill cuts the feature branch, makes one empty commit (git commit --allow-empty, signed like every other), pushes it, and opens the draft target feature PR right away, as the spec's step 2 asks.

## What it costs to change later

One paragraph of the ultra-yolo skill text: opening the target PR after the first sub-PR merges instead would move that item from step 2 into /omni:ultra-wave's merge step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the draft target PR in step 2 but does not say how to open it on a branch with no commits yet.

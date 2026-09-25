---
id: s3-02-closed-pr-reads-as-dropped-claim
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

If a slice's sub pull request was closed without merging, should the slice look open again, as if nothing had claimed it, or should the board show some new closed-and-abandoned state?

## The decision, in plain words

A closed, unmerged pull request is treated as if it never existed — the slice becomes runnable or blocked again like any other unclaimed slice.

## The options, in plain words

A. Treat a closed, unmerged pull request as no pull request at all (what was built) — the slice becomes runnable or blocked again.
B. Keep the closed pull request as the slice's match, so a slice with an abandoned attempt never returns to runnable without a person clearing it by hand.

## What I had to decide

What board state a slice reads as when its only matched pull request was closed without merging.

## What I did meanwhile

Read a closed, unmerged pull request as a dropped claim: it is filtered out before matching, so the slice falls back to whatever its blockers say (runnable or blocked). No new state was added for this.

## What it costs to change later

Adding a distinct abandoned state later needs one more branch in the state and matching logic, and probably a CLI column; no stored data would need migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec's five states nor the task's six name what happens to a closed-and-unmerged pull request.

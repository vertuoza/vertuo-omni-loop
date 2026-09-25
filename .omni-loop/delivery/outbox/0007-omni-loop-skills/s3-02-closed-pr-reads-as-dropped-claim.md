---
id: s3-02-closed-pr-reads-as-dropped-claim
prd: 7
slice: s3
rank: high
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

If a slice's sub pull request was closed without merging, should the slice look open again, as if nothing had claimed it, or should a person's deliberate close be respected instead?

## The decision, in plain words

A closed, unmerged pull request is treated as if it never existed — the slice becomes runnable or blocked again, which can override a person's deliberate decision to close it without merging.

## The options, in plain words

A. Treat a closed, unmerged pull request as no pull request at all (what was built) — the slice becomes runnable or blocked again, even after a person closed it on purpose.
B. Keep the closed pull request as the slice's match, so a slice a person closed on purpose never returns to runnable without a person clearing it by hand.

## What I had to decide

What board state a slice reads as when its only matched pull request was closed without merging.

## What I did meanwhile

Read a closed, unmerged pull request as a dropped claim: it is filtered out before matching, so the slice falls back to whatever its blockers say (runnable or blocked). No new state was added for this, and no signal distinguishes an abandoned automated attempt from a pull request a person closed on purpose.

## What it costs to change later

If a person closes a sub pull request on purpose to stop a slice from being retried, the next board run (and a wave built on it) reopens that slice anyway — reversing that requires a person to notice and act again, which is a real, ongoing cost, not a one-line code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec's five states nor the task's six name what happens to a closed-and-unmerged pull request, and nothing distinguishes a dropped automated claim from a person's deliberate close.

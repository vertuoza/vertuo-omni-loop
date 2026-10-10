---
id: s4-02-no-design-review-on-a-target-slice
prd: 1369
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

When a slice is built in another repository from a planning repository, should the design review still look at its screens?

## The decision, in plain words

It does not run there for now: the planning repository never starts the other repository's app, so the review section says it was not run.

## The intro, for fun

The review packed its camera for a trip to the neighbour's house.

## The punchline, for fun

The neighbour only lets in the plumber, so it waved from the fence.

## The options, in plain words

A. Skip the review on a target slice, with one line saying so (built)
B. Run the critique and audit from the source only, with no app and no lint
C. Read the target's committed design flag and paths, and review as here

## What I had to decide

Whether a slice built in a target repository gets a design review from the source alone, from the target's own settings, or none.

## What I did meanwhile

Under --target the review does not run, and the sub-PR's Design review section is one line saying it was not run on a target slice.

## What it costs to change later

One sentence of the do-work skill; turning it on later reads the target's committed design flag, as its preflight is read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not mention multi-repository slices at all (author).

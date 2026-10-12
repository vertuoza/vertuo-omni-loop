---
id: s1-03-coverage-helper-outside-territory
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Was it right to touch the review gate's file, which belongs to a later slice, to share the new definition of a law?

## The decision, in plain words

Yes, with the smallest possible change: the gate now asks the shared rule test instead of keeping its own copy, and it behaves exactly as before.

## The intro, for fun

Two copies of one definition always drift apart.

## The punchline, for fun

So one of them retired early.

## The options, in plain words

A. A. Swap the private helper for the shared one in s1, behaviour unchanged.
B. B. Leave the review gate's own copy alone and let the later slice make the swap.

## What I had to decide

Whether s1 may swap decision-coverage.ts's private law test for the shared one, outside its territory.

## What I did meanwhile

decision-coverage.ts imports isConfirmedRule from the registers in place of its own isLaw; its tests pass unchanged. Slice s3 builds law-locked in that file next wave.

## What it costs to change later

Reverting is one import and five lines in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when asks both files to agree, but its territory for s1 does not list decision-coverage.ts.

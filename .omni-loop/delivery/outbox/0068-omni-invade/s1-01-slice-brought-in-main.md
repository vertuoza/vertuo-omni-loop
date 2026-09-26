---
id: s1-01-slice-brought-in-main
prd: 68
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The plan said the feature branch would take in the finished knowledge forms work before the first wave, but it had not. Should this first slice have brought that work in itself?

## The decision, in plain words

The slice took in the latest main branch before building, so the forms it renames exist. When this slice merges, the feature branch gets that work too.

## The intro, for fun

The plan said the furniture would arrive first. The movers showed up to an empty flat.

## The punchline, for fun

So they brought the sofa themselves, and signed for it.

## The options, in plain words

A. Take in main on the slice branch and build (what was built).
B. Stop the slice, and have the wave merge main into the feature branch first.

## What I had to decide

Whether a slice may take in the main branch when its feature branch has not yet, or whether it should stop and wait for the wave to do it.

## What I did meanwhile

The slice's sub-PR carries main's recent commits as a merge; the feature branch picks them up when it merges.

## What it costs to change later

Low: the merge is clean and main's commits would reach the feature branch anyway. Undoing it means merging main into the feature branch directly and rebasing the slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names the merge as the feature branch's step; which branch takes it is the only open point (author).

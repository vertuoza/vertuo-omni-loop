---
id: s2-02-wave-frontier-still-counts-generated-ground
prd: 1138
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The plan check now lets two pieces of work that share only a built file run side by side, but the part that picks what a wave starts still keeps them apart. Should it follow the same list?

## The decision, in plain words

We left the wave picker as it is, since it sat outside this slice's agreed files; a plan that still lists built files may run one of those pieces a wave later than the plan check allows.

## The intro, for fun

The planner says two can dance; the bouncer still lets in one.

## The punchline, for fun

Nobody is hurt, the second just waits a song.

## The options, in plain words

A. A. Leave the wave picker as it is, since plans stop listing built files after the next piece of work (built).
B. B. Hand the wave picker the list of built files in a follow-up.
C. C. Make every check that compares files ask for the list, so none can forget it.

## What I had to decide

Whether the wave picker should read the list of built files too, in a follow-up.

## What I did meanwhile

A plan listing a generated path in two slices of one wave passes omni plan check, and the board defers the second slice to the next wave run. Once /omni:plan stops listing generated paths (s3), no plan hits this.

## What it costs to change later

A follow-up hands the list to the wave picker; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not measured how often a plan still lists a generated path in two slices of one wave. (author)

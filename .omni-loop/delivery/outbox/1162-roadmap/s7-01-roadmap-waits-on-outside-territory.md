---
id: s7-01-roadmap-waits-on-outside-territory
prd: 1162
slice: s7
rank: medium
bears-on: none
raised: 2026-10-07
wave: 4
---

## The question, in plain words

Naming what a waiting project waits on, and showing on the loop's page which repositories a step touches, needed small changes in two files this piece of work was not given. Change them here, or write the same words a second time?

## The decision, in plain words

Both files got a small addition: the roadmap's code now accepts finer words for a waiting project, such as the wave being built or red checks, so the loop and the roadmap's page say it the same way. The loop's sending command now takes the repositories of a step, or reads them from the plan.

## The intro, for fun

Two files over the fence, and a sentence nobody wanted to write twice.

## The punchline, for fun

So the loop borrows the roadmap's words instead of inventing its own.

## The options, in plain words

A. A. Widen s6's waits-on line with an optional argument and add the flag to the loop command (built)
B. B. Write a second waits-on line inside the loop's code, and leave the command without the flag
C. C. Leave both for a later piece of work, so the loop names only the coarse states and no repositories

## What I had to decide

`kit/lib/roadmap/push.ts` (s6's) and `kit/bin/commands/loop.ts` are outside s7's territory. The waits-on line had to be widened with `building wave <k>/<m>` and `CI red` without duplicating its wording, and a tick had to carry its repositories, which only the command's flags can add.

## What I did meanwhile

`waitsOn(row, rows, live)` gained an optional third argument: finer state words by row id, used in place of the state's own; `rowStates(roadmap, standings)` was extracted so `omni next` and the push read the rows the same way. `omni loop push tick` gained `--repos <repo,…>`, and without it sends the repositories the latest loop plan gives that step; a tick with none sends no `repos`, as before. Every existing push and loop test passes unchanged.

## What it costs to change later

Nothing to undo: both changes are additive. Moving them would be one parameter and one flag in another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s7 `kit/lib/loop/` and `kit/bin/loop.test.ts` but not the command file that reads the tick's flags; whether it meant to was not settled.

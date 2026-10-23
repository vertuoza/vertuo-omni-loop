---
id: s1-01-help-count-guard
prd: 2485
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Adding the new command broke a guard that counts every command the kit has, and that guard lives outside the files this part of the work may change. May it count one more command?

## The decision, in plain words

The guard now counts sixty-five commands instead of sixty-four. Nothing else in that file changed.

## The intro, for fun

One new command walked in, and the doorman's tally sheet disagreed.

## The punchline, for fun

The tally now says one more, and nobody else got in.

## The options, in plain words

A. A. Count sixty-five commands in the help table's test, as built.
B. B. Widen the plan's territory to name the help table's test, and keep the same change.
C. C. Drop the count from the test, so a new command never needs it changed.

## What I had to decide

Keep the new count of sixty-five commands in the help table's test, or ask for that test to be widened in the plan instead.
Decided by: Jev (hardToRevert 0.72) · agent said false

## What I did meanwhile

The guard is green with the new command counted; every other check of the help table runs as before.

## What it costs to change later

One number in one test; reverting it is the same one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this part named the help table but not its test, which counts the commands (author).

---
id: s5-01-skill-checks-outside-ground
prd: 216
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The spec asks the plugin's test file to check that the two new skills exist and that the brainstorm and the plan call them, but that file is outside the ground this slice was given. Should the slice add those checks there anyway?

## The decision, in plain words

Yes. The checks were added to the plugin's test file: no other slice of this wave touches it, and without them nothing would notice a later edit dropping one of the calls.

## The intro, for fun

The test file sat just past the fence, and the slice had a ball to throw.

## The punchline, for fun

It threw the ball over, and wrote down that it did.

## The options, in plain words

A. A. Add the checks to the plugin's test file, outside the slice's ground
B. B. Keep to the ground: no new check, only the guards that already run on every skill
C. C. Keep the checks, and widen the plan so the slice's ground names that test file

## What I had to decide

Add the checks the spec names in a file outside the slice's ground, or keep to the ground and leave the new calls unchecked.

## What I did meanwhile

The plugin's test file has one new block checking both skills and the four calls, each after what it must follow. Nothing else outside the ground changed.

## What it costs to change later

Deleting one block of tests. Nothing depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan only asks that this test file stay green; whether leaving it out of the slice's ground was deliberate is unknown.

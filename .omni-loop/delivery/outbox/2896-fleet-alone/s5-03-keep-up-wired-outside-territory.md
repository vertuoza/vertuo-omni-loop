---
id: s5-03-keep-up-wired-outside-territory
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

Keeping the mission branch in step only happens if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its keeping up, beside the branch and the merge the two slices before it wired the same way.

## The intro, for fun

A new chore is no use until it is written on the fridge.

## The punchline, for fun

One line on the fridge, signed so nobody wonders who wrote it.

## The options, in plain words

A. A. Change the one line in the app's job list (built).
B. B. Leave it to a later slice, so the branch never follows until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives its keeping up from the app's job list; without the line the mission branch would never follow the default branch.

## What it costs to change later

Undoing it is one line; the mission branch then stays where it was cut, as before this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and slices s3 and s4 changed it the same way.

---
id: s4-03-join-wired-outside-territory
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The merge into the mission branch only happens if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its merge, as the slice before it did for cutting the branch. Without that line the merge gate would be built and tested but never run.

## The intro, for fun

A new door is no use until someone tells the house it is there.

## The punchline, for fun

One line outside the fence, named so nobody trips on it.

## The options, in plain words

A. A. Change the one line in the app's job list (built).
B. B. Leave it to a later slice, so the merge never runs until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives the merge gate's reads and the merge from the app's job list, beside the branch it already received.

## What it costs to change later

Undoing it is one line; the gate then never runs and a ready PRD waits for a person, as at with-you.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and the slice before this one changed it the same way.

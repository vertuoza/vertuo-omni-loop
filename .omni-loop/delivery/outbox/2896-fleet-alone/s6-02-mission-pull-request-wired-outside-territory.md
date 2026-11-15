---
id: s6-02-mission-pull-request-wired-outside-territory
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The mission pull request is only opened if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its pull request and the Omni page's address, as the slices before it did for the branch, the merge and the rebase.

## The intro, for fun

The new door is built; someone still has to tell the house it is there.

## The punchline, for fun

One line outside the fence, named so nobody trips on it.

## The options, in plain words

A. Change the one line in the app's job list (built).
B. Leave it to a later slice, so the mission pull request never opens until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives the mission pull request's reads and writes from the app's job list, beside the branch, the merge and the rebase it already received.

## What it costs to change later

Undoing it is one line; the mission pull request then never opens and no landing is read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and slices s3, s4 and s5 changed it the same way.

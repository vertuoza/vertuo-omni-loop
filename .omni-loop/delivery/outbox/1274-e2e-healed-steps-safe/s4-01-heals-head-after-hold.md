---
id: s4-01-heals-head-after-hold
prd: 1274
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Once a changed recording is held back from the commit, how should the check on a sub-PR branch still see that it changed?

## The decision, in plain words

The check on a sub-PR branch compares what is committed there, and a held recording is not committed, so it can report nothing changed. I kept both behaviours as they are and left the gap for you to settle.

## The intro, for fun

A recording that waits outside the door is hard to spot from inside the house.

## The punchline, for fun

Better to decide who knocks than to find out after the party.

## The options, in plain words

A. A. Leave both as built: the skill lists the changed steps first, then holds them.
B. B. Let the check also read the held recordings, so it lists them on any branch.
C. C. Hold only after the sub-PR is opened, so the branch still carries the changed recording.

## What I had to decide

Both commands were merged as written: the first lists changes between the default branch and a branch, the second keeps changed recordings out of that branch's commits. Their order in the skill makes the list read before the hold, but the list on a sub-PR branch is empty for a held step.

## What I did meanwhile

I changed neither command and renumbered the skill's steps after the merge so both stay documented.

## What it costs to change later

A small change later: the check could read the held folder too, or the skill could list changes before the hold; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not run end to end against a real sub-PR branch (author).

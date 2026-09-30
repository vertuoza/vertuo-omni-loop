---
id: s1-03-unreadable-repository-empty
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

If the game cannot read one of the tracked repositories, should the whole scoring run stop, or skip that repository and score the others?

## The decision, in plain words

It skips that repository and scores the others. Nothing wrong gets written: the skipped repository's events are only written later, once it can be read.

## The intro, for fun

One locked door on a street of open houses.

## The punchline, for fun

The postman keeps delivering to the neighbours.

## The options, in plain words

A. Skip it and score the others, the option built.
B. Stop the whole run, so a missing access is noticed at once.

## What I had to decide

Whether a failed list of a tracked repository's PRD issues stops the poll. Before, the one plan repository was read or the poll failed.

## What I did meanwhile

A repository the game cannot read reads as empty; the other repositories still land. A missing access therefore shows as missing points, not as a failed run.

## What it costs to change later

One line: make that read hard again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner should see which repositories were skipped (the run does not log it today)

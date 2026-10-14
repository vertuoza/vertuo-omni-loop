---
id: s1-01-help-count-test
prd: 1934
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Adding the new command meant changing the number of commands that a help test counts, in a test file the slice's plan did not list. Is that small change outside the slice's area fine?

## The decision, in plain words

The count in that test went from 57 to 58 commands, and nothing else in the file changed. Without it the whole test run stays red.

## The intro, for fun

One new command walked in, and the head count at the door was off by one.

## The punchline, for fun

Someone had to update the guest list, and the guest list was in the next room.

## The options, in plain words

A. Keep the count at 58 in this slice, the one change outside its area (built).
B. Move the count change into a slice of its own, merged with this one.
C. Widen the plan's area for this slice to include the help table's test, after the fact.

## What I had to decide

Whether a slice that adds a command may update the help table's command count, which lives in a test file beside the help entries but not listed in the slice's area.

## What I did meanwhile

The count reads 58 and the help table test is green; the rest of that test file is untouched.

## What it costs to change later

One number in one test; no behaviour depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the help entries and the help command's test but not the help table's own test, which counts every command; whether it was left out on purpose is not settled (author).

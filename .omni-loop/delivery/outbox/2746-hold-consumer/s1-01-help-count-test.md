---
id: s1-01-help-count-test
prd: 2746
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

Adding the new hold command makes a test that counts every command fail, and that test sits outside this slice's files. Should the slice update the count?

## The decision, in plain words

The slice raised the command count in that test from 67 to 68, and changed nothing else there.

## The intro, for fun

Every new command has to be counted before it counts.

## The punchline, for fun

The tally now reads 68.

## The options, in plain words

A. A. Raise the count to 68 in this slice (built).
B. B. Leave the test as it was and let the wave raise it after merging.

## What I had to decide

A one-number change in kit/lib/help/entries.test.ts, which every new command needs. A different answer undoes it by reverting one constant.

## What I did meanwhile

The count in the test is 68 and the full test run is green.

## What it costs to change later

Another slice that adds a command and edits the same line will conflict on one number.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave would rather raise the count itself after merging (author).

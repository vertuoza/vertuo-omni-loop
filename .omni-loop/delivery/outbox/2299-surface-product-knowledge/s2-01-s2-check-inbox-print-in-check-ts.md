---
id: s2-01-s2-check-inbox-print-in-check-ts
prd: 2299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The spec warnings about avoided words have to be printed by the command that runs the inbox check, a file this slice's list of files did not include. Is a one-line change there acceptable?

## The decision, in plain words

The warnings are written by the inbox check's own file and printed by the check command's file, with a three-line change there, so the check's pass or fail result is untouched.

## The intro, for fun

A warning needs a mouth to speak with.

## The punchline, for fun

We borrowed three lines of someone else's mouth.

## The options, in plain words

A. A. Print the warnings from the check command, as built
B. B. Leave the check command alone and widen the plan's territory, so a later slice prints them

## What I had to decide

Edited kit/bin/commands/check.ts (checkInbox) to print inboxAvoidWarnings after the report; its return value is unchanged.

## What I did meanwhile

Nothing waits: the lines print and the check stays as green or red as before.

## What it costs to change later

Reverting means deleting three lines in check.ts and the warnings stop printing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's territory meant to include check.ts is not stated (author)

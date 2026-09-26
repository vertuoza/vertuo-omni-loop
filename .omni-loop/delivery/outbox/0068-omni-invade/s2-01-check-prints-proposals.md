---
id: s2-01-check-prints-proposals
prd: 68
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The knowledge check must warn once for every entry nobody has confirmed yet, but the part that prints the check's result was not on this piece of work's list of files. Should it have been changed here?

## The decision, in plain words

We changed it here, by two lines: the check now prints one warning per unconfirmed entry and counts them in its summary line.

## The intro, for fun

The warning was written, but the loudspeaker sat in someone else's room.

## The punchline, for fun

We borrowed the loudspeaker for two lines and left a note on the door.

## The options, in plain words

A. Change the part that prints the result, a few lines, so the check shows each unconfirmed entry as its own warning and counts them (built).
B. Leave that part untouched and add the unconfirmed entries to the list of wishes it already shows; the summary then counts them as wishes.
C. Move the printing into a later slice and leave the check silent about proposals until then.

## What I had to decide

Whether slice s2 may change kit/bin/commands/check.mjs, outside its territory, so that omni check knowledge prints the proposals the checker now returns.

## What I did meanwhile

gradeKnowledge returns a new proposals list beside wishes; check.mjs prints each as a warning line on stderr and adds "<n> proposed" to the pass line. Three lines changed in check.mjs; no other file outside the territory.

## What it costs to change later

A constant: reverting is deleting the print loop and the count, and folding proposals into wishes instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan left check.mjs out on purpose, meaning the warnings were meant to ride on the existing wishes list rather than a list of their own.

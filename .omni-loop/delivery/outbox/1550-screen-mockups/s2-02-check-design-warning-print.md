---
id: s2-02-check-design-warning-print
prd: 1550
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The design check now warns about screens that claim a whole folder; the line that prints those warnings sits in a file outside this slice's agreed area. Is that fine?

## The decision, in plain words

One line was added to the shared check command so the folder warnings reach the person, printed like the warnings of the other checks, and the check still passes.

## The intro, for fun

A warning nobody prints is a very polite warning.

## The punchline, for fun

So it borrowed one line next door to be heard.

## The options, in plain words

A. Print the warnings below the check, as the other checks print theirs (built).
B. Print them on stdout above the pass line instead.
C. Count them in the pass line only, without the lines.

## What I had to decide

Whether the one line printing check design's warnings may live in kit/bin/commands/check.ts, outside s2's territory.

## What I did meanwhile

gradeDesign returns warnings; check.ts prints each as 'warning: <line>' on stderr, as check kb does, and the guard's verdict is unchanged.

## What it costs to change later

Moving it is a one-line change: the grading already returns the warnings.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan lists check-design.ts but not the command that prints its result (author).

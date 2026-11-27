---
id: s1-01-size-warning-in-notes
prd: 3375
slice: s1
rank: medium
bears-on: none
raised: 2026-11-27
wave: 1
---

## The question, in plain words

Where should the knowledge check show its warning that a product's variants file is getting too big to reach the Omni page?

## The decision, in plain words

The warning is printed with the check's other notes, as one line starting with the word warning, and it never fails the check.

## The intro, for fun

A file can grow quietly until the page stops seeing it.

## The punchline, for fun

So the check clears its throat once it passes half the limit.

## The options, in plain words

A. Keep the warning among the check's notes, as built.
B. Print it on standard error with the check's other warnings, through a warnings list the grade returns.
C. Drop the warning and rely on the pack leaving the file out to be noticed on the page.

## What I had to decide

Whether the size warning of the law variants file stays among the check's notes on standard output, or moves to the warnings the check prints on standard error beside its wishes.

Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

A file over 512 KiB prints `warning: <file>: <n> KiB — over 512 KiB: a pack leaves out a file over 1 MiB, and the Omni page would not see it.` among the notes of `omni check knowledge`, and the check still passes.

## What it costs to change later

Moving it is a few lines in `kit/bin/commands/check.ts` and `check-knowledge.ts` (a `warnings` list returned by `gradeKnowledge`), and one test expectation.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The command that prints the check's warnings on standard error, `kit/bin/commands/check.ts`, is outside this slice's territory, so the warning rides the online Legal read's notes, which it already prints.
- (author) The same file does not pass its clock to `gradeKnowledge`, so the refusal of a check dated after today reads the machine's clock there; the tests pass their own.

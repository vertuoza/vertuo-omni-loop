---
id: s2-01-bug-check-product-command-touch
prd: 2739
slice: s2
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The check of a product bug record lives in a command file the slice's territory does not list. May the slice change it so the check can read which bug the record is?

## The decision, in plain words

The slice made a small change to the bug command so that the product check can take a bug number or say it is new, and then look for the follow-up files of that bug.

## The intro, for fun

The rule lived in one room, the door to it in another.

## The punchline, for fun

So we oiled the hinge and left the furniture alone.

## The options, in plain words

A. A. Change the bug command as built, so the product check takes a bug number or says it is new.
B. B. Move the flags into a lib helper and keep the command file untouched, which needs a territory change in the plan.

## What I had to decide

Changed kit/bin/commands/bug.ts: `bug check --product` now accepts --bug <n> or --new (both were refused for check), and runs the Still open check. Undo by reverting that file and the two tests; the lib stays.

## What I did meanwhile

The slice carries on with the lib, the tests and the skills inside its territory.

## What it costs to change later

One file outside the listed territory, about 20 lines; a different answer costs a revert of those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 omits the command file that holds the product check (author).

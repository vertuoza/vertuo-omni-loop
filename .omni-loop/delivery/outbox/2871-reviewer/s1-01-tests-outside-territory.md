---
id: s1-01-tests-outside-territory
prd: 2871
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The new review section and the new review command changed what a few existing checks expect, and those checks sit outside the files this step was given. Should this step update them, or leave them for another step?

## The decision, in plain words

This step updated them itself: three checks now expect the fourth section, and the help list gained the new command's entry and its count, so every check stays green.

## The intro, for fun

One new section, and five old checks all asked to be told.

## The punchline, for fun

They were told, line by line, and nobody else was woken up.

## The options, in plain words

A. A. s1 updates the five expectations and the command's help entry itself (built).
B. B. s1 leaves them, and the preflight stays red until s2 adds the help entry and someone updates the three test files.

## What I had to decide

The plan gave s1 the review form and the `omni review` command, but adding a slot to the review form changes the expected slot lists in kit/lib/playbook/forms.test.ts, kit/lib/omni-settings/curated.test.ts and kit/lib/omni-settings/copy.test.ts, and registering a command requires a help entry in kit/lib/help/entries.ts (the guard in kit/lib/help/entries.test.ts counts commands). None of those paths is in s1's territory; entries.ts is s2's. Without the edits the preflight is red.

Decided by: Jev (hardToRevert 0.60) · agent said false

## What I did meanwhile

Updated the expected lists in the three test files to include look-for (one line each), added a command entry for review in kit/lib/help/entries.ts after care, and moved the command count in entries.test.ts from 69 to 70. s2, blocked by s1, adds the skill entry for /omni:review on top.

## What it costs to change later

Nothing to undo but these lines: reverting them means moving the slot or the command elsewhere. s2 starts after s1 merges, so the shared entries.ts file never conflicts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant s2 to own the command's help entry as well as the skill's: it names entries.ts as s2's for the new skill's entry only.

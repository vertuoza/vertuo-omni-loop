---
id: s2-01-docs-skills-test-outside-territory
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Adding the Reviewer's skill to the help list also changes the skills page of the docs, whose check sits outside the files this step was given. Should this step update that check, or leave it to another step?

## The decision, in plain words

This step updated it itself: the docs check now expects the Reviewer's skill in the Build it group, right after the one that looks after a feature pull request. Nothing else in the check moved.

## The intro, for fun

One new skill joined the help list, and the docs page wanted a seat for it too.

## The punchline, for fun

We set one more chair at the table and left the rest of the room alone.

## The options, in plain words

A. This step updates the one expected list in the docs check itself (built).
B. This step leaves it, and the whole test run stays red until another step updates the check.

## What I had to decide

The plan gives s2 `kit/lib/help/entries.ts` for the new skill's help entry. The docs' skills pages are built from that table, and `apps/galaxy/src/docs/skills.test.ts` lists the Build it group's skills exactly, so a skill in that group turns it red. The path is in no slice's territory. I added `review` after `pr-care` in that one expected list, the same precedent as s1-01 and s3-01.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Updated the one expected list, so the whole test run stays green.

## What it costs to change later

Nothing to undo but one word in one test: putting the skill in another group moves that word.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the docs check to be s2's along with the help entry it is built from.

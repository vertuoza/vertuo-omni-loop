---
id: s5-03-docs-skills-list-outside-territory
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

The skills page of the docs has a test that lists every skill under Build it by name, and adding PR care there means changing a file this part of the work was not given: may it?

## The decision, in plain words

We added PR care's name to that list in the docs test, a one-word change, so the docs page shows the new skill under Build it with the checks still passing.

## The intro, for fun

The new skill arrived at the docs page and found the guest list already printed.

## The punchline, for fun

So we wrote its name in by hand, at the end of the row.

## The options, in plain words

A. A. Change the docs test's expected list in this slice (built).
B. B. Put PR care in the Every day group instead, which that test does not list by name.
C. C. Leave the docs test red until a follow-up slice.

## What I had to decide

Whether slice s5 may change apps/galaxy/src/docs/skills.test.ts, outside its territory, whose overview test lists the build group's skills by name and fails for any new one.

## What I did meanwhile

Added 'pr-care' after 'pr' in the build group's expected list in apps/galaxy/src/docs/skills.test.ts; no page code changed, the page reads the help entries.

## What it costs to change later

One word in one test; undone by moving the line to another slice or putting the skill in another group.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan did not foresee that the docs page test names every build skill.

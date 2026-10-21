---
id: s5-01-outside-territory-role-fixtures
prd: 2346
slice: s5
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Two test files outside this slice's list held old role words that the new rule refuses, so they were updated to the new words. Are you fine with that?

## The decision, in plain words

The database check for repository links and the test for the targets command used old role words such as back-end. Once only the nine new roles are accepted, they would fail, so they now use new words and gained a case for an old word.

## The intro, for fun

The old role names were still on the guest list after the door policy changed.

## The punchline, for fun

The tests have been given new badges.

## The options, in plain words

A. A. Update the two files in this slice (built).
B. B. Leave them and let a later slice or person fix them, with the checks red meanwhile.

## What I had to decide

Updated supabase/checks/product_repositories.sql and kit/bin/commands/targets.test.ts to canonical roles, and added a case for a refused new role, an accepted null and a kept old role.

## What I did meanwhile

Every other test and check is untouched; the two files only changed role words and gained cases for the new rule.

## What it costs to change later

Reverting means putting the old role words back in both files, which also reverts the rule they test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The supabase checks could not be run here: no local database was available, so the new SQL check cases are unproven until CI runs them.

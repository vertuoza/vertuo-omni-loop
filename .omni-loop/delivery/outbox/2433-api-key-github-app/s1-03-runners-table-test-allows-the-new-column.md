---
id: s1-03-runners-table-test-allows-the-new-column
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A test outside this slice's area pins the exact columns of the runners table, so adding the new GitHub App column broke it. May this slice loosen that one line, or must a later slice do it?

## The decision, in plain words

This slice loosens that one line so it accepts the new column, and nothing else in the test changes. Leaving it would keep the slice's own checks red.

## The intro, for fun

A test counted the runners table's columns on its fingers.

## The punchline, for fun

One new column later, the count needed a thumb.

## The options, in plain words

A. Loosen the one test line in this slice so it allows the new column, leaving every other line of the test as it is.
B. Leave the test as it is and let the later slice that owns it fix it, accepting that this slice's own checks stay red until then.
C. Remove the pinned column order from the test altogether, so no future column on the runners table breaks it.

## What I had to decide

supabase/database.types.ts is this slice's, and the plan gives apps/galaxy/src/runners to a later slice (s7). The new runners.github_app column sorts between fleet and health in the generated types, and runners.migration.test.ts expects fleet and health to follow each other. The preflight stayed red on that one test, so I had to choose between touching a file outside the territory and leaving the slice red.

## What I did meanwhile

Changed one regular expression in apps/galaxy/src/runners/runners.migration.test.ts so that an optional github_app line may sit between fleet and health. Every other line of the test is as it was, and it still fails when fleet or health is missing from the types.

## What it costs to change later

Nothing to undo in the product: it is one line of a test. If s7 edits the same line, the two edits meet in a small merge conflict a person or the wave settles in a minute.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s7 rewrites or removes this test line anyway, which would make this edit moot (author)

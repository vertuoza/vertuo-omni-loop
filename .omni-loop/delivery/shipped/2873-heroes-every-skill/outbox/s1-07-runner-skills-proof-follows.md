---
id: s1-07-runner-skills-proof-follows
prd: 2873
slice: s1
rank: high
bears-on: BR-PRODUCT-140
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Is it right that the test proving which skills a repository's Runner skills block lists was changed, so it also names the three new ultra skills runners now take?

## The decision, in plain words

Yes: the test now reads the database's fixed list with the three ultra skills and the four it lacked; the rule it proves is unchanged.

## The intro, for fun

A list grew by seven, and its referee had to learn the new names.

## The punchline, for fun

The rule stayed put; only its roll call got longer.

## The options, in plain words

A. A. Keep the test as changed (built).
B. B. Restore the old test and prove the new list in a test of its own.

## What I had to decide

s1 replaced the database's fixed runner-skill list (migration 20270122120000_runner_ultra_skills.sql) and edited apps/galaxy/src/runners/runners.skills.migration.test.ts, which proves BR-PRODUCT-140, so it reads the new list. Item s1-04 recorded it as medium.

## What I did meanwhile

The test is green on the feature branch, and every check it held before is still checked.

## What it costs to change later

Reverting the test edit means reverting the migration with it; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants the proof kept apart from the new list's own test (author)

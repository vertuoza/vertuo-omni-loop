---
id: s1-03-db-module-test-outside-territory
prd: 1318
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new database module had no test in the plan, and the repository's dead-code and complexity gate refuses a module nothing uses or covers. Should the slice add a test beside it, outside the ground the plan gave it?

## The decision, in plain words

The slice adds one test file beside the new database module, the only file it writes outside its planned ground, so the module is covered and the gate passes without any suppression.

## The intro, for fun

A new module walked in with nobody to vouch for it.

## The punchline, for fun

So it brought its own test, one step past the fence.

## The options, in plain words

A. As built: one test file beside the new database module, reported as spillover.
B. Drop the test and leave the module unused until the next slice, which needs a suppression the rules forbid.

## What I had to decide

Whether apps/galaxy/src/data/db.test.ts may land with slice s1, outside its declared territory.

## What I did meanwhile

The test sits beside the module; the wave's territory check reports it as one breach, which is never fatal.

## What it costs to change later

Moving or deleting one test file; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names db.ts alone, so its test was not declared; the commit gate refuses an unused, uncovered file and the briefing forbids a suppression.

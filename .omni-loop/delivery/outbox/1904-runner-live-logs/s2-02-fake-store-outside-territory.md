---
id: s2-02-fake-store-outside-territory
prd: 1904
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The tests of the stored lines run against an in-memory copy of the database that lives in a test-only folder next to the slice's files, but not in the list of files this slice may change.

## The decision, in plain words

The in-memory copy was extended with the stored lines, since every service and page test of the runners reads it, rather than writing a second copy inside the slice's own files.

## The intro, for fun

The rehearsal stage sits one door down from the one on the floor plan.

## The punchline, for fun

Same play, same actors, just a different room number.

## The options, in plain words

A. A. Extend the shared in-memory copy (as built).
B. B. Keep a second in-memory copy for the lines inside the slice's own test files.

## What I had to decide

Adopt: apps/galaxy/src/runners/fixtures/store.fake.ts belongs to the runners area as much as runners.* does.

## What I did meanwhile

The fake holds the lines with the same rules as the migration: added once each, trimmed, kept for the 50 most recent ended jobs.

## What it costs to change later

None: a test fixture, shipped in no build.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the fake follows the migration's rules, and the migration's own check proves them against a database once the workflow runs it.

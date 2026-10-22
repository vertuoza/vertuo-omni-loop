---
id: s4-03-outside-territory-runners-fake
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

Reading several runners in one query added a method to the runners' storage, and the test double that stands in for that storage had to learn it too, a file outside this slice's ground. May that one line stand?

## The decision, in plain words

One line was added to the runners' test double so the code still compiles; nothing else outside the slice's ground changed, and the new tests of the PRD's page sit in the route's own test file next to the reads.

## The intro, for fun

A new tool in the shop means a new hook on the pegboard.

## The punchline, for fun

One line, one hook, no tools were harmed.

## The options, in plain words

A. A. Keep the one line in the runners' test double (as built).
B. B. Move the line and the page's tests to a slice that owns those files.

## What I had to decide

Add the new method to the runners' test double (apps/galaxy/src/runners/fixtures/store.fake.ts), one line returning the runners whose id is asked for, and keep the page's new tests in source.test.ts, the one test file of the slice's ground.
Decided by: Jev (hardToRevert 0.82) · agent said false

## What I did meanwhile

The slice's tests and the type check are green with it.

## What it costs to change later

Dropping the line is one deletion, but the type check fails until the storage's method is removed too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of the runners' test double wants the line made in a slice of its own is not written down (author).

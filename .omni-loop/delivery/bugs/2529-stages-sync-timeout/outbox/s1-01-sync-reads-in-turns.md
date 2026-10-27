---
id: s1-01-sync-reads-in-turns
prd: 2529
slice: s1
rank: high
bears-on: BR-PRODUCT-123
raised: 2026-10-27
wave: 1
---

## The question, in plain words

The quarter-hour sync now reads four repositories of a workspace at once, so it finishes in time again.
One test among those that prove how a PRD's timeline is dated checked the order in which repositories
start being read; it now checks what each run read, whatever the order. May that test change this way?

## The decision, in plain words

The test still checks that each repository is read in full the first time and only its recent changes
after; it no longer checks which repository starts first, since they now start together. How a PRD's
timeline is dated does not change.

## The intro, for fun

Four repositories walk into a sync at once.

## The punchline, for fun

Nobody minds who held the door, as long as everyone gets in before the five minutes are up.

## The options, in plain words

A. Let the test check what each run read, in any order (built).
B. Keep the test as it was, and read the repositories one after another again, which keeps the sync
   timing out.

## What I had to decide

BR-PRODUCT-123 lists `apps/galaxy/src/stages/sync/sync.test.ts` in its `Enforced by:`. The fix changes
one test in it, `reads a repository in full on its first sync, then only what changed since it, five
minutes early`: it compares each run's reads sorted by repository instead of in the order they started.
No test of the rule's dates changes, and the new reproduction lives in its own file,
`apps/galaxy/src/stages/sync/sync.turns.test.ts`.

## What I did meanwhile

The fix branch reads a workspace's repositories four at a time, keeps the answer in their order, and
records the target lanes once every repository was read; the whole test suite is green.

## What it costs to change later

Reverting the one test's comparison and the fix together; nothing stored changes.

## What I could not know

Whether the order reads start in was ever meant to be part of the rule (author).

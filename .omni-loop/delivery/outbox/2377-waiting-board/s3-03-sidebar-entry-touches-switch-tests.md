---
id: s3-03-sidebar-entry-touches-switch-tests
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Adding the Waiting entry to the sidebar changed two tests that list every entry, which sit outside this slice's folders. Was it right to update them?

## The decision, in plain words

Two tests of the app's page switch listed every sidebar entry, so they failed once Waiting was added. They now list Waiting too, and nothing else in them changed.

## The intro, for fun

One new menu line, and two tests in another folder noticed at once.

## The punchline, for fun

They only wanted to be told about the new neighbour.

## The options, in plain words

A. A. Update the two lists in place (built).
B. B. Leave them red and widen the plan's territory first.

## What I had to decide

Add Waiting to the entry lists in switch.test.ts and headers.test.ts, one word each; the plan's territory did not name them.

## What I did meanwhile

The tests pass with the entry listed; no production code outside the slice changed.

## What it costs to change later

Undoing it is deleting one word in each of two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan should have named the two test files is (author) left to the planner.

---
id: s1-03-limit-report-extends-access-proof
prd: 2949
slice: s1
rank: high
bears-on: BR-ACCESS-7
raised: 2026-11-16
wave: 1
---

## The question, in plain words

The test file that proves how a machine's request for a fresh access pass is refused now also holds the tests for how a job reports a provider limit. Does that file still prove the same rule?

## The decision, in plain words

We added the limit tests beside the others in the same file, as their own group; none of the refusal tests changed.

## The intro, for fun

A test file that guards the door also learned to read the clock.

## The punchline, for fun

The door rule did not move, it just got a neighbour.

## The options, in plain words

A. A. Keep the limit tests in the same file, as their own group: the rule's proof is untouched
B. B. Move the limit tests to a file of their own

## What I had to decide

Confirm that apps/galaxy/src/runners/runners.service.test.ts still proves BR-ACCESS-7 with its new group 'a job that meets a provider limit (PRD 2949)', or ask for the group to move to a file of its own.

## What I did meanwhile

The new group runs with the file's other tests; nothing in the refusal tests changed.

## What it costs to change later

Low: answering B moves one test group to a new file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-ACCESS-7 should list the limit group among what proves it, or the file should be split (author)

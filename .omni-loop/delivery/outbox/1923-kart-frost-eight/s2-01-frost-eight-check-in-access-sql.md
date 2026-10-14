---
id: s2-01-frost-eight-check-in-access-sql
prd: 1923
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Where should the new database check for FROST EIGHT's board live, and may the cabinet registry's own test be edited by this slice?

## The decision, in plain words

The check for the new board was added to the existing access check that CI already runs, and the registry's own test was updated to hold the two board names, instead of adding a new check file that CI would not run until its workflow is edited.

## The intro, for fun

Two boards walk into a database, and only one check file has a ticket.

## The punchline, for fun

We added the second board to the check CI already runs.

## The options, in plain words

A. A. Extend the existing access check and update the registry's test (built).
B. B. A new check file plus a CI workflow step, leaving the registry's test for another slice.

## What I had to decide

Pick A to keep the check where CI already runs it. Pick B for a separate file with its own CI step, which a later slice or a person must wire.

## What I did meanwhile

The board is proved by CI's existing database job.

## What it costs to change later

A separate file would need a CI workflow edit outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a separate check file is preferred (author)

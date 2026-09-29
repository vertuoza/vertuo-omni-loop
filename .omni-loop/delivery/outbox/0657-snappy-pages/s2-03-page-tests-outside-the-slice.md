---
id: s2-03-page-tests-outside-the-slice
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Several existing page tests outside this part pretend to be the sign-in service with the old slow check: should this part update them too?

## The decision, in plain words

Yes: the stand-ins in seven existing test files now also answer the quick check, and a few now match the person by id rather than the whole record. What those tests check is unchanged.

## The intro, for fun

The rehearsal actors still knew only the old script.

## The punchline, for fun

We handed them one new line, and the play is the same.

## The options, in plain words

A. A: update the stand-ins in the existing tests (built).
B. B: leave those tests failing for the owning part to fix, which blocks this part's merge.

## What I had to decide

Whether these test-only edits outside the slice's own ground are acceptable, or whether each page's own part should own them.

## What I did meanwhile

The seven test files carry the new stand-in; no product code outside the slice changed.

## What it costs to change later

Low: test files only, each edit a few lines, easy to take back or move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The engineering, fixes, switch and dossier page tests belong to no slice of this plan, so no sibling part should touch them in this wave (author).

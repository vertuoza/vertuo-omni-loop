---
id: s1-03-main-watch-types-test
prd: 2498
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

May this step change one line of an earlier feature's test, which lists every column of the findings table, so it names the three new columns?

## The decision, in plain words

Yes: the earlier test pins the exact list of a finding's columns, so the three new ones turned it red. Its expected list now names them, and nothing else in it changed.

## The intro, for fun

The old test knew every column by heart and panicked when three new ones walked in.

## The punchline, for fun

We introduced them properly, and it calmed down.

## The options, in plain words

A. Update the pinned list with the three columns, the option built.
B. Loosen the earlier test to check only the columns PRD 2410 added, so later columns never touch it again.

## What I had to decide

Whether a slice may update another feature's test that pins the columns of the table it extends.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

main-watch.migration.test.ts, outside this slice's territory, expects the generated row of rewind_findings with outcome, outcome_note and outcome_pr; a comment names PRD 2498 as their source.

## What it costs to change later

One line of a test; undoing it means loosening the test to the columns it owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no written rule says whether a slice may touch another feature's test that pins a shared table's columns

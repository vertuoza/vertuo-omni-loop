---
id: s3-02-dotted-approver-waits
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When a settled decision names its approver with a dotted name, which no GitHub account can have, should that settle wait for the name to be fixed, or be closed on no one?

## The decision, in plain words

It waits: the settle is not counted until someone corrects the name, and then the right person gets the credit, while that decision still counts as open on the board.

## The intro, for fun

A name with a dot walks into the ledger, and the ledger asks for some ID.

## The punchline, for fun

It can wait in the lobby until the name is spelt right, or leave with nobody's credit.

## The options, in plain words

A. A. The settle waits, skipped with a warning, until its approver's name is fixed; the decision stays open on the board meanwhile.
B. B. The reader drops a dotted approver, so the settle closes at once on no one and that credit is lost for good.

## What I had to decide

Keep the settle waiting until the name is fixed, or close it on no one at once.

## What I did meanwhile

A dotted approver's settle is skipped with a warning each poll; the decision stays open on the board, and is credited to the right login on the first poll after the line is corrected.

## What it costs to change later

Switching to B is one line in the settled-ledger reader and one test, no migration: nothing was written in the meantime.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's done-when for s3 says the approver yields no dotted name, while the spec's user story says the event waits until the name is fixed; I followed the user story, because closing on no one is permanent in the ledger. (author)

---
id: s7-03-the-server-outbox-counts-open-questions-only
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

What does the gate of a product PRD look at, now that its questions live on the server?

## The decision, in plain words

Only the questions still open. A question answered with a change does not hold the gate until the change is made, the server keeps no account of risky changes yet, so one handed over stays where it was, and nothing is posted on GitHub: answers come from the Questions tab or the terminal.

## The intro, for fun

The server's outbox is younger than the one in the repository, and it shows.

## The punchline, for fun

It knows open from answered, and that is all it knows so far.

## The options, in plain words

A. Count open questions only, refuse accounts, post nothing, the option built.
B. Also hold the gate on every answer that asked for a change until someone marks it reworked.
C. Keep accounts and changed answers in the repository beside the questions on the server.

## What I had to decide

Which of the checks the repository's gate makes also hold a product PRD's gate.

## What I did meanwhile

The gate is green when no question is open or a person waved it through; a handed-over account is refused with its reason and left in its folder; the comments and the replies on GitHub do nothing for a product PRD.

## What it costs to change later

Adding each missing check later is its own change on the server and in the kit, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice gives the server a place for accounts and for the rework of a changed answer.

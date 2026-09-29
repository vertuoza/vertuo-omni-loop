---
id: s1-02-failed-reading-is-unreachable
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When GitHub answers for a repository at first but then fails partway through reading it, for example because of a rate limit, what should the targets list say?

## The decision, in plain words

The whole row reads unreachable, with the error GitHub gave, and it stays in the list. A missing file is never a failure: it only means the file is not there.

## The intro, for fun

The librarian let us in, then turned the lights off halfway down the aisle.

## The punchline, for fun

We do not guess what was on the dark shelves: the row says unreachable.

## The options, in plain words

A. Unreachable, with the error line: the row is kept and nothing is guessed.
B. Keep what was read and mark the rest unknown: a new word the next PRDs would have to learn.
C. Stop the whole command with an error: one bad repository hides every other row.

## What I had to decide

Whether a reading that fails after the repository itself answered makes the row unreachable, or is reported some other way.

## What I did meanwhile

Any failure other than a missing file makes that row unreachable, with the error line as its detail; the command exits 1.

## What it costs to change later

One branch in the targets reader; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec defines unreachable as a repository gh cannot read, not a reading that fails partway (author).

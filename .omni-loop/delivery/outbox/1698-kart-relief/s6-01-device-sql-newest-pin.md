---
id: s6-01-device-sql-newest-pin
prd: 1698
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 5
---

## The question, in plain words

A test insisted that the device sign-in migration stays the newest of all, so any new migration made it fail. Should that test keep pinning the newest slot?

## The decision, in plain words

I relaxed the test to say the device sign-in migration comes after the ones it was written on top of, so the new best-times reset can be the newest as the plan requires.

## The intro, for fun

One test wanted to stay the newest forever.

## The punchline, for fun

Calendars, sadly, keep moving.

## The options, in plain words

A. A. Relax the test to a fixed predecessor (built)
B. B. Delete the test
C. C. Re-date the reset before the device migration (breaks the migration order check)

## What I had to decide

Reverting the test edit restores the old pin, at the price of re-dating the reset migration, which the plan forbids.

## What I did meanwhile

The test still proves the migration is not older than its predecessors.

## What it costs to change later

One line in one test file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the device sign-in author wanted the newest-slot pin as a guard on purpose (author)

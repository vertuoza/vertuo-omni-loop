---
id: s3-02-late-wait-limit-fixed-at-two
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

A wait reads red after 2 working days. Should the page read that number from each repository's own setting, or keep one number for everyone?

## The decision, in plain words

The page uses 2 working days for every wait, the kit's default, instead of each repository's own setting.

## The intro, for fun

The page needs to know when a wait is officially late, and it picked two days.

## The punchline, for fun

Two working days: long enough to be fair, short enough to be nagged.

## The options, in plain words

A. A. One limit of 2 working days for every wait (built).
B. B. Read each repository's own escalation setting and colour each wait by it.

## What I had to decide

A constant of 2 working days in the board's model; the app does not read a repository's `limits.escalationWorkingDays`.

## What I did meanwhile

Every wait older than 2 working days reads red, whatever a repository's setting says.

## What it costs to change later

Reading the setting later means storing it per repository and passing it to the model: one constant replaced.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a workspace should be able to change the limit is (author) not settled by the spec.

---
id: s2-01-counts-line-leaves-empty-stages-out
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When nothing is being built or waiting for review, should the overview's counts still name the outbox and the PRDs in review, with a zero?

## The decision, in plain words

The outbox and the PRDs in review show only when they hold at least one PRD, so a quiet repository reads as shipped and inbox alone. An outbox that holds PRDs always says how many open items it has, zero included.

## The intro, for fun

A dashboard can shout zero at you, or just keep quiet about it.

## The punchline, for fun

This one keeps quiet, and only speaks up once something is there.

## The options, in plain words

A. Leave the outbox and the review stage out while they are empty, and give the open items with the outbox, zero included: the option built.
B. Always show all four counts, with a zero where a stage is empty.
C. Leave the open items out beside an outbox that has none open, and show them only when some wait for an answer.

## What I had to decide

How the counts line reads when a stage is empty. The spec shows it once, `SHIPPED 26     INBOX 2     OUTBOX 1 · 3 open items     IN REVIEW 1`, with every stage holding a PRD, and the plan's s1 check pins `SHIPPED 3     INBOX 2` for a repository with no feature or phase-0 branch. Neither says what an empty outbox, an empty review stage, or an outbox with no open item reads as, nor how the line keeps within 80 columns once the counts grow long.

## What I did meanwhile

`counts` in `kit/lib/status/format.mjs` always prints `SHIPPED` and `INBOX`, adds `OUTBOX <n> · <k> open item(s)` only when the outbox holds a PRD (`0 open items` when none is open), and adds `IN REVIEW <n>` only when a PRD is in review, so s1's `SHIPPED 3     INBOX 2` still holds. A count that would push the line past 80 columns starts a second line, indented like the first. Pinned in `kit/lib/status/format.test.mjs` and `kit/bin/status.test.mjs`.

## What it costs to change later

Two conditions and one wrapping loop in `kit/lib/status/format.mjs`, and the lines of the tests that pin them. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's only example has every stage holding a PRD; the plan's s1 check has neither an outbox nor a review stage, and says nothing of them.

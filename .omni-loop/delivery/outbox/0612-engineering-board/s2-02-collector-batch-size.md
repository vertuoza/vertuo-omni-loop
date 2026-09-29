---
id: s2-02-collector-batch-size
prd: 612
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

How much should the collector read in one go, so a long first read of a busy repository never runs out of time?

## The decision, in plain words

It reads at most fifty pull requests per step and twenty steps per repository per run; a longer first read simply carries on at the next run a quarter of an hour later.

## The intro, for fun

Ninety days of pull requests do not fit in one breath.

## The punchline, for fun

So the collector reads fifty at a time and comes back for more.

## The options, in plain words

A. A: Fifty per step, twenty steps per repository per run (what was built).
B. B: One step per repository with no cap, as the spec's wording reads, at the risk of a timeout on a large backfill.
C. C: Smaller batches of twenty, for a tighter time limit, at the cost of more steps.

## What I had to decide

The batch size per step and the number of steps per repository per run for the collector.

## What I did meanwhile

Fifty pull requests per step, twenty steps per repository per run: up to a thousand pull requests per repository every fifteen minutes. The cursor only moves past what was written.

## What it costs to change later

Two constants in the collector; changing them needs no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec sets no bound on one step's work; the numbers come from three calls per pull request and a Vercel function's time limit, not from a measurement (author).

---
id: s1-02-claim-lease
prd: 2676
slice: s1
rank: medium
bears-on: none
raised: 2026-11-09
wave: 1
---

## The question, in plain words

The design says a worker holds a job under a claim that runs out, and that the sweep picks a dropped job up within 15 minutes, but not how long a claim lasts. How long should a worker hold a job before another may take it?

## The decision, in plain words

A worker holds one job at a time, for five minutes: a little longer than the four minutes a run may spend claiming, and well inside the quarter hour between two sweeps.

## The intro, for fun

Every borrowed job comes with a due date stamped inside the cover.

## The punchline, for fun

Five minutes, then the library sends someone round to collect it.

## The options, in plain words

A. A. Hold one job at a time for five minutes.
B. B. Hold one job at a time for fifteen minutes, the gap between two sweeps.
C. C. Claim several jobs at once under one longer claim, fewer database calls but jobs held while others run.

## What I had to decide

The worker's lease (LEASE_SECONDS, 300) and its batch (one job per background_job_claim() call). A shorter lease reclaims a dropped job sooner but risks a slow job being run twice; a longer one, past 15 minutes, would let a dropped job wait for a second sweep.

## What I did meanwhile

Built A: runDue claims with a limit of 1 and a lease of 300 seconds, so it never holds a job it has no time left to run. A job that runs past its lease is claimed again by the next worker and run twice, which the knowledge pack makes harmless; the first worker's finish is then refused as stale.

## What it costs to change later

A constant in the worker; the database takes any lease from 10 seconds to an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long a knowledge pack takes on a large repository is not measured; a job that often runs past five minutes would run twice each time. (author)
- The webhook's function may run for 60 seconds today, shorter than the 240-second budget; the slices that call the worker from the webhook and the sweep set their own budget and duration. (author)

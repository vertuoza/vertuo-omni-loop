---
id: s4-01-sweep-forget-hour
prd: 2676
slice: s4
rank: medium
bears-on: none
raised: 2026-11-09
wave: 3
---

## The question, in plain words

The spec says the sweep forgets old finished jobs once a day, but not when. Which hour should it be, and should it ride on the hourly call?

## The decision, in plain words

The old rows are forgotten in the hourly call that runs at 03:00 UTC, and the hourly cron runs at minute 7 of each hour. A different hour is a one-number change.

## The intro, for fun

Even a tidy-up robot needs a time to sweep the floor.

## The punchline, for fun

It picked three in the morning, when nobody is looking.

## The options, in plain words

A. A. Forget inside the hourly call at 03:00 UTC (what was built).
B. B. Give the daily forgetting its own cron entry, once a day, calling the sweep with a forget flag.
C. C. Forget on every hourly call; the delete is cheap and idempotent.

## What I had to decide

Forget in the ?gaps=1 call whose UTC hour is 3, so no third cron is needed; the hourly cron runs at minute 7 and the 15-minute one at minutes 0, 15, 30 and 45.

## What I did meanwhile

Built as described: the constant FORGET_HOUR_UTC in apps/omni-app/src/jobs/sweep.ts is the only place the hour lives.

## What it costs to change later

Changing the hour is one constant and its test; moving it to its own cron adds one entry to vercel.json.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says once a day and names no hour; 03:00 UTC is my choice, not the PRD's.

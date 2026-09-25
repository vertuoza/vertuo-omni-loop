---
id: s8-06-the-job-service-allows-a-fourteen-day-wait
prd: 72
slice: s8
rank: human-action
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The second look at a delivery waits fourteen days after the merge, and whether a background job may wait that long depends on the plan of the service that runs it. Will someone check the plan allows it?

## The decision, in plain words

The retro waits fourteen days as the spec asks; if the plan allows less, the second look does not happen until the waiting is rebuilt as a daily scheduled job.

## The intro, for fun

Setting a reminder two weeks out only works if the calendar goes that far.

## The punchline, for fun

Somebody has to flip to the next page and check.

## What a person must do

1. Open the Inngest account the omni-loop app uses and find the longest wait (sleep) its plan allows.
2. If it is fourteen days or more, reply ok. If it is shorter, reply no with the limit, so the second look is rebuilt as a daily scheduled job.

## What I had to decide

The retro function sleeps with `step.sleepUntil` until the merge plus 14 days. Inngest caps how long a run may sleep by plan, and the code cannot read the plan. The README says a daily scheduled function takes over otherwise, but that fallback is not built.

## What I did meanwhile

Built the 14-day sleep only; no scheduled fallback exists.

## What it costs to change later

Small: if the plan is too short, the day-14 run moves to a daily scheduled Inngest function, a change in the function file only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- What Inngest does with a sleep longer than the plan allows was not tested live (author).

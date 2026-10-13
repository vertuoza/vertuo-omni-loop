---
id: s1-05-job-times-four-columns
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A job can end three ways, done, failed or cancelled, and the spec asks for a time per status. Does each ending need its own time?

## The decision, in plain words

A job keeps four times: when it was queued, claimed, started running and ended. The status says how it ended, so the three endings share one time.

## The intro, for fun

Three ways to finish a race, and one finish line.

## The punchline, for fun

The scoreboard says how you crossed it.

## The options, in plain words

A. Four times: queued, claimed, running, ended
B. Six times, one per status

## What I had to decide

The time columns of runner_jobs.

## What I did meanwhile

runner_jobs has queued_at, claimed_at, running_at and ended_at; a check ties ended_at to the three ended statuses. The browser's Job shape carries queuedAt, claimedAt, runningAt and endedAt.

## What it costs to change later

A migration: splitting ended_at into done_at, failed_at and cancelled_at later is new columns and a backfill from the status.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's 'a time per status' does not say whether the three endings are separate (author).

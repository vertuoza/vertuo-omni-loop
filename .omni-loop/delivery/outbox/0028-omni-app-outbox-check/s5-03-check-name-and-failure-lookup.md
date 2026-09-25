---
id: s5-03-check-name-and-failure-lookup
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When something goes wrong before the check can be finished, how does the app find the check it started, and what name does a new check carry?

## The decision, in plain words

The check takes its name from the main branch's settings, and pressing Re-run starts a fresh check. If a run fails, the app marks every unfinished check of that name on the same commit as failed, or posts one already failed when it never got to start one.

## The options, in plain words

A. Name from base config, find open checks by name on failure, fresh check on Re-run, as built.
B. Always use the default name, so no read is needed before the check appears.
C. Store the check's id outside the run so the failure handler completes exactly that one.

## What I had to decide

How the failure handler finds the check run to complete, and where the check's name comes from at creation.

## What I did meanwhile

Step in-progress reads the pull request and snapshots the base config to name the check by ci.outboxContext (the kit default when absent or broken). The failure handler cannot see the run's step results, so it lists check runs by name on the head SHA, completes every one not yet completed as failure, and creates a completed failure when there is none; if GitHub cannot be read it falls back to the default name. Runs are debounced 5s per repo and PR (at most 1m), retried 3 times, and a snapshot over its bound is not retried.

## What it costs to change later

Constants and one helper inside the app's outbox-check folder; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether another app posting a check of the same name on the same commit is a real case; the handler skips any run GitHub refuses to let it write.
- (author) Whether the Inngest debounce key expression is accepted as written by the hosted service; the SDK test engine does not evaluate it.

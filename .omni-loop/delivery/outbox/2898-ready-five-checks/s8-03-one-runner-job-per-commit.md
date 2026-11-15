---
id: s8-03-one-runner-job-per-commit
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When a runner's run of the screen tests ends without a result, say the preview never came up, should the App send it to a runner again on the same change, or wait for the next change?

## The decision, in plain words

It waits for the next change. One run is sent per change; when it gives no result, the proof stays not finished and says how the run ended and that a new change runs it again.

## The intro, for fun

Ringing the same doorbell all night rarely opens the door.

## The punchline, for fun

We ring once, leave a note, and come back with the next delivery.

## The options, in plain words

A. A. One run per change; a run without a result waits for the next change: what was built.
B. B. Try again on the same change, up to a set number of times.

## What I had to decide

Pick A to send one run per change, or B to try again on the same change a set number of times.

## What I did meanwhile

`runnerFallback` reads the App's latest job of the line `/omni:acceptance <prd> --pr <n> --sha <head>` (`ReadyStore.appJob`, sent by the app only) and queues one through `../retro/runner-queue.ts` only when there is none, so a replay finds it again. A job that ended with no result line, or a failed one, leaves each `e2e` criterion `pending`, its why the run's own (`standingReport`). A person's job of the same line is never read as the App's.

## What it costs to change later

Retrying is a count of the App's ended jobs of the line and a second insert under a limit, in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how often a runner's run fails for a reason a second try on the same change would fix

---
id: s1-03-lost-last-try-runs-no-hook
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check's run is cut off on its fifth and last try, before it could say how it went, who marks the check as failed on the pull request?

## The decision, in plain words

Nobody does yet: the failure step runs only when the fifth try ends with an error. A run cut off on its last try ends failed in the queue, and the health check raises an alert, but the check on the pull request stays in progress.

## The intro, for fun

The runner trips on the last lap, out of sight of the referee.

## The punchline, for fun

The scoreboard still says the race is on.

## The options, in plain words

A. Leave it to the health alert and the next push, the option built.
B. Have the sweep also close, as failed on the pull request, each failed check whose failure step never ran.

## What I had to decide

Whether a check whose last try was cut off should also be closed as failed on the pull request, and by which part of the system.

## What I did meanwhile

The queue marks it failed and the health check turns late, which opens an alert for the team; the check on the pull request stays in progress until the next push asks for it again.

## What it costs to change later

Closing it would take the regular sweep looking for failed checks it never closed, a change in a later slice or a follow-up, not in this one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec runs the failure step on the fifth try that throws, and says nothing of a fifth try that is cut off with no answer (author).
- The worker cannot run it: the cut-off try is noticed by the database at the next claim, not by the worker that was running it (author).

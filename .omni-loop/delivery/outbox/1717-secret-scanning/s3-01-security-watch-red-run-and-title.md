---
id: s3-01-security-watch-red-run-and-title
prd: 1717
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The spec says the daily watch opens or updates one issue when something is wrong, but not whether the run itself should also show as failed, what time it runs, or whether the issue's title changes when the problem changes.

## The decision, in plain words

The watch runs every morning before the working day, and a bad day also shows as a failed run. When the issue is already open, the new report is added as a comment and the title stays as it was first written.

## The intro, for fun

An alarm that rings once a day had better ring before the coffee.

## The punchline, for fun

The headline stays put; the news goes in the comments.

## The options, in plain words

A. Daily at 06:17 UTC, the run fails on red, the open issue keeps its first title (built)
B. The run stays green on red: the issue is the only signal
C. As A, and the open issue's title is rewritten to the latest problem on each red day

## What I had to decide

Keep the daily run at 06:17 UTC, fail the run on red as well as opening or updating the issue, and leave an open issue's title as first raised while each new report is commented on it.

## What I did meanwhile

The workflow is built that way, with a small first job that only says whether the read token is set, because a job's condition cannot read a secret directly.

## What it costs to change later

Each choice is one line of the workflow and its test: the time, the final failing step, or an extra title edit when commenting.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a red day should also fail the run; its risk about an expiring token turning one daily run red suggests it should, so it does.

---
id: s4-02-recheck-one-workspace-at-a-time
prd: 774
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

The weekly check reads every workspace's sources again. Should it read them one workspace after another, or all at once?

## The decision, in plain words

One after another, inside the single weekly call, so the shared GitHub allowance is never spent in one burst. If many workspaces grow large, the call may run out of time before the last ones.

## The intro, for fun

Sunday night, a queue of workspaces, and only five minutes on the clock.

## The punchline, for fun

First come, first checked, and the rest wait for next Sunday.

## The options, in plain words

A. A. One workspace after another, in one call of at most five minutes
B. B. All workspaces at once in the same call, faster but harder on the GitHub allowance
C. C. One call per workspace from the weekly job, each with its own time limit

## What I had to decide

Whether one call, one workspace at a time, is enough, or the check should be split per workspace.

## What I did meanwhile

The weekly route rechecks the workspaces in turn within its five-minute limit; a workspace that fails is skipped and named in the answer, and the others carry on.

## What it costs to change later

Running them side by side is a one-line change; splitting into one call per workspace means a new small route and a loop in the weekly job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how many workspaces one weekly run must reach, nor how long one draft takes on a large repository.

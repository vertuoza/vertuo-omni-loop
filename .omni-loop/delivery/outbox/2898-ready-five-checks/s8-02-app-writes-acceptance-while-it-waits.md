---
id: s8-02-app-writes-acceptance-while-it-waits
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

While the screen tests wait for a runner, should the proof of the success criteria already show on the pull request as still running, or show nothing until the runner is done?

## The decision, in plain words

It shows as still running, written by the Omni App, and names what it waits for: no runner has run the screen tests yet. It is never green while it waits, and it turns green or red once the runner is done.

## The intro, for fun

A blank scoreboard tells nobody the match is still on.

## The punchline, for fun

Ours says the match is on, and who has not turned up yet.

## The options, in plain words

A. A. Show the proof as running while it waits, naming what it waits for: what was built.
B. B. Show nothing until the runner is done, check 3 saying only that no proof is there yet.

## What I had to decide

Pick A to keep the proof shown as running while it waits, or B to show nothing until the runner is done.

## What I did meanwhile

Built A in `apps/omni-app/src/ready-check/runner-fallback.ts`: once CI kept the `acceptance-report` artifact with an `e2e` criterion `pending`, the App posts the `acceptance` check run `in_progress` (external id `omni-acceptance`), its text the report, and updates the same run to `success` or `failure` from the runner's result. Check 1 then reads `not finished` (`still running: acceptance`) and check 3 `not finished` with `AC-<n>: no runner has run the e2e scenarios yet`, in the App's `omni / ready` and in `omni ready` alike. `reportOf` in `apps/omni-app/src/ready-check/facts.ts` now reads the report of a run still going, as `kit/lib/ready/gh-facts.ts` already did. s5-01 kept CI from writing a run that would stay going: this run is the App's, so the App completes it.

## What it costs to change later

Showing nothing until done is one branch in `runnerFallback` and the old `reportOf`; check 3 would then read `no acceptance report on the latest commit yet` while it waits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) a run that waits forever, with no runner in the workspace, stays in progress on that commit until a new one: truthful, but a reviewer may read it as stuck

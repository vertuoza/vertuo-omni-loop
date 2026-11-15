---
id: s7-03-ready-check-refreshes-when-ci-ends
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The spec runs the App's ready check on each new commit, when the build has barely started, so it would read not finished until the next commit. Should it also run when the build ends?

## The decision, in plain words

Yes: when a group of checks finishes on a pull request's latest commit, the App runs its ready check again. When the result has not changed it posts nothing new, so it never repeats itself.

## The intro, for fun

A referee who blows the whistle before the match starts is not much of a referee.

## The punchline, for fun

Ours now waits for the final whistle, and only speaks when the score changed.

## The options, in plain words

A. A. Run the check again when a group of checks finishes on the head, posting only a change: what was built.
B. B. Run it on new commits, labels and reviews only, as the spec words it.
C. C. Run it again only when the build's own checks finish, never the App's.

## What I had to decide

The App already receives `check_suite.completed` (for the touches and the main watch), so no subscription changes. `toReadyRefreshes` in `apps/omni-app/src/webhook/webhook.ts` refreshes the `pr-ready` job of each pull request a completed suite names, into the default branch only. The App's own suite completing refreshes it too; `postReady` in `apps/omni-app/src/ready-check/ready-check.ts` reads the latest `omni / ready` run of the commit and posts nothing when it would say the same, so it never loops, and it updates a run still in progress rather than adding one. The ledger debounces refreshes of one pull request into one run.

## What I did meanwhile

Built both, with tests: a completed suite refreshes the ready job alone, a sub-PR's suite refreshes nothing, and a second run with the same verdict writes nothing.

## What it costs to change later

One filter in the webhook and its test; taking it out leaves the check refreshed by pushes, labels and reviews only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how much GitHub budget the extra runs spend on a busy repository: each run of an ungated pull request reads its pull request and its base's settings, about six calls

---
id: s2-03-stopped-mega-bug-fix-relaunch
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A mega bug fix that stopped on the line that resumes it now reads Stopped mid-way, with Resume, since the fix that lets a stopped mega bug fix resume on its branches. Should a key be able to relaunch it through the API, as the page offers, or should the bug fix's own word win, so that the relaunch refuses it?

## The decision, in plain words

The stopped reading wins: such a job reports the outcome stopped, the page offers Resume, and the key's relaunch follows the page and resumes it. The job still reports who fixed it and every pull request it opened.

## The intro, for fun

Two fixes met in one file, and each had a word for how the job ended.

## The punchline, for fun

Stopped mid-way beats stuck: the page and the key both offer to carry on.

## The options, in plain words

A. A. The stopped reading wins: the job reports stopped, the page offers Resume, and a key's relaunch resumes it.
B. B. The bug fix's own word wins: the job reads ended, the page offers nothing, and a key's relaunch answers that it cannot.

## What I had to decide

Merging main into the feature branch brought the fix that lets a stopped mega bug fix resume on its branches (#2449): a mega bug fix whose hand-off ends on its resume line reports the outcome `stopped`, and the page offers Resume. This PRD's s2 made the runner report a bug fix's own word (`fixed`, `stuck`, `blocked`…), `fixedBy` and every `PR:` line. The merge keeps both: the ending report carries the bug-fix fields and the outcome, and `stopped` overrides the bug fix's word for that case. With the spec's relaunch rule (does what the page offers for that job), s7 will let a key resume such a job; an app that calls the API may have read a finished bug fix as ended, where a relaunch answers 409.

## What I did meanwhile

Resolved the merge as the union of both sides in the runner and its log tests, kept the mega bug fix's resume tests from main green beside s2's, and carried on with wave 4.

## What it costs to change later

Changing it later is one rule in the runner's ending report (which word wins) and one line in the relaunch's rule; no stored shape changes, and jobs already ended keep the outcome they reported.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an app that already calls the API relaunches a bug fix through this route: one that queues a new bug fix instead, and never calls relaunch, sees no change from A.
- (author) Whether a person reading a key's thread expects Resume on a bug fix that said it was stuck.

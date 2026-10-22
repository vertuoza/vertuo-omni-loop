---
id: s2-01-fixed-by-link-left-out-of-prs
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a bug fix finds the bug was already fixed by an earlier pull request, should that earlier pull request also show among the pull requests the job opened?

## The decision, in plain words

I kept it out of that list: the job opened nothing for it, and the earlier pull request already has its own place on the job as the one that fixed the bug.

## The intro, for fun

The bug was fixed before we got there: where does the old fix go on the job's page?

## The punchline, for fun

Finding a fix and opening one are different jobs, so the page lists them apart.

## The options, in plain words

A. A. Leave the pull request that fixed the bug out of the list of opened pull requests (built).
B. B. List it in both places, as the job's log names it.

## What I had to decide

Whether the pull request a bug fix proved had already fixed the bug (the hand-off's Fixed by line) is also reported in the job's pull request list (prs). The plan names both fields and says prs holds the pull requests the job opened, but not whether the proven one belongs to both.

## What I did meanwhile

bugFixReading leaves the Fixed by link out of prs, so a PR: line that names it counts as fixedBy only. A run that opened its own pull request and also proved another keeps both, each in its own field.

## What it costs to change later

One filter in bugFixReading (kit/lib/runner/log.ts) and its test, plus the runner's expectation: a constant-sized change with no migration, since both fields are only reported and the app stores what it receives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not see how the Omni page shows the pull request list beside the fixed-by link: the app and its page are slice s1's.

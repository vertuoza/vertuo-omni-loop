---
id: s2-02-which-jobs-report-pull-requests
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should only bug fix jobs report the pull requests they opened, and should a bug fix that failed or timed out still report the ones it had opened?

## The decision, in plain words

Only the two bug fix skills report them, and a bug fix that ended failed still reports the pull requests it had opened, so a person can find a draft it left behind. A cancelled job reports none.

## The intro, for fun

A job gave up halfway and its draft pull request is still out there: should the page list it?

## The punchline, for fun

A fix that stalls leaves its draft behind, and a list is easier to follow than a hunt.

## The options, in plain words

A. A. Only bug fix jobs report them, a failed one included (built).
B. B. Only a bug fix that ended done reports them; a failed one reports none.
C. C. Every kind of job reports the pull requests its log names.

## What I had to decide

Which jobs add the pull request list (prs) and the fixed-by link to their ending report, and on which endings. The plan names bug fix jobs only, and a failed run's draft is the case the list exists for.

## What I did meanwhile

Only jobs whose command line is /omni:bug-fix or /omni:mega-bug-fix read their log for these fields. A done one adds the outcome, the fixed-by link and the list; a failed one (exit code, vanished, timeout) adds the list and no outcome; a cancelled one adds nothing.

## What it costs to change later

Changing it later means moving one check in kit/lib/runner/runner.ts (bugFixOf, failedWithPrs) and its tests: no migration and no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not check whether feature jobs of other skills also open several pull requests worth listing: the plan names bug fix jobs only.
- (author) A bug fix cancelled from the Omni page reports no pull requests, since the runner kills it without reading its log.

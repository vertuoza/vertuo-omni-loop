---
form: ci
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/ci-triage.md — changes in kit/porting/templates--ci.md -->

# CI

Use this page when a check on your pull request is red.

## Workflows
<!-- slot: workflows · required -->
Every job carries a timeout, so a stuck job still ends its run. A run whose jobs all sit queued,
none ever starting, usually names a runner nothing answers to: check the runner settings before
assuming an outage.

## What gates a merge
<!-- slot: gating · required -->
- No checks at all on a pull request, rather than a red one, usually means it conflicts with its
  base: no workflow runs when the merge commit cannot be built. Check that it merges first.
- A draft runs no CI, and a sub-pull request into a feature branch never does. Marking a draft
  ready is what grades it.
- An aggregate check counts a skipped job as a failure, and a red build skips the jobs after it:
  fix the build first.
- A green pull request whose merge turns `{config:repo.defaultBranch}` red missed a dependency its
  checks could not see. Fix it forward; revert only when the product is down.

## Known reds
<!-- slot: known-reds · optional -->
A red that is not a finding is listed here: its signature, the one check that rules your branch
out, and what to do. Anything not listed is yours to fix. A known red that was fixed is a finding
again on a branch that contains the fix.

A flaky test not fixed in one focused attempt is quarantined: skipped with its issue in the reason,
and listed here so the count stays visible.

## When to re-run
<!-- slot: rerun · optional -->
A re-run is allowed only when both hold: the failure matches a known red, and your branch changes
nothing the red names. One re-run at most, and it counts as one of the `{config:limits.attempts}`
repair attempts; red again, it is a finding. A run a later push superseded is never re-run: read the
latest run instead.

# Bug 876: the outbox check goes red on PRs that are not Omni Loop PRs

## Triage

- **Domain:** apps/omni-app — the `outbox-check` Inngest function and its failure handler
- **Risk:** medium — teams on repos with the app installed see a red `outbox` check on ordinary PRs whenever GitHub rate-limits the app, which blocks merges where all checks are required; workaround: ignore the check (vertuoza/vertuo-backend-php#6341) or re-run it (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/outbox-check.test.mjs`
- **Red:** `a dependabot PR: a run GitHub rate-limits never ends red — AssertionError: expected [ 'failure' ] to not include 'failure'`

## Fix

The function started an `in_progress` check on every pull request and decided only in its second step that a non-feature PR is `skipped`. So when GitHub rate-limited that step, the fail-closed handler turned the check red, or left it `in_progress`, on dependabot and hand-written PRs. Now the first step decides from the PR's refs, the base config and the head's PRD folder names (the same feature-PR detection `evaluate` uses, now shared) and posts a non-feature PR's check already `skipped`. The failure handler fails only a PR it knows is gated, or a check run that step already started on one: a PR it cannot place gets nothing.

## Guard

The `only an Omni Loop feature PR is gated (issue 876)` tests: a dependabot PR and a plain `feat/` PR, run through a rate-limited GitHub and the failure handler, never end `failure` or `in_progress`, and a real feature PR still fails closed. 7 of them fail on main.

## Mutation

not set here

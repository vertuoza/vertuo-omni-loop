# Bug 1202: the App's outbox check skips a target feature PR instead of deferring to its plan PR

## Triage

- **Domain:** the omni-app's outbox check (`apps/omni-app/src/evaluate`, `apps/omni-app/src/outbox-check`)
- **Risk:** high — teams running a plan repository see a target feature PR's outbox check skipped, with no link to the plan PR that grades it; the skipped check still lets the PR merge (Jev, 0.76)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/end-to-end.test.ts`
- **Red:** AssertionError: expected { id: 1000, name: 'outbox', …(4) } to match object { name: 'outbox', …(2) } — case 9, a target feature PR (body "Part of acme/plan#8") came back `skipped`, not `success`

## Fix

The App never read a pull request's body, so a target feature PR, which has no PRD folder in its
repository, was skipped as "not active on this PR". It now reads the body: on a PR into the default
branch whose body says `Part of <owner>/<repo>#<n>` naming another repository, and not `Closes #<n>`,
the check completes as `success`, titled `PRD <n> is graded on <owner>/<repo>'s plan PR`, linking the
open plan PR whose body says `Closes #<n>`, or the PRD issue when the plan repository cannot be read.
It does not mirror the plan PR's state: nothing re-runs the target's check when the plan PR's
changes, so a red copy would stay red after the plan PR went green.

## Guard

The end-to-end case 9 (and the target cases in `outbox-check.test.ts`): a target feature PR through
the real function against the stubbed GitHub, which fails on the default branch's code.

## Mutation

mutation: no changed core file against origin/main (df9fb52f): nothing to mutate

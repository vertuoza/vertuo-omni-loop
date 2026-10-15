# Bug 1970: an outbox check stays in_progress forever when its failure handler meets the GitHub budget floor

## Triage

- **Domain:** the omni-loop GitHub App's outbox check, its failure handler (`apps/omni-app/src/outbox-check`, PRD 28 and PRD 902)
- **Risk:** medium — a PR author sees the outbox check pending forever, with no verdict and no reason; the workaround is to push again once the budget recovers. (Jev, 0.98)
- **Regression:** yes — #903 (`a66a681e`, PRD 902) made background calls refusable below the budget's floor and taught the check's steps to wait for it, but not its failure handler, which swallows the refusal

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/failure-budget.test.ts`
- **Red:** AssertionError: promise resolved "{ posted: false, …(1) }" instead of rejecting

## Fix

When a run failed while the installation's GitHub budget was below its floor, the failure handler's own calls were refused too; it caught both refusals, returned `posted: false`, and the check run the step "in-progress" had opened stayed `in_progress`. The handler now rethrows a budget's refusal from those two guarded calls and runs inside `waitingOnBudget`, as the check's steps do, so the refusal becomes a retry at the time the budget allows the call, and the open check is completed then.

## Guard

The reproduction is the guard: it fails as soon as the failure handler swallows a budget's refusal (below the floor or paused) instead of waiting for it.

## Mutation

mutation: no changed core file against origin/main (69dffde4): nothing to mutate

# Bug 1413: the outbox check runs on every sub-PR event

## Triage

- **Domain:** `apps/omni-app`: the webhook's routing of pull request events to the outbox check (`apps/omni-app/src/webhook/webhook.ts`)
- **Risk:** high — every sub-PR event costs runs on the Inngest account all installations share; with #1409 they exhausted it, degrading outbox checks, harvests and retros for every repository until the reset, with no workaround
- **Regression:** new bug — no evidence this ever worked: sub-PRs have been sent to the outbox check and given a "skipped" check since issue 876

## Reproduction

- **File:** `apps/omni-app/src/webhook/webhook.test.ts`
- **Red:** × turns no event of a sub-PR, a pull request into another branch than the default, into an outbox check (#1413) — AssertionError: opened: expected [ { …(2) } ] to deeply equal []

## Fix

Every event of a sub-PR (opened, synchronize, labeled…, and a re-run of its check) was sent to the outbox check, which only posted it as skipped: about 1.9K runs a day on the shared Inngest account. `toCheckRequests` now sends nothing for a pull request whose base is not the repository's default branch, read from the delivery (`repository.default_branch`, the pull request's `base.ref`); a delivery naming no default branch is sent as before. A sub-PR gets no outbox check at all.

## Guard

The reproduction is the guard: a unit test over every check action and a check re-run that fails on the default branch's `webhook.ts` and passes here.

## Mutation

not run — `pnpm mutation:changed` mutates only the delivery core under `kit/lib/` (`stryker.config.ts`), and this fix changes `apps/omni-app` only

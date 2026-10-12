# Bug 1409: every merged sub-PR starts a knowledge harvest and a retro, exhausting Inngest

## Triage

- **Domain:** `apps/omni-app`: the webhook's routing of merged pull requests (`apps/omni-app/src/webhook/webhook.ts`)
- **Risk:** critical — every installation shares one Inngest account; once its monthly limit is spent, knowledge harvests, retros and outbox checks degrade for every repository, and the only workaround is a manual local `omni harvest` (Jev, 0.40)
- **Regression:** new bug — no evidence this ever worked: the webhook has sent a harvest and a retro request for every merged pull request since the harvest was added (PRD 82); the volume grew with the waves' sub-PRs

## Reproduction

- **File:** `apps/omni-app/src/webhook/webhook.test.ts`
- **Red:** × turns a pull request merged into another branch than the default, a sub-PR, into no retro and no harvest event (#1409) — AssertionError: expected [ { …(2) } ] to deeply equal []

## Fix

The webhook turned every merged pull request into a retro and a knowledge-harvest event, and left the functions to skip the ones that were not feature PRs, so every sub-PR merged by a wave cost Inngest executions (317 harvest runs in one day, past the account's monthly limit). `toRetroRequests`, which `toHarvestRequests` reuses, now sends nothing for a pull request merged into a branch other than the repository's default branch, read from the delivery itself (`repository.default_branch`, `pull_request.base.ref`); a delivery naming no default branch is sent as before.

## Guard

The reproduction is the guard: a unit test that fails on the default branch's `webhook.ts` and passes here, so a change that sends events for sub-PR merges again turns it red.

## Mutation

not run — `pnpm mutation:changed` mutates only the delivery core under `kit/lib/` (`stryker.config.ts`), and this fix changes `apps/omni-app` only

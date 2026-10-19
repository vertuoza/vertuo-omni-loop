# Bug 2210: the outbox check fails on knowledge PRs once the delivery folder passes 20 MB

## Triage

- **Domain:** Omni GitHub App: the outbox check
- **Risk:** medium — every knowledge and enforce PR in a repository with a long delivery history gets a red outbox check that never clears; a person can still merge it, since the check never blocks those PRs
- **Regression:** yes — the outbox check on knowledge PR #2142 passed on 2026-10-17; on knowledge PR #2128 it fails, as the delivery folder grew past the snapshot's 20 MB bound

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/delivery-scope.test.ts`
- **Red:** `AssertionError: expected true to be false // Object.is equality`

## Fix

Issue 1968 narrowed what the outbox check fetches for feature and fix PRs only; a knowledge or enforce PR still fetched every file of the delivery folder, and past 20 MB the snapshot refused. Its check reads only the knowledge folder and the changed files, so it now fetches no delivery folder's contents.

## Guard

none — the reproduction is the guard: a unit test of which delivery files each kind of pull request fetches

## Mutation

pending

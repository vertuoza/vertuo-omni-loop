# Bug 2766: pull request checks wait up to an hour behind the GitHub budget's background floor

## Triage

- **Domain:** omni-app jobs: the four pull-request checks on the job ledger (PRD 2688) and the shared GitHub budget (PRD 902)
- **Risk:** medium — every pull request of the installation waits up to an hour for its merge-gating checks while the budget is under its background floor; the workaround is to wait for the window to reset (Jev, 0.63)
- **Regression:** yes — the ledger records floor waits from the day the checks moved onto it (#2690): 643 on 2026-11-10 and 1,739 on 2026-11-12, none on 2026-11-11

## Reproduction

- **File:** `apps/omni-app/src/jobs/pr-checks.budget.test.ts`, `packages/github/src/client.test.ts` (describe "Git objects named by their sha never change"), `apps/omni-app/src/snapshot/snapshot.budget.test.ts`
- **Level:** unit
- **Red:** `HttpError: GitHub budget below its background floor until …` for each of `pr-outbox`, `pr-inbox`, `pr-approved` and `pr-budgets` with the budget at 10% of its limit; `AssertionError: expected [ …(12) ] to have a length of 6 but got 12` (a second snapshot of the same commit sent every Git object again); and the stored blob and tree asked of GitHub again (`no answer stubbed for …/git/blobs/aaaa…`)

## Fix

Two causes. The four checks gate a merge, yet the App spent the installation's budget for them at `background` priority, so below the 20% floor every check was refused unsent and its job parked `waiting`, 15 minutes at a time, until the hourly window reset. The checks now ask for their installation's Octokit at `interactive` priority (`prCheckWorkers`, through a priority `installationOctokitFor` now takes); everything else the App runs stays `background`, and a pause still holds every call.

What drained the budget: GitHub counts every answer against the hour, a 304 included, and an ETag only matches the token that read it, which each function run mints anew, so the stored ETags saved no call. The snapshots behind the checks read one tree per folder and one blob per file: on this repository the outbox check of a fix pull request reads about 570 blobs and the budgets check about 280 blobs and 30 trees, the same ones again on every push and every re-run (177 budgets runs and 102 outbox runs on 15 pull requests of one repository on 2026-11-12). The shared client now answers a Git object named by its sha (`/git/blobs/<sha>`, `/git/trees/<sha>`), which never changes, from its store without sending anything; a tree named by a branch is asked for as before. The bytes are the same, so no check decides anything differently.

## Guard

The reproductions stay as guards: each check kind must run below the floor while the App's other work is still refused there and a pause still holds a check (`pr-checks.budget.test.ts`), and a second snapshot of a commit must send nothing (`snapshot.budget.test.ts`, the client's own tests).

## Mutation

mutation: no changed core file against origin/main (46545cd5): nothing to mutate

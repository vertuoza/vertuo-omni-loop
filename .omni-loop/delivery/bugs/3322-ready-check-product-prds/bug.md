# Bug 3322: the ready check throws on a mission scoped by product PRD ids

## Triage

- **Domain:** Omni GitHub App: ready check (`apps/omni-app/src/ready-check`)
- **Risk:** high — every pull request of a repository holding a live mission scoped by product PRD ids gets no ready verdict (the check throws and its job retries); the only workaround is to pause or end the mission (Jev, 0.51)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/ready-check/store.test.ts`
- **Level:** unit
- **Red:** `"message": "Invalid input: expected number, received string"`

## Fix

The ready check's store parsed every live mission's `scope.prds` as repository PRD numbers and `scope.roadmaps` as roadmap numbers, so one mission scoped by product PRD ids (`omni-loop-28`) or product roadmap ids threw for the whole repository. `MissionScopeRowSchema` now takes a repository number or a product id in each list, as the brief and `mission_scope_ok()` do; a product PRD is no PRD of the repository, so it plays no part in that repository PRD's verdict, and only roadmap numbers are looked up. Each mission row is read on its own, and a row out of shape is logged and left out instead of failing the check.

## Guard

The two unit tests in `store.test.ts`: a mission scoped by product ids, alone and beside one that holds the PRD, and a row out of shape, logged and skipped beside a readable one.

## Mutation

Pending.

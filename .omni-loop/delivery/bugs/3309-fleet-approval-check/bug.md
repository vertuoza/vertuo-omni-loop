# Bug 3309: the omni/approved check refuses a fleet's approval of a mission's PRD as a non-member's

## Triage

- **Domain:** approvals — the GitHub App's `omni/approved` check
- **Risk:** medium — a mission at alone cannot get its PRD's target pull request past `omni/approved` after its fleet approved the plan; workaround: a person approves the PRD on its page.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/approved-check/fleet-approval.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'refused · approver fleet invicibles i…' to be 'building · 2 of 2 pinned' // Object.is equality

## Fix

A fleet's approval (BR-PRODUCT-144) is stored with its fleet's key and its mission, its `approved_by` the mission's id, so the App's two service-role readers (the product PRD record in `apps/omni-app/src/approved-check/record.ts`, galaxy's judge in `apps/galaxy/src/approvals/judge.repository.ts` and `judge.service.ts`) found no such member and refused it. They now read it as `dossier_approval()` already does: it counts while its fleet is a live Virtual Fleet of the PRD's workspace, and a person's approval keeps the member rule. The product check says `refused · fleet <key> no longer exists in the workspace` when the fleet is retired or gone.

## Guard

The reproduction and its twin for galaxy's judge, `apps/galaxy/src/approvals/judge-fleet.test.ts`, run by CI on every pull request: each reader is pinned to the fleet rule `dossier_approval()` follows, for a live, a retired, a foreign and a missing fleet, and to the member rule for a person.

## Mutation

not set here — no delivery-core file changed (`pnpm mutation:changed` says so and exits)

## Still open

- The App's product PRD record reader takes the newest approval of any kind, so a Tech Approval newer than the product approval would read as the approval in force; galaxy's judge filters on approval_kind = 'product'.

# Bug 2992: only a PRD's author can get a Tech Approval, and /omni:tech-review needs a request

## Triage

- **Domain:** approvals — the Tech Approval of a ◆ PRD (PRD 2608)
- **Risk:** medium — a member who is not the author of an unapproved ◆ PRD cannot get a tech review at all; the workaround is to ask the author to request one
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `supabase/checks/tech_approval.sql`
- **Level:** unit
- **Red:** `ERROR:  Only the author of PRD #4 requests its Tech Approval.`

## Fix

The same red shows on the page (`apps/galaxy/src/dossier/page/tech-request-any-member.test.ts`) and in the skill's contract (`kit/test/tech-review-skill.test.ts`). The page offered **Request a Tech Approval** only to the PRD's author, `dossier_request_tech_approval()` refused anyone else, and `/omni:tech-review` refused a PRD with no request or anyone but the named person. Now any member of the workspace sees the button on a ◆ PRD that is not approved and holds no request, a new migration drops the database's author-only refusal (naming the author stays refused), and the skill reviews any plan not approved yet, with or without a request; only the person a request names still gives the approval.

## Guard

The reproductions: the page case and the skill's contract run in `pnpm test`, and the database case in `supabase/checks/tech_approval.sql`, which the supabase workflow runs on every pull request.

## Mutation

mutation: no changed core file against origin/main (9f9887e0): nothing to mutate

## Still open

- A PRD born in a repository (◇, approved by its phase-0 pull request) takes no Tech Approval at all; whether it should, and whether one would hold its phase-0 merge, is a product decision for /omni:brainstorm.

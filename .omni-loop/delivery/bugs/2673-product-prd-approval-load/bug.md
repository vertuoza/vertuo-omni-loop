# Bug 2673: a product PRD's page never loads its approval

## Triage

- **Domain:** approvals
- **Risk:** high — whoever approves a product PRD still gets no Approve button and no business laws verdict on its page; no workaround on the page.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dossier/page/page.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected '<div class="dossier"><header class="d…' to contain 'dossier-approve-button'

## Fix

`dossierRoute` loaded the approval only for a dossier with a repository number, so #2672's view never received a product PRD's approval. The route now loads it for every PRD, and `approvalOf` reads nothing for a dossier not born on the server. The reproduction goes through the real route, which #2672's test did not.

## Guard

none — the reproduction goes through the real page route and stays as the regression test

## Mutation

mutation: no changed core file against origin/main (facd52ab): nothing to mutate

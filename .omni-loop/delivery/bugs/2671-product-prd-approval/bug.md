# Bug 2671: a product PRD's page has no Approve and no business laws verdict

## Triage

- **Domain:** approvals
- **Risk:** high — whoever approves a product PRD gets no Approve button and no business laws verdict on its page, so it cannot be approved there; no workaround on the page.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dossier/page/approval.product-prd.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected null to match object { state: 'waiting', …(2) }

## Fix

`approvalView` returned nothing for a dossier with no repository number, a check meant for drafts that also caught product PRDs. The page now reads the PRD's id on its product (`mobile-12`) beside its approval, shows the approval area when a PRD has either number, and seals the approval under that id. A draft, numbered nowhere, still shows none.

## Guard

none — the reproduction stays as the regression test, and no cheaper check would catch a page that leaves out one kind of PRD

## Mutation

mutation: no changed core file against origin/main (3840cde5): nothing to mutate

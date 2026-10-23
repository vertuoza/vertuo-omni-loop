# Bug 2387: moving a locked law into a new file can never clear the outbox check

## Triage

- **Domain:** Omni App · outbox check, `law-locked` (domain gate)
- **Risk:** medium — a pull request that moves a locked law into a file the base branch's CODEOWNERS does not list stays red, and no approval can clear it; workaround: land an owners line on the default branch first
- **Regression:** new bug — no evidence this ever worked: the gate fails closed on an unowned file since PRD 1726, and no law had moved into a new file before #2348

## Reproduction

- **File:** `kit/lib/outbox/decision-coverage.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { awaiting: [ { …(4) } ], …(1) } to deeply equal { awaiting: [], approvedBy: [ 'ann' ] }

## Fix

The outbox check asks every file that changed a locked law to be approved by a person the base
branch's CODEOWNERS lists for it, and a file it lists nobody for held the law red with no way out. Such
a file now falls back to the law owners the base branch's config names (`laws.owners`, never the
head's), the people who lock laws; with neither, it still fails closed.

## Guard

The reproduction: a law moved into a file nobody owns is cleared by a law owner's approval, waits
for the law owners when none approved, takes an owner written with or without `@`, never takes a
team, and still fails closed with no law owners.

## Mutation

mutation: 124 killed, 2 survived in kit/lib/outbox/decision-coverage.ts (both equivalent: the empty default replaced by a value that is no person, and `/^@/` by `/@/`, which differ only for a login holding `@`, which GitHub refuses)

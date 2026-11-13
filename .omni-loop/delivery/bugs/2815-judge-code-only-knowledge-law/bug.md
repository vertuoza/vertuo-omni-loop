# Bug 2815: the business-law judge marks a code-only spec red on BL-PRODUCTKNOWLEDGE-4

## Triage

- **Domain:** business laws judge (`apps/galaxy/src/business-laws/judge.service.ts`), product-knowledge laws
- **Risk:** high — a PM cannot approve a product PRD whose spec changes only code: the judge reports BL-PRODUCTKNOWLEDGE-4 broken and the database refuses a red on Approve; rewording the spec does not help.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/business-laws/judge-scope.test.ts`
- **Level:** unit
- **Red:** `× is no finding: the verdict stays green — The spec describes a job that stores counts, which changes the repository's books, but does not explain how this change reaches the shelf.` (and, against the real model, `apps/galaxy/src/business-laws/judge-live.test.ts`: `× is green on omni-loop-8, which changes no knowledge`, 3 runs of 3, each red on BL-PRODUCTKNOWLEDGE-4)

## Fix

The model reported what a spec does not describe ("does not explain how this change reaches the product") as a
break of a law the design never touches, and the judge kept any finding that quoted the spec and gave a why, so a
code-only spec went red with a different quote and reason on each push. The judge's prompt now says a law binds
only what the spec designs, that a gap in the spec or a sentence saying a law does not apply is no finding, and
the judge drops a finding whose why only names what the spec does not describe, design, explain or say.

## Guard

`apps/galaxy/src/business-laws/judge-scope.test.ts`: with an injected model, a finding whose why names the spec's
silence never turns a verdict red, a why about what the design does is still kept, and the prompt carries the
three rules; red on the default branch's judge, green on the fix. The live cases in `judge-live.test.ts` (run by
hand with `BUSINESS_LAWS_LIVE=1`) keep omni-loop-8 green and a design that breaks BL-PRODUCTKNOWLEDGE-4 red.

## Mutation

mutation: no changed core file against origin/main (ff19b119): nothing to mutate

# Bug 1690: a Part of <key>-<n> mentioned in a PR body's code or prose is read as a product PRD claim

## Triage

- **Domain:** omni-app GitHub App — how the outbox and `omni/approved` checks read a pull request body's `Part of` claim (`productPrdOf`, `planPrdOf`)
- **Risk:** medium — any PR into the default branch whose body quotes a `Part of <key>-<n>` example gets a false red outbox check and a wrong `omni/approved` subject; the workaround is to reword the body (Jev, 0.90)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/product-end-to-end.test.ts`
- **Red:** AssertionError: expected 'unknown · no product PRD mobile-12 ho…' not to match /^unknown/

## Fix

`productPrdOf` matched `Part of <key>-<n>` anywhere in a body, so a mention in inline code, mid-sentence
or in a code block counted as a claim; `planPrdOf` required a line start but still read a line inside
fenced code. Both now read only a line that starts with the claim, outside fenced code, through one
helper, `proseLines` (`apps/omni-app/src/evaluate/prose-lines.ts`); the shapes the kit writes
(`Part of <key>-<n> · <link>`, `Part of <owner/repo>#<n>`) keep working.

## Guard

`apps/omni-app/src/evaluate/part-of-readers.test.ts`: every regular expression of the App that reads a
`Part of` claim must be anchored at a line's start and its module must read the body through
`proseLines`; it fails on main's `state.ts` and `evaluate.ts` and passes on the fix.

## Mutation

mutation: no changed core file against origin/main (b6c42b83): nothing to mutate

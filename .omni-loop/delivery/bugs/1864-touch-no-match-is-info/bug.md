# Bug 1864: an unmatched GitHub touch is logged as an error

## Triage

- **Domain:** the GitHub touch webhook's logging (`apps/galaxy/src/touched`, ADR-0102)
- **Risk:** low — the person who runs the apps gets error lines and possibly error-anomaly alerts for normal webhooks, which hide real errors and add billed log events; nothing a member sees breaks, and there is no workaround but ignoring them. (Jev, 0.79)
- **Regression:** new bug — no evidence this ever worked: `receiveTouch` has written every line through `console.error` since PRD 902 s3

## Reproduction

- **File:** `apps/galaxy/src/touched/touched.test.ts`
- **Red:** AssertionError: expected "vi.fn()" to not be called at all, but actually been called 2 times

## Fix

A touch that matches no dossier is the webhook's most common answer (every repository of the
organisation sends touches), yet it wrote a `console.error` line: 12 error lines from one pull request in
ten minutes on production. It is now one `info` JSON line through `kit/lib/log` (ADR-0102): `event:
touch`, `outcome: ok`, `status: 202`, the repository and the same sentence. A refused secret, a body that
is not a touch, an unreadable snapshot and a touch that cannot be resolved stay errors.

## Guard

The reproduction: an unmatched touch on a known repository and one on an unknown repository write
nothing to the error sink and one info line each, with its fields. Red on main, green here.

## Mutation

mutation: no changed core file against origin/main (365feb42): nothing to mutate

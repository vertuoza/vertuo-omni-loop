# Bug 2968: omni next reads the Omni app's changes one after another, the phase-0 list once per PRD

## Triage

- **Domain:** the loop drive, `omni next` (`kit/bin/commands/next.ts`), reading the loop through the Omni page (`kit/lib/loop-reads/`)
- **Risk:** medium — every person and runner driving the loop waits about a minute per `omni next` tick and the Omni app gets duplicate reads; the answer is still right, and naming fewer PRDs only shortens the wait
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/next.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(3) ] to have a length of 1 but got 3` (the phase-0 list asked once per PRD) and `AssertionError: expected 1 to be greater than 1` (never more than one read waiting at once)

## Fix

`omni next` read every PRD one after another, each PRD's lists one after another, and asked every PRD for the same open phase-0 list. Its reads now go through `readOnce` (`kit/lib/loop-reads/once.ts`), which sends each distinct read once per run and forgets a failed one, and it reads up to four PRDs (and a plan repository's targets) at once with `sideBySide` (`kit/lib/side-by-side.ts`), which keeps the results in order and throws the first failure in item order, as the one-by-one loop did. Within a PRD, the phase-0 list, the feature PR and the board start together and are awaited in today's order. `omni status` reads no `/api/loop/changes`, so it is unchanged.

## Guard

The two reproduction tests count the reads one tick sends and how many wait at once, so a duplicate or a return to one-by-one reading fails `pnpm test`; `kit/lib/loop-reads/once.test.ts` and `kit/lib/side-by-side.test.ts` pin the memo, the bound, the order and the error order.

## Mutation

mutation:changed: no delivery-core file changed (kit/bin/commands/next.ts, kit/lib/loop-reads/, kit/lib/side-by-side.ts are outside mutation/floor.json's modules)

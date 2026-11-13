# Bug 2811: the session briefing prints the constituents of a product the repository has left

## Triage

- **Domain:** constituents, the session briefing's read (`kit/bin/commands/constituents.ts`, `kit/lib/constituents/cache.ts`)
- **Risk:** medium — an agent starting a session in a repository that moved product is briefed with another product's statement and Never lines, and may follow the wrong rules; the next read that answers in time corrects it.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/constituents-moved.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'Constituents of Acme Ops (synced 2 d …' not to contain 'Constituents of Acme Ops'

## Fix

When its read does not answer, `omni constituents` printed the copy saved for the repository whatever product it was read for. It now compares that copy with the newest product knowledge read kept beside it: when that read is newer and names another product, it prints one line naming both products and no constituent; otherwise the copy is printed as before.

## Guard

`kit/bin/constituents-moved-line.test.ts`: a copy older than a knowledge read naming another product is never printed, in text or under `--json`; it fails on the default branch.

## Mutation

mutation: no changed core file against origin/main (f4cb275b): nothing to mutate

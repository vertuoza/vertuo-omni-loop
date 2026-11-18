# Bug 3052: omni bug ci waits out its whole --wait when given short commit ids

## Triage

- **Domain:** bug fix proof, level B (`kit/bin/commands/bug-ci.ts`)
- **Risk:** medium — an agent proving a bug fix at level B loses its whole wait (30 minutes by default) and is told CI never finished, when it had; the workaround is passing full commit ids.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/bug.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected 'the runs did not finish within 0 minu…' to be '' // Object.is equality`

## Fix

`omni bug ci` passed `--reproduction` and `--fix` to `gh run list --commit` as given, and that flag matches a full sha only, so short ids found no run and the command waited out `--wait`. It now asks git for the full sha each id names in this checkout first, and keeps the id as given when git cannot name it (a commit not fetched here).

## Guard

The unit test `reads the runs of short commit ids as of the full ones they name` in `kit/bin/bug.test.ts`: two real commits, passed by their short ids, against a CI that knows only full shas.

## Mutation

mutation: no changed core file against origin/main (1b6ab33f): nothing to mutate

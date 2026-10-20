# Bug 2278: a version-only change to package.json makes playbook evidence stale after every release

## Triage

- **Domain:** kit › playbook — stale evidence (`kit/lib/playbook/status.ts`)
- **Risk:** medium — every member sees a false "playbook entries cite changed files" warning after each merge, which hides real staleness; workaround: refresh the forms again, until the next release (Jev, 0.94)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/playbook/check-playbook.test.ts`
- **Red:** AssertionError: expected [ { path: 'package.json', …(3) } ] to deeply equal []

## Fix

Evidence was stale whenever the file's whole hash changed, and the release commit bumps `"version"` in `package.json` after every merge, so six forms read stale each time. `staleEvidence` now reads the recorded blob from git and treats a file whose only changed lines are `"version"` lines as unchanged; a blob git no longer holds, or any other change, is still stale.

## Guard

The reproduction is the guard: a unit test on a real git repository that a version-only bump stays quiet and any other change is still named.

## Mutation

mutation: no changed core file against origin/main (1e89b6e2): nothing to mutate

---
form: testing
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - vitest.config.ts@7a03f3b
  - kit/test/fixture.ts@2b8d897
  - kit/bin/kb.test.ts@aef9a95
  - kit/lib/playbook/forms.test.ts@2d0d280
  - apps/omni-app/src/outbox-check/end-to-end.test.ts@6d46f08
  - README.md@7eaaaa0
  - game/README.md@1654a62
  - apps/omni-app/README.md@ed64d66
terraformed: 2026-09-25
---

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required · by: terraform · verified: 2026-09-25 -->
| What | Command |
|---|---|
| everything | `pnpm test` (runs `vitest run` over the whole workspace) |
| one file | `pnpm vitest run kit/lib/config.test.ts` |
| mutation, the changed core files | `pnpm mutation:changed [--base <ref>]` (the default base is the merge-base with `origin/main`) |
| mutation, the whole delivery core | `pnpm mutation`, then `pnpm mutation:score` (about 70 minutes on a laptop: the nightly runs it) |

**Mutation testing** (PRD 1072, ADR-0059) proves the tests catch bugs, not only run lines: Stryker changes
the delivery core's code (`kit/lib/outbox/`, `kit/lib/policy/`, `kit/lib/inbox/`, `kit/lib/env/`,
`kit/lib/board.ts`, `kit/lib/config.ts`, `kit/lib/layout.ts`, `kit/lib/ids.ts`) one mutant at a time and
runs the kit library's own tests against each. After writing or changing tests for core code, and in
every bug fix that touches it, run `pnpm mutation:changed` from the worktree, passing
`--base origin/<feature branch>` in a slice: it mutates only the changed core files and ends with
`mutation: <k> killed, <s> survived in <files>`, listing each survivor's file, line and mutation before
it. A survivor in the code you wrote is a test to add or tighten. It never runs in `check:changed`, the
preflight or pull request CI.

## Where tests live
<!-- slot: layout · required · by: terraform -->
Beside the code they test, as `*.test.mjs`, or `*.test.ts` under `apps/*/src/`, in the folders
`vitest.config.ts` includes: `game/`, `kit/`, `packages/`, `apps/omni-app/` and `apps/*/src/`.
A test outside them never runs.

- A command, through `main()` on a fixture repository: `kit/bin/kb.test.ts`, with
  `makeRepo()` from `kit/test/fixture.ts`.
- A parser or a pure module: `kit/lib/playbook/forms.test.ts`.
- The GitHub App end to end, against a stubbed GitHub: `apps/omni-app/src/outbox-check/end-to-end.test.ts`,
  with its fixture repositories under `apps/omni-app/test/fixtures/`.

## Choosing the level
<!-- slot: levels · optional -->

## Never
<!-- slot: never · required · by: terraform -->
- A test never calls GitHub or Supabase: everything runs on fixtures, and the GitHub App's tests
  run against a stubbed GitHub.
- A floor in `mutation/floor.json` never goes down, and no module leaves it:
  `scripts/mutation-floor.test.ts` refuses either against `origin/main`'s copy. Raising one to a
  module's new score, rounded down, is an ordinary edit.

## Test data
<!-- slot: data · optional -->
TODO(human): the kit's fixture repositories default to the slug `acme/widgets` (kit/test/fixture.ts), and the app's are folders named by situation (`base-active`, `head-drift`). Is there a naming rule for a new fixture repository?

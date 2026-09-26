---
form: testing
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - vitest.config.mjs@7a03f3b
  - kit/test/fixture.mjs@2b8d897
  - kit/bin/kb.test.mjs@aef9a95
  - kit/lib/playbook/forms.test.mjs@2d0d280
  - apps/omni-app/src/outbox-check/end-to-end.test.mjs@6d46f08
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
| one file | `pnpm vitest run kit/lib/config.test.mjs` |

## Where tests live
<!-- slot: layout · required · by: terraform -->
Beside the code they test, as `*.test.mjs`, or `*.test.ts` under `apps/*/src/`, in the folders
`vitest.config.mjs` includes: `game/`, `kit/`, `packages/`, `apps/omni-app/` and `apps/*/src/`.
A test outside them never runs.

- A command, through `main()` on a fixture repository: `kit/bin/kb.test.mjs`, with
  `makeRepo()` from `kit/test/fixture.mjs`.
- A parser or a pure module: `kit/lib/playbook/forms.test.mjs`.
- The GitHub App end to end, against a stubbed GitHub: `apps/omni-app/src/outbox-check/end-to-end.test.mjs`,
  with its fixture repositories under `apps/omni-app/test/fixtures/`.

## Choosing the level
<!-- slot: levels · optional -->

## Never
<!-- slot: never · required · by: terraform -->
- A test never calls GitHub or Supabase: everything runs on fixtures, and the GitHub App's tests
  run against a stubbed GitHub.

## Test data
<!-- slot: data · optional -->
TODO(human): the kit's fixture repositories default to the slug `acme/widgets` (kit/test/fixture.mjs), and the app's are folders named by situation (`base-active`, `head-drift`). Is there a naming rule for a new fixture repository?

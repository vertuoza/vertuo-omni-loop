---
form: testing
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@9870eaf
  - vitest.config.ts@731c58f
  - kit/test/fixture.ts@e399cda
  - kit/bin/kb.test.ts@cf5d524
  - kit/lib/playbook/forms.test.ts@d7eacc8
  - apps/omni-app/src/outbox-check/end-to-end.test.ts@862e637
  - README.md@e0d3c68
  - game/README.md@04db6c1
  - apps/omni-app/README.md@a655cb8
  - stryker.config.ts@2cdd709
invaded: 2026-10-20
---

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required · by: invade · verified: 2026-09-25 -->
| What | Command |
|---|---|
| everything | `pnpm test` (runs `vitest run` over the whole workspace) |
| one file | `pnpm vitest run kit/lib/config.test.ts` |
| mutation, the changed core files | `pnpm mutation:changed [--base <ref>]` (the default base is the merge-base with `origin/main`) |
| mutation, the whole delivery core | `pnpm mutation`, then `pnpm mutation:score` (about 70 minutes on a laptop: the nightly runs it) |

**Mutation testing** (PRD 1072, ADR-0059) proves the tests catch bugs, not only run lines: Stryker changes
the delivery core's code (`kit/lib/outbox/`, `kit/lib/policy/`, `kit/lib/inbox/`, `kit/lib/env/`,
`kit/lib/board.ts`, `kit/lib/config.ts`, `kit/lib/layout.ts`, `kit/lib/ids.ts`,
`kit/lib/budgets/ratchet.ts`) one mutant at a time and
runs the kit library's own tests against each. After writing or changing tests for core code, and in
every bug fix that touches it, run `pnpm mutation:changed` from the worktree, passing
`--base origin/<feature branch>` in a slice: it mutates only the changed core files and ends with
`mutation: <k> killed, <s> survived in <files>`, listing each survivor's file, line and mutation before
it. A survivor in the code you wrote is a test to add or tighten. It never runs in `check:changed`, the
preflight or pull request CI.

## Where tests live
<!-- slot: layout · required · by: human -->
Beside the code they test, as `*.test.mjs`, or `*.test.ts` under `apps/*/src/`, in the folders
`vitest.config.ts` includes: `game/`, `kit/`, `packages/`, `apps/omni-app/` and `apps/*/src/`.
A test outside them never runs.

- A command, through `main()` on a fixture repository: `kit/bin/kb.test.ts`, with
  `makeRepo()` from `kit/test/fixture.ts`.
- A parser or a pure module: `kit/lib/playbook/forms.test.ts`.
- The GitHub App end to end, against a stubbed GitHub: `apps/omni-app/src/outbox-check/end-to-end.test.ts`,
  with its fixture repositories under `apps/omni-app/test/fixtures/`.
- A file that proves a law stays its owner's: tests of other behaviour go in a test file of their
  own, and the law's file is left untouched (PRD 1972, s4-01; it replaces PRD 1739, s2-01, which
  let them sit beside the proof). The owner may let them sit beside the proof, on the PRD's
  outbox, when the law's own tests stay unchanged (PRD 1795, s3-01). PRD 1796's contract tests do,
  in `kit/lib/knowledge/check-knowledge.test.ts`, beside BR-PRODUCT-95's proof, which they leave
  untouched (PRD 1796, s1-04). PRD 1798's `get_knowledge_graph` tests do too, in
  `apps/galaxy/src/agent-connect/mcp/server.test.ts`, beside BR-PRODUCT-66's proof, with the
  tool-listing test counting four tools (PRD 1798, s4-01).

## Choosing the level
<!-- slot: levels · optional -->

## Never
<!-- slot: never · required · by: invade -->
- A test never calls GitHub or Supabase: everything runs on fixtures, and the GitHub App's tests
  run against a stubbed GitHub.
- A floor in `mutation/floor.json` never goes down, and no module leaves it:
  `scripts/mutation-floor.test.ts` refuses either against `origin/main`'s copy. Raising one to a
  module's new score, rounded down, is an ordinary edit.
- A test credential is never written whole: it is built at runtime (`'ghp_' + 'a'.repeat(36)`), and a
  change that adds one runs `gitleaks git --config .gitleaks.toml --log-opts=origin/<base>..HEAD .`
  before its first push, since CI scans every commit and a later one never clears a fake (retro of
  PRD 2433, #2469).

## Test data
<!-- slot: data · optional -->
A kit fixture repository takes an `acme/<name>` slug (`acme/widgets` by default, `kit/test/fixture.ts`);
an app fixture is a kebab-case folder named after the situation it sets up (`base-active`,
`head-drift`).

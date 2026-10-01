---
form: verification
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - vitest.config.ts@7a03f3b
  - kit/test/dist.test.ts@e236e83
  - apps/galaxy/package.json@4c42c54
  - .github/workflows/game.yml@8e69ab2
  - .github/workflows/supabase.yml@eb1f7c4
terraformed: 2026-09-25
---

# Verification

Use this page when handing off changes: what must be green before a pull request, and before a push.

## The preflight
<!-- slot: preflight · required · by: terraform · verified: 2026-09-25 -->
`pnpm test` is the preflight, and the full preflight too: one vitest run over the whole workspace,
as `vitest.config.ts` includes it. Among its tests, `kit/test/dist.test.ts` fails when
`kit/dist/omni.mjs` differs from a fresh build: after a change to the kit's source or templates,
run `pnpm kit:build` and commit the bundle with it.

## Before every push
<!-- slot: before-push · optional -->

## Checks
<!-- slot: checks · optional -->
TODO(human): there is no lint script, and nothing runs the arcade's `typecheck` script (green here): not the preflight, not a workflow. Should the preflight run it?

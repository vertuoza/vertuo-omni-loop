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
Beside the preflight, the `checks` workflow runs three more on a ready pull request into `main`,
each its own job, and each must be green before a hand-off:

- `pnpm typecheck`: `tsc` over the root project, then the arcade's own `typecheck` script.
- `pnpm lint`: typescript-eslint's `strictTypeChecked` over every TypeScript file git tracks
  (`eslint.config.ts`, PRD 976). While PRD 976 builds, each area's count of findings must equal its
  ceiling in `scripts/lint-ceilings/`, and a finding outside every area fails; `pnpm lint <path>…`
  prints the findings under those paths. An `eslint-disable` comment changes nothing, and
  `scripts/typescript-guard.test.ts` refuses one: fix the finding in code.
- `pnpm fallow:audit`: the audit of what the change touches.

# Plan: The last strict compiler flags

PRD #1023, specified in `spec.md` beside this plan. The feature branch `feat/ts-flags` merges into
`main` through the feature PR (`Closes #1023`); each slice is a sub-PR from `feat/ts-flags--<slice>`
into the feature branch (`Part of #1023`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit, the game, the packages and the scripts compile with the six flags | `kit/` `game/` `packages/` `scripts/` | — | 1 |
| s2 | The App compiles with the six flags | `apps/omni-app/` | — | 1 |
| s3 | The arcade compiles with the six flags | `apps/galaxy/` | — | 1 |
| s4 | The six flags on: set in `tsconfig.base.json`, so `pnpm typecheck` enforces them for the root project and the arcade | `tsconfig.base.json` | s1, s2, s3 | 2 |

**Shared ground.** None in wave 1: the three territories do not meet. The arcade's compile also reads
kit and package files it imports; an error it reports in `kit/` or `packages/` belongs to s1, and s3
fixes only files under `apps/galaxy/`. The flags stay off until s4, so the feature branch compiles at
every merge; each wave-1 slice checks its folders by passing the six flags to `tsc` on the command
line.

## Per slice: done when

**s1 to s3** (each in its own territory)

- `npx tsc -p . --noEmit --exactOptionalPropertyTypes --noImplicitOverride --noImplicitReturns
  --noFallthroughCasesInSwitch --noUnusedLocals --noUnusedParameters` reports no error in the
  territory, and for s3 the same flags run in `apps/galaxy` report none either.
- `exactOptionalPropertyTypes` errors are fixed by widening the property to `?: T | undefined`, or,
  on an object that leaves the process where absence is what the reader sees, by omitting the key;
  the sub-PR names each key it omits.
- An unused parameter is removed, or prefixed `_` where the signature is a port others call.
- No cast, no `// ts-allow:` line and no `eslint-disable` is added; the area's count in
  `scripts/typescript-ceilings.json` does not rise.
- `pnpm typecheck`, `pnpm test` (at least as many tests as before), `pnpm lint` (0 findings),
  `fallow audit` and `omni check all` are green.

**s4**

- `tsconfig.base.json` sets the six flags and not `noPropertyAccessFromIndexSignature`.
- `pnpm typecheck` passes, for the root project and the arcade, with no flag on the command line.
- `pnpm test`, `pnpm lint`, `fallow audit` and `omni check all` are green.

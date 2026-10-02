---
prd: 976
title: Type-aware linting at zero, on a suite that holds under load
blocked-by: none
spec: file
---

# Type-aware linting at zero, on a suite that holds under load

**Date:** 2026-10-02 · **PRD:** #976 · **Follows:** PRD 725 (strict TypeScript) and PRD 942 (the
escape hatches cleared and ratcheted) · **Touches:** the six kit test files that spawn the CLI and
`kit/test/test-timeouts.test.ts`; a new root `eslint.config.ts`, the root `package.json` and
`pnpm-lock.yaml`, `.github/workflows/checks.yml`, `scripts/` (the lint ceilings while the build
runs, and the guard's refusal of `eslint-disable`), `kit/lib/narrow.ts`, a test assertion helper, and
source and test files across `kit/`, `game/`, `packages/`, `scripts/`, `apps/omni-app/` and
`apps/galaxy/`. **Out of scope:** stricter compiler flags, branded ids, Effect, any behaviour change.

## Problem

The repository has a compiler and no linter. `tsc` proves shapes; it does not see a promise handed to
a callback that ignores it, a value printed into a string as `undefined`, a check the types say can
never fail, an `async` function that awaits nothing, or a `!` that claims a value is there. Run on
`main` today (measured 2026-10-02) with the rules this PRD adopts, `typescript-eslint` reports
**8,129 findings**, 1,774 in source and 6,355 in tests: the arcade 3,645, the kit 2,038, the App
1,969, the game 285, the packages 178, the scripts 14.

| Rule | Findings |
|---|---|
| `no-non-null-assertion` | 2,330 (419 source, 1,911 tests) |
| `no-unsafe-member-access`, `-assignment`, `-call`, `-argument`, `-return` | 3,083 |
| `require-await` | 835 |
| `no-confusing-void-expression` | 533 |
| `no-explicit-any` | 318 |
| `no-unnecessary-condition` | 225 |
| `no-unnecessary-type-assertion` | 170 |
| `no-unused-vars` | 133 |
| `restrict-template-expressions` (numbers allowed) | about 720 |
| `no-misused-promises`, `await-thenable`, `switch-exhaustiveness-check` | 36 |
| `react-hooks/exhaustive-deps` (the arcade) | 11 |
| every other rule of the set | the rest |

Separately, the suite does not hold under load. `kit/bin/ask-hook.test.ts` spawns one Node process
per hook kind and per input, each loading the whole CLI from source, in sequence; on a busy machine
the case runs past its 30-second budget. During PRD 942's second wave, nine builds in parallel turned
4 of 11 slices red on that test alone, though none had touched it.

## Solution

1. **The suite holds under load (first).** `kit/bin/ask-hook.test.ts` runs its hook matrix in the
   same process, through the `main()` it already imports, with stdin and stdout injected. Each
   behaviour that only a real process can prove (the plugin's `hooks.json` wiring, the end-to-end run,
   "never fails a hook") keeps one spawn. The other kit test files that spawn the CLI in a loop
   (`kit/bin/ask.test.ts`, `kit/bin/statusline.test.ts`, `kit/bin/version.test.ts`,
   `kit/test/bundle-playbook.test.ts`, `kit/test/plugin.test.ts`) are reviewed the same way.
2. **The linter.**
   - `eslint` 9, `typescript-eslint` 8 and `eslint-plugin-react-hooks` as development dependencies.
   - One root `eslint.config.ts` (TypeScript: the guard refuses new JavaScript), with the project
     service reading the root and the arcade's tsconfigs. Every `.ts` and `.tsx` file git tracks is
     linted, tests included, the same way, except the generated `supabase/database.types.ts` and the
     bundle.
   - The rules: `strictTypeChecked`, with two tunings. `restrict-template-expressions` allows
     numbers, and `eslint-plugin-react-hooks`'s `rules-of-hooks` and `exhaustive-deps` run on
     `apps/galaxy`.
   - `linterOptions.noInlineConfig: true`, so an `eslint-disable` comment changes nothing.
   - `scripts/typescript-guard.test.ts` refuses any `eslint-disable` comment in a file git tracks,
     naming the line.
   - `pnpm lint`, and a `lint` job in `.github/workflows/checks.yml` beside `typecheck`.
3. **While the build runs, a ratchet; at the end, zero.** Until every folder is cleared, `pnpm lint`
   compares each area's count with its ceiling, one file per area under `scripts/lint-ceilings/`, and
   fails above or below it, as PRD 942's guard does. The ceilings start at the counts on the feature
   branch when the linter lands, so the branch is green from its first slice. Each slice clears its
   folders and lowers its area's ceiling. The last slice deletes the ceilings: from then on,
   `pnpm lint` passes only with no finding at all.
4. **How findings are cleared:**
   - `no-non-null-assertion`: in source, `kit/lib/narrow.ts` gains `defined(value, what)` and
     `at(list, index, what)`, which throw a named error where `!` only claimed a value; in tests, one
     assertion helper (`asserts value is T`) that fails the test with a message.
   - `no-unsafe-*` and `no-explicit-any`: fixtures and fakes get their real types; `any` becomes
     `unknown` and is narrowed by a schema or a guard.
   - `require-await`: `async` goes where nothing is awaited; a function that must meet an async port
     returns `Promise.resolve(…)`, so its callers receive the same promise.
   - `no-unnecessary-condition`: a check is never deleted because the type says it cannot fail. When
     the value comes from outside and was not parsed, its type is widened or parsed; the check goes
     only when the type is proven.
   - `restrict-template-expressions`: `undefined`, `null`, `any` and `unknown` in a string get an
     explicit fallback or a typed value.
   - A real bug a rule reveals (a misused promise, an unawaited thenable, a switch missing a case) is
     an outbox item, fixed in the slice only when the fix changes no output.

## Decisions

Taken in the brainstorm on 2026-10-02 with the person who asked for this PRD.

- **One PRD for both.** The suite fix and the linter are independent, but the suite fix goes first
  so the lint waves run on a suite that holds under parallel load.
- **`strictTypeChecked`, tests linted the same as source, zero everywhere.** The person chose the
  strictest preset over the recommended one and over a curated bug-only set, and chose to clear
  every finding in this PRD rather than ratchet the rest across later ones.
- **Two tunings (approach A).** Numbers are allowed in template strings: 1,454 of the 2,173
  template findings are plain numbers, which print correctly. React's hooks rules run on the
  arcade, whose 11 `exhaustive-deps` findings were hidden by `eslint-disable` comments naming a
  plugin it did not have. Approach B (the preset untouched, about 10,250 findings, 1,450 of them
  `String(n)` rewrites) was rejected.
- **No `eslint-disable` at all.** `noInlineConfig` makes one inert, and the guard refuses one. Every
  finding is fixed in code.
- **A check is never deleted on the type's word alone** (`no-unnecessary-condition`).
- **No proof video:** nothing visible changes.
- **The voice.** Paul - Product Manager objected at the design that 8,800 fixes delay the features
  his team needs. The person approved the design as it was: settled `none`.

## User stories

1. As an agent, when I pass an async function where a callback's result is ignored, or print a value
   that may be `undefined`, `pnpm lint` tells me before any review does.
2. As an agent building a slice beside eight others, my preflight does not go red because the
   machine is busy.
3. As a reviewer, I see `lint` green beside `test`, `typecheck` and `fallow`, and know it means no
   finding at all, with nothing silenced.
4. As an agent reading code, a value is only claimed present when something proved it.

## Scope

In:

- The six kit test files that spawn the CLI, and `kit/test/test-timeouts.test.ts` where their
  budgets are policed.
- `eslint.config.ts`, the three development dependencies, `pnpm lint`, the `lint` job.
- `scripts/lint-ceilings/` while the build runs, and its deletion at the end.
- The guard's refusal of `eslint-disable`.
- `defined` and `at` in `kit/lib/narrow.ts`, and the test assertion helper.
- Every finding cleared, in source and tests, in every folder the linter reads.

Out:

- Stricter compiler flags (`exactOptionalPropertyTypes` and the rest), branded ids, Effect.
- Any behaviour change, beyond a named error thrown by `defined` or `at` on a path where `!` let
  `undefined` through to fail later.
- Formatting rules: the linter checks meaning, not layout.
- `supabase/database.types.ts` (generated) and `kit/dist/omni.mjs` (built).

## Test seams

The suite proves behaviour did not change; `pnpm lint` proves the findings are gone; the guard proves
nothing is silenced. Tests sit beside the code (`omni kb show testing`), on fixtures only.

- **The suite fix:** `kit/bin/ask-hook.test.ts` keeps every behaviour it proves today, each matrix
  case run in process; it passes while a second full `pnpm test` runs at the same time on the same
  machine.
- **`defined` and `at`:** a unit test each, with an input it accepts and one it refuses, the error
  naming what was missing.
- **The ceilings:** fixtures for an area above, below and at its ceiling, as in PRD 942.
- **The guard:** a fixture with an `eslint-disable` comment fails it, naming the line.
- **Every slice:** zero findings in its folders, `pnpm typecheck`, `pnpm test` with at least as many
  tests as before, `fallow audit` passing and `omni check all` green.

## Risks

`omni kb show releasing`: a merge to `main` publishes the kit's bundle and the plugin, and deploys
the arcade and the App.

- **`defined` or `at` throws where `!` did not.** Only on a path where the value was missing and the
  code would have failed later; the error now names what was missing. Rollback: revert the feature
  PR's merge.
- **A dropped `async` changes what a function returns.** A function that meets an async port keeps
  returning a promise (`Promise.resolve`); the suite pins the rest.
- **A React hooks fix changes when an effect runs.** Each `exhaustive-deps` finding is fixed so the
  effect runs on the same changes as before (a stable callback or a narrower dependency), and noted
  in its sub-PR.
- **The bundle.** Kit source changes reach `kit/dist/omni.mjs`; `kit/test/dist` pins it to a fresh
  build. Rollback: revert, and the release workflow republishes.
- **The ceilings are shared ground.** One file per area keeps slices of different areas apart; the
  plan never puts two slices of one area in the same wave.

No migration ships.

## Acceptance criteria

1. `kit/bin/ask-hook.test.ts` spawns no process inside a loop: each behaviour that needs a real
   process spawns at most once, and the file passes while a second full `pnpm test` runs on the same
   machine.
2. `pnpm lint` exists, lints every `.ts` and `.tsx` file git tracks (tests included) except
   `supabase/database.types.ts` and `kit/dist/`, with `strictTypeChecked`, numbers allowed in
   template strings, and React's hooks rules on `apps/galaxy`.
3. The `checks` workflow runs a `lint` job on every pull request, beside `test`, `typecheck` and
   `fallow`.
4. `pnpm lint` reports no finding, and `scripts/lint-ceilings/` no longer exists.
5. No file git tracks contains an `eslint-disable` comment; `eslint.config.ts` sets
   `noInlineConfig: true`; the guard fails on such a comment, naming the line.
6. `defined` and `at` exist in `kit/lib/narrow.ts`, each used and each with a test that accepts and
   one that refuses.
7. `pnpm typecheck`, `pnpm test` (at least as many tests as before), `fallow audit` and
   `omni check all` are green on the feature branch.

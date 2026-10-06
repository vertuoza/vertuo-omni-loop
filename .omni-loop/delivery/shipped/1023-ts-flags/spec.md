---
prd: 1023
title: The last strict compiler flags
blocked-by: none
spec: file
---

# The last strict compiler flags

**Date:** 2026-10-02 · **PRD:** #1023 · **Follows:** PRDs 725 (strict TypeScript), 942 (escape hatches)
and 976 (linting at zero) · **Touches:** `tsconfig.base.json`, and source and test files across
`kit/`, `game/`, `packages/`, `scripts/`, `apps/omni-app/` and `apps/galaxy/` where an error is fixed.
**Out of scope:** `noPropertyAccessFromIndexSignature`, branded ids, Effect, any behaviour change.

## Problem

`tsconfig.base.json` sets `strict` and `noUncheckedIndexedAccess`, and PRD 976 put the linter at zero.
Six compiler checks are still off. Measured on `main` on 2026-10-02, turning them on raises **231
errors** (137 in tests):

| Flag | Errors | What it catches |
|---|---|---|
| `exactOptionalPropertyTypes` | about 220 | an optional property set to `undefined` where "missing" was meant, and the reverse |
| `noUnusedParameters` | 7 | a parameter nothing reads |
| `noImplicitOverride` | 1 | a subclass method that shadows its parent's without saying so |
| `noImplicitReturns` | 1 | a code path that ends without returning |
| `noFallthroughCasesInSwitch` | 0 | a `case` that falls into the next |
| `noUnusedLocals` | 0 | a local nothing reads |

The errors sit across the repository: the arcade's dossiers (36), `packages/` (35), the kit's
commands (17), the arcade game (16), ask mode (15), the App's retro and inbox check (11 each), and
smaller groups elsewhere. This code reads config, front matter and GitHub, Supabase and model
answers, where "a key is missing" and "a key is `undefined`" are different facts that the types
today cannot tell apart.

## Solution

1. **`exactOptionalPropertyTypes`, fixed without changing what runs.** Where code passes `undefined`
   to an optional property today, the property's type is widened to `?: T | undefined`: the type
   now says what the code already does. Where an object is built to leave the process (a JSON body, a
   GitHub, Supabase or model payload, a value shaped by a schema) and the key's absence is what the
   other side reads, the key is omitted instead (`...(x === undefined ? {} : { k: x })`). Never a cast
   or a `// ts-allow:` to silence it.
2. **The small flags.** An unused parameter is removed, or prefixed `_` where the signature is a port
   others call; the missing `override` is written; the implicit return is made explicit.
3. **The flags on.** Once every area compiles with them, all six are set in `tsconfig.base.json`, so
   the root project and the arcade, which extends it, enforce them in `pnpm typecheck` and in CI.

## Decisions

Taken in the brainstorm on 2026-10-02 with the person who asked for this PRD.

- **Six flags, not seven.** `noPropertyAccessFromIndexSignature` stays off: 1,279 errors today, almost
  all about writing `obj['key']` rather than `obj.key`, which PRD 725 already rejected.
- **Widen by default, omit on the wire.** `?: T | undefined` changes no runtime value; omitting a key
  is kept for objects that leave the process, where absence is what the reader sees. The stricter
  option, omitting every key and never widening, was rejected: more edits, and small runtime
  differences (`'k' in obj`, `Object.keys`).
- **No new escape hatch:** the cast and `ts-allow` ceilings (PRD 942) and the linter at zero (PRD
  976) hold as they are.
- **No proof video:** nothing visible changes.
- **The voice.** Paul - Product Manager objected that this is another day of type plumbing while his
  team's features wait. The person approved the design as it was: settled `none`.

## User stories

1. As an agent reading a config or a GitHub answer, the type tells me whether a key can be missing,
   set to `undefined`, or both.
2. As an agent writing a subclass, the compiler stops me from shadowing a parent's method by accident.
3. As an agent, a parameter or a branch I left behind is an error, not dead code.

## Scope

In:

- Every error the six flags raise, fixed in source and tests, as the Solution says.
- The six flags in `tsconfig.base.json`.

Out:

- `noPropertyAccessFromIndexSignature`, branded ids, Effect.
- Any behaviour change. A bug a flag reveals is recorded as an outbox item and fixed in its own pull
  request later, unless the fix is needed for the types to hold and changes no output.

## Test seams

The compiler proves the types; the suite proves behaviour did not change. Tests sit beside the code
(`omni kb show testing`), on fixtures only. No slice writes new behaviour tests: its proof is the
compiler with the six flags, run on its folders, and the whole suite.

- **Each fixing slice:** `tsc` with the six flags reports no error in its folders (the root project
  with `-p .` and the flags on its command line, and `apps/galaxy` the same way).
- **The last slice:** `pnpm typecheck` with the flags set in `tsconfig.base.json`.
- **Every slice:** `pnpm test` with at least as many tests as before, `pnpm lint` at 0, `fallow audit`
  passing, the TypeScript guard green, and `omni check all` green.

## Risks

`omni kb show releasing`: a merge to `main` publishes the kit's bundle and the plugin, and deploys the
arcade and the App.

- **An omitted key changes what a reader sees.** Only on objects that leave the process, and only
  where the reader already treats a missing key and an `undefined` one alike or expects absence; each
  is named in its sub-PR. Rollback: revert the feature PR's merge.
- **The bundle.** Kit source changes reach `kit/dist/omni.mjs`; `kit/test/dist` pins it to a fresh
  build. Rollback: revert, and the release workflow republishes.

No migration ships.

## Acceptance criteria

1. `tsconfig.base.json` sets `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`,
   `noFallthroughCasesInSwitch`, `noUnusedLocals` and `noUnusedParameters`; it does not set
   `noPropertyAccessFromIndexSignature`.
2. `pnpm typecheck` passes, for the root project and the arcade.
3. No `// ts-allow:` line is added: every area's count in `scripts/typescript-ceilings.json` is at or
   below what it was on `main` when the PRD started.
4. `pnpm lint` reports no finding.
5. `pnpm test` (at least as many tests as before), `fallow audit` and `omni check all` are green.

---
prd: 725
title: Strict TypeScript across the kit, game and omni-app
blocked-by: none
spec: file
---

# Strict TypeScript across the kit, game and omni-app

**Date:** 2026-09-30 · **PRD:** #725 · **Touches:** every `.mjs` file outside `kit/dist/` and
`.omni-loop/bin/` (509 files, 234 of them tests, about 93 000 lines, plus one hand-written `.d.mts`): `kit/`, `game/`,
`apps/omni-app/`, `apps/galaxy/scripts/`, `packages/design/`, `packages/galaxy/`, `scripts/`,
`.claude/hooks/`, `vitest.config.mjs`; the root `package.json`, a new root `tsconfig.base.json` and
`tsconfig.json`, `apps/galaxy/tsconfig.json`, `.github/workflows/`, `apps/omni-app/vercel.json`.
**Out of scope:** Effect (PRDs B and C, decided after this one), any behaviour change, the bundle's
name and shape.

## Problem

About 510 files, the whole kit, the game, the GitHub App and two shared packages, are plain
JavaScript with no type checking at all. The arcade (`apps/galaxy`) is TypeScript, but CI never runs
`tsc` on it either: only Vercel's build does, after merge. So an agent editing `kit/lib/outbox/`
learns it passed the wrong shape only when a test happens to cover that path, and learns nothing
when none does. Data read from outside (config YAML, front matter, `gh` JSON, OpenRouter, env,
Supabase rows) is mostly trusted as it comes: only 38 files, across the kit, the game and the arcade, import
Zod.

Agents write most of this repository's code. The cheapest check they can get on every edit is a
compiler, and the repository gives them none.

## Solution

Every `.mjs` source and test file becomes strict TypeScript, in six waves the loop builds in
parallel:

1. **Toolchain.** One base config the whole repository shares, a `pnpm typecheck` that covers
   everything including the arcade, and a CI job that runs it on every pull request.
2. **One scripted rename.** A script renames every `.mjs` file to `.ts`, rewrites every import and
   every path that names one, and opens each file with `// @ts-nocheck`. No behaviour changes, and
   the suite proves it. It runs once every open feature branch touching `kit/`, `game/` or
   `apps/omni-app/` has merged or parked.
3. **Shared types first.** The domain types (PRD, slice, wave, outbox item, dossier, stage, config,
   fleet) and the Zod 4 schemas for outside data are written once, in the kit, before any folder is
   typed; the database's types are generated from the migrations.
4. **One folder at a time, many at once.** Each slice owns a set of folders, removes their
   `@ts-nocheck`, types them and their tests, and parses every outside read through a schema.
5. **The ratchet.** `allowJs` goes, and a guard test refuses what would bring the old state back.

`.ts` files outside the bundle run on Node itself (type stripping, Node ≥ 22.18): no build step and
no runner dependency. The bundle other repositories carry is still built by esbuild to
`kit/dist/omni.mjs` and installed as `.omni-loop/bin/omni.mjs`, unchanged.

## Decisions

Taken in the brainstorm on 2026-09-30, with the person who asked for this PRD.

- **Rename first, then type folder by folder.** Converting one folder at a time rewrites the imports
  of its users in other folders, so parallel slices would collide. One mechanical rename makes every
  later slice's territory its own folders only. JSDoc with `checkJs` was rejected: shared domain
  types in comments are awkward, agents write them poorly, and it would need a second migration.
- **Strictness:** `strict` and `noUncheckedIndexedAccess`. Not `exactOptionalPropertyTypes` nor
  `noPropertyAccessFromIndexSignature`.
- **Node runs `.ts` natively.** `erasableSyntaxOnly` and `verbatimModuleSyntax`: no `enum`, no
  `namespace`, no parameter properties; type-only imports are written `import type`. Imports name
  the `.ts` file (`allowImportingTsExtensions`, `module: nodenext`, `noEmit`). The Node engine
  becomes `>=22.18`. No `tsx`.
- **The freeze.** The rename (s2) starts only when no open feature branch touches `kit/`, `game/`,
  `apps/omni-app/` or `packages/`. The rename script stays in the repository and can be run again,
  so a branch opened late runs it after merging `main`.
- **Zod 4 at the boundaries, not Effect Schema.** If PRD B ends in a no-go, this PRD must still be
  whole. Each Effect slice later moves its own folders to Effect Schema.
- **One source per type.** A shape read from outside is a Zod schema in `kit/lib/schema/`, and its
  type is `z.infer` of it. A shape only built inside is a type in `kit/lib/types.ts`.
- **Tests are typed, with looser rules.** A test may cast a fixture with `as` freely. Source may use
  `any` or `as` only on a line that carries a `// ts-allow: <reason>` comment, which the ratchet
  reads. The allow-list lives on the lines themselves, not in one shared file, so parallel slices
  never edit the same file for it.
- **The arcade gets index checks too.** It already builds strict, but turning on
  `noUncheckedIndexedAccess` there raises about 1 180 errors across about 30 folders. It keeps the flag off
  until five arcade slices clear their folders, then the ratchet turns it on. On a fresh checkout the arcade
  also fails `tsc` until fumadocs generates its docs index, which only the build does today; the
  typecheck generates it first.
- **The database's types are generated,** by `supabase gen types --local` from the migrations, and
  committed as `supabase/database.types.ts`; CI fails when they drift. Each folder that opens a
  Supabase client types it with `Database` in its own slice.

## User stories

1. As an agent building a slice, I get a type error the moment I pass the wrong shape between two
   kit modules, before any test runs.
2. As an agent, I read a function's signature to know what it takes and returns, instead of reading
   its body and its callers.
3. As a person reviewing a pull request, I see `typecheck` green beside `test` and `fallow`, on the
   arcade too.
4. As a person running `omni` in another repository, I notice nothing: the same bundle, the same
   commands, the same output.
5. As an agent reading the config, a PRD's front matter, or a `gh` response, I get a named error
   that says which field is wrong, instead of an `undefined` three calls later.
6. As whoever writes the next migration, I see the arcade's and the App's queries fail to compile
   when a column they read changes.

## Scope

In:

- A root `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
  `verbatimModuleSyntax`, `module`/`moduleResolution: nodenext`, `allowImportingTsExtensions`,
  `noEmit`, `skipLibCheck`), a root `tsconfig.json` over everything outside `apps/galaxy`, and
  `apps/galaxy/tsconfig.json` extending the base.
- `@types/node` at the root; the root `engines.node` `>=22.18`.
- `pnpm typecheck`, running `tsc -p .` and `tsc -p apps/galaxy`; a `typecheck` job in
  `.github/workflows/checks.yml` beside `test` and `fallow`.
- Vitest including `*.test.ts` everywhere it includes `*.test.mjs` today.
- `scripts/ts-rename.mjs`, the one `.mjs` file that stays (so it can still run on a branch that was
  not converted), and the rename it performs, including `package.json` scripts, this repository's
  own `.omni-loop/bin/omni.mjs` shim onto the source (it stays `.mjs`, and imports the `.ts` entry), `kit/build`,
  `kit/release`, the workflows, `apps/omni-app/vercel.json`, the Claude hooks, and every test that
  names a `.mjs` path.
- `packages/design/src/personas.d.mts` replaced by the typed `personas.ts` it describes.
- `kit/lib/types.ts`, `kit/lib/schema/`, Zod 3 → 4 in every file that imports it (kit and arcade).
- The generated `Database` type, its script, its drift check in `.github/workflows/supabase.yml`,
  and every Supabase client (arcade, App, game) typed with it.
- The arcade's own code cleared for `noUncheckedIndexedAccess`, and the flag turned on there.
- Every folder typed and its `@ts-nocheck` removed; outside reads parsed through a schema.
- The ratchet: `allowJs` off; the arcade's index checks on; a guard test that reads the
  `// ts-allow:` comments.

Out:

- Effect, and any move from Zod to Effect Schema.
- Any behaviour change. A bug the types reveal is recorded as an outbox item and fixed in its own
  pull request later, not in the slice that found it, unless the fix is needed for the types to
  hold and changes no output.
- The bundle's file name, its install path, the skills, and the plugin.
- Lint rules beyond what `tsc` and the guard test enforce.
- Changing the arcade's `.tsx`/`.ts` code beyond what its index checks and the `Database` type need.

## Test seams

The suite proves behaviour did not change; the compiler proves the types. No slice writes new
behaviour tests, because no behaviour changes; each slice's proof is `pnpm typecheck` and
`pnpm test` green (`omni kb show testing`: tests beside the code, fixtures only, never GitHub or
Supabase).

- **s1:** a sample `*.test.ts` under `kit/` runs in `pnpm test`; `pnpm typecheck` checks the arcade.
- **s2:** the whole suite, unchanged in count; `kit/test/dist.test.*` (the bundle equals a fresh
  build) after `kit/dist/omni.mjs` is rebuilt, where only the path comments differ; a test that runs
  `scripts/ts-rename.mjs` twice on a fixture repository and sees the second run change nothing.
- **s3:** unit tests for each new schema, with a valid and an invalid input each; the invalid one
  names its field.
- **s5:** the drift check fails on a fixture where the committed type misses a column.
- **s29:** the guard test, on fixtures: a file with `@ts-nocheck`, a `.mjs` source file, and an
  `any` with no `// ts-allow:` comment each fail it; a line with one passes.

## Risks

`omni kb show releasing`: a merge to `main` ships the kit's bundle and the plugin, and deploys the
arcade and the App.

- **The App on Vercel.** `apps/omni-app/api/*.ts` import `.ts` kit files. s2 is not done until a
  preview deploy of the App builds and `/api/inngest` answers. Rollback: revert s2's merge.
- **The bundle.** esbuild reads `.ts`; the bundle's code must not change, only the file names in its
  comments. `kit/test/dist` pins it. Rollback: revert, and the release workflow republishes.
- **Branches open during the freeze.** They run `scripts/ts-rename.mjs` after merging `main`; git's
  rename detection carries their changes.
- **Width of wave 4.** About a dozen agents at once share the GitHub App's API budget with the
  collectors; `/omni:wave` may run it in two halves.
- **Types revealing bugs.** Recorded as outbox items, not fixed in place (see Scope), so a typing
  slice never changes behaviour.

Nothing here touches `supabase/migrations/`: no database change ships.

## Acceptance criteria

1. `pnpm typecheck` exists, checks the root project and `apps/galaxy`, and passes on `main`.
2. The `checks` workflow runs `typecheck` on every pull request, beside `test` and `fallow`.
3. No `.mjs` file exists outside `kit/dist/`, `.omni-loop/bin/` and `scripts/ts-rename.mjs`.
   (`.omni-loop/bin/omni.mjs` is this repository's shim onto the source, and stays.)
4. No file contains `@ts-nocheck`.
5. The root and arcade configs set `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` and
   `verbatimModuleSyntax` (the arcade's through the shared base); the root config has no
   `allowJs`.
6. `pnpm test` passes with at least as many tests as before the rename (s2).
7. `kit/dist/omni.mjs` rebuilt from the `.ts` sources behaves the same: its test suite passes, and
   `node kit/dist/omni.mjs config` in a fixture repository prints the same JSON as before.
8. `pnpm game:*` scripts and `node kit/release/release.ts` run on Node ≥ 22.18 with no runner.
9. The App's preview deployment builds, and `/api/github` and `/api/inngest` answer.
10. Every value read from a file, a process, the network or the environment passes through a schema
    in `kit/lib/schema/` (or a folder's own schema file) before use; an invalid value fails with an
    error naming its field.
11. Every Supabase client (arcade, App, game) is typed with the generated `Database` in
    `supabase/database.types.ts`, and CI fails when that file differs from what the migrations
    generate.
12. A guard test fails on `@ts-nocheck`, on a `.mjs` source file, and on `any` or `as` in source
    on a line without a `// ts-allow: <reason>` comment; an empty reason fails too.
13. Zod is at version 4 everywhere, and no package depends on Zod 3.

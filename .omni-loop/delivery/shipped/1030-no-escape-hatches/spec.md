---
prd: 1030
title: No escape hatches left
blocked-by: none
spec: file
---

# No escape hatches left

**Date:** 2026-10-03 · **PRD:** #1030 · **Follows:** PRDs 725 (strict TypeScript), 942 (escape
hatches and the ratchet), 976 (linting at zero) and 1023 (the last compiler flags) · **Touches:**
source under `apps/galaxy/`, `apps/omni-app/`, `kit/` and `packages/`, `scripts/typescript-guard.test.ts`,
`scripts/typescript-ceilings.json` (deleted), `packages/galaxy/package.json`, the `supabase` workflow,
and a new `scripts/schemas-verify.ts` · **Out of scope:** casts in tests, branded ids, Effect, any
change to the database.

## Problem

The compiler and the linter are now as strict as this repository will set them, but 154 lines of source
still tell the compiler "trust me" with an `as` cast or an `any`, each with a `// ts-allow: <reason>`
comment that the guard counts against a ceiling per area (`scripts/typescript-ceilings.json`):

| Area | Ceiling | Where most of them sit |
|---|---|---|
| `apps/galaxy` | 113 | the arcade game (21), business (19), data (15), dossier (14), jev (7) |
| `kit` | 19 | one or two per command or library module |
| `apps/omni-app` | 17 | the retro (12), the knowledge harvest (2) |
| `packages` | 5 | `packages/galaxy` |

Read by their reasons, they fall into four groups:

| Group | About | A reason as written |
|---|---|---|
| A Supabase row or rpc answer read as a type | 70 | "the select names CLAIM_COLUMNS, the columns of StoredClaim" |
| JSON from a route, GitHub, a model or a saved file read as a type | 30 | "the outbox API answers this shape, or nothing on a failed read" |
| A Phaser object read as the subclass the engine made | 25 | "the hero has an arcade body: physics.add made it" |
| A port or a fake cast to a client it only partly implements | 25 | "loadPeople reads only `from` and `rpc`" |

The first two groups are a cast on data that comes from outside the program: if the data is not what
the reason says, nothing notices, and the wrong value flows on until something far away breaks.

Two follow-ups from PRD 976 are in the same family:

- **s6-02.** `packages/galaxy/src/contract.test.ts` is meant to hold the hand-written
  `packages/galaxy/src/index.d.ts` in step with the sources, but TypeScript drops a `.d.ts` that sits
  beside its `.ts`, so `import type * as Contract from './index.d.ts'` resolves to `index.ts`: the test
  compares the code with itself. Made real, it shows that the declaration and the code already
  disagree on `experience`, `playerXp` and `borrowedXp` (declared over `LedgerEvent`, written over the
  game's `GameEvent`).
- **s19-01.** The retro removed its checks on values it wrote earlier in the same Inngest run and
  reads back from a saved step. Inngest returns a saved step as JSON; if a deploy changes what a step
  returns between the merge run and the day-14 run, nothing catches it.

## Solution

1. **Outside data is parsed where it comes in.** Every Supabase row or rpc answer, route or API JSON,
   GitHub or model answer, file read back (`retro.json`) and Inngest saved step that a `ts-allow` cast
   reads today is parsed with a **zod** schema (the library 116 source files already use). The
   module's type is derived from its schema (`z.infer`), so the two cannot drift. Schemas are
   **strict**: a column that comes back as text where a number is declared fails, as does a missing
   or renamed column or a `null` the type does not allow. Where the code already converts on purpose
   (`numberOf`, `textOf` in `apps/galaxy/src/data/unparsed.ts`), the schema says so explicitly
   (`z.coerce.number()`), and nowhere else.
2. **One failure path, the one each module already has.** A shared `parseRows(schema, answer, where)`
   (and its single-value form) turns a failed parse into the module's existing failed read: `[]` or
   `null` where it answers that on an error today, `{ ok: false }` where it returns a result, a thrown
   error where an Inngest step retries. It logs the failure once, naming the module, the table or route
   and the zod issue path, **never a row's values**, because rows can hold personal data. No new UI.
3. **The game engine.** One helper module in the arcade, `apps/galaxy/src/arcade/phaser-narrow.ts`,
   gives each Phaser object its real type with `instanceof` or a check that throws (`bodyOf(sprite)`,
   `spriteOf(child)`, `tileOf(x)`, `layerOf(maybe)`). The engine makes the guarantee, so the helpers
   never fire in practice; the compiler now checks it instead of taking a comment's word.
4. **Ports, not casts.** A store or loader that calls two methods of the Supabase client declares the
   narrow port it calls as an interface; the real client and the test fakes both satisfy it
   structurally, so neither needs a cast. Where TypeScript cannot correlate a handler map with its
   key (`HANDLERS`), the map is typed with a mapped type over the action union.
5. **s6-02: the package publishes its own source as its types.** `packages/galaxy/package.json`'s
   `exports["."].types` points at `./src/index.ts`; the hand-written `index.d.ts` and
   `contract.test.ts` are deleted, and `experience`, `playerXp` and `borrowedXp` keep the signatures
   their sources have, with every caller in `apps/galaxy` fixed to pass what those signatures take.
6. **s19-01: the retro parses what it reads back.** Each value the retro reads from a saved Inngest
   step, from `retro.json` or from GitHub is parsed with its schema at the point it is read; the
   checks PRD 976 dropped come back as parses, not as widened types.
7. **The mechanism goes.** Once every area is at 0, `scripts/typescript-ceilings.json` and the
   `ts-allow` rule are deleted: the guard (`scripts/typescript-guard.test.ts`) refuses any `as` cast,
   angle-bracket cast or `any` in source, with no comment that lets one through. Its fixtures are
   rewritten to prove that, and that `as const`, import and export aliases, non-null assertions and
   tests stay allowed, as today. The rule is written into ADR 0054 (TypeScript) as a new section.

### The safety net

Strict schemas fail loudly, so this PRD proves, before it ships, that they accept every value the
program really meets:

1. **Each schema has its tests,** beside its module: it parses the module's existing fixtures, and
   refuses a copy with a missing column, a wrong type and a forbidden `null`. Every module that loses
   a cast keeps its current tests green with no change to what they expect.
2. **`scripts/schemas-verify.ts`**, run as `pnpm schemas:verify`, runs every boundary's own read (the
   module's real select or rpc, through its port) against a Supabase database and parses the answer
   with the module's schema, printing each mismatch with its module and zod path, and exiting 1 on
   any. It only reads. It is a script, not a test, so `pnpm test` keeps calling neither GitHub nor
   Supabase (`omni kb show testing`, **Never**).
   - **`--local`**, against the database the `supabase` workflow starts from the migrations and the
     demo seed: a new step of that workflow's pull-request job, whose path trigger is widened to the
     schema files and the script, so a change to a schema or a migration always runs it. Each read
     the seed leaves empty is named, so a boundary with no seeded row is visible, not silently
     passed.
   - **`--production`**, with the service role, read-only: run once by the finish, before the feature
     PR is marked ready, and its output recorded in the PR's **Verified**. It catches real rows the
     seed does not have.
3. **JSON from GitHub, routes and the model** is parsed in tests from recorded real answers: the
   fixtures the tests already keep, and one added where a boundary has none.
4. **Inngest saved steps:** each step's return value is passed through
   `JSON.parse(JSON.stringify(value))`, which is what Inngest does when it memoises a step, then parsed
   with its schema, in a test.
5. **The screens:** `pnpm galaxy:shots`, the Playwright walk through every arcade scene and `/app` in
   each theme, runs once at the finish against `pnpm galaxy:dev` and must finish with no page error.

## Decisions

Taken in the brainstorm on 2026-10-03 with the person who asked for this PRD.

- **Strict zod schemas at every boundary, failing through the module's existing error path.** Rejected:
  the typed `SupabaseClient<Database>` alone (no runtime check, a renamed column unnoticed until used),
  and parse-then-log-and-skip (bad data unnoticed).
- **Remove `ts-allow` entirely** rather than keep the mechanism with every ceiling at 0: nothing left
  to count, one simple rule.
- **s6-02: the code publishes its own types,** rather than renaming `index.d.ts` to make the contract
  test real: one description, nothing to drift.
- **s19-01: parse each saved step with zod,** rather than restoring the 30 widened-type checks: the
  same rule as the database rows.
- **The safety net is part of the PRD** (the person: "strict but you need to put the proper test or E2E
  to be 100% sure you do not break anything"), with the read-only production dry run.
- **The live-database check is a script, not a vitest suite,** so `pnpm test` keeps its rule of
  calling neither GitHub nor Supabase; one script serves the local database in CI and the production
  dry run.
- **Tests keep casting freely:** about 2,000 casts in 522 test files are a PRD of their own.
- **No proof video:** nothing visible changes.
- **The voice.** Irisa objected that failing loudly could show her customers an error for a type they
  never cared about. Settled `accepted`: the schemas stay strict, and the safety net above was added to
  prove before shipping that no real value fails.

## User stories

1. As someone using the arcade or `/app`, every page I use today shows the same thing after this ships.
2. As an agent changing a table, a route or a step, a value that no longer matches its type fails at the
   boundary, naming the module and the field, instead of flowing on as the wrong type.
3. As an agent writing source, the compiler is never told to trust me: there is no comment that lets an
   `as` or an `any` through.
4. As the person reviewing the feature PR, I can read in **Verified** that every boundary parsed the
   local database and production's real rows.

## Scope

In:

- All 154 `ts-allow` lines in source, removed as the Solution says, each area's ceiling lowered by the
  slice that clears it.
- The zod schemas, `parseRows`, the Phaser helpers and the narrow ports.
- s6-02 and s19-01, as the Solution says.
- `scripts/schemas-verify.ts`, its `pnpm schemas:verify` script, and its step in the `supabase` workflow.
- Deleting `scripts/typescript-ceilings.json`, the `ts-allow` rule and `packages/galaxy`'s
  `index.d.ts` and `contract.test.ts`; the guard's new fixtures; the ADR 0054 section.

Out:

- Casts and `any` in tests.
- Branded ids, Effect.
- Any migration, any change to a table, a route's answer or a step's return value.
- `supabase/database.types.ts`, which is generated and stays as it is.

## Test seams

- **Schemas:** unit tests beside each module, valid and invalid inputs (a missing column, a wrong
  type, a forbidden `null`), from the module's existing fixtures.
- **`parseRows`:** a unit test per failure form (`[]`, `null`, `{ ok: false }`, a throw), and that the
  log names the module, the table or route and the zod path, and holds no row value.
- **The Phaser helpers:** unit tests on stand-in objects, the right class passing and the wrong one
  throwing.
- **The modules that lose a cast:** their current tests stay green with no change to what they expect.
- **The retro:** each saved step round-trips through JSON and parses.
- **`packages/galaxy`:** `pnpm typecheck` checks the arcade against the package's sources.
- **The guard:** fixtures for an `as`, an `any` and an angle-bracket cast refused with or without a
  trailing comment, and for what stays allowed.
- **Outside `pnpm test`:** `pnpm schemas:verify --local` in CI, `--production` once at the finish, and
  `pnpm galaxy:shots` once at the finish.

## Risks

A merge to `main` deploys the arcade and the App with the new parsing. A schema stricter than a real
value would turn a page's read into its failed read (an empty list, a missing panel) for every row of
that shape. The production dry run is there to find that before merge. No migration runs: this PRD
changes no table, and the `supabase` workflow's `deploy` job only runs on migrations. The kit's bundle
(`kit/dist/omni.mjs`) changes where kit source changes, with no change to what a command prints.

**Rollback:** revert the feature PR, which brings the casts back. A single schema that fails on real
data can instead be loosened in a one-line fix.

## Acceptance criteria

- `git grep -n 'ts-allow'` finds nothing in source, `scripts/typescript-ceilings.json` does not exist,
  and the guard refuses an `as` or an `any` in a source fixture even with a trailing comment.
- `pnpm typecheck`, `pnpm test`, `pnpm lint` (0 findings) and the fallow audit pass.
- `pnpm schemas:verify --local` passes in the `supabase` workflow on the feature PR, naming any read the
  seed leaves empty.
- `pnpm schemas:verify --production` passes once before the feature PR is marked ready, and its
  output is in the PR's **Verified**.
- `pnpm galaxy:shots` finishes with no page error.
- Every schema has a test that refuses a missing column, a wrong type and a forbidden `null`.
- `packages/galaxy` has no `index.d.ts` and no `contract.test.ts`, its `exports` types point at
  `./src/index.ts`, and the arcade typechecks against it.
- Each retro value read back from a saved step, `retro.json` or GitHub is parsed, with a test that
  round-trips it through JSON.
- A failed parse logs the module, the table or route and the zod path, and no row value.

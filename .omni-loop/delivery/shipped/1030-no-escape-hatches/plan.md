# Plan: No escape hatches left

PRD #1030, specified in `spec.md` beside this plan. Built on the feature branch `feat/no-escape-hatches`
into `main` (the feature PR says `Closes #1030`), from sub-PRs on `feat/no-escape-hatches--<slice>` into
the feature branch (each says `Part of #1030`).

**Two conventions the slices share, set by s1:**

- **The ratchet tolerates going down during this PRD.** s1 changes the guard so an area's count of
  `ts-allow` lines fails only above its ceiling, no longer below it. The clearing slices then never
  edit `scripts/typescript-ceilings.json`, which would otherwise be one line every slice rewrites;
  s9 deletes the file and the rule.
- **A boundary registers itself beside its module.** `scripts/schemas-verify.ts` finds every tracked
  file named `*.boundary.ts` and runs the `boundaries` it exports: each a name, the module's own read
  through its port, and the schema that parses the answer. A slice adds its own boundary files in its
  own territory, so no registry file is shared.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The groundwork: `parseRows` and its failure forms, the Phaser checking helpers, `pnpm schemas:verify` with `--local` and `--production` and its step in the `supabase` workflow, and the ratchet that tolerates going down | `apps/galaxy/src/data/parse-rows` `apps/galaxy/src/arcade/phaser-narrow` `scripts/schemas-verify` `scripts/typescript-guard.test.ts` `package.json` `.github/workflows/supabase.yml` | — | 1 |
| s2 | The arcade app's data, dashboard, profile, stages, repositories, constituents, releases, agent-connect and sign-up read outside data through schemas and ports, with no `ts-allow` | `apps/galaxy/src/data/` `apps/galaxy/src/dashboard/` `apps/galaxy/src/profile/` `apps/galaxy/src/stages/` `apps/galaxy/src/repositories/` `apps/galaxy/src/constituents/` `apps/galaxy/src/releases/` `apps/galaxy/src/agent-connect/` `apps/galaxy/src/signup/` `apps/galaxy/app/auth/` `apps/galaxy/app/signup/` | s1 | 2 |
| s3 | The business pages read claims, personas, drafts and suggestions through schemas and ports, with no `ts-allow` | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s1 | 2 |
| s4 | The dossier, ask, outbox-waiting, waiting, nav and knowledge modules read outside data through schemas and ports, with no `ts-allow` | `apps/galaxy/src/dossier/` `apps/galaxy/src/ask/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/src/waiting/` `apps/galaxy/src/nav/` `apps/galaxy/src/knowledge/` | s1 | 2 |
| s5 | The arcade game, the home and JEV narrow Phaser objects with the checking helpers and parse their JSON columns, with no `ts-allow` | `apps/galaxy/src/arcade/` `apps/galaxy/src/home/` `apps/galaxy/src/jev/` | s1 | 2 |
| s6 | The App's retro parses every value it reads back from a saved step, `retro.json` or GitHub (s19-01), and the rest of `apps/omni-app` has no `ts-allow` | `apps/omni-app/src/` | s1 | 2 |
| s7 | The kit's commands and libraries parse what they read, with no `ts-allow`, and the bundle is rebuilt | `kit/` `.omni-loop/bin/` | s1 | 2 |
| s8 | `packages/galaxy` publishes its own source as its types (s6-02): `index.d.ts` and `contract.test.ts` deleted, and no `ts-allow` in `packages/` | `packages/` | s1 | 2 |
| s9 | The mechanism goes: `scripts/typescript-ceilings.json` and the `ts-allow` rule deleted, the guard refuses any `as` or `any` in source, and ADR 0054 says so | `scripts/typescript-guard.test.ts` `scripts/typescript-ceilings.json` `.omni-loop/knowledge/adr/0054-` | s2, s3, s4, s5, s6, s7, s8 | 3 |

**Shared ground.**

- `apps/galaxy/src/data/parse-rows*` sits inside s2's `apps/galaxy/src/data/`, and
  `apps/galaxy/src/arcade/phaser-narrow*` inside s5's `apps/galaxy/src/arcade/`: s1 is wave 1, s2 and
  s5 wave 2. Wave-2 slices import both helpers and never edit them; a helper that must change is
  changed in the slice that owns its folder (s2 or s5) and named in that sub-PR.
- `scripts/typescript-guard.test.ts` is s1's (wave 1) and s9's (wave 3).
- `apps/galaxy/src/data/unparsed.ts` is s2's. Other slices may import it; only s2 changes it.
- The wave-2 slices each add `*.boundary.ts` files inside their own folders, and edit no shared
  registry (the convention above).
- s8 changes what `apps/galaxy` typechecks against. No file of `apps/galaxy` calls `experience`,
  `playerXp` or `borrowedXp`; if pointing the types at the source raises an error in `apps/galaxy`,
  s8 records it as an outbox item instead of editing another slice's folder.
- s7 rebuilds `kit/dist/omni.mjs` and `.omni-loop/bin/omni.mjs`; no other slice touches the kit.

## Per slice: done when

**s1**

- `parseRows(schema, answer, where)` and its single-value form exist, with unit tests for each
  failure form (`[]`, `null`, `{ ok: false }`, a throw), and that the log names `where` and the zod
  issue path and holds no row value.
- `apps/galaxy/src/arcade/phaser-narrow.ts` gives `bodyOf`, `spriteOf`, `tileOf` and `layerOf`, each
  tested to pass the right class and throw on the wrong one.
- `pnpm schemas:verify --local` runs every `*.boundary.ts` against the local database, names each read
  the seed leaves empty, and exits 1 on any mismatch; tested on a fixture boundary that passes and one
  that fails. `--production` reads with the service role and writes nothing.
- The `supabase` workflow's pull-request job runs `pnpm schemas:verify --local` after the database
  starts, and its path trigger includes `**/*.boundary.ts`, `scripts/schemas-verify.ts` and every
  schema file.
- The guard's ratchet fails an area above its ceiling and passes it at or below; its fixtures prove
  both.

**s2, s3, s4, s5, s6, s7, s8 (each in its own territory)**

- `git grep -n 'ts-allow' -- <territory>` finds nothing in source.
- Every Supabase row or rpc answer is parsed with a strict zod schema, the module's type is
  `z.infer` of it, and the module has a `*.boundary.ts` registering its reads; route, GitHub, model and
  file JSON is parsed too.
- Each new schema has a test that parses the module's existing fixture and refuses a missing column,
  a wrong type and a forbidden `null`.
- The module's existing tests pass with no change to what they expect.
- A narrow port replaces each cast of a fake or a partial client.
- `pnpm typecheck`, `pnpm test` and `pnpm lint` (0 findings) pass.

**s5 also**

- Every Phaser cast goes through `phaser-narrow.ts`.

**s6 also (s19-01)**

- Every value read back from a saved Inngest step, `retro.json` or GitHub is parsed, with a test that
  round-trips each saved step's return value through `JSON.parse(JSON.stringify(…))` and parses it.

**s7 also**

- `kit/dist/omni.mjs` and `.omni-loop/bin/omni.mjs` are rebuilt, and no command prints anything
  different.

**s8 also (s6-02)**

- `packages/galaxy/package.json`'s `exports["."].types` is `./src/index.ts`; `src/index.d.ts` and
  `src/contract.test.ts` are gone; `pnpm typecheck` passes for the root project and the arcade.

**s9**

- `scripts/typescript-ceilings.json` does not exist, and the guard has no `ts-allow` rule.
- The guard's fixtures refuse an `as`, an angle-bracket cast and an `any` in source, with or without a
  trailing comment, and allow `as const`, import and export aliases, non-null assertions and tests.
- `git grep -n 'ts-allow'` finds nothing in source.
- ADR 0054 has a section saying that source holds no `as` cast and no `any`, and that outside data is
  parsed at the boundary with zod.

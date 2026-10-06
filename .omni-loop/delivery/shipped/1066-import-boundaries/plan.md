# Plan: Import boundaries

PRD #1066, specified in `spec.md` beside this plan. Built on the feature branch `feat/import-boundaries`
into `main` (the feature PR says `Closes #1066`), from sub-PRs on `feat/import-boundaries--<slice>` into the
feature branch (each says `Part of #1066`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The arcade keeps its side of the table: no source file imports `kit/test` (the three move under a `test/` folder, or the helper they need moves into `kit/lib`), and every source file importing a Node built-in or the server environment module carries `import 'server-only'` | `apps/galaxy/` | — | 1 |
| s2 | The kit, the game and the design package keep theirs: `board-cache.ts` takes the command line's path from `kit/bin`, so `fallow --circular-deps` finds no cycle; `packages/design` declares the kit and imports it by package name; the game's boundary comments name `ids` and `env`; the bundle is rebuilt | `kit/` `game/` `packages/design/` `pnpm-lock.yaml` `.omni-loop/bin/` | — | 1 |
| s3 | `scripts/import-guard.test.ts` enforces the rule table, the test allowance, the client and server rule (with the import chain) and zero cycles on every source file, with fixtures for each rule and no escape; a decision record and the `architecture` form carry the table | `scripts/` `kit/` `game/` `apps/` `packages/` `.omni-loop/knowledge/` | s1, s2 | 2 |

**Shared ground.** s1 and s2 share nothing, so they run together. s3 owns `scripts/` and the knowledge
folder, and also every package, because the guard may find a leftover anywhere; it is wave 2, alone. If
s1 moves a helper into `kit/lib` (s2's ground), it says so in its sub-PR: the waves keep them apart only
by file, so s1 adds a new file there and edits none of s2's.

## Per slice: done when

**s1**

- No file under `apps/galaxy/` that is not a test file imports `kit/test`: `src/arcade/sure.ts`,
  `src/arcade/twins.fake.ts` and `src/ask/test-item.ts` move under a `test/` folder (their importers
  follow), or the helper they need becomes a new `kit/lib` module, recorded as a decision.
- Every `apps/galaxy` source file that imports a `node:` built-in or `src/env.ts` imports `server-only`;
  `src/env.client.ts` stays client-safe.
- The arcade's `next build` passes; `pnpm schemas:verify --local` still strips `server-only` under plain
  node if it runs; the full suite, both typechecks and lint on the changed files pass.

**s2**

- `kit/lib/statusline/board-cache.ts` names nothing in `kit/bin`: the command line's path comes in from
  its caller; `fallow dead-code --circular-deps` reports no cycle.
- `packages/design/package.json` declares `vertuo-omni-plan`, and its imports of the kit use the package
  name; the lockfile follows with pnpm 9.
- The comments in `game/sources/parsers.ts` and `game/dossiers/folders.ts` say the game imports the kit's
  `ids` and `env` only.
- The bundle is rebuilt and its dist test passes; the full suite, both typechecks and lint pass.

**s3**

- `scripts/import-guard.test.ts` reads every tracked source file's imports (static, dynamic with a literal,
  `export … from`, type-only included) from the syntax tree, resolves relative, `vertuo-omni-plan/…` and
  `@omni/*` spellings to the spec's zones, and fails on every import the table forbids, naming file, line
  and rule; test files may also import `kit/test` and `kit/bin`.
- It fails when a client-reachable arcade module (a `'use client'` file or anything it imports,
  transitively) reaches a `server-only` module, printing the chain, and when an arcade source file imports
  a `node:` built-in or `src/env.ts` without `server-only`.
- It runs fallow's circular-dependency check and fails on any cycle.
- Fixtures cover every rule, the three spellings, a type-only import and the client chain; the whole tree
  passes; no allowlist, no comment escape. Any leftover it finds is fixed in code.
- A decision record under `.omni-loop/knowledge/adr/`, and `omni kb show architecture` prints the table.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and
  `omni check all` pass.

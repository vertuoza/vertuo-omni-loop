---
prd: 1066
title: Import boundaries
blocked-by: none
spec: file
---

# Import boundaries

**Date:** 2026-10-04 · **PRD:** #1066 · **Follows:** PRDs 1030 (no escape hatches), 1049 (branded IDs) and
1059 (parsed environment) · **Touches:** a new `scripts/import-guard.test.ts`, three arcade files that
import the kit's test fixtures, the arcade files missing `server-only`, `kit/lib/statusline/board-cache.ts`,
`packages/design`'s manifest, the game's boundary comments, a decision record and the `architecture` form
· **Out of scope:** an `exports` map, moving code between packages beyond the breaches, any behaviour.

## Problem

AI agents build this repository, and an import that compiles is an import they keep. Nothing enforces the
architecture's layers. Its rules live in comments and decision records: "the kit imports nothing from the
game" (ADR-0002), "the App imports nothing from the arcade" (`apps/omni-app/src/boundary.ts`), "the game
never imports the kit but for its ID brands", "a lower layer never imports a higher one". Measured on
`main` on 2026-10-04, the code mostly keeps them by habit, and breaks them where nothing looked:

- three arcade **source** files import the kit's test fixtures (`kit/test`): `src/arcade/sure.ts`,
  `src/arcade/twins.fake.ts`, `src/ask/test-item.ts`;
- the game imports `kit/lib/env` in three files, against its own "only ID brands" comment;
- `packages/design` imports the kit by a relative path without declaring it as a dependency;
- sixteen arcade files use Node built-ins or secrets without `import 'server-only'`, the marker that
  stops a client import at build (`src/env.ts`, `src/jev/secret-box.ts`, `src/signup/github-app.ts`…);
- `kit/lib/statusline/board-cache.ts` names `../../bin/omni.ts` by path: the library reaching up to the
  CLI, which fallow reports as two import cycles.

The root package has no `exports` map, so any deep path resolves, the kit's test fixtures included.

## Solution

1. **Zones,** from where a file sits: `kit/lib`, `kit/bin`, `kit/test`, the kit's build scripts
   (`kit/build.ts`, `kit/release/`), `game`, `scripts`, `apps/galaxy`, `apps/omni-app`, `packages/design`,
   `packages/galaxy`, and the generated `supabase` types.
2. **One rule table,** what a source file may import beyond its own zone, Node built-ins and npm packages:

   | zone | may import | never |
   |---|---|---|
   | `kit/lib` | nothing else | `kit/bin`, `kit/test`, the game, the apps, the packages |
   | `kit/bin` | `kit/lib` | `kit/test`, the game, the apps |
   | the kit's build scripts | `kit/lib`, `kit/bin` | the game, the apps |
   | `game` | `kit/lib/ids`, `kit/lib/env` | the rest of the kit, the apps, the packages |
   | `packages/galaxy` | `game`, `@omni/design`, `kit/lib/ids` | the apps |
   | `packages/design` | `kit/lib`, declared as a dependency, by package name | the apps, the game |
   | `apps/omni-app` | `kit/lib`, `@omni/design`, the `supabase` types | `apps/galaxy`, `kit/bin`, `kit/test`, the game |
   | `apps/galaxy` | `kit/lib`, `@omni/*`, `game` (the rulebook it shows), the `supabase` types, the root `package.json` (its version) | `apps/omni-app`, `kit/bin`, `kit/test` |
   | `scripts` | anything: repository tools | — |

   A test file may also import `kit/test` and `kit/bin` (fixtures, driving the command line); every
   "never" else holds for tests too. A type-only import counts: it couples the layers all the same.
3. **The arcade's client and server.** A module the client can reach (a `'use client'` file, and whatever
   it imports, transitively) never reaches a module marked `server-only`; the refusal shows the import
   chain. An arcade source file that imports a Node built-in or the server environment module carries
   `import 'server-only'`.
4. **No import cycle:** `fallow --circular-deps` on the whole tree finds none.
5. **The guard,** `scripts/import-guard.test.ts`, like the other source guards: it reads every source
   file's imports from the TypeScript syntax tree, resolves the three spellings this repository uses
   (relative, `vertuo-omni-plan/…`, `@omni/*`) to a zone, and checks the table, the client rule and the
   cycle count. No allowlist, no comment escape. It runs in `pnpm test`, so `pnpm check:changed` meets it.
6. **The breaches are fixed in code:** the three arcade files move under a `test/` folder, or the helper
   they need moves into `kit/lib`; the sixteen files get `server-only`; `board-cache.ts` takes the
   command line's path from `kit/bin`; `packages/design` declares the kit; the game's comments name `ids`
   and `env`.
7. **Agents are told:** a decision record, and the `architecture` form's rules section rewritten from the
   table.

## Decisions

Taken in the brainstorm on 2026-10-04 with the person who asked for this PRD.

- **The kit's public surface is `kit/lib`:** apps, packages, the game and scripts may import `kit/lib`,
  never `kit/bin` or `kit/test` from source. Over an `exports` map (every new shared module would need a
  manifest line) and a curated module list.
- **A guard test,** over fallow's boundaries (its audit grades changed files against baselines) and an
  ESLint plugin (a new dependency inside the slowest check). Cycles use fallow's existing check.
- **Codify today's structure,** fixing its few breaches, rather than redesign it.
- **The game may import `kit/lib/env`** (PRD 1059 put its environment there); its comments say so.
- **The voice.** F-E Developer objected that the client rule follows imports transitively, so one shared
  helper that gains a server import breaks a dozen client files at once, and wanted the error to show the
  import chain. Settled `accepted`: the refusal names the chain.
- **No proof video:** nothing visible changes.

## User stories

1. As an agent, when I import the kit's test fixtures from an app's source, or the arcade from the GitHub
   App, the tests refuse it within seconds and name the rule.
2. As an agent, when a client component reaches server-only code through a helper, the refusal shows me
   the chain from the component to the server module.
3. As an agent adding a server module to the arcade, the guard tells me to mark it `server-only`.
4. As a reviewer, the architecture's rules are one table in the playbook that the tests enforce, not
   comments scattered across files.

## Scope

In:

- `scripts/import-guard.test.ts`, its fixtures, and the cycle gate.
- The breaches listed above, fixed in code.
- A decision record and the `architecture` form.

Out:

- An `exports` map, or narrowing which `kit/lib` modules are public.
- Moving code between packages beyond the breaches.
- Any change to behaviour or output.

## Test seams

- **Fixtures, in memory, per rule:** `kit/lib` importing `kit/bin`, `kit/test` or the game is refused;
  the game importing `kit/lib/config` is refused, `kit/lib/ids` and `kit/lib/env` pass; the GitHub App
  importing the arcade is refused; an app's source importing `kit/test` is refused, the same import from a
  test file passes; a `'use client'` file reaching a `server-only` module two imports away is refused with
  the chain; an arcade file importing `node:fs` without `server-only` is refused.
- **Spellings:** a relative path, `vertuo-omni-plan/kit/lib/x.ts` and `@omni/design` each resolve to the
  right zone; a type-only import is checked like any other.
- **The whole tree:** the guard finds nothing; `fallow --circular-deps` finds no cycle.
- **Nothing breaks:** the full suite, both typechecks, lint (0 findings), the fallow audit, the arcade's
  `next build` (the `server-only` markers break no client import) and the kit's dist test pass.

## Risks

Merging rebuilds the kit's bundle (its behaviour does not change) and deploys the arcade with sixteen
more `server-only` markers: a client import of one of them would now fail the build, which `next build`
checks before merge. Nothing is stored and no migration runs.

**Rollback:** revert the feature PR. The guard can also be reverted alone.

## Acceptance criteria

- `scripts/import-guard.test.ts` refuses every import the rule table forbids, from source and from tests
  as the table says, naming the file, the line and the rule; it has no allowlist and no comment escape.
- A client-reachable arcade module that reaches a `server-only` module is refused with the import chain;
  an arcade source file importing a Node built-in or the server environment module without `server-only`
  is refused.
- `fallow --circular-deps` finds no cycle, and the guard checks it.
- The guard passes on the whole tree: no arcade source file imports `kit/test`, `kit/lib` names nothing in
  `kit/bin`, `packages/design` declares the kit.
- `omni kb show architecture` prints the rule table.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and the
  arcade's `next build` pass.

# ADR-0058 — Each zone imports only what the rule table allows, checked by the import guard

**Status:** accepted · **Date:** 2026-10-04 · **PRD:** #1066

## Context

AI agents build this repository, and an import that compiles is an import they keep. The layers'
rules lived in comments and decision records ("the kit imports nothing from the game", "the App
imports nothing from the arcade", "the game imports the kit only for its ID brands"), and nothing
enforced them. Measured on 2026-10-04, the code kept them by habit and broke them where nothing
looked: arcade source importing the kit's test fixtures, Node-only arcade modules without
`server-only`, the design package importing the kit undeclared, the kit's library reaching up to its
command line (two import cycles). The root package has no `exports` map, so any deep path resolves.
PRD 1066 fixed the breaches and wrote the rules down as one table that a test enforces.

## Decision

1. **Zones,** from where a file sits: `kit/lib`, `kit/bin`, `kit/test`, the kit's build scripts
   (`kit/build.ts`, `kit/release/`), `game`, `scripts`, `apps/galaxy`, `apps/omni-app`,
   `packages/design`, `packages/galaxy`, the generated `supabase` types, the root manifest, and the
   repository's config (`eslint.config.ts`, `vitest.config.ts`, `.claude/`).
2. **The rule table:** what a file may import beyond its own zone, Node built-ins and npm packages.
   Anything not listed is refused.

   | zone | may import |
   |---|---|
   | `kit/lib` | nothing else |
   | `kit/bin` | `kit/lib` |
   | the kit's build scripts | `kit/lib`, `kit/bin` |
   | `kit/test` | `kit/lib`, `kit/bin` |
   | `game` | `kit/lib/ids`, `kit/lib/env`, the `supabase` types |
   | `packages/galaxy` | `game`, `@omni/design`, `kit/lib/ids` |
   | `packages/design` | `kit/lib`, by package name |
   | `apps/omni-app` | `kit/lib`, `@omni/design`, the `supabase` types |
   | `apps/galaxy` | `kit/lib`, `@omni/*`, `game`, the `supabase` types, the root `package.json` |
   | `scripts`, the repository's config | anything |

   A test (`*.test.ts`, or a file in a `test/` folder) may also import `kit/test` and `kit/bin`; every
   other rule holds for tests too. A type-only import counts: it couples the layers all the same. An
   import by package name (`vertuo-omni-plan/…`, `@omni/*`) names a package the importing package
   declares. The `kit/test`, config and `game`-to-`supabase` rows are beyond PRD 1066's spec (items
   s3-01 and s3-03).
3. **The kit's public surface is `kit/lib`:** apps, packages, the game and scripts import `kit/lib`,
   never `kit/bin` or `kit/test` from source. No `exports` map.
4. **The arcade's client and server.** A module the client can reach (a `'use client'` file and every
   runtime import it makes, transitively, across the repository) never reaches a module marked
   `import 'server-only'`; the refusal prints the chain from the client file to the server module. A
   type-only import is erased and is not followed; a `'use server'` module is a server action the client
   calls by reference, and is not followed. An import whose names are all inline `type` specifiers is
   followed: under `verbatimModuleSyntax` it stays as an import. An arcade source file that imports a
   Node built-in or `apps/galaxy/src/env.ts` (a value, not only a type) carries `import 'server-only'`,
   except the files run under plain Node at build time, each a named rule with its reason (settled item
   s1-01): `apps/galaxy/scripts/`, `next.config.ts`, `artifact/build.ts` and `src/docs/diagrams.ts`.
5. **No import cycle:** `fallow dead-code --circular-deps` on the whole tree finds none.
6. **The guard,** `scripts/import-guard.test.ts`, reads every tracked TypeScript file's imports from its
   syntax tree (static, `export … from`, dynamic `import('literal')`, `import x = require(…)`, and a
   type's `import('…')`), resolves a relative path, `vertuo-omni-plan/…` and `@omni/*` (through each
   workspace package's name and `exports`) to a zone, checks the table, the client rule and the marker
   rule, naming the file, the line and the rule, and runs fallow's cycle check. No allowlist, no
   comment escape. It runs in `pnpm test`.

## Consequences

- An import across a layer fails `pnpm test` within seconds, naming the rule; a new dependency between
  zones is a change to this table, its ADR and the guard, reviewed as one.
- A new zone (a new package or app) needs a row in the guard's table before its first import passes.
- A shared helper that gains a server import breaks every client file that reaches it; the chain in
  the refusal names where to cut.
- A dynamic import of a computed path is not read; review is where such an import is caught.

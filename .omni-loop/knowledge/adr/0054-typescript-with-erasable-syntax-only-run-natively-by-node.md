# ADR-0054 — TypeScript with erasable syntax only, run natively by Node, imports naming `.ts`

**Status:** accepted · **Date:** 2026-10-01 · **PRD:** #725

## Context

The kit, the game, the GitHub App and the shared packages are plain JavaScript with no type
checking, and CI never ran `tsc` on the arcade either. PRD 725 moves every `.mjs` file to strict
TypeScript. The code runs in three places: on Node as scripts and CLIs (the kit's source, the game,
the repository's scripts and hooks), bundled by esbuild into `kit/dist/omni.mjs`, and inside Next.js
(the arcade). A build step for the first, or a runner such as `tsx`, would add a dependency and a
second way to run every file.

## Decision

- **Node runs `.ts` itself.** Type stripping, unflagged from Node 22.18: the root `engines.node` is
  `>=22.18`. No build step outside the bundle, no `tsx`. The bundle is still built by esbuild to
  `kit/dist/omni.mjs`.
- **Only erasable syntax.** `erasableSyntaxOnly`: no `enum`, no `namespace`, no parameter
  properties, nothing Node would have to transform rather than erase. `verbatimModuleSyntax`: a
  type-only import is written `import type`, so erasing types never changes which modules load.
- **Imports name the `.ts` file**, as Node resolves it: `module` and `moduleResolution` are
  `nodenext`, with `allowImportingTsExtensions` and `noEmit`.
- **One strict base.** `tsconfig.base.json` sets `strict` and `noUncheckedIndexedAccess` too. The
  root `tsconfig.json` (everything outside the arcade) and `apps/galaxy/tsconfig.json` extend it.
- **`pnpm typecheck`** runs `tsc` on both, generating the arcade's fumadocs docs index first, and the
  `checks` workflow runs it on every ready pull request into `main`, beside `test` and `fallow`.

## Consequences

- A `.ts` file runs with `node file.ts`, in a test or by hand, exactly as it is committed.
- Classes declare their fields; constants replace enums.
- The arcade is bundled by Next.js and keeps its own `module: esnext` and `moduleResolution:
  bundler`. Until PRD 725's ratchet slice it keeps `noUncheckedIndexedAccess` off (about 1 180
  index errors). It also keeps `erasableSyntaxOnly` off for now, since 25 of its files use
  parameter properties; when that rule turns on there is an open decision of PRD 725
  (`s1-01-arcade-keeps-erasable-syntax-off`).
- Until the rename, the root project reads `.mjs` files (`allowJs`) without checking them; the
  ratchet turns `allowJs` off.

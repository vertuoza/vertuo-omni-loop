# Plan: strict TypeScript across the kit, game and omni-app

PRD #725. The spec is `spec.md` beside this plan. The feature branch `feat/typescript` goes into
`main` through the feature PR (`Closes #725`); every slice is a sub-PR from `feat/typescript--<id>`
into the feature branch (`Part of #725`).

Paths below are written as they are **after** the rename (s2): a prefix with no extension covers the
file's `.ts` source and its `.test.ts` beside it (`kit/lib/outbox/settle` covers `settle.ts`,
`settle-merge.ts`, `settle-head.ts` and their tests).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Toolchain: one shared strict base config, `pnpm typecheck` over the root and the arcade, a `typecheck` job in CI, Vitest running `*.test.ts`, Node ≥ 22.18 | `tsconfig.base.json` `tsconfig.json` `apps/galaxy/tsconfig.json` `apps/galaxy/package.json` `package.json` `pnpm-lock.yaml` `vitest.config.mjs` `.github/workflows/checks.yml` `kit/test/typescript-sample` `.omni-loop/knowledge/adr/` | — | 1 |
| s2 | The rename: `scripts/ts-rename.mjs` renames every `.mjs` file to `.ts`, rewrites every import and path naming one, and opens each file with `// @ts-nocheck`; behaviour unchanged | `kit/` `game/` `apps/omni-app/` `apps/galaxy/` `packages/` `scripts/` `.claude/hooks/` `.github/workflows/` `.omni-loop/bin/` `package.json` `vitest.config` `tsconfig.json` | s1 | 2 |
| s3 | Shared domain types and Zod 4: `kit/lib/types.ts`, `kit/lib/schema/` with the config and front-matter schemas, Zod 3 → 4 in every file that imports it | `kit/lib/types` `kit/lib/schema/` `kit/lib/config` `kit/lib/openrouter` `kit/lib/inbox/inbox` `kit/lib/outbox/answers` `kit/lib/outbox/account` `kit/lib/outbox/outbox` `kit/lib/outbox/settle` `kit/lib/playbook/forms` `kit/lib/knowledge/classify` `kit/bin/commands/item` `apps/galaxy/src/fixes/facts/store` `apps/galaxy/src/outbox/send` `apps/galaxy/src/releases/row` `apps/galaxy/src/arcade/theme` `apps/galaxy/src/stages/sync/github` `apps/galaxy/src/dossier/github/` `apps/galaxy/src/signup/github-app` `apps/galaxy/src/signup/store` `apps/galaxy/src/knowledge/github` `apps/galaxy/src/data/github-orgs` `package.json` `apps/galaxy/package.json` `pnpm-lock.yaml` | s2 | 3 |
| s4 | The kit's core modules typed: board, check-report, commands, context, fix-verdict, git, laws, layout, markers, signature | `kit/lib/board` `kit/lib/check-report` `kit/lib/commands` `kit/lib/context` `kit/lib/fix-verdict` `kit/lib/git` `kit/lib/laws` `kit/lib/layout` `kit/lib/markers` `kit/lib/signature` | s2 | 3 |
| s5 | The database's types generated from the migrations, committed, and checked for drift in CI | `supabase/database.types.ts` `scripts/supabase-types` `.github/workflows/supabase.yml` | s2 | 3 |
| s6 | The design package typed | `packages/design/` | s2 | 3 |
| s7 | Outbox I typed: comment, outbox, status, relay, banter, account | `kit/lib/outbox/comment` `kit/lib/outbox/outbox` `kit/lib/outbox/status` `kit/lib/outbox/relay` `kit/lib/outbox/banter` `kit/lib/outbox/account` | s3, s4 | 4 |
| s8 | Outbox II typed: settle, replies, answers, the decision-coverage and outbox checks | `kit/lib/outbox/settle` `kit/lib/outbox/replies` `kit/lib/outbox/answers` `kit/lib/outbox/check-` `kit/lib/outbox/decision-coverage` | s3, s4 | 4 |
| s9 | Knowledge typed | `kit/lib/knowledge/` | s3, s4 | 4 |
| s10 | Playbook, inbox and plan-repo typed | `kit/lib/playbook/` `kit/lib/inbox/` `kit/lib/plan-repo/` | s3, s4 | 4 |
| s11 | Policy, delivery, status and releases typed | `kit/lib/policy/` `kit/lib/delivery/` `kit/lib/status/` `kit/lib/releases/` | s3, s4 | 4 |
| s12 | Ask, dossier, bug, visual and version typed | `kit/lib/ask/` `kit/lib/dossier/` `kit/lib/bug/` `kit/lib/visual/` `kit/lib/version/` | s3, s4 | 4 |
| s13 | Init and help typed | `kit/lib/init/` `kit/lib/help/` | s3, s4 | 4 |
| s14 | Credits, the repository's scripts and hooks, and the arcade's scripts and build files typed | `kit/lib/credits/` `scripts/` `.claude/hooks/` `apps/galaxy/scripts/` `apps/galaxy/artifact/` `apps/galaxy/next.config` | s3, s4 | 4 |
| s15 | The game typed, its Supabase client on `Database` | `game/` | s3, s5 | 4 |
| s16 | The CLI typed: `kit/bin` and its commands, the kit's tests, build and release | `kit/bin/` `kit/test/` `kit/release/` `kit/build` | s7, s8, s9, s10, s11, s12, s13, s14 | 5 |
| s17 | Statusline, update and launch typed | `kit/lib/statusline/` `kit/lib/update/` `kit/lib/launch/` | s12, s13 | 5 |
| s18 | The App's core typed: webhook, evaluate, the outbox and inbox checks, verdict comment, publish, git-write, stage-forward, snapshot, its API entries and scenario tests | `apps/omni-app/src/webhook/` `apps/omni-app/src/evaluate/` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/inbox-check/` `apps/omni-app/src/verdict-comment/` `apps/omni-app/src/publish/` `apps/omni-app/src/git-write/` `apps/omni-app/src/stage-forward/` `apps/omni-app/src/snapshot/` `apps/omni-app/src/inngest-client` `apps/omni-app/api/` `apps/omni-app/test/` `apps/omni-app/vercel.json` | s7, s8, s9, s10, s11 | 5 |
| s19 | The App's PR stats and knowledge harvest typed, its Supabase client on `Database` | `apps/omni-app/src/pr-stats/` `apps/omni-app/src/knowledge-harvest/` | s5, s7, s8, s9, s10, s11 | 5 |
| s20 | The retro's kinds typed | `apps/omni-app/src/retro/kinds/` | s7, s8, s9, s10, s11 | 5 |
| s21 | The rest of the retro typed | `apps/omni-app/src/retro/detect` `apps/omni-app/src/retro/github` `apps/omni-app/src/retro/guard` `apps/omni-app/src/retro/issues` `apps/omni-app/src/retro/narrate` `apps/omni-app/src/retro/publish` `apps/omni-app/src/retro/qualify` `apps/omni-app/src/retro/render` `apps/omni-app/src/retro/retro` `apps/omni-app/src/retro/rules` | s7, s8, s9, s10, s11 | 5 |
| s22 | The galaxy package typed | `packages/galaxy/` | s15 | 5 |
| s23 | Arcade I cleared for index checks, Supabase clients on `Database`: arcade, design, switch, fleets, people | `apps/galaxy/src/arcade/` `apps/galaxy/src/design/` `apps/galaxy/src/switch/` `apps/galaxy/src/fleets/` `apps/galaxy/src/people/` | s5, s7, s8, s9, s10, s11, s12, s13, s15 | 5 |
| s24 | Arcade II cleared: ask, dashboard, profile, signup, proxy | `apps/galaxy/src/ask/` `apps/galaxy/src/dashboard/` `apps/galaxy/src/profile/` `apps/galaxy/src/signup/` `apps/galaxy/src/proxy/` `apps/galaxy/proxy.ts` | s5, s7, s8, s9, s10, s11, s12, s13, s15 | 5 |
| s25 | Arcade III cleared: dossier, home, nav, waiting, timings, outbox-waiting, skeleton | `apps/galaxy/src/dossier/` `apps/galaxy/src/home/` `apps/galaxy/src/nav/` `apps/galaxy/src/waiting/` `apps/galaxy/src/timings/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/src/skeleton/` | s5, s7, s8, s9, s10, s11, s12, s13, s15 | 5 |
| s26 | Arcade IV cleared: docs, releases, outbox, knowledge, data, engineering, stages, fixes, repositories, the routes and the root tests | `apps/galaxy/src/docs/` `apps/galaxy/src/releases/` `apps/galaxy/src/outbox/` `apps/galaxy/src/knowledge/` `apps/galaxy/src/data/` `apps/galaxy/src/engineering/` `apps/galaxy/src/stages/` `apps/galaxy/src/fixes/` `apps/galaxy/src/repositories/` `apps/galaxy/src/design-system.test` `apps/galaxy/src/page-width.test` `apps/galaxy/src/perf-sql.test` `apps/galaxy/src/no-vertuoza-fleets.test` `apps/galaxy/app/` `apps/galaxy/source.config` | s5, s7, s8, s9, s10, s11, s12, s13, s15 | 5 |
| s27 | The ratchet: `allowJs` off, the arcade's index checks on, a guard test refusing `@ts-nocheck`, `.mjs` source files and unmarked `any`/`as` | `tsconfig.base.json` `tsconfig.json` `apps/galaxy/tsconfig.json` `kit/test/typescript-guard` | s16, s17, s18, s19, s20, s21, s22, s23, s24, s25, s26 | 6 |

**Shared ground.**

- `package.json`, `pnpm-lock.yaml` and `apps/galaxy/package.json`: s1 (typecheck script, engine,
  `@types/node`), s2 (script paths) and s3 (Zod 4). One wave each: 1, 2, 3.
- `tsconfig.json`, `tsconfig.base.json`, `apps/galaxy/tsconfig.json`: s1 writes them, s2 widens
  the root one's `include` to `.ts`, s27 tightens them. Waves 1, 2, 6.
- `.github/workflows/`: s1 (`checks.yml`), s2 (every script path), s5 (`supabase.yml`). Waves 1,
  2, 3.
- The Zod files s3 moves to v4 are later typed by their folder's slice: `kit/lib/outbox/*` by s7
  and s8, `kit/lib/knowledge/classify` by s9, `kit/lib/inbox/inbox` and `kit/lib/playbook/forms` by
  s10, `kit/bin/commands/item` by s16, and the arcade files by s23 to s26. s3 is wave 3; all of those
  come later.
- `kit/lib/outbox/`: s7 and s8 split it by file, both in wave 4, with disjoint prefixes. Each file's
  test sits under the same prefix as the file, so no outbox test is shared. `outbox/answers` is
  s8's; s7's `outbox/outbox` prefix does not cover it.
- `apps/omni-app/src/retro/`: s20 owns `kinds/` and s21 the named files beside it. Both are wave 5
  and disjoint; the goldens (`issues.golden`, `render.golden`) fall under s21's prefixes.
- `kit/test/`: s1 adds `typescript-sample`, s16 types the rest, s27 adds `typescript-guard`. Waves
  1, 5, 6.
- `scripts/`: s2 adds `ts-rename.mjs`, s5 adds `supabase-types`, s14 types the rest. Waves 2, 3, 4.
- `apps/galaxy/src/`: s3 (Zod files only) in wave 3; s23 to s26 split the rest by folder in wave
  5, with disjoint prefixes (`outbox/` is s26's, `outbox-waiting/` is s25's).
- Each typing slice may add a folder-local schema file inside its own territory. Only s3 writes
  `kit/lib/schema/`. A slice that needs a new shared shape records it as an outbox item, and s27's
  review folds it in.
- Casts allowed in source are marked on their own line (`// ts-allow: <reason>`), so no slice edits
  a shared allow-list.

## Per slice: done when

Every typing slice (s4, s6 to s26) is done when:

- no file under its territory has `// @ts-nocheck`, tests included;
- `pnpm typecheck` passes, and `pnpm test` passes with the same number of tests;
- every value its files read from a file, a process, the network or the environment passes a Zod
  schema before use, and an invalid value fails with an error naming its field;
- source `any` and `as` appear only on lines with a `// ts-allow: <reason>` comment (tests may cast
  fixtures freely);
- no output changes: a bug the types reveal is an outbox item, not a fix in this slice.

Beyond that:

**s1**
- `pnpm typecheck` runs `tsc -p .` and the arcade's check (after generating its docs index) and
  passes; the arcade's 4 errors today are gone.
- `checks.yml` runs `typecheck` on pull requests beside `test` and `fallow`.
- `kit/test/typescript-sample.test.ts` runs under `pnpm test`.
- Root `engines.node` is `>=22.18`; `@types/node` is a root dev dependency.
- The base config sets `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
  `verbatimModuleSyntax`, `module`/`moduleResolution: nodenext`, `allowImportingTsExtensions`,
  `noEmit`; the arcade extends it with `noUncheckedIndexedAccess: false` for now.
- An ADR records: TS with erasable syntax only, run natively by Node, imports naming `.ts`.

**s2**
- Running `scripts/ts-rename.mjs` leaves no `.mjs` file outside `kit/dist/`, `.omni-loop/bin/` and
  itself; running it a second time changes nothing (a test proves both on a fixture repository).
- Every `.ts` file opens with `// @ts-nocheck`; `pnpm typecheck` and `pnpm test` pass with as many
  tests as before.
- `kit/dist/omni.mjs` is rebuilt; its code is unchanged, only file names in its comments differ;
  `node kit/dist/omni.mjs config` in a fixture repository prints the same JSON as before.
- `.omni-loop/bin/omni.mjs` (the shim onto the source) runs `omni config` here.
- `pnpm game:project` with no Supabase environment fails with the same message as before.
- The App's preview deployment builds, and `/api/github` and `/api/inngest` answer.
- It starts only once no open feature branch touches `kit/`, `game/`, `apps/omni-app/` or
  `packages/`.

**s3**
- `kit/lib/types.ts` exports PRD, Slice, Wave, OutboxItem, InboxItem, Dossier, Stage, Config and
  Fleet; each shape read from outside is a schema in `kit/lib/schema/`, and its type is `z.infer`
  of it.
- Each new schema has a test with a valid input and an invalid one whose error names the field.
- Zod is `^4` in every package; `pnpm why zod` lists no v3.

**s5**
- `supabase/database.types.ts` is what `supabase gen types --local` prints from the migrations.
- The `supabase` workflow regenerates it and fails when it differs from the committed file.
- A test or check run shows it failing on a copy missing one column.

**s15, s19, s23 to s26**
- Every Supabase client their territory opens is created as `createClient<Database>` (or the
  server/browser variant with `<Database>`).

**s23 to s26**
- `tsc -p apps/galaxy --noUncheckedIndexedAccess` reports no error in a file under the slice's
  territory.

**s16**
- `kit/test/dist` passes against a fresh build from the typed source.

**s27**
- The root config has no `allowJs`; the arcade config no longer turns `noUncheckedIndexedAccess`
  off; `pnpm typecheck` passes.
- `kit/test/typescript-guard.test.ts` fails, on fixtures, for a file with `@ts-nocheck`, a `.mjs`
  source file, an `any` without `// ts-allow:`, and an empty reason; it passes on a marked line.
- The guard passes on the whole repository.

---
form: conventions
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@9870eaf
  - kit/lib/ids.ts@66fe58a
  - scripts/id-types-guard.test.ts@daaaf9e
  - kit/lib/env/read.ts@106759c
  - scripts/env-guard.test.ts@5739a50
  - kit/lib/env/docs.ts@1588953
  - eslint.config.ts@882ba64
invaded: 2026-10-20
---

# Conventions

Use this page when naming things, formatting files, or shaping commits.

## Naming
<!-- slot: naming · optional · by: human -->
An ID is parsed into its brand from `kit/lib/ids.ts` where it enters (an argument, a folder name, a
plan table, front matter, a GitHub payload, a stored row, a route) with its `parse…` function or its
schema, and never declared bare: `prd: PrdNumber`, `pr: PrNumber`, `issue: IssueNumber`,
`slice: SliceId`, never `number` or `string`, not
even beside `null` or `undefined`. In a zod object, an ID field takes the brand's schema
(`PrdNumberSchema`), never a plain `z.number()` chain. `scripts/id-types-guard.test.ts` enforces it on
every source file (no allowlist, no comment escape): a listed name that holds something else is
renamed after it (`sliceLabel`) or typed from its config. ADR-0056 records the rule.

The environment is read only through each runtime's env module, as feature groups:
`kit/lib/env/read.ts` (kit, game, scripts), `apps/omni-app/src/env.ts`, `apps/galaxy/src/env.ts`
(arcade server) and `apps/galaxy/src/env.client.ts` (browser). A new variable joins a group there
(built with `kit/lib/env/group.ts`), complete or `null` when off; code takes its group as a
parameter, and tests pass plain objects, never writing `process.env`. A value the platform or an SDK
reads goes in `PLATFORM_VARIABLES` or `SDK_VARIABLES`. `scripts/env-guard.test.ts` fails on any other
`process.env` access (no allowlist, no comment escape), and the docs check (`kit/lib/env/docs.ts`,
each runtime's `env-docs` test) fails when `apps/galaxy/.env.example` or a README's
`omni:env-variables` list differs from the module's `VARIABLES`: update it in the same change.
ADR-0057 records the rule.

New server code logs through `kit/lib/log`, never a bare `console` string (ADR-0102).

- **A new migration takes the next free version.** Supabase keys applied migrations by version, so
  `supabase/migrations/<version>_<name>.sql` takes a version after the latest one on both the branch
  and `main`, never one a plan names without checking: two files on one version cannot both apply.
  Before it reaches production a clash is a rename; after, it is a new migration (PRD 902, s1-01).
- **A migration stays the newest until it merges.** `supabase db push` refuses a migration dated
  before the newest one production applied, so a branch whose migration `main` overtook while it
  waited is re-dated (`git mv`, then every path naming it) after `main`'s newest, checked again after each
  merge of `main` and before it is marked ready. The `supabase` workflow's
  `check` refuses an overtaken migration (`node scripts/migration-order.ts`), and its `deploy`
  pushes with `--include-all`, so one merged after its check still applies (PRD 1364, #1456).
- **The database types are generated, never written.** `supabase/database.types.ts` is what
  `node scripts/supabase-types.ts` writes from a fresh local database (`supabase stop --no-backup`
  first), with each migration change or re-date; the pre-push hook and
  the `supabase` workflow check it (retros #1349, #1649, #2207).
- **A new database check runs in CI.** Each file under `supabase/checks/` is its own named step in
  the `supabase` workflow's `check` job, added in the pull request that adds the check; a check CI
  does not run proves nothing (PRD 902, s1-02).
- **A new returned column lands with its readers.** A migration that adds a column to returned
  rows extends every parse schema reading them in the same change: they refuse unknown keys
  and `pnpm schemas:verify` stays red (retro of PRD 2270, #2295).

## Formatting
<!-- slot: formatting · optional · by: invade -->
No formatter is configured: `pnpm lint` checks correctness, not layout. The file you touch sets the style; keep to it.

## Commits
<!-- slot: commits · optional · by: invade -->
Conventional Commits whose scope names the part or feature changed, as `git log` shows: `kit`,
`galaxy`, `knowledge`, `game`, `omni-app`, `plugin`, `supabase`, `delivery`, `roadmap`. A pull
request lands on `main` as one commit, under its own title followed by its number:
`feat(kit): omni init — install the kit in one command (#40)`.

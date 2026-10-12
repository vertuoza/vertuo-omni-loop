---
form: releasing
form-version: 1
state: filled
points-to: null
evidence:
  - .github/workflows/supabase.yml@eb1f7c4
  - .github/workflows/game.yml@8e69ab2
  - package.json@39e6355
  - kit/test/dist.test.ts@e236e83
  - .claude-plugin/marketplace.json@5996f1b
  - apps/galaxy/README.md@0e2049f
  - apps/omni-app/README.md@ed64d66
terraformed: 2026-09-25
---

# Releasing

Use this page when you need to know what a merge publishes.

## What a merge publishes
<!-- slot: publishes · required · by: terraform -->
A merge to `main` ships:

- **The database.** A merge that touches `supabase/migrations/` or the `supabase` workflow applies
  the migrations to the production Supabase project, through that workflow's `deploy` job, once
  the repository variable `SUPABASE_PROJECT_ID` is set. The demo seed never reaches production.
  It pushes with `--include-all`: a migration dated before one production already applied still
  goes in, in a different order than CI applied them (conventions › A migration stays the newest
  until it merges).
- **The kit.** The root package's `bin` is `kit/dist/omni.mjs`, the file the one-line install
  runs, and the plugin marketplace serves `kit/plugin` (`.claude-plugin/marketplace.json`): a merge
  changes what both hand out.

- **The arcade and the GitHub App.** `apps/galaxy` and `apps/omni-app` are Vercel projects imported
  from this repository. A merge to `main` deploys each to production through the release commit
  that follows it, and only the project whose inputs changed since its last production deploy
  (PRD 1646, `scripts/vercel-ignore.sh`): a merge of documents alone deploys neither. When the
  `release` workflow fails, its last step deploys `main` through each project's Deploy Hook.
  `VERCEL_FORCE_BUILD=1` on a project makes it build every deployment
  ([apps/galaxy/README.md › When Vercel builds](../../../apps/galaxy/README.md#8-when-vercel-builds)).

## How a release happens
<!-- slot: how · optional · by: terraform -->
See: apps/galaxy/README.md#deploy-to-production

## Rollback
<!-- slot: rollback · optional · by: terraform -->
The ledger is append-only and lives only in Supabase. What restores it is the backup the `game`
workflow's `rankings` job exports on each run, kept 90 days as a workflow artifact, or the Pro
plan's point-in-time recovery (apps/galaxy/README.md).

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
- **The kit.** The root package's `bin` is `kit/dist/omni.mjs`, the file the one-line install
  runs, and the plugin marketplace serves `kit/plugin` (`.claude-plugin/marketplace.json`): a merge
  changes what both hand out.

TODO(human): the arcade (`apps/galaxy`) and the GitHub App (`apps/omni-app`) are Vercel projects imported from this repository (their READMEs). Does a merge to `main` deploy both to production?

## How a release happens
<!-- slot: how · optional · by: terraform -->
See: apps/galaxy/README.md#deploy-to-production

## Rollback
<!-- slot: rollback · optional · by: terraform -->
The ledger is append-only and lives only in Supabase. What restores it is the backup the `game`
workflow's `rankings` job exports on each run, kept 90 days as a workflow artifact, or the Pro
plan's point-in-time recovery (apps/galaxy/README.md).

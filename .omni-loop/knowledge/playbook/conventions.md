---
form: conventions
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - kit/lib/ids.ts@90d94c1
  - scripts/id-types-guard.test.ts@daaaf9e
  - kit/lib/env/read.ts@db70924
  - scripts/env-guard.test.ts@5739a50
  - kit/lib/env/docs.ts@1588953
terraformed: 2026-09-25
---

# Conventions

Use this page when naming things, formatting files, or shaping commits.

## Naming
<!-- slot: naming · optional · by: human -->
An ID is parsed into its brand from `kit/lib/ids.ts` where it enters (an argument, a folder name, a
plan table, front matter, a GitHub payload, a stored row, a route) with its `parse…` function or its
schema, and never declared bare: `prd: PrdNumber`, `pr: PrNumber`, `issue: IssueNumber`,
`commentId: CommentId`, `slice: SliceId`, `itemId: OutboxItemId`, never `number` or `string`, not
even beside `null` or `undefined`. In a zod object, an ID field takes the brand's schema
(`PrdNumberSchema`), never a plain `z.number()` chain. `scripts/id-types-guard.test.ts` enforces it on
every source file, with no allowlist and no comment escape: a name on its list that holds something
else is renamed after what it holds (`sliceLabel`), or typed from the config it comes from. ADR-0056
records the rule.

The environment is read through the runtime's env module, as feature groups, and nowhere else:
`kit/lib/env/read.ts` for the kit, the game and the scripts, `apps/omni-app/src/env.ts` for the
GitHub App, `apps/galaxy/src/env.ts` for the arcade's server and `apps/galaxy/src/env.client.ts` for
its browser. A new variable is a member of a group there (built with `kit/lib/env/group.ts`'s
helpers), complete or `null` when it is off, and the code takes the group it needs as a parameter;
tests pass plain objects and never write `process.env`. A value the platform sets, or one an SDK
reads itself, goes in the module's named list (`PLATFORM_VARIABLES`, `SDK_VARIABLES`).
`scripts/env-guard.test.ts` fails on any `process.env` access elsewhere, with no allowlist and no
comment escape, and the docs check (`kit/lib/env/docs.ts`, run by each runtime's `env-docs` test)
fails when `apps/galaxy/.env.example` or a README's marked list (the names between its
`omni:env-variables` comments) and the module's `VARIABLES` differ, either way: add the variable to
the list in the same change. ADR-0057 records the rule.

- **A new migration takes the next free version.** Supabase keys applied migrations by version, so
  `supabase/migrations/<version>_<name>.sql` takes a version after the latest one on both the branch
  and `main`, never one a plan names without checking: two files on one version cannot both apply.
  Before it reaches production a clash is a rename; after, it is a new migration (PRD 902, s1-01).
- **A new database check runs in CI.** Each file under `supabase/checks/` is its own named step in
  the `supabase` workflow's `check` job, added in the pull request that adds the check; a check CI
  does not run proves nothing (PRD 902, s1-02).

## Formatting
<!-- slot: formatting · optional · by: terraform -->
No formatter and no linter is configured: `package.json` has no format or lint script, and the tree
holds no formatter config. The file you touch sets the style; keep to it.

## Commits
<!-- slot: commits · optional · by: terraform -->
Conventional Commits whose scope names the part of the repository the commit changes, as
`git log` shows: `kit`, `plugin`, `game`, `galaxy`, `omni-app`, `supabase`, `delivery`. A pull
request lands on `main` as one commit, under its own title followed by its number:
`feat(kit): omni init — install the Omni Loop kit on a repository in one command (#40)`.

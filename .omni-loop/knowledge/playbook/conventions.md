---
form: conventions
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
terraformed: 2026-09-25
---

# Conventions

Use this page when naming things, formatting files, or shaping commits.

## Naming
<!-- slot: naming · optional · by: human -->
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

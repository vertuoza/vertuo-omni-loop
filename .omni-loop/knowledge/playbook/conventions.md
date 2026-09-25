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
<!-- slot: naming · optional -->

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

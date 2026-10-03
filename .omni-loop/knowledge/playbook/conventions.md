---
form: conventions
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - kit/lib/ids.ts@90d94c1
  - scripts/id-types-guard.test.ts@daaaf9e
terraformed: 2026-09-25
---

# Conventions

Use this page when naming things, formatting files, or shaping commits.

## Naming
<!-- slot: naming · optional -->
An ID is parsed into its brand from `kit/lib/ids.ts` where it enters (an argument, a folder name, a
plan table, front matter, a GitHub payload, a stored row, a route) with its `parse…` function or its
schema, and never declared bare: `prd: PrdNumber`, `pr: PrNumber`, `issue: IssueNumber`,
`commentId: CommentId`, `slice: SliceId`, `itemId: OutboxItemId`, never `number` or `string`, not
even beside `null` or `undefined`. In a zod object, an ID field takes the brand's schema
(`PrdNumberSchema`), never a plain `z.number()` chain. `scripts/id-types-guard.test.ts` enforces it on
every source file, with no allowlist and no comment escape: a name on its list that holds something
else is renamed after what it holds (`sliceLabel`), or typed from the config it comes from. ADR-0056
records the rule.

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

---
prd: 2419
title: The knowledge tree on the Omni page
blocked-by: [2416, 2417]
spec: file
---

## Problem

The playbook every agent follows is invisible on the Omni page: each repository uploads it on merge, inside its knowledge snapshot, but no page draws it. The product's Knowledge page shows constituents, personas, Legal, glossary and pitch only. A person cannot see, per repository, which rules agents follow and where they come from.

## Solution

The knowledge tree (decided by @pierrederval, 2026-10-22, roadmap "Repository knowledge at the right level"): knowledge sits on three levels, each optional: **Omni settings** (the workspace's settings repository: its plan repository when it has one, else a repository the workspace names; plain files, shown and edited on the Omni page through pull requests), **plan repository**, **repository**. Every level is a repository's plain files, so a workspace's knowledge stays in its own repositories (Never 6). Two sides read the tree in opposite directions:

- **Product knowledge** (what the product is and must do, and product decisions) is **top-down**: a higher level holds for every level under it; a lower level may add to it, never contradict it.
- **Tech knowledge** (how to work in a codebase: the playbook, and the decision records, ADRs) is **bottom-up**: a repository's own wins; where it has none, its plan repository's applies; where that has none, the Omni settings'.

1. **The product's Knowledge page gains a Repositories section:** for each repository of the product, its playbook pages and decision records, each marked with the level it comes from (repository, plan repository, Omni settings, kit default), and its owner.
2. **It reads what is already uploaded:** the repository's newest knowledge snapshot, resolved with PRD #2416's order and PRD #2417's defaults. No new upload.
3. **A page that reads a default** offers "write it for this repository", which opens the repository's own page to edit, as a pull request.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | page | the Repositories section | sections ← `apps/galaxy/src/product-knowledge/knowledge-sections.ts:11` |

## Decisions

- Q3 — recommended default, accepted when the phase-0 PR merges: an `owner:` line on the page, defaulting to the repository's law owners
- **The page reads the uploaded snapshots** (knowledge packs), not a new upload: the least to build.

## User stories

- As a person, I open a product and see, per repository, how agents work there and where each rule comes from.

## Scope

In: the section, its read from snapshots, the level and owner marks, the "write it for this repository" action. Out: editing the Omni-settings defaults (PRD #2417).

## Test seams

Galaxy service and render tests over fixture snapshots: each level's mark, a repository with no snapshot, the action's pull request link.

## Risks

Merging publishes galaxy. Rollback: revert. The Legal entries: none touched (the page shows what the workspace's own repositories hold, to the workspace's members). The locked laws: none touched.

## Acceptance criteria

1. The product's Knowledge page lists each repository of the product with its playbook pages and decision records.
2. Each page and record shows its level and its owner.
3. A repository with no snapshot says so, with how to send one.
4. "Write it for this repository" on a page that reads a default opens that page's edit as a pull request in the repository.

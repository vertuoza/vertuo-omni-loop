---
prd: 2417
title: Tech defaults at the Omni-settings level
blocked-by: [2416]
spec: file
---

## Problem

Agents follow the playbook, but a page a repository has not written runs on a generic kit default nobody sees: in this repository three pages are blank and `review` is missing, and the person did not know the playbook existed. `/omni:invade` never writes default text into a page. There is no place to set, once, how AI agents should work across a workspace's repositories.

## Solution

The knowledge tree (decided by @pierrederval, 2026-10-22, roadmap "Repository knowledge at the right level"): knowledge sits on three levels, each optional: **Omni settings** (the workspace and its products, on the Omni page), **plan repository**, **repository**. Two sides read the tree in opposite directions:

- **Product knowledge** (what the product is and must do, and product decisions) is **top-down**: a higher level holds for every level under it; a lower level may add to it, never contradict it.
- **Tech knowledge** (how to work in a codebase: the playbook, and the decision records, ADRs) is **bottom-up**: a repository's own wins; where it has none, its plan repository's applies; where that has none, the Omni settings'.

1. **The Omni settings hold a tech playbook,** the top level of the tech side: a curated default for AI agents (definition of done, verification before a push, review: fix / push back / ask, bug-fixing), editable on the Omni page by the workspace's owners, one per workspace and optionally per product.
2. **Every repository reads it** through PRD #2416's resolver for each section it does not write itself. A cached copy keeps it readable offline, as product knowledge is today.
3. **`/omni:invade` starts a repository from it:** a page the repository cannot prove from evidence reads the Omni-settings default, and the person sees which pages do (`omni kb status`). It still never copies default text into the repository's files: a repository's own page is one a person or invade wrote for it.
4. **The kit ships the first version** of that curated default, `review` included, and this repository's 4 pages read it once this ships.
5. **Never 6 holds:** the defaults export as plain files, and a repository's own pages stay in it.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | the workspace's tech playbook table | no written convention: follows `product_legal` ← `supabase/migrations/20261212110000_product_knowledge.sql` |

## Decisions

- Q2 — recommended default, accepted when the phase-0 PR merges: a cached copy under `.omni-loop/local/`, as product knowledge is read today
- Q3 — recommended default, accepted when the phase-0 PR merges: an `owner:` line on the page, defaulting to the repository's law owners
- **Defaults live at the Omni-settings level of the tech side** (asked: "Omni settings < Plan repo < Repo knowledge" for tech).

## User stories

- As a workspace owner, I set once how agents should review, test and call work done, for every repository.
- As a person, I see which pages of a repository follow that default and which it wrote itself.

## Scope

In: the Omni-settings tech playbook (storage, edit, read by the CLI and cached), the curated first version, invade starting from it. Out: the tree's page view (PRD #2419).

## Test seams

Database check for who reads and writes the tech playbook; galaxy service and render tests for its editor; kit tests for the cached read through the resolver; invade's skill tests.

## Risks

Merging publishes the kit, galaxy and a migration on production Supabase. Rollback: revert, then a follow-up migration drops the table. L-GDPR-1: an owner's GitHub login on a page is read only by the workspace's members. The locked laws: none touched.

## Acceptance criteria

1. A workspace owner edits the Omni-settings tech playbook on the Omni page; a member reads it; nobody outside the workspace does.
2. In a repository without its own `review` page, `omni kb show review` shows the Omni-settings text, tagged `[omni settings]`, offline too once cached.
3. `/omni:invade` on a new repository writes only the pages it proves, and `omni kb status` names the pages that read the Omni-settings default.
4. The kit's first default holds a `review` page with fix, push back and ask, and a definition of done.

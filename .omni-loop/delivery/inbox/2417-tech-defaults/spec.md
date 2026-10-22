---
prd: 2417
title: Tech defaults at the Omni-settings level
blocked-by: [2416]
spec: file
---

## Problem

Agents follow the playbook, but a page a repository has not written runs on a generic kit default nobody sees: in this repository three pages are blank and `review` is missing, and the person did not know the playbook existed. `/omni:invade` never writes default text into a page. There is no place to set, once, how AI agents should work across a workspace's repositories.

## Solution

The knowledge tree (decided by @pierrederval, 2026-10-22, roadmap "Repository knowledge at the right level"): knowledge sits on three levels, each optional: **Omni settings** (the workspace's settings repository: its plan repository when it has one, else a repository the workspace names; plain files, shown and edited on the Omni page through pull requests), **plan repository**, **repository**. Every level is a repository's plain files, so a workspace's knowledge stays in its own repositories (Never 6). Two sides read the tree in opposite directions:

- **Product knowledge** (what the product is and must do, and product decisions) is **top-down**: a higher level holds for every level under it; a lower level may add to it, never contradict it.
- **Tech knowledge** (how to work in a codebase: the playbook, and the decision records, ADRs) is **bottom-up**: a repository's own wins; where it has none, its plan repository's applies; where that has none, the Omni settings'.

1. **The settings repository holds a tech playbook,** the top level of the tech side: a curated default for AI agents (definition of done, verification before a push, review: fix / push back / ask, bug-fixing), as plain playbook files. The Omni page shows them, and a workspace owner proposes a change there, which opens a pull request in the settings repository that a person merges.
2. **Every repository reads it** through PRD #2416's resolver for each section it does not write itself, from the settings repository's files; a local read copy, refreshed by `omni sync`, keeps it readable offline. The files themselves stay in the settings repository.
3. **`/omni:invade` starts a repository from it:** a page the repository cannot prove from evidence reads the Omni-settings default, and the person sees which pages do (`omni kb status`). It still never copies default text into the repository's files: a repository's own page is one a person or invade wrote for it.
4. **The kit ships the first version** of that curated default, `review` included, and this repository's 4 pages read it once this ships.
5. **Never 6 holds:** every level is plain files in a repository the workspace owns; nothing lives only on the Omni page.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | config | the workspace's settings repository | no written convention: follows `plan.targets` ← `.omni-loop/config.yml` |

## Decisions

- Q2 — recommended default, accepted when the phase-0 PR merges: a local read copy of the settings repository's pages, refreshed by `omni sync`
- Q3 — recommended default, accepted when the phase-0 PR merges: an `owner:` line on the page, defaulting to the repository's law owners
- **Defaults live at the Omni-settings level of the tech side** (asked: "Omni settings < Plan repo < Repo knowledge" for tech).
- **The Omni-settings level is a settings repository's plain files** (asked, after the inbox check named Never 6): edited from the Omni page through pull requests.

## User stories

- As a workspace owner, I set once how agents should review, test and call work done, for every repository.
- As a person, I see which pages of a repository follow that default and which it wrote itself.

## Scope

In: the settings repository's tech playbook (its files, the Omni page's view and its pull-request edit, the CLI's read and local copy), the curated first version, invade starting from it. Out: the tree's page view (PRD #2419).

## Test seams

Galaxy service and render tests for the view and the pull request an edit opens; kit tests for the read and the local copy through the resolver; invade's skill tests.

## Risks

Merging publishes the kit and galaxy; no stored shape changes. Rollback: revert. The Legal entries: none touched (a page's owner is a GitHub login in the workspace's own repository). The locked laws: none touched.

## Acceptance criteria

1. A workspace owner's change to the tech playbook on the Omni page opens a pull request in the settings repository; once a person merges it, every repository reads the new text.
2. In a repository without its own `review` page, `omni kb show review` shows the settings repository's text, tagged `[omni settings]`, offline too from its local copy.
3. `/omni:invade` on a new repository writes only the pages it proves, and `omni kb status` names the pages that read the Omni-settings default.
4. The kit's first default holds a `review` page with fix, push back and ask, and a definition of done.

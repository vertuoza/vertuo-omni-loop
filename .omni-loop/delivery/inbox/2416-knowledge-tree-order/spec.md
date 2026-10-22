---
prd: 2416
title: One resolution order for the knowledge tree
blocked-by: none
spec: file
---

## Problem

The kit reads a repository's knowledge from that repository alone, plus a product's knowledge cached from the Omni page, each in its own way: a playbook section is the repository's or the kit default; an ADR is the repository's; a plan repository's knowledge reaches its targets only through copies. Nothing says which level a piece of knowledge came from, or which wins when two levels both hold it. A person reading `omni kb show testing` cannot tell whether an agent follows this repository's rule, its plan repository's, or a generic default.

## Solution

The knowledge tree (decided by @pierrederval, 2026-10-22, roadmap "Repository knowledge at the right level"): knowledge sits on three levels, each optional: **Omni settings** (the workspace's settings repository: its plan repository when it has one, else a repository the workspace names; plain files, shown and edited on the Omni page through pull requests), **plan repository**, **repository**. Every level is a repository's plain files, so a workspace's knowledge stays in its own repositories (Never 6). Two sides read the tree in opposite directions:

- **Product knowledge** (what the product is and must do, and product decisions) is **top-down**: a higher level holds for every level under it; a lower level may add to it, never contradict it.
- **Tech knowledge** (how to work in a codebase: the playbook, and the decision records, ADRs) is **bottom-up**: a repository's own wins; where it has none, its plan repository's applies; where that has none, the Omni settings'.

1. **One resolver** in the kit reads each kind of knowledge through the tree in its side's direction. Tech side: for a playbook section or an ADR, the repository's, else the plan repository's (its imported copy), else the Omni settings' (the cached copy, PRD #2417), else the kit default. Product side: every level's entries apply, the highest first, and a lower entry that contradicts a higher one is refused by `omni check knowledge`, naming both.
2. **Every read names its level.** `omni kb show <form>` marks each section `[repo]`, `[plan repo]`, `[omni settings]` or `[kit default]`; `omni kb status` counts them per form; `omni kb show decisions` marks each record's level.
3. **Every level is optional.** A repository with no plan repository and no Omni settings reads exactly as today.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | kit | level tags `[repo]`, `[plan repo]`, `[omni settings]`, `[kit default]` | `[repo]` / `[kit default]` ← `kit/lib/playbook/resolve.ts` |

## Decisions

- **The tree, its two directions and its optional levels** (asked, roadmap map).
- **ADRs are tech knowledge, bottom-up** (asked).

## User stories

- As a person, `omni kb show testing` tells me which level each rule comes from.
- As an agent, I follow one answer per section, read the same way in every repository.

## Scope

In: the kit's resolver, the level tags, the product-side contradiction check, the plan-repository level from imported copies. Out: writing the Omni-settings level (PRD #2417), the page (PRD #2419), product decisions set from the page (PRD #2418).

## Test seams

Unit tests on the resolver, over fixture repositories with and without each level: the bottom-up winner per section, the top-down union and its contradiction refusal, the level tags, and a repository with no other level reading as today. `omni kb show` and `omni kb status` snapshot tests.

## Risks

Merging publishes the kit. Rollback: revert; no stored data changes. The Legal entries: none touched. The locked laws: none touched.

## Acceptance criteria

1. In a repository with its own section, `omni kb show <form>` shows it tagged `[repo]`, even when the plan repository and the Omni settings hold one.
2. A section the repository lacks shows the plan repository's, tagged `[plan repo]`, else the Omni settings', tagged `[omni settings]`, else the kit default, tagged `[kit default]`.
3. A product rule a repository holds that contradicts one of its plan repository or Omni settings makes `omni check knowledge` red, naming both.
4. `omni kb show decisions` lists each record with its level, a repository's own first.
5. A repository with no plan repository and no Omni settings reads every form exactly as today.

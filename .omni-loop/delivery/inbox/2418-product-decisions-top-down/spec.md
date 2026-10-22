---
prd: 2418
title: Product decisions top-down
blocked-by: [2416]
spec: file
---

## Problem

A product's decisions (its laws, rules and principles) are set per repository today: a product spread over several repositories keeps them in each one, and nothing stops a repository from contradicting another or the product as a whole.

## Solution

The knowledge tree (decided by @pierrederval, 2026-10-22, roadmap "Repository knowledge at the right level"): knowledge sits on three levels, each optional: **Omni settings** (the workspace and its products, on the Omni page), **plan repository**, **repository**. Two sides read the tree in opposite directions:

- **Product knowledge** (what the product is and must do, and product decisions) is **top-down**: a higher level holds for every level under it; a lower level may add to it, never contradict it.
- **Tech knowledge** (how to work in a codebase: the playbook, and the decision records, ADRs) is **bottom-up**: a repository's own wins; where it has none, its plan repository's applies; where that has none, the Omni settings'.

1. **A product decision can be set at the Omni-settings level or in a plan repository,** and holds for every repository under it, read through PRD #2416's resolver, top-down.
2. **A lower level may add, never contradict:** `omni check knowledge` refuses a repository entry that contradicts a higher one, naming both and who owns the higher one.
3. **The harvest proposes at the right level:** a decision about the whole product is proposed to the product, one about one repository to that repository.

## Conventions

No name chosen.

## Decisions

- **Product side is top-down** (asked).

## User stories

- As a product owner, a law I lock at the product level binds every repository of the product.

## Scope

In: product decisions at the Omni-settings and plan-repository levels, the contradiction check, the harvest's level. Out: tech knowledge (PRDs #2416, #2417).

## Test seams

Kit tests over fixture levels: inheritance, an added entry, a contradiction refused; the harvest's level choice.

## Risks

Merging publishes the kit and the app. Rollback: revert. The Legal entries: none touched. The locked laws: none touched.

## Acceptance criteria

1. A rule set at the Omni-settings level appears in every repository of the product, tagged with its level.
2. A repository rule that contradicts it makes `omni check knowledge` red, naming both.
3. A harvest proposal about the whole product is proposed at the product level.

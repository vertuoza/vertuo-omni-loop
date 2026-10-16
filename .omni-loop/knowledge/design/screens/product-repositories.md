---
screen: product-repositories
status: draft
kind: page
mock: product-repositories.html
implements: ["apps/galaxy/app/app/products/[id]/repositories/page.tsx", apps/galaxy/src/product-repositories/RepositoriesTab.tsx, apps/galaxy/src/product-repositories/RepositoriesTabPage.tsx]
reads: [apps/galaxy/src/product-repositories/repositories-tab.service.ts, apps/galaxy/src/product-home/ProductHome.tsx]
routes: [/app/products/<id>/repositories]
supersedes: null
---

## Purpose

A product's Repositories & approvers tab: its repositories, the rollout ladder step each one is at,
and what still lives in its plan repository, as information only. The plan repository is never
archived by the loop, and the old way keeps working beside the product way (PRD 2011).

## Regions

- The ladder: one line per repository, five steps, the reached ones filled.
- Still in the plan repository: one line each for a repository below step 5 (`vertuo-web · step 3`)
  and for an open record born in git (`roadmap 0412 · in git`).
- The one primary action: Add a repository, as PRD 1364 drew it.
- Below, the repositories and approvers as PRD 1364 drew them.

## States

- Nothing left in the plan repository: the list says so.
- No plan repository named for the product: the list is not shown.

## Words

`Still in the plan repository`, `step <n>`, `in git`.

## Refusals

- No archive action: the loop never archives or deletes a plan repository, and the App holds no
  administration permission.

## Open questions

- The words of the list when nothing is left in the plan repository.

## Source

/omni:brainstorm, PRD 2011: .omni-loop/delivery/inbox/2011-product-records/before-after.html (reworked
2026-10-16: no archive, the plan repository is kept)

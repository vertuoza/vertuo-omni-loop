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
and the archive of the plan repository once nothing is left in it (PRD 2011).

## Regions

- The ladder: one line per repository, five steps, the reached ones filled.
- What still holds the plan repository, one line each (`Held by vertuo-web · step 3`).
- The one primary action: Archive the plan repository, refused while anything holds it; Undo once
  archived.
- Below, the repositories and approvers as PRD 1364 drew them.

## States

- Nothing holds it: Archive is offered.
- Archived: the plan repository reads read-only, with Undo.

## Words

`Held by`, `step <n>`, `in git`, `Archive <repository>`, `Undo`.

## Refusals

- Only a person presses Archive; no agent does, and it never merges (N-PRODUCT-15).
- The App's key stays on the server (N-PRODUCT-17).

## Open questions

- Who may archive: a workspace owner only, or every approver of the product.

## Source

/omni:brainstorm, PRD 2011: .omni-loop/delivery/inbox/2011-product-records/before-after.html

# Bug 2722: a product's page fails to load when it holds a roadmap with no repository

## Triage

- **Domain:** galaxy reads: the product home's roadmaps and the dashboard's dossier list
- **Risk:** critical — once a product holds a roadmap made on the Omni page, every member of the workspace loses the dashboard and that product's page, with no workaround
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/product-home/product-home.repository.test.ts`
- **Level:** unit
- **Red:** `product-home/product-home.repository: roadmaps: the answer does not parse: [0].number invalid_type (expected number); [0].repo invalid_type (expected string)` and `data/dossiers: dossier_list: the answer does not parse: [1].home_repo invalid_type (expected string); [1].repos[0] invalid_type (expected string); [1].kind invalid_value; [1].latest unrecognized_keys (roadmap, roadmap-prds)`

## Fix

A roadmap made on the Omni page for a product (PRD 2011) has no issue, so no number and no repository, and its dossier has kind `roadmap` and no home repository. The product home now reads a roadmap's number and repository as optional, and draws the row without them. The dashboard reads each dossier's kind first and sets aside every kind it does not count (concepts, roadmaps) before the strict read, so a new kind can no longer take the page down. The dashboard's case is reproduced in `apps/galaxy/src/data/dossiers.roadmap.test.ts`.

## Guard

none — the two reproductions now hold each reader to a product roadmap; a wider guard would be the demo seed carrying a product roadmap, so the boundary check (`schemas:verify`) reads one against the real database

## Mutation

mutation: no changed core file against origin/main (b8dac6ed): nothing to mutate

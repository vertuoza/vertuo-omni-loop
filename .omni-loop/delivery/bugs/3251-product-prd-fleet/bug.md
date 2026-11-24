# Bug 3251: the Fleet page's PRD count breaks on a product PRD (dossier_list does not parse)

## Triage

- **Domain:** the dashboard: the Fleet board's PRDs read (`apps/galaxy/src/data/dossiers.ts`, `workspaceDossiers`)
- **Risk:** medium — members of a workspace holding a product PRD see the Fleet page's PRD count as out of reach; the rest of the page works, and each PRD's own page still opens
- **Regression:** yes — #1551 (`13cfc815e`, migration `20261203100000_product_prd_ids.sql`) made a product PRD's `home_repo` null, and the dashboard's read kept requiring a string

## Reproduction

- **File:** `apps/galaxy/src/data/dossiers.product.test.ts`
- **Level:** unit
- **Red:** `Error: data/dossiers: dossier_list: the answer does not parse: [2].home_repo invalid_type (expected string); [2].repos[0] invalid_type (expected string)`

## Fix

A product PRD's dossier has no home repository, so `dossier_list()` returns `home_repo: null` and `repos: [null]` for it, and the dashboard's strict read threw for the whole list. The first, loose read now also reads each row's home repository, and a row with none (a product PRD, keyed by its product) is left out before the strict read, as concepts and roadmaps already are: the board counts PRDs by their repository and number, and a numbered product PRD must never count as a draft idea.

## Guard

none — the reproduction is the cheap check for this row shape; a check matching every strict read against the database's nullable columns is not guard-sized

## Mutation

not set here — `pnpm mutation:changed` mutates the kit's delivery core only, and this fix changes none of it

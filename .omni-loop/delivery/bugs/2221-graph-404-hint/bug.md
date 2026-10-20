# Bug 2221: the product graph's 404 for a bare node id names no prefixed match

## Triage

- **Domain:** the knowledge graph API (PRD 1798), `apps/galaxy/src/knowledge-graph/`
- **Risk:** medium — a person or an agent reading a product's graph by a bare rule id gets a dead-end 404 naming nothing; the workaround is to type the repository-prefixed id (Jev, 0.99)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/knowledge-graph/product-graph.controller.test.ts`
- **Red:** `+     "error": "No node BR-PRODUCT-3 in the knowledge graph of omni-loop.",` where `"No node BR-PRODUCT-3 in the knowledge graph of omni-loop. Did you mean vertuo-omni-loop/BR-PRODUCT-3?"` was expected

## Fix

A product's graph prefixes every repository node's id with its repository's short name (PRD 1798), so a bare id like `BR-PRODUCT-120` is rightly no node, but the 404 said nothing more. The walk now names the repository nodes a bare id stands for (`prefixedMatches` in `walk.ts`), the service carries them on its `no-node` answer, and the controller's 404 ends with `Did you mean <id>[ or <id>]?` when there is at least one. The status and the refusal's shape are unchanged.

## Guard

none — the reproduction is the cheap check: the controller's 404 test had pinned the bare refusal for exactly this case, and now pins the hint, with `prefixedMatches` tested on its own.

## Mutation

mutation: no changed core file against origin/main (e07addcc): nothing to mutate

# Bug 2954: every product MCP request rebuilds its whole access answer in the database

## Triage

- **Domain:** a product's knowledge MCP server (`apps/galaxy/src/product-mcp/`, `product_mcp_for_key()`)
- **Risk:** medium — every Omni app user and agent gets slow answers while the database runs above 80% CPU; nothing is lost or wrong, and every flow still works, only slower.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/product-mcp/product-mcp.controller.test.ts`
- **Level:** unit, through the route's handler driven by the MCP SDK's client over a stubbed repository
- **Red:** `AssertionError: expected [ 'access acme-app', …(5) ] to have a length of 1 but got 6`

## Fix

The route asked `product_mcp_for_key()` on every request of an agent session (initialize, the tool list, each call), and each rebuilt the product, its repositories, the law home and `product_knowledge_for_agents()`: ~730k calls a month at ~10 ms, ~11% of production database time. Now the server keeps a served access for 60 seconds per key hash and product (`access-cache.ts`, at most 500, never the key, never a refusal), and serves a kept access only once three small reads on that same request confirm it still holds: `api_key_of()` answers the same key id (key not revoked, maker still a member), the product's server is still on and the product not archived, and each repository's newest pack is the one kept. Anything else drops it and asks `product_mcp_for_key()` again, so PRD 2707's settled behaviours (leaving ends access at once, BL-ACCESS-1 and BR-PRODUCT-64; a server turned off answers 404 on the next call; a merge reaches the next call, BL-PRODUCTKNOWLEDGE-4) are kept, and each call is still logged under the key's id from the kept access. The 60 seconds only bound how stale the product's name, its repository list, its law home, its Legal entries and its Glossary may be: no law or Legal entry promises those on the next call.

## Guard

The reproduction counts `product_mcp_for_key()` calls in one agent session and fails on main's code (6 for 1); beside it, the controller tests prove a kept access is checked on every call and dropped by a revoked key, a departed maker, a server turned off and a new pack, that a refusal is never kept, and that each call is logged under the key's id. `access-cache.test.ts` pins the 60 seconds, the per key and product entries and the 500 bound.

## Mutation

mutation: no changed core file against origin/main (7bfc0391): nothing to mutate

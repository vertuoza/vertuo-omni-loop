# Bug 3250: the knowledge MCP's GET answers a stream that closes, so every client reconnects every few seconds

## Triage

- **Domain:** product knowledge MCP (`apps/galaxy/src/product-mcp/product-mcp.controller.ts`)
- **Risk:** high — every member and runner waits 5–8 s on each Omni call, because the reconnects double the requests to Supabase; everything still works, only slowly (Jev, 0.57)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/product-mcp/product-mcp.methods.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 200 to be 405 // Object.is equality

## Fix

A signed-in GET reached the key check, the product's reads and the SDK's transport, which opened an event stream and closed it as the stateless server closed, so every MCP client opened it again within seconds: about 3.4 GET a second in production, each one three database calls. The handler now answers any method but POST with 405 and `Allow: POST` before any sign-in check or database read, as the MCP spec asks of a server with no stream; POST is unchanged. The reproduction was first written in `product-mcp.controller.test.ts`, then moved to a file of its own so the proof of BR-ACCESS-9 stays untouched.

## Guard

The reproduction is the guard: four unit tests, in `product-mcp.methods.test.ts`, that a GET (with a key, a sign-in or none) and a DELETE answer 405 without asking the database or the Auth server, even with no database, and that the SDK's own client still connects and answers while its one GET is the 405.

## Mutation

mutation: no changed core file against origin/main (ee027cfd): nothing to mutate

## Still open

- `/api/mcp` (src/agent-connect/mcp/server.ts) is built the same stateless way and likely answers its GET with the same closing stream; it was not changed here.

# Bug 3260: the agent-connect MCP's GET answers a stream that closes, so a client would reconnect every few seconds

## Triage

- **Domain:** agent-connect MCP link (`apps/galaxy/src/agent-connect/mcp/server.ts`)
- **Risk:** low — no one is hurt today: production sends `/api/mcp` no traffic, and its GET reads no database; a client that connects would open a function call every few seconds for nothing (Jev, 0.65)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/agent-connect/mcp/server.methods.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 200 to be 405 // Object.is equality

## Fix

A GET on `/api/mcp` reached the SDK's stateless transport, which opened an event stream and closed it at once, so any MCP client would have opened it again within seconds, as `/api/products/<key>/mcp` did before #3254. The handler now answers any method but POST with 405 and `Allow: POST` before the token is read, as the MCP spec asks of a server with no stream; POST is unchanged. The reproduction sits in a file of its own, so the proof of BR-PRODUCT-66 (`server.test.ts`) stays untouched. It closes the follow-up #3250 filed (its file is removed).

## Guard

The reproduction is the guard: four unit tests that a GET (with a link or none) and a DELETE answer 405 without asking the database, even with no database, and that the SDK's own client still connects and lists its four tools while its one GET is the 405.

## Mutation

mutation: no changed core file against origin/main (d2aa7219): nothing to mutate

---
id: s4-04-t3-signin-built-from-source
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The sign-in to T3 and the stop of a running thread were built from T3's source code, not tried on a running T3. Should they ship before someone tries them on the machine?

## The decision, in plain words

They ship, tested against T3's exchanges as its source defines them. The first real try is the person's, with the sign-in command on the laptop; until it works, accounts simply hand off at their wall.

## The intro, for fun

The runner learnt T3's secret handshake from the manual, not from a real handshake.

## The punchline, for fun

The first date on the laptop will tell.

## The options, in plain words

A. Ship the sign-in and the stop as built from T3's source, tested on recordings made from it (built).
B. Hold them until a recording from a running T3 replaces the built ones.

## What I had to decide

The laptop trial recorded `thread start` and `thread show`, not the OAuth sign-in nor an MCP stop. `kit/lib/runner/t3-mcp.ts` follows T3 0.1.3's `apps/server/src/auth/McpOAuth.ts` and `mcpOAuthHttp.ts`: a public client registered at `/oauth/mcp/register`, Full access approved at `/oauth/mcp/decision` with a pairing code from `t3 auth pairing create --json`, PKCE S256, a form-encoded exchange at `/oauth/mcp/token`, a 30-day credential; then `initialize`, `notifications/initialized` and `tools/call t3_thread_interrupt` on `/mcp`. The fixtures `oauth-*.json`, `pairing-create.json` and `mcp-*.sse` are built from that source, not recorded. T3 issues no refresh token: after 30 days the account reads `T3 sign-in missing: planned handoffs off` until `omni runner t3-signin` runs again.

## What I did meanwhile

A sign-in that fails breaks nothing: `interrupt()` is `null`, the account hands off at its wall only, and the runner says so when it starts.

## What it costs to change later

Refreshing a recording and adjusting one exchange.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether T3's decision endpoint takes a pairing code with no browser session in practice (author)

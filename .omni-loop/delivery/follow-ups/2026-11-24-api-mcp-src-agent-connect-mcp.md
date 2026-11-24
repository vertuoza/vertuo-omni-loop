---
source: bug #3250
date: 2026-11-24
repos: [vertuoza/vertuo-omni-loop]
---

`/api/mcp` (src/agent-connect/mcp/server.ts) is built the same stateless way and likely answers its GET with the same closing stream; it was not changed here.

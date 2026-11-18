---
prd: 3007
title: Agents read the product's knowledge through the kit, with their own sign-in
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge, access]
---

**Date:** 2026-11-17 · **PRD:** #3007 · **After:** PRD 2707 (a product's knowledge over MCP), PRD 1628
(the kit token, `OMNI_TOKEN`), PRD 2313 (a repository's MCP servers on a runner) · **Touches:**
`apps/galaxy/src/product-mcp/` (the route accepts the kit's sign-in), `supabase/migrations/` (one
migration), `supabase/checks/product_mcp.sql`, `kit/lib/knowledge/` (the `omni mcp` server and
`omni kb search` / `kb get`), `kit/plugin/` (the plugin declares the server, the skills read it),
`docs/guide/api.md`.

## Problem

PRD 2707 put a product's knowledge (its business laws, ADRs, rules and invariants, Legal entries,
words and Never lines) behind an MCP server, `/api/products/<key>/mcp`, with two tools,
`search_knowledge` and `get_knowledge`. Agents still rarely read it:

1. **Only a person who set it up by hand gets it.** The server takes a workspace API key (`oma_…`)
   and nothing else. A person must make a key on Settings › API keys, then run the `claude mcp add`
   line the Product settings card shows. Nothing in the kit does it, so a teammate who did not has
   no product knowledge in their sessions.
2. **Runners never get it.** A runner job of a fixed skill (`/omni:yolo`, `/omni:wave`,
   `/omni:bug-fix`…) loads no MCP server; PRD 2313 loads a repository's `.mcp.json` only for a
   repository's own skill. The agents that decide the most alone read the least.
3. **The kit already holds a credential that would do.** Every `omni` command signs in to the Omni
   page: on a laptop with `omni signin`, on a runner with its kit token, `OMNI_TOKEN`. That sign-in
   is a member of the workspace, which is exactly whom the MCP server serves. It is not accepted.
4. **No skill tells the agent to look.** The briefing says "read the knowledge the change touches";
   no skill names the product's knowledge search, so an agent decides from the repository's own
   files only, and an outbox item cites no id.

## Solution

Every agent working on a product reads the product's knowledge with the sign-in it already has,
and with nothing to set up.

1. **The route accepts the kit's sign-in.** `/api/products/<key>/mcp` serves a request whose
   `Authorization: Bearer <token>` is either a workspace API key (`oma_…`, as today) or an access
   token of the kit's sign-in, the one `omni signin` keeps or `OMNI_TOKEN` is traded for. An access
   token is checked as every other kit call checks it (`apps/galaxy/src/ask/auth.ts`), then served
   under the same rules as a key: its person is a member of the product's workspace now, the
   product is on, and not archived. A person who left the workspace reads nothing on their next
   call. An `oma_` key is served exactly as today.
2. **The search log names the person.** A call served through a sign-in writes its search-log row
   with the person's id in a new nullable column and no key id; a call served through a key writes
   its row as today. Rows keep their 90-day retention (`mcp_search_log_forget()`), and a deleted
   account's id is set to null (L-GDPR-3).
3. **`omni mcp`: the kit's own MCP server.** A new command runs a stdio MCP server with the same two
   tools, `search_knowledge` and `get_knowledge`, the same inputs and the same instructions. Each
   call is sent on to `/api/products/<key>/mcp` with the current sign-in, through the kit's existing
   client (`kit/lib/ask/client.ts`): renewed once on a 401, traded from `OMNI_TOKEN` when it is set.
   The product is the one `omni product which` gives for the repository. It writes no key, no
   token and no file. It speaks no word to the server before the agent's first call, so a session
   that never searches costs nothing.
4. **The plugin declares it.** The omni plugin carries the server as `omni-knowledge`, so every
   Claude Code session with the plugin has it, and so does every runner job, fixed skills included:
   a runner's sign-in is its `OMNI_TOKEN`. A server a person added by hand with an `oma_` key keeps
   working beside it.
5. **`omni kb search <query>` and `omni kb get <id>`.** The same two calls from the terminal, for an
   agent with no MCP: the hits, best first, each with its id, kind and repository, and one entry
   whole.
6. **One line when it cannot answer.** Each tool and each command answers one line, and never
   waits past the kit's call timeout:

   | case | the line |
   |---|---|
   | no sign-in | `Not signed in to the Omni page: run omni signin.` |
   | the product's knowledge is off | `This product's knowledge is off: a workspace owner turns it on in Product settings.` |
   | the repository is in no product | `This repository is in no product: its knowledge is in omni kb show.` |
   | the Omni page unreachable | `The Omni page is unreachable: carry on with omni kb show.` |

7. **The skills search before they decide.** `/omni:do-work`, `/omni:wave`, `/omni:yolo`,
   `/omni:bug-fix`, `/omni:plan`, `/omni:brainstorm` and `/omni:pr-care` each gain one rule: before
   deciding anything the spec does not settle, search the product's knowledge (`search_knowledge`,
   else `omni kb search`), read what it relies on whole, and cite the ids in the outbox item that
   records the decision.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `mcp_search_log.user_id` | no written convention: follows `mcp_search_log.api_key_id` ← supabase/migrations/20270119090000_mcp_search_log.sql:33 |
| vertuo-omni-loop | db | `product_mcp_for_member()` | no written convention: follows `product_mcp_for_key()` ← supabase/migrations/20270119090000_mcp_search_log.sql:95 |
| vertuo-omni-loop | api | the sign-in check in `product-mcp.service.ts` | follows `authenticate()` ← apps/galaxy/src/ask/auth.ts, used by apps/galaxy/src/business-api/api.ts:53 |
| vertuo-omni-loop | kit | `omni mcp`, `kit/lib/knowledge/mcp-server.ts` | no written convention: follows the hand-written MCP calls of kit/lib/runner/t3-mcp.ts |
| vertuo-omni-loop | kit | `omni kb search`, `omni kb get` | no written convention: follows `omni kb legal`, `omni kb glossary` |
| vertuo-omni-loop | kit | the plugin's server `omni-knowledge` in `kit/plugin/.mcp.json` | no written convention: follows the hooks' command line in kit/plugin/hooks/hooks.json |

## Decisions

- **The sign-in, not a new key.** Asked in the design: the MCP uses the session's own sign-in, and on
  a runner the key it has (`OMNI_TOKEN`). Rejected: a repository `.mcp.json` with an `oma_` key in a
  variable (a key to make and spread on every laptop and runner), and the terminal commands alone
  (no MCP in the kit).
- **A local stdio server, not the HTTP URL in the plugin.** The plugin cannot hold a token, and the
  kit's sign-in renews itself; a local server sends each call with the sign-in current at that
  moment.
- **No MCP library bundled.** The server speaks the few JSON-RPC messages it needs by hand, as
  `kit/lib/runner/t3-mcp.ts` already does; the built kit's notices (L-LICENSE-2) stay unchanged.
- **The voice's objection, accepted.** persona:B-E DEv objected that one more MCP in every session
  is fluff that may slow them down or answer junk (also persona:F-E Developer: agents cause bugs in
  production). Met: the server calls nothing before the first search, a failure is one line within
  the call timeout, every hit carries its id and source, and the agent cites the ids it used, so a
  reviewer checks them.
- **No proof video.** Asked: no.

## User stories

- As a developer on a product, my Claude sessions read the product's business laws and ADRs
  without my making an API key.
- As a person who sends a PRD to a runner, the runner's agents search the same knowledge mine do.
- As a reviewer, an outbox item names the knowledge ids the agent relied on, so I can check its
  reasoning.
- As a workspace owner, turning the product's MCP off stops every agent, keys and sign-ins alike.

## Scope

In: the route's sign-in, its migration and checks, `omni mcp`, `omni kb search` and `kb get`, the
plugin's server, one rule in seven skills, `docs/guide/api.md`.

Out: writing knowledge through MCP; how search ranks; removing `oma_` keys or the agent link
(`/api/mcp`); the Product settings card's words (its key-based setup lines stay true).

## Test seams

Following `omni kb show testing`: vitest, no network, no GitHub.

- **Route:** `product-mcp.controller.test.ts` with a fake service: a member's access token is
  served as a key is; a token whose person left, a product off, an archived product and a bad token
  are each refused as today's key cases are.
- **Database:** `supabase/checks/product_mcp.sql`: `product_mcp_for_member()` answers for a member
  only; the log row takes a person and no key.
- **Kit server:** `omni mcp` over a fake stdio and a fake `fetch`: `initialize`, `tools/list`, both
  tools, the 401 renewal, and each line of the failure table.
- **Kit commands:** `omni kb search` and `kb get` print the same hits as the tool.
- **Plugin:** a test reads `kit/plugin/.mcp.json` and checks it declares `omni-knowledge` running
  `omni mcp`.
- **Skills:** the seven skills name the search rule (the existing skill-text tests).

## Risks

Merging publishes the route change with the next galaxy deploy, one migration, and the kit's next
release (the plugin then starts `omni-knowledge` in every session). Rollback: revert the feature PR;
the migration only adds a nullable column and a function, and a revert of the route leaves them
unused.

- If the plugin's server fails to start in some agent, that session simply lacks the tools; it is
  never blocked.
- The plugin's server must find `omni` from the session's directory; a repository without the kit
  installed answers the "no product" line, never an error.

**The Legal entries:**

- L-GDPR-1: the search log now names a person; only the workspace's members and the service role
  read it, as today. Kept.
- L-GDPR-2: no token is written or logged; the log keeps the person's id, never the token. Kept.
- L-GDPR-3: a deleted account's id is set to null in the log. Kept.
- L-GDPR-4: the log keeps its 90-day retention. Kept.
- L-LICENSE-2: no library is bundled. Kept.

**The locked laws:**

- BR-PRODUCT-63: an agent could read another team's private work. The sign-in reads only its own
  workspace's products. Kept. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- BR-PRODUCT-64: a person who left could still read the team's work through an agent. Membership
  is checked on every call. Kept. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- N-PRODUCT-15: unreviewed work could reach every user. Nothing here merges. Kept. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

**The business laws:**

- BL-ACCESS-1 (a person who leaves loses every access at once, tokens included): kept. The sign-in
  is checked for membership on every call, and nothing is cached past the existing minute that
  bug #2954 re-checks against the database.
- BL-GATE-1 (a check that ends without deciding says "not judged"): kept. A tool that cannot answer
  says why in one line, and never returns an empty list as if nothing applied.
- BL-PRODUCTKNOWLEDGE-1 to 3 (who may change Legal and the Glossary, and their history): kept. The
  server stays read-only.
- BL-PRODUCTKNOWLEDGE-4 (a merge's knowledge reaches its product): kept. The kit reads the packs the
  merge already sends.
- BL-APPROVALS-1 and BL-ASK-1: not touched. The outbox items that cite ids are the agent's own words.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: A member's sign-in reads the product's knowledge
  Given a product whose MCP server is on
  And a member of its workspace signed in to the Omni page
  When their agent searches the product's knowledge
  Then it gets the same hits an API key of the workspace gets
```

### AC-2 · test

```gherkin
Scenario: A person who left the workspace reads nothing
  Given a person signed in to the Omni page who has left the product's workspace
  When their agent searches the product's knowledge
  Then the search is refused as a bad API key is
```

### AC-3 · test

```gherkin
Scenario: The product's switch stops sign-ins too
  Given a product whose MCP server is off
  When a member's agent searches through the kit
  Then it answers "This product's knowledge is off: a workspace owner turns it on in Product settings."
```

### AC-4 · test

```gherkin
Scenario: A runner reads with its kit token
  Given a runner whose OMNI_TOKEN belongs to a member of the workspace
  When a fixed skill's agent calls search_knowledge through omni mcp
  Then the kit trades the token for an access token and the search is served
```

### AC-5 · test

```gherkin
Scenario: Signed out, the tool says what to do
  Given a terminal with no sign-in and no OMNI_TOKEN
  When an agent calls search_knowledge through omni mcp
  Then it answers "Not signed in to the Omni page: run omni signin."
```

### AC-6 · test

```gherkin
Scenario: Nothing is called before the first search
  Given a session that started omni mcp
  When the agent lists the tools and never calls one
  Then no request reaches the Omni page
```

### AC-7 · test

```gherkin
Scenario: The plugin carries the server
  Given the omni plugin
  When a session starts with it
  Then the server omni-knowledge is declared, running omni mcp
```

### AC-8 · test

```gherkin
Scenario: The terminal reads the same knowledge
  Given a member signed in to the Omni page
  When they run omni kb search "API keys"
  Then it prints the hits search_knowledge returns, each with its id
```

### AC-9 · test

```gherkin
Scenario: A sign-in's search is logged under its person
  Given a member's agent searches through the kit
  When the answer is sent
  Then the search log's row names that person and no API key
```

### AC-10 · test

```gherkin
Scenario: The skills tell the agent to search first
  Given the skills do-work, wave, yolo, bug-fix, plan, brainstorm and pr-care
  When an agent reads one
  Then it says to search the product's knowledge before deciding what the spec does not settle, and to cite the ids in the outbox item
```

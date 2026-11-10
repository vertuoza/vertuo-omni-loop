---
prd: 2707
title: A product's knowledge over MCP, with the API key
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge, access]
---

**Date:** 2026-11-10 · **PRD:** #2707 · **After:** PRD 855 (the agent link, `/api/mcp`), PRD 1798 (the
knowledge graph API), PRD 2011 (knowledge packs), PRD 2022 (API keys), PRD 2632 (business laws) ·
**Touches:** `supabase/migrations/` (one migration), `supabase/checks/product_mcp.sql` (new),
`apps/galaxy/src/product-mcp/` (new), `apps/galaxy/app/api/products/[key]/mcp/route.ts` (new),
`apps/galaxy/src/product-knowledge/settings/` (one card), `kit/lib/playbook/decisions.ts` (a pure reader
of one record's text), `docs/guide/api.md`.

## Problem

An agent that writes code for a product should build on the product's own knowledge: its business laws,
the decisions behind its architecture (ADRs), its rules and invariants, its Legal entries and its words.
Most of that knowledge already reaches the server. Agents still cannot read it:

1. **The server holds the knowledge, but no agent can read it.** On every merge, the App copies each
   repository's knowledge folder (registers, `business-laws.md`, ADRs, playbook) to the server as a
   **knowledge pack** (PRD 2011, `supabase/migrations/20261212100000_knowledge_packs.sql`). The business-law
   judge reads those packs (`apps/galaxy/src/business-laws/law-home.ts`). `knowledge_pack_for_token()`
   was written for agent links, but no route calls it.
2. **The MCP link reads only part of it.** `/api/mcp` (PRD 855, `apps/galaxy/src/agent-connect/mcp/server.ts`)
   answers the business, the claims, the Legal entries, the Glossary, and the knowledge graph from a start
   id (PRD 1798). A business law (`BL-…`) is not a graph node at all. An ADR is a node with only its id
   and title, so an agent can see that ADR-0067 exists but cannot read what it decided.
3. **An agent cannot find knowledge by topic.** The graph walks from an id. "What applies to API keys?"
   has no answer unless the agent already knows the id.
4. **Programs use one key, agents another.** A program outside the loop reads the workspace with an API
   key (`oma_…`, PRD 2022, Settings › API keys). An editor agent needs a separate agent link (`omb_…`)
   made on another page. The person who connects an agent has two secrets to manage.
5. **Nothing says whether a product shares its knowledge.** The agent link reaches every product of the
   workspace. No owner chooses which products agents may read.

## Solution

**Each product can have its own MCP server.** It is off by default, and a workspace owner turns it on
from the product's settings. Any agent then connects to its URL with an API key the workspace already
has, and searches and reads the product's whole knowledge across all its repositories. Git stays the
source of truth (never#6): the server serves the copy the last merge left in the packs, and nothing new
is pushed.

### Product settings › MCP server

A card on Product settings (`/app/products/<id>/knowledge/settings`, `SettingsPanel`), after the existing
sections:

- **Off** (the default): the state `Off`, the line *"Agents can't read this product's knowledge yet."*,
  the line *"Then every API key reads it."*, and, for a workspace owner, the button **Turn on**.
- **On**: the state `On`, then:
  - the line *"Any workspace API key reads its knowledge."*;
  - the URL `<omni>/api/products/<key>/mcp`, with **Copy**;
  - **Copy for Claude Code** (copies `claude mcp add --transport http <key>-knowledge <url> --header
    "Authorization: Bearer oma_…"`) and **Copy for Cursor** (copies its `mcp.json` entry);
  - *"Keys: Settings › API keys"*, linked to `/app/settings/api-keys`;
  - for a workspace owner, the button **Turn off**, with *"Stops agents on their next call."*
- `docs/guide/api.md` explains the rest: any other MCP client (the URL and the header), and a key limited
  to some repositories reading only their part.
- A member who is not an owner sees whether it is on, and the URL and copy buttons when it is, but no
  Turn on or Turn off.

### The endpoint: `/api/products/<key>/mcp`

A stateless Streamable HTTP MCP server, built like `/api/mcp` (`handleMcp`, a new server for each request).
It is read-only and offers two tools.

**Who gets in.** The route takes `Authorization: Bearer oma_…`, hashes it (`hashToken`) and calls
`product_mcp_for_key(hash, key)`. That function answers only when all of these hold:

- the key is live;
- its maker is still a member of the workspace (BR-PRODUCT-64, kept);
- the product belongs to the key's workspace (BR-PRODUCT-63, kept);
- the product's MCP is on.

When the key has a list of repositories, it reaches the product only if the list names at least one of
the product's repositories. The function then answers the repositories the key may read, and nothing of
the others. A key with an empty list reads every repository of the product.

- **A product that is off, unknown, from another workspace, or out of the key's reach** gets the same
  answer: HTTP 404 `{error: "No MCP server here."}`. A caller never learns whether a product exists.
- **A missing, malformed, wrong or revoked key** follows ADR-0067: the client connects and lists the
  tools, and each call answers, as a tool error, *"This API key does not work here. Make one on Settings ›
  API keys, and check the product's MCP server is on."* A malformed key never reaches the database.
- No database here: HTTP 503, as `/api/mcp` answers.

**What it reads.** For each repository the key may read, the newest knowledge pack of that repository,
plus the product's own rows: Legal entries, Glossary terms and live Never lines, read the way
`product_knowledge_for_agents()` reads them. Business laws are read from the pack of the product's law
home (`product_law_home()`), the same files the judge reads. The entries are built anew on each call;
packs are small, and a cache can come later if it is ever needed.

**The entries.** A pure function, `knowledgeEntries`, turns the pack files and product rows into one list.
Each entry is `{id, kind, title, repo, domain, body, file, status}`:

| kind | from | id | body |
|---|---|---|---|
| `business-law` | the law home's `business-laws.md` files, through `parseBusinessLaws` | `BL-QUOTES-1` | statement, Why, domains, owner |
| `adr` | each pack's `paths.adr` files, through the new `parseDecisionRecord` | `<repo>/ADR-0067` | the record's whole text |
| `rule` | each pack's registers, through `readKnowledge` on `memorySource(pack files)` | `<repo>/BR-PRODUCT-3` | the entry's text, its kind (principle, rule, invariant, law), its status |
| `legal` | `product_legal` | `L-GDPR-2` | statement, source, owner |
| `term` | `product_glossary` | `term:API key` | meaning, words to avoid |
| `never` | `constituents` | `never#6` | the line |

Repository ids carry the repository's short name, as the knowledge graph names them (PRD 1798), so two
repositories that both hold an `ADR-0012` never collide. Product ids carry none.

**The tools.**

| tool | input | answers |
|---|---|---|
| `search_knowledge` | `query?`, `kind?`, `domain?`, `repo?` | `{hits: [{id, kind, title, repo, domain, snippet}], total, repositories}`: at most 20 hits, the best first; with no `query`, every entry matching the filters, in id order, also capped at 20, with `total` saying how many there are |
| `get_knowledge` | `id` | `{entry, repositories}`: the one entry, its body whole |

- **The search uses no model.** The query is split into words, compared without case and without
  accents. An entry scores by where each word is found: the id, then the title, then the body, and an
  entry missing a word scores 0 and is left out. A tie is broken by id. The snippet is the body's first
  sentence that holds a word, up to 200 characters.
- **`repositories`** goes with every answer: each repository of the product the key may read, with the
  pack's commit and when it was kept, or `pack: null` with *"no pack yet: it fills on the next merge"*.
  A repository with no pack never fails a call (BL-PRODUCTKNOWLEDGE-4, kept: a merge reaches the
  product on its own).
- `get_knowledge` on an id the product does not hold answers, as a tool error: *"No knowledge entry
  <id> in <product>. Search for it with search_knowledge."*
- The server's instructions tell the agent to search before it decides anything the knowledge may
  settle, to read what it relies on with `get_knowledge`, and to cite the ids it relies on
  (`BL-QUOTES-1`, `vertuo-omni-loop/ADR-0067`).

### The store

One migration, dated after the newest on `main`, `20270114090000_product_mcp.sql`. It adds things and
changes nothing that exists:

- `products.mcp_enabled boolean not null default false`.
- `product_mcp_set(p_product uuid, p_on boolean)`: security definer. Only a workspace owner of the
  product's workspace may call it; anyone else gets 42501. It answers the new state, and turning it on
  twice changes nothing. An archived product refuses it (PRD 2232: archived is read-only).
- `product_mcp_for_key(p_hash text, p_key text)`: security definer, the service role's only, as
  `api_key_of()` is. It applies the rules under **Who gets in**, then answers
  `{product: {id, key, name, workspace_id}, repositories: [{repo, pack_id, sha, committed_at}],
  law_home}`, or nothing. It writes `last_used_at` the way `api_key_of()` does: at most once a minute.
- The product read (`product_home`, or the settings page's read) gains `mcpEnabled`, so the card draws
  without a second request.
- `supabase/checks/product_mcp.sql` proves:
  - only an owner switches it;
  - off reads nothing;
  - another workspace's key reads nothing;
  - a revoked key, or one whose maker left, reads nothing;
  - an allow-list naming none of the product's repositories reads nothing;
  - one naming some reads only those;
  - an empty allow-list reads them all.

  The `supabase` workflow runs it like the other checks (ADR-0028).

### What stays as it is

`/api/mcp` and the agent links (`omb_…`) do not change, and agents connected through them keep working.
Retiring them, or moving them under a product, is for a later PRD.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `products.mcp_enabled` | no written convention: follows `products.plan_repository` ← supabase/migrations/20261212100000_knowledge_packs.sql |
| vertuo-omni-loop | db | `product_mcp_set()`, `product_mcp_for_key()` | no written convention: follows `product_plan_repository_set()` and `api_key_of()` ← supabase/migrations/20261212100000_knowledge_packs.sql, supabase/migrations/20261210090000_api_keys.sql |
| vertuo-omni-loop | api | `apps/galaxy/app/api/products/[key]/mcp/route.ts` | no written convention: follows `apps/galaxy/app/api/products/[key]/knowledge/graph/route.ts` |
| vertuo-omni-loop | api | `apps/galaxy/src/product-mcp/` with `product-mcp.contract.ts`, `.controller.ts`, `.service.ts`, `.repository.ts` | ADR-0095 ← .omni-loop/knowledge/adr/0095-*.md (client → controller → service → repository) |
| vertuo-omni-loop | api | tools `search_knowledge`, `get_knowledge` | no written convention: follows `get_business`, `get_knowledge_graph` ← apps/galaxy/src/agent-connect/mcp/server.ts:168 |
| vertuo-omni-loop | kit | `parseDecisionRecord(file, text)` | no written convention: follows `parseBusinessLaws(file, text, place)` ← kit/lib/knowledge/business-laws.ts:99 |
| vertuo-omni-loop | ui | `McpServerCard` in `apps/galaxy/src/product-knowledge/settings/` | no written convention: follows `SettingsPanel.tsx` |

## Decisions

1. **The packs are the store; nothing new is pushed** (asked: the person chose *Read the packs*). The App
   already copies every repository's knowledge on each merge, and the judge already reads them. A new
   push or index would copy the same files again, and teams would have to remember to run it.
2. **Two tools, search and get** (asked: the person chose *search + get*). With no query, search lists
   entries, so an agent needs no tool per kind.
3. **One MCP server per product, switched on Product settings, reached by the workspace's API keys**
   (asked: the person's own words: "the MCP should be on the PRODUCT Settings and the current one would
   get access to EACH, enabled/disabled in settings, and once enabled give you a URL"). No new kind of
   key is made.
4. **A key's list of repositories still applies** (taken here, the most reversible: widening later
   breaks nothing, narrowing later would). A key limited to some repositories reaches a product only
   through them, and reads repository entries only from them. Product entries (business laws, Legal,
   Glossary, Never lines) are whole for any key that reaches the product: they belong to the product,
   not to one repository.
5. **Off by default, and only an owner switches it** (taken here). It opens the product's knowledge to
   programs, a workspace-wide choice like the API keys themselves, which only owners make.
6. **A bad key still connects and answers with one line** (taken here: ADR-0067, as `/api/mcp` does).
   A product that is off or out of reach answers 404, so no caller can probe which products exist.
7. **The search uses words, with no model** (taken here). It is free, gives the same answer every time,
   and is enough for a few hundred entries. A smarter search can come in a later PRD once agents use
   this one.
8. **`/api/mcp` is left alone** (taken here). Agents connected to it keep working. Its future is a
   later PRD.
9. **The voice: the B-E DEv objected at design** (persona:B-E DEv): *"Another URL and key to paste is fluff
   to me, unless my agent finds the right ADR without me knowing its number."* **Settled: accepted.**
   `search_knowledge` finds entries by plain words, and the card gives a one-line setup command.

## User stories

- As a workspace owner, I turn on a product's MCP server on its settings and copy its URL, so our agents
  can read that product's knowledge and no other product's.
- As a developer, I paste one command into Claude Code with an API key we already have, and my agent
  reads our business laws and ADRs before it writes code.
- As an agent, I search "API key" and get the ADRs, rules, Legal entries and terms that mention it, each
  with an id I can cite, then read the one I need whole.
- As a lead engineer, I know every agent of the team reads the same decisions, from the last merge, in
  every repository of the product.
- As a workspace owner, I turn the server off, and every agent connected to it stops reading on its next
  call.

## Scope

**In:** `products.mcp_enabled`, `product_mcp_set()`, `product_mcp_for_key()` and their check; the
`/api/products/<key>/mcp` route and its two tools; the pure entry builder and search; a pure ADR text
reader in the kit; the Product settings card; `docs/guide/api.md` (a section on connecting an agent).

**Out:**
- A new kind of key, or a "knowledge" permission on an API key.
- Writing knowledge through MCP, and `report_unknown` on this endpoint.
- Any change to `/api/mcp` or the agent links.
- A search model or embeddings, and a cache.
- New nodes in the knowledge graph.
- Packs for repositories the App does not harvest.
- Rate limiting.

## Test seams

Following `omni kb show testing`: tests for the behaviour at the lowest level that proves it; no test
calls GitHub or a model; every fixture is fictional (never#11, never#12): an "Acme" product, made-up laws
and ADRs, no real key.

- **`kit/lib/playbook/decisions.test.ts`:** `parseDecisionRecord` reads a record's number, title, status
  and whole text from its file name and text alone, and gives `title: null` with no `# ` heading, as
  `readDecisions` does.
- **`apps/galaxy/src/product-mcp/entries.test.ts`** (pure):
  - one entry per business law, ADR, rule, Legal entry, term and Never line of fixture packs and rows;
  - repository ids carry the repository's short name;
  - a repository with no pack adds no entry and reads `pack: null`;
  - business laws come only from the law home's pack.
- **`search.test.ts`** (pure):
  - the id outranks the title, and the title outranks the body;
  - case and accents are ignored;
  - an entry missing a word is left out;
  - filters by kind, domain and repository;
  - the 20-hit cap, with `total`;
  - no query lists entries in id order;
  - the snippet holds a query word.
- **`product-mcp.controller.test.ts`**, through the real MCP client over the route (as
  `agent-connect/mcp/server.test.ts` does), the repository stubbed:
  - a malformed key never reaches the stub, and a refused key answers the one line on each call;
  - a product that is off answers 404;
  - `search_knowledge` and `get_knowledge` answer the schema;
  - an unknown id answers its line;
  - an allow-list limits repository entries.
- **`supabase/checks/product_mcp.sql`:** every rule of **The store**, run by the `supabase` workflow.
- **`McpServerCard.test.tsx`:**
  - off and on;
  - an owner sees the button, a member does not;
  - the URL and the setup lines name the product's key.

## Risks

**What merging publishes:**
- one migration (a column with a default, two functions), which needs no coordinated deploy: the old
  galaxy ignores the column;
- a new route on galaxy;
- a card on Product settings;
- a guide section.

Nothing is reachable until an owner turns a product's server on.

**Rollback:** turn the products off (one update), revert the galaxy change, then a follow-up migration
drops the two functions and the column.

**What it exposes when on:** every live API key of the workspace reads that product's knowledge. Business
laws and Legal entries name their owner's GitHub login. That is personal data, read only by the
workspace's own keys (L-GDPR-1, kept). The card says before **Turn on** that every API key then reads it.

**The Legal entries it touches:**
- L-GDPR-1 (only a workspace's members read its personal data): kept. Only the workspace's own keys,
  made by its owners, reach the endpoint, and a key whose maker left reads nothing.
- L-GDPR-2 (credentials never stored or logged in clear): kept. The key is hashed before any read, as
  PRD 2022 does, and never logged.

**The locked laws it touches:**

- BR-PRODUCT-63: an agent could read another team's private work. Kept: `product_mcp_for_key()` reads
  only the key's own workspace. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Kept: a key
  whose maker left reads nothing. Changing it needs @pierrederval or @dervalp to approve the pull request
  on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, N-PRODUCT-16: the new
  migration sits in the folder these laws govern, but none of their tables or functions changes. Changing
  any of them needs @pierrederval or @dervalp to approve the pull request on GitHub.

**The business laws:**
- BL-ACCESS-1 (when a person leaves, every access they had through the workspace ends at once): kept.
  `product_mcp_for_key()` reads nothing for a key whose maker is no longer a member, from the next call.
- BL-PRODUCTKNOWLEDGE-4 (a merge that changes a repository's knowledge reaches its product without
  anyone doing anything): kept. The endpoint reads the packs the App keeps on each merge, and a missing
  pack is named, never hidden.
- BL-PRODUCTKNOWLEDGE-1, -2, -3: kept. The endpoint only reads; it proposes, changes and retires nothing.

## Acceptance criteria

- **Off by default.** A product never switched on answers `/api/products/<key>/mcp` with 404, for any
  key.
- **Only an owner switches it.**
  - A workspace owner turns the server on from Product settings, and the card then shows
    `<omni>/api/products/<key>/mcp` and its setup lines.
  - A member who is not an owner sees the state and the URL, with no Turn on or Turn off.
  - `product_mcp_set()` refuses that member.
- **Search across repositories.** With the server on, an agent connected with an API key of the workspace
  calls `search_knowledge` with "api key" and gets hits from more than one kind (for example an ADR, a
  rule and a term), each with an id carrying its repository when it has one.
- **The whole of an entry.** `get_knowledge` on an ADR id answers the record's whole text. On a `BL-…`
  id it answers the law's statement, Why, domains and owner.
- **Listing.** `search_knowledge` with `kind: "business-law"` and no query lists the product's business
  laws in id order.
- **The allow-list.** A key whose list names one of the product's two repositories reads repository
  entries from that one only. A key whose list names none of them gets 404.
- **Keys that do not work.** A revoked key, a key whose maker left, and a key of another workspace read
  nothing. A malformed key connects and answers the one line on each call, without reaching the
  database.
- **Turned off.** After an owner turns the server off, the next call of an agent already connected
  answers 404.
- **No pack yet.** A product repository with no pack yet is listed under `repositories` with
  `pack: null`, and every call still answers.
- **Nothing else moves.** `/api/mcp` answers as before.

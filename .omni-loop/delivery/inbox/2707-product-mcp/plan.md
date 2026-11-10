# Plan: a product's knowledge over MCP, with the API key

PRD #2707, specified in `spec.md` beside this plan. The feature branch `feat/product-mcp` merges into
`main` through the feature PR (`Closes #2707`). Each slice is a sub-PR from `feat/product-mcp--<slice>`
into the feature branch (`Part of #2707`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The kit reads one ADR from its file name and text alone (`parseDecisionRecord`), and `readDecisions` reads each file through it | `kit/lib/playbook/decisions` `kit/bin/kb-decisions.test.ts` | — | 1 | build |
| s2 | Each product remembers whether its MCP server is on, only an owner switches it, and `product_mcp_for_key()` answers a live key's readable repositories and their newest packs, or nothing | `supabase/migrations/20270114090000_product_mcp.sql` `supabase/checks/product_mcp.sql` `.github/workflows/supabase.yml` | — | 1 | deep |
| s3 | An agent connects to `/api/products/<key>/mcp` with an API key and searches and reads the product's business laws, ADRs, rules, Legal entries, terms and Never lines with `search_knowledge` and `get_knowledge` | `apps/galaxy/src/product-mcp/` `apps/galaxy/app/api/products/[key]/mcp/` | s1, s2 | 2 | deep |
| s4 | Product settings shows the MCP server card: its state, Turn on and Turn off for an owner, and the URL and copy buttons once on | `apps/galaxy/src/product-knowledge/settings/` | s2 | 2 | build |
| s5 | The guide explains how to connect an agent to a product's MCP server, any MCP client, and a key limited to some repositories | `docs/guide/api.md` | s3, s4 | 3 | light |

**Shared ground.** No prefix is declared by more than one slice. s3 and s4 share wave 2 and meet nowhere:
s4 writes the URL from the product's key itself, and imports nothing from `apps/galaxy/src/product-mcp/`.
`kit/dist/` is built from s1's sources and is listed nowhere: the wave rebuilds it after merging. The
layering baseline (`layering/`) and the fallow baselines (`fallow/`) are never edited to make a slice
green.

## Per slice: done when

### s1

- `parseDecisionRecord(file, text)` returns the record's number, file, title and status, and its whole
  text, from the file name and the text alone. With no `# ` heading, `title` is `null`, as `readDecisions`
  gives today.
- `readDecisions` returns exactly what it returns today on the repository's own `adr` folder:
  `kit/lib/playbook/decisions.test.ts` and `kit/bin/kb-decisions.test.ts` stay green unchanged, plus new
  cases for the parser.

### s2

- The migration is dated after the newest on `main` (`node scripts/migration-order.ts` passes), and only
  adds things: `products.mcp_enabled` (off by default), `product_mcp_set()` and `product_mcp_for_key()`.
  Each one has a comment, and the header names the rollback.
- `supabase/checks/product_mcp.sql`, run as a step of the `supabase` workflow (ADR-0028), proves every
  rule of the spec's **The store**:
  - only an owner switches it, and an archived product refuses;
  - with the server off, nothing is read;
  - another workspace's key reads nothing;
  - a revoked key, or one whose maker left, reads nothing (BR-PRODUCT-64, BL-ACCESS-1);
  - an allow-list naming none of the product's repositories reads nothing, one naming some reads only
    those, and an empty one reads all;
  - only the service role may call `product_mcp_for_key()`.
- Nothing existing changes: every other check stays green.

### s3

- The route answers 404 `{error: "No MCP server here."}` for a product that is off, unknown, of another
  workspace or out of the key's reach, and 503 with no database.
- A malformed key never reaches the database. A refused key connects, lists the two tools, and answers
  each call with the one line (ADR-0067).
- `knowledgeEntries` (pure) builds one entry per business law (the law home's pack only), ADR (whole
  text, through s1), rule (`readKnowledge` on `memorySource`), Legal entry, term and Never line. Repository
  ids carry the repository's short name.
- `search_knowledge` (pure search, no model):
  - ranks id over title over body;
  - ignores case and accents, and leaves out an entry missing a word;
  - filters by kind, domain and repository;
  - caps hits at 20 and gives `total`;
  - with no query, lists in id order.
- `get_knowledge` answers one entry whole, or the "No knowledge entry" line.
- Every answer carries `repositories`, with `pack: null` for a repository with no pack yet, and never fails
  because of it.
- The layers follow ADR-0095 (contract, controller, service, repository), and the layering guard passes.
- The tests run through the real MCP client over the route, with fixture packs of a fictional product only.

### s4 (`ui: yes`)

- The card follows the draft screen `product-knowledge-settings` (`.omni-loop/knowledge/design/screens/`):
  - Off shows its two lines and, for an owner, **Turn on**.
  - On shows its line, the URL with **Copy**, **Copy for Claude Code**, **Copy for Cursor**, the link to
    Settings › API keys and, for an owner, **Turn off** with its line.
- A member who is not an owner sees the state, and the URL and copy buttons when it is on, but no Turn on
  or Turn off. An archived product shows the state, read-only.
- The switch calls `product_mcp_set()` as the signed-in person, and the page shows the new state.
- `McpServerCard.test.tsx` covers off, on, owner, member, and the URL and setup lines naming the product's
  key. `omni design words` finds nothing new on the card.

### s5 (light: docs only)

- `docs/guide/api.md` gains a section on connecting an agent:
  - turning the server on;
  - the URL;
  - the Claude Code and Cursor setup, and any other MCP client (the URL and the header);
  - the two tools with one example each;
  - a key limited to some repositories reading only their part;
  - what 404 means.
- The guide's own tests (links, words) pass.

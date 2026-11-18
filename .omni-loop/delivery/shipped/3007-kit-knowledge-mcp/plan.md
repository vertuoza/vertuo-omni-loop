# Plan: agents read the product's knowledge through the kit, with their own sign-in

PRD #3007, spec beside this plan (`spec.md`). The feature branch `feat/kit-knowledge-mcp` merges
into `main` through the feature PR (Closes #3007); each slice is a sub-PR from
`feat/kit-knowledge-mcp--<slice>` into the feature branch (Part of #3007).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The product MCP route serves a member's kit sign-in as it serves an API key, and logs the search under the person | `apps/galaxy/src/product-mcp/` `apps/galaxy/app/api/products/[key]/mcp/` `supabase/migrations/2027` `supabase/checks/product_mcp.sql` | — | 1 | deep |
| s2 | `omni kb search` and `omni kb get` read the product's knowledge through the sign-in, with the one-line failures | `kit/lib/knowledge/product-mcp-client` `kit/bin/commands/kb.ts` `kit/bin/kb-search.test.ts` `kit/lib/help/` | — | 1 | build |
| s3 | `omni mcp` serves `search_knowledge` and `get_knowledge` over stdio, silent until the first call, and the plugin declares it as `omni-knowledge` | `kit/lib/knowledge/mcp-server` `kit/bin/commands/mcp.ts` `kit/bin/commands/index.ts` `kit/bin/mcp.test.ts` `kit/plugin/.mcp.json` `kit/test/plugin.test.ts` `kit/lib/help/` | s2 | 2 | build |
| s4 | Seven skills search the product's knowledge before deciding what the spec leaves open and cite the ids; the guide says how agents connect | `kit/plugin/skills/do-work/` `kit/plugin/skills/wave/` `kit/plugin/skills/yolo/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/plan/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/pr-care/` `kit/test/knowledge-search-skills.test.ts` `docs/guide/api.md` | s3 | 3 | light |

Shared ground: `kit/lib/help/` (each new command's help text) is declared by s2 and s3, which sit in
waves 1 and 2. `kit/dist/` is generated and listed by no slice: each slice rebuilds it only to test,
and the wave rebuilds it once after merging. s1 and s2 meet only at the route's contract (the
`Authorization` header and the two tools' answers, unchanged from PRD 2707), so they build in the
same wave; s2 is tested against a fake server.

## Per slice: done when

### s1 (deep: an access path and a migration) (`law: BR-PRODUCT-63 · owner @pierrederval`) (`law: BR-PRODUCT-64 · owner @pierrederval`)

It changes the files that enforce who an agent reads as: if broken, an agent could read another
team's private work, or a person who left could still read it, so the feature PR waits for
@pierrederval's approval on GitHub.


- A migration adds `mcp_search_log.user_id` (nullable, `references auth.users (id) on delete set
  null`) and `product_mcp_for_member(user, key)`, the service role's only, answering the same
  access `product_mcp_for_key()` answers, or null when the person is not a member of the product's
  workspace now, or the product is off or archived.
- The route checks a bearer that is not of an API key's shape with `authenticate()`
  (`apps/galaxy/src/ask/auth.ts`); a member is served the same hits as a key (AC-1); a person who
  left, a product off, an archived product or a bad token is refused as today's key cases are (AC-2).
- The access cache (bug #2954) keys a sign-in by its person and re-checks membership on every request.
- A sign-in's search log row names the person and no key (AC-9); a key's row is unchanged.
- `supabase/checks/product_mcp.sql` proves a non-member's sign-in reads nothing.

### s2

- `omni kb search <query>` prints the hits, best first, each with its id, kind and repository;
  `omni kb get <id>` prints one entry whole (AC-8).
- The calls go to `/api/products/<key>/mcp` with the current sign-in, through `kit/lib/ask/client.ts`
  (renewed once on a 401, traded from `OMNI_TOKEN` when it is set); the product is the one
  `omni product which` gives.
- Each failure is one line, the spec's table word for word: no sign-in (AC-5), knowledge off (AC-3),
  no product, unreachable; none waits past the kit's call timeout.

### s3

- `omni mcp` answers `initialize`, `tools/list` and `tools/call` for `search_knowledge` and
  `get_knowledge` over stdio, with the server's instructions, through s2's client.
- Listing the tools makes no request to the Omni page (AC-6); a call under `OMNI_TOKEN` trades it
  and is served (AC-4); each failure answers its line as a tool result, never a crash.
- `kit/plugin/.mcp.json` declares `omni-knowledge` running `omni mcp` from the session's repository,
  and `kit/test/plugin.test.ts` checks it (AC-7).

### s4 (light: wording in seven skills and the guide)

- Each of do-work, wave, yolo, bug-fix, plan, brainstorm and pr-care says: before deciding what the
  spec does not settle, search the product's knowledge (`search_knowledge`, else `omni kb search`),
  read what is relied on whole, and cite the ids in the outbox item (AC-10), checked by
  `kit/test/knowledge-search-skills.test.ts`.
- `docs/guide/api.md` says agents with the omni plugin need no key, and runners read with their
  `OMNI_TOKEN`.

# Plan: a product's MCP finds knowledge by meaning

PRD #2728, specified in `spec.md` beside this plan. The feature branch `feat/mcp-meaning-search` merges into
`main` through the feature PR (`Closes #2728`). Each slice is a sub-PR from
`feat/mcp-meaning-search--<slice>` into the feature branch (`Part of #2728`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The entry builder lives in the kit, with `embedText` (no `Owner:` line) and the duplicate ADR id rule; galaxy builds its entries from it | `kit/lib/knowledge/entries` `apps/galaxy/src/product-mcp/entries` `apps/galaxy/src/product-mcp/product-mcp.service.ts` | — | 1 | build |
| s2 | Each workspace keeps vectors of its knowledge's text, service role only, with the put, missing, nearest and forget functions, proven by their check | `supabase/migrations/20270117090000_knowledge_vectors.sql` `supabase/checks/knowledge_vectors.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` | — | 1 | deep |
| s3 | The `embed` Edge Function turns texts into gte-small vectors for the service role alone, and the `supabase` workflow deploys it | `supabase/functions/` `supabase/config.toml` `.github/workflows/supabase.yml` | s2 | 2 | deep |
| s4 | Once a pack is kept, a `knowledge-embed` job embeds its new and changed entries, and the product's Legal, Glossary and Never rows, by itself | `apps/omni-app/src/jobs/embed` `apps/omni-app/src/jobs/pack.ts` `apps/omni-app/src/jobs/pr-checks.ts` `apps/omni-app/src/knowledge-embed/` | s1, s2 | 2 | deep |
| s5 | `search_knowledge` ranks exact matches, then meaning, then entries not embedded yet, says its `mode`, and answers by words whenever the vectors cannot | `apps/galaxy/src/product-mcp/search` `apps/galaxy/src/product-mcp/product-mcp.repository` `apps/galaxy/src/product-mcp/product-mcp.controller` `apps/galaxy/src/product-mcp/product-mcp.contract.ts` `apps/galaxy/src/product-mcp/product-mcp.live.ts` `apps/galaxy/src/product-mcp/embed` | s1, s2 | 2 | deep |
| s6 | `pnpm eval:search` scores a product's MCP on a questions file, with an Acme fixture, and the guide explains the search and how to score it | `scripts/eval-search` `package.json` `docs/guide/api.md` | s5 | 3 | build |

**Shared ground.**
- `.github/workflows/supabase.yml` is declared by s2 (the check's step) and s3 (the deploy step). s3 is blocked by
  s2, so they are never in one wave.
- `apps/galaxy/src/product-mcp/product-mcp.service.ts` is s1's alone. s5 changes the search through its own
  files and the repository, controller, contract and live files. s5 is blocked by s1, so the two never share a
  wave.
- s3, s4 and s5 share wave 2 and meet nowhere: s5 calls the `embed` function through its own client
  (`apps/galaxy/src/product-mcp/embed`), and s4 through its own (`apps/omni-app/src/knowledge-embed/`). Both
  follow s3's contract as the spec writes it.
- `apps/omni-app/api/` and `kit/dist/` are built and listed nowhere: the wave rebuilds them after merging.
- `supabase/database.types.ts` is regenerated with the migration, so it is s2's.

## Per slice: done when

### s1 (`ui: yes`)

- `kit/lib/knowledge/entries.ts` exports `knowledgeEntries` with the same output galaxy's builder gives today.
  Its tests move with it and pass unchanged.
- `embedText(entry)` returns the title, then the body without its `Owner:` line. A test proves no `Owner:` text
  remains.
- Two ADRs of one repository sharing a number each take `<repo>/<file name without .md>`. Every other entry keeps
  its id. A test proves it with a fictional repository.
- `apps/galaxy/src/product-mcp/` builds its entries from the kit, and its tests stay green.

### s2

- The migration is dated after the newest on `main` (`node scripts/migration-order.ts` passes). It adds the
  `vector` extension in `extensions`, `knowledge_vectors`, and the four functions, each commented. Its header
  names the rollback.
- `supabase/checks/knowledge_vectors.sql`, run as a step of the `supabase` workflow (ADR-0028), proves:
  - nobody signed in, and anon, reads, writes or calls any of it;
  - one workspace's call never returns another's vectors;
  - `knowledge_nearest` orders by cosine within the hashes given;
  - `knowledge_vectors_missing` names only the absent hashes;
  - a wrong-length vector is refused whole;
  - `forget` deletes only vectors unused for 90 days.
- `supabase/database.types.ts` is regenerated.

### s3

- `supabase/functions/embed/index.ts` answers `POST {texts}` with `{model: "gte-small", vectors}`:
  - one 384-long normalized vector per text, in order;
  - at most 64 texts per call, each cut to 2,000 characters;
  - 401 to any caller that is not the service role, embedding nothing;
  - nothing it receives is logged.
- The handler is a pure function with the model session passed in. Its tests use a fake session.
- The `supabase` workflow deploys it after the migrations, on `main` only. CI's local stack still does not start
  the edge runtime.

### s4 (`ui: yes`)

- The pack job adds a `knowledge-embed` job (same key) once a pack is kept, and only then.
- The job:
  - builds the pack's entries with the kit's builder;
  - adds the law home's business laws when the repository is a product's law home;
  - adds, for each product holding the repository, its Legal entries, Glossary terms and Never lines;
  - hashes each `embedText`, embeds only the missing ones in batches of 64, and stores them.
- An embedder that fails is a `retry` for the ledger. Running the job twice embeds nothing the second time.
- Tests use a fake store and a fake embedder: no GitHub, no model.

### s5 (`ui: yes`)

- With a `query`, hits come in this order: exact id or term, then `knowledge_nearest` order, then entries with no
  vector by word match. At most 20 hits, and `mode: "meaning"`.
- The query is embedded with a 2-second budget. When the embedder fails, times out, or no vector exists, the
  answer is today's word search with `mode: "words"`, never an error.
- Product entries missing a vector are embedded during the search, at most 64, inside the same budget.
- With no `query`, the listing is today's, with no `mode`.
- Pure ranking tests use fake vectors. The controller tests go through the real MCP client with a fake embedder.
- `/api/mcp` is unchanged.

### s6

- `pnpm eval:search <product> <questions file> --key-file <file>` prints, per set: right first, in the top 5,
  and the mean reciprocal rank. Then it prints each question with its rank and `mode`. The key is read from the
  file and never printed.
- `scripts/eval-search/acme.json` holds fictional questions that match the demo seed's knowledge.
- `docs/guide/api.md` explains the meaning search, `mode`, the fallback, and how to score a product.
- `scripts/eval-search.test.ts` scores a fake MCP and proves the key is never printed.

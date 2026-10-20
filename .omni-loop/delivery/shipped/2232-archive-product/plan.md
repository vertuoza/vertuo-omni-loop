# Plan: Archive a product

PRD #2232, built from `spec.md` beside this plan. The feature branch `feat/archive-product` merges
into `main` through the feature PR (Closes #2232). Each slice is a sub-PR from
`feat/archive-product--<slice>` into the feature branch (Part of #2232).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | An owner archives a product from its home after an "are you sure"; the row is kept, members stop reading it, every lookup the kit and agents use skips it, its content can no longer change, and the owner restores it from the archived home's banner | `supabase/migrations/` `supabase/checks/product_archive.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/src/product-home/` `apps/galaxy/app/app/products/[id]/` | — | 1 | deep |
| s2 | Archived products leave the products grid; an owner lists them under a collapsed Archived (n) line and restores one from there | `apps/galaxy/src/products/` `apps/galaxy/app/app/products/page` | s1 | 2 | build |
| s3 | The kit and the agents' link say a product is archived instead of answering for it: the graph by product, which, the business read, `omni kb legal`, `omni kb glossary`, `omni business show` and the MCP tools | `apps/galaxy/src/knowledge-graph/product-graph` `apps/galaxy/src/knowledge-graph/link` `apps/galaxy/src/product-repositories/product-repositories` `apps/galaxy/src/business-api/` `apps/galaxy/src/agent-connect/mcp/` `kit/lib/product/` `kit/bin/commands/kb` `kit/bin/commands/business` | s1 | 2 | build |

**Shared ground.** None. s1 owns the one migration, its check and its workflow step, so every SQL
change (the column, `product_archive()`, `product_restore()`, the select policy, the lookups and the
content-changing functions) lands in one place, and `database.types.ts` is regenerated once. s2 and
s3 only read what s1 adds, and their prefixes meet nothing of s1's or each other's. `kit/dist/` is
generated (`pnpm kit:build`): s3 rebuilds it only to test, and the wave rebuilds it after merging.
The draft screens `products` and `product-home` are written by phase 0; no slice edits them.

## Per slice: done when

### s1 (deep: a migration that changes a select policy and nine lookup functions beside cascading foreign keys) (`ui: yes`)

- A migration, dated after the newest on `main` (`node scripts/migration-order.ts`), with its
  rollback in its header:
  - adds `products.archived_at` and `products.archived_by`;
  - adds `product_archive(p_product)` and `product_restore(p_product)`, owner only through
    `product_repository_owned()`, each answering `{id, name, archivedAt}`, both idempotent;
  - changes the products select policy: members read live products, owners also archived ones;
  - makes `lookup_product()`, `repository_only_product()`, `product_of_key()`, `business_for_repo()`,
    `business_for_token()`, `business_for_product()`, `product_knowledge_of()`,
    `knowledge_graph_push()` and `knowledge_graph_for_token()` skip an archived product for everyone,
    and refuse a named one with P0002 `Product <name> is archived: an owner restores it on its page.`;
  - makes `product_repository_owned()`, `product_knowledge_product()` and `product_of_key()` refuse
    an archived product with that P0002, so links, approvers, key, Legal, glossary and pushes refuse it.
- A `git grep "from public.products"` over `supabase/migrations/` finds no other function that
  resolves a product for the kit or an agent; one it finds is changed too, or named in the sub-PR's
  body with why it may stay.
- `supabase/checks/product_archive.sql` proves every case of the spec's Test seams, and has its own
  step in `.github/workflows/supabase.yml`.
- `supabase/database.types.ts` is regenerated with the columns and the two functions.
- On the product home, an owner sees a quiet **Archive** in the head card; a member sees none.
  Pressing it asks `window.confirm` with the spec's text, naming the product's repositories when it
  has any. Cancelling changes nothing; confirming calls `product_archive()` and lands on
  `/app/products`. A refusal shows in the head card.
- An archived product's home renders read-only for an owner under `Archived <ago> by <name>.` with
  **Restore**, which calls `product_restore()` and shows the live home again. A member opening its
  link gets the not-found page.
- The product home's render, service and repository tests prove the owner-only Archive, the confirm
  text, the banner and Restore.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

### s2 (`ui: yes`)

- `/app/products` draws only live products in its grid.
- Under the grid, an owner sees a `<details>` **Archived (n)**, closed by default and absent at 0,
  listing each archived product with `archived <ago> by <name>` and **Restore**. Restore calls
  `product_restore()` and moves the product back into the grid. A member sees no Archived line.
- `ProductsHome` render tests: absent at 0, n counted, owner only, Restore. The service and
  repository tests prove archived rows are split from live ones and the owner flag is read.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

### s3

- `GET /api/products/<key>/knowledge/graph` answers 404 with the archived message for an archived
  product, the owner's sign-in included; `GET /api/products/which` leaves it out.
- `GET /api/business` for a repository whose only product is archived answers
  `{state: "archived", product: {name}}`; the MCP link's `get_business` and `get_knowledge_graph`
  answer the archived sentence.
- `omni kb legal`, `omni kb glossary` and `omni business show` print
  `product <name> is archived: an owner restores it on its page` and exit 1, and never fall back to
  `.omni-loop/local/product-knowledge.json` for it.
- Each reader's `.test.ts` and the kit commands' tests prove the archived answer.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

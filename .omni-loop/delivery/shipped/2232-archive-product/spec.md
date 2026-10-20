---
prd: 2232
title: Archive a product
blocked-by: none
spec: file
phase0: server
---

# Archive a product

**Date:** 2026-10-20 · **PRD:** #2232 · **Touches:** `supabase/` (one migration, its check),
`apps/galaxy` (the products list, the product home, the readers the kit and agents call)

## Problem

Nothing removes a product from the Omni page. A product made by mistake, or one the team stopped
building, stays in every member's products list, its repositories keep reading its Legal entries
and glossary, and agents keep citing them.

Deleting the row is not an answer. `claims`, `personas`, `constituents`, `constituent_events`,
`product_approvers`, `product_repositories`, `product_knowledge_owners`, `product_legal`,
`product_glossary`, `product_knowledge_proposals` and `product_knowledge_events` cascade from it,
and `dossiers`, `roadmaps`, `ideas` and `approval_requests` lose their product. A delete would wipe
the product's decision history, which the product's Legal entry L-GDPR-4 says is kept for good
("Logs that record decisions are kept for good"), and would leave its product PRDs (`<key>-<n>`)
without the product their id names.

## Solution

A workspace owner **archives** a product. Archiving hides it and stops every endpoint from answering
for it; nothing is erased. **Restore** brings it back as it was.

1. **The database.** One migration:
   - adds `products.archived_at timestamptz` and `products.archived_by uuid` (references
     `auth.users`, `on delete set null`), both null while the product is live;
   - adds `product_archive(p_product uuid) returns jsonb` and `product_restore(p_product uuid)
     returns jsonb`, owner only through `product_repository_owned()` (42501 signed out or not an
     owner, P0002 no such product). Archive sets `archived_at = now()` and `archived_by =
     auth.uid()`; restore clears both. Archiving an archived product, or restoring a live one,
     answers the row as it is. Each answers `{id, name, archivedAt}`;
   - changes the products select policy: a member reads a live product of their workspace; an owner
     of the workspace also reads its archived ones;
   - makes every lookup that resolves a product for the kit or an agent skip an archived product, for
     everyone, owners included: `lookup_product()`, `repository_only_product()`, `product_of_key()`,
     `business_for_repo()`, `business_for_token()`, `business_for_product()`,
     `product_knowledge_of()`, `knowledge_graph_push()`'s products list and
     `knowledge_graph_for_token()`. Where the caller named the product (by key or id), the refusal
     is P0002 with the message `Product <name> is archived: an owner restores it on its page.`;
   - makes the functions that change a product's content refuse an archived product with that same
     P0002: `product_repository_owned()` (links, approvers, key), `product_knowledge_product()`
     (Legal, glossary, owners, proposals) and `product_of_key()` (dossier, roadmap and bug pushes).
   - Its repositories keep their `product_repositories` rows, so restore brings them back. While the
     product is archived those rows are ignored by every lookup above: the repository resolves to its
     other products, or to none, and may be linked to another product.
2. **The readers the kit and agents call** answer the archive in words, never with an empty list:
   - `GET /api/products/<key>/knowledge/graph` and `product-graph.repository.ts` refuse an archived
     product with 404 and the message above;
   - `GET /api/products/which` leaves archived products out;
   - `GET /api/business` for a repository whose only product is archived answers
     `{state: "archived", product: {name}}`, and `omni kb legal`, `omni kb glossary` and
     `omni business show` print `product <name> is archived: an owner restores it on its page` and
     exit 1, without falling back to the local copy;
   - the MCP link's `get_business` and `get_knowledge_graph` answer the same sentence.
3. **The products list** (`/app/products`). Archived products leave the grid. An owner sees, under
   it, a collapsed **Archived (n)** line (a `<details>`, closed by default, absent when n is 0)
   listing each archived product: its name, `archived <ago> by <name>`, and **Restore**. A member
   sees no Archived line.
4. **The product home** (`/app/products/<id>`). An owner sees a quiet **Archive** in the head card.
   Pressing it asks first with `window.confirm`: `Archive <name>? It leaves every member's list, and
   its repositories stop reading its Legal entries and glossary.`, plus `Repositories: <owner/name>,
   …` when it has any. Confirmed, the owner lands on `/app/products`. An archived product's home is
   read-only for its owner, under a banner `Archived <ago> by <name>.` with **Restore**; a member
   who opens its link gets the products page's not-found.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | database | `archived_at`, `archived_by` | no written convention: follows `removed_at` ← `supabase/migrations/20261215090000_remove_repository.sql:26` |
| vertuo-omni-loop | database | `product_archive()`, `product_restore()` | no written convention: follows `product_set_key()` ← `supabase/migrations/20261203100000_product_prd_ids.sql:78` |
| vertuo-omni-loop | database | `<date>_archive_product.sql` | conventions › A migration stays the newest (`node scripts/migration-order.ts`) |
| vertuo-omni-loop | database | `supabase/checks/product_archive.sql` | ci › each check its own step in `.github/workflows/supabase.yml` |
| vertuo-omni-loop | galaxy | business state `archived` | no written convention: follows the states `none`, `no-sign-in` ← `apps/galaxy/src/business-api/read.ts:115` |
| vertuo-omni-loop | galaxy | **Archived (n)** | no written convention: follows **Removed (n)** ← PRD 2188, Settings › Repositories |

## Decisions

- **Archive, never delete** (the person, 2026-10-20). The row and everything under it stay, so the
  decision history holds (L-GDPR-4) and product PRD ids keep their product.
- **Only owners see an archived product** (the person). Members lose it from every list and page;
  owners read it under Archived (n) and on its read-only home.
- **Workspace owners archive and restore** (the person), through `product_repository_owned()`, as
  for the product's repositories and key.
- **A Restore button** (the person). Restore puts the product back exactly as it was, links included.
- **No endpoint answers for an archived product, owners included** (the person): "otherwise people
  and agents could still rely on it". The owner's read on the page is the one exception, and it is
  read-only.
- **Its repositories are freed** (the person). Their links are kept but ignored while it is archived,
  so restore relinks them; meanwhile they resolve to their other products, or none.
- **Words, never an empty list** (agent, approved with the design). The kit and the MCP link say the
  product is archived, so a repository never reads "no Legal entries" when they were only archived.
- **The voice's objection, accepted.** persona:Lead Engineer: "If a repository quietly stops getting
  the product's rules, my team's agents keep building without them and I won't notice." The confirm
  names the repositories that lose the product, and the kit says `is archived` instead of printing
  nothing.
- **`window.confirm`, not a custom dialog.** It follows PRD 2188's Remove.
- **The Ledger's lede is cut by one word** (agent, from the design word pass): "What waits on whom
  across its PRDs." replaces "What waits on whom, across the product's PRDs." on the product home
  (`apps/galaxy/src/product-home/tabs.ts`), which the pass flags as explaining at rest. s1 makes the
  change, since it owns `apps/galaxy/src/product-home/`.
- **The local copy is not served for an archived product** (agent). `omni kb legal` normally falls
  back to `.omni-loop/local/product-knowledge.json` when the page is unreachable; an archive is an
  answer, not an outage, so it exits 1.

## User stories

- As a workspace owner, I archive a product we stopped building, so it leaves my team's list and no
  agent cites its rules any more.
- As a workspace owner, I open Archived (n) and restore a product I archived by mistake, and it is
  back with its repositories, rules and words.
- As a lead engineer, when a repository's product was archived, the terminal tells me so instead of
  showing an empty glossary.
- As a member, I no longer see an archived product anywhere.

## Scope

In:
- the migration, its check `supabase/checks/product_archive.sql` (and its workflow step), and
  `database.types.ts`;
- the lookups and content-changing functions named in Solution 1;
- the readers named in Solution 2, the kit's three commands and the MCP link's two tools;
- the products list's Archived (n) and Restore; the product home's Archive, banner and read-only
  state;
- the draft screens `products` and `product-home` in the screen library.

Out:
- deleting a product's data for good;
- archiving a workspace, a repository or a single PRD;
- moving a product's PRDs or roadmaps to another product;
- the other direct reads of `products` (roadmap page, dossier page, approvals, ideas, public API):
  they read under the caller's row-level security, so a member already stops seeing an archived
  product there; an owner keeps reading them.

## Test seams

The testing form applies: tests sit beside the code, they never call Supabase or GitHub, and the
database's rules are proved by `supabase/checks/`.

- `supabase/checks/product_archive.sql`, with realistic rows:
  - a member is refused archive and restore (42501); an unknown product is refused (P0002);
  - archive sets `archived_at` and `archived_by`; archive twice answers the same row; restore clears
    both;
  - a member no longer selects the archived product; an owner still does;
  - `lookup_product()`, `repository_only_product()`, `product_of_key()`, `business_for_repo()`,
    `business_for_token()`, `product_knowledge_of()` and `knowledge_graph_for_token()` skip it for
    the owner too;
  - `product_legal_add()`, `product_glossary_add()`, `product_repository_link()` and
    `dossier_push()` with its key refuse it with P0002 and the archived message;
  - its `product_repositories`, `product_legal`, `product_glossary`, `constituent_events` and
    `product_knowledge_events` rows survive archive; after restore every lookup finds it again.
- `apps/galaxy`: each reader's `.test.ts` (graph controller, which, business read, MCP tools) proves
  the archived answer; `products` and `product-home` render tests prove Archived (n), Restore and
  Archive for the owner only, the confirm's text and the read-only banner.
- `kit`: `kb legal`, `kb glossary` and `business show` print the archived line, exit 1, and never
  read the local copy for it.

## Risks

- **What merging publishes:** one migration on production Supabase, new controls on the products
  pages (Vercel), and a new answer from the kit's commands. Rollback: a follow-up migration that sets
  `archived_at = null` on every product and restores the previous functions and policy; nothing was
  deleted, so nothing is lost.
- **A lookup that is missed** keeps answering for an archived product. Solution 1 names each one, and
  the slice that adds the column greps `from public.products` in `supabase/migrations/` for any
  other function that resolves a product.
- **An owner's direct reads** (roadmap page, dossier page, approvals) still show an archived
  product's rows to owners. That is the read-only access the person chose, and none of them is called
  by the kit or an agent.
- **The locked laws.** None changes. The migration sits under `supabase/migrations/`, which several
  laws govern; it changes none of their tables or functions. BR-PRODUCT-63 (an agent link reads only
  repositories in its own workspace) is read and holds: archiving only narrows what a link reads.

## Acceptance criteria

1. An owner presses Archive on the omni-loop product and confirms; the confirm names
   `vertuoza/vertuo-omni-loop`. The owner lands on the products page, where omni-loop is under
   Archived (1), not in the grid.
2. Cancelling the confirm changes nothing.
3. A member does not see the archived product on the products page, and its link answers not found.
4. In the repository, `omni kb legal`, `omni kb glossary` and `omni business show` print
   `product omni-loop is archived: an owner restores it on its page` and exit 1.
5. `omni kb graph --product omni-loop <id>` answers 404 with the archived message, for the owner
   too; the MCP link's `get_business` and `get_knowledge_graph` answer the same sentence.
6. Adding a Legal entry or pushing a product PRD to the archived product is refused with the archived
   message.
7. Restore puts omni-loop back in the grid; its repositories, Legal entries, glossary and history are
   there, and every command above answers as before.
8. A member sees no Archive, no Archived line and no Restore; the database refuses
   `product_archive()` from a member with 42501.

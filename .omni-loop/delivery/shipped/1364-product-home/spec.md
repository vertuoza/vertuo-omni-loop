---
prd: 1364
title: Products hold everything
blocked-by: none
spec: file
phase0: server
---

# Products hold everything

**Date:** 2026-10-09 · **PRD:** #1364 · **From:** concept #1269, area `product-home`, after PRDs
#1299 and #1322 · **Touches:** `supabase/migrations/` (product ↔ repository links, a PRD's and an
idea's optional product, the lookups that find a product), `apps/galaxy` (Products in the sidebar,
the product home and its tabs, the PRD page's Product picker, a product filter on the global lists),
`kit/` (`plan.product` in the config, `omni targets` from the server, `omni product import`, the
`product:` line of `omni prd`, the brainstorm's product question), and the docs.

## Problem

A product is a dead end today. It exists on the server (`products`), a repository points at exactly
one (`repositories.product_id`, set to the first product by a trigger), and its Settings page shows
only a name, Pitch and Approvers. Everything the loop makes for a product lives somewhere else: PRDs
under `/prd`, ideas under `/ideas/<owner>/<repo>`, bug and visual fixes under `/bugs` and `/visual`,
outbox questions on GitHub, roadmaps under `/roadmaps`. Nobody can open "Mobile" and see what waits
on whom.

Three things break as soon as a company shares a service between products:

- A shared API belongs to one product only, so the other product cannot list it, and its PRDs read
  the wrong product's approvers, claims and personas: every lookup goes repository → its one
  product (`business_for_repo`, `business_for_token`, `dossier_approve`, `approval_request`, the
  voice, constituents, pitch).
- `business_for_token` raises when a workspace has more than one product and the call names no
  repository.
- A plan repository keeps its targets in `plan.targets[]`, a hand-kept copy of what the product
  already knows: which repositories, their role, their knowledge, where they were read, and what
  consumes what.

And a product is forced on everyone: the trigger puts every new repository into the first product,
though the loop works fine with no product at all.

## Solution

**Products stay optional.** A repository can be in no product, one, or several. A PRD links to one
product or to none. Nothing the loop does today needs a product; a product adds a home, approvers
and a shared voice.

### 1. Products and repositories, many to many

A new table `product_repositories`, one row per product and repository:

| column | what it holds |
|---|---|
| `product_id`, `workspace_id` | the product (composite FK to `products (id, workspace_id)`) |
| `repository` | `owner/name`, lower case, FK to `repositories (workspace_id, full_name)` |
| `role` | one kebab-case word (`api`, `web`, `mobile`), or null until someone sets it |
| `knowledge` | `own`, `imported` or `none` (default `own`) |
| `read_at` | a 40-hex commit, required when `knowledge` is `imported`, else null |
| `read_only` | true when the product reads this repository but never writes it (default false) |
| `consumes` | the repositories of the same product this one consumes, `owner/name` each |
| `added_by` | `prd` (added because a PRD of the product touches it) or `person` |
| `added_at` | when |

The same checks as `plan.targets[]` hold on the server: no repository consumes itself, and every
repository it consumes is linked to the same product. A member of the workspace reads the links;
an owner adds, edits and removes them; a PRD's link (below) adds them through a security-definer
function.

The migration copies each `repositories.product_id` into one link (`added_by = 'person'`), then drops
the column and the `repositories_default_product` trigger. `repository_set_product()` is replaced by
`product_repository_link()` and `product_repository_unlink()`.

### 2. A PRD's product, optional

`dossiers.product_id` and `ideas.product_id` are added, both nullable, with a composite FK to
`products (id, workspace_id)`, `on delete set null (product_id)`.

When a PRD is born (its dossier's first push):

| its repository is in… | its product |
|---|---|
| one product | that product |
| no product | none |
| several products | the one the brainstorm asked for, or none |

`/omni:brainstorm` and `/omni:mega-brainstorm` ask the one question only in the third case: "Which
product is this PRD for?", the repository's products and **No product**. The answer travels with the
first push (`omni dossier push --product <name>`). An idea follows the same table when it is
created, without the question: a repository in several products gives the idea no product.

The PRD's page shows a **Product** picker (the workspace's products and **No product**) to every
member until the PRD is approved. Once an approval is in force, the picker is locked
(`product is locked: PRD <n> is approved`), because the product's approvers decided; a voided
approval unlocks it. An idea's product is changed the same way from the product's Ideas tab or the
idea's row, with no lock.

Giving a PRD a product links its repositories to that product (`added_by = 'prd'`): its home
repository, and for a multi-repository PRD every repository its plan's Repositories table names. A
link that exists is left as is. Unlinking a repository never touches a PRD: the PRD keeps its
product, and its next push links the repository again.

### 3. The lookups: PRD, then repository, then none

Every lookup that found a product through `repositories.product_id` now resolves it in this order:

1. the PRD's (or idea's) own `product_id`, when the call names a PRD or an idea;
2. the repository's only product, when it is linked to exactly one;
3. none.

This covers `business_for_repo` and `business_for_repo_app`, `business_for_token`, the customer
voice's claim write, agent questions, constituents, pitch, `dossier_approve` and `approval_request`.
With no product, each one behaves as it does today without one: any workspace member approves, the
asked are every member but the author, and only the workspace's region claims and no personas apply.
`business_for_token` no longer raises on several products: it resolves to none. The kit's calls that
know their PRD (the voice, approvals, pitch) send its number so the first rule applies.

### 4. Products in the app

- **Products** joins the sidebar. `/app/products` lists the workspace's products as cards, as the
  concept's first screen draws them: name, repositories, PRD count, and how many items wait on the
  viewer. Repositories in no product are listed under the cards as plain repositories, each with
  **Add to a product**. The concept's automatic "products of one" are not built.
- `/app/products/[id]` is the product home: its name, then tabs. Each tab reads tables that exist,
  filtered to the product's PRDs (`dossiers.product_id`) or ideas (`ideas.product_id`):

| tab | what it shows | read from |
|---|---|---|
| **Ledger** (default) | what waits on whom, in three lanes, *on you*, *on GitHub review*, *on the agent*; each row its seal or number, ◆/◇ birthplace, one state word and its PR chips; a summary of building, waiting on a person and drifted | `approval_requests`, `approvals`, `prd_stages`, `prd_outbox.waiting` |
| **PRDs** | every PRD of the product, birthplace and state word, newest first | `dossiers`, `prd_stages` |
| **Ideas** | the product's ideas, each with its `/omni:brainstorm` line | `ideas` |
| **Roadmap** | the product's roadmaps | `roadmaps.product_id` |
| **Bug fixes** | the product's bug dossiers | `dossiers` of kind `bug` |
| **Visual fixes** | the product's visual dossiers | `dossiers` of kind `visual` |
| **Questions** | the open outbox questions of the product's PRDs, each linking to where it is answered today | `prd_outbox.waiting` |
| **Repositories & approvers** | the links, each field editable by an owner, with **Add a repository**; under them the Approvers section of #1322, moved here | `product_repositories`, `product_approvers` |

- Settings › Products keeps creating, renaming and deleting a product, and Pitch; its Approvers
  section moves to the product home. Settings › Repositories drops its product select and shows each
  repository's products as chips linking to them.
- `/prd`, `/ideas`, `/bugs` and `/visual` stay, and gain a product filter (all, one product, no
  product).
- New code follows ADR-0095: `apps/galaxy/src/products/products.{contract,client,controller,service,repository}.ts`
  (and a `product-repositories` area beside it), and the `src/products/*` and `src/repositories/*`
  breaches leave `layering/baseline.json`.

### 5. The kit: `plan.product` replaces `plan.targets[]`

- The config accepts `plan: { guide, product: "<name>" }` as an alternative to
  `plan: { guide, targets: [...] }`. Both at once is refused, naming both keys.
- With `plan.product`, `omni targets` and every reader of the targets (`lib/plan-repo/targets.ts`
  and its callers) take the product's links from the server, as the same `Target` shape: `repo`,
  `role`, `knowledge`, `readAt`, `readOnly`, `consumes` (short names, as today). A link with no role
  is refused by name: `vertuo/api has no role in product Mobile: set it on the product page`.
- Each read keeps a copy in `.omni-loop/local/product-targets.json`. When the server does not answer
  within 5 seconds, the readers use that copy and `omni targets` says
  `targets from the last read, <date> · server unreachable`. With no copy, they stop with
  `no targets: the server is unreachable and nothing was read yet`.
- `omni targets` prints the links as a table in the terminal, so the file a developer could read
  before is still one command away.
- `omni product import --product <name>` copies a config's `plan.targets[]` into that product,
  once: each target becomes a link with its fields,
  an existing link is updated, and it prints what it added and changed. It never edits the config:
  the person swaps `targets` for `product` themselves.
- `omni prd <n>` prints `product: <name>` (or `product: none`).
- A plan repository that keeps `plan.targets[]` works exactly as today.

## Decisions

- **Many to many, not a home product with visitors** (the person, against the vision tour's
  "visitor" rule): "a repo could be involved in multiple products as some services are shared in
  our companies". This is the dissent the Skeptic and all five personas held in the concept.
- **The product is optional everywhere** (the person): a repository and a PRD may have none, and the
  loop works with none. So the concept's automatic "products of one" are dropped, and so is the
  trigger that put each new repository into the first product.
- **The PRD carries the product; its link adds the repository** (the person): "the PRD links to the
  product, which sets automatically that the repo is there". The lookups read the PRD first.
- **One product: taken. None: none. Several: the brainstorm asks** (the person). Changeable on the
  PRD page until an approval is in force, because the product chooses the approvers.
- **The scope is the whole area** (the person: "at the end of the concept we need it all"):
  the links with the target fields, the product home with every tab the concept names including the
  Ledger, and the kit reading targets from a product. The `omni/approved` check and the
  multi-repository skills running from a product stay with `product-gate`; roadmaps, bugs and
  knowledge moving onto the server stay with `product-records`; the Constellation tab with
  `constellation-tab`.
- **The voice objected, and the design changed** (`accepted`): persona:B-E DEv, "You're moving my
  targets out of the config file onto a server I can't read in my editor. That's more 'tool' than I
  want." So `omni targets` prints the links in the terminal, a last-read copy is kept locally for an
  unreachable server, and `plan.targets[]` in git stays allowed.
- **No proof video** (the person).

## User stories

- As a PM of Mobile, I open Products › Mobile and see on the Ledger what waits on me, on review and
  on the agent, across Mobile's repositories.
- As a lead, I add `vertuo/api` to both Mobile and Estimates, with the role `api` in each.
- As Paul, I brainstorm in `vertuo/api`, which is in two products; I am asked which one, pick Mobile,
  and the PRD's approvers are Mobile's.
- As a developer in a repository with no product, I brainstorm and build as I do today, and nobody
  asks me about products.
- As a PM, I move a PRD from no product to Mobile on its page before it is approved, and its
  repository appears in Mobile's Repositories tab.
- As a plan repository's maintainer, I run `omni product import`, swap `plan.targets` for
  `plan.product: Mobile`, and `omni targets` prints the same table.
- As B-E DEv, I run `omni targets` with the network down and still get the targets, marked as the
  last read.

## Scope

**In:** the `product_repositories` table, its backfill and the drop of `repositories.product_id` and
its trigger; `dossiers.product_id` and `ideas.product_id`, the birth rule, the lock, the automatic
link; the lookups in the order PRD → repository → none; `omni dossier push --product`; the
brainstorm's and mega-brainstorm's product question; the Products list, the product home and its
eight tabs, the PRD page's picker, the Settings changes, the product filter on the global lists;
`plan.product`, `omni targets` from the server with its local copy, `omni product import`, the
`product:` line; the docs (the guide's pages on products and plan repositories, and the galaxy
README).

**Out:** the `omni/approved` check, outbox items written through typed verbs, and the
multi-repository skills running from a product with no plan repository (`product-gate`); roadmap
specs as dossiers, bug Fixes rows and knowledge packs (`product-records`); the Constellation tab
(`constellation-tab`); answering outbox questions on the page (the Questions tab links to where they
are answered today); automatic products of one.

## Test seams

Following `omni kb show testing`: no test calls GitHub or Supabase for real.

- **Migrations,** with realistic rows: the backfill turns each `product_id` into one link and leaves a
  repository with none unlinked; a new repository gets no product; the consumes checks refuse a
  self-consume and a repository from another product; a member cannot write a link, an owner can.
- **The rule** (service, in SQL tests): the three birth cases; the lock while an approval is in force
  and its lifting on a void; the automatic link of the home repository and of every repository in a
  multi-repository plan.
- **The lookups:** for each of `business_for_repo`, `business_for_token`, `dossier_approve` and
  `approval_request`, the three cases PRD → repository → none, and `business_for_token` with several
  products and no repository returning none instead of raising.
- **The app,** in ADR-0095 layers: each tab's service on fixture rows, each controller's 401 for a
  signed-out request and its response shape, each tab's page states (empty, filled, no product), the
  picker's lock, and the product filter on `/prd`.
- **The kit,** on a fixture repository with a stubbed server: the config schema (`product` or
  `targets`, never both); `omni targets` from the server, from the local copy, and with neither; a
  link with no role refused; `omni product import` adding and updating; `omni prd`'s `product:`
  line; `omni dossier push --product`. `kit/lib/config.ts` is mutation core:
  `pnpm mutation:changed` runs on it.

## Risks

Read with `omni kb show releasing`.

- **Merging publishes** migrations to the production database: the new table, two columns, the
  dropped column and trigger, and the rewritten lookups. The backfill keeps every repository in the
  product it has today, so every lookup answers the same for every row that exists.
- **The kit** published with the merge accepts `plan.product`; a config that keeps `plan.targets`
  is untouched.
- **The galaxy app** moves Approvers from Settings to the product home: a bookmark to the old section
  lands on the product's Settings page, which links to the new tab.
- **Rollback:** a follow-up migration adds `repositories.product_id` back, fills it from each
  repository's oldest link, restores the old lookups and drops the new columns and table; revert the
  app and kit commits. `plan.targets[]` never stopped working, so no plan repository breaks.

## Acceptance criteria

1. A repository can be linked to two products, each link with its own role, knowledge, read-at,
   read-only and consumes, and both products list it.
2. A new repository is in no product, and a repository that had a product before the migration is
   linked to that product after it.
3. A PRD born in a repository with one product takes it; in a repository with none, it has none; in
   a repository with several, `/omni:brainstorm` asks once, and the answer is the PRD's product.
4. A brainstorm in a repository with no product, or with one, asks no product question.
5. A member changes a PRD's product on its page before approval; once an approval is in force, the
   picker shows `product is locked: PRD <n> is approved`, and a void unlocks it.
6. Giving a PRD a product links its repositories to that product, marked as added by a PRD.
7. A PRD's approvers, claims and personas are its own product's, even in a repository linked to two
   products; with no product, any member approves, as today.
8. `business_for_token` with several products and no repository answers with no product instead of
   failing.
9. Products in the sidebar lists the products with their repositories and the items waiting on the
   viewer, and the repositories in no product below them.
10. The product home opens on the Ledger, with the three lanes, and its PRDs, Ideas, Roadmap, Bug
    fixes, Visual fixes, Questions and Repositories & approvers tabs show only that product's items.
11. An owner adds, edits and removes a repository link on the product home; a member sees it and
    cannot change it.
12. `/prd`, `/ideas`, `/bugs` and `/visual` filter by product, including "no product".
13. With `plan.product` in the config, `omni targets` prints the product's links as the targets
    table; with both `product` and `targets`, the config is refused naming both.
14. With the server unreachable, `omni targets` uses the last read and says
    `targets from the last read, <date> · server unreachable`; with no last read it stops.
15. `omni product import` turns each `plan.targets[]` entry into a link, and a second run changes
    nothing.
16. `omni prd <n>` prints `product: <name>` or `product: none`.
17. The guide's pages on products and plan repositories, and the galaxy README, describe products as
    optional, many to many, and `plan.product`.

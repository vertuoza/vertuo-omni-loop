# Plan: Products hold everything

PRD #1364, spec `spec.md` beside this plan. The work lands in three stacked pull requests into `main`:
expand (the schema the code needs), code (the app, the kit and the docs), and contract (dropping the
one-product column once nothing reads it). Each landing's branch is `feat/product-home-<n>of3-<name>`,
and each PR body opens with `Closes #1364`. Each slice is a sub-PR from
`feat/product-home--<slice>` into its landing's branch, with `Part of #1364`.

## Slices

| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | A repository links to several products, each link with role, knowledge, read-at, read-only and consumes; today's `product_id` is copied into links, and a new repository gets no product | `supabase/migrations/20261129090000_product_repositories*` `supabase/checks/product_repositories.sql` `supabase/checks/repositories.sql` `supabase/database.types.ts` | — | 1 | 1 |
| s2 | A PRD and an idea carry an optional product, set at birth by the one-none-asked rule, locked while an approval is in force, and linking the PRD's repositories to it | `supabase/migrations/20261129100000_prd_product*` `supabase/checks/prd_product.sql` `supabase/checks/dossiers.sql` `supabase/checks/ideas.sql` `supabase/database.types.ts` | s1 | 2 | 1 |
| s3 | Every product lookup resolves PRD, then the repository's only product, then none, and `business_for_token` answers none instead of failing on several products | `supabase/migrations/20261129110000_product_lookups*` `supabase/checks/product_lookups.sql` `supabase/checks/business.sql` `supabase/checks/agent_tokens.sql` `supabase/checks/product_approvers.sql` `supabase/checks/approval_requests.sql` `supabase/checks/constituents.sql` `supabase/checks/pitch_settings.sql` `supabase/database.types.ts` | s2 | 3 | 1 |
| s4 | With `plan.product` in the config, `omni targets` prints the product's links from the server, keeps a last-read copy and uses it when the server is unreachable | `apps/galaxy/app/api/products/` `apps/galaxy/src/product-repositories/` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/plan-repo/targets` `kit/lib/product/` `kit/bin/commands/targets` | — | 1 | 2 |
| s5 | `omni product import --product <name>` turns `plan.targets[]` into links, and `omni product which` prints the products of this repository | `apps/galaxy/app/api/products/` `apps/galaxy/src/product-repositories/` `kit/lib/product/` `kit/bin/commands/product` `kit/bin/commands/index.ts` `kit/lib/help/entries.ts` | s4 | 2 | 2 |
| s6 | A PRD is born with its product: `omni dossier push --product`, the brainstorm's and mega-brainstorm's one question for a repository in several products, and the `product:` line of `omni prd` | `apps/galaxy/app/api/dossiers/push/` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` `kit/lib/dossier/` `kit/bin/commands/dossier` `kit/bin/commands/prd` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/mega-brainstorm/` `kit/lib/help/entries.ts` | s5 | 3 | 2 |
| s7 | The PRD page's Product picker changes a PRD's product before approval and shows `product is locked: PRD <n> is approved` after | `apps/galaxy/app/api/dossiers/product/` `apps/galaxy/src/dossier/page/Product` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/product` | — | 1 | 2 |
| s8 | Products in the sidebar lists the workspace's products with their repositories, PRD counts and what waits on the viewer, and the repositories in no product below | `apps/galaxy/app/app/products/page.tsx` `apps/galaxy/app/app/products/loading.tsx` `apps/galaxy/src/products/` `apps/galaxy/src/nav/` `apps/galaxy/layering/baseline.json` | — | 1 | 2 |
| s9 | The product home opens on the Ledger, with its three lanes and summary, and a PRDs tab | `apps/galaxy/app/app/products/[id]/` `apps/galaxy/src/product-home/` | s8 | 2 | 2 |
| s10 | The product home's Ideas, Roadmap, Bug fixes, Visual fixes and Questions tabs show only that product's items | `apps/galaxy/src/product-home/` | s9 | 3 | 2 |
| s11 | The Repositories & approvers tab: owners add, edit and remove links, the Approvers section moves there, and Settings › Repositories shows each repository's products as chips | `apps/galaxy/app/app/products/[id]/repositories/` `apps/galaxy/src/product-repositories/` `apps/galaxy/src/products/` `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/` `apps/galaxy/layering/baseline.json` | s5, s9 | 3 | 2 |
| s12 | `/prd`, `/ideas`, `/bugs` and `/visual` filter by product, including no product | `apps/galaxy/app/prd/page.tsx` `apps/galaxy/app/ideas/` `apps/galaxy/app/bugs/page.tsx` `apps/galaxy/app/visual/page.tsx` `apps/galaxy/src/product-filter/` | s8 | 2 | 2 |
| s13 | The guide and the galaxy README describe products as optional and many to many, the product home, and `plan.product` | `docs/guide/products.md` `docs/guide/several-repositories.md` `docs/guide/meta.json` `docs/guide/index.md` `apps/galaxy/README.md` | s6, s10, s11 | 4 | 2 |
| s14 | `repositories.product_id`, its default trigger and `repository_set_product()` are gone | `supabase/migrations/20261129120000_drop_repository_product*` `supabase/checks/repositories.sql` `supabase/database.types.ts` | — | 1 | 3 |

**Shared ground.**

- `supabase/database.types.ts`: s1, s2 and s3 each regenerate it, in waves 1, 2 and 3 of landing 1;
  s14 alone in landing 3.
- `supabase/checks/repositories.sql`: s1 (landing 1) and s14 (landing 3).
- `apps/galaxy/app/api/products/`, `apps/galaxy/src/product-repositories/` and `kit/lib/product/`:
  s4 creates them in wave 1, s5 adds to them in wave 2, and s11 (the link editor, wave 3) adds to
  `src/product-repositories/`.
- `kit/lib/help/entries.ts`: s5 (wave 2) adds the `product` verb, s6 (wave 3) the `--product`
  option of `dossier push` and the `product:` line.
- `apps/galaxy/src/products/` and `apps/galaxy/layering/baseline.json`: s8 (wave 1) and s11 (wave 3),
  each removing the breaches of the files it rewrites.
- `apps/galaxy/src/product-home/`: s9 (wave 2) creates it, s10 (wave 3) adds the tabs.
- `apps/galaxy/src/nav/` (the sidebar and its render tests) is s8's alone.

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | expand | — |
| 2 | code | landing 1 is deployed |
| 3 | contract | landing 2 is deployed |

## Per slice: done when

**s1**
- `product_repositories` exists with the spec's columns; `supabase/checks/product_repositories.sql`
  proves a repository linked to two products, each link with its own role, and both listing it.
- The backfill gives every repository with a `product_id` one link (`added_by = 'person'`), and a
  repository without one none.
- A new repository gets no product (the default trigger is dropped).
- A self-consume, a consumes naming a repository outside the product, and `read_at` missing on an
  imported link are refused.
- A member cannot write a link; an owner can, through `product_repository_link()` and
  `product_repository_unlink()`. `repository_set_product()` still works, now writing a link, so the
  deployed app keeps working until landing 2.

**s2**
- `dossiers.product_id` and `ideas.product_id` exist, nullable.
- A dossier's first push with a repository in one product takes it; in none, none; in several, the
  product the push names, or none.
- Changing a PRD's product is refused with `product is locked: PRD <n> is approved` while an
  approval is in force, and allowed again after a void.
- Giving a PRD a product links its home repository, and every repository its plan names, with
  `added_by = 'prd'`; an existing link is left as is.

**s3**
- For `business_for_repo`, `business_for_token`, `dossier_approve` and `approval_request`, the checks
  prove the three cases: the PRD's product, the repository's only product, and none.
- A PRD in a repository linked to two products reads its own product's approvers, claims and personas.
- `business_for_token` with several products and no repository answers with no product instead of
  raising.
- With no product, any member approves and the asked are every member but the author, as before.

**s4**
- The config accepts `plan.product`, and refuses `product` and `targets` together, naming both.
- `omni targets` with `plan.product` prints the product's links as the targets table, from a stubbed
  server.
- A link with no role is refused: `<repo> has no role in product <name>: set it on the product page`.
- The server unreachable: `omni targets` prints `targets from the last read, <date> · server
  unreachable` from `.omni-loop/local/product-targets.json`; with no copy it stops with
  `no targets: the server is unreachable and nothing was read yet`.
- A config with `plan.targets[]` behaves exactly as before.
- The route's controller answers 401 to a signed-out request.
- `pnpm mutation:changed` reports no survivor in `kit/lib/config.ts`.

**s5**
- `omni product import --product Mobile` adds a link per target and prints what it added and
  changed; a second run changes nothing; it never edits the config.
- `omni product which` prints this repository's products, one per line, or `none`.
- `omni help product` describes both.

**s6**
- `omni dossier push <n> --product <name>` sends the product on a first push; the server applies the
  birth rule.
- `omni prd <n>` prints `product: <name>` or `product: none`.
- The brainstorm and mega-brainstorm skills ask "Which product is this PRD for?" only when
  `omni product which` prints more than one product, and pass the answer to the first push; with
  one or none they ask nothing.

**s7**
- A member changes a PRD's product on its page (the workspace's products and No product) before
  approval.
- Once an approval is in force, the picker is disabled and shows
  `product is locked: PRD <n> is approved`; after a void it is enabled again.
- The controller answers 401 signed out, and refuses a product of another workspace.

**s8**
- The sidebar has Products, opening `/app/products`.
- Each product card shows its name, its repositories (a shared one marked as shared), its PRD count
  and how many items wait on the viewer.
- Repositories in no product are listed below with **Add to a product**.
- The `src/products/*` breaches it rewrites leave `layering/baseline.json`.

**s9**
- `/app/products/<id>` opens on the Ledger: lanes *on you*, *on GitHub review*, *on the agent*, each
  row with its number or seal, ◆/◇, one state word and its PR chips, and the summary of building,
  waiting on a person and drifted.
- The PRDs tab lists the product's PRDs, newest first, each with its birthplace and state.
- Page tests cover the empty, filled and signed-out states.

**s10**
- Ideas, Roadmap, Bug fixes, Visual fixes and Questions each list only the product's items, from the
  tables the spec names; Questions links each question to where it is answered today.
- Each tab has a page test for its empty and filled states.

**s11**
- An owner adds a repository, edits its role, knowledge, read-at, read-only and consumes, and removes
  it; a member sees the tab read-only.
- The Approvers section shows on the product home, and Settings › Products links to it.
- Settings › Repositories shows each repository's products as chips and no longer offers a product
  select.
- The `src/products/*` and `src/repositories/*` breaches it rewrites leave `layering/baseline.json`.

**s12**
- `/prd`, `/ideas`, `/bugs` and `/visual` each have a product filter (all, one product, no product),
  and a test per list proves each choice narrows it.

**s13**
- `docs/guide/products.md` explains optional products, many-to-many links, a PRD's product and the
  product home; `several-repositories.md` shows `plan.product` and `omni product import`.
- The galaxy README's Products section replaces "Settings › Products: who approves" with the product
  home and the Repositories & approvers tab.

**s14**
- `repositories.product_id`, `repositories_default_product` and `repository_set_product()` are gone,
  and `supabase/checks/repositories.sql` proves it.
- `git grep product_id -- apps/galaxy/src/repositories` finds nothing.

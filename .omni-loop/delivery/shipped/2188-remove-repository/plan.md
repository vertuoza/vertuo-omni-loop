# Plan: Remove a repository from the workspace

PRD #2188, built from `spec.md` beside this plan. The feature branch `feat/remove-repository` merges
into `main` through the feature PR (Closes #2188). Each slice is a sub-PR from
`feat/remove-repository--<slice>` into the feature branch (Part of #2188).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | An owner removes a repository from Settings › Repositories after an "are you sure"; the row is hidden, untracked, its board private, its product links and plan repository cleared, its history kept | `supabase/migrations/` `supabase/checks/repositories.sql` `supabase/database.types.ts` `apps/galaxy/src/repositories/` | — | 1 | deep |
| s2 | Removed repositories are listed under a collapsed Removed (n) line, and the owner adds one back with its history | `apps/galaxy/src/repositories/` | s1 | 2 | build |
| s3 | The product's Repositories tab and picker, the product home and the members' ideas board skip removed repositories | `apps/galaxy/src/product-repositories/repositories-tab.repository` `apps/galaxy/src/products/products.repository` `apps/galaxy/src/product-home/product-home.repository` `apps/galaxy/src/ideas/members/store` | s1 | 2 | build |

**Shared ground.** `apps/galaxy/src/repositories/` (the view, the model, the store, the load and
their tests, `render.test.ts` included) is declared by s1 and s2. s2 waits on s1, so they sit in waves 1
and 2. s3's four reader prefixes cover each file and its own `.test.ts`. No other slice declares
them. s1 owns the one migration. `add_repository()`'s change and the refusal in `product_repository_link()`
and `product_plan_repository_set()` live in that migration too, so the database changes in one place.
The draft screen `repositories` is already written by phase 0. No slice edits it.

## Per slice: done when

### s1 (deep: a migration whose functions touch four tables in one transaction, beside cascading foreign keys) (`ui: yes`)

- A migration, dated after the newest on `main` (`node scripts/migration-order.ts`):
  - adds `repositories.removed_at`;
  - adds `remove_repository(p_workspace, p_full_name)`, owner only;
  - makes `add_repository()` clear `removed_at` and track the repository again;
  - makes `product_repository_link()` and `product_plan_repository_set()` refuse a removed
    repository with P0002.
- `supabase/checks/repositories.sql` proves each case of the spec's Test seams:
  - 42501 for a member, P0002 for a repository the workspace does not list;
  - removed_at, tracked and public_ideas after a remove;
  - the plan repository cleared, the links deleted, `consumes` stripped;
  - ideas, pull requests and knowledge packs survive;
  - removing twice answers the same row;
  - adding back clears `removed_at`;
  - link and plan-repository-set refuse a removed repository.
- `supabase/database.types.ts` is regenerated with the column and the function.
- On Settings › Repositories, the owner sees a quiet **Remove** after the switches of every card.
  A member sees none. The owner's head sentence reads `Removing one keeps its history.`
- Pressing Remove asks `window.confirm`. Its text names the products that link the repository and
  the product that plans in it, when there are any. Cancelling changes nothing. Confirming calls
  `remove_repository()`, and the card leaves the list. A refusal shows in the head card.
- The page reads `removed_at`. A removed row is not drawn in the list and is not counted by
  `addable`, so Add repository offers it again.
- `store.test.ts`: `remove` maps 42501 and P0002, and the demo port removes.
  `model.test.ts`: the `removed` action. `render.test.ts`: Remove for the owner only, and the
  confirm's text.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

### s2 (`ui: yes`)

- Under the list, a `<details>` **Removed (n)**, closed by default and absent at 0, lists each removed
  repository with `removed <ago>`. The owner also gets **Add back**.
- Add back calls `add_repository()`. The repository returns to the list, tracked, and leaves Removed (n).
  The demo port does the same.
- `render.test.ts`: absent at 0, n counted, Add back for the owner only. `model.test.ts`: the removed
  list's order and the move back on `saved`.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

### s3

- The repositories tab, the products picker, the product home and the members' ideas board's default
  repository read only rows with `removed_at is null`.
- Each reader's `.test.ts` proves that a removed row is skipped.
- A `git grep "from('repositories')"` over `apps/` lists no other reader that lists a workspace's
  repositories without the filter. A reader that looks a single repository up by name is named in
  the sub-PR's body.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

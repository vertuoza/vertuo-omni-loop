---
prd: 2188
title: Remove a repository from the workspace
blocked-by: none
spec: file
phase0: server
---

# Remove a repository from the workspace

**Date:** 2026-10-19 · **PRD:** #2188 · **Touches:** `supabase/` (one migration, its check),
`apps/galaxy` (Settings › Repositories, and the readers that list a workspace's repositories)

## Problem

A workspace owner added `vertuoza/vertuobuild` to Settings › Repositories. The Omni App lost access
to it. Its card now says **Omni App has no access · Give access on GitHub →**, and nothing on the
page removes it. That is by design today: `public.repositories` says "nothing deletes one"
(`supabase/migrations/20261008090000_repositories.sql`), and the only control is Tracked. Switching
Tracked off hides the repository from the Engineering board, but its card stays on Settings ›
Repositories, in every product's repository picker and on the product filter, for good.

Deleting the row is not an answer. `ideas`, `pull_requests` (and their reviews), `product_repositories`
and `knowledge_packs` cascade from it, so a delete would wipe the repository's ideas board, its
pull-request history and its knowledge for good. A product whose plan repository it is would also
block the delete.

## Solution

An owner **removes** a repository. Removing hides it and keeps its history. Adding it again brings
the history back.

1. **The database.** One migration:
   - adds `repositories.removed_at timestamptz` (null while the repository is listed);
   - adds `remove_repository(p_workspace uuid, p_full_name text) returns public.repositories`, owner
     only (`repository_owner_only`, 42501), P0002 for a repository the workspace does not list. In
     one transaction it:
     - sets `removed_at = now()`, `tracked = false` and `public_ideas = false`;
     - clears `products.plan_repository` wherever it names the repository;
     - deletes the repository's `product_repositories` links;
     - drops the repository from every other link's `consumes`.
     Removing a repository that is already removed answers it as it is.
   - changes `add_repository()` so that adding a removed repository clears `removed_at` and sets
     `tracked = true`. Its ideas, pull requests and knowledge packs are there again; its product
     links and plan repository are not (a person relinks them on the product's home).
   - makes `product_repository_link()` and `product_plan_repository_set()` refuse a removed
     repository with their existing P0002 "not one of this workspace's repositories".
   - The ideas, pull requests, knowledge packs and the collector's columns are left untouched.
2. **The readers that list a workspace's repositories** skip removed ones (`removed_at is null`):
   - Settings › Repositories' list and its Add offer (`addable` compares only listed rows, so a
     removed repository the App can see is offered again);
   - the product's Repositories tab and its picker (`repositories-tab.repository.ts`,
     `products.repository.ts`);
   - the product home (`product-home.repository.ts`);
   - the members' ideas board's default repository (`ideas/members/store.ts`).

   The collector and the Engineering board read only tracked repositories, and a removed one is
   untracked, so they change nothing.
3. **Settings › Repositories.**
   - The owner's head-card sentence becomes `Removing one keeps its history.` (the word pass: the
     current 19-word sentence explains at rest).
   - Each card shows the owner a quiet **Remove** after its switches. A member sees no Remove.
   - Pressing it asks first, with `window.confirm` as the Delete draft and Delete session buttons
     already do: `Remove <owner/name>? Its ideas and history are kept, and adding it again brings
     them back.` When products link it, the line `It leaves <Product>, <Product>.` is added. When it
     is a product's plan repository, the line `<Product> will have no plan repository.` is added.
   - Confirmed, the card leaves the list. A refusal shows in the head card, as every refusal does
     today.
   - Under the list, a collapsed **Removed (n)** line (a `<details>`, closed by default, absent when
     n is 0) lists each removed repository: its name, `removed <ago>`, and **Add back** for the
     owner, which calls `add_repository()`. A member reads the list without Add back.
4. **The demo port** (`demoRepositoriesPort`) keeps the same rules in memory.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | database | `removed_at` | no written convention: follows `collected_at` ← `supabase/migrations/20261008090000_repositories.sql:26` |
| vertuo-omni-loop | database | `remove_repository()` | no written convention: follows `add_repository()` ← `supabase/migrations/20261008090000_repositories.sql:95` |
| vertuo-omni-loop | database | `<date>_remove_repository.sql` | conventions › A migration stays the newest (`node scripts/migration-order.ts`) |
| vertuo-omni-loop | galaxy | `RepositoriesPort.remove` | no written convention: follows `setTracked` ← `apps/galaxy/src/repositories/store.ts:28` |
| vertuo-omni-loop | galaxy | `RepositoryRow.removedAt` | no written convention: follows `collectedAt` ← `apps/galaxy/src/repositories/model.ts:22` |
| vertuo-omni-loop | galaxy | action `removed` of `repositoriesReducer` | no written convention: follows `saved` ← `apps/galaxy/src/repositories/model.ts:125` |

## Decisions

- **Hide, never delete** (the person, 2026-10-19). The row stays, so its ideas, pull-request history and
  knowledge packs survive, and adding it again brings them back.
- **Any repository, the owner only** (the person). Remove is on every card, not only on cards marked
  as unreachable: a renamed or archived repository needs it too. It goes through
  `repository_owner_only`, as Tracked does.
- **A plan repository is cleared after an "are you sure"** (the person). Remove does not refuse: the
  confirm names each product that loses its plan repository, and removing clears it.
- **Product links are configuration, not history** (agent, approved with the design). They are
  deleted, together with the repository in other links' `consumes`, so no product shows a repository
  the workspace no longer lists. Adding the repository back does not bring them back.
- **Public ideas is switched off** (agent, approved with the design). A removed repository's board
  is no longer public, which also frees `repositories_public_ideas_key` for another workspace.
- **The voice's objection, accepted.** persona:Lead Engineer: "I watch the Engineering board to keep
  teams coherent; a repository that silently drops out of it reads like a bug to me." The page now
  lists removed repositories under a collapsed **Removed (n)** line with Add back.
- **`window.confirm`, not a custom dialog.** It follows `DeleteDraft.tsx` and `AskSession.tsx`.
- **Server-side checks are left alone.** The SQL functions that ask whether a repository belongs to
  a workspace (agent tokens, approvals, constituents, API keys) still count a removed repository as
  the workspace's. Nothing runs on it, because the App cannot reach it. See Risks.
- **No library screen for Settings › Repositories existed.** Step 5 drafts `repositories`, never
  locked.

## User stories

- As a workspace owner, I remove a repository the Omni App can no longer reach, so my list shows
  only the repositories we work in.
- As a workspace owner, I add back a repository I removed by mistake, and its ideas and history are
  there again.
- As a lead engineer, I open **Removed (n)** to see why a repository left the Engineering board, and
  when.
- As a member, I see the removed repositories, but I cannot remove or add one back.

## Scope

In:
- the migration, its check in `supabase/checks/repositories.sql`, and `database.types.ts`;
- Settings › Repositories: Remove, the confirm, Removed (n), Add back, and the demo;
- the four listing readers above;
- the draft screen `repositories` in the screen library.

Out:
- deleting a repository's data for good;
- removing a repository automatically when the App loses access;
- changes to server-side membership checks (agent tokens, approvals, API keys, constituents);
- bringing product links back on Add back.

## Test seams

The testing form applies: tests sit beside the code, they never call Supabase or GitHub, and the
database's rules are proved by `supabase/checks/`.

- `supabase/checks/repositories.sql` proves, with realistic rows:
  - a member is refused (42501) and an unknown repository is refused (P0002);
  - remove sets `removed_at`, `tracked = false` and `public_ideas = false`;
  - remove clears a product's `plan_repository`, deletes its links and strips it from `consumes`;
  - ideas, pull requests and knowledge packs survive remove;
  - remove twice answers the same row;
  - add after remove clears `removed_at` and tracks it;
  - link and plan-repository-set refuse a removed repository.
- `apps/galaxy/src/repositories/model.test.ts`: the reducer's `removed` action; `addable` ignores
  removed rows; the removed list and its order.
- `store.test.ts`: `remove` calls `remove_repository` and maps 42501 and P0002; the demo port removes
  and adds back.
- `render.test.ts`:
  - an owner sees Remove on every card, a member sees none;
  - **Removed (n)** is absent at 0, and lists its repositories with Add back for the owner only;
  - the confirm's text names the linked products and the plan repository.
- `load.test.ts`: the page reads `removed_at` and splits the listed rows from the removed ones.
- Each listing reader's test: a removed row is filtered.

## Risks

- **What merging publishes:** one migration on production Supabase and a new control on Settings ›
  Repositories (Vercel). Rollback: a follow-up migration that sets `removed_at = null` on every row
  and restores the previous functions. Links and plan repositories that were deleted are not
  restored; the confirm says so before each remove.
- **A removed repository still counts as the workspace's on the server.** Agent links, API keys,
  approvals and constituents keep passing their "belongs to this workspace" check for it. BR-PRODUCT-63
  (an agent link reads only repositories in its own workspace) holds: the repository is still that
  workspace's. A later PRD can tighten it.
- **A reader that is missed** keeps showing a removed repository. The listing readers are named in
  Solution step 2, and the slice that adds the column greps `from('repositories')` for any other.
- The locked laws: none touched. BR-PRODUCT-63 is read above and holds unchanged.

## Acceptance criteria

1. An owner presses Remove on `vertuoza/vertuobuild` and confirms. Its card leaves the list,
   **Removed (1)** appears under the list, and the repository is gone from every product's
   Repositories tab, its picker and the Engineering board.
2. Cancelling the confirm changes nothing.
3. When products link the repository, or one plans in it, the confirm names them. After the remove,
   those products no longer list it, and the one that planned in it has no plan repository.
4. Add back on a removed repository puts its card back, tracked, with its ideas board and history.
5. A member sees no Remove and no Add back. The database refuses `remove_repository()` from a member
   with 42501.
6. The repository's ideas, pull requests and knowledge packs are still in the database after remove.
7. A removed repository cannot be linked to a product or set as its plan repository until it is
   added back.

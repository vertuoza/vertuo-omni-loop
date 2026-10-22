# Plan: Waiting board

PRD #2377, spec beside this plan (`spec.md`). The feature branch `feat/waiting-board` goes into `main`
through the feature PR (`Closes #2377`); each slice is a sub-PR from `feat/waiting-board--<slice>`
into the feature branch (`Part of #2377`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The stages sync records `review` and `merge` waits in a new `waits` table: since kept, ended rows kept, read by members only | `supabase/migrations/` `supabase/checks/waits.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/stages/sync/` | — | 1 | deep |
| s2 | The sync also records `approval`, `outbox` and `law` waits, with their turns and since | `apps/galaxy/src/stages/sync/` | s1 | 2 | build |
| s3 | `/app/waiting` shows the Workspace tab: every open wait, oldest first, faces, working days, red past 2, the stale line; the sidebar's Waiting entry and its sprite | `apps/galaxy/app/app/waiting/` `apps/galaxy/src/waiting-board/` `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` `packages/design/src/sprites` | s1 | 2 | build |
| s4 | The My PRDs and My reviews tabs, and their empty states | `apps/galaxy/src/waiting-board/` `apps/galaxy/app/app/waiting/` | s3 | 3 | build |
| s5 | The bell's Reviews group, `GET /api/waiting/reviews`, `WaitingCounts.reviews` in the total, and the Waiting entry's badge | `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/reviews/` `apps/galaxy/src/nav/bell` `apps/galaxy/src/nav/Bell` `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` | s4 | 4 | build |

**Shared ground.**

- `apps/galaxy/src/stages/sync/`: s1 (the table's writer, the reader's new fields, `review` and
  `merge`) and s2 (the other three kinds). s2 waits for s1: wave 2.
- `apps/galaxy/src/waiting-board/` and `apps/galaxy/app/app/waiting/`: s3 builds the page, s4 adds its
  tabs; wave 2, then wave 3.
- `apps/galaxy/src/nav/sidebar*` and `apps/galaxy/src/nav/Sidebar*` (with `sidebar.test.ts` and
  `Sidebar.render.test.ts`, which list every entry): s3 adds the entry, s5 its badge; wave 2, then
  wave 4.
- s5 reads s4's "is it my turn" from `waiting-board/board.ts` and does not change it, so it waits for
  s4.

## Per slice: done when

### s1 (deep: a migration, row-level security and the sync's write path) (`ui: yes`)

- A migration, taking the next free version after `main`'s newest, creates `waits` as the spec's §2
  says, with one open row per (workspace, repo, prd, pr, kind) and members-only reads.
- `supabase/checks/waits.sql` proves a member reads their workspace's rows and no other's, and that no
  role but the service role writes; it is its own step of the `supabase` workflow's `check` job.
- `supabase/database.types.ts` is regenerated, never written.
- `SnapshotPull` carries `requested`, `reviews` and `lawLocked`; the reader reads reviews only for an
  open, ready pull request into the default branch that changed since the last sync (a stubbed-fetch
  test counts the calls).
- `waits.ts` turns a snapshot into `review` and `merge` waits with their turns and since (spec §1),
  ignoring sub-PRs and pull requests whose latest review asked for changes; bug fix and visual update
  pull requests carry no PRD.
- The store keeps `since`, moves `turn` and `seen_at`, ends a wait no longer seen, opens a new row for
  one seen again, and ends nothing on a failed read; its select is a `*.boundary.ts` that
  `pnpm schemas:verify` reads.

### s2 (`ui: yes`)

- `approval` (◆ PRD not approved: the approvers, since stage `prd`), `outbox` (draft feature PR with
  open `high` or `human-action` items: the PRD's owner plus the escalation record's asked people,
  since the first item), and `law` (`law-locked` red: the law's owners and delegates, since the
  record's first-held time or first seen) are each produced by `waits.ts`, with a test per turn
  fallback.
- The `law-locked` check is read only for open, ready, changed pull requests into the default branch.

### s3 (`ui: yes`)

- `/app/waiting` renders the Workspace tab as the signed-in person: every open wait, oldest first,
  with the PRD (or bug fix / visual update) and its pull request linked, what it waits on in words,
  whose turn as faces (a team by its name), and the age in working days (`today` under one), red past
  `limits.escalationWorkingDays`.
- The stale line names a repository last synced more than 30 minutes ago; the empty state reads
  `Nothing waits on a person.`; an unreadable read says the page could not load.
- The demo world (`pnpm galaxy:dev`) shows example rows; the product filter applies.
- The sidebar's Work group shows Waiting after PRDs, with the new `menu-waiting` sprite, current on
  `/app/waiting`; the trail reads `Work › Waiting`.
- Client → controller → service → repository, as `scripts/layering-guard.test.ts` holds.

### s4 (`ui: yes`)

- `?tab=mine` lists the waits of PRDs whose dossier the person opened, theirs first, never a bug fix
  or visual update; empty: `None of your PRDs waits on anyone.`
- `?tab=reviews` lists the waits whose turn names the person's GitHub login, never by a team; empty:
  `Nothing waits on you.`; the tab shows its count.
- Working days across a weekend are tested (Friday to Monday counts 1).

### s5 (`ui: yes`)

- `GET /api/waiting/reviews` returns, as the person, their open `review`, `merge` and `law` waits;
  `WaitingCounts.reviews` adds to `total`, so the bell, the tab's `(N)` and the favicon dot move.
- The bell's panel shows a Reviews group after Approvals, oldest first, each line `PRD <n>` (or the
  fix), `Review` / `Merge` / `Law <id>` and its age, opening the pull request; unreadable:
  `Reviews couldn't be read — retrying.`; approvals and outbox items are never repeated in it.
- The Waiting entry carries the reviews count as its badge, spoken `Waiting: <n> yours`, none at 0.

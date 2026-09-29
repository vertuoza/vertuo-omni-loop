---
prd: 691
title: Fast fix lists — Bug Fixes and Visual Updates read stored GitHub facts
blocked-by: none
spec: file
---

# Fast fix lists

**Date:** 2026-09-29 · **PRD:** #691 · **Touches:** `apps/galaxy` (`src/fixes`, a new
`src/fixes/facts/`, `src/stages/sync`, `src/dossier/page/DossierRoute.tsx`, `app/bugs`,
`app/visual`), `supabase/migrations`, `supabase/checks`. No change to `apps/omni-app`, the kit, the
game, or what either list shows.

## Problem

Bug Fixes (`/bugs`) and Visual Updates (`/visual`) are the slowest pages left after PRD 657. They
were measured on production on 2026-09-29, signed in, from Chrome:

| page | first load | warm median | worst warm load |
| --- | --- | --- | --- |
| /bugs | 4.4 s | 446 ms | 3.9 s |
| /visual | 1.0 s | 452 ms | 1.3 s |

`fixListRoute` (`src/fixes/FixListRoute.tsx`) calls `reader.fix()` for every fix of the kind. Each
call makes about five GitHub requests (the issue, the pull request, who merged it, the reviews and
the releases), and the page renders nothing until every one has answered. The reader's cache lasts
60 seconds per function instance, so the first visitor after it expires, or on a cold instance,
waits seconds on a blank page. The route also calls `auth.getUser()` (a network round trip) instead
of PRD 657's `viewer()`, and neither route has a `loading.tsx`.

## Solution

**1. A table of stored facts.** The new table `fix_facts` holds one row per fix dossier:

- `dossier_id`, the primary key, which references `dossiers` on delete cascade;
- `workspace_id`;
- `facts`: the fix's `FixSummary` (issue, pull request, approvals, release) as `jsonb`, exactly as
  the reader returns it;
- `synced_at`.

Members read their workspace's rows. Only the service role writes.

**2. Keeping it fresh.** One function, `refreshFixFacts(workspace, fixes, deps)` in
`src/fixes/facts/`, reads `reader.fix()` for each fix and stores the result. A part GitHub could not
read (`UNREAD`) keeps its stored value, and a fix whose whole read failed keeps its row. It is called
from two places:

- **The stages sync** (every 15 minutes) refreshes, per workspace, every fix dossier that has no
  stored release yet. A fix with a release is final and is not read again.
- **The fix's own page** (`/bugs/<id>`, `/visual/<id>`) still reads GitHub live for its Timeline, as
  today, and writes what it read back to `fix_facts`, without waiting for the write.

**3. The lists read the database.** `fixListRoute` reads `fix_facts` for the workspace's fixes,
with one query per request, and never calls GitHub. A fix with no stored row yet shows `—` in its
pills, as a failed read does today. "Mine" then falls back to the dossier's `opened_by`. The route
reads the user through `viewer()` (PRD 657), and `app/bugs` and `app/visual` each get a
`loading.tsx` with the list's skeleton.

**4. Timings.** A `timings.md` in this folder holds the before table above. After the merge, the
same in-Chrome measurement fills the after table.

## Decisions

- **Store the facts** (asked), rather than streaming the list while GitHub answers.
- **The whole `FixSummary` as `jsonb`**, not columns. The list already reads that shape, so the store
  and the reader cannot drift, and a new fact needs no migration.
- **No PR-event refresh.** omni-app forwards only the loop's feature-branch events (`stage-forward`),
  not `fix/…` branches. Forwarding them would change a second app, so it is left out. The sync and
  the fix's own page keep the facts fresh.
- **A released fix is final.** The sync stops reading it, which keeps the App's GitHub budget bounded.

## User stories

- As a member opening Bug Fixes or Visual Updates, I see the frame at once and the list within about
  half a second, whatever GitHub's state.
- As a member opening one fix, I still see its live Timeline, and the list catches up with what I saw.

## Scope

In: everything under **Solution**.

Out:
- The fix page's own GitHub reads, which stay live.
- omni-app.
- Realtime updates.
- The `/prd` list.

## Test seams

A test never calls GitHub or Supabase (`omni kb show testing`).

- `refreshFixFacts` with a stubbed reader and a fake store:
  - a fix is read and stored;
  - an `UNREAD` part keeps the stored value;
  - a fix with a stored release is not read.
- The stages sync test: it calls the refresh with the workspace's unreleased fixes.
- `fixListRoute`: it reads the store and makes no GitHub call (a reader that throws proves it). A fix
  with no row shows `—`, and "Mine" falls back to `opened_by`.
- `DossierRoute`: a fix page writes back what it read.
- `supabase/checks/fix_facts.sql`: a member reads their workspace's rows only, and nobody signed in
  writes.
- A test that `app/bugs` and `app/visual` have a `loading.tsx`.

## Risks

Merging publishes one migration (`fix_facts`) to production Supabase and the galaxy app
(`omni kb show releasing`).

- **An empty table right after the deploy.** Every pill shows `—` until the first sync, within 15
  minutes. Rollback: revert the route to the live read.
- **Stale pills.** Up to 15 minutes old, and newer on any fix whose page was opened.
- **GitHub budget.** The sync reads every unreleased fix every 15 minutes, which is about five
  requests per fix. With about 20 open fixes that is about 400 requests an hour, well below the App's
  5000.
- Rollback: drop the table and revert the route.

## Acceptance criteria

1. Rendering `/bugs` or `/visual` makes no GitHub request. Their pills and the "Mine" filter read
   `fix_facts`.
2. The stages sync stores each unreleased fix's facts. A part it could not read keeps its stored
   value, and a released fix is not read again.
3. Opening a fix's page writes its freshly read facts to `fix_facts`.
4. `app/bugs` and `app/visual` have a `loading.tsx`, and `fixListRoute` reads the user through
   `viewer()`, not `auth.getUser()`.
5. `supabase/checks/fix_facts.sql` passes: members read only their workspace's rows, and only the
   service role writes.
6. After the merge, `/bugs` and `/visual` load in under 600 ms at the median and under 1 s at the
   worst of ten warm loads, measured on production the same way as the before table.

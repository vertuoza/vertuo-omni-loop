---
prd: 657
title: Snappy pages — stream the frame, GitHub off the request path, set-based SQL
blocked-by: none
spec: file
---

# Snappy pages

**Date:** 2026-09-29 · **PRD:** #657 · **Touches:** `apps/galaxy` (proxy, layouts, the `/prd` and
`/app` pages, `src/nav`, `src/data`, `src/dossier`, `src/dashboard`, `src/stages/sync`,
`src/waiting`, `src/outbox-waiting`), `supabase/migrations`, `supabase/checks`. No change to the
kit, the game rules (`game/`), `apps/omni-app`, or what any page shows.

## Problem

The PRD list (`/prd`) and the dashboards (`/app`, `/app/workspace`, `/app/fleet`) are slow, and
they get slower as the data grows. A read-only audit (2026-09-29) found why:

1. **Nothing streams.** There is no `loading.tsx` and no `<Suspense>` anywhere in the app. Every page
   is a dynamic server component that waits for its slowest read before sending one byte, and the
   layout's `viewerLive()` holds up the frame too.
2. **`/prd` waits on GitHub for every row.** `readOpenCounts` (`src/dossier/page/history.ts`) calls
   the GitHub summary of every numbered dossier to count its open outbox questions. One summary costs
   about 12–20 REST calls in 4–6 sequential hops, reads `config.yml` again for every PRD, and uses a
   60-second cache that is per instance and has no in-flight dedup. The 60-second outbox poll
   (`/api/waiting/outbox`) does the same for up to 30 dossiers per open tab. Together they also drain
   the App's GitHub budget.
3. **`dossier_list()` is unbounded and nested.** With no argument it returns every dossier of every
   workspace of the caller. For each dossier it calls `dossier_rounds()` (a separate SQL function
   that cannot be inlined) and a count over `dossier_versions`, with row-level security evaluated
   inside each. The dashboards call it too (`src/dashboard/board/load.ts`) and then keep one
   workspace in JS.
4. **The dashboards fold the whole ledger on every request.** `loadGalaxy`
   (`src/data/load-galaxy.ts`) pages through every `ledger_events` row of the workspace, `data`
   jsonb included, 1000 at a time and in sequence, then runs `buildGalaxy` over it, on `/app`,
   `/app/workspace` and `/app/fleet`.
5. **Three sign-in round trips per page.** The proxy, the layout and the page each call
   `auth.getUser()`, a network call to Supabase Auth. The proxy's matcher also covers `/api/*` polls
   and server actions. `supabaseServer()` builds a new client on each call. The workspace and the
   waiting questions are read twice per request, once by the layout and once by the page.
6. **Every click is a full reload.** The sidebar and app bar use plain `<a href>`, so navigating
   re-runs the layout's reads and restarts all three polls.
7. **Polling reloads whole pages.** The PRD page's `LiveRefresh` calls `router.refresh()` when its
   2-second signature changes, which re-runs the whole server tree: auth, every dossier read, the
   GitHub summary and the markdown render. The waiting provider polls questions every 5 s even in a
   hidden tab.
8. **Indexes and RLS do not follow the reads.** Missing indexes: `contributions(workspace_id, at)`,
   `dossiers(opened_by)`, `dossier_versions(created_at)` and `ask_rounds(answered_at)`. Policies call
   `is_member()` or a bare `auth.uid()` once per row.

Vercel runs in `fra1`, and the Supabase project is in Frankfurt (eu-central-1, confirmed by the
person). The regions match, so the cost is in the number of sequential hops, not in their distance.

## Solution

**1. The frame paints at once.** Every page under `/app` and `/prd` gets a `loading.tsx` that draws
its skeleton, which is the frame, the sidebar and the header with grey blocks where the data goes.
Inside each page, every independent heavy block (each dashboard tile or board section, the PRD
list, the PRD page's GitHub pill and outbox) sits in its own `<Suspense>` with a skeleton of its
size, so a slow block holds up only itself. The layout renders the frame from the viewer alone. The
waiting counts become their own streamed block.

**2. Auth once per request.** The proxy calls `auth.getClaims()` instead of `auth.getUser()`, and
its matcher leaves out `/api/*`, fonts, CSS, GIFs and the other static files. A new
`src/data/viewer.ts` exposes one `viewer()` wrapped in React `cache()`, which returns the per-request
Supabase client, the user (from the claims) and the member workspace. The layout and every page call
it, so auth, the client and the workspace are read once per request. `readWaitingQuestions` is read
once, by the layout's streamed block, and the page's `loadWaiting` reuses it.

**3. Soft navigation.** The sidebar (`src/nav/Sidebar.tsx`) and the app bar (`src/nav/AppBar.tsx`)
use `next/link`. A click keeps the layout and the polls, and links in view are prefetched.

**4. GitHub leaves the request path of `/prd`.** A new table, `prd_outbox`, keeps each PRD's number
of open outbox questions: `(workspace_id, repository, prd)` → `open_questions`, `synced_at`. The
stages sync (`src/stages/sync`), which runs every 15 minutes, counts the open items of each PRD at
the `building` or `outbox` stage and writes them there. A PRD at any other stage stores 0. The stage
event route recounts one PRD whenever its feature PR changes, and so does a Send on the Outbox tab.
`/prd` and `/api/waiting/outbox` read `prd_outbox` rather than GitHub. The PRD page still reads
GitHub live, inside its `<Suspense>` block, and its reader gains an in-flight dedup (concurrent
callers share one promise) plus one `config.yml` read per repository per cache window.

**5. `dossier_list` becomes set-based and scoped.** The function is
replaced in place (dropped and recreated, so no ambiguous overload remains) as
`dossier_list(p_dossier uuid default null, p_workspace uuid default null)`, with the same columns.
Callers pass named arguments, so today's calls keep working.
It computes the round and version counts as grouped joins instead of calling `dossier_rounds()` for
each dossier, and filters on `p_workspace` when one is given. The dashboards pass their workspace.
`/prd` keeps listing every workspace of the viewer, which is today's behaviour.

**6. The season is cached.** `loadGalaxy` stays the only place the season is computed (`buildGalaxy`
and the game's rules are untouched). Its result is cached per workspace in Next's data cache, which
Vercel shares across function instances. The cache key is the workspace, its newest ledger event
(`id` and `at`, one indexed query run as the viewer) and the UTC day. A new event makes a new key,
so the season is never stale. An unchanged ledger costs that one small query instead of paging the
whole history. The cached read uses the server's service key, because a cache entry cannot carry a
viewer's cookies, and it runs only after the viewer's own key query has proved them a member.

**7. Indexes and RLS.** One migration adds `contributions(workspace_id, at)`, `dossiers(opened_by)`,
`dossier_versions(created_at)` and `ask_rounds(answered_at)`. It rewrites `is_member()` and each
policy that compares `auth.uid()` so that the uid is read once per statement:
`(select auth.uid())`, and `(select public.is_member(workspace_id))` where the argument allows it.
Who can read and write what does not change.

**8. Calmer polling.** On the PRD page, `LiveRefresh` refreshes the server tree only when a new
version or a new round appears, not on any change of the signature. The GitHub pill refreshes on
its own through its existing server action. The waiting provider polls questions every 15 s while
the tab is hidden, and again every 5 s as soon as it is visible.

**9. Timings, before and after.** A script, `apps/galaxy/scripts/timings.mjs`, loads `/prd`,
`/app`, `/app/workspace` and `/app/fleet` ten times each with a session cookie the person pastes,
and prints for each page the median and p75 time to first byte and to the full document. The first
slice runs it against production and writes the result into `timings.md` in this folder as the
baseline. The run after merging adds the "after" column.

## Decisions

- **One PRD, fixed at the root** (asked), not a cache layered on top and not split into two PRDs.
- **What "snappy" means** (asked): the frame paints in under 200 ms, and a warm `/prd` or dashboard
  is complete in about 1 s, measured on production.
- **Pages that hurt most** (asked): the PRD list and the dashboards. The engineering board and
  `/prd/[id]` benefit from the shared parts (auth, streaming, links) but are not the target.
- **Region** (asked): the Supabase project is in Frankfurt, so Vercel stays in `fra1`.
- **Season: cached, not ported to SQL** (asked). The game's rules stay in `buildGalaxy`, and the
  game stays a removable layer.
- **Open question counts in their own table.** `prd_outbox` is a new table, not a column on
  `prd_stages`, because `prd_stages` holds one row per stage and a count belongs to the PRD. The
  rollback is to drop the table.
- **`/prd`'s counts may lag up to 15 minutes** for a PRD whose outbox changed without a PR event or
  a Send (an answer typed on GitHub, for example). The PRD page itself stays live.
- **`getClaims()` in the proxy.** It checks the JWT locally when the project signs with asymmetric
  keys, and otherwise falls back to the same network call as today, so it is never slower. Server
  code that must trust the user for a write still goes through row-level security.

## User stories

- As a member opening `/prd`, I see the list's frame and filters at once, and the rows within about
  a second, even with many PRDs.
- As a member opening my dashboard, I see the tiles' frames at once. Each tile fills in as its data
  arrives, and a slow tile never blocks the others.
- As a member clicking through the sidebar, the page changes without a full reload, and the bell and
  the tab's count stay as they were.
- As the workspace owner, the App's GitHub budget is no longer spent by people browsing the PRD
  list.

## Scope

In: everything under **Solution** above, and the tests and checks listed under **Test seams**.

Out:
- New screens, or changes to what any page shows.
- The engineering board's own queries (its `.or()` PR query).
- `/play` and `/knowledge`.
- Realtime subscriptions in place of polling.
- Materialized views.
- Moving regions.
- Any change to `game/` or the kit.

## Test seams

Following `omni kb show testing`, a test never calls GitHub or Supabase.

- **Viewer**: a unit test that `viewer()` builds one client and reads auth and the workspace once
  when it is called several times in one request (a fake client counts the calls).
- **Proxy**: a test of the matcher (which paths it covers and which it leaves out), and a test that
  it calls `getClaims`, not `getUser`.
- **Links**: a render test that the sidebar and the app bar use `next/link` and keep their
  highlight.
- **Open counts**: sync tests (`src/stages/sync/*.test.ts`, stubbed GitHub) that a PRD at building
  or outbox gets its count of open items, and any other PRD gets 0. A history test that
  `readOpenCounts` reads the store's rows and makes no GitHub call. A store fake beside the existing
  `store.fake.ts`.
- **GitHub reader**: a test that two concurrent `summary()` calls for one dossier make one set of
  requests, and that two PRDs of one repository read `config.yml` once.
- **Season cache**: a test that an unchanged newest event returns the cached season without paging
  the ledger, and that a new event recomputes it (an injected cache and a fake client).
- **SQL**:
  - `supabase/checks/dossiers.sql` pins that the new `dossier_list` returns the rows and counts
    the old one gave on its fixtures, with and without `p_workspace`.
  - `supabase/checks/prd_outbox.sql` pins who reads and writes `prd_outbox`: members read their
    workspace, and only the service role writes.
  - `supabase/checks/access.sql` still passes after the RLS rewrite.
  - A migration text test pins the four indexes.
- **Streaming**: every route under `app/app` and `app/prd` has a `loading.tsx`. A test walks the
  folder.
- **LiveRefresh**: a component test that a signature change without a new version or round does
  not call `router.refresh`.
- **Manual**: `scripts/timings.mjs` before and after, and a browser pass that the skeletons show and
  a sidebar click does not reload the document.

## Risks

Merging publishes the migrations to the production Supabase project through the `supabase` workflow
(`omni kb show releasing`), and the galaxy app through Vercel.

- **RLS rewrite.** A wrong policy could hide or expose rows. `supabase/checks/*.sql` runs on the pull
  request against every policy. Rollback: a follow-up migration that restores the previous policy
  text, which the migration keeps in comments.
- **New `dossier_list`.** A difference in counts would show wrong numbers on `/prd`. The SQL check
  pins the counts the old function gave on the same fixtures. Rollback: a follow-up migration
  restores the previous body, which this migration keeps in comments, and the app's calls stay valid
  because `p_workspace` is optional.
- **Season cache with the service key.** The cached read bypasses row-level security. It runs only
  for a workspace the viewer's own query has just read, and the key names the workspace. Rollback:
  revert the wrapper, and `loadGalaxy` reads as the viewer again.
- **`prd_outbox` lag.** Counts can be up to 15 minutes old (**Decisions**). Rollback: drop the table
  and revert `readOpenCounts`.
- **Suspense boundaries** can shift layout while data arrives. The skeletons have the size of the
  final blocks.

## Acceptance criteria

1. Each route under `app/app` and `app/prd` has a `loading.tsx`. On a cold load, the frame (sidebar,
   header, skeletons) is sent before any data block resolves.
2. One page view makes at most one Supabase Auth call, in the proxy, and `getClaims` makes none when
   asymmetric keys are on. The proxy does not run for `/api/*` or static files.
3. Clicking a sidebar or app bar entry changes the page without a document load, and the waiting
   polls are not restarted.
4. Rendering `/prd` makes no GitHub request. Its "Needs an answer" filter and badges read
   `prd_outbox`, which the stages sync fills with each PRD's open outbox questions.
5. `/api/waiting/outbox` makes no GitHub request.
6. Two concurrent GitHub summaries of one dossier make one set of requests, and PRDs of one repository
   share one `config.yml` read.
7. `dossier_list(p_workspace)` returns, for that workspace, the same rows and counts as today's
   `dossier_list()`, and the dashboards call it with their workspace.
8. A dashboard request with an unchanged ledger reads the newest event only, and never pages
   `ledger_events`. A new event is reflected on the next request.
9. The four indexes exist, `supabase/checks/*.sql` all pass after the RLS rewrite, and no policy
   compares a bare `auth.uid()`.
10. On the PRD page, a change that adds no version and no round does not refresh the server tree.
    The questions poll runs every 15 s in a hidden tab.
11. `timings.md` holds the production baseline for `/prd`, `/app`, `/app/workspace` and `/app/fleet`.
    After merging, the "after" run shows a median time to first byte under 200 ms and a warm full
    load of about 1 s or less on `/prd` and `/app`. This criterion is checked after merge, on
    production.

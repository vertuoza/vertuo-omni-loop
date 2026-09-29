# Plan: Snappy pages — stream the frame, GitHub off the request path, set-based SQL

PRD #657, spec in `spec.md` beside this plan. It is built on `feat/snappy-pages`, which merges into
`main` with `Closes #657`. Each slice is a sub-PR from `feat/snappy-pages--<slice>` into the feature
branch, with `Part of #657`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Timings, before: `scripts/timings.mjs` loads `/prd`, `/app`, `/app/workspace` and `/app/fleet` ten times each with a pasted session cookie and prints the median and p75 time to first byte and full load per page; `timings.md` holds the baseline table | `apps/galaxy/scripts/timings` `apps/galaxy/src/timings/` `.omni-loop/delivery/shipped/0657-snappy-pages/timings.md` | — | 1 |
| s2 | Auth once per request: the proxy calls `getClaims`, and its matcher leaves out `/api/*` and static files. One `viewer()` wrapped in React `cache()` gives the client, the user and the member workspace to the layout and every page, and the waiting questions are read once | `apps/galaxy/proxy.ts` `apps/galaxy/src/proxy` `apps/galaxy/src/data/viewer` `apps/galaxy/src/data/supabase-server` `apps/galaxy/src/data/member-session` `apps/galaxy/src/data/workspace` `apps/galaxy/src/nav/viewer` `apps/galaxy/src/dashboard/load` `apps/galaxy/src/dashboard/counts/` `apps/galaxy/src/dossier/page/route-gate` `apps/galaxy/app/app/` `apps/galaxy/app/prd/` | — | 1 |
| s3 | Soft navigation: the sidebar and the app bar use `next/link`, keep their highlight, and a click no longer loads a new document | `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/AppBar` `apps/galaxy/src/nav/sidebar` | — | 1 |
| s4 | The frame paints at once: every route under `app/app` and `app/prd` has a `loading.tsx` skeleton, and each heavy block (dashboard tiles and board sections, the PRD list, the PRD page's GitHub pill and outbox) streams in its own `<Suspense>` with a skeleton of its size | `apps/galaxy/app/app/` `apps/galaxy/app/prd/` `apps/galaxy/src/skeleton/` `apps/galaxy/src/dashboard/stream/` `apps/galaxy/src/dossier/page/stream/` | s2 | 2 |
| s5 | GitHub leaves `/prd`: the `prd_outbox` table holds each PRD's open outbox questions, filled by the 15-minute stages sync, recounted on a stage event and on a Send. `/prd` and `/api/waiting/outbox` read it and call no GitHub | `supabase/migrations/20261012090000_prd_outbox` `supabase/checks/prd_outbox.sql` `apps/galaxy/src/stages/` `apps/galaxy/app/api/stages/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/app/api/waiting/` `apps/galaxy/src/outbox/send` `apps/galaxy/src/dossier/page/history` `apps/galaxy/app/prd/page.tsx` | s4 | 3 |
| s6 | The PRD page's GitHub reader dedups in-flight calls (concurrent summaries of one dossier share one promise) and reads each repository's `config.yml` once per cache window | `apps/galaxy/src/dossier/github/` | — | 1 |
| s7 | `dossier_list(p_dossier, p_workspace)` is replaced in place by a set-based version (grouped joins, no per-dossier function), filters on the workspace when given, and returns the same rows and counts. The dashboards pass their workspace | `supabase/migrations/20261012100000_dossier_list_workspace` `supabase/checks/dossiers.sql` `apps/galaxy/src/data/dossiers` `apps/galaxy/src/dashboard/board/load` | — | 1 |
| s8 | The season is cached per workspace in Next's data cache, keyed by the workspace, its newest ledger event and the UTC day. An unchanged ledger reads one row, and a new event recomputes it through `buildGalaxy` as today | `apps/galaxy/src/data/load-galaxy` `apps/galaxy/src/data/season-cache` `apps/galaxy/src/data/arcade.test` | — | 1 |
| s9 | Indexes and RLS: `contributions(workspace_id, at)`, `dossiers(opened_by)`, `dossier_versions(created_at)` and `ask_rounds(answered_at)` exist. `is_member()` and every policy read the uid once per statement (`(select auth.uid())`), with who can read what unchanged | `supabase/migrations/20261012110000_rls_once_and_indexes` `supabase/checks/access.sql` `apps/galaxy/src/perf-sql` | — | 1 |
| s10 | Calmer polling: the PRD page refreshes the server tree only on a new version or round, and the questions poll runs every 15 s in a hidden tab and every 5 s when visible | `apps/galaxy/src/waiting/` `apps/galaxy/src/dossier/page/live-refresh` | — | 1 |

**Shared ground:**

- `apps/galaxy/app/app/` and `apps/galaxy/app/prd/` are declared by s2 (pages call `viewer()`) and
  s4 (loading files, Suspense boundaries). s4 is blocked by s2 and runs in wave 2.
- `apps/galaxy/app/prd/page.tsx` is declared by s2, s4 and s5: s5 swaps the GitHub reader for the
  `prd_outbox` store there, so it runs in wave 3, after both.
- `supabase/migrations/` is shared by s5, s7 and s9, each through its own file prefix with a
  distinct timestamp (`20261012090000`, `20261012100000`, `20261012110000`), so they never write the
  same file. If `main` gains a migration with the same version before the merge, the later slice
  renames its file (a version clash, as happened in PRD 517).
- `apps/galaxy/src/data/` is split by file prefix: `viewer`, `supabase-server`, `member-session` and
  `workspace` belong to s2, `dossiers` to s7, and `load-galaxy`, `season-cache` and `arcade.test`
  to s8.
- `apps/galaxy/src/dossier/page/` is split by file prefix: `route-gate` belongs to s2, `stream/` to
  s4, `history` to s5 and `live-refresh` to s10.
- `apps/galaxy/src/dashboard/` is split: `load` and `counts/` belong to s2, `stream/` to s4, and
  `board/load` to s7.
- Existing tests: `src/nav/Sidebar.render.test.ts` is s3's alone. `src/dashboard/board/load.test.ts`
  is s7's (covered by `board/load`). `src/data/dossiers.test.ts` is s7's.
  `src/dossier/page/history.test.ts` is s5's. `src/data/arcade.test.ts` is s8's.

## Per slice: done when

**s1 · Timings, before**

- A pure `summarise(samples)` in `src/timings/` returns the median and p75 of the time to first
  byte and to full load, and is tested on a fixed sample.
- `node apps/galaxy/scripts/timings.mjs --cookie <file> --base <url>` prints one row per page. With
  no cookie it stops and says how to copy one from the browser.
- `timings.md` has the table with a "before" column. When no session cookie is at hand for the
  agent, the column reads "owed: run before merge", and the item is recorded in the outbox.

**s2 · Auth once**

- A proxy test: the matcher leaves out `/api/...`, `/_next/...`, `.css`, `.woff2`, `.gif` and the
  image types, and still covers `/app` and `/prd/<id>`. The proxy calls `auth.getClaims()` and
  never `auth.getUser()`.
- `viewer.test.ts`: called three times in one request, `viewer()` creates one client and reads the
  claims and the member workspace once (a fake client counts the calls).
- The layout and the pages `/app`, `/app/workspace`, `/app/fleet`, `/app/engineering` and `/prd`
  read the user and the workspace through `viewer()`, and nothing under `app/app` or `app/prd` calls
  `auth.getUser()`. A test greps for it.
- `loadWaiting` reuses the layout's waiting questions: they are read once per request.

**s3 · Soft navigation**

- `Sidebar.render.test.ts` and an app bar render test: every entry is a `next/link`, and the
  current entry keeps its highlight, prefix match included.
- Manual: a sidebar click changes the page without a document load (the Network panel shows no
  document request), and the bell count stays.

**s4 · The frame paints at once**

- A test walks `app/app` and `app/prd`: every folder that has a `page.tsx` has a `loading.tsx`.
- The dashboard pages render each tile or board section as its own async server component inside a
  `<Suspense>` with a skeleton from `src/skeleton/`. A render test shows the skeletons while a block
  is pending and the block once it resolves, and a block that throws shows its own "could not load"
  without taking down its siblings.
- `/prd` renders the frame and filters outside the list's `<Suspense>`. `/prd/[id]` streams its
  GitHub pill and outbox blocks.
- Manual: on a cold load, the frame shows before the data.

**s5 · GitHub leaves `/prd`**

- Migration `20261012090000_prd_outbox.sql`: the `prd_outbox` table, keyed on
  `(workspace_id, repository, prd)` with `open_questions` and `synced_at`. Members read their
  workspace and only the service role writes. `supabase/checks/prd_outbox.sql` proves both, and
  that a member of another workspace, a person in no workspace and anyone signed out read nothing.
- Sync tests (stubbed GitHub): a PRD at `building` or `outbox` stores its count of open outbox
  items, and a PRD at any other stage stores 0. The stage event recounts its one PRD, and a Send
  recounts its PRD (a fake store records the writes).
- `history.test.ts`: `readOpenCounts` reads the store and makes no GitHub call. The "Needs an
  answer" filter and the badges give the same results as before on the same counts.
- `/api/waiting/outbox` reads `prd_outbox`: its test makes no GitHub call.

**s6 · GitHub reader dedup**

- Two concurrent `summary()` calls for one dossier make one set of requests (a stubbed fetch counts
  them).
- Two PRDs of one repository within the cache window read `config.yml` once.
- `forget()` still drops the dossier's summary, and the next read is fresh.

**s7 · Set-based `dossier_list`**

- The migration drops and recreates `dossier_list(p_dossier uuid default null, p_workspace uuid
  default null)` with the same columns. It keeps the previous body in a comment for rollback, and
  calls no per-dossier function.
- `supabase/checks/dossiers.sql` pins the rows and counts (rounds, answered, versions,
  last_activity) that the old function gave on its fixtures: with no argument, with `p_dossier`, and
  with `p_workspace`, where only that workspace's rows come back.
- `board/load.ts` passes the workspace, and `board/load.test.ts` asserts it. `/prd` still lists
  every workspace of the viewer.

**s8 · Season cache**

- `season-cache.test.ts` with an injected cache and a fake client: when the newest event is
  unchanged, the season comes from the cache, and the ledger is not paged. A new event id, or a new
  UTC day, recomputes it.
- The cached read uses the service client, and only after the viewer's own newest-event query
  returned a row. A viewer who is not a member gets the empty season, as today.
- `/app`, `/app/workspace` and `/app/fleet` show the same season as before on the demo data.

**s9 · Indexes and RLS**

- Migration `20261012110000_rls_once_and_indexes.sql` creates the four indexes and rewrites
  `is_member()` and the policies that compare `auth.uid()` to the `(select auth.uid())` form. It
  keeps each previous policy text in a comment.
- `src/perf-sql.test.ts` reads the migration as text: the four indexes are there, and no `create
  policy` in it compares a bare `auth.uid()`.
- Every file in `supabase/checks/` passes on the pull request, `access.sql` included.

**s10 · Calmer polling**

- `live-refresh` test: a signature change with no new version and no new round does not call
  `router.refresh`. A new version or round does.
- `WaitingProvider` test with fake timers: the questions poll runs every 5 s while visible and every
  15 s while hidden, and it polls at once when the tab becomes visible again.

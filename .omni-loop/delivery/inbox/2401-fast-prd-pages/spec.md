---
prd: 2401
title: Fast PRD list and PRD page
blocked-by: none
spec: file
phase0: server
---

## Problem

On the Omni page, the PRD list (`/prd`) takes a while to show its rows, a click on a row shows
nothing for about a second, and the PRD's page then loads slowly. The person who asked said it makes
the app feel heavy. Nothing on screen is wrong; it is slow to get there.

The reads behind both pages explain it (all paths under `apps/galaxy/`):

1. **`dossier_list()` is heavy and unscoped.** The list calls it with no filter
   (`app/prd/page.tsx:87`, `src/dossier/store.ts:372`): every dossier of every workspace the viewer
   reads, PRDs and fixes alike, with its rounds joined under row-level security, then drops the fixes
   in JavaScript (`ofWork(..., 'prd')`). A PRD's page calls the same function only to draw its
   repository chips (`readRepos`, `src/dossier/page/source.ts:44`), and the live refresh calls it
   every 2 seconds from the browser.
2. **Reads wait on each other.** The list awaits the viewer, then `dossier_list`, then the product
   scope, then the login ids, then the counts. A PRD's page awaits the dossier, five reads, the
   answerable rounds, then approval, live send and the fixing runners before its shell renders
   (`src/dossier/page/DossierRoute.tsx:284-319`). The runners are read one by one in a loop
   (`DossierRoute.tsx:141-144`).
3. **Every click is a full page load.** Rows, filters and tabs are plain `<a>` (`DossierHistory.tsx:109`,
   `:41`, `:66`, `DossierPage.tsx:322`): no prefetch, no client navigation, and the layout's viewer
   read (`app/prd/layout.tsx:31`) runs again on each one.
4. **Bodies read for a count.** `readPlanSlices` downloads the whole latest `plan.md` to count its
   slices (`source.ts:117-123`).

## Solution

Same pages, same content, same rows: only how fast they arrive changes.

1. **Measure first.** Both routes send a `Server-Timing` header naming each read and its duration
   (`viewer`, `dossier_list`, `scope`, `counts`, `dossier`, `approval`, …). A script,
   `scripts/perf-prd.ts`, requests `/prd` and `/prd/<id>` 20 times each against a base URL and prints
   the median and p95 time to first byte and to the end of the response. It signs in with a session
   cookie read from `OMNI_PERF_COOKIE`, never written to a file or a log. It runs once against
   production before any other slice, and its table goes in the feature PR; it runs again at the end.
2. **React at once.** Rows, filters, Clear and the PRD's tabs are `next/link`, prefetched when they
   come into view, so a click navigates on the client and `app/prd/[id]/loading.tsx` shows the
   skeleton at once.
3. **A lighter list.** `dossier_list()` takes a `p_kind text default null` argument and filters by it
   in SQL; the list passes `'prd'`. A PRD's repository chips and the live-refresh pulse read through
   a small function of their own, `dossier_repos(p_dossier uuid)`, `security invoker` like
   `dossier_list`, which joins no rounds. Row-level security is unchanged: every read stays under the
   caller's own sign-in.
4. **No waterfall.** On the list, the product scope and the login ids start beside `dossier_list`
   instead of after it. On a PRD's page, approval, live send and the fixing runners render in
   `Suspense` boundaries of their own, so the shell streams without them; the runners are read in one
   query (`in (...)`), not one per runner; the answerable rounds start beside the five reads.
5. **No body for a count.** The slice count is read from a stored count on the plan's version
   (written when a plan version is pushed), falling back to reading the body only for versions
   pushed before it existed.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `dossier_list(p_dossier, p_workspace, p_kind)` | `p_workspace uuid default null` ← supabase/migrations/20261120090000_dossier_list_custom_plan.sql:21 |
| vertuo-omni-loop | db | `dossier_repos(p_dossier uuid)` | no written convention: follows supabase/migrations/20261120090000_dossier_list_custom_plan.sql |
| vertuo-omni-loop | script | `scripts/perf-prd.ts` | no written convention: follows scripts/migration-order.ts |
| vertuo-omni-loop | env | `OMNI_PERF_COOKIE` | no written convention: follows apps/galaxy/.env.example |

## Decisions

- **Success is measured server-side only.** The person dropped a measured click-to-skeleton trace;
  the click's reaction is proven by a test that the links are `next/link` and that
  `app/prd/[id]/loading.tsx` exists.
- **The voice's objection** (persona:Lead Engineer): "Five optimisations in one PRD are five ways to
  break the app; without a before/after number, how will we know which one helped?" Settled
  `accepted`: the measurement is slice one, before any change, and `Server-Timing` names each read.
- **No cross-request cache.** Data stays fresh on every request; caching would trade correctness on
  a live page for speed, and the reads above should be enough. Revisited only if the final numbers
  miss the target.
- **No video proof** (the person said no).

## User stories

- As a workspace member, I open the PRD list and its rows appear quickly.
- As a workspace member, I click a PRD and see the page react at once, then its content soon after.
- As a maintainer, I can see which read costs what on either page, and measure it before and after.

## Scope

In: `/prd`, `/prd/[id]`, their links, `dossier_list`, a new `dossier_repos`, the live refresh's
pulse, `scripts/perf-prd.ts`. Out: the fix pages, other routes, any visual change, any cross-request
cache, the GitHub first-visit snapshot.

## Test seams

Per `omni kb show testing`, tests sit beside the code under `apps/galaxy/src/` and never call GitHub.

- `dossier_list` with `p_kind`: a check in `supabase/checks/` that it returns only that kind, under
  RLS, and that `dossier_list_volume.sql` still lists 1400 dossiers inside its timeout.
- `dossier_repos`: a check that it returns the same repos `dossier_list(p_dossier)` did, and nothing
  of another workspace.
- The runners read: a repository test that one query serves several runners.
- The list's and the page's links: a render test that rows, filters and tabs are `next/link`.
- The page shell: a test that it renders while approval, send and runners are still pending.
- `Server-Timing`: a test that both routes set the header with the named reads.
- `scripts/perf-prd.ts`: a test of its median/p95 maths and that it refuses to run without
  `OMNI_PERF_COOKIE`, never printing it.

## Risks

Merging publishes a migration (a new argument on `dossier_list`, a new function) and changed reads on
two pages every member uses. Rollback: revert the feature PR; the migration only adds an argument
with a default and a function, so old code keeps working against it.

A read moved into `Suspense` could show its part later than the rest; each has a skeleton.

The locked laws it touches (`omni kb laws`), none of which the design changes — every read stays
`security invoker` under the caller's own sign-in:

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left could still read the team's work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal could act on words a person no longer stands behind. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid AI key. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- `scripts/perf-prd.ts` prints median and p95 for `/prd` and `/prd/<id>`; the before table is in the
  feature PR, measured before any other slice merged.
- The after median server time of `/prd` and of `/prd/<id>` is at least 50% lower than the before
  median, measured the same way.
- Both routes send `Server-Timing` naming each read.
- Rows, filters, Clear and the PRD's tabs are `next/link`, and a click shows the PRD's skeleton
  without a full document load.
- The list shows exactly the rows it showed before, for the same viewer and filters.
- A PRD's page shows the same repository chips, approval, send and fixing parts as before.
- `dossier_list` returns only the asked kind with `p_kind`, and every kind without it.
- No read on either page returns anything of a workspace the viewer is not in.

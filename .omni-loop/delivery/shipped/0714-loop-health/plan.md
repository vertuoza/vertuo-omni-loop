# Plan — PRD 714: Engineering board, only merges into main, and the loop's health

PRD #714, specified in `spec.md` beside this plan. Delivered on the feature branch `feat/loop-health`
into `main` by one pull request whose body starts with `Closes #714`; each slice is a sub-PR from
`feat/loop-health--<slice>` into `feat/loop-health`, whose body starts with `Part of #714`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Only pull requests into main, master or develop count across the Engineering board, a promotion counts nowhere, and the Omni Loop panel shows the sub-PRs merged into feature branches | `supabase/migrations/20261015090000_loop_health.sql` `supabase/checks/repositories.sql` `apps/omni-app/src/pr-stats/` `apps/galaxy/src/engineering/` | — | 1 |
| s2 | Loop health lists the loop's stuck pull requests and stale claims right now, each linked to its pull request | `apps/omni-app/src/pr-stats/` `apps/galaxy/src/engineering/` `kit/lib/board.mjs` `kit/lib/board.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | Loop health lists the held runs right now, read from the loop's status comment | `apps/omni-app/src/pr-stats/` `apps/galaxy/src/engineering/` `kit/lib/markers.mjs` `kit/lib/markers.test.mjs` `kit/dist/omni.mjs` | s2 | 3 |
| s4 | Loop health shows how many merged sub-PRs got `omni:needs-fix` first in the period | `apps/omni-app/src/pr-stats/` `apps/galaxy/src/engineering/` | s3 | 4 |

**Shared ground.** Every slice changes the collector (`apps/omni-app/src/pr-stats/`: its GraphQL
read, its row and its tests) and the board (`apps/galaxy/src/engineering/`: the tally, the loader,
the board, the demo and their tests `tally.test.ts`, `load.test.ts`, `render.test.ts`,
`repo-page.test.ts`), so the four slices run one per wave, in order. `kit/dist/omni.mjs` is declared
by s2 and s3, which change `kit/lib/` and rebuild the bundle (`pnpm kit:build`); waves 2 and 3 keep
them apart. The migration is s1's alone: it adds all six columns the later slices fill, so the PRD
ships one migration. `apps/galaxy/src/profile/` imports the `PullRequestRow` type from the tally and
builds its rows; no slice owns it, so the columns the board adds to that type are optional, and the
profile compiles and renders unchanged.

## Per slice: done when

**s1: only merges into main count**

- `supabase/migrations/20261015090000_loop_health.sql` adds `head`, `draft`, `labels`,
  `head_committed_at`, `needs_fix_at` and `status_state` to `public.pull_requests`, each nullable or
  defaulted, with a comment each, and sets `collected_until` to null on every repository; its
  timestamp sorts after every migration on `main`.
- `supabase/checks/repositories.sql` checks that a member reads the six new columns, a stranger
  reads none, nobody signed in writes them, and every repository's `collected_until` is null after
  the migration.
- The collector reads `headRefName` and writes it as `head`; its tests show the column mapped.
- The tally counts a pull request only when its base is `main`, `master` or `develop` and its head is
  none of them: PRs opened, PRs merged, open now, median time to merge, commits, lines, the
  per-repository table, the merged-per-day chart, Most opened, Most merged and the Omni Loop share,
  medians and lines all follow it; reviews do not. A row with no stored head counts as not a
  promotion. Tests cover each base in and out, `develop → main`, `main → develop`, and every part of
  the board.
- The Omni Loop panel shows "+ N sub-PRs merged into feature branches", N being the signed pull
  requests merged into any other base in the period, 0 included; tested in `tally.test.ts` and
  `render.test.ts`.
- A repository's page follows the same rule (`repo-page.test.ts`), and the demo board shows the
  sub-PR line.
- The person profile's tests pass unchanged.

**s2: stuck and stale claim, right now**

- `kit/lib/board.mjs` exports its stale-claim rule unchanged, and `kit/lib/board.test.mjs` tests the
  export; `kit/dist/omni.mjs` is a fresh build.
- The collector reads each pull request's draft state, its labels and its latest commit's committed
  date, and writes `draft`, `labels` and `head_committed_at`; tested on the stubbed GitHub.
- The board's Loop health panel sits beside Omni Loop, on the board and on a repository's page, and
  lists, over tracked repositories: **Stuck** for an open pull request labelled `omni:needs-fix`;
  **Stale claim** for an open draft signed sub-PR the kit's rule calls stale, with the kit's 60
  minutes. Each row shows its kind, `owner/repo#n` linking to the pull request on GitHub, and how
  long ago it was opened.
- A pull request shows once, under the first kind it meets. At most 10 rows show, oldest first, then
  "and N more". With none: "Nothing stuck right now".
- Tests with a fixed clock: a stale claim at 61 minutes is listed; at 59 minutes, with a commit
  beyond its claim, closed or merged it is not; a needs-fix pull request that is also a stale claim
  shows once, as stuck; 11 rows show 10 and "and 1 more"; the empty state.
- The demo board shows a stuck row and a stale claim.

**s3: held runs, right now**

- `kit/lib/markers.mjs` gains `status`, `<!-- <prefix>-status -->`, tested in
  `kit/lib/markers.test.mjs`; `kit/dist/omni.mjs` is a fresh build.
- For an open signed pull request into `main`, `master` or `develop`, and only those, the collector
  reads its comments in a second query, finds the comment carrying the kit's default status marker,
  and writes its `state:` line as `status_state`; null with no such comment. Tested on the stubbed
  GitHub: the query is not sent for a batch with no such pull request, and a merged, closed or
  unsigned pull request gets no status read.
- Loop health lists **Held** for an open signed pull request into a main branch whose
  `status_state` is `stuck`, after Stuck and before Stale claim in the one-row-per-pull-request
  order; a held pull request also labelled `omni:needs-fix` shows once, as stuck. Tested.
- The demo board shows a held row.

**s4: the period rate**

- The collector reads each pull request's label events and writes, as `needs_fix_at`, when
  `omni:needs-fix` was first added; null without one. Tested on the stubbed GitHub, with the label
  added twice and never.
- Loop health reads "K of M merged sub-PRs got `omni:needs-fix` first (P%)": M the signed pull
  requests merged into other bases in the period, K those whose `needs_fix_at` is at or before their
  merge. With M at 0: "No sub-PR merged in this period". Tests: needs-fix before merging counts,
  after merging or never does not; the percent rounds to a whole number.
- The demo board shows the rate line, and a repository's page counts it over that repository alone.
- Running the collector twice in a row changes no count (`collect.test.mjs`).

# Plan: Tracked repositories and the Engineering board

PRD #612, spec in `spec.md` beside this plan. Built on the feature branch `feat/engineering-board`
into `main` (`Closes #612`), through sub-PRs from `feat/engineering-board--<slice>` into the
feature branch (`Part of #612`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An owner manages the workspace's repositories on Settings → Repositories: the `repositories`, `pull_requests` and `pull_request_reviews` tables with their owner-only RPCs and member reads, the Vertuoza-only seed of six tracked repositories, the page (list, Tracked switch, collection state, Add repository from the App's repositories, no-access and no-installation states, read only for members) and its sidebar entry under Settings | `supabase/migrations/20261008090000_` `supabase/checks/repositories.sql` `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` `apps/galaxy/src/signup/github-app` `apps/galaxy/src/nav/sidebar` | — | 1 |
| s2 | The `prStats` Inngest function in omni-app collects every tracked repository of every installed workspace every 15 minutes: a 90-day backfill on the first run, then incremental from the cursor; pull requests, reviews (no self-review, one per reviewer) and the Omni-man signature upserted; a failure recorded on that repository only | `apps/omni-app/src/pr-stats/` `apps/omni-app/api/inngest.mjs` `apps/omni-app/package.json` `apps/omni-app/README.md` `pnpm-lock.yaml` | s1 | 2 |
| s3 | Dashboard → Engineering at `/app/engineering` shows, over tracked repositories and the 7d / 30d / season period: the six tiles, the per-repository table, the three top-5 people lists without bots or Omni-man, the Omni Loop panel, the merged-per-day chart and the empty state; its sidebar entry under Dashboard | `apps/galaxy/src/engineering/` `apps/galaxy/app/app/engineering/` `apps/galaxy/src/nav/sidebar` `apps/galaxy/README.md` `supabase/migrations/20261008100000_` | s1 | 2 |

**Shared ground.** `apps/galaxy/src/nav/sidebar` is declared by s1 (the Repositories entry) and s3
(the Engineering entry). They sit in different waves, because s3 is blocked by s1, whose tables it
reads. s2 and s3 share nothing and run side by side in wave 2: the board is tested on fixture rows
and does not need the collector. The migrations are separated by timestamp prefix: s1 owns `20261008090000_`, and s3
owns `20261008100000_` for any read function the board needs. s2 adds no migration. Before merge,
both timestamps must still sort after every migration on `main` (PRD 587's branch also adds some).

## Per slice: done when

**s1**
- The migration creates `repositories`, `pull_requests` and `pull_request_reviews` exactly as the
  spec's "Stored shapes" says. `add_repository` and `set_repository_tracked` are security definer,
  owner-only (`42501` for anyone else), and granted to authenticated only.
- The seed adds the six `vertuoza/…` repositories as tracked to the workspace with slug
  `vertuoza`, and does nothing when there is none.
- `supabase/checks/repositories.sql` passes in the supabase workflow. It proves the owner-only
  refusal, member reads, that a stranger reads nothing, that no direct writes are possible for anon
  or authenticated, and that the seed reaches `vertuoza` only.
- `/app/settings/repositories` renders these states in page tests: owner (Add button, switches),
  member (read only), empty, no installation (install link), and a repository with "Omni App has no
  access".
- Add repository lists only what the App's installation can see minus what is listed, through the
  galaxy App client, stubbed in tests. One click adds a repository, tracked.
- The sidebar shows Settings → Repositories after Fleets. The sidebar test is updated.

**s2**
- In tests against a stubbed GitHub and a fake store:
  - a first run reads 90 days and sets the cursor, and a second run reads only what was updated
    after it;
  - two runs in a row write identical rows;
  - an untracked repository is never read;
  - a 404 or a rate limit on one repository sets its `collect_error`, and the others are collected;
  - `omni_signed` is true for a commit trailer with the Omni-man e-mail, for the
    `<!-- omni-loop:signed -->` marker and for an `omni-loop-invader[bot]` author, and false
    otherwise;
  - a review by the pull request's author makes no row, and several reviews by one person make one
    row dated at the first.
- `api/inngest.mjs` serves `prStats` on a `*/15 * * * *` cron. With `SUPABASE_URL` or
  `SUPABASE_SERVICE_ROLE_KEY` unset, it logs one line and writes nothing.
- `apps/omni-app/README.md` names the two new variables and the Inngest Resync after deploy.

**s3**
- These are pure tests of the board's math: the median time to merge (odd, even, none); opened,
  merged and open-now counts by the spec's counting rules; the top-5 lists with ties, bots removed
  and Omni-man removed; the Omni Loop share and the two medians; the period bounds for 7d, 30d and
  season.
- An untracked repository's rows count nowhere on the board.
- Page tests render `/app/engineering` with data and empty ("No tracked repositories yet →
  Settings → Repositories"). Any member can see it.
- The sidebar shows Dashboard → Engineering after Workspace. The sidebar test is updated.
- `apps/galaxy/README.md`'s dashboard section describes the Engineering board and Settings →
  Repositories.

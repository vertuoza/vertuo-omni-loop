# Plan: Dashboards — you, your fleet and the workspace

PRD #572, spec in `spec.md` beside this plan. Built on the feature branch `feat/dashboards` into
`main` (`Closes #572`), through sub-PRs from `feat/dashboards--<slice>` into the feature branch
(`Part of #572`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `contributions.kind` accepts `prd-started` and `prd-shipped`, and `game:contributions` writes them for phase-0 PRs (`omni:phase-0`, `Refs #n`) and feature PRs (`omni:feature`, `Closes #n`) merged in the window, credited to the PRD issue's author, skipping and logging a PRD whose issue cannot be read | `game/cli/contributions` `supabase/migrations/20261007090000_contribution_stages.sql` `supabase/checks/contributions.sql` `game/README.md` | — | 1 |
| s2 | `/app/workspace` shows the board for the whole workspace: the period switch (7 days by default, 30 days, season), the four tiles, PRs merged and PRD events per day, the People table of every member with 0s kept (the Paul case), the repositories involved and the season's fleet ranking, read through the new `workspace_roster` and `answered_counts` functions, each part failing alone, with a demo roster | `apps/galaxy/src/dashboard/board/` `apps/galaxy/app/app/workspace/` `supabase/migrations/20261007100000_dashboard_reads.sql` `supabase/checks/dashboards.sql` | — | 1 |
| s3 | `/app/fleet` shows the board for one fleet: yours by default, a picker to any fleet keeping the period, the fleet's season place, *Pick a fleet to see its board* with no fleet of your own, and *This workspace has no fleet yet* linking to Settings › Fleets | `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/app/app/fleet/` | s2 | 2 |
| s4 | `/app` (Home) keeps the hero block and the Waiting for you count, then the board with scope *you*, whose People table is your team (your fleet's members, 0s kept, you marked; solo or no hero: your row and a link to Fleet); the rankings, the Outbox settled tile and the old week and counts leave Home | `apps/galaxy/src/dashboard/home/` `apps/galaxy/src/dashboard/Dashboard` `apps/galaxy/src/dashboard/load` `apps/galaxy/src/dashboard/demo` `apps/galaxy/src/dashboard/you` `apps/galaxy/src/dashboard/YouBlock` `apps/galaxy/src/dashboard/page.test.ts` `apps/galaxy/src/dashboard/render.test.ts` `apps/galaxy/src/dashboard/dashboard.css` `apps/galaxy/src/dashboard/counts/` `apps/galaxy/src/dashboard/week/` `apps/galaxy/app/app/page.tsx` | s2 | 2 |
| s5 | The sidebar reads Dashboard (Home, Fleet, Workspace), Work (PRDs, Questions with Shared with me and History, Knowledge), Settings (Fleets), Omni (Docs ↗, Release notes ↗); Fleets lives at `/app/settings/fleets` and `/app/fleets` redirects there, the query kept; `apps/galaxy/README.md` › *Your dashboard* describes the three boards | `apps/galaxy/src/nav/` `apps/galaxy/app/app/settings/` `apps/galaxy/app/app/fleets/` `apps/galaxy/src/fleets/` `apps/galaxy/README.md` | s2, s3, s4 | 3 |

**Shared ground.**
- No prefix is declared by two slices. s1 and s2 share wave 1 and nothing else: s1 is the poller,
  its migration and its check; s2 is the board, its page, and a migration and a check of their own
  (distinct timestamps, distinct check files).
- `apps/galaxy/src/dashboard/rankings/` is owned by no slice: s2 (Workspace) and s3 (Fleet) import
  `rankFleets` from it unchanged, and s4 stops rendering the rankings on Home without deleting the
  folder, so the import stays valid.
- s3 and s4 share wave 2 and meet at nothing: s3 adds `fleet/` folders; s4 owns Home's files by
  name (`Dashboard*`, `load*`, `demo*`, `you*`, `YouBlock*`, the page tests, `dashboard.css`, `counts/`, `week/`,
  `app/app/page.tsx`). `apps/galaxy/app/app/fleet/` does not cover `apps/galaxy/app/app/fleets/`
  (trailing slash), which s5 owns.
- s3 and s4 both use s2's board (`src/dashboard/board/`) without changing it, hence their blocker.
- s5 comes last because its Fleet and Workspace items open pages s2 and s3 add, and its README
  describes Home as s4 leaves it. It alone touches the sidebar, so the badges and the top bar's
  title stay in one hand.

## Per slice: done when

**s1**
- A migration widens `contributions.kind`'s check to `pr-merged`, `prd-opened`, `prd-started`,
  `prd-shipped`; `supabase/checks/contributions.sql` inserts one row of each new kind.
- `game/cli/contributions.test.mjs`, on recorded `gh` outputs: a merged PR labelled `omni:phase-0`
  with `Refs #12` in its body gives a `prd-started` row for number 12, `at` its merged time; one
  labelled `omni:feature` with `Closes #12` gives `prd-shipped`; both carry the login of issue 12's
  author, from the listed `omni:prd` issues or, when it is older than the window, from
  `gh issue view 12 --json author`, read once.
- A labelled PR with no link gives no row; an unreadable PRD issue is skipped and logged, and the
  run still exits 0; `pr-merged` and `prd-opened` rows are unchanged.
- `game/README.md` › Contributions names the two kinds.

**s2**
- `workspace_roster(workspace)` returns every member with name, lower-case GitHub login, avatar and
  fleet, no email, and nothing to a non-member; `answered_counts(workspace, from, to)` returns counts
  per member for that workspace's sessions only, nothing to a non-member:
  `supabase/checks/dashboards.sql` proves both.
- Pure functions tested in `src/dashboard/board/`: period bounds (7d, 30d, season; unknown → 7d),
  the scope filter (logins ignoring case; a non-member's merges in the totals, no row), per-day
  bucketing in Brussels days for both charts, PRD stage counts, repositories involved, People rows
  (0s kept, sorted by PRs then points then name, the viewer marked, dashes with no login).
- A loader test on fakes: a member with no player row and no points, with 7 merges and 9 answers,
  is a People row with 7, 9 and 0 points; each read failing leaves only its parts unreadable.
- `/app/workspace` renders the period links (keeping the query), the four tiles, both charts with
  their screen-reader lists, the People table, the repositories and the fleet ranking; the demo
  shows every part with members at 0.

**s3**
- `/app/fleet` shows the viewer's fleet by default and `?fleet=<name>` any fleet, the picker's
  links keeping `period`; the fleet's season place beside its name.
- Render tests for: a viewer in a fleet, a solo viewer (the picker and *Pick a fleet to see its
  board*), a workspace with no fleet (*This workspace has no fleet yet*, linking to
  `/app/settings/fleets`), an unknown `?fleet` (the picker line), the demo.

**s4**
- `/app` renders the hero block, the Waiting for you count, the period switch, the board with
  scope *you*, and **Your team**: every member of the viewer's fleet, 0s included, the viewer
  marked; solo or with no player row, the viewer's row and a link to `/app/fleet`.
- The individuals and fleets rankings and the Outbox settled tile are no longer on Home; the
  sign-in, closed, no-workspace and demo situations render as before.
- Home's tests (`page.test.ts`, `render.test.ts`, the loader's) cover the team table, the solo
  case and a failing read.

**s5**
- `src/nav/` tests: the sidebar's four groups and items in order, the current item marked for
  `/app`, `/app/fleet`, `/app/workspace` and `/app/settings/fleets`, the top bar's title for each,
  the PRDs and Questions badges unchanged.
- `/app/settings/fleets` serves today's fleets page; `/app/fleets?x=1` redirects permanently to
  `/app/settings/fleets?x=1`; every link to `/app/fleets` in `src/` points to the new path.
- `apps/galaxy/README.md` › *Your dashboard* describes Home, Fleet and Workspace, the period, the
  People table and where each number is read from.
- A manual browser pass of the three pages on Omni, Light and Dark and at 393 px.

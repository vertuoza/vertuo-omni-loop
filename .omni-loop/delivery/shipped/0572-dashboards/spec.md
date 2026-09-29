---
prd: 572
title: Dashboards — you, your fleet and the workspace
blocked-by: none
spec: file
---

# Dashboards: you, your fleet and the workspace

**Date:** 2026-09-29 · **PRD:** #572 · **Touches:** the galaxy app's sidebar (`src/nav/sidebar.ts`),
`/app` and two new pages beside it (`src/dashboard/`), `/app/fleets` moved under Settings, one
migration (two read functions and a wider `contributions.kind`), and `game/cli/contributions.mjs`.
No change to the ledger, the economy, points, Game mode, `/prd`, `/ask` or `/knowledge`.

## Problem

A member who works does not show up. Paul (GitHub `paetienne`) signed in, merged seven pull requests
into `vertuo-ai-domain`'s `main` in the last week and answered questions, and the dashboard shows
nothing of him to anyone:

- `/app` is about the person looking only: their hero, *their* week of merges, *their* counts.
- The only place other people appear is the individuals ranking, which lists heroes of the game's
  ledger **with points this season**: the top 3 and the people around you. Points come only from
  Omni Loop PRD delivery (planets, zones, wounds), so ordinary merged pull requests and answered
  questions give none, and a member with 0 points, or with no player row, is never listed.
- His merges *are* recorded (`contributions`, kind `pr-merged`, `vertuo-ai-domain` is a sector), but
  nothing reads them for anyone but their author.

There is also no view of a fleet or of the workspace as a whole, no count of PRDs moving through
the loop per day, and no count of the repositories the work touches. The sidebar has one group,
**Work**, that mixes the dashboard with the work pages and the fleets' settings.

## Solution

**1. The sidebar gets three groups, then Omni.**

| Group | Items |
|---|---|
| **Dashboard** | **Home** `/app` · **Fleet** `/app/fleet` · **Workspace** `/app/workspace` |
| **Work** | **PRDs** `/prd` · **Questions** `/ask` (Shared with me, History) · **Knowledge** `/knowledge` |
| **Settings** | **Fleets** `/app/settings/fleets` |
| **Omni** | Docs ↗ · Release notes ↗ (unchanged) |

`/app/fleets` answers with a permanent redirect to `/app/settings/fleets`, the query kept. The badges
of waiting items stay on PRDs and Questions. The top bar's title follows the item, as today.

**2. One board, three scopes.** A board is drawn from a scope and a period, and every dashboard page
shows one:

- **Period switch** at the top: **7 days** (the default), **30 days**, **Season** (the UTC month,
  as today). It is a link each, kept in the URL as `?period=7d|30d|season`; an unknown value reads as
  7 days.
- **Tiles**, one row: **PRs merged**; **PRDs**, three numbers in one tile, *drafted · in progress ·
  shipped*; **Repositories**, the number of repositories with at least one merged PR or PRD event in
  the scope and the period; **Questions answered**. A 0 shows as 0, and no tile is ever hidden.
- **Two per-day charts** over the period, Brussels days, today last, inline SVG drawn on the server
  like today's week chart: **PRs merged per day**, and **PRD events per day**, stacked by stage
  (drafted, in progress, shipped), with a legend. A screen reader reads a list of the days and their
  counts in their place. With the Season period, the charts cover the season's days up to today.
- **People**: a table of every workspace member in the scope, 0s included. Columns: name (the
  player's display name, else the account's name, else the GitHub login), fleet (its label in its
  colour, or SOLO), season points, PRs merged, PRDs (drafted, in progress, shipped, credited to the
  PRD's author), questions answered. Sorted by PRs merged, then points, then name. The viewer's row is
  marked. A member with no GitHub login shows a dash in the GitHub-counted columns.
- **Repositories involved**: each repository with its PRs merged and PRD events in the period, most
  active first.

**3. The three pages.**

- **Home** `/app`: the hero block as today (hero, name, fleet, season points and places) and the
  **Waiting for you** tile, then the board with scope *you* (your tiles and charts), whose People
  table is **your team**: your fleet's members, you marked. A solo player (no fleet) or a member with
  no player row sees their own row, and a line linking to **Fleet**.
- **Fleet** `/app/fleet`: the board with scope *a fleet*, your fleet by default. A picker lists every
  fleet of the workspace (links, `?fleet=<name>`, the period kept). The fleet's place in the season's
  fleet ranking shows beside its name. With no fleet of your own and no `?fleet`, the page shows the
  picker and the line *Pick a fleet to see its board*. A workspace with no fleet says *This workspace
  has no fleet yet*, linking to Settings › Fleets.
- **Workspace** `/app/workspace`: the board with scope *the workspace*, every member, then the
  season's fleet ranking (the table that leaves Home). Merges by a GitHub author who is not a member
  count in the tiles, charts and repositories, and get no row.

**4. Who is a member: `workspace_roster(workspace)`.** A new `security definer` SQL function, built
like `ask_members`, returns every row of `workspace_members` for that workspace with: `user_id`, the
name (the player's `display_name`, else the account's full name, else null), the GitHub login in
lower case (the player's `github_login`, else the account's linked GitHub identity), the avatar URL,
and the fleet (`players.team`, null with none). It returns rows only when the caller is a member
(`is_member`). It returns no email. This is what lists Paul.

**5. PRD stages in `contributions`.** `contributions.kind` accepts two more values:

| kind | when | `number` | `login` | `at` |
|---|---|---|---|---|
| `prd-opened` (today) | the `omni:prd` issue is created — **drafted** | the issue | its author | created_at |
| `prd-started` (new) | the PRD's phase-0 PR merges — **in progress** | the PRD issue | the PRD issue's author | the PR's merged_at |
| `prd-shipped` (new) | the PRD's feature PR merges — **shipped** | the PRD issue | the PRD issue's author | the PR's merged_at |

`game:contributions` reads them from the pull requests it already lists (merged into the default
branch, in the 40-day window), asking gh also for `labels` and `body`: a merged PR labelled
`omni:phase-0` whose body holds `Refs #<n>` gives `prd-started` for PRD `<n>`; one labelled
`omni:feature` whose body holds `Closes #<n>` gives `prd-shipped`. The PRD issue's author is read
from the `omni:prd` issues already listed, else from `gh issue view <n> --json author`, once per
PRD; a PRD whose issue cannot be read is skipped and logged, as a repository is today. The row's
`repo` is the repository the PR merged in. Upserts stay on `(workspace_id, kind, repo, number)`.

**6. Questions answered: `answered_counts(workspace, from, to)`.** A new `security definer` SQL
function returns, per `answered_by`, the number of `ask_rounds` answered in `[from, to)` in sessions
of that workspace, for a caller who is a member (`is_member`), and nothing else: no question, no
answer, no session. Every scope reads it, Home's *you* included, so the tile counts this workspace's
questions only.

**7. Reads.** The board's loader runs, as the signed-in person and in parallel: the roster, the
galaxy (season points, as today, read once), the `contributions` rows of the workspace over the
period's days, and the answered counts. It filters them to the scope in pure functions: *you* = your
login; *a fleet* = the logins of the roster members in that fleet; *the workspace* = every row. Each
part keeps today's rule: a read that fails leaves its parts saying *Couldn't load this. Reload in a
moment.*, its error logged, and the rest renders.

**8. The demo** (`OMNI_LOOP_DEMO=1`, and development) gets a demo roster over the demo galaxy's
heroes, two of them members with no points and one with no fleet, and made-up, fixed contributions
and answered counts, so every part of every page shows.

## Decisions

- **Activity beside points, the game untouched.** The dashboards show the game's season points as
  they are and add activity counts beside them. No rulebook, economy or ledger change: the ledger is
  permanent history, and scoring plain merges is a separate question.
- **Every workspace member counts as a person**, with or without a hero or points.
- **PRDs per day are events**, not a daily snapshot: drafted = issue opened, in progress = phase-0
  merged, shipped = feature PR merged.
- **Stages come from `contributions`**, filled by the poller within its 40-day window, not from the
  ledger (the game layer stays removable) and not from GitHub at each page load.
- **PRD events are credited to the PRD issue's author**, whoever built it.
- **Repositories involved** are those with activity in the scope and the period, not the sectors.
- **Fleet shows your fleet, switchable** to any fleet.
- **Settings holds Fleets only** for now.
- **Home drops the individuals and fleets rankings and the Outbox settled tile.** The fleets ranking
  moves to Workspace (Fleet shows its own place); the individuals ranking is replaced by the People
  tables, which list everyone; Outbox settled reads 0 today (the projector does not read the kit's
  delivery folders) and its points already count in the season points.
- **Questions answered counts one workspace**, the one shown, where today's tile counted every
  workspace the person belongs to.

## User stories

- As a member, on Home, I see my numbers and my fleet's members, each with their PRs, PRDs, questions
  and points, so I know where my team stands, even those at 0.
- As a member, on Fleet, I see any fleet's board and switch between fleets.
- As a workspace owner, on Workspace, I see every member, how many PRDs moved through the loop per
  day, and which repositories the work touched.
- As Paul, who merges PRs and answers questions but earns no points yet, I appear on my team's and
  my workspace's boards with those numbers.

## Scope

In: the sidebar groups and the `/app/fleets` move; the board and its parts; Home, Fleet and
Workspace; the migration (`workspace_roster`, `answered_counts`, the wider `kind` check); the two new
contribution kinds in `game:contributions`; the demo; `apps/galaxy/README.md` › *Your dashboard*.

Out: the game's rulebook, economy, ledger and points; teaching the projector the kit's delivery
folders; a Settings page other than Fleets; the Bugs/Visual menu entries (fast lane 3), which go under
Work later; counting repositories that are not sectors; history older than the 40-day window.

## Test seams

Following `omni kb show testing`: tests beside the code, `*.test.ts` under `apps/galaxy/src/`,
`*.test.mjs` under `game/`; no test calls GitHub or Supabase.

- **Pure functions** (`src/dashboard/board/`): period bounds (7d, 30d, season; unknown → 7d); the
  scope filter (you, a fleet, the workspace; logins ignoring case; a non-member's merges in the
  workspace totals only); per-day bucketing in Brussels days for both charts; the PRD stage counts;
  repositories involved; the People rows (0s kept, sort order, viewer marked, no-login dashes).
- **Loaders on fakes**: the Paul case (a member with no player row and no points, with merges and
  answers, is listed with his numbers); each read failing alone.
- **Render tests**: the sidebar's four groups and items in order, the current item marked, the
  redirect path; each page's parts; the fleet picker; the no-fleet and no-fleet-in-workspace lines;
  the period links keeping the query.
- **`game/cli/contributions.test.mjs`**: recorded `gh` outputs giving `prd-started` and
  `prd-shipped`, the PRD author from the listed issues and from `gh issue view`, a PR with the label
  but no link skipped, an unreadable PRD issue skipped and logged.
- **Migration**: a check in `supabase/checks/` (beside `contributions.sql` and `ask.sql`) that
  `workspace_roster` returns members only to a member and no email, and that `answered_counts`
  returns counts only, for one workspace.
- **Manual**: a browser pass of the three pages on the Omni, Light and Dark themes and at 393 px.

## Risks

- **What merging publishes** (`omni kb show releasing`): the migration reaches production Supabase
  through the `supabase` workflow; the galaxy app deploys with its Vercel project. Two functions are
  added and a check widened: nothing is dropped or rewritten.
- **Privacy**: the roster exposes each member's name, GitHub login, avatar and fleet to the other
  members of the same workspace, and question counts per member. No email, no question text.
- **Empty stages at first**: `prd-started` and `prd-shipped` rows appear at the next 15-minute poll,
  for the last 40 days only.
- **Points still read 0 for most people** until the projector reads the kit's delivery folders
  (a known limit, `apps/galaxy/README.md`): the dashboards now show activity beside them.
- **Rollback**: revert the app's pull request; the migration only adds, so it can stay. Reverting
  `game/cli/contributions.mjs` stops new stage rows; the ones written are harmless and can be deleted
  by kind.

## Acceptance criteria

- The sidebar reads **Dashboard** (Home, Fleet, Workspace), **Work** (PRDs, Questions with Shared with
  me and History, Knowledge), **Settings** (Fleets), **Omni** (Docs ↗, Release notes ↗), in that
  order, and `/app/fleets` redirects to `/app/settings/fleets`.
- Home, Fleet and Workspace each show the period switch (7 days by default), the four tiles, both
  per-day charts, the People table and the repositories involved, for their scope.
- A workspace member with no player row and no points, who merged PRs in a sector repository and
  answered questions in the period, appears in the People table of Workspace and of his fleet's board
  (or as SOLO on Workspace), with those PRs and questions counted and 0 points.
- On Home, the People table lists every member of the viewer's fleet, those at 0 included, the
  viewer marked.
- On Fleet, the viewer's fleet shows by default and the picker switches to any fleet, keeping the
  period.
- The PRDs tile and chart count drafted (issue opened), in progress (phase-0 merged) and shipped
  (feature PR merged) events in the period, from `contributions`.
- The Repositories tile counts the repositories with at least one merged PR or PRD event in the scope
  and the period.
- `game:contributions` writes `prd-started` and `prd-shipped` rows for phase-0 and feature PRs merged
  in the window, credited to the PRD issue's author.
- `workspace_roster` and `answered_counts` return nothing to a non-member, and neither returns an
  email or a question's text.
- One failing read leaves only its parts saying they could not load.
- The demo shows every part of every page, members at 0 included.

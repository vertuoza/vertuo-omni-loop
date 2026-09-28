---
prd: 328
title: Your dashboard, the app's home — hero, fleet, score, rankings and a week of merges
blocked-by: none
spec: file
---

# Your dashboard, the app's home: hero, fleet, score, rankings and a week of merges

**Date:** 2026-09-28 · **PRD:** #328 · **Touches:** `apps/galaxy` (the `/app` page, its sign-in
callback, a new `src/dashboard/` module, the section cards), `game/` (a new `game:contributions`
command), `.github/workflows/game.yml` (one step), `supabase/` (a `contributions` table and its
access check), the galaxy and game READMEs · **Builds on:** #238 (the app and its home, merged) ·
**Leaves to a later PRD:** the game projector reading the kit's delivery folders (see Risks).

## Problem

`/app` is the app's home (PRD 238). Anyone who switches from the arcade, or opens the app, lands on
it. Today it is a heading, one line and a card per section: a menu. It says nothing about the person
reading it.

- **Nothing personal.** The arcade already knows each player's hero, fleet, season points and rank,
  but only the arcade shows them. That takes a Game Boy, a boot, a title and a menu to reach. A
  person in the app sees none of it.
- **No record of what you shipped.** Nobody can see how many pull requests they got into `main`
  this week, or how many PRDs they opened. The game's ledger records a feature PR's merge as a
  planet event with no author and no PR number, and it records no PRD's author at all. Only
  sub-PRs (slices) are credited to a person.
- **Your questions are scattered.** How many of Claude's questions you answered, and how many are
  waiting for you now, are each on their own page (`/ask`, `/ask/for-me`). No page counts them.

## Solution

`/app` becomes **your dashboard**. When you sign in, it shows, top to bottom:

1. **You:** your hero, your name, your fleet, your season points, and your two places (yours among
   individuals, your fleet's among fleets).
2. **A week of merges:** a bar chart of the pull requests you authored that merged into `main`, on
   each of the last 7 days.
3. **Four counts:** questions answered, outbox items settled, PRDs created (each this season), and
   questions waiting for you (now).
4. **The rankings:** every fleet, and the individuals around you.
5. **The app's sections:** the cards `/app` shows today, made compact.

```
┌ OMNI LOOP  App ──────────────────────────── Omni · Light · Dark   Game mode ┐
│  ┌────────┐   PIERRE                                                        │
│  │  hero  │   BEAVER fleet                                                  │
│  │ sprite │   1,240 pts · September season                                  │
│  └────────┘   You #7 of 23 · BEAVER #2 of 5                                 │
│                                                                             │
│  PRs merged into main · last 7 days                              9 total    │
│   3 ┤              ▇                                                        │
│   2 ┤  ▇           ▇                       ▇                                │
│   1 ┤  ▇     ▇     ▇     ▇                 ▇                                │
│       Tue   Wed   Thu   Fri   Sat   Sun   Mon                               │
│                                                                             │
│  ┌ Questions answered ┐┌ Outbox settled ┐┌ PRDs created ┐┌ Waiting ┐        │
│  │ 14  this season    ││ 3  this season ││ 2 this season││ 1     → │        │
│  └────────────────────┘└────────────────┘└──────────────┘└─────────┘        │
│                                                                             │
│  Fleets · September             Individuals · September                     │
│  1  OCTOPOD   2,300             1  INKY     980                             │
│  2  BEAVER    1,900 ◀           2  DIME     870                             │
│  3  PICSOU    1,400             3  OTTO     820                             │
│  4  C.I.A.      700             ⋯                                           │
│  5  PIRATES     150             6  MAX      300                             │
│                                 7  PIERRE   280 ◀                           │
│                                 8  LEA      120                             │
│                                                                             │
│  Questions →  For me →  History →  Knowledge map →  Release notes →         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The page

`/app` keeps its route, its layout and its app bar: the `OMNI LOOP · App` mark, the theme switch
(Omni, Light, Dark), and **Game mode**. The arcade's ways out (the APP MODE row and the GAME ▮▯ APP
switch) still land here. The page stops being static. It renders per request, as the signed-in
person, the way `/prd` does, so row-level security decides what each read returns.

- **The hero block.**
  - The hero is drawn on the server as a pixel SVG (`pixelSvg` over the hero's sprite, tinted by
    `heroLook(hero, fleetColour)`, as `/design` draws sprites). It needs no script and no canvas.
  - Beside it: the display name (the page's one `h1`), the fleet's label in its colour, the season's
    points (*1,240 pts · September season*), and one line with both places. That line reads *You #7
    of 23 · BEAVER #2 of 5*, or *No points yet this season · BEAVER #2 of 5*.
- **The chart.**
  - **Days:** seven bars, the six days before today and today, in Brussels time. Today is last, and
    each bar is labelled with its weekday.
  - **What a bar counts:** the pull requests you authored that merged into their repository's default
    branch that day, in any repository of the workspace's sectors. A sub-PR never counts, because
    it merges into a feature branch.
  - **Total:** the week's sum sits at the top right.
  - **Drawing:** inline SVG, drawn on the server, with no chart library and no client script. The
    y-axis marks whole numbers only, from 0 to the week's highest bar (at least 1).
  - **Text alternative:** the chart carries one, a list of the seven days and their counts, which a
    screen reader reads in place of the bars.
  - **An empty week:** seven empty days and the line *No PRs merged into main in the last 7 days*.
- **The four counts.** Each count is a tile with a label and a number.

  | tile | counts | period |
  |---|---|---|
  | **Questions answered** | the questions Claude asked (ask mode) that you answered, on the Omni page or in the terminal | this season |
  | **Outbox settled** | the outbox items (an agent's decision on a feature PR) that you approved or sent back | this season |
  | **PRDs created** | the PRD issues you opened (label `omni:prd`) | this season |
  | **Waiting for you** | your open sessions whose newest round is open, plus the open questions a teammate shared with you | right now |

  **Waiting for you** links to `/ask`, except when at least one question is waiting and every
  waiting question is one shared with you: then it links to `/ask/for-me`.
- **The rankings.** Two tables, both this season.
  - **Fleets** lists every fleet the season knows, ranked, with its points. Yours is marked.
  - **Individuals:**
    - It always shows the top 3, then you with the person just above and just below.
    - A `⋯` row stands for ranks that are skipped.
    - When you rank 1 to 4, it shows ranks 1 to 5 with no gap.
    - With no points this season, it shows the top 3 and the line *No points yet this season*.
    - Each row shows the rank, the display name and the points. The display name falls back to the
      GitHub login when that person never picked one.
- **The section cards.** The same `SECTIONS` list as today, drawn compact at the bottom. Each is a
  title and an arrow on one row that wraps, with the line and the path left out.

**The season** is the calendar month in UTC, the one the game's economy scores (`buildGalaxy` scores
`now.toISOString().slice(0, 7)`). The points, both rankings and the three season counts use the same
bounds, so they reset together. The chart alone counts Brussels days, because a person reads "today"
in their own time.

### States

`/app` decides once, top to bottom:

| situation | what `/app` shows |
|---|---|
| **Demo** (development, or `OMNI_LOOP_DEMO=1`) | The whole dashboard on the demo world. The hero is the demo guest's default hero, and *you* is one of the demo galaxy's heroes. The merges and the counts are made up and fixed in `src/dashboard/demo.ts`. |
| **Closed** (this deployment has no database) | The notice *The dashboard is not open here*, then the section cards. |
| **Signed out** | Only a sign-in card: *Sign in to see your dashboard*, and **Sign in with Google** (`@vertuoza.com`). Google sends the person to `/app/callback`, which turns the code into the session cookie, joins the workspaces of the email's domain, and returns to `/app`, or to `/app?signin_error=…` with the reason. |
| **Signed in, in no workspace** | The notice *Your account is not in a workspace*, with **Switch account**, as `/knowledge` does. |
| **A member who never joined a fleet** (no `players` row) | In place of the hero block (and so of your points and place), a card: *Join a fleet in the arcade to get your hero and your score*, linking to `/play`. The rankings, the chart and the four tiles still show. The chart, **Outbox settled** and **PRDs created** count by the account's linked GitHub identity when it has one, and otherwise read as in the next row. |
| **A player with no GitHub linked** | The hero, the fleet and the rankings show. Your points and place, the chart, **Outbox settled** and **PRDs created** each read *Link your GitHub in the arcade*. **Questions answered** and **Waiting for you** still count, because they need no GitHub. |
| **One read fails** | Only its part reads *Couldn't load this. Reload in a moment.* Everything else renders. The error is logged on the server. |

A 0 is shown as 0. The page never guesses a number, and never hides a tile for being empty.

### The data

| on the page | where it is read |
|---|---|
| hero, name, fleet | your `players` row (`hero`, `display_name`, `team`), and `teams` for the fleet's label and colour |
| season points, your place, the fleets table, the individuals table | `loadGalaxy` (the ledger folded by `buildGalaxy`, as `/play` does): its `heroes` and `teams` |
| names in the individuals table | the workspace's `players`, by GitHub login (`loadCrew`) |
| the chart | `contributions`, kind `pr-merged`, your login, the last 7 Brussels days |
| PRDs created | `contributions`, kind `prd-opened`, your login, this season |
| Outbox settled | `ledger_events` of type `WOUND_CLOSED` whose id starts with `outbox:` and whose `contributor` is your login, this season |
| Questions answered | `ask_rounds` whose `answered_by` is you, with `answered_at` this season |
| Waiting for you | `readTabs` (your open sessions, each with its newest round) counting those whose newest round is open, plus `readForMe` (open rounds shared with you) |

**Your GitHub login** is `players.github_login`, else the account's linked GitHub identity. Every
comparison with a login (the ledger's `contributor`, `heroes`, `contributions.login`) ignores case.
A bot's login never matches a person, so bots never appear on anyone's chart or counts. They can
still appear in the individuals table, because the ledger credits whoever it credits.

#### `public.contributions`, a new table

One migration adds it:

```sql
create table public.contributions (
  workspace_id uuid        not null references public.workspaces (id) on delete cascade,
  kind         text        not null check (kind in ('pr-merged', 'prd-opened')),
  repo         text        not null,   -- the repository, as the workspace's sectors name it
  number       int         not null,   -- the pull request's or the issue's number
  login        text        not null,   -- its author's GitHub login, in lower case
  at           timestamptz not null,   -- merged_at for a pull request, created_at for an issue
  seen_at      timestamptz not null default now(),
  primary key (workspace_id, kind, repo, number)
);
```

- **Who may read.** A member reads their workspace's rows (`public.is_member(workspace_id)`), as
  every game table allows. Nothing is granted to `anon`.
- **Who may write.** Only the service role, through `game:contributions`.
- **It is not the ledger.** A row can be rewritten, backfilled or deleted, and the table can be
  dropped, all without touching the ledger's permanent history. The ledger and the economy never
  read it.

#### `pnpm game:contributions --workspace <slug>`, a new command

`game/cli/contributions.mjs`, run by the game workflow's ledger job right after `game:xp`, every 15
minutes, only while `GAME_ENABLED` is on:

- **Which repositories:** every repository of the workspace's sectors, under the workspace's
  `github_org`.
- **What it reads for each,** through `gh` as `game/dossiers/github.mjs` does:
  - the repository's default branch;
  - its pull requests merged into that branch since the window's start (`number`, `author`,
    `mergedAt`);
  - its `omni:prd` issues created since then (`number`, `author`, `createdAt`), in any state.
- **The window:** the last 40 days. That covers the current season and the chart's week, even
  across a month's first days.
- **What it writes:** one row per pull request or issue, with its author's login in lower case,
  upserted on the primary key. A rerun writes identical rows. A row outside the window is left as it
  is, and an item with no author (a deleted account) is skipped.
- **When a repository fails:** it is skipped and logged, and the others still land. The workflow step
  runs with `continue-on-error: true`, as `game:dossiers` does, so it can never fail the ledger job.

### The code

- **`apps/galaxy/src/dashboard/`**, a new module:
  - **Pure functions:**
    - `seasonBounds(now)`, the UTC month;
    - `chartDays(rows, now)`, seven Brussels days;
    - `rankWindow(heroes, login)`, the individuals' rows and gaps;
    - `waitingCount(tabs, forMe)` and the link it goes to.
  - **`loadDashboard(db, user, now)`:** runs the reads in parallel and returns each part as its
    value or `'unreadable'`, on its own.
  - **The view:** `Dashboard.tsx` with its parts, `dashboard.css` (ask tokens only), and `demo.ts`.
- **`apps/galaxy/app/app/page.tsx`:** decides the state and renders it.
  **`apps/galaxy/app/app/callback/route.ts`:** the sign-in callback.
- **`src/switch/`:**
  - `SECTIONS` stays the list of cards. The compact drawing is `dashboard.css`'s, and PRD 238's
    card styles go when nothing else uses them.
  - `HOME.heading` and `HOME.line` go, unless something else still reads them. `HOME.sub` (`App`)
    stays.

## Decisions

1. **The dashboard is `/app`.** It is not a new route, and `/` (HOME) is untouched. The app's home is
   where both sides already land, so a new route would give the app two homes.
2. **A sign-in wall.** Signed out, `/app` is only the sign-in card. The section cards come with the
   dashboard. `/releases` is still public at its own address.
3. **"A main PR" means a pull request you authored, merged into its repository's default branch.**
   Feature PRs, phase-0 PRs, retro PRs and standalone fixes all count, and sub-PRs never do. Days
   are Brussels days.
4. **A `contributions` table, filled by the game workflow**, rather than new ledger events or a live
   GitHub read from the app.
   - The ledger is permanent history, and its projector is about to be reworked (Risks).
   - The app has no GitHub access, and giving it some would be a new secret, rate limits and latency
     on every visit.
   - The table can be rebuilt from GitHub within its window, and dropped.
5. **The season is the economy's**, the UTC calendar month, for the points, both rankings and the
   three season counts. The dashboard adds no scoring and no XP.
6. **The rankings:** every fleet, then the individuals around you (the top 3, you, and your two
   neighbours).
7. **Each part fails on its own.** A missing GitHub link, a missing player row or a failed read
   empties only the parts that need it.
8. **Drawn on the server.** The hero is an SVG, the chart is an SVG, and the tiles are HTML. The page
   adds no client script beyond the sign-in card's button and the app bar's controls.
9. **The page says nothing about the projector gap.** While the projector cannot see the kit's
   delivery folders, points, places and **Outbox settled** can read 0. The spec records it (Risks),
   and the next PRD fixes it.

## User stories

- As a developer who switched from the arcade, I land on `/app` and see my hero, my fleet, my 1,240
  points and *You #7 of 23*, without opening the Game Boy.
- As a developer on Monday morning, I see last week in bars: three PRs merged on Thursday, none at
  the weekend, nine in all.
- As a PM, I see that I created two PRDs and answered fourteen questions this season, and that one
  question is waiting for me. I tap it and land on `/ask`.
- As a fleet captain, I see BEAVER second of five, 400 points behind OCTOPOD.
- As a new colleague who signed in but never played, I see *Join a fleet in the arcade to get your
  hero and your score*, and the rankings of the people I am about to join.
- As anyone signed out, I open `/app`, sign in with Google, and come straight back to my dashboard.

## Scope

**In:**
- `/app` as the dashboard, in every situation the States table names, the compact section cards,
  and `/app/callback`.
- `src/dashboard/`: the pure functions, `loadDashboard`, the view, its styles, and the demo.
- The `contributions` migration and `supabase/checks/contributions.sql`, run by the `supabase`
  workflow beside the other checks.
- `game/cli/contributions.mjs`, the `game:contributions` script in the root `package.json`, and its
  step in `game.yml` after `game:xp` with `continue-on-error`.
- `/app` in `pnpm galaxy:shots`, in the demo, at the three sizes.
- The galaxy README (the dashboard, its states and its data) and the game README (the new command
  and its table).

**Out:**
- The game projector reading `.omni-loop/delivery/{inbox,shipped}/` and each repository's own PRD
  issues: the next PRD.
- XP and level on the dashboard, and anything the arcade shows that the brief does not name.
- Anyone else's dashboard, a period switch, and history beyond the season and the week.
- `contributions` in `game:export`: the table can be rebuilt from GitHub.
- A cache, a new index beyond the primary key, and any change to HOME (`/`), `/play` or the
  arcade's exits.

## Test seams

These follow the testing playbook: `pnpm test` runs vitest over `game/`, `kit/`, `packages/`,
`apps/omni-app/` and `apps/*/src/`, and tests sit beside their code. No test calls GitHub or a live
Supabase.

- **`apps/galaxy/src/dashboard/*.test.ts`, the pure functions:**
  - `seasonBounds`: the UTC month, and its edges at 00:00 UTC on the 1st.
  - `chartDays`:
    - It returns seven Brussels days with today last.
    - A merge at 22:30 UTC on a Sunday in summer counts on Monday.
    - A day with none is 0.
    - Another person's rows and rows outside the week are not counted.
    - Logins match ignoring case.
  - `rankWindow`:
    - you first;
    - you 4th (ranks 1–5, no gap);
    - you 5th (1–3, then 4–6, no gap);
    - you 12th of 30 (1–3, `⋯`, 11–13);
    - you last (no one below);
    - you unranked.
  - `waitingCount`: tabs with open and answered newest rounds, shares, and the link each mix gives.
- **`src/dashboard/load.test.ts`, the loader**, on the in-memory fake database
  (`src/data/galaxy.fake.ts`, extended with `contributions`, ask sessions and rounds):
  - the full dashboard, and each situation of the States table;
  - one test per failing read, which marks only its own part `'unreadable'`;
  - another workspace's contributions and ledger rows are never counted;
  - a season's first day counts nothing from the month before.
- **`src/dashboard/render.test.ts`, the server render**, rendered to static markup as
  `switch/render.test.ts` does:
  - the name is the one `h1`;
  - the hero SVG is there with its name;
  - the chart's text alternative lists the seven counts;
  - your fleet's row and your row are marked;
  - the four tiles carry their labels and numbers, and **Waiting for you** links where
    `waitingCount` says;
  - the section cards come last;
  - signed out, the page holds the sign-in card and nothing else.

  `switch/render.test.ts` is updated for the new `/app`.
- **`game/cli/contributions.test.mjs`, the command**, on `gh` outputs as fixtures (a fake `exec`, as
  `game/dossiers/fake-github.mjs` does):
  - it reads each repository's default branch, merged pull requests and `omni:prd` issues;
  - it lower-cases logins, skips an item with no author, and upserts on the key;
  - a rerun writes identical rows;
  - one unreadable repository is skipped while the rest still land.

  `game/workflow.test.mjs` asserts the step comes after `game:xp`, with `continue-on-error`.
- **`supabase/checks/contributions.sql`, access**, in the style of `supabase/checks/access.sql`:
  - a member reads their workspace's rows;
  - a member of another workspace reads none, and `anon` reads none;
  - no signed-in user inserts, updates or deletes.
- **Unchanged and still green:** the design-system guard (`src/design-system.test.ts`: the dashboard
  declares no colour on `:root`), the Game mode and theme tests, and the arcade's leave tests.
- **Manual, recorded in the feature PR:** `/app` in the demo at 393, 852 and 1440 px wide, in Omni,
  Light and Dark, with no sideways scroll at 393 px.

## Risks

- **What merging publishes.** Following `omni kb show releasing`:
  - **Supabase:** the `supabase` workflow's deploy job applies the `contributions` migration to the
    production project.
  - **Vercel:** if the galaxy's project deploys `main`, every visitor of `/app` gets the dashboard.
    Signed-out visitors get only the sign-in card, where they got the menu before.
  - **The game workflow:** it gains one step, which runs only while `GAME_ENABLED` is on.
  - **Nothing else:** no ledger event, no kit file and no contract changes.
- **Rollback.** Revert the feature PR's merge commit. `/app` becomes the menu again, and the workflow
  step goes with it. Migrations only go forward, so the table stays, empty of new rows and read by
  nothing. A later migration may drop it.
- **Numbers that read 0 for now.**
  - **Points, places and Outbox settled.** The game's projector reads `docs/inbox/*.md`
    (`game/sources/github.mjs`), while the kit writes `.omni-loop/delivery/{inbox,shipped}/`. It
    also reads PRD issues from the plan repository only. So it most likely records no slice,
    feature PR or outbox settle for today's repositories, and these parts read 0 until the next PRD
    fixes it.
  - **The chart and PRDs created.** These read 0 while `GAME_ENABLED` is off.
  - **The one exception.** Questions answered and Waiting for you read the ask tables and count
    today.
- **Who can see what.** Every member of a workspace can read its `contributions` rows, as they can
  read its ledger. The rows hold who authored which pull request or issue, which GitHub already
  shows every member of the organisation. The page shows only your own counts, plus the rankings the
  arcade already shows.
- **Cost.** `/app` now reads the whole ledger on each visit, as `/play` already does. The command
  makes three `gh` calls per repository every 15 minutes: three repositories today, far below
  GitHub's limits.

## Acceptance criteria

1. Signed in as a player with a linked GitHub account, `/app` shows, in order: your hero, name,
   fleet, season points and both places; the chart of the last 7 days; the four tiles; the fleets
   and individuals tables; and the section cards.
2. The chart has seven bars, today last, in Brussels days. Each bar equals the number of pull
   requests you authored that merged into their repository's default branch that day, in the
   workspace's sector repositories. The total equals their sum, and a sub-PR is never counted.
3. The chart carries a text alternative listing the seven days and their counts. With no merges, it
   reads *No PRs merged into main in the last 7 days*.
4. **Questions answered**, **Outbox settled** and **PRDs created** count this UTC month only. **Waiting
   for you** counts your open sessions whose newest round is open, plus the open questions shared
   with you. It links to `/ask/for-me` when at least one is waiting and all of them are shared, and to
   `/ask` otherwise.
5. The fleets table lists every fleet the season knows, ranked by points, with yours marked.
6. The individuals table shows the top 3, then you with your neighbours above and below, with `⋯`
   for skipped ranks. It shows ranks 1 to 5 when you rank 1 to 4. With no points this season, it
   shows the top 3 and *No points yet this season*.
7. Signed out, `/app` shows only *Sign in to see your dashboard*. Signing in returns to `/app` through
   `/app/callback`, which also joins the workspace of the email's domain.
8. A member who never joined a fleet sees *Join a fleet in the arcade to get your hero and your
   score*, linking to `/play`, in place of the hero block.
9. A player with no GitHub linked sees *Link your GitHub in the arcade* in place of their points and
   place, the chart, Outbox settled and PRDs created. Questions answered and Waiting for you still
   count.
10. When one read fails, only its part reads *Couldn't load this. Reload in a moment.*, and the rest
    of the page renders.
11. A deployment with no database shows *The dashboard is not open here* and the section cards.
    Development shows the whole dashboard on the demo world.
12. `pnpm game:contributions --workspace <slug>` upserts one `contributions` row per pull request
    merged into a sector repository's default branch, and one per `omni:prd` issue, from the last 40
    days, with the author's login in lower case. A rerun changes no row, and one repository that
    cannot be read does not stop the others.
13. The game workflow runs `game:contributions` right after `game:xp`, with `continue-on-error`.
14. A workspace member reads only their workspace's `contributions` rows, `anon` reads none, and no
    signed-in user can write one (`supabase/checks/contributions.sql` passes).
15. The dashboard uses only the ask pages' tokens in Omni, Light and Dark (the design-system guard
    passes), and shows no sideways scroll at 393 px wide.
16. `pnpm test`, and the galaxy's typecheck and build, pass.

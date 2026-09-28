# Your dashboard, the app's home — plan

**PRD:** #328 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/personal-dashboard`
→ `main` (`Closes #328`) · **Sub-PRs:** `feat/personal-dashboard--<slice>` → the feature branch
(`Part of #328`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is
informed.

**Two tracers in wave 1.**

- **s1 is the write path.** The `contributions` table, its access check, the `game:contributions`
  command and its step in the game workflow.
- **s2 is the page.** `/app` becomes the dashboard in every situation the spec's States table names.
  It shows the hero block, with the hero, name, fleet, season points and both places, and the
  compact section cards.
  - **Folders:** so that wave 2 can build side by side, s2 also gives each remaining part its own
    folder under `apps/galaxy/src/dashboard/`: `rankings/`, `week/` and `counts/`.
  - **Stubs:** each folder starts with a stub. The stub's loader returns nothing, its view renders
    nothing, and its stylesheet is empty.
  - **Composition:** `Dashboard.tsx`, `load.ts` and `demo.ts` compose the parts in the spec's order.

**Wave 2** fills the three parts, each inside its own folder:

- s3 builds the fleets and individuals tables;
- s4 builds the 7-day chart, which reads s1's table;
- s5 builds the four tiles, which read s1's table, the ledger and the ask tables.

**Wave 3** (s6) describes the finished dashboard in the galaxy README and adds `/app` to
`pnpm galaxy:shots`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The game workflow records who authored each pull request merged into a sector repository's default branch, and who opened each `omni:prd` issue, in a new `contributions` table that workspace members read and only the service role writes | `supabase/migrations/` `supabase/checks/contributions.sql` `.github/workflows/supabase.yml` `.github/workflows/game.yml` `game/cli/contributions` `game/workflow.test.mjs` `game/README.md` `package.json` | — | 1 |
| s2 | `/app` is your dashboard: it renders per request as the signed-in person, in every situation of the spec's States table, with the hero block (hero, name, fleet, season points, both places) and the compact section cards; each remaining part has its own folder and a stub | `apps/galaxy/app/app/` `apps/galaxy/src/dashboard/` `apps/galaxy/src/switch/` `apps/galaxy/src/data/galaxy.fake.ts` | — | 1 |
| s3 | The rankings: every fleet the season knows, ranked with its points and yours marked, and the individuals around you (the top 3, `⋯`, you and your two neighbours) | `apps/galaxy/src/dashboard/rankings/` | s2 | 2 |
| s4 | A week of merges: the 7-day chart of the pull requests you authored that merged into `main`, in Brussels days, with its total and its text alternative | `apps/galaxy/src/dashboard/week/` | s1, s2 | 2 |
| s5 | The four counts: questions answered, outbox settled and PRDs created this season, and the questions waiting for you now, linking to `/ask` or `/ask/for-me` | `apps/galaxy/src/dashboard/counts/` | s1, s2 | 2 |
| s6 | The finished dashboard in the galaxy README (the page, its states and where each number comes from) and in `pnpm galaxy:shots` at the three sizes | `apps/galaxy/README.md` `apps/galaxy/scripts/shots.mjs` | s3, s4, s5 | 3 |

**Shared ground.**

- `apps/galaxy/src/dashboard/`: s2 owns the whole folder in wave 1.
  - It creates `rankings/`, `week/` and `counts/`, each with a stub loader, a stub view and an empty
    stylesheet.
  - Its `Dashboard.tsx`, `load.ts` and `demo.ts` compose the parts: each part's loader, view, demo
    data and stylesheet.
  - In wave 2, s3, s4 and s5 each own one of those folders. The folders do not meet, so they build
    side by side.
  - Each puts its pure functions, loader, view, demo data, styles and tests inside its own folder,
    and never edits `Dashboard.tsx`, `load.ts`, `demo.ts` or `dashboard.css`.
- `apps/galaxy/src/data/galaxy.fake.ts`: only s2 changes it. It adds `contributions`, scoped by
  workspace, so s4's and s5's loader tests read the table without touching the fake.
  - s5's ask reads use the ask pages' own fakes as they are, or a small fake inside `counts/`.
- s1 and s2 share no prefix. s1 is the only slice under `supabase/`, `game/`, `.github/` and the
  root `package.json`.

## Per slice: done when

**s1: the write path.**

- A migration creates `public.contributions` with the spec's columns, its check on `kind`, and the
  primary key `(workspace_id, kind, repo, number)`.
  - Row-level security lets a member select their workspace's rows (`public.is_member`).
  - Nothing is granted to `anon`, and no policy lets a signed-in user insert, update or delete.
- `supabase/checks/contributions.sql` proves each of those, and the `supabase` workflow runs it
  beside the other checks.
- `pnpm game:contributions --workspace <slug>` works as follows:
  - **Repositories:** it reads every repository of the workspace's sectors under its `github_org`.
  - **Reads:** for each, it reads the default branch, the pull requests merged into it in the last
    40 days, and the `omni:prd` issues created in the last 40 days.
  - **Writes:** it upserts one row per item, with `kind` `pr-merged` or `prd-opened`, the author's
    login in lower case, and `at` as `mergedAt` or `createdAt`.
  - **Skips:** it skips an item with no author.
  - **Failure:** it logs and skips a repository it cannot read, and still writes the others.
  - **Reruns:** a rerun on the same outputs writes identical rows.
- `game/cli/contributions.test.mjs` proves each of those on `gh` outputs as fixtures (a fake
  `exec`).
- The root `package.json` has the `game:contributions` script.
- `game.yml` runs the step right after `game:xp`, with `continue-on-error: true` and the game token,
  and `game/workflow.test.mjs` asserts both.
- `game/README.md` names the command, its window and its table, and says that it never writes the
  ledger.
- `pnpm test` passes.

**s2: the page.**

- `/app` renders per request.
  - **Demo:** the demo world, with a demo *you*.
  - **No database:** *The dashboard is not open here* and the section cards.
  - **Signed out:** only *Sign in to see your dashboard*, with Google.
  - **In no workspace:** *Your account is not in a workspace*, with Switch account.
  - **No `players` row:** *Join a fleet in the arcade to get your hero and your score*, linking to
    `/play`, in place of the hero block.
- `/app/callback` turns the code into the session cookie, joins the workspaces of the email's
  domain, and returns to `/app`, or to `/app?signin_error=…` with the reason.
- **The hero block** shows:
  - the hero as a server-rendered pixel SVG in the fleet's colour;
  - the display name as the page's one `h1`;
  - the fleet's label;
  - the season points (UTC month, from `loadGalaxy`);
  - *You #n of N · <FLEET> #m of M*, or *No points yet this season · <FLEET> #m of M*.
  - **With no GitHub login** (neither `players.github_login` nor a linked identity), the points
    and your place read *Link your GitHub in the arcade*.
  - **When the galaxy cannot be read,** the hero block's figures read *Couldn't load this. Reload
    in a moment.*, and the rest renders.
- **The section cards:** the `SECTIONS` cards come last, compact, one row that wraps.
- **The part folders:** `rankings/`, `week/` and `counts/` exist, with stubs that render nothing.
  `Dashboard.tsx` places them in the spec's order: the hero block, then the week, then the counts,
  then the rankings, then the cards.
- **Tests:**
  - `seasonBounds`, the loader and the server render are tested as the spec's Test seams say, for
    the parts s2 builds.
  - `switch/render.test.ts` is updated for the new `/app`.
  - The design-system guard passes.
- The fake database holds `contributions` rows, scoped by workspace.
- No sideways scroll at 393 px.
- `pnpm test`, the galaxy's typecheck and its build pass.

**s3: the rankings.**

- **Fleets:** every fleet `buildGalaxy`'s `teams` holds, ranked by points, with yours
  (`players.team`) marked.
- **Individuals:** `rankWindow` gives the top 3, then you with your neighbours above and below, and
  `⋯` for skipped ranks.
  - **You rank 1 to 4:** ranks 1 to 5 with no gap.
  - **You rank last:** no one is shown below you.
  - **No points this season:** the top 3 and *No points yet this season*.
- **Names:** each row shows its rank, the display name (the login when that person has none) and
  the points. Logins match ignoring case.
- **When the galaxy cannot be read:** the tables read *Couldn't load this. Reload in a moment.*
- `rankWindow` has the unit tests the spec's Test seams list, and a render test proves both
  tables' rows and marks.
- `pnpm test` passes.

**s4: the week.**

- **Days:** seven bars, the six days before today and today, in Brussels days, today last, each
  labelled with its weekday.
- **Counts:** each bar counts your `pr-merged` contributions whose `at` falls on that day. Logins
  match ignoring case.
- **Total:** the week's sum sits at the top right.
- **Axis:** whole numbers from 0 to the week's highest bar, at least 1.
- **Drawing:** inline SVG on the server, with no chart library and no client script.
- **Text alternative:** a list of the seven days and their counts.
- **An empty week:** *No PRs merged into main in the last 7 days*.
- **With no GitHub login:** the chart reads *Link your GitHub in the arcade*.
- **On a failed read:** *Couldn't load this. Reload in a moment.*
- `chartDays` has the unit tests the spec's Test seams list, including the late-Sunday merge in
  summer that counts on Monday.
- The loader is tested on the fake database (another workspace's rows and other people's rows are
  never counted), and a render test proves the bars and the text alternative.
- `pnpm test` passes.

**s5: the counts.**

- **Questions answered:** the `ask_rounds` with `answered_by` you and `answered_at` this season.
- **Outbox settled:** the `WOUND_CLOSED` ledger events with an `outbox:` id and your login as
  `contributor`, this season.
- **PRDs created:** your `prd-opened` contributions this season.
- **Waiting for you:** your open sessions whose newest round is open, plus the open rounds shared
  with you (`readTabs`, `readForMe`).
  - It links to `/ask/for-me` when at least one is waiting and all of them are shared, and to `/ask`
    otherwise.
- **With no GitHub login:** Outbox settled and PRDs created read *Link your GitHub in the arcade*,
  while Questions answered and Waiting for you still count.
- **On a failed read:** only that tile reads *Couldn't load this. Reload in a moment.*
- **Tests:**
  - `waitingCount` and the season counts have the unit tests the spec's Test seams list, and a
    season's first day counts nothing from the month before.
  - A render test proves the four labels, their numbers and the link.
- `pnpm test` passes.

**s6: the finished page, described and pictured.**

- The galaxy README's app section describes `/app` as the dashboard:
  - its parts in order;
  - its situations;
  - where each number is read from;
  - that points, places and Outbox settled read 0 until the projector reads the kit's delivery
    folders.
- `pnpm galaxy:shots` captures `/app` in the demo, signed in, at the three sizes.
- A manual check at 393, 852 and 1440 px wide, in Omni, Light and Dark, finds no sideways scroll,
  and the feature PR records it.
- `pnpm test`, the galaxy's typecheck and its build pass.

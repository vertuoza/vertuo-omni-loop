# The game layer

A read-only projection of PRD delivery as a planet-terraforming game. Design:
`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`; fleets, players and storage:
`docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md`.

It never writes to an engineering repository, nor to this one. Its only outputs are rows appended
to the ledger in Supabase (`public.ledger_events`, append-only), each login's XP in
`public.player_xp`, recomputed from that ledger at every poll, who authored each pull request merged
into a default branch and each PRD issue (`public.contributions`, for the app's dashboard), the PRD
dossiers read from each repository's delivery folders (`public.dossiers` and
`public.dossier_versions`, a version only where a file changed), one weekly comment on the pinned
Hall of Heroes issue, and a weekly backup kept as a workflow artifact. Delete `game/` and
`.github/workflows/game.yml` to remove it.

The commands read and write Supabase: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (locally,
`npx supabase status` prints both; `apps/galaxy/.env.local` is read if it exists).

The game's variables, read in `kit/lib/env/read.ts` (ADR-0057):

<!-- omni:env-variables -->
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`, the arcade's public address) and
  `SUPABASE_SERVICE_ROLE_KEY`: required by every command, which stops naming them before any work.
- `OMNI_LOOP_WORKSPACE`: the workspace, when `--workspace` names none.
<!-- /omni:env-variables -->

Each command plays for one **workspace** (`public.workspaces`), and reads and writes nothing of
another. Name it with `--workspace <slug>`, or set `OMNI_LOOP_WORKSPACE`; the flag wins. There is no
default: with neither, or with a slug no workspace has, the command stops and says so. Vertuoza is
the workspace `vertuoza`.

- `pnpm game:project --workspace <slug>` — snapshot the workspace's GitHub and read its answered ask
  rounds, append new events to its ledger; logs any event it had to skip
  ([Answered questions](#answered-questions))
- `pnpm game:xp --workspace <slug>` — recompute every login's XP, level and unlocked games from the
  workspace's whole ledger, and write them all to `player_xp` in one request
  ([XP, levels and unlocks](#xp-levels-and-unlocks))
- `pnpm game:score [YYYY-MM] [--rankings <file>] --workspace <slug>` — fold the workspace's ledger
  into a season. With no season: the current month, and on the 1st–7th also the previous month,
  whose final standings become the rankings page written to `<file>`
- `pnpm game:banner <prd> --workspace <slug>` — print one planet's banner; reads only that planet and the planets it is blocked by
- `pnpm game:contributions --workspace <slug>` — record who authored each pull request merged into
  a sector repository's default branch, and who opened each `omni:prd` issue, over the last 40 days,
  in `contributions`; logs what it skipped ([Contributions](#contributions))
- `pnpm game:dossiers --workspace <slug>` — read each repository's delivery folders on its default
  branch into the PRD dossiers: finds or creates each PRD's dossier, and adds a version wherever a
  file changed; logs what it skipped ([PRD dossiers](#prd-dossiers))
- `pnpm game:export <dir> --workspace <slug>` — write the workspace as JSONL (the backup):
  `workspace.jsonl` (its row) beside its `ledger_events`, `sectors`, `teams`, `players` and
  `arcade_scores` (the crew's high scores). `player_xp` is left out: the next `game:xp` rebuilds it
- `pnpm test` — every module is tested on fixtures; nothing touches GitHub or Supabase in tests

Constants live in `game/rulebook.ts`. Org facts live in Supabase, per workspace: `workspaces`
(its GitHub organisation, `github_org`, and its plan repository, `plan_repo`), `repositories` (the
repositories of Settings → Repositories, and whether each is tracked), `sectors` (the map's groups
of repositories), `teams` (the fleets) and `players` (the roster), each changed by a migration, the
arcade or the app. `game:project` and `game:banner` refuse a workspace that names no `github_org` or
`plan_repo`. The workspace is a storage column, never an event field: two workspaces may each hold a
`planet:vertuoza/vertuo-omni-loop#12:charted`.

## What the game reads

PRD 728. For each repository the workspace **tracks** in Settings → Repositories
(`public.repositories`, `tracked = true`), `game:project` lists its `omni:prd` issues through `gh`. An
untracked repository, or one no longer listed, is not read; a repository `gh` cannot read reads as
empty and the others still land. A PRD is `<owner>/<repo>#<n>`: its **home** is the repository of
its issue. For each PRD (`game/sources/github.ts`):

- its folder in the kit layout, `<delivery>/{inbox,shipped}/<nnnn>-<topic>/`, with the delivery
  path read from the home's `.omni-loop/config.yml` (`.omni-loop/delivery` when it names none):
  `spec.md` for `blocked-by`, `plan.md` for the slices, and its outbox
  (`<delivery>/outbox/<nnnn>-<topic>/` while it is built, `<folder>/outbox/` once shipped) for the
  open items and `settled.md`. A PRD with no folder is charted and nothing more;
- its feature PR in its home: a PR into the default branch whose body holds `Closes #<n>`, the one
  labelled `omni:feature` when one is. An open one is read at its head, a merged one on the default
  branch;
- the sub-PRs of that feature PR (`omni:sub`, into its branch), matched to slices by the head ref's
  `--<slice>` suffix;
- for a multi-repository PRD (a plan repository's PRD, whose slice table has a `repo` column), one
  more **region** per other tracked repository holding a feature PR into its default branch whose
  body starts `Part of <owner>/<home repo>#<n>`. A slice is that region's when its `repo` cell names
  the repository (its bare name, as `plan.targets` gives it, or its full name); the region's sub-PRs
  (`omni:sub`, into its feature branch) secure its slices for their authors. The plan and the outbox
  stay in the home. The planet terraforms at the last merge among every region's feature PR, the
  home's included; a repository the plan gives slices whose `Part of` PR is not open yet holds the
  terraform too. A `Part of` naming a PRD whose home is not tracked is ignored, and a slice naming no
  tracked repository is not read;
- a settled item's `Approved by` login settles its wound (`nobody`, an item adopted when raised, is
  no one; a session `delegated by <login>` is that login).

The old `docs/inbox` layout is read nowhere.

**Owner.** The PRD's first assignee, else its issue's author. Their fleet (from the roster) owns the
planet and takes the terraform credit.

**Names.** Every event of a PRD names its home: its `home` column (`public.ledger_events.home`,
`<owner>/<repo>`) and its id, `planet:<owner>/<repo>#<n>:charted`,
`zone:<region repo>:<owner>/<repo>#<n>:<slice>:secured`, `outbox:<region repo>:<owner>/<repo>#<n>/<item>:closed`,
and so on for every template. The economy, the season view and the arcade key a planet by
`<home>#<n>`, so two repositories' PRD 88 are two planets that never share an owner, a crew, a
clawback or a terraform. Rows written before PRD 728 have no `home`.

**Sectors** stay for the map and the cross-sector bonus. A sector names a repository by its full name
or its bare name; a tracked repository that no sector names counts as a sector of its own.

Scoring does not change: every number stays in `game/rulebook.ts`.

## Answered questions

PRD 1180. Every answered ask round pays its answerer `RULEBOOK.questionAnswered`
(2) points and XP at `xp.weights.questionAnswered` (1), whether it was answered on the page or in the
terminal. After the GitHub snapshot, `game:project` reads `public.game_answered_rounds(workspace,
since)` (`loadAnsweredRounds`, `game/sources/supabase.ts`) with `since` = the workspace's
`game_since`, so past answers are backfilled on the first poll, dated when they were answered.

- **Which PRD.** The function finds a round's PRD by the two rules of `dossier_rounds()`, over the
  workspace's numbered PRD dossiers: the brainstorm rule (the round's ask session carries the
  dossier's Claude session, inside that dossier's window) first, then the delivery rule (the round's
  own PRD, asked in the PRD's home repository). A round no PRD claims (a draft's brainstorm, a spike,
  a fix, ad-hoc work) comes back with no PRD, its home the repository it was asked in, else the
  workspace's plan repository. A round whose answerer has no GitHub login is not returned. Only the
  service role may call it.
- **The event.** Each round is one `QUESTION_ANSWERED`, id `ask:<round_id>:answered`, at
  `answered_at`, on the planet `<home>#<prd>`, or on planet 0 when no PRD claims it, crediting the
  answerer's lower-case login and fleet. It is written whether or not its PRD is charted (its
  repository may be untracked). Planet 0 is never a planet, and a planet whose only events are answers
  is not on the map. The id never changes, so a round
  is paid once, however many polls see it.
- **The pay.** `score()` pays it in the season of `answered_at`, with no multiplier. It opens no
  wound and joins no crew: threat, decay, the terraform bonus and the planet's state ignore it.
- **A failed read** of the answered rounds keeps the GitHub events, appends no answer and prints
  why in one line; the next poll reads them again.

Rollback: set `questionAnswered` and its XP weight to 0; the next `game:score` and `game:xp` remove
those points, and the events stay, paying nothing.

## Merged feature PRs

A feature PR merged into its default branch pays the people who landed it, once per region's feature
PR, in the season of the merge, with no multiplier:

- **who merged it**: `RULEBOOK.featureMerged` (30) points, one `FEATURE_MERGED`, id
  `merge:<repo>#<pr>:<planet key>:merged`;
- **each person who approved it**: `RULEBOOK.featureReviewed` (10) points, one `FEATURE_REVIEWED`
  per approver, id `merge:<repo>#<pr>:<planet key>:approved:<login>`. An approver is a reviewer whose
  latest review approves it (`latestReviews`), the PR's author aside.

A bot is never paid. Both earn XP (`xp.weights.featureMerged`, `featureReviewed`). Neither joins the
crew, so the terraform bonus pays as before. `game:project` reads `mergedBy` and `latestReviews` with
the feature PR lists it already makes, so past merges since `game_since` are paid on the first poll.

Rollback: set both numbers and their XP weights to 0; the events stay, paying nothing.

## The fresh start

PRD 728 started the game again, once. `public.workspaces.game_since` is the moment a workspace's
game starts: the migration set it to the moment it was applied for every workspace there was, and a
workspace made later starts when it is made.

- **Nothing before it is written.** The ledger's append (`supabaseLedger`, `game/sources/supabase.ts`)
  reads `game_since` and writes no event whose moment is before it, whoever projected it. A workspace
  it cannot find, or a failed read, appends nothing.
- **Old rows count for nothing.** A row written before PRD 728 has no `home`. It stays stored (the
  ledger is append-only), but `game:score` and `game:xp` read only rows with a `home`
  (`counted()`, `game/experience.ts`): no season, no fleet and no XP adds it up.
- **XP restarted at 0, once.** Every login an old row names keeps its `player_xp` row, rewritten at
  0 by the next `game:xp`. Games already unlocked stay unlocked: `unlocked` is only ever added to.

## Fleets and the roster

A player picks their fleet in the arcade and links their GitHub account once; `players` then maps
their GitHub login to their fleet, and every event the poll appends is stamped with the
contributor's fleet at that moment. A contributor who never joined, or never linked GitHub, has no
fleet and scores individually (spec §8). A player whose fleet is retired has none until they choose
again. Logins match whatever their case.

The roster read is hard (F7): if the sectors, the fleets, the players or the tracked repositories cannot be read, the poll
fails and appends nothing, rather than events stripped of their fleets forever.

## XP, levels and unlocks

Every point a player earns by delivering also counts as **XP**, and XP never resets: a season
starts the Hall of Heroes again, never a level. It reset once, on purpose, at PRD 728's
[fresh start](#the-fresh-start), and the games unlocked before it stayed. Levels unlock the
arcade's games
([`apps/galaxy/README.md` › The game room](../apps/galaxy/README.md#the-game-room)). The rules are
one block of `game/rulebook.ts`, `xp`, applied in one place, `game/experience.ts`
(`experience()`, `levelFor()`, `unlockedFor()`), which `game:xp`, the demo seed and the arcade all
call:

- **XP** is the sum, over every season in the ledger, of a login's positive personal credits as
  `score()` pays them, each multiplied by its kind's weight in `xp.weights` (`zoneSecured`,
  `woundClosed`, `rescue`, `expedition`, `closer`, `questionAnswered`, `featureMerged`, `featureReviewed`), rounded once after summing. Night-shift and
  cross-fleet multipliers count, as they do for points. A zone reverted and a clawback never lower
  it, and fleet credits (a terraform, a decay) are not personal. A weight of 0 leaves a kind out. A
  personal credit whose kind has no weight fails `game/experience.test.ts`, so a new kind of
  credit forces a decision here.
- **Level.** 0 XP is no level. LV 1 comes at `xp.curve.first` XP (the first point), LV n at
  `step`·n·(n−1): LV 2 at 50, LV 3 at 150, LV 5 at 500, LV 10 at 2,250. The level stops at `xp.cap`
  (99).
- **Unlocked** is every game whose level in `xp.unlocks` the player's level reaches (`invaders` at
  LV 1: the first point), added to the games already stored for the login. A game once unlocked
  stays unlocked.
- Playing a game never earns points or XP.

**Changing the rules** is changing a number in the `xp` block and merging it: the next poll
recomputes every player's XP from the whole ledger with the rules of the day. The arcade reads the
same block (How to play's LEVELS, the XP bar), and follows once it is deployed from that merge. A
lower weight or a steeper curve can lower XP and levels, never the games already unlocked; whoever
changes the rules tells the crew. A new game adds its row to `xp.unlocks` and to the arcade's
registry (`apps/galaxy/src/arcade/games/index.ts`).

**`pnpm game:xp`** (`game/cli/xp.ts`) runs in its own job, `xp`, after the ledger job, whatever that
job ended on: a `game:project` that outlasts the ledger job's 30 minutes no longer holds XP and new
unlocks back until a poll finishes. It
reads the workspace's whole ledger and its stored `player_xp` rows, computes every login's XP, level
and unlocked games, and upserts them all in one request. It never writes the ledger. If a read
fails, it writes nothing and exits 1: the ledger job has already ended, so XP catches up at the next
poll.

**`public.player_xp`** holds one row per login the ledger names, player or not, so a person who
joins later already has their XP: key `(workspace_id, github_login)`, the login lower-cased, then
`xp`, `level` (0 before the first point), `unlocked` and `computed_at`. Level and unlocks are
computed in JavaScript and stored; SQL never repeats the rules. The workspace's members read it, and
only the service role writes it. It rebuilds from the ledger, so the backup leaves it out. Until the
workflow is switched on, no row exists, and every player's game room says NO XP YET.

The crew's high scores, `public.arcade_scores`, are the other half: the arcade posts them through
`submit_score()`, which checks the game against the player's `player_xp.unlocked`. Nothing rebuilds
them, so `game:export` backs them up.

## Contributions

The app's dashboard (`/app`, PRD 328) charts the pull requests each person got into `main` over the
last 7 days, and counts the PRDs they opened this season. The ledger cannot say either: it records a
feature PR's merge with no author, and no PRD's author at all. **`pnpm game:contributions`**
(`game/cli/contributions.ts`) is the ledger job's step right after `pnpm game:project`. At each poll,
for each repository of the workspace's sectors, under its `github_org`, it reads through `gh`:

1. the repository's default branch;
2. its pull requests merged into that branch in the last 40 days (`number`, `author`, `mergedAt`,
   `labels`, `body`). A sub-PR merges into a feature branch, so it never counts;
3. its `omni:prd` issues created in the last 40 days, in any state (`number`, `author`,
   `createdAt`).

Forty days cover the current season and the chart's week, even on a month's first days. It upserts
one row per pull request (`kind` `pr-merged`, `at` its `mergedAt`) and per issue (`prd-opened`, `at`
its `createdAt`), with the author's login in lower case. It also writes each PRD's stages (PRD 572),
for the dashboards' PRDs per day:

| kind | when | `number` | `login` | `at` |
|---|---|---|---|---|
| `prd-opened` | the `omni:prd` issue is created — drafted | the issue | its author | `createdAt` |
| `prd-started` | a merged PR labelled `omni:phase-0` whose body holds `Refs #<n>` — in progress | the PRD issue `<n>` | the PRD issue's author | the PR's `mergedAt` |
| `prd-shipped` | a merged PR labelled `omni:feature` whose body holds `Closes #<n>` — shipped | the PRD issue `<n>` | the PRD issue's author | the PR's `mergedAt` |

A labelled PR with no link gives no stage, and its merge still counts as `pr-merged`. The PRD
issue's author comes from the `omni:prd` issues already listed, else from `gh issue view <n> --json
author`, once per PRD; a PRD whose issue cannot be read is skipped and logged, and the rest of its
repository still lands. Every row is keyed by `(workspace_id, kind, repo, number)`: a rerun on the same answers writes identical rows, and a row outside the window is left as
it is. An item with no author (a deleted account) is skipped. A repository it cannot read is skipped
and logged, and the others still land; the step runs with `continue-on-error`, so it never fails the
ledger job. A failed read of the sectors, or a failed write, writes nothing and exits 1. It needs
`pull requests: read` and `issues: read` from the token.

**`public.contributions`** is not the ledger, and the command never writes the ledger: a row can be
rewritten, backfilled or deleted, and the table dropped, without touching its permanent history. The
ledger and the economy never read it. The workspace's members read it, and only the service role
writes it. It rebuilds from GitHub within its window, so the backup leaves it out. Until the workflow
is switched on, it holds no row, and the dashboard's chart and PRDs created read 0.

## PRD dossiers

A dossier keeps a PRD's `spec.md`, `plan.md` and `before-after.html`, every version of each
(PRD 216, PRD dossiers). The kit uploads them from the
terminal (`omni dossier push`); **`pnpm game:dossiers`** (`game/cli/dossiers.ts`, the modules in
`game/dossiers/`) is the fallback, for a PRD brainstormed with no sign-in, an edit that reaches the
default branch later, and every PRD that existed before. Its first run gives every PRD folder a
dossier. At each poll, for each repository of the workspace's sectors and its `plan_repo`:

1. It reads `.omni-loop/config.yml` on the default branch's head, and skips the repository when there
   is none, or when its switch is off: dossiers are on only when `dossier.enabled` is `true` and
   `ask.url` is set, as the kit reads them. It takes `paths.delivery` (default `.omni-loop/delivery`).
2. One recursive tree listing of that commit gives every `<delivery>/{inbox,shipped}/<nnnn>-<topic>/`
   folder's `spec.md`, `plan.md` and `before-after.html`, with their blob hashes. A PRD in both is
   read from the inbox, as the kit reads it.
3. It fetches only the files whose blob differs from the one the dossier's latest version of that
   kind was read at. A version the kit pushed has no blob hash: when its size matches, its stored
   content is hashed as git does, rather than fetched again.
4. It finds the dossier by its key (`<github_org>/<repo>` in lower case, the PRD number), or creates
   it with the spec's front matter `title:` or else the topic, retitles it when a changed spec names
   another, and adds each fetched file through `dossier_add_version()`, the rule the kit's pushes go
   through: a version only when the content's hash differs from the latest, with source `github`, the
   head commit and the blob hash. A second run with no change fetches and adds nothing.

A folder whose name does not parse, a file over 512 KiB, a repository or a file that cannot be read,
and a PRD that cannot be stored are skipped and logged; the run goes on and exits 0, and its step never
fails the ledger job. It needs only `contents: read` from the token.

## Setup

The workflow `.github/workflows/game.yml` does nothing until it is switched on.

1. **Supabase.** The galaxy database must exist and hold the migrations
   ([`apps/galaxy/README.md` › Deploy to production](../apps/galaxy/README.md#deploy-to-production)):
   the variable `SUPABASE_PROJECT_ID` and the secret `SUPABASE_SERVICE_ROLE_KEY` are what this
   workflow uses too. The workflow sets `OMNI_LOOP_WORKSPACE: vertuoza`, the workspace the
   migration creates with its `github_org` and `plan_repo`.
2. **Token.** Create a fine-grained token and store it as the secret `OMNI_GAME_TOKEN`:
   `contents: read`, `pull requests: read` and `issues: read` on every repository the workspace
   tracks in Settings → Repositories (the ledger), and on every repository in its `sectors` (the
   contributions). It no longer needs any organisation permission: fleets come from the arcade, not
   from GitHub teams.
3. **Rankings issue.** Open an issue in this repository (the Hall of Heroes), pin it, and set the
   repository variable `RANKINGS_ISSUE` to its number.
4. **Switch on.** Set the repository variable `GAME_ENABLED=true`. Do it once the crew has joined in
   the arcade: the first poll backfills history with everyone's fleet as it stands then.

Three jobs: `ledger` runs on every schedule and dispatch (concurrency `game-ledger`): `game:project`,
then `game:contributions`, then `game:dossiers`; `xp` runs `game:xp` once `ledger` has ended, whatever
it ended on (concurrency `game-xp`); `rankings` runs on the Monday schedule, or a dispatch with
`post_rankings: true` (concurrency `game-rankings`): it exports the backup (kept 90 days), then posts.
`ledger` times out after 30 minutes, `xp` after 10, `rankings` after 20.

## Known limits

- **One workspace per run.** The workflow polls, scores and backs up `vertuoza` alone: its token
  reads one organisation. Looping over every workspace waits for per-workspace installation tokens.
- **Replay from GitHub is approximate.** Facts GitHub keeps only as current state are dated from
  the best available timestamp: `PLANET_READY` uses the feature PR's `ready_for_review` time, a
  settled outbox item's `raisedAt` is its settle time (the open file is gone), and zone states
  read from labels other than `omni:needs-fix` (whose history comes off the sub-PR timeline) reflect
  the labels at poll time.
- **No clawback on re-raise.** A settle whose item is later reopened or re-raised keeps its points
  (spec §6.4 brake not implemented yet).
- **Every poll re-reads all PRDs.** There is no incremental read; cost grows with the number of
  planets.
- **`game:xp` reads the whole ledger on every poll.** It recomputes every login from all of
  history, with no incremental read, so its cost grows with the ledger.
- **Fleet stamps and scores live only in Supabase.** The ledger can be rebuilt from GitHub, and XP
  from the ledger, but not the fleet each event was stamped with, nor the crew's high scores:
  restore those from the weekly backup artifact.
- **Dossiers are not in the backup.** `game:dossiers` rebuilds what the default branches hold, but
  not the versions the kit uploaded from other branches, nor who opened a dossier.
- **Dossiers read the default branch only.** An edit on a feature branch reaches its dossier through
  the kit, or once it merges. The first run fetches every PRD folder's files; after that, one tree
  listing per repository per poll, and a blob only where a file changed.
- **A feature PR closed unmerged** still counts as the region's feature PR when it has the lowest
  number (sub-PRs drop closed-unmerged ones; feature PRs do not yet).

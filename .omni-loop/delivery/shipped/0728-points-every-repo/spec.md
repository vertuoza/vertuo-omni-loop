---
prd: 728
title: A PRD delivered in any workspace repository earns its people points
blocked-by: none
spec: file
---

# A PRD delivered in any workspace repository earns its people points

**Date:** 2026-09-30 · **PRD:** #728 · **Found by:** bug #724 · **Touches:** `game/` (the snapshot,
the projector, the economy, XP, the CLI), `packages/galaxy/` (the season view), the arcade's planet
keys in `apps/galaxy/src/arcade/`, one migration under `supabase/migrations/`. No change to the kit,
the omni-app or the dashboard's own code.

## Problem

Paul shipped vertuoza/vertuo-automation-plan#88 through the Omni Loop on 2026-09-29 (phase-0 #90,
feature PR #89 merged) and the dashboard shows him 0 points. It is not only Paul: nobody earns
points for a PRD delivered the way the kit delivers today.

- The game reads PRD issues from one repository only, the workspace's `plan_repo`
  (`vertuo-omni-loop`), and reads each PRD's work from the old `docs/inbox/*.md` layout. Since the
  kit moved to one folder per PRD under `.omni-loop/delivery/` (2026-09-25), no repository has that
  layout, so no PRD opens a region, finds its feature PR, or secures a zone.
- Every event of a PRD is named by its number alone (`planet:149:charted`). The legacy file
  `vertuo-workflow-domain/docs/inbox/0149-file-import.md` was matched to a different PRD,
  vertuo-omni-loop #149, and the 115 points Pierre shows today are outbox answers of that
  workflow-domain PRD paid through the wrong planet.
- Multi-repository PRDs (a PRD in a plan repository, a `Part of <owner>/<plan>#<n>` feature PR in
  each target repository) are invisible: the plan repository is not read and the target PRs never
  say `Closes #<n>`.
- The first assignee of the PRD issue owns the planet. Kit PRD issues are rarely assigned, so no
  fleet gets the ship bonus.

## Solution

**What the game reads.** For each repository the workspace tracks in Settings → Repositories
(`public.repositories`, `tracked = true`), the game lists its `omni:prd` issues. A PRD is
`<owner>/<repo>#<n>`: its **home** is the repository of its issue. For each PRD:

- its folder in the kit layout, `<delivery>/{inbox,shipped}/<nnnn>-<topic>/` (the delivery path
  read from the repository's `.omni-loop/config.yml`, as `game/dossiers/folders.mjs` already
  mirrors it): `spec.md` for `blocked-by`, `plan.md` for the slices, `outbox/` for the items and
  `settled.md`;
- its feature PR in the home repository: a PR into the default branch whose body holds
  `Closes #<n>`, labelled `omni:feature` when a labelled one exists;
- for a multi-repository PRD, each feature PR in another tracked repository whose body starts
  `Part of <owner>/<home repo>#<n>`: one more region, with its own slices;
- the sub-PRs of each feature PR (`omni:sub`, into its feature branch), matched to slices by the
  head ref's `--<slice>` suffix, as today.

The old `docs/inbox` reading is removed.

**Owner.** The PRD's first assignee, else its issue's author. Their fleet (from the roster) owns the
planet and takes the ship bonus.

**Sectors** stay for the map and the cross-sector bonus. A tracked repository that no sector names
counts as a sector of its own.

**Scoring does not change:** 10 per zone secured to the sub-PR's author (×1.5 outside working
hours), the 50 expedition bonus at terraform, outbox wounds paid to whoever settled them plus the
closer bonus, the fleet's terraform credit, rescues, decay — every number stays in
`game/rulebook.mjs`.

**Names.** Every event id of a PRD names its home: `planet:<owner>/<repo>#<n>:charted`,
`zone:<region repo>:<owner>/<repo>#<n>:<slice>:secured`, and so on for every template.
`public.ledger_events` gets a column `home text` (`<owner>/<repo>`), null on every row written
before. Everything that keys a planet by its number — the projector, planet state, the economy,
the season view, the arcade's planet map, deep links and dossier lookups — keys it by
`<home>#<n>`.

**Fresh start.** `public.workspaces` gets `game_since timestamptz`, set by the migration to the
moment it is applied. The projector writes no event whose moment is before `game_since`, and the
season score and XP read only rows with a `home`. Old rows stay stored (the table is append-only)
and count for nothing.

## Decisions

- Keep today's scoring rules; only what the game reads, and how it names a PRD, change. (Asked.)
- Read the repositories of Settings → Repositories, not the game's sectors. (Asked.)
- Fresh start: old ledger rows stop counting and nothing before the change is re-read, so Pierre's
  115 points go away and Paul's #88 of 2026-09-29 does not count. Points and XP restart at 0; games
  already unlocked stay unlocked (`player_xp.unlocked` is only ever added to). This breaks, once and
  on purpose, the README's "XP never resets". (Asked.)
- Multi-repository PRDs are in this PRD. (Asked.)
- Owner: first assignee, else the issue's author. (Asked.)
- A repository in no sector is a sector of its own, so the cross-sector bonus stays meaningful.
- `home` is a column, not only a part of the id, so the app and the scorer can filter without
  parsing ids.

## User stories

- As Paul, when I ship a PRD in vertuo-automation-plan, my slices and my answers earn me points on
  the dashboard within one poll.
- As a workspace owner, adding a repository in Settings → Repositories is all it takes for its PRDs
  to score.
- As Pierre, my points are what I delivered, not another PRD's answers.
- As a player, two repositories each with a PRD 88 show as two planets in the arcade.
- As someone running a multi-repository PRD, the slices merged in each target repository score.

## Scope

In: the snapshot's reads (tracked repositories, kit layout, `Part of` regions), repository-named
event ids, the `home` column and `game_since` (one migration), the owner fallback, the economy, XP,
season view and arcade keyed by `<home>#<n>`, the README's game sections, the rollout.

Out: new scoring rules, flat per-stage points, re-reading history before `game_since`, a UI for
sectors, changes to `public.contributions` or the dashboard's code, the kit.

## Test seams

Everything is tested on fixtures, as `game/` already is (`pnpm test`; nothing touches GitHub or
Supabase):

- `game/sources/github.test.mjs`: a fake `gh` serving tracked repositories in the kit layout —
  a single-repository PRD with a plan, sub-PRs and a settled outbox; a multi-repository PRD with
  `Part of` feature PRs in two targets; two repositories each with a PRD 88.
- `game/projector.test.mjs`, `game/economy.test.mjs`: ids carry the home; two PRD 88s never share
  an owner, a clawback or a terraform; nothing before `game_since` is emitted; rows without a
  `home` score nothing.
- `game/experience.test.mjs`: XP ignores rows without a `home`; unlocked games stay.
- `packages/galaxy` and the arcade's planet map: planets keyed by `<home>#<n>`.
- The migration: a persistence test (or the migration's own checks) for `home` and `game_since`
  on realistic rows, the append-only trigger still refusing updates.

## Risks

Merging publishes a migration to production (the `supabase` workflow) and a new projector that the
`game` workflow runs every 15 minutes. The ledger is permanent: an event written wrong cannot be
removed. Rollout, by a person:

1. set the repository variable `GAME_ENABLED` to `false`;
2. merge the feature PR; the migration applies (`home`, `game_since = now()`);
3. run `pnpm game:project --workspace vertuoza` then `pnpm game:xp` once by hand, and check the
   dashboard's points;
4. set `GAME_ENABLED` back to `true`.

Rollback: set `GAME_ENABLED` to `false` and revert the PR. Before step 3 nothing new is in the
ledger and the revert is clean. After step 3, rows with a `home` stay (append-only), and the old
scorer, which does not know the column, would count them beside the old rows: keep the game off
until a fix ships rather than switch the old code back on.

## Acceptance criteria

- A PRD whose issue lives in a tracked repository other than `plan_repo`, delivered in the kit
  layout, earns 10 points per slice sub-PR to that sub-PR's author and the 50 expedition bonus at
  its feature PR's merge, as `game:score` prints them.
- An outbox item settled in the PRD's `settled.md` with `Approved by: <login>` pays that login the
  wound's points and the closer bonus.
- Two tracked repositories each with a PRD 88 produce two planets whose events never share an id,
  an owner, a clawback or a terraform.
- A multi-repository PRD earns zone points for the slices merged in each target repository's
  `Part of` feature PR, and terraforms when every region's feature PR has merged.
- A PRD with no assignee is owned by its issue's author's fleet.
- A repository removed from Settings → Repositories, or untracked, is not read.
- No event is written with a moment before the workspace's `game_since`, and rows with no `home`
  add nothing to any season, any fleet or any XP.
- A game already in `player_xp.unlocked` stays there after XP drops.
- `docs/inbox` is read nowhere in `game/`.

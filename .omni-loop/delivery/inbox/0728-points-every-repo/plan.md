# Plan: a PRD delivered in any workspace repository earns its people points

PRD #728, spec beside this plan (`spec.md`). The feature branch `feat/points-every-repo` merges into
`main` with `Closes #728`. Each slice below is a sub-PR from `feat/points-every-repo--<slice>` into
the feature branch, with `Part of #728`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A single-repository PRD delivered in the kit layout, in any tracked repository, charts, secures zones, closes outbox wounds and terraforms, every event named by its home, with the owner falling back to the issue's author | `game/sources/` `game/projector` `game/planet-state` `game/events` `game/economy` `game/config` `game/cli/project.mjs` `game/test/` `game/README.md` `packages/galaxy/` `supabase/migrations/20261016090000_points_every_repo.sql` | — | 1 |
| s2 | Fresh start: nothing before the workspace's `game_since` is written, and rows with no `home` add nothing to any season, fleet or XP, while unlocked games stay | `game/projector` `game/experience` `game/cli/score.mjs` `game/cli/xp.mjs` `game/sources/supabase` `game/README.md` `apps/galaxy/README.md` | s1 | 2 |
| s3 | A multi-repository PRD: each `Part of <owner>/<home>#<n>` feature PR in a tracked repository is a region whose slices score, and the planet terraforms when every region has merged | `game/sources/github` `game/README.md` | s1 | 3 |
| s4 | The arcade and the boards key a planet by `<home>#<n>`: two repositories' PRD 88 are two planets, and deep links and dossier lookups name the home | `apps/galaxy/src/arcade/` `apps/galaxy/src/data/load-galaxy` `apps/galaxy/src/dashboard/season` | s1 | 2 |

Shared ground:

- `game/README.md`: s1 (what the game reads, the names), s2 (the fresh start, XP's one reset) and
  s3 (multi-repository regions). s1 is wave 1, s2 wave 2, s3 wave 3: never two in one wave.
- `game/projector*`: s1 (names, owner) and s2 (`game_since`). Waves 1 and 2.
- `game/sources/`: s1 owns the whole folder; s2 owns `game/sources/supabase*`, s3
  `game/sources/github*`. s2 and s3 are waves 2 and 3.
- `packages/galaxy/` is s1's alone: the season view's keys change with the events, so its tests
  (`packages/galaxy/src/galaxy.test.mjs`) move in the same slice. s4 reads it, never edits it.
- `apps/galaxy/src/dashboard/season.test.ts` imports the economy: it is in s4's territory, wave 2,
  after s1 changed the economy.

## Per slice: done when

**s1**

- A fake `gh` serving a tracked repository other than `plan_repo`, with a PRD folder under
  `.omni-loop/delivery/{inbox,shipped}/<nnnn>-<topic>/`, a plan, merged `omni:sub` sub-PRs, a
  merged `Closes #<n>` feature PR and a `settled.md`: `game:score` pays 10 per zone to each sub-PR's
  author, the 50 expedition bonus at the merge, and the settled item's `Approved by` login its wound
  and closer points.
- The repositories read are the workspace's tracked `public.repositories`; an untracked or absent
  repository is not read.
- Two repositories each with a PRD 88 produce events that share no id, no owner, no clawback and no
  terraform.
- A PRD with no assignee is owned by its issue author's fleet.
- A tracked repository in no sector counts as a sector of its own for the cross-sector bonus.
- The migration adds `ledger_events.home` (null on old rows) and `workspaces.game_since`, and the
  append-only trigger still refuses an update.
- `docs/inbox` is read nowhere in `game/`.

**s2**

- No event with a moment before `game_since` is appended.
- Ledger rows with no `home` add nothing to `game:score`'s season, to any fleet, or to `game:xp`.
- A game already in `player_xp.unlocked` stays there when XP drops.
- `game/README.md` and `apps/galaxy/README.md` say XP restarted once, at the fresh start.

**s3**

- A PRD in a plan repository with `Part of <owner>/<plan>#<n>` feature PRs in two tracked target
  repositories: each target is a region, its sub-PRs secure zones for their authors, and the planet
  terraforms only when both feature PRs have merged.
- A `Part of` PR naming a PRD in an untracked repository is ignored.

**s4**

- The arcade's map and planet scene show two planets for two repositories' PRD 88.
- A deep link and a dossier lookup name the home, and a link to a planet that does not exist still
  lands on the map.
- `apps/galaxy/src/dashboard/season.test.ts` passes on the new economy, and the dashboard's Points
  column reads the new season's heroes.

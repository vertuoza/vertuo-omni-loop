# The game layer

A read-only projection of PRD delivery as a planet-terraforming game. Design:
`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`; fleets, players and storage:
`docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md`.

It never writes to an engineering repository, nor to this one. Its only outputs are rows appended
to the ledger in Supabase (`public.ledger_events`, append-only), one weekly comment on the pinned
Hall of Heroes issue, and a weekly backup kept as a workflow artifact. Delete `game/` and
`.github/workflows/game.yml` to remove it.

The commands read and write Supabase: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (locally,
`npx supabase status` prints both; `apps/galaxy/.env.local` is read if it exists).

Each command plays for one **workspace** (`public.workspaces`), and reads and writes nothing of
another. Name it with `--workspace <slug>`, or set `OMNI_LOOP_WORKSPACE`; the flag wins. There is no
default: with neither, or with a slug no workspace has, the command stops and says so. Vertuoza is
the workspace `vertuoza`.

- `pnpm game:project --workspace <slug>` — snapshot the workspace's GitHub, append new events to its
  ledger; logs any event it had to skip
- `pnpm game:score [YYYY-MM] [--rankings <file>] --workspace <slug>` — fold the workspace's ledger
  into a season. With no season: the current month, and on the 1st–7th also the previous month,
  whose final standings become the rankings page written to `<file>`
- `pnpm game:banner <prd> --workspace <slug>` — print one planet's banner; reads only that planet and the planets it is blocked by
- `pnpm game:export <dir> --workspace <slug>` — write the workspace as JSONL (the backup):
  `workspace.jsonl` (its row) beside its `ledger_events`, `sectors`, `teams` and `players`
- `pnpm test` — every module is tested on fixtures; nothing touches GitHub or Supabase in tests

Constants live in `game/rulebook.mjs`. Org facts live in Supabase, per workspace: `workspaces`
(its GitHub organisation, `github_org`, and the repository of its PRD issues, `plan_repo`),
`sectors` (repositories), `teams` (the fleets) and `players` (the roster), each changed by a
migration or by the arcade. `game:project` and `game:banner` refuse a workspace that names no
`github_org` or `plan_repo`. The workspace is a storage column, never an event field: two workspaces
may each hold a `planet:12:charted`.

## Fleets and the roster

A player picks their fleet in the arcade and links their GitHub account once; `players` then maps
their GitHub login to their fleet, and every event the poll appends is stamped with the
contributor's fleet at that moment. A contributor who never joined, or never linked GitHub, has no
fleet and scores individually (spec §8). A player whose fleet is retired has none until they choose
again. Logins match whatever their case.

The roster read is hard (F7): if the sectors, the fleets or the players cannot be read, the poll
fails and appends nothing, rather than events stripped of their fleets forever.

## Setup

The workflow `.github/workflows/game.yml` does nothing until it is switched on.

1. **Supabase.** The galaxy database must exist and hold the migrations
   ([`apps/galaxy/README.md` › Deploy to production](../apps/galaxy/README.md#deploy-to-production)):
   the variable `SUPABASE_PROJECT_ID` and the secret `SUPABASE_SERVICE_ROLE_KEY` are what this
   workflow uses too. The workflow sets `OMNI_LOOP_WORKSPACE: vertuoza`, the workspace the
   migration creates with its `github_org` and `plan_repo`.
2. **Token.** Create a fine-grained token and store it as the secret `OMNI_GAME_TOKEN`:
   `contents: read`, `pull requests: read` and `issues: read` on every engineering repository in
   the workspace's `sectors` and on its `plan_repo`. It no longer needs any organisation permission: fleets come from the
   arcade, not from GitHub teams.
3. **Rankings issue.** Open an issue in this repository (the Hall of Heroes), pin it, and set the
   repository variable `RANKINGS_ISSUE` to its number.
4. **Switch on.** Set the repository variable `GAME_ENABLED=true`. Do it once the crew has joined in
   the arcade: the first poll backfills history with everyone's fleet as it stands then.

Two jobs: `ledger` runs on every schedule and dispatch (concurrency `game-ledger`); `rankings`
runs on the Monday schedule, or a dispatch with `post_rankings: true` (concurrency
`game-rankings`): it exports the backup (kept 90 days), then posts. Both time out after 20 minutes.

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
- **Fleet stamps live only in Supabase.** The ledger can be rebuilt from GitHub, but not the fleet
  each event was stamped with: restore those from the weekly backup artifact.
- **A feature PR closed unmerged** still counts as the region's feature PR when it has the lowest
  number (sub-PRs drop closed-unmerged ones; feature PRs do not yet).

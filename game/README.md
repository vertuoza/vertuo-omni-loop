# The game layer

A read-only projection of PRD delivery as a planet-terraforming game. Design:
`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`.

It never writes to an engineering repository. Its only outputs are `game/ledger/*.jsonl`
(append-only events), `game/season/*.json` + `rankings.md` (derived, regenerable) and one weekly
comment on the pinned Hall of Heroes issue. Delete `game/` and `.github/workflows/game.yml` to
remove it.

- `pnpm game:project` — snapshot GitHub, append new events to the ledger; logs any event it had to skip
- `pnpm game:score [YYYY-MM]` — fold the ledger into a season. With no argument: the current month,
  and on the 1st–7th also the previous month, whose final standings become `rankings.md`
- `pnpm game:banner <prd>` — print one planet's banner; reads only that planet and the planets it is blocked by
- `pnpm test` — every module is tested on fixtures; nothing touches GitHub in tests

Constants live in `game/rulebook.mjs`. Org facts (sectors, teams) live in `projects.yml`.

## Teams

Team membership is read from the GitHub teams of the organisation named in `projects.yml`. The
read is hard: if any team cannot be read, or every team reads empty, the poll fails and nothing is
appended (a silent failure would strip teams from every event of that poll, forever). A login in
two teams belongs to the **first** team `projects.yml` lists.

## Setup

The workflow `.github/workflows/game.yml` does nothing until it is switched on.

1. **Token.** Create a fine-grained token and store it as the secret `OMNI_GAME_TOKEN`:
   `contents: read` on every engineering repository in `projects.yml` and on this one (the
   `gh pr` / `gh issue` reads also need `pull requests: read` and `issues: read` there), and
   `members: read` on the organisation (for the team reads).
2. **Pushing to `main`.** The `ledger` job commits `game/ledger` and `game/season` to the default
   branch. Either let the workflow's `GITHUB_TOKEN` push to `main` (branch protection allows GitHub
   Actions), or store a token that may bypass protection as the secret `GAME_PUSH_TOKEN`.
3. **Rankings issue.** Open an issue in this repository (the Hall of Heroes), pin it, and set the
   repository variable `RANKINGS_ISSUE` to its number.
4. **Switch on.** Set the repository variable `GAME_ENABLED=true`.

Two jobs: `ledger` runs on every schedule and dispatch (concurrency `game-ledger`); `rankings`
runs on the Monday schedule, or a dispatch with `post_rankings: true` (concurrency
`game-rankings`). Both time out after 20 minutes.

## Known limits

- **Replay from GitHub is approximate.** Facts GitHub keeps only as current state are dated from
  the best available timestamp: `PLANET_READY` uses the feature PR's `ready_for_review` time, a
  settled outbox item's `raisedAt` is its settle time (the open file is gone), and zone states
  read from labels other than `pr:needs-fix` (whose history comes off the sub-PR timeline) reflect
  the labels at poll time.
- **No clawback on re-raise.** A settle whose item is later reopened or re-raised keeps its points
  (spec §6.4 brake not implemented yet).
- **Every poll re-reads all PRDs.** There is no incremental read; cost grows with the number of
  planets.
- **A feature PR closed unmerged** still counts as the region's feature PR when it has the lowest
  number (sub-PRs drop closed-unmerged ones; feature PRs do not yet).

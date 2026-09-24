# The game layer

A read-only projection of PRD delivery as a planet-terraforming game. Design:
`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`.

It never writes to an engineering repository. Its only outputs are `game/ledger/*.jsonl`
(append-only events), `game/season/*.json` + `rankings.md` (derived, regenerable) and one weekly
comment on the pinned Hall of Heroes issue. Delete `game/` and `.github/workflows/game.yml` to
remove it.

- `pnpm game:project` — snapshot GitHub, append new events to the ledger
- `pnpm game:score [YYYY-MM]` — fold the ledger into a season
- `pnpm game:banner <prd>` — print one planet's banner; reads only that planet and the planets it is blocked by
- `pnpm test` — every module is tested on fixtures; nothing touches GitHub in tests

Constants live in `game/rulebook.mjs`. Org facts (sectors, teams) live in `projects.yml`.

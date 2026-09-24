# Omni Loop

![Omni Loop — OmniMan and the fleets of beaver, octopod and picsou, flying to save a planet](docs/assets/omni-loop-hero.png)

Omni Loop turns product plans into delivered software across Vertuoza's engineering repositories.
A PM writes a PRD. The PRD becomes a plan of waves and slices, and coding agents deliver it. Anyone with a
coding-agent slot can lend it to a PRD they do not own.

On top of that delivery sits a game. Each PRD is a **planet** the organisation terraforms together.
Unanswered questions, stuck slices and shipped bugs are **Entropy**, and they cost the owning team
points until someone closes them. The game only reads the delivery layer and can be removed
without touching it (`game/`, `.github/workflows/game.yml`).

- Design: [`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`](docs/superpowers/specs/2026-09-24-omni-plan-game-design.md)
- Game layer reference: [`game/README.md`](game/README.md)

## Getting started

### Prerequisites

- Node 22 or later, and pnpm
- The GitHub CLI, logged in: `gh auth status` (read access to the `vertuoza` organisation)

### Install and test

```bash
pnpm install
pnpm test
```

The tests run entirely on fixtures and never call GitHub.

### Describe your repositories and teams

Fill in `projects.yml` with the real engineering repositories, grouped into sectors. Give each team
(`beaver`, `octopod`, `picsou`, `cia`, `invincible-team`) its home sector. Team names must match the
GitHub teams of the `vertuoza` organisation.

```yaml
sectors:
  <sector-name>: { repos: [<repo>, <repo>] }
teams:
  beaver: { home: <sector-name> }
```

### Run it by hand

```bash
pnpm game:banner 2332      # one planet's banner, read live from GitHub
pnpm game:project          # snapshot GitHub and append new events to game/ledger/
pnpm game:score            # fold the ledger into this month's season and rankings
```

`game:project` writes permanent history to `game/ledger/`. Run it only once `projects.yml` holds the
real repositories.

### Switch on the scheduled workflow

The workflow polls every 15 minutes and posts rankings every Monday. It does nothing until it is
switched on. The token, rankings issue and `GAME_ENABLED` steps are described in
[`game/README.md` › Setup](game/README.md#setup).

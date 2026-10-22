# AGENTS.md

Instructions for any coding agent working in this repository (Claude Code reads them through
`CLAUDE.md`). They hold only what you would otherwise get wrong; the playbook holds the rest.

## What this repository is

The Omni Loop kit (`omni` CLI, Claude plugin, skills, templates) that turns PRDs into delivered
software, plus the game, the arcade and the GitHub App built on it. The repository dogfoods the kit
it builds: its own PRDs run through the loop, and its rules live in `.omni-loop/`. A pnpm workspace:

| Path | What |
|---|---|
| `kit/` | the delivery kit: the `omni` CLI (`kit/lib`, `kit/bin`), the plugin and its skills, templates; `kit/dist/` is built |
| `game/` | the game layer: projector, ledger, economy, banner, rankings |
| `apps/galaxy/` | `@omni/galaxy-app`, the OMNI LOOP arcade and the docs site (Next.js, Vercel) |
| `apps/omni-app/` | the Omni GitHub App; `apps/omni-app/api/` is built |
| `packages/` | `@omni/design` (design system), `@omni/galaxy` (galaxy view), `@omni/github` |
| `supabase/` | the game's database: migrations, checks, config, demo seed |
| `scripts/` | repository scripts (lint, check:changed, mutation, migration order) and their guard tests |
| `fallow/` | baselines for `pnpm fallow:audit` (dead code, dupes, health) |
| `layering/` | the baseline of the layering guard |
| `mutation/` | `floor.json`, the mutation-score floors a PR never lowers |
| `docs/` | the user guide (`docs/guide/`, served at `/docs`), design specs, assets |
| `.omni-loop/` | this repository's own loop: config, delivery (PRDs), knowledge, playbook |

## Before you change anything

Run `node .omni-loop/bin/omni.mjs kb show briefing`, then `kb show <form>` for each form the work
touches: `setup`, `verification`, `testing`, `conventions`, `architecture`, `design`,
`pull-requests`, `releasing`, `definition-of-done`, `bug-fixing`, `ci`. The playbook
(`.omni-loop/knowledge/playbook/`) is the source of truth: when this file and a form disagree, the
form wins.

## Setup

- Node >= 22.18 (`engines` in `package.json`).
- **pnpm 12**, pinned by `packageManager` in `package.json`. Any pnpm 10 or later on the PATH hands
  off to the pinned version by itself; pnpm 9 and older refuse the lockfile ("expected a single
  document in the stream"). Settings live in `pnpm-workspace.yaml`, not in `package.json`.
- Install once, from the root: `pnpm install --frozen-lockfile`. It also turns on the git hooks
  (`.githooks/`: pre-commit, pre-push). A dependency whose install script must run is listed under
  `allowBuilds` in `pnpm-workspace.yaml`.
- `apps/galaxy/.env.local` (copied from `apps/galaxy/.env.example`) is only for the game's scripts
  and the arcade. The tests never need it and never call GitHub.

## Commands

From the root. Times measured on a developer laptop from a clean worktree, with pnpm 12; each
command exited 0 there.

| Command | What it does | Time | Needs |
|---|---|---|---|
| `node .omni-loop/bin/omni.mjs kb show briefing` | prints the rules every change follows | < 1s | nothing |
| `pnpm test` | the preflight: one vitest run over the whole workspace | ~2.5 min | install |
| `pnpm lint` | typescript-eslint `strictTypeChecked` over every tracked TS file; any finding fails | ~80s | install |
| `pnpm lint <path>...` | the same lint, only the files under those paths | ~5s for one file | install |
| `pnpm typecheck` | `tsgo` over the root project and the pitch engine, then the arcade's typecheck | ~5s | install |
| `pnpm check:changed --base origin/<branch>` | while iterating: typecheck, lint, related tests, fallow audit of the files changed since the merge-base | ~10s for a docs-only change; ~2 min when `package.json` or the lockfile changes (the whole test run) | install, the base fetched |
| `pnpm mutation:changed --base origin/<branch>` | Stryker on the delivery-core files changed; says so and exits when there are none | ~3s with none; minutes per core file | install |
| `pnpm kit:build` | rebuilds `kit/dist/omni.mjs` | ~1s | install |
| `node apps/omni-app/build.ts` | rebuilds `apps/omni-app/api/` | ~1s | install |

`check:changed` is for iterating only. Before a sub-PR is marked ready, and before every push to a
ready PR into `main`, run the full `pnpm test` and the full `pnpm lint` (verification form).

## Generated files

`kit/dist/` and `apps/omni-app/api/` are built, never hand-edited (`generated:` in
`.omni-loop/config.yml`, PRD 1138).

- Inside a wave, a slice rebuilds them only to test and commits none; the wave rebuilds once after
  merging.
- Outside a wave, the change commits its rebuild: `kit/test/dist.test.ts` fails on a stale bundle.

## Never

The Never rules live in one place, the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`
prints them, and the session start prints them too. Read them before you change anything.

## The loop

idea -> PRD -> inbox -> building -> outbox -> shipped -> retro. The folder is the status
(`.omni-loop/delivery/inbox/`, `.../shipped/`). Only a person merges into `main`; every decision an
agent takes alone becomes an outbox item a person answers or adopts.

- Claude skills: `/omni:brainstorm`, `/omni:plan`, `/omni:yolo`, `/omni:wave`, `/omni:do-work`,
  `/omni:bug-fix`, `/omni:pr`, `/omni:pr-care`, `/omni:drive`; `/omni:help` lists them all.
- Terminal commands any agent can run (`omni` = `node .omni-loop/bin/omni.mjs`): `omni status`,
  `omni prd <n>`, `omni board <n>`, `omni next`, `omni check`, `omni help <name>`.

## Where to read next

- `.omni-loop/knowledge/`: the product registers (`product/`), the decision records (`adr/`), the
  playbook (`playbook/`) and the screen library (`design/`).
- `docs/guide/`: how the loop works, for the people who use it.
- `apps/galaxy/AGENTS.md`: applies inside `apps/galaxy/`, on top of this file.

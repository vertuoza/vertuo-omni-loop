---
form: setup
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@39e6355
  - pnpm-lock.yaml@86d97a2
  - pnpm-workspace.yaml@ffd7b91
  - .github/workflows/game.yml@8e69ab2
  - README.md@7eaaaa0
  - apps/galaxy/.env.example@a092419
  - .gitignore@7158bd4
terraformed: 2026-09-25
---

# Setup

Use this page when getting a checkout ready to build, test, and run locally.

## Prerequisites
<!-- slot: prerequisites · required · by: terraform -->
- Node 22.18 or later (`engines` in `package.json`), the first Node 22 that runs the scripts'
  TypeScript natively; the workflows set up the latest Node 22.
- pnpm 12: `packageManager` in `package.json` pins it, every workflow's `pnpm/action-setup` reads
  that pin, and any pnpm 10 or later hands off to it. Its settings (`allowBuilds`,
  `ignoredOptionalDependencies`) live in `pnpm-workspace.yaml`.
- The GitHub CLI, logged in, as the README's prerequisites ask. The tests do not need it: they
  never call GitHub.

## Install
<!-- slot: install · required · by: terraform · verified: 2026-09-25 -->
`pnpm install --frozen-lockfile`, once, from the root: one install for the whole workspace (the
root package, `apps/*` and `packages/*`), exactly as the `game` workflow runs it.

## Run
<!-- slot: run · optional · by: terraform -->
See: README.md#open-the-galaxy

## Environment
<!-- slot: env · optional · by: terraform -->
`apps/galaxy/.env.example` lists the settings the arcade and the game's scripts read, and says which
is for what. Copy it to `apps/galaxy/.env.local`, which `.gitignore` keeps out of git and which the
game's scripts in `package.json` also read when it exists. With the Supabase settings left empty,
the arcade plays the built-in demo galaxy; the tests need no such file.

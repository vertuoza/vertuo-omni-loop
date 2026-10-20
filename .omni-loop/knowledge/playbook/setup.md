---
form: setup
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@9870eaf
  - pnpm-lock.yaml@0e940a8
  - pnpm-workspace.yaml@5b2217d
  - .github/workflows/game.yml@4bf6bd0
  - README.md@e0d3c68
  - apps/galaxy/.env.example@27019dd
  - .gitignore@f0d446a
invaded: 2026-10-20
---

# Setup

Use this page when getting a checkout ready to build, test, and run locally.

## Prerequisites
<!-- slot: prerequisites · required · by: invade -->
- Node 22.18 or later (`engines` in `package.json`), the first Node 22 that runs the scripts'
  TypeScript natively; the workflows set up the latest Node 22.
- pnpm 12: `packageManager` in `package.json` pins it, every workflow's `pnpm/action-setup` reads
  that pin, and any pnpm 10 or later hands off to it. Its settings (`allowBuilds`,
  `ignoredOptionalDependencies`) live in `pnpm-workspace.yaml`.
- The GitHub CLI, logged in, as the README's prerequisites ask. The tests do not need it: they
  never call GitHub.

## Install
<!-- slot: install · required · by: invade · verified: 2026-10-20 -->
`pnpm install --frozen-lockfile`, once, from the root: one install for the whole workspace (the
root package, `apps/*` and `packages/*`), exactly as the `game` workflow runs it.

## Run
<!-- slot: run · optional · by: invade -->
See: README.md#open-the-galaxy

## Environment
<!-- slot: env · optional · by: invade -->
`apps/galaxy/.env.example` lists the settings the arcade and the game's scripts read, and says which
is for what. Copy it to `apps/galaxy/.env.local`, which `.gitignore` keeps out of git and which the
game's scripts in `package.json` also read when it exists. With the Supabase settings left empty,
the arcade plays the built-in demo galaxy in development, and a production build serves the closed
mode unless `OMNI_LOOP_DEMO` is `1`; the tests need no such file.

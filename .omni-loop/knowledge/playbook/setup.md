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
  - .github/workflows/supabase.yml@eb1f7c4
  - README.md@7eaaaa0
  - apps/galaxy/README.md@fa2375f
  - apps/galaxy/.env.example@a092419
  - .gitignore@7158bd4
terraformed: 2026-09-25
---

# Setup

Use this page when getting a checkout ready to build, test, and run locally.

## Prerequisites
<!-- slot: prerequisites · required · by: terraform -->
- Node 22 or later: the `engines` field of `package.json`, and the version both workflows set up.
- pnpm: the lockfile is `pnpm-lock.yaml`, lockfile version 9.0; the workflows install pnpm 9.
- The GitHub CLI, logged in with read access to the vertuoza organisation, as the README's
  prerequisites ask. The tests do not need it: they never call GitHub.

## Install
<!-- slot: install · required · by: terraform · verified: 2026-09-25 -->
`pnpm install --frozen-lockfile`, once, from the root: one install for the whole workspace (the
root package, `apps/*` and `packages/*`), exactly as both workflows run it.

## Run
<!-- slot: run · optional · by: terraform -->
See: README.md#open-the-galaxy

## Environment
<!-- slot: env · optional · by: terraform -->
The tests read no setting. The arcade and the game's scripts do: `apps/galaxy/.env.example` lists
the variables and says which is for what. Copy it to `apps/galaxy/.env.local`, which `.gitignore`
keeps out of git and which the game's scripts in `package.json` also read when it exists. With the
Supabase variables left empty, the arcade plays the built-in demo galaxy.

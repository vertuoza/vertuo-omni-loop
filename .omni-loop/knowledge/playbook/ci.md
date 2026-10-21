---
form: ci
form-version: 1
state: filled
points-to: null
evidence:
  - .github/workflows/supabase.yml@cbc038a
  - .github/workflows/game.yml@4bf6bd0
  - apps/omni-app/README.md@a655cb8
  - .github/workflows/checks.yml@af9027a
  - scripts/settle-head.sh@74ab5b9
  - package.json@9870eaf
  - apps/galaxy/package.json@c9781fd
  - scripts/lint-repository.ts@b154f4c
  - .github/workflows/quick.yml@2fe8e9e
  - scripts/check-changed-hooks.ts@c844953
  - .github/workflows/preview-debounce.yml@12349c8
  - .githooks/pre-commit@097e115
  - .githooks/pre-push@4ba5c3d
invaded: 2026-10-20
---

# CI

Use this page when a check on your pull request is red.

## Workflows
<!-- slot: workflows · required · by: invade -->
| Check | Runs on | What it does |
|---|---|---|
| `supabase` › `check` | a pull request touching `supabase/**`, `apps/galaxy/src/**`, `apps/omni-app/src/**`, a `*.boundary.ts`, the two schema scripts or its workflow | an empty local database with every migration and the demo seed; refuses a migration dated at or before the newest on `main` (`scripts/migration-order.ts`); checks `supabase/database.types.ts` and every `*.boundary.ts` read (`pnpm schemas:verify --local`); runs the SQL checks in `supabase/checks/`. 20-minute timeout |
| `checks` › `settle` | a pull request into `main` that is not a draft, never a `docs/phase-0-` head | docs-only (`**/*.md`, `docs/**`) → `stale=true` at once, its checks skipped; else it waits 30 seconds (`scripts/settle-head.sh`) and compares the branch's tip with the run's head: moved → `stale=true`, every job below skips, the newer push has its own run; `gh` cannot read → `stale=false` |
| `checks` › `test shard 1/3`, `2/3`, `3/3` | after `settle` answered `stale=false`, side by side, none cancelling another (`fail-fast: false`) | `pnpm vitest run --shard=<i>/3`: a third of the vitest files each. 20-minute timeout |
| `checks` › `test` | after every test shard, even a failed one, unless `settle` went stale | gathers the shards into the one `test` check: green only when all three passed, otherwise red naming their result. 2-minute timeout |
| `checks` › `typecheck` | after `settle` answered `stale=false` | `pnpm typecheck`: `tsgo -p .` over the root project, `tsgo -p kit/pitch-engine`, then the arcade's `fumadocs-mdx && tsgo --noEmit`. 10-minute timeout |
| `checks` › `lint shard 1/2`, `2/2` | after `settle` answered `stale=false`, side by side, `fail-fast: false` | `pnpm lint --shard <i>/2`: typescript-eslint over every second tracked TypeScript file (`scripts/lint-repository.ts`), failing on any finding. 10-minute timeout |
| `checks` › `lint` | after every lint shard, even a failed one, unless `settle` went stale | gathers the shards into the one `lint` check, as `test` does. 2-minute timeout |
| `checks` › `fallow` | after `settle` answered `stale=false`, side by side with the others | `pnpm fallow:audit` measured from the pull request's base: red only on a dead-code, duplication or complexity finding the pull request adds beyond the baselines in `fallow/` (`fallow/README.md` says when they are regenerated). 10-minute timeout |
| `quick` › `settle`, `quick` | a draft, or a pull request whose base is not `main` (a sub-pull request), never a `docs/phase-0-` head (`.github/workflows/quick.yml`) | the same `settle` gate, then `pnpm check:changed --base origin/<base>`: typecheck, lint of the changed files, related tests, fallow. Group `quick-<head branch>`. 20-minute timeout |
| `security` › `open-source` | every pull request | `node scripts/open-source.ts`: red on a tracked file naming another repository of the maintainer, an address on its domain or a secret; prints `<file>:<line>: <rule> — <fix>`, never the value. A visible fake is listed in `scripts/open-source.allow.json` with its reason |
| `security` › `gitleaks` | every pull request | a pinned gitleaks binary, SHA-256 checked, over the pull request's commits with `.gitleaks.toml` (allowlist: the visible fakes). Upgrade: change `GITLEAKS_VERSION` and `GITLEAKS_SHA256` together |
| `outbox` | every pull request, posted by the omni-loop GitHub App, not by a workflow (ADR-0001) | `skipped` on a sub-pull request and on any pull request that is not a PRD's feature pull request; red on a feature pull request while an outbox item is open, drift is unreworked or a risky change is unaccounted |

A draft, and a sub-pull request into a feature branch, get `quick` on every push: only what
changed, so the full `pnpm test` and `pnpm lint` still come before ready. A ready pull request into
`main` runs `checks` (its `quick` skips), on being marked ready and on every push after; a newer
push cancels an older run still in `settle` (group `checks-<head branch>-ready`; a draft's has `-draft`). A docs-only pull
request (a retro) runs `settle` alone: its `checks` and `quick` report skipped. A phase-0 head runs neither. The only other workflow job on a pull request
is `preview-debounce` › `preview`, on a ready pull request into `main`: it builds the Vercel
previews. The `supabase` workflow's `deploy` job, `release`
(then `release-fallback` when it fails), `releases` and `knowledge-graph` run on a push to `main`; `game`, `health`, `mutation`, `security`
and `business-recheck` on a schedule or by hand.

First, the git hooks `pnpm install` turns on (`.githooks/`): pre-commit the fallow audit, pre-push
the open-source guard (`scripts/open-source.ts`), then the typecheck and lint of what changed. They fail closed, so a red `fallow` usually means a
`--no-verify` commit, which the pull request must explain.

## What gates a merge
<!-- slot: gating · required -->
- A person merges into `main`, and reads the checks first: `checks` › `test`, `typecheck`,
  `lint` and `fallow` green on the ready pull request, `outbox` green on a PRD's feature pull
  request, and `supabase` › `check` green when it ran.
- `main` does not require them yet: making those `checks` jobs required is a
  GitHub setting (branch protection on `main`) a person turns on; nothing in this repository
  changes it. Until then, a red one blocks a merge by agreement, not by GitHub.
- `test`, `typecheck`, `lint` and `fallow` skipped behind a green `settle` means the run went
  stale: read the newer push's run.
- A red `test` or `lint` is the gathering job: open the red shard to read the failure, and
  reproduce it locally with the same command, `pnpm vitest run --shard=<i>/3` or
  `pnpm lint --shard <i>/2` (or the whole `pnpm test` and `pnpm lint`). No `checks` at all on a ready pull request that changes code usually means it
  conflicts with `main`: check that it merges first.
- A red `fallow` names a finding the pull request adds: fix it, or, when Fallow cannot see a
  caller, add an `entry` or `ignore*` line with a comment saying why to `.fallowrc.jsonc`. Never
  regenerate a baseline to turn it green.
- A green pull request whose merge turns `main` red: fix it forward; revert only when the product is down.

## Known reds
<!-- slot: known-reds · optional -->

## When to re-run
<!-- slot: rerun · optional -->

## Budgets
<!-- slot: budgets · optional -->
What every agent session reads here has a ceiling in bytes (PRD 1679): the briefing, each playbook
form as `omni kb show` prints it, pointers expanded, each `paths.context` file, and `session`, their
sum. The ceilings live in `.omni-loop/budgets/context.json`, versioned and reviewed like
`mutation/floor.json`.

- `omni check context` measures them against the base, inside `omni check all`; the omni-loop
  GitHub App posts the same verdict as the `omni / budgets` check run on every pull request.
- Red *over budget*: trim the target back under its ceiling without losing a rule; move detail into
  a linked file. Red *needs a person's yes*: a raised ceiling waits for the high outbox item that
  names it, until a person answers. Only a PRD's pull request can raise one; any other trims, or
  makes the change through a PRD or `/omni:bug-fix`. Neutral: a target could not be measured; the
  check says why and blocks nothing.
- `omni budget measure context` prints today's sizes; `omni budget set context` writes a first
  ceiling for a new target, rounded up to the next KiB, and never raises one.

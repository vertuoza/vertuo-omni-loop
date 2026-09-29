---
form: ci
form-version: 1
state: filled
points-to: null
evidence:
  - .github/workflows/supabase.yml@eb1f7c4
  - .github/workflows/game.yml@8e69ab2
  - .omni-loop/knowledge/adr/0001-outbox-check-as-github-app.md@3ae738d
  - apps/omni-app/README.md@ed64d66
  - .github/workflows/checks.yml@97be10f
  - scripts/settle-head.sh@e3cce31
  - .claude/hooks/fallow-gate.sh@2ae0b9b
terraformed: 2026-09-25
---

# CI

Use this page when a check on your pull request is red.

## Workflows
<!-- slot: workflows · required · by: terraform -->
| Check | Runs on | What it does |
|---|---|---|
| `supabase` › `check` | a pull request that touches `supabase/**` or `.github/workflows/supabase.yml` | starts an empty local database with every migration and the demo seed, then runs `supabase/checks/access.sql`: who may read and write what. 15-minute timeout |
| `checks` › `settle` | a pull request into `main` that is not a draft and changes more than `**/*.md` and `docs/**` (opened, pushed to, reopened or marked ready) | waits 180 seconds (`scripts/settle-head.sh`), then compares the branch's tip with the run's head: moved → `stale=true` and `test` and `fallow` skip, the newer push has its own run; `gh` cannot read the tip → `stale=false`, the checks run anyway |
| `checks` › `test` | after `settle` answered `stale=false` | `pnpm install --frozen-lockfile`, then `pnpm test`: every vitest file in the workspace. 20-minute timeout |
| `checks` › `fallow` | after `settle` answered `stale=false`, side by side with `test` | `pnpm install --frozen-lockfile`, then `pnpm fallow:audit` measured from the pull request's base: red only on a dead-code, duplication or complexity finding the pull request adds beyond the baselines in `fallow/` (`fallow/README.md` says when they are regenerated). 10-minute timeout |
| `outbox` | every pull request, posted by the omni-loop GitHub App, not by a workflow (ADR-0001) | `skipped` on a sub-pull request and on any pull request that is not a PRD's feature pull request; red on a feature pull request while an outbox item is open, drift is unreworked or a risky change is unaccounted |

A draft runs no CI, and neither does a sub-pull request into a feature branch: its base is not
`main`. A ready pull request into `main` runs `checks`: marking a draft ready is what grades it,
then every push after, and a newer push cancels an older run still waiting in `settle`
(concurrency group `checks-<head branch>`). A pull request that changes only `**/*.md` or
`docs/**` (a phase-0, a retro) runs no `checks`. No other workflow job runs on a pull request: the
`supabase` workflow's `deploy` job, `release` and `releases` run on a push to `main`, and the
`game` workflow on a schedule or by hand.

Before any of this, every Claude session here runs the same Fallow audit on `git commit` and
`git push` (`.claude/hooks/fallow-gate.sh`, from `.claude/settings.json`): a `fail` verdict blocks
the command with the findings. So a red `checks` › `fallow` usually means a commit made outside
Claude, or a hook that could not run (it says why on one stderr line and lets the command through).

## What gates a merge
<!-- slot: gating · required -->
- A person merges into `main`, and reads the checks first: `checks` › `test` and
  `checks` › `fallow` green on the ready pull request, `outbox` green on a PRD's feature pull
  request, and `supabase` › `check` green when it ran.
- `main` does not require them yet: making `checks` › `test` and `checks` › `fallow` required is a
  GitHub setting (branch protection on `main`) a person turns on; nothing in this repository
  changes it. Until then, a red one blocks a merge by agreement, not by GitHub.
- `test` and `fallow` skipped behind a green `settle` means the run went stale: read the newer
  push's run. No `checks` at all on a ready pull request that changes code usually means it
  conflicts with `main`: check that it merges first.
- A red `fallow` names a finding the pull request adds: fix it, or, when Fallow cannot see a
  caller, add an `entry` or `ignore*` line with a comment saying why to `.fallowrc.jsonc`. Never
  regenerate a baseline to turn it green.
- A green pull request whose merge turns `main` red missed a dependency its checks could not see.
  Fix it forward; revert only when the product is down.

## Known reds
<!-- slot: known-reds · optional -->

## When to re-run
<!-- slot: rerun · optional -->

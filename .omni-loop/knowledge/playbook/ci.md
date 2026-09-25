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
terraformed: 2026-09-25
---

# CI

Use this page when a check on your pull request is red.

## Workflows
<!-- slot: workflows · required · by: terraform -->
| Check | Runs on | What it does |
|---|---|---|
| `supabase` › `check` | a pull request that touches `supabase/**` or `.github/workflows/supabase.yml` | starts an empty local database with every migration and the demo seed, then runs `supabase/checks/access.sql`: who may read and write what. 15-minute timeout |
| `outbox` | every pull request, posted by the omni-loop GitHub App, not by a workflow (ADR-0001) | `skipped` on a sub-pull request and on any pull request that is not a PRD's feature pull request; red on a feature pull request while an outbox item is open, drift is unreworked or a risky change is unaccounted |

No other workflow job runs on a pull request: the `supabase` workflow's `deploy` job runs on a push
to `main` or by hand, and the `game` workflow on a schedule or by hand.

## What gates a merge
<!-- slot: gating · required -->
TODO(human): no workflow runs the tests on a pull request, and the checks `main` requires could not be read here. Which checks gate a merge, and should one run the tests?

## Known reds
<!-- slot: known-reds · optional -->

## When to re-run
<!-- slot: rerun · optional -->

---
prd: 598
title: PR checks — tests and Fallow on ready pull requests
blocked-by: none
spec: file
---

# PR checks — tests and Fallow on ready pull requests

**Date:** 2026-09-29 · **PRD:** #598 · **Touches:** `.github/workflows/checks.yml` (new),
`scripts/settle-head.sh` (new), `.claude/hooks/fallow-gate.sh` (new), `.claude/settings.json`,
`.fallowrc.jsonc` (new), `fallow/` (new baselines), the root `package.json` and `pnpm-lock.yaml`,
and the playbook's `ci.md`. No change to the kit, the plugin, the apps or any existing workflow.
Ideas taken from `vertuoza/vnext` (`quality.yml`, `scripts/settle-head.sh`,
`.claude/hooks/fallow-gate.sh`); this repository only, nothing shipped through `omni init`.

## Problem

No workflow runs the tests on a pull request here. The only pull-request check is `supabase`,
and only when `supabase/**` changes. The playbook's `ci.md` says so and leaves "What gates a
merge" as an open question. A feature PR marked ready is graded by nobody but the local
`pnpm test` that `/omni:yolo` runs before shipping; a person's own pull request, not even that.

Nothing watches dead code or copy-paste either. Fallow, run on `main` today, finds 279 existing
findings (223 unused exports, 31 unused types, 18 duplicate exports, 2 circular dependencies,
2 unresolved imports, 2 dev dependencies in production, 1 unlisted dependency). Every agent
slice can add more, and no check notices.

vnext solved both, and measured the cost of the naive answer: before its settle gate, 599 of
1000 of its CI runs were cancelled by a later push, and a cancelled run cost more than a green
one.

## Solution

**One new workflow, `checks`,** on `pull_request` into `main` (types `opened`, `synchronize`,
`reopened`, `ready_for_review`), with `paths-ignore` for `**/*.md` and `docs/**`, so a phase-0
PR, a retro PR or a docs-only PR runs nothing. Three jobs:

| Job | Runs | Does |
|---|---|---|
| `settle` | only when the PR is not a draft | waits `SETTLE_SECONDS` (180), then compares the branch's current tip (read with `gh api`) with the run's head sha: moved → outputs `stale=true` and the jobs behind it skip; same → `stale=false` |
| `test` | `needs: settle`, when not stale | `pnpm install --frozen-lockfile`, then `pnpm test` |
| `fallow` | `needs: settle`, when not stale | `pnpm install --frozen-lockfile`, then `pnpm fallow:audit` |

`concurrency: { group: checks-<head ref>, cancel-in-progress: true }`: a newer push cancels the
older run while it is still waiting in `settle`, one idle runner.

A draft PR runs nothing, and neither does a sub-PR into a feature branch (its base is not
`main`). Marking a feature PR ready is what grades it, then every push after.

**`scripts/settle-head.sh`** is vnext's script cut down: no `staging`, no sweep. It reads
`SETTLE_SECONDS`, `GITHUB_HEAD_REF`, the head sha and `GITHUB_REPOSITORY`, and writes
`stale=<true|false>` to `$GITHUB_OUTPUT`. If `gh` fails, it says so and answers `stale=false`:
a settle that cannot look never skips the checks.

**Fallow, against baselines.** `fallow` joins the root `devDependencies` at an exact version,
with a `fallow:audit` script (`fallow audit`). `.fallowrc.jsonc` points
`audit.deadCodeBaseline`, `audit.dupesBaseline` and `audit.healthBaseline` at
`fallow/dead-code.json`, `fallow/dupes.json` and `fallow/health.json`, generated on the branch
from `main`'s code, so the audit fails only on a finding the change introduces. `typeAware` stays
off (vnext's README: a type-aware baseline differs between machines). Entry points no import names
(the CLI's `kit/bin`, the game's `game/cli`, the apps' route files and scripts) are listed in
`entry` with a comment each, so no finding exists only because Fallow cannot see a caller.
`fallow/README.md` says how to regenerate the baselines, and when: after a PR clears findings,
never to turn a red audit green.

**The Claude hook.** `.claude/hooks/fallow-gate.sh` is vnext's hook, running `pnpm fallow:audit`.
A `PreToolUse` entry on `Bash` in `.claude/settings.json` runs it. It reads the command from the
tool input and splits it at `;`, `|`, `&`, `(` and `)`. Only when one of the pieces is a
`git commit` or `git push`, git options between `git` and the verb included, does it run the audit.
Verdict `fail` → exit 2 with the findings, and Claude sees them and does not commit. Fallow missing,
`jq` missing or an audit that crashes → exit 0 with one line on stderr naming why, so a broken tool
never blocks work silently.

**The playbook.** `ci.md`'s Workflows table gains `checks` › `test` and `checks` › `fallow`;
its "No other workflow job runs on a pull request" paragraph and the "What gates a merge" section
are rewritten to say what is now true, and the `TODO(human)` there is answered.

## Decisions

- **Ready PRs into `main` only** (the person's pick). Drafts and sub-PRs stay CI-free, so a wave
  pays nothing; the red appears when the PR is marked ready.
- **Two jobs, not one,** so a red names which gate failed, and the two run side by side.
- **No base lock (`verrou-base.sh`).** A `pull_request` run already tests the merge with its base,
  so the check is vacuous here; vnext's own header says so.
- **No per-area test lists (`test-packs.json`).** One `vitest run` over the whole workspace; the
  upkeep of an area map is not worth it at this size.
- **No sweep (`auto-ci.yml`).** A push by a token that fires no webhook is not a case here: every
  push goes through `pull_request`.
- **Fallow runs its full `audit`** (dead code, duplication, complexity), each against its own
  baseline.
- **Making the checks required on `main`** is a GitHub setting a person turns on after merge; the
  feature PR says so. This PRD does not change branch protection.

## User stories

- As a person reviewing a ready feature PR, I see `checks / test` and `checks / fallow` green or
  red on it, without running anything.
- As an agent, when my commit adds an unused export, the hook blocks the commit and names the export
  and its file, so I fix it before anything is pushed.
- As the owner of the CI bill, a burst of pushes to a ready PR costs one full run, not one per push.
- As a person opening a docs-only PR (a phase-0, a retro), no check runs.

## Scope

In: the workflow, the settle script, the Fallow config, the baselines and their README, the
dev dependency and script, the hook and its settings entry, the tests below, and `ci.md`.

Out: the kit and `omni init` (a later PRD may package this once it has proven itself); branch
protection; clearing the 279 existing findings; a sweep; a base lock; test packs; any change to
`supabase`, `game`, `release` or `releases`.

## Test seams

Every test is a vitest file beside what it tests, run by `pnpm test`, and never calls GitHub
(the playbook's Never).

- **The hook's command matcher** (`.claude/hooks/fallow-gate.test.mjs`, a new include in
  `vitest.config.mjs` for `.claude/hooks/**/*.test.mjs` and `scripts/**/*.test.mjs`): the hook is
  run with `FALLOW_GATE_DRY_RUN=1`, which prints `audit` or `skip` and stops before the audit.
  Audited: `git commit -m x`, `git push`, `git -C dir push`, `git -c a=b commit`,
  `git --no-pager commit`, `pnpm test && git commit -m x`, `(cd x; git push)`, and
  `echo git push` (the word scan sees `git push`, as vnext's does: a harmless extra audit, kept).
  Skipped: `git log commit.txt`, `git status`, `ls`, an empty command.
- **The hook's verdicts:** with a stub `fallow` on `PATH` printing `{"verdict":"fail"}` → exit 2
  and the JSON on stderr; `{"verdict":"pass"}` → exit 0; no `fallow` → exit 0 with one stderr line.
- **The settle script** (`scripts/settle-head.test.mjs`): `SETTLE_SECONDS=0`, a stub `gh` on
  `PATH`; tip equals head sha → `stale=false` in `$GITHUB_OUTPUT`; tip differs → `stale=true`;
  `gh` exits 1 → `stale=false` and a stderr line.
- **The baselines:** `pnpm fallow:audit` exits 0 on the branch before any slice adds code.
- **End to end,** on GitHub, recorded in the feature PR: marked ready, it shows `checks / test` and
  `checks / fallow` green; a throwaway commit adding an unused export turns `checks / fallow` red,
  then is reverted.

## Risks

- **What merging publishes:** nothing the kit or the apps hand out. It adds a workflow that runs
  on every later ready PR into `main`, and a hook every Claude session in this repository runs on
  commit and push. Roll back by reverting the merge; the hook can also be switched off by deleting
  its entry in `.claude/settings.json`.
- **Kit test timeouts on CI machines.** Kit tests hit 5-second timeouts under load (PRD 517). If
  `checks / test` goes red for that alone, the test is listed under `ci.md`'s Known reds, and never
  loosened to turn green.
- **A Fallow false positive** (an entry Fallow cannot see) blocks a commit. The fix is an `entry` or
  `ignore` line with a comment saying why, never a regenerated baseline.
- **The hook's cost:** about 6 seconds per commit and push. Acceptable; if it grows, the fix is a
  narrower audit, not removing the hook.
- **A Fallow upgrade** can change baseline formats. The version is pinned exactly.

## Acceptance criteria

1. A ready PR into `main` that changes a `.mjs` file shows the checks `checks / test` and
   `checks / fallow`, each green on the feature PR itself.
2. A draft PR, a sub-PR into a feature branch and a PR that changes only `.md` files show no
   `checks` job running.
3. Two pushes to a ready PR less than three minutes apart leave one completed run: the first is
   cancelled or skipped.
4. A commit adding an unused export, typed by Claude, is blocked by the hook, with the export's
   name and file in the message; `checks / fallow` is red on a pushed commit with the same change.
5. `pnpm fallow:audit` exits 0 on `main` once merged.
6. The hook tests, the verdict tests and the settle tests above pass in `pnpm test`.
7. `ci.md` lists both new jobs, and its "What gates a merge" section has no `TODO(human)` left.

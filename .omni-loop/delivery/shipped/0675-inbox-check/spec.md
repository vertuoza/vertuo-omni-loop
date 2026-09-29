---
prd: 675
title: An inbox check for phase-0 PRs, instead of the full CI and previews
blocked-by: none
spec: file
---

# An inbox check for phase-0 PRs

**Date:** 2026-09-29 · **PRD:** #675 · **Touches:** `apps/omni-app` (webhook, a new `inbox-check`
function, its evaluation), `kit/lib/config.mjs` (one key), `.github/workflows/checks.yml`,
`apps/galaxy/vercel.json`, `apps/omni-app/vercel.json`, one new script under `scripts/`.

## Problem

A phase-0 PR is where a person reviews a PRD before any code exists. It carries only the PRD's
spec, plan and before/after page. Today it still runs everything a code PR runs:

- `checks.yml` runs `settle`, then `test` and `fallow`. Its `paths-ignore` covers `**/*.md` and
  `docs/**`, but `before-after.html` is neither, so every phase-0 PR triggers it (PR #665 did).
- Vercel builds a preview of both projects (omni-loop and vertuo-omni-loop-galaxy), for a diff that
  cannot change either app.

Meanwhile, nothing on GitHub checks what a phase-0 PR is supposed to be. `omni phase0` and
`omni check inbox` run only in the terminal of the session that opened it. The outbox check, posted
by the omni-loop GitHub App, reports `skipped` on a phase-0 PR, because it grades feature PRs only.

## Solution

The omni-loop GitHub App posts a second check run, **omni-loop · inbox**, on every phase-0 PR. The
inbox check is to a phase-0 PR what the outbox check is to a feature PR: it reads the PR from GitHub
(config from the base, delivery folder from the head, changed files and commits from the compare)
and grades it with the kit's own rules. On every other PR it posts nothing.

In this repository, phase-0 PRs also stop running the test/fallow CI and stop building the Vercel
previews.

### What the inbox check grades

Four gates, each one line of the check run's summary, `ok` or `not ok` with the reason:

1. **Phase-0 verdict.** The kit's `phase0Verdict`, given the compare's changed paths and commit
   messages: docs-only, carrying the PRD's spec, plan and before/after, every commit signed (when
   `signature` is not null). The same verdict `omni phase0 <n>` prints locally.
2. **Inbox folder.** The kit's inbox rules (spec front matter, forbidden fields, `blocked-by`, the
   before/after size cap), applied to **this PRD's folder only**, so a broken folder already on the
   default branch never turns this PR red.
3. **Plan.** The kit's plan grading, the part of `omni plan check <n>` that reads only `plan.md` and
   its spec: slice table, territories, blockers, waves.
4. **PRD issue.** Issue `<n>` exists, is open, and carries `labels.prd`.

All four `ok` gives `success`; any `not ok` gives `failure`. There is no override label and no PR
comment: a phase-0 PR is cheap to fix, and the check run's summary is the report.

### Which PR is a phase-0 PR

The head branch matches `branches.phase0` as the **base** branch's config spells it
(`docs/phase-0-{topic}` here), the way the outbox check recognises a feature PR by
`branches.feature`. The topic taken from the branch names the folder: the one inbox folder
`<nnnn>-<topic>` in the head's delivery folder, whose number is the PRD. A head branch of another
shape gets no inbox check run at all, not even `skipped`.

### Skipping the heavy work (this repository)

- `checks.yml`: `settle` also requires that the head branch is not a phase-0 branch, so `test` and
  `fallow` never start.
- Both `vercel.json` files get an `ignoreCommand` that runs `scripts/vercel-ignore.sh`. The script
  reads `branches.phase0` from `omni config`, and tells Vercel to skip the build when
  `VERCEL_GIT_COMMIT_REF` has that shape; otherwise the build goes ahead as today.

## Decisions

- **The App, not a workflow.** The inbox check lives in the omni-loop GitHub App beside the outbox
  check, so every repository that installs the App gets it without adding a workflow.
- **Recognised by branch shape**, from the base config's `branches.phase0`, never by the
  `labels.phase0` label (a forgotten label would miss the PR).
- **Silent on other PRs.** No `skipped` inbox run on feature PRs, sub-PRs or anything else.
- **Its name is a config key:** `ci.inboxContext`, default `inbox`, read from the base branch like
  `ci.outboxContext`.
- **Scoped to its own folder:** the inbox rules and the plan grading run on this PRD only.
- **No override, no comment.**
- **Skipping CI and previews is this repository's own setup.** Other repositories' CI and hosting
  are theirs; the kit does not change them.
- **Same failure handling as the outbox check:** debounced per repository and PR, 3 retries, then
  the check completes as `failure` with the reason; never left `in_progress`.

## User stories

- As the person reviewing a phase-0 PR, I see one **omni-loop · inbox** check that tells me whether
  the PR holds everything a phase-0 PR must, so I review the content rather than the shape.
- As the author of a phase-0 PR, when something is missing (no plan, an unsigned commit, a source
  file slipped in, a closed PRD issue), the check is red and says which.
- As whoever pays for CI and Vercel, a phase-0 PR runs no tests and builds no previews.
- As a repository that installed the omni-loop App, I get the inbox check on my phase-0 PRs with
  nothing added to my `.github/`.

## Scope

In:

- `apps/omni-app`: the webhook sends an inbox event for the same pull request actions it sends the
  outbox event for (and for a re-requested inbox check run); a new Inngest function `inbox-check`;
  a pure `evaluateInbox`; the check run's name from `ci.inboxContext`.
- `kit/lib/config.mjs`: the key `ci.inboxContext`, default `inbox`.
- `kit` rules reused unchanged. Where a rule only exists wrapped in a command (the inbox rules run
  over every folder, the plan grading inside `omni plan check`), a pure per-PRD entry point is
  exposed beside it, with no change to what the commands print.
- `.github/workflows/checks.yml`, both `vercel.json`, `scripts/vercel-ignore.sh`.
- `apps/omni-app/README.md`: the inbox check's table, beside the outbox check's.

Out:

- The outbox check's behaviour on phase-0 PRs (it stays `skipped`).
- Making the inbox check a required check (no branch protection here: `ci.branchProtection` false).
- Other repositories' CI or Vercel settings.
- Retro and knowledge PRs, which also touch only `.omni-loop/`: they keep today's CI.

## Test seams

- `evaluateInbox`, pure, on fixture folders under `apps/omni-app/test/fixtures/` (base config, head
  delivery folder) with changed paths, commits and the issue handed in: each gate green and red,
  a head branch of another shape, no matching folder, no config on the base.
- `inbox-check` end to end against the existing stubbed GitHub (`fake-github.mjs`): a complete
  phase-0 PR completes `success`; an incomplete one `failure` with the gate's reason; a feature PR
  gets no inbox check run; a failure after retries completes `failure`.
- The webhook's filter: the actions that send the outbox event also send the inbox event; a
  re-requested inbox check run sends only the inbox event.
- `ci.inboxContext`: default and override, in the config tests.
- `scripts/vercel-ignore.sh`: exit 0 (skip) for a phase-0 branch, exit 1 (build) for any other, run
  on a fixture repository.
- `checks.yml` has no test; the first phase-0 PR opened after merge shows it (`settle` skipped).
- Per `omni kb show testing`: no test calls GitHub or Supabase.

## Risks

Merging publishes:

- **The GitHub App** (the omni-loop Vercel project) with a new Inngest function. Every repository
  that installed the App starts getting an inbox check on its phase-0 PRs. Inngest must be
  **resynced** after the deploy, or the new function never runs. Rollback: revert the PR; the App
  stops posting it.
- **The kit** (`kit/dist`, the plugin): one new config key with a default, so existing configs stay
  valid.
- **CI and previews here:** a mistake in the branch test could skip CI or a preview on a PR that is
  not phase-0. The script builds whenever it is unsure (a config it cannot read, an empty branch
  name). Rollback: revert, or remove `ignoreCommand` from a `vercel.json`.

## Acceptance criteria

- On a phase-0 PR (head `docs/phase-0-<topic>`) that carries a complete, signed PRD folder whose PRD
  issue is open, **omni-loop · inbox** completes `success`, and its summary lists the four gates `ok`.
- On a phase-0 PR missing `plan.md`, the check completes `failure` and names the missing plan.
- On a phase-0 PR with a source file, or a commit without the trailer, the check completes `failure`
  and names the file or the commit.
- On a phase-0 PR whose PRD issue is closed or lacks `labels.prd`, the check completes `failure` and
  says so.
- On a phase-0 PR whose head branch names no inbox folder, the check completes `failure`:
  "no inbox folder for topic `<topic>`".
- A broken inbox folder of another PRD on the default branch does not change the verdict.
- On a feature PR, a sub-PR, or any PR whose head is not a phase-0 branch, no inbox check run exists.
- On a repository without `.omni-loop/config.yml` on the base, no inbox check run exists.
- A `ci.inboxContext` set in the base config renames the check run.
- When evaluation fails after its retries, the check completes `failure` with the reason.
- In this repository, a phase-0 PR shows `settle`, `test` and `fallow` skipped, and no Vercel
  preview is built for either project; a feature PR still runs them all.

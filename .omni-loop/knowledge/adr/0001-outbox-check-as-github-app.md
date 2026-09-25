# ADR-0001 — The outbox gate runs as a GitHub App, not a per-repository workflow

**Status:** accepted · **Date:** 2026-09-25 · **PRD:** #28 · **Supersedes:** parts of PRD 3's spec
(`.omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md`), named below

## Context

The outbox gate exists as tested kit code (`gateResult`, `omni status`, `omni comment`), but nothing
runs it on a pull request: it runs only when a `/omni:yolo` session calls it. PRD 3 planned a workflow,
`kit/ci/omni-outbox.yml`, copied into every terraformed repository by the installer and posting a
`ci/outbox` commit status. Neither the workflow nor the installer was built. A workflow would put
secrets and a copy of the gate's plumbing into every installed repository, and a commit status has no
*skipped* state and no details page.

## Decision

The gate runs as a private GitHub App named **`omni-loop`**, owned by the org, backed by the webhook
server in `apps/omni-app`, with its events run through Inngest. Installing the app is the whole setup:
every pull request then carries one check run named `ci.outboxContext`, whose default changes from
`ci/outbox` to `outbox` (shown as **omni-loop · outbox**). The check is posted by the app or not at all:
no `GITHUB_TOKEN` check run and no commit-status fallback, so branch protection can require it from the
app and no workflow can spoof it. No file under `.github/` and no secret enters an installed
repository.

## What it supersedes in PRD 3's spec

- **§3 The footprint** — the `.github/workflows/omni-outbox.yml` line (manifest-listed) is dropped.
- **§7 The outbox** — the gate is posted as the `ci.outboxContext` check run by the app, not as a
  commit status by a workflow.
- **§8 Talking to people** — the rows written by `omni-outbox.yml`: the `ci/outbox` commit status
  becomes the app's check run, and the feature PR's outbox comment is rewritten by the app. The PRD
  issue comment and the Slack note have no writer until a later PRD.
- **§10 Terraforming** — the human step "add `ci/outbox` to branch protection" becomes "optionally,
  require **outbox** from the `omni-loop` app".
- **§11 This repository's layout** — `kit/ci/` (the `omni-outbox.yml` template and its shape test) is
  not built.
- **§13 Phases, phase 2** — `kit/ci/omni-outbox.yml` is replaced by `apps/omni-app` (PRD 28).

## Consequences

- A new vendor, Inngest, sits on the gate's path: when it is down the check is not posted, and a
  required check then blocks merges. The override is to remove the requirement, never to fake a status.
- A repository without `.omni-loop/config.yml` on the base branch still gets the check, `skipped`, as
  proof the app is installed; the default name applies there, so the name is the same everywhere.
- Later automation (automated PRs) widens the app's permissions once, accepted by an org admin.

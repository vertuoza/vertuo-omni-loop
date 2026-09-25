---
prd: 28
title: omni-loop GitHub App — the outbox check
blocked-by: none
spec: file
---

# omni-loop GitHub App — the outbox check

**Date:** 2026-09-25 · **PRD:** #28 · **Follows:** #3 (the kit), #7 (the `omni` plugin) · **Supersedes:**
PRD 3's planned `omni-outbox.yml` workflow (spec §§ 3, 7, 13, phase 2)

## Problem

The outbox gate exists as tested code (`gateResult` in `kit/lib/outbox/status.mjs`, `omni status`,
`omni comment`), but nothing runs it on a pull request. It runs only when a `/omni:yolo` session
happens to call it, so a reviewer looking at a feature PR sees no outbox check, branch protection cannot
require one, and a feature PR can be merged with questions still open.

PRD 3 planned a per-repository workflow (`kit/ci/omni-outbox.yml`, a `ci/outbox` commit status) copied
in by an installer. Neither the workflow nor the installer was built. A workflow would also put secrets
and a copy of the gate's plumbing into every installed repository, and a commit status has no
*skipped* state and no details page.

## Solution

A private GitHub App named **`omni-loop`**, owned by the vertuoza org, backed by a webhook server in
this repository (`apps/omni-app`, its own Vercel project) that runs its events through **Inngest**.

Installing the app on a repository is the whole setup. From then on every pull request carries one
check run, named **outbox** (shown as **omni-loop · outbox**), exactly like any CI check:

| Situation | Conclusion | Title |
|---|---|---|
| No `.omni-loop/config.yml` on the PR's base branch | `skipped` | omni-loop is not active on this repo |
| Activated, but not a feature PR (base is not `repo.defaultBranch`, head does not match `branches.feature`, or no PRD folder for the topic) | `skipped` | omni-loop is not active on this PR |
| Gate green: nothing open, no unreworked drift | `success` | Outbox clear |
| Gate red: open items or unreworked drift | `failure` | `<n>` open outbox items (and/or unreworked drift) |
| Gate red, PR labelled `labels.outboxGo` | `neutral` | Override in effect (`<label>`) |
| Base branch config fails the kit's schema | `failure` | the schema error, one line |
| Evaluation failed after retries, or the snapshot is over its bound | `failure` | omni-loop could not evaluate: `<reason>` |

The check's details page carries `formatReport`'s report. On a feature PR the app also rewrites the
outbox comment in place, as `omni comment` does.

### Flow

```
GitHub ── pull_request / check_run.rerequested ──▶ /api/github   verify signature → inngest.send → 200
Inngest ──▶ /api/inngest   function "outbox-check" (debounced per repo + PR)
              step "in-progress"  create the check run, status in_progress, on the head SHA
              step "evaluate"     snapshot into /tmp + evaluate — one step, /tmp does not survive steps
              step "publish"      complete the check run; rewrite the comment unless the head moved on
            onFailure          complete the check run as failure — never left in_progress
```

### Units (`apps/omni-app`)

| Unit | In → out | Touches GitHub |
|---|---|---|
| `webhook` | raw request → verified, filtered event, or a rejection | no |
| `snapshot` | installation, repo, base ref, head SHA, **list of paths** → a local folder | yes (Git Trees + Blobs) |
| `evaluate` | folder, PR facts, changed files → `{ conclusion, title, summary, comment }` | **no — pure** |
| `publish` | verdict → check run + comment | yes |
| `outbox-check` | the Inngest function wiring the four above | through them |

`evaluate` reuses the kit unchanged: `loadConfig`, `gateResult`, `formatReport` and the formatter behind
`omni comment`, with the kit's context rooted at the snapshot folder. The branch's changed files, which
the kit reads from git locally, come from GitHub's compare endpoint (`base...head`) in the same shape.

`snapshot` takes a list of paths, not a fixed folder: today the list is the base branch's
`.omni-loop/config.yml` plus `paths.delivery` at the head SHA; a later PRD that reads source code widens
the list, not the unit.

### The app's manifest

`apps/omni-app/app.yml` is the GitHub App manifest, committed so the registration is reviewable and
repeatable: private to the vertuoza org; permissions `checks: write`, `contents: read`,
`pull_requests: write`, `metadata: read`; events `pull_request` (actions `opened`, `synchronize`,
`reopened`, `ready_for_review`, `labeled`, `unlabeled`, `edited`) and `check_run` (action
`rerequested`, so GitHub's **Re-run** button re-evaluates).

## Decisions

1. **A GitHub App, not a workflow.** The check appears when the app is installed; no file and no secret
   enters an installed repository. PRD 3's `omni-outbox.yml` and `ci/outbox` commit status are dropped;
   an ADR records it.
2. **App only, no fallback.** No `GITHUB_TOKEN` check run and no commit status: the check is signed by
   the app or not posted. Branch protection can then require **outbox** from the `omni-loop` app only,
   so no workflow can spoof it.
3. **Activated means `.omni-loop/config.yml` on the base branch.** An inactive repository still gets a
   *skipped* check, as proof the app is installed and listening.
4. **Config from base, delivery from head.** Activation, label names (including the override label) and
   `paths.delivery` come from the base branch, so a PR cannot rename the override label or repoint the
   gate. Outbox items come from the head SHA, where a feature branch keeps them.
5. **The gate reads, it never executes.** The app only parses YAML and Markdown through the kit's
   schemas; it never runs repository code. This holds for this PRD; a later PRD that automates PRs must
   restate it.
6. **Fail closed.** Any failure after retries completes the check as `failure` with its reason; the
   check is never left `in_progress`.
7. **Hosted on its own Vercel project,** separate from the galaxy, so the game layer stays removable.
8. **Events through Inngest,** for per-step retries, a per-PR debounce (key `repo + PR number`, a few
   seconds) and a run history with replay. `/api/github` still verifies GitHub's signature itself before
   anything becomes an event.
9. **Least privilege now.** Permissions are what this PRD uses; automated PRs later add
   `contents: write` and the org admin accepts once.
10. **The check's name is `ci.outboxContext`,** whose default changes from `ci/outbox` to `outbox`. An
    inactive repository has no config, so the default applies — the name is the same everywhere.
11. **A snapshot is bounded:** at most 2,000 files and 20 MB; beyond that the check fails naming the
    bound.

## User stories

- As a **reviewer**, I open a feature PR and see **omni-loop · outbox** among its checks, red while
  questions are open, with the questions one click away.
- As a **merger**, I can make **outbox** a required check so a feature PR cannot merge with its outbox
  open, and no workflow can fake it green.
- As a **team adopting omni-loop**, I install the app and add `.omni-loop/config.yml`; nothing else — no
  workflow to copy, no secret to set.
- As a **person answering the outbox**, after `/omni:yolo-fix` pushes its settle commit the check turns
  green on its own, and I can press **Re-run** without pushing.
- As a **maintainer of this repository**, the app checks this repository's own feature PRs, starting with
  this PRD's.

## Scope

**In:** `apps/omni-app` (the four units, the Inngest function, `/api/github`, `/api/inngest`), its
`app.yml` manifest, its tests, its README with the setup steps; the `ci.outboxContext` default change;
one line each in `/omni:yolo` and `/omni:pr` naming the app as the source of the outbox check; an ADR
under `paths.adr` superseding PRD 3's workflow.

**Out:** the Slack note and the outbox comment on the PRD issue; the installer (`omni-loop init` and
friends); reading source code beyond the gate's paths; automated PRs; any change to `gateResult`'s
policy.

**Human steps** (listed in the README, never taken by the work):

1. An org admin registers the app from `apps/omni-app/app.yml` (private to vertuoza) and installs it on
   `vertuoza/vertuo-omni-loop`.
2. Create the Vercel project for `apps/omni-app` and set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
   `GITHUB_WEBHOOK_SECRET`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
3. Create (or reuse) the Inngest account and sync the app at `/api/inngest`.
4. Optionally, require **outbox** from the `omni-loop` app in branch protection.
5. Create the missing label `prd` (and the `pr:*` labels) in this repository.

## Test seams

All in the root vitest suite (`pnpm test`):

- **`evaluate`** — fixture folders, one test per row of the conclusion table, plus: config is read from
  the base snapshot and items from the head snapshot; a head that renames the override label does not
  change the verdict.
- **`webhook`** — valid, wrong and missing signature; the event and action filter; ignored actions answer
  200 without sending an event.
- **`snapshot`** — a stubbed Octokit: only the listed paths are fetched; the file and byte bounds.
- **`publish`** — a stubbed Octokit: `in_progress` then `completed` on the right SHA under the right
  name; the comment rewritten in place (marker); the comment skipped when the PR's head SHA moved.
- **`outbox-check`** — `@inngest/test`: the steps in order, the debounce key, `onFailure` completing the
  check as `failure`.
- **`app.yml`** — a shape test: exactly the permissions and events above, nothing more.

## Risks

- **A new vendor (Inngest) on the critical path.** If Inngest is down the check is not posted; a required
  check then blocks merges. Mitigation: the run history makes it visible, and the human override is to
  remove the requirement, never to fake a status.
- **Required check never posted** (app uninstalled, deploy broken) blocks every PR in a repository that
  requires it. Mitigation: the README says so next to the branch-protection step.
- **The kit's `ctx` assumes a full checkout.** A snapshot holding only config and delivery must be enough
  for `loadConfig` and `gateResult`; the `evaluate` tests prove it, and any kit read outside those paths
  fails a test rather than production.
- **Private key handling.** It lives only in Vercel env vars; the README says to rotate it through the
  app's settings.

## Acceptance criteria

1. On this repository, with the app installed, a feature PR with an open outbox item shows
   **omni-loop · outbox** as `failure`, its details listing the item.
2. After the item is settled and pushed, the same PR's check is `success`.
3. Labelled `outbox:go` while red, the check is `neutral` with "Override in effect".
4. A sub-PR (base is the feature branch) shows the check `skipped`: "omni-loop is not active on this PR".
5. A repository with the app installed and no `.omni-loop/config.yml` shows the check `skipped`: "omni-loop
   is not active on this repo".
6. Pressing **Re-run** on the check re-evaluates it without a new commit.
7. A request with a bad signature to `/api/github` is answered 401 and creates no event.
8. A forced evaluation error ends with the check `failure` ("omni-loop could not evaluate: …"), never
   left `in_progress`.
9. No file under `.github/` and no secret is added to an installed repository.
10. `pnpm test` is green, including the six test seams above.
